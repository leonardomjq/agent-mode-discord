---
phase: 02-core-pipeline
verified: 2026-04-13T12:31:00Z
status: human_needed
score: 12/12 must-haves verified (automated); 3 UAT items pending human sign-off
overrides_applied: 0
re_verification: false
human_verification:
  - test: "IDLE transition on timer (SC-1 / STATE-02)"
    expected: "Open a .ts file (CODING shows with filename in Discord sidebar), close all editors, wait 5 min 10 s, verify Discord shows IDLE copy; re-open a file and verify CODING restores immediately"
    why_human: "idleTimeoutSeconds hardcoded to 300_000 ms; vitest fake timers prove the dispatch path but cannot verify the driver uses real setTimeout in the running VS Code process"
  - test: "Discord kill/restart replay (SC-3 / RPC-03, RPC-04)"
    expected: "Kill Discord while extension is active with a file open; observe backoff ladder in Output (5 s → 10 s → 20 s → 40 s → 60 s cap, no two attempts < 5 s apart); relaunch Discord; activity replays within one backoff tick with no user action"
    why_human: "Requires real Discord desktop process lifecycle; vitest mocks the socket"
  - test: "Two-window pid isolation (SC-4 / RPC-01)"
    expected: "Two Dev Host windows open simultaneously show two independent Discord activities (a.ts in window 1, b.ts in window 2); closing window 1 clears only the a.ts activity; b.ts activity remains"
    why_human: "Requires two real VS Code Dev Host windows + Discord desktop with pid-scoping honored; process-level isolation cannot be faked in vitest"
---

# Phase 2: Core Pipeline Verification Report

**Phase Goal:** Pure-core modules (state machine, throttle, privacy, context) + editor/git detectors shipped and tested without vscode. RPC hardened with backoff + cooldown. One real state (CODING) flows end-to-end; IDLE transitions work on timer.
**Verified:** 2026-04-13T12:31:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All 12 phase requirements are satisfied in code and automated tests. The automated guardrail suite is fully green. Three success criteria require human Dev Host verification that cannot be automated (detailed below).

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Focusing a text document flips presence to CODING with filename + language; closing all editors + waiting past idleTimeoutSeconds transitions to IDLE | VERIFIED (automated) + ? HUMAN (IDLE timer wall-clock) | `createEditorDetector` dispatches `editor-changed` with filename+language; `reduce()` transitions IDLE→CODING; `scheduleIdle()` fires `idle-tick` after IDLE_MS=300_000; `reduce()` transitions CODING→IDLE. Tests: state.machine.test.ts (8 passing), detectors.editor.test.ts (5 passing). IDLE timer path needs manual UAT (SC-1) |
| 2 | 20 state-change events in 1 s produces at most one `setActivity` per 2 s window; final state is always latest | ✓ VERIFIED | `createThrottle` leading+trailing last-wins with `pendingPayload` single-slot. Test 2 in rpc.throttle.test.ts: 20 calls at 50ms intervals → exactly 2 underlying calls (leading=payload-0, trailing=payload-19). Test 3: trailing fires "third" not "second". |
| 3 | Discord kill triggers 5→10→20→40→60 s backoff, no two attempts within 5 s; activity replays within one backoff tick | VERIFIED (automated) + ? HUMAN (real Discord) | `BACKOFF_LADDER_MS=[5000,10000,20000,40000,60000]`, `COOLDOWN_FLOOR_MS=5000`. `scheduleRetry` reads `nextDelay()` BEFORE incrementing `attempt` (d720a96 patch). `mgr.onReady(()=>throttled(buildPayload()))` wires replay. Tests 1-5 in rpc.client.backoff.test.ts passing. Real Discord kill/restart needs manual UAT (SC-3). |
| 4 | Two VS Code windows produce two independent Discord activities; closing one does not clear the other | ? HUMAN only | `createConnectionManager(DEFAULT_CLIENT_ID, process.pid, ...)` scopes every `setActivity`/`clearActivity` to `process.pid`. Test 6 in rpc.client.backoff.test.ts proves pid forwarding. Real two-window behavior requires manual UAT (SC-4). |
| 5 | All pure-core modules have vitest coverage and pass `pnpm test` without any `vscode` import | ✓ VERIFIED | 42/42 tests passing. `check:api-surface` scans 9 .ts files, 5 pure-core, 0 violations. No `import ... from "vscode"` in `src/state/**`, `src/rpc/throttle.ts`, `src/privacy.ts`. |

