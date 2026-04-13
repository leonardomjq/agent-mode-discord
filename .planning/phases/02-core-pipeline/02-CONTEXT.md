# Phase 2: Core pipeline — Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers the pure-core pipeline that drives Discord presence from real editor signals, plus the RPC hardening needed to keep it stable under real-world conditions. Shippable outcome: focusing a text document flips presence to CODING with filename + language in the state string; closing all editors + waiting past `idleTimeoutSeconds` transitions to IDLE; a 20-event/sec burst produces ≤1 `setActivity` per 2 s window (last-wins); killing Discord desktop triggers 5→60 s exponential backoff with a 5 s cooldown floor, and the current activity replays within one backoff tick on reconnect; two VS Code windows produce two pid-scoped activities that never cross-clear.

**In scope:**
- `src/state/machine.ts` — pure reducer (events → state), AGENT > CODING > IDLE priority, `startTimestamp` resets only on transitions (STATE-01–06)
- `src/state/context.ts` — immutable snapshot builder (workspace, filename, language, branch, elapsed, agent, state)
- `src/rpc/throttle.ts` — 2 s leading + trailing throttle, drops intermediates, last-wins (RPC-02, STATE-06)
- `src/rpc/client.ts` hardening — exponential backoff (5→10→20→40→60 s cap), 5 s cooldown between connection attempts, pid-scoped `setActivity`/`clearActivity`, silent failures unless `debug.verbose` (RPC-01, 03–06)
- `src/privacy.ts` stub — single redaction point plumbed through, `show | hide | hash` surface defined, no-op defaults (full config arrives Phase 4)
- `src/detectors/editor.ts` — `activeTextEditor` + `onDidChangeActiveTextEditor`, pushes events into state machine
- `src/detectors/git.ts` — `vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)` branch reads, silent when unavailable
- Driver wiring in `src/extension.ts` that connects detectors → machine → throttle → RPC client, including the idle-tick timer

**Out of scope (later phases):**
- Agent detection (shell integration, session files, polling) → Phase 3
- Personality packs, animator, templater → Phase 4
- `contributes.configuration` surface (≤20 keys) + `debug.verbose` + live reload → Phase 4
- Full privacy implementation (hash, ignore lists) → Phase 4
- Companion plugin lockfile detector → Phase 5
- Publish workflow, OpenVSX push, VSIX artifact → Phase 6

</domain>

<decisions>
## Implementation Decisions

### State machine shape (02-01, 02-02)
- **D-01:** `src/state/machine.ts` exports a **pure reducer** — `reduce(state: State, event: Event): State`. No class, no internal mutation, no timers, no `EventEmitter`. Detectors produce events; a driver in `src/extension.ts` (or a thin `state/driver.ts`) runs reduce and forwards the new state to the throttle. Rationale: maximally vitest-friendly; no fake timers needed; matches ROADMAP plan 02-01's "pure reducer" language exactly.
- **D-02:** `State` is a discriminated union keyed by `kind: "AGENT_ACTIVE" | "CODING" | "IDLE"`, carrying the minimum fields the RPC payload needs: `agent?` (Phase 3 populates), `filename?`, `language?`, `branch?`, `workspace?`, `startTimestamp: number`. The context snapshot (02-02) is built from the current `State` + any detector-provided fields not in State — not stored inside State itself.
- **D-03:** `Event` is a discriminated union: `editor-changed`, `editor-closed`, `agent-started`, `agent-ended`, `branch-changed`, `idle-tick`. Phase 2 uses `editor-*` and `idle-tick`; Phase 3 adds `agent-*`. Reducer handles unknown events by returning current state unchanged (future-proof).
- **D-04:** `startTimestamp` resets **only** on `kind` transition (STATE-05). Same-kind events that only change `filename` / `branch` / `language` do NOT reset `startTimestamp`. Reducer enforces this; no driver-level coordination needed.
- **D-05:** Idle timer lives **in the driver, not in the reducer**. Driver sets `setTimeout(idleTimeoutSeconds * 1000)` whenever state enters/remains `CODING`; on fire it dispatches `{ type: "idle-tick" }`. Reducer transitions `CODING → IDLE` when it sees `idle-tick` and there's no newer editor activity. Cancels the timer on `editor-changed`. Rationale: reducer stays pure; tests can dispatch `idle-tick` directly without `vi.useFakeTimers`.
- **D-06:** `src/state/context.ts` exports `buildContext(state: State, detectorSnapshots: DetectorSnapshots): PresenceContext` — pure function, returns the immutable object the activity builder will consume. Phase 2 fills it; Phase 4's `activityBuilder.ts` will read it.

### Detector subscription model (default — no user discussion needed)
- **D-07:** Detectors push events into the state machine via a driver-level dispatch function injected at construction: `new EditorDetector({ dispatch })`. Detectors own their vscode subscriptions; the driver owns dispatch routing and timer lifecycle. This keeps `state/machine.ts` vscode-free and lets Phase 3 add new detectors by registering new event types.
- **D-08:** Git branch reads are event-driven when possible (`repository.state.onDidChange` from the vscode.git Extension API) and fall back to lazy-on-demand if the git extension is unavailable. All reads wrapped in try/catch; missing git extension produces no events and no `branch` field.

### Throttle + backoff composition (02-03, 02-04)
- **D-09:** Throttle lives in a **separate module** — `src/rpc/throttle.ts` — not inside `rpc/client.ts`. It wraps the client's `setActivity` in a leading+trailing-edge throttle. Pure-core (no vscode, no RPC internals imported), testable standalone with vitest + fake timers.
- **D-10:** Throttle holds **only the latest pending payload** (last-wins). A second call inside the 2 s window replaces the held payload without queuing. Trailing call fires when the window elapses if a held payload exists; no held payload = no trailing call. Leading call fires immediately on first dispatch in an idle window.
- **D-11:** Backoff lives **inside `rpc/client.ts`** (connection lifecycle). Ladder: 5 → 10 → 20 → 40 → 60 s (cap). Floor: 5 s cooldown between any two `login()` attempts regardless of ladder position (RPC-03). Ladder resets on successful connect.
- **D-12:** Reconnect replay: when the client successfully reconnects, it invokes a `replay()` callback supplied by the driver, which re-dispatches the current state through the throttle as a normal `setActivity`. The throttle applies its normal leading/trailing rules — no bypass. Satisfies RPC-04 "replays within one backoff tick".
- **D-13:** Pid scoping — every `setActivity` and `clearActivity` call passes `process.pid` as the activity key. Multi-window isolation (RPC-01) comes from Discord routing pid-scoped updates to separate activity slots in the friends sidebar.
- **D-14:** Silent failures gate — Phase 2 still keeps all RPC failures silent (no toasts, no editor blocking). `debug.verbose` arrives in Phase 4; for Phase 2, continue using `console.debug` as the placeholder sink (Phase 4 will swap to a VS Code output channel).

### Privacy stub scope (default — no user discussion needed)
- **D-15:** `src/privacy.ts` ships the redaction point plumbed end-to-end, but defaults are no-op pass-through. Signature: `redact(field: "workspace" | "filename" | "branch", value: string, mode: "show" | "hide" | "hash"): string`. Phase 2 implements `mode: "show"` (return value unchanged) and `mode: "hide"` (return ""). `mode: "hash"` throws `Error("not implemented until Phase 4")` — keeps the signature locked without writing hash logic that has to be re-tested later. Caller always passes `"show"` in Phase 2.

### Module boundaries (enforce throughout all plans)
- **D-16:** Files in `src/state/` and `src/rpc/throttle.ts` must NOT import `vscode`. Enforced the same way Phase 1 enforces proposed-API bans — extend `scripts/check-api-surface.mjs` to add a path-scoped rule: "no `vscode` import under `src/state/**` or `src/rpc/throttle.ts`".
- **D-17:** All files stay under 200 lines (Phase 1 guardrail carried forward). Reducer functions split into per-state handlers if `machine.ts` grows past 200.
- **D-18:** Every vscode API read + Discord call wrapped in try/catch with silent swallow (existing Phase 1 pattern).