**Automated score:** All 5 roadmap SCs have code-level evidence. 3 SCs additionally require human UAT.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `src/state/types.ts` | Discriminated union State/Event/DetectorSnapshots/PresenceContext | ✓ VERIFIED | 80 lines, zero vscode imports, all 4 types exported |
| `src/state/machine.ts` | Pure reducer `reduce(state, event, now?): State` + `initialState()` | ✓ VERIFIED | 88 lines, no timers/mutation/vscode, switch(event.type) with default passthrough |
| `src/state/context.ts` | `buildContext(state, snapshots?): PresenceContext` with Object.freeze | ✓ VERIFIED | 35 lines, Object.freeze on output, nullish coalescing overlay rule |
| `src/rpc/throttle.ts` | `createThrottle<T>(fn, windowMs, deps?)` leading+trailing last-wins | ✓ VERIFIED | 77 lines, pure-core, single-slot `pendingPayload`, `lastFiredAt=-Infinity` initial |
| `src/rpc/client.ts` | `createConnectionManager` with backoff+cooldown+replay+pid-scope | ✓ VERIFIED | 230 lines (see anti-patterns section), all required exports present |
| `src/privacy.ts` | `redact(field, value, mode): string` D-15 signature | ✓ VERIFIED | 31 lines, show/hide/hash(throws) switch-case |
| `src/detectors/editor.ts` | `createEditorDetector(dispatch): vscode.Disposable` | ✓ VERIFIED | 50 lines, seeds from activeTextEditor on construction, subscribes to onDidChangeActiveTextEditor |
| `src/detectors/git.ts` | `createGitDetector(dispatch): vscode.Disposable` | ✓ VERIFIED | 106 lines, async-on-construction IIFE, silent no-op if vscode.git absent |
| `src/extension.ts` | Full pipeline driver wiring detectors→reducer→throttle→RPC | ✓ VERIFIED | 123 lines, all modules imported and wired, `createDriver()` factory |
| `test/state.machine.test.ts` | 9 passing assertions STATE-01..05 + D-06 | ✓ VERIFIED | 9 passing, 0 todo |
| `test/rpc.throttle.test.ts` | 5 passing assertions RPC-02/STATE-06 | ✓ VERIFIED | 5 passing, 0 todo |
| `test/rpc.client.backoff.test.ts` | 9 passing assertions RPC-01/03/04/05 | ✓ VERIFIED | 9 passing, 0 todo |
| `test/privacy.test.ts` | 4 passing assertions show/hide/hash/unknown | ✓ VERIFIED | 4 passing, 0 todo |
| `test/detectors.editor.test.ts` | 5 passing vi.mock(vscode) assertions | ✓ VERIFIED | 5 passing, 0 todo |
| `test/detectors.git.test.ts` | 5 passing vi.mock(vscode) assertions | ✓ VERIFIED | 5 passing, 0 todo |
| `scripts/check-api-surface.mjs` | Extended with PURE_CORE_PATHS + VSCODE_RUNTIME_IMPORT ban | ✓ VERIFIED | `PURE_CORE_PATHS = ["src/state/", "src/rpc/throttle.ts", "src/privacy.ts"]`; ban regex present at line 16 |
| `.planning/phases/02-core-pipeline/02-HUMAN-UAT.md` | SC-1/SC-3/SC-4 dev-host checklists | ✓ VERIFIED | File exists, 3 checklists authored, sign-off matrix present (unsigned) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `createEditorDetector` | `dispatch(Event)` | `dispatch` injected at construction | ✓ WIRED | `createEditorDetector(dispatch)` at extension.ts:105 |
| `createGitDetector` | `dispatch(Event)` | `dispatch` injected at construction | ✓ WIRED | `createGitDetector(dispatch)` at extension.ts:106 |
| `dispatch(event)` | `reduce(state, event)` | synchronous call in `dispatch()` | ✓ WIRED | `state = reduce(state, event)` at extension.ts:85 |
| `reduce()` result | `throttled(buildPayload())` | `scheduleIdle()` + `throttled()` after every reduce | ✓ WIRED | extension.ts:86-87 |
| `buildPayload()` | `buildContext()` + `redact()` | called inside buildPayload | ✓ WIRED | `buildContext(state, {...})` → `redact(field, value, "show")` × 3 at extension.ts:48-51 |
| `throttled` | `mgr.setActivity(payload)` | callback in `createThrottle` | ✓ WIRED | `(payload) => { void mgr.setActivity(payload); }` at extension.ts:68 |
| `mgr.setActivity(payload)` | `setActivity(liveClient, pid, payload)` | ConnectionManager method | ✓ WIRED | client.ts:224: calls module-level `setActivity(liveClient, pid, payload)` |
| `mgr.onReady` | `throttled(buildPayload())` replay | callback registered once | ✓ WIRED | extension.ts:94-101: `mgr.onReady(() => { ...; throttled(buildPayload()); })` |
| `scheduleIdle()` | `dispatch({type:"idle-tick"})` | `setTimeout(IDLE_MS)` | ✓ WIRED | extension.ts:75-78: `idleTimer = setTimeout(() => dispatch({ type: "idle-tick" }), IDLE_MS)` |
| `mgr.stop()` | `clearActivity(c, pid)` | inside stop() async IIFE | ✓ WIRED | client.ts:215: `await clearActivity(c, pid)` before `await destroy(c)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `extension.ts buildPayload()` | `ctx` (PresenceContext) | `buildContext(state, ...)` reads live `state` owned by driver | Yes — `state` is mutated on every `dispatch(event)` call; events come from real vscode API subscriptions | ✓ FLOWING |
| `extension.ts buildPayload()` | `filename` | `redact("filename", ctx.filename ?? "", "show")` → pass-through | Yes — `ctx.filename` sourced from `state.filename` set by `editor-changed` events | ✓ FLOWING |
| `extension.ts buildPayload()` | `branch` | `redact("branch", ctx.branch ?? "", "show")` → pass-through | Yes — `ctx.branch` sourced from `state.branch` updated by `branch-changed` events from git detector | ✓ FLOWING |
| `mgr.setActivity(payload)` | Discord payload | `SetActivity` passed from throttled wrapper | Yes — payload built from live state, not hardcoded | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 42 tests pass | `pnpm test` | 42 passed, 0 failed, 0 todo (exit 0) | ✓ PASS |
| TypeScript types clean | `pnpm typecheck` | exit 0, no errors | ✓ PASS |
| Bundle builds and under threshold | `pnpm build && pnpm check:bundle-size` | 205745 bytes (200.9 KB / 40.2% of 500 KB) | ✓ PASS |
| Pure-core vscode ban | `pnpm check:api-surface` | 9 files, 5 pure-core, 0 violations | ✓ PASS |
| `setActivity(null)` absent | grep over src/ | 0 occurrences | ✓ PASS |
| No `console.error/warn` in pipeline | grep over src/rpc/client.ts, src/extension.ts, src/rpc/throttle.ts | 0 occurrences | ✓ PASS |
| Backoff ladder is correct [5,10,20,40,60]s | Code read | `BACKOFF_LADDER_MS = [5_000, 10_000, 20_000, 40_000, 60_000] as const` | ✓ PASS |
| `scheduleRetry` reads delay before increment | Code read + git show d720a96 | `const delay = nextDelay(); attempt += 1;` (orchestrator fix d720a96) | ✓ PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| RPC-01 | pid-scoped setActivity/clearActivity | ✓ SATISFIED | `setActivity(client, pid, payload)` passes pid to both `clearActivity(pid)` and `setActivity(payload, pid)`. Test 6 in rpc.client.backoff.test.ts proves pid forwarding. |
| RPC-02 | Throttle to 1 per 2000ms leading+trailing, last-wins | ✓ SATISFIED | `createThrottle(fn, 2000)` in extension.ts:67. Test 2 in rpc.throttle.test.ts: 20 calls → 2 underlying calls. |
| RPC-03 | Exponential backoff 5→60s cap, no two attempts within 5s | ✓ SATISFIED | `BACKOFF_LADDER_MS`, `COOLDOWN_FLOOR_MS=5000`, `nextDelay()` formula. Tests 1-3 in rpc.client.backoff.test.ts. |
| RPC-04 | Reconnect replay within one backoff tick | ✓ SATISFIED | `mgr.onReady(() => throttled(buildPayload()))` at extension.ts:94-101. Test 5 in rpc.client.backoff.test.ts. |
| RPC-05 | Silent failures — never toast/block, debug-only logs | ✓ SATISFIED | Zero `console.error/warn` in pipeline. Login rejection logs `console.debug` only. Test 9 in rpc.client.backoff.test.ts. |
| RPC-06 | clearActivity(pid) on deactivate, never setActivity(null) | ✓ SATISFIED | `mgr.stop()` calls `clearActivity(c, pid)`. Zero `setActivity(null)` occurrences. |
| STATE-01 | Editor focus → CODING with file context | ✓ SATISFIED | `createEditorDetector` dispatches `editor-changed`; `reduce()` IDLE→CODING resets startTimestamp. Tests 1,3 in detectors.editor.test.ts + state.machine.test.ts. |
| STATE-02 | No editor + idleTimeoutSeconds elapsed → IDLE | ✓ SATISFIED (automated) | `scheduleIdle()` with IDLE_MS=300_000 fires `idle-tick`; `reduce()` CODING→IDLE. Wall-clock confirmation needs manual UAT. |
| STATE-03 | AGENT_ACTIVE priority when agent session active | ✓ SATISFIED | Reducer handles `agent-started` → AGENT_ACTIVE from any kind; Phase 3 adds detectors to actually dispatch these events. |
| STATE-04 | agent-ended → CODING or IDLE | ✓ SATISFIED | Reducer handles `agent-ended`: AGENT_ACTIVE→IDLE; state.machine.test.ts test "agent-ended from AGENT_ACTIVE transitions to IDLE". |
| STATE-05 | startTimestamp resets only on kind transitions | ✓ SATISFIED | Same-kind `editor-changed` preserves startTimestamp (STATE-05 invariant); `branch-changed` spread returns `{ ...state, branch }` with no startTimestamp reset. Tests in state.machine.test.ts. |
| STATE-06 | 20 events/sec → ≤1 Discord update per 2s, latest state | ✓ SATISFIED | `createThrottle` last-wins single-slot pendingPayload. rpc.throttle.test.ts test 2. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/rpc/client.ts` | 1–230 | 230 lines — 30 over D-17 (200-line guardrail) | ⚠️ Warning | D-17 says "split along natural boundaries if past 200 lines." The file carries Phase 1 exports (`connect`, `helloWorldAnnounce`, `clearActivity`, `destroy`, `registerSignalHandlers`) alongside Phase 2 additions (`createConnectionManager`, `setActivity` wrapper, backoff constants). Plan 02-04 acknowledged these as Phase 1 leftovers that 02-07 "will remove" — but 02-07 did not remove them. `connect` and `helloWorldAnnounce` are now dead code. No functional impact; split can happen in Phase 3 housekeeping. |
| `src/privacy.ts` | 26 | `throw new Error("not implemented until Phase 4")` | ℹ️ Info | Intentional per D-15. All Phase 2 callers pass `mode: "show"` — hash branch is unreachable at runtime. Phase 4 replaces the throw. Not a stub in the functional sense. |
| `src/rpc/client.ts` | 5 | `"Phase 1 ships a placeholder"` in DEFAULT_CLIENT_ID comment | ℹ️ Info | Documentation comment only; the constant itself is a valid string. Non-functional. |