### Testing strategy
- **D-19:** All Phase 2 tests are pure-Node vitest, zero `vscode` imports. Test files land alongside existing `test/rpc.client.smoke.test.ts`:
  - `test/state.machine.test.ts` — reducer transitions (STATE-01 through STATE-04), `startTimestamp` reset rule (STATE-05)
  - `test/rpc.throttle.test.ts` — 20 events in 1 s → ≤1 call per 2 s window, last-wins (RPC-02, STATE-06)
  - `test/rpc.client.backoff.test.ts` — ladder progression, 5 s cooldown floor, replay on reconnect (RPC-03, RPC-04)
  - `test/privacy.test.ts` — `show` returns input, `hide` returns empty, `hash` throws
  - Editor + git detectors are tested via a thin injection test that mocks vscode surface (`vi.mock("vscode", ...)`) and asserts dispatch payloads — **not** e2e; e2e is the Dev Host manual check.
- **D-20:** `pnpm test` must still exit 0 with the full Phase 1 + Phase 2 suite. Coverage: all pure-core modules have vitest coverage (ROADMAP success criterion 5).

### Claude's Discretion
- Exact file layout inside `src/state/` (single `machine.ts` + `context.ts`, or split reducer handlers into `state/transitions/`)
- Whether detectors expose `start()`/`stop()` methods or disposables via `vscode.Disposable`
- Cooldown-vs-ladder interleaving algorithm detail (e.g., `nextDelay = max(ladder[i], lastAttemptAge < 5000 ? 5000 - lastAttemptAge : 0)`)
- Specific test fixture shapes (array of events vs builder pattern)
- Whether `state/driver.ts` exists as a separate file or lives inline in `extension.ts` (split if it grows past ~100 lines)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product requirements
- `discord-agent-presence-prd.md` — Full PRD. Phase 2 touches: §7.1 (state machine FRs), §7.3 (throttle), §7.4 (RPC — backoff, pid scoping, clearActivity), §8 (NFRs — failure mode, debug gating, footprint), §9.4 (file layout under `src/state/`, `src/rpc/`, `src/detectors/`, `src/privacy.ts`), §12.M1 (core pipeline milestone DoD), §18 (guardrails), §19 (refs).
- `.planning/REQUIREMENTS.md` — RPC-01…RPC-06 (6 reqs) + STATE-01…STATE-06 (6 reqs) = 12 requirements this phase MUST satisfy.
- `.planning/ROADMAP.md` — Phase 2 success criteria (5 items) + plan breakdown (02-01 through 02-07).

### Prior phase context
- `.planning/phases/01-skeleton-rpc-seam/01-CONTEXT.md` — stack decisions, silent-failure contract, module-boundary rules, CI guardrail pattern (bundle-size + api-surface scripts).
- `.planning/phases/01-skeleton-rpc-seam/01-02-SUMMARY.md` — current shape of `src/rpc/client.ts` v0 (connect, hardcoded activity, belt-and-braces clear, SIGINT/SIGTERM) that this phase extends.
- `.planning/phases/01-skeleton-rpc-seam/01-04-SUMMARY.md` — smoke test pattern (`vi.mock("@xhayper/discord-rpc")`) that Phase 2 throttle + backoff tests should extend.
- `.planning/phases/01-skeleton-rpc-seam/01-REVIEW.md` — carry-forward issues from Phase 1 code review worth addressing during Phase 2 refactor of `rpc/client.ts`:
  - **WR-01** activate/dispose race (extension.ts) — revisit when wiring the new driver
  - **WR-04** signal handlers suppress process exit — revisit when hardening backoff/shutdown interaction

### Project state
- `.planning/PROJECT.md` — active requirements list + Phase 1 validated items.
- `.planning/STATE.md` — current phase = 02.