### Orchestrator-Level Fix Note

The 02-04 agent's commit `67250d5` claimed to fix `scheduleRetry` delay-before-increment but only edited the test file (`test/rpc.client.backoff.test.ts`). The source file `src/rpc/client.ts` was left with `attempt += 1` before `nextDelay()`, meaning attempt-0 mapped to `ladder[1]=10s` instead of `ladder[0]=5s`.

The orchestrator's post-merge test run caught 4 failures and issued a separate fix commit `d720a96` that corrected `src/rpc/client.ts` directly. The fix is confirmed present and correct in the current codebase.

This is a notable process signal: the reducer-invariant pattern ("fix code, not tests") caught a real defect that the agent's self-check missed. The current codebase is correct; this is informational only.

### Human Verification Required

All three items are documented in `.planning/phases/02-core-pipeline/02-HUMAN-UAT.md` with detailed step-by-step instructions. Sign-off matrix is in that file.

**1. IDLE Transition on Timer (SC-1 / STATE-02)**

**Test:** Launch Dev Host (F5), open any `.ts` file, confirm CODING shown with filename in Discord sidebar. Close the file tab and leave all editors closed. Wait 5 minutes 10 seconds (do not re-focus an editor). At timer completion verify Discord shows IDLE copy ("Idle", no workspace/branch). Re-focus an editor and verify CODING restores immediately.
**Expected:** CODING → IDLE after 5 min idle → CODING on re-focus
**Why human:** `idleTimeoutSeconds` is hardcoded to 300_000 ms in Phase 2. vitest fake timers prove the dispatch path but wall-clock observation confirms the driver uses real `setTimeout` in the running VS Code process.

**2. Discord Kill/Restart Replay (SC-3 / RPC-03, RPC-04)**

**Test:** Launch Dev Host with a file open. Verify CODING in Discord sidebar. Kill Discord (`killall Discord` / `pkill Discord` / Task Manager). Observe Output panel → Log (Extension Host) for `[agent-mode-discord] RPC login rejected:` lines at cadence: 5 s → 10 s → 20 s → 40 s → 60 s cap. Verify no two consecutive attempts within 5 s. After ~30 s of failed retries, relaunch Discord. Within the current ladder tick (≤ 60 s) verify activity re-appears with no user action.
**Expected:** Backoff ladder observed at correct cadences; activity replays on reconnect automatically
**Why human:** Requires actual Discord desktop process lifecycle; vitest mocks the socket.

**3. Two-Window Pid Isolation (SC-4 / RPC-01)**

**Test:** Launch first Dev Host, open `a.ts`. Verify one activity with `a.ts`. Launch a second Dev Host, open `b.ts`. Verify (from a friend's Discord or test account) two distinct activities — one with `a.ts`, one with `b.ts`. Close the first window, wait 5 s. Verify `b.ts` activity remains; only `a.ts` activity disappears.
**Expected:** Two independent pid-scoped activities; closing one does not clear the other
**Why human:** Requires two real VS Code Dev Host windows + Discord desktop honoring pid-scoping. Own Discord only shows one activity; second window's activity is visible to friends.

### Gaps Summary

No gaps — all 12 requirements are satisfied in code. The phase goal is achieved at the automated level. Status is `human_needed` because 3 of the 5 ROADMAP success criteria have behaviors that require real Discord desktop + Dev Host to confirm (wall-clock idle timer, Discord process kill/restart, multi-window pid isolation).

The D-17 line-count violation on `src/rpc/client.ts` (230 lines vs 200-line guardrail) is a warning: `connect` and `helloWorldAnnounce` are Phase 1 leftovers that the 02-07 plan said would be removed but were not. These are dead code. Suggested resolution: remove them in Phase 3 housekeeping or as a cleanup commit before Phase 3 begins.

---

_Verified: 2026-04-13T12:31:00Z_
_Verifier: Claude (gsd-verifier)_