### External technical references (from PRD §19)
- `@xhayper/discord-rpc` v1.3.3 — https://www.npmjs.com/package/@xhayper/discord-rpc (Client, user.setActivity, user.clearActivity, events)
- VS Code Git Extension API — https://github.com/microsoft/vscode/blob/main/extensions/git/src/api/git.d.ts (Extension API v1, `repository.state.HEAD`, `onDidChange`)
- VS Code `activeTextEditor` + `onDidChangeActiveTextEditor` — https://code.visualstudio.com/api/references/vscode-api#window

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/rpc/client.ts` (v0 — 99 lines) — keeps its current signature (`connect`, `clearActivity`, `helloWorldAnnounce`, `destroy`, `registerSignalHandlers`, `DEFAULT_CLIENT_ID`, `defaultDeps`). Phase 2 adds backoff + cooldown internally; the public surface expands with `setActivity(client, pid, payload)` (replacing `helloWorldAnnounce`) and an `onReady(callback)` hook for reconnect replay.
- `defaultDeps` dep-injection pattern from Phase 1 extends cleanly — the throttle module accepts a `setActivity` function injection; backoff tests inject a fake timer + fake client factory.
- `test/rpc.client.smoke.test.ts` pattern (vi.mock + callOrder tracker) is the template for the new throttle + backoff tests.
- `scripts/check-api-surface.mjs` — add path-scoped `vscode`-import ban for `src/state/**` and `src/rpc/throttle.ts`.

### Established Patterns
- Silent-failure try/catch wrapper (PRD §8) — every Discord call wrapped, errors swallowed. Phase 2 continues this; the `debug.verbose` gate arrives in Phase 4.
- `process.pid` as the clear/set activity key.
- Pure-Node vitest tests (no `vscode` import). Extended to 4 new test files in Phase 2.

### Integration Points
- `src/extension.ts activate()` currently calls `connectAndAnnounce()`. Phase 2 replaces that with a driver that wires: EditorDetector + GitDetector → State reducer → Throttle → RPC client (with backoff). Existing SIGINT/SIGTERM cleanup stays.
- The driver replaces Phase 1's fire-and-forget connect; the backoff loop owns connection retries and the `replay` callback on reconnect.

</code_context>

<specifics>
## Specific Ideas

- **Reducer call shape:** `const next = reduce(state, { type: "editor-changed", filename: "foo.ts", language: "typescript" })`. Driver holds `currentState` and replaces it after each reduce call. No getState/setState API — the driver is the sole owner.
- **Throttle API shape:** `const throttled = createThrottle(setActivity, 2000)`. Returns a function with the same signature as `setActivity`. Internally holds `{ leadingFired, pendingPayload, trailingTimer }`. `throttled(payload)` either fires immediately (leading edge, no pending) or replaces `pendingPayload` (trailing edge will fire it).
- **Backoff nextDelay formula:** `const nextDelay = Math.max(ladder[Math.min(attempt, ladder.length - 1)], Math.max(0, 5000 - (Date.now() - lastAttemptAt)))`. Guarantees 5 s floor without adding a separate timer.
- **Replay on reconnect:** client's `onReady` handler calls `driver.replay()`, which in turn calls `throttle(buildActivity(currentState))` — same path as any state change. No bypass, no special-case.
- **Idle-tick scheduling:** driver maintains `idleTimer: NodeJS.Timeout | null`. On any `editor-changed` event, `clearTimeout(idleTimer)` then `setTimeout(idleTimerMs)` where `idleTimerMs = idleTimeoutSeconds * 1000` (config landing in Phase 4; Phase 2 hardcodes 300_000 ms). Timer fires → dispatch `{ type: "idle-tick" }` → reducer transitions to IDLE if no newer activity.

</specifics>

<deferred>
## Deferred Ideas

- **Full privacy implementation** (hash SHA-1 6-char prefix, ignore.workspaces/repositories/organizations/gitHosts) → Phase 4.
- **Agent detection** (shell integration, session files, polling, precedence orchestrator) → Phase 3.
- **Personality pack + animator + templater** → Phase 4.
- **`debug.verbose` output channel** — Phase 2 keeps `console.debug`; Phase 4 migrates to VS Code output channel.
- **Live config reload** (`onDidChangeConfiguration`) → Phase 4. Phase 2 uses hardcoded defaults.
- **Phase 1 code review leftovers** (WR-01 activate/dispose race, WR-02 double shutdown idempotency, WR-04 signal handler exit) — fold into Phase 2 while touching `extension.ts` + `rpc/client.ts`, or defer to `/gsd-code-review-fix 01` first.

</deferred>

---

*Phase: 02-core-pipeline*
*Context gathered: 2026-04-13*
