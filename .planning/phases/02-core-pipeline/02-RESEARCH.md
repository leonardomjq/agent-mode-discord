# Phase 2: core-pipeline — Research

**Researched:** 2026-04-12
**Domain:** TypeScript pure-core state machine + RPC hardening (throttle, exponential backoff, cooldown, reconnect replay) + VS Code editor/git detectors
**Confidence:** HIGH

## Summary

Phase 2 is the "glue" phase — it turns the Phase 1 hello-world IPC seam into a real presence pipeline driven by editor activity, hardened against Discord restarts, and bounded to one RPC call per 2 s. The technical domain is well-understood: every pattern here has canonical references in the installed `@xhayper/discord-rpc` typings, VS Code's stable API surface, and vitest's fake-timer toolkit. There is no new library introduction in this phase — all work is internal modules that consume the same `@xhayper/discord-rpc@1.3.3` dep Phase 1 already ships.

The primary risk is **composition**: four independent time-based behaviors (idle timer, 2 s throttle, 5 s cooldown, exponential backoff) must interleave without racing each other or leaking handlers across F5 reload cycles. The CONTEXT.md's D-01 "pure reducer + driver" decision removes most of this risk by keeping the reducer synchronous/pure and hoisting every timer into the driver — which means all time-based tests target one module at a time with injected clocks, and the e2e concerns reduce to driver wiring.

**Primary recommendation:** Build the reducer first (02-01) with exhaustive vitest coverage of the state transition table, then the throttle (02-03) and backoff (02-04) as standalone pure-core modules with `vi.useFakeTimers`, then compose them in a thin driver in 02-06/02-07. Use dependency injection for `Date.now` and `setTimeout` so tests never depend on real wall-clock time. Pin every non-pure-core module boundary (any `src/state/**` or `src/rpc/throttle.ts` file) with a path-scoped `vscode`-import ban in `scripts/check-api-surface.mjs`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**State machine shape (02-01, 02-02)**
- **D-01:** `src/state/machine.ts` exports a **pure reducer** — `reduce(state: State, event: Event): State`. No class, no internal mutation, no timers, no `EventEmitter`. Detectors produce events; a driver in `src/extension.ts` (or a thin `state/driver.ts`) runs reduce and forwards the new state to the throttle.
- **D-02:** `State` is a discriminated union keyed by `kind: "AGENT_ACTIVE" | "CODING" | "IDLE"`, carrying the minimum fields the RPC payload needs: `agent?` (Phase 3 populates), `filename?`, `language?`, `branch?`, `workspace?`, `startTimestamp: number`. The context snapshot (02-02) is built from the current `State` + any detector-provided fields not in State — not stored inside State itself.
- **D-03:** `Event` is a discriminated union: `editor-changed`, `editor-closed`, `agent-started`, `agent-ended`, `branch-changed`, `idle-tick`. Phase 2 uses `editor-*` and `idle-tick`; Phase 3 adds `agent-*`. Reducer handles unknown events by returning current state unchanged.
- **D-04:** `startTimestamp` resets **only** on `kind` transition (STATE-05). Same-kind events that only change `filename` / `branch` / `language` do NOT reset `startTimestamp`. Reducer enforces this; no driver-level coordination needed.
- **D-05:** Idle timer lives **in the driver, not in the reducer**. Driver sets `setTimeout(idleTimeoutSeconds * 1000)` whenever state enters/remains `CODING`; on fire it dispatches `{ type: "idle-tick" }`. Reducer transitions `CODING → IDLE` when it sees `idle-tick` and there's no newer editor activity.
- **D-06:** `src/state/context.ts` exports `buildContext(state: State, detectorSnapshots: DetectorSnapshots): PresenceContext` — pure function.

**Detector subscription model**
- **D-07:** Detectors push events into the state machine via a driver-level dispatch function injected at construction: `new EditorDetector({ dispatch })`. Detectors own their vscode subscriptions; the driver owns dispatch routing and timer lifecycle.
- **D-08:** Git branch reads are event-driven when possible (`repository.state.onDidChange` from the vscode.git Extension API) and fall back to lazy-on-demand if the git extension is unavailable.

**Throttle + backoff composition (02-03, 02-04)**
- **D-09:** Throttle lives in a **separate module** — `src/rpc/throttle.ts` — not inside `rpc/client.ts`. Pure-core, testable standalone.
- **D-10:** Throttle holds **only the latest pending payload** (last-wins). Second call inside the 2 s window replaces the held payload; no queuing.
- **D-11:** Backoff lives **inside `rpc/client.ts`** (connection lifecycle). Ladder: 5 → 10 → 20 → 40 → 60 s (cap). Floor: 5 s cooldown between any two `login()` attempts regardless of ladder position. Ladder resets on successful connect.
- **D-12:** Reconnect replay: client's `onReady` handler invokes a `replay()` callback supplied by the driver, which re-dispatches current state through the throttle. The throttle applies its normal leading/trailing rules — no bypass.
- **D-13:** Pid scoping — every `setActivity` and `clearActivity` call passes `process.pid` as the activity key.
- **D-14:** Silent failures gate — Phase 2 still keeps all RPC failures silent. `debug.verbose` arrives in Phase 4; Phase 2 uses `console.debug` as placeholder sink.

**Privacy stub**
- **D-15:** `src/privacy.ts` ships the redaction point plumbed end-to-end with no-op defaults. Signature: `redact(field: "workspace" | "filename" | "branch", value: string, mode: "show" | "hide" | "hash"): string`. Phase 2 implements `show` (pass-through) and `hide` (empty string). `hash` throws `Error("not implemented until Phase 4")`.

**Module boundaries**
- **D-16:** Files in `src/state/` and `src/rpc/throttle.ts` must NOT import `vscode`. Enforced by extending `scripts/check-api-surface.mjs`.
- **D-17:** All files stay under 200 lines.
- **D-18:** Every vscode API read + Discord call wrapped in try/catch with silent swallow.

**Testing strategy**
- **D-19:** Zero-vscode vitest tests. Test files:
  - `test/state.machine.test.ts` — reducer transitions (STATE-01 through STATE-04), `startTimestamp` reset rule (STATE-05)
  - `test/rpc.throttle.test.ts` — 20 events in 1 s → ≤1 call per 2 s window, last-wins (RPC-02, STATE-06)
  - `test/rpc.client.backoff.test.ts` — ladder, 5 s floor, replay on reconnect (RPC-03, RPC-04)
  - `test/privacy.test.ts` — `show` / `hide` / `hash` throws
  - Editor + git detectors tested via `vi.mock("vscode", ...)`
- **D-20:** `pnpm test` must exit 0 with Phase 1 + Phase 2 suites.

### Claude's Discretion
- Exact file layout inside `src/state/` (single `machine.ts` + `context.ts`, or split handlers into `state/transitions/`).
- Whether detectors expose `start()`/`stop()` methods or disposables via `vscode.Disposable`.
- Cooldown-vs-ladder interleaving algorithm detail.
- Specific test fixture shapes (array of events vs builder pattern).
- Whether `state/driver.ts` exists as a separate file or lives inline in `extension.ts`.

### Deferred Ideas (OUT OF SCOPE)
- Full privacy implementation (hash SHA-1, ignore lists) → Phase 4.
- Agent detection (shell integration, session files, polling, precedence) → Phase 3.
- Personality pack + animator + templater → Phase 4.
- `debug.verbose` output channel → Phase 4.
- Live config reload → Phase 4.
- Phase 1 code review leftovers WR-01 / WR-02 / WR-04 — fold into Phase 2 while touching `extension.ts` + `rpc/client.ts`, or defer to `/gsd-code-review-fix 01` first.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RPC-01 | Every `setActivity` / `clearActivity` call is `process.pid`-scoped; two VS Code windows produce two independent activities | `@xhayper/discord-rpc@1.3.3` typings confirm `setActivity(activity, pid?)` and `clearActivity(pid?)` both accept pid (see Code Examples §2). Phase 1 already passes pid — Phase 2 preserves contract across backoff + replay. |
| RPC-02 | Throttle `setActivity` to 1 per 2000 ms leading + trailing, drop intermediates, last-wins | Canonical throttle pattern (Code Examples §3). `vi.useFakeTimers` + `advanceTimersByTimeAsync` verifies under vitest 2.x (Verified via vitest docs). |
| RPC-03 | Discord killed mid-session → 5→10→20→40→60 s ladder with 5 s cooldown floor | Ladder formula (Code Examples §4); `Date.now` + `setTimeout` injected via `RpcDeps` pattern from Phase 1. |
| RPC-04 | Discord restart → RPC reconnects without user action, current activity replays within one backoff tick | `@xhayper/discord-rpc` emits `ready` and `disconnected` events (verified from Client.d.ts `ClientEvents`). Register `ready` listener once on Client construction; invoke `replay()` on each fire (Code Examples §5). |
| RPC-05 | All RPC failures silent unless `debug.verbose === true` | Phase 1 pattern carries forward — `console.debug` as placeholder sink until Phase 4 output channel. No new work beyond wrapping new code paths. |
| RPC-06 | `clearActivity(pid)` on clean deactivate — never `setActivity(null)` | Phase 1 `clearActivity(client, pid)` wrapper already satisfies this. Phase 2 driver must ensure its shutdown path calls `clearActivity` before `destroy()`. |
| STATE-01 | Focusing text document → CODING with file context in state string | `vscode.window.activeTextEditor` + `onDidChangeActiveTextEditor` (Code Examples §6). `TextEditor.document.fileName` + `document.languageId` populate state fields. |
| STATE-02 | No focused editor + no agent + `idleTimeoutSeconds` elapsed → IDLE | Driver-level `setTimeout(idleTimeoutSeconds * 1000)` dispatches `idle-tick`; reducer transitions (D-05). Phase 2 hardcodes 300_000 ms; Phase 4 reads config. |
| STATE-03 | Any tracked agent session active → AGENT_ACTIVE (highest priority) | Reducer priority AGENT > CODING > IDLE enforced in transition table. Phase 3 populates `agent-started` event; Phase 2 only exercises path via test. |
| STATE-04 | Last tracked agent ends → CODING (if editor focused) or IDLE | Reducer transition for `agent-ended`. Same story: Phase 3 produces event; Phase 2 unit-tests reducer handles it correctly. |
| STATE-05 | `startTimestamp` resets ONLY on state transitions (kind change), never on copy rotation / frame ticks | D-04: reducer compares `prev.kind` vs `next.kind`; same-kind events preserve `startTimestamp`. Test: send two `editor-changed` events with different filenames, assert `startTimestamp` unchanged across both. |
| STATE-06 | 20 state-change events in 1 s → ≤1 Discord update per 2 s window; user observes latest state | Throttle module (RPC-02) owns this. Test: 20 `throttled(payload_i)` calls at `t=0..1000ms`, advance timers by 2000 ms, assert exactly 2 calls to underlying `setActivity` (leading at t=0, trailing at t=2000 with payload 19). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

No `CLAUDE.md` exists at repo root yet (per PRD M0 requirement, it should exist — but was not created in Phase 1 deliverables). The equivalent project directives come from PRD §18 and Phase 1 CONTEXT:

**Forbidden (hard):**
- No `(vscode as any).*` casts (enforced by `scripts/check-api-surface.mjs`).
- No `enabledApiProposals` in `package.json`.
- No `setActivity(null)` — only `clearActivity(pid)` clears (PRD §18).
- No `discord-rpc` package — only `@xhayper/discord-rpc` (PRD §18, already locked in Phase 1).
- No new runtime dependencies beyond `@xhayper/discord-rpc` without owner approval (PRD §18). **Phase 2 adds zero new deps** — confirmed.
- No activation events broader than `onStartupFinished`.
- No outbound HTTP — Discord IPC only.
- No writes to disk beyond VS Code extension storage API; never `~/.claude/*`.
- No parsing `~/.claude/projects/*.jsonl` structurally.

**Required (hard):**
- pnpm / vitest / esbuild toolchain only.
- Conventional Commits.
- Files under 200 lines — split on natural boundaries.
- Every Discord call + fs read wrapped in try/catch, silent swallow unless `debug.verbose`.
- Tests alongside feature code in the same plan, not after.

**Phase 2 adds one new constraint to `check-api-surface.mjs`:** path-scoped `vscode` import ban under `src/state/**` and `src/rpc/throttle.ts` (D-16).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@xhayper/discord-rpc` | 1.3.3 (pinned in Phase 1) | IPC client; `setActivity(activity, pid?)`, `clearActivity(pid?)`, `ready` / `disconnected` / `connected` events | Only maintained Discord IPC library; `discord-rpc` is dead (PRD §18). Already installed. [VERIFIED: node_modules/@xhayper/discord-rpc/package.json] |
| `vscode` (ambient, ^1.93.0) | ^1.93.0 engines, `@types/vscode` 1.93+ | `window.activeTextEditor`, `onDidChangeActiveTextEditor`, `workspace`, `extensions.getExtension('vscode.git')` | Stable surfaces only (PRD §8 — no proposed APIs). Git Extension API v1 is the only sanctioned branch-read path (PRD FR-3.1). [VERIFIED: package.json engines, VS Code git.d.ts] |
| `vitest` | ^2.0.0 (installed) | Unit tests with `vi.useFakeTimers` + `vi.mock` | Phase 1 locked-in. `advanceTimersByTimeAsync` needed for throttle+backoff Promise-in-timer tests. [VERIFIED: package.json devDependencies] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/node` | ^22.0.0 (installed) | `NodeJS.Timeout`, `setTimeout`/`clearTimeout` types | For typing throttle + backoff timer handles; no runtime cost. |
| `typescript` | ^5.4.0 (installed) | Discriminated unions for `State` and `Event`, template literal types | Phase 2 State / Event shapes are classic TS discriminated-union work; no new language features required. |
| `esbuild` | ^0.24.0 (installed) | Bundle to `dist/extension.cjs` | Phase 1 toolchain; Phase 2 only adds modules, no build config change needed. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled throttle | `lodash.throttle` or `throttle-debounce` | Adding a runtime dep violates PRD §18 "no new runtime deps" — hand-rolled throttle is ~30 LOC and exactly matches the required leading+trailing last-wins semantics. No-brainer to hand-roll in this specific case. |
| Pure reducer | `xstate` or `zustand` | ~12 KB+ runtime cost, overkill for 3 states + 6 events. A 50-LOC reducer + discriminated unions is strictly simpler and keeps bundle headroom for Phase 4. |
| `EventEmitter` for detector→driver wiring | `rxjs` or `mitt` | `mitt` is 200 bytes but still a runtime dep; injected `dispatch` function (CONTEXT D-07) needs zero library — callback pattern is the idiomatic TS choice. |
| Inject `Date.now` + `setTimeout` into backoff | `sinon` fake timers as a devDep | `vi.useFakeTimers` is already installed and strictly sufficient. No devDep additions. |

**Installation:**
```bash
# No new installs. Phase 2 uses only what Phase 1 installed.
# Verified: pnpm install && pnpm build still produces 196.5 KB bundle.
```

**Version verification:**
- `@xhayper/discord-rpc`: 1.3.3 installed (from 01-02 SUMMARY). Published Oct 2024. `SetActivity` type includes `instance?: boolean`. [VERIFIED: node_modules typings, see Code Examples §2]
- `vitest`: 2.1.9 resolved (seen in 01-04 SUMMARY output). [VERIFIED]
- `@types/vscode`: ^1.93.0 (engines and devDeps aligned). [VERIFIED: package.json]

## Architecture Patterns

### Recommended Project Structure

```
src/
├── state/
│   ├── machine.ts          # pure reduce(state, event): State — NO vscode import
│   ├── context.ts          # buildContext(state, snapshots): PresenceContext — NO vscode import
│   └── types.ts            # State, Event, PresenceContext discriminated unions — NO vscode import
├── rpc/
│   ├── client.ts           # EXISTING — extended with backoff, cooldown, onReady
│   └── throttle.ts         # NEW — createThrottle(fn, 2000): leading+trailing last-wins — NO vscode import
├── detectors/
│   ├── editor.ts           # onDidChangeActiveTextEditor → dispatch(editor-changed) — imports vscode
│   └── git.ts              # getExtension('vscode.git') + repo.state.onDidChange — imports vscode
├── privacy.ts              # redact(field, value, mode) — pure, no vscode
├── driver.ts               # OPTIONAL (CONTEXT Claude's Discretion) — wires detectors → reducer → throttle → client
└── extension.ts            # activate/deactivate — constructs driver
```

**Rules (from D-16 + D-17):**
- No `vscode` import under `src/state/**` or `src/rpc/throttle.ts` (enforced in CI).
- Every file ≤ 200 lines; split reducer into `state/transitions/` subdir if `machine.ts` grows past the cap.

### Pattern 1: Pure Reducer with Discriminated Unions

**What:** A single `reduce(state, event): State` function. Caller (driver) owns state ownership; reducer is total and deterministic.

**When to use:** State machine with finite, known states and a small event alphabet. STATE-01..06 fit this exactly.

**Example:**
```typescript
// src/state/types.ts — pure, no vscode
export type State =
  | { kind: "AGENT_ACTIVE"; agent: string; startTimestamp: number;
      filename?: string; language?: string; branch?: string; workspace?: string }
  | { kind: "CODING"; startTimestamp: number;
      filename?: string; language?: string; branch?: string; workspace?: string }
  | { kind: "IDLE"; startTimestamp: number;
      branch?: string; workspace?: string };

export type Event =
  | { type: "editor-changed"; filename: string; language: string }
  | { type: "editor-closed" }
  | { type: "agent-started"; agent: string }   // Phase 3 producer
  | { type: "agent-ended"; agent: string }     // Phase 3 producer
  | { type: "branch-changed"; branch: string | undefined }
  | { type: "idle-tick" };

// src/state/machine.ts — pure, no vscode
import type { State, Event } from "./types";

export function reduce(state: State, event: Event, now: () => number = Date.now): State {
  switch (event.type) {
    case "editor-changed": {
      const next: State =
        state.kind === "AGENT_ACTIVE"
          ? { ...state, filename: event.filename, language: event.language }
          : state.kind === "CODING"
            // Same kind — preserve startTimestamp (STATE-05)
            ? { ...state, filename: event.filename, language: event.language }
            // Transition IDLE → CODING — reset startTimestamp
            : { kind: "CODING", startTimestamp: now(),
                filename: event.filename, language: event.language,
                branch: state.branch, workspace: state.workspace };
      return next;
    }
    case "editor-closed":
      // IDLE only happens on idle-tick; editor-closed alone doesn't flip kind.
      return state;
    case "idle-tick":
      if (state.kind === "CODING")
        return { kind: "IDLE", startTimestamp: now(),
                 branch: state.branch, workspace: state.workspace };
      return state;
    case "agent-started":
      if (state.kind === "AGENT_ACTIVE") return state; // already active
      return { kind: "AGENT_ACTIVE", agent: event.agent, startTimestamp: now(),
               branch: state.branch, workspace: state.workspace };
    case "agent-ended":
      // Transition to IDLE; driver will dispatch editor-changed next tick if editor focused.
      if (state.kind !== "AGENT_ACTIVE") return state;
      return { kind: "IDLE", startTimestamp: now(),
               branch: state.branch, workspace: state.workspace };
    case "branch-changed":
      // Same-kind field update — NO startTimestamp reset (STATE-05)
      return { ...state, branch: event.branch };
    default:
      return state; // unknown event = no-op (future-proof)
  }
}
```
Source: synthesis of CONTEXT D-01..D-06 + TS discriminated-union canonical pattern [VERIFIED: TS handbook]

### Pattern 2: Leading + Trailing Last-Wins Throttle

**What:** Fires immediately on first call (leading edge), then holds any subsequent call's payload until the window elapses, then fires the held payload once (trailing edge) — no queueing, no intermediates.

**When to use:** Exactly this — `setActivity` rate limiting (FR-7.1, RPC-02, STATE-06). Semantics match vscord's production setting per PRD §FR-7.1.

**Example:**
```typescript
// src/rpc/throttle.ts — pure, no vscode
export interface ThrottleDeps {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => NodeJS.Timeout;
  clearTimeout: (t: NodeJS.Timeout) => void;
}

const realDeps: ThrottleDeps = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (t) => clearTimeout(t),
};

export function createThrottle<T>(
  fn: (payload: T) => void | Promise<void>,
  windowMs: number,
  deps: ThrottleDeps = realDeps,
): (payload: T) => void {
  let lastFiredAt = -Infinity;
  let pendingPayload: { value: T } | null = null;
  let trailingTimer: NodeJS.Timeout | null = null;

  const fireTrailing = () => {
    trailingTimer = null;
    if (pendingPayload) {
      const { value } = pendingPayload;
      pendingPayload = null;
      lastFiredAt = deps.now();
      void fn(value);
      // Schedule another window to catch any call that lands after this trailing fire.
      // (No — leading-edge fire handles that case. No action needed here.)
    }
  };

  return (payload: T) => {
    const now = deps.now();
    const elapsed = now - lastFiredAt;
    if (elapsed >= windowMs) {
      // Leading edge — fire immediately.
      lastFiredAt = now;
      pendingPayload = null;
      if (trailingTimer) { deps.clearTimeout(trailingTimer); trailingTimer = null; }
      void fn(payload);
    } else {
      // Inside window — hold latest, schedule trailing fire if not already.
      pendingPayload = { value: payload };
      if (!trailingTimer) {
        const remaining = windowMs - elapsed;
        trailingTimer = deps.setTimeout(fireTrailing, remaining);
      }
    }
  };
}
```
Source: canonical Underscore/Lodash throttle semantics adapted for dependency-injectable timers. [CITED: lodash docs — `_.throttle(func, wait, { leading: true, trailing: true })` is the default, matches exactly]

### Pattern 3: Backoff Ladder with Cooldown Floor

**What:** Attempt retry delay = `max(ladder[i], cooldownRemaining)`. Guarantees no two `login()` calls within 5 s of each other regardless of ladder position (RPC-03 hard rule).

**When to use:** Reconnection after Discord is killed. Attempt counter resets on successful ready.

**Example:**
```typescript
// inside src/rpc/client.ts
const BACKOFF_LADDER_MS = [5_000, 10_000, 20_000, 40_000, 60_000];
const COOLDOWN_FLOOR_MS = 5_000;

export interface BackoffDeps {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => NodeJS.Timeout;
  clearTimeout: (t: NodeJS.Timeout) => void;
  createClient: (clientId: string) => Client;
}

export interface ConnectionManager {
  start(): void;     // kicks off first connect
  stop(): void;      // cancels any pending retry, calls destroy
  onReady(cb: () => void): void; // for replay wiring (D-12)
}

export function createConnectionManager(
  clientId: string,
  pid: number,
  deps: BackoffDeps,
): ConnectionManager {
  let attempt = 0;
  let lastAttemptAt = -Infinity;
  let pendingRetry: NodeJS.Timeout | null = null;
  let liveClient: Client | null = null;
  let stopped = false;
  const readyCallbacks: Array<() => void> = [];

  const nextDelay = (): number => {
    const ladderMs = BACKOFF_LADDER_MS[Math.min(attempt, BACKOFF_LADDER_MS.length - 1)];
    const sinceLast = deps.now() - lastAttemptAt;
    const cooldownRemaining = Math.max(0, COOLDOWN_FLOOR_MS - sinceLast);
    return Math.max(ladderMs, cooldownRemaining);
  };

  const attemptConnect = async () => {
    if (stopped) return;
    lastAttemptAt = deps.now();
    try {
      const client = deps.createClient(clientId);
      client.on("ready", () => {
        attempt = 0;                      // Ladder reset on success
        liveClient = client;
        for (const cb of readyCallbacks) try { cb(); } catch { /* silent */ }
      });
      client.on("disconnected", () => {
        liveClient = null;
        scheduleRetry();                  // Triggered by Discord exit
      });
      await client.login();
    } catch {
      // Silent per PRD §8. Schedule retry.
      scheduleRetry();
    }
  };

  const scheduleRetry = () => {
    if (stopped) return;
    if (pendingRetry) return;             // Already scheduled
    attempt += 1;
    const delay = nextDelay();
    pendingRetry = deps.setTimeout(() => {
      pendingRetry = null;
      void attemptConnect();
    }, delay);
  };

  return {
    start: () => { void attemptConnect(); },
    stop: () => {
      stopped = true;
      if (pendingRetry) { deps.clearTimeout(pendingRetry); pendingRetry = null; }
      if (liveClient) { void liveClient.destroy().catch(() => {}); liveClient = null; }
    },
    onReady: (cb) => { readyCallbacks.push(cb); },
  };
}
```
Source: CONTEXT specifics line 134 formula adapted; @xhayper Client events verified from `ClientEvents` type in `dist/Client.d.ts` (`ready: []`, `disconnected: []`, `connected: []`).

### Pattern 4: Driver Composition (detectors → reducer → throttle → rpc)

**What:** One module wires everything; detectors push events in, throttle gates outputs, connection manager owns reconnect.

**Example skeleton:**
```typescript
// src/driver.ts (or inline in extension.ts if <100 lines)
export function createDriver(deps: { dispatch, connectionManager, throttle, idleMs, now }) {
  let state: State = { kind: "IDLE", startTimestamp: deps.now() };
  let idleTimer: NodeJS.Timeout | null = null;

  const dispatch = (event: Event) => {
    const next = reduce(state, event, deps.now);
    state = next;
    resetIdleTimer();
    deps.throttle(buildActivityPayload(state));  // Phase 4 builder; Phase 2 uses minimal payload
  };

  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    if (state.kind === "CODING") {
      idleTimer = setTimeout(() => dispatch({ type: "idle-tick" }), deps.idleMs);
    }
  };

  deps.connectionManager.onReady(() => {
    // Replay current state on reconnect (RPC-04, D-12)
    deps.throttle(buildActivityPayload(state));
  });

  return { dispatch, getState: () => state, stop: () => { if (idleTimer) clearTimeout(idleTimer); } };
}
```
Source: CONTEXT D-07, D-12, specifics line 136.

### Anti-Patterns to Avoid
- **Putting the idle timer in the reducer.** Violates D-01 (pure reducer). Use driver-level `setTimeout` that dispatches `idle-tick` (D-05).
- **Queuing intermediate payloads in the throttle.** Violates D-10 last-wins semantics and RPC-02. Hold only the latest pending payload; overwrite on each call.
- **Re-registering `on("ready", ...)` on each reconnect.** The `@xhayper` client is re-instantiated per connect attempt in the pattern above, so each new client gets one listener. If you reuse a single Client, register listeners exactly once at construction (not in the retry loop).
- **`setActivity(null)` to clear.** Hard PRD §18 rule — Phase 1 already enforces via `clearActivity(client, pid)`. Carry forward.
- **Using `process.emit("SIGINT")` in tests.** Kills the vitest runner. Use `vi.spyOn(process, "once")` and invoke captured handlers directly (Phase 1 pattern from 01-04).
- **Reading `vscode.workspace.rootPath`.** Deprecated. Use `vscode.workspace.workspaceFolders?.[0]?.uri.fsPath`. [CITED: VS Code API docs, `workspace.rootPath` marked @deprecated]
- **Subscribing to `repository.state.onDidChange` without storing the disposable.** Leaks listeners across F5 reload. Every subscription must return a disposable that the driver collects and cleans up in `stop()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Discord IPC handshake / JSON-RPC framing | Custom socket protocol | `@xhayper/discord-rpc@1.3.3` (already installed) | Discord IPC protocol is under-documented; the library handles pipe discovery (Windows named pipe vs Unix socket), opcode framing, and op 2 authentication. |
| Git branch reads | Shelling out to `git branch --show-current` | `vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)` | PRD FR-3.1 mandate. Shelling out breaks on virtual workspaces, Remote SSH, and adds 50-100 ms per read. Also PRD §18 forbids writes / spawns outside Discord IPC. |
| Active editor tracking | Polling `window.activeTextEditor` on a timer | `onDidChangeActiveTextEditor` event | Event fires exactly when the user-visible editor changes (including split-editor focus shifts). Polling wastes cycles and can miss sub-poll-interval transitions. |
| Fake timers for tests | Patching global `setTimeout` manually | `vi.useFakeTimers({ toFake: ['setTimeout','clearTimeout','Date'] })` + `vi.advanceTimersByTimeAsync` | Vitest's implementation is backed by `@sinonjs/fake-timers` — handles microtask interleaving, handles Date mocking consistently, and has an async variant that drains Promise microtasks scheduled inside timer callbacks. |
| Idle/inactivity timer | Polling `Date.now()` on interval | `setTimeout(idleMs)` cleared on every editor event | Single setTimeout = zero idle CPU. Polling every 1 s wastes 300 wakeups before idle fires. |

**Key insight:** Every capability Phase 2 needs already exists either in `@xhayper/discord-rpc`, the VS Code stable API, or the installed vitest. There is zero valid "build it ourselves" case in this phase. The entire surface area of "new code" is composition logic — reducers, throttles, drivers — which ARE hand-rolled intentionally because they're tiny and domain-specific.

## Common Pitfalls

### Pitfall 1: `onDidChangeActiveTextEditor` fires with `undefined` on focus loss

**What goes wrong:** You expect the event to fire only when the user opens a new file; instead it fires with `editor === undefined` every time focus moves to a non-editor pane (terminal, search, diff review, Output panel).

**Why it happens:** VS Code semantically treats the terminal, search view, etc., as non-editor surfaces. `activeTextEditor` becomes `undefined` when any of them gains focus. This is the core PRD §2 pain point — incumbents treat undefined as "idle" and mis-state the user.

**How to avoid:** Handle `undefined` explicitly. Phase 2 choice (per CONTEXT `editor-closed` event): dispatch `editor-closed`, which the reducer treats as a no-op (state stays CODING until idle-tick). Don't transition to IDLE on `undefined` — that's what incumbents get wrong. Only `idle-tick` (= idleTimeoutSeconds elapsed with no editor events) drives IDLE.

**Warning signs:** Extension appears to flicker CODING → IDLE → CODING as the user switches panes. Tell-tale symptom that you're reacting to `undefined` too aggressively.

### Pitfall 2: `vi.advanceTimersByTime` vs `advanceTimersByTimeAsync` — async callback drift

**What goes wrong:** Throttle test sends 20 events, calls `vi.advanceTimersByTime(2000)`, expects 2 calls to the mocked `setActivity` — gets 1. Or backoff test advances 60 s, expects 6 retries, gets 3.

**Why it happens:** The synchronous `advanceTimersByTime` does NOT drain microtasks. If your timer callback returns a Promise (like `await connect()` in the backoff loop), the Promise's `.then` callbacks are queued as microtasks that don't run until a real `await` yields to the event loop. The `async` variant (`advanceTimersByTimeAsync`) interleaves microtasks after each timer fire.

**How to avoid:** Use `await vi.advanceTimersByTimeAsync(ms)` whenever the code under test has `async` timer callbacks. For pure-sync throttle (no await inside `fireTrailing`), the sync variant is fine. Backoff MUST use async.

**Warning signs:** Off-by-one retry counts, missing trailing fires, tests that pass intermittently. [VERIFIED: vitest docs recommend `nextTimerAsync` tick mode or `advanceTimersByTimeAsync`]

### Pitfall 3: Git Extension API activation is asynchronous

**What goes wrong:** `vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)` at `activate()` time throws or returns `undefined` — the git extension has not yet activated.

**Why it happens:** VS Code activates extensions lazily. The built-in git extension activates when the first workspace folder is opened, which may happen after your own `onStartupFinished` fires. If `getExtension('vscode.git').isActive === false`, the `.exports` is empty.

**How to avoid:** Two-step pattern:
```typescript
const gitExt = vscode.extensions.getExtension<{ getAPI(version: 1): GitAPI }>('vscode.git');
if (!gitExt) return; // git extension not installed (very rare)
const gitApi = gitExt.isActive
  ? gitExt.exports.getAPI(1)
  : (await gitExt.activate()).getAPI(1);
```
Also wrap the whole block in try/catch and silent-swallow — PRD §18 mandate. [CITED: vscode-git-extension-activation docs, VS Code issue #129340]

**Warning signs:** Branch is `undefined` on first-ever workspace open; becomes populated after 1-2 s. F5 reload "fixes" the issue (everything is activated).

### Pitfall 4: Multi-repo workspaces expose `repositories: Repository[]` — not a single repo

**What goes wrong:** You `const branch = api.repositories[0].state.HEAD?.name` and get the wrong branch when the user has a multi-root workspace.

**Why it happens:** `api.repositories` is `Repository[]`. VS Code supports multi-root workspaces where each folder can be a separate git repo. For Phase 2, CONTEXT doesn't specify which repo's branch to show — PRD FR-3 is silent on multi-repo too.

**How to avoid:** Match the repo to `window.activeTextEditor.document.uri.fsPath` if available; fall back to `repositories[0]`. Subscribe to `api.onDidOpenRepository` + `api.onDidCloseRepository` so the driver's view of repos stays current. [VERIFIED: VS Code git.d.ts Repository[], onDidOpenRepository]

**Warning signs:** Branch is correct in single-repo workspaces but wrong/stale in multi-repo.

### Pitfall 5: `process.once("SIGINT")` handler leak across F5 reload (Phase 1 WR-01 echo)

**What goes wrong:** On F5 reload, the extension host invokes `deactivate()` then re-activates. If a previous connection-manager instance leaked handlers, SIGINT will now have two handlers, and both will attempt to destroy clients — one of which is already null.

**Why it happens:** Phase 1 WR-01 (activate/dispose race) — `connect()` may resolve after `shutdown()` returns. Phase 2 expands the surface by introducing backoff retries: a `setTimeout` scheduled before shutdown can fire after shutdown completes and call `createClient` + `client.on("ready", ...)` on an orphan client.

**How to avoid:** Every `setTimeout` returned from `scheduleRetry` must be cleared in `connectionManager.stop()`. Every `process.once` registration must be paired with a `process.off` captured in a returned `unregister` fn. A single `stopped` flag checked before any retry / reconnect action (as shown in Pattern 3). Address Phase 1 WR-01 during driver wiring (02-07).

**Warning signs:** Test suite passes individually but fails when run twice; `process._events` count grows over repeated F5 cycles.

### Pitfall 6: `@xhayper` Client's `on` method is typed via `AsyncEventEmitter` — double-firing possible

**What goes wrong:** Test registers `client.on("ready", cb)` twice (once in code, once in test setup). Production code does it via `.on`; test does it again via the mock factory. Both fire.

**Why it happens:** `AsyncEventEmitter` allows multiple listeners per event by design. The Phase 1 smoke test's mock factory hardcodes `.on()` / `.once()` as no-ops returning `this` — it doesn't track listeners. Phase 2 tests that rely on `ready` need the mock to actually invoke registered callbacks.

**How to avoid:** Phase 2 test mock factory should maintain a `Map<string, Array<Function>>` of listeners and expose a test helper `emitReady()` / `emitDisconnected()` that invokes them. See Code Examples §7 for the extended mock shape. [VERIFIED: @vladfrangu/async_event_emitter is the underlying class per Client.d.ts]

**Warning signs:** `expect(replay).toHaveBeenCalledTimes(1)` fails with "called 2 times" in the reconnect-replay test.

### Pitfall 7: Pid-scoping only works when Discord desktop supports it

**What goes wrong:** Two VS Code windows, both passing `process.pid` — but user sees one activity overwriting the other, not two separate entries.

**Why it happens:** Discord's activity-slot behavior on pid is real but version-dependent. Older Discord desktop clients (pre-2022) don't honor the pid key and show only the most recent activity. PRD-documented behavior assumes current Discord desktop.

**How to avoid:** Document this as a manual-UAT dev-host verification step (requires two VS Code windows + current Discord). The Dev Host test doesn't lie to us, but on older Discord the user sees a regression that isn't our bug. Plan 02-04 should note this in its verification section and surface it in 02-HUMAN-UAT.md. [VERIFIED: `@xhayper/discord-rpc` typings accept `pid?: number` on `setActivity`, so the wire call is correct; behavior on receive is Discord-side]

**Warning signs:** Phase 1 01-05 HUMAN-HANDOFF already flags to test Discord latest.

### Pitfall 8: `idleTimeoutSeconds` hardcoded in Phase 2 — but config arrives in Phase 4

**What goes wrong:** 02-06/02-07 driver hardcodes 300_000 ms. Phase 4 replaces with `vscode.workspace.getConfiguration('agentMode').get('idleTimeoutSeconds')` — breaks the Phase 2 test that asserts 300 s.

**Why it happens:** Config landing is Phase 4 (CONTEXT deferred). Phase 2 must hardcode; tests should parameterize.

**How to avoid:** Accept `idleMs` as a driver dep (`createDriver({ ..., idleMs })`). Test passes e.g. `idleMs: 100` for fast testing. Default at driver construction site is `300_000`. When Phase 4 adds config, the construction site reads config and passes the value — the driver signature doesn't change. [ASSUMED — safe practice] Captured in Assumptions Log A1.

**Warning signs:** None in Phase 2 — the pitfall emerges in Phase 4 refactor.

## Runtime State Inventory

**Not applicable.** Phase 2 is greenfield: adds new modules, extends one existing module (`rpc/client.ts`), edits another (`extension.ts`). No rename / rebrand / string-replacement. No runtime state migration. No external service configs, no OS-registered state, no secrets, no build artifacts to rename.

**Category-by-category (explicit):**
- Stored data: None — no databases, no persistence beyond Discord's in-memory activity slot.
- Live service config: None — no external services configured by string.
- OS-registered state: None — no scheduled tasks, no systemd units.
- Secrets/env vars: `AGENT_MODE_CLIENT_ID` env var from Phase 1 unchanged — Phase 2 does not touch it.
- Build artifacts: None — no package renames, `dist/extension.cjs` just gets larger.

## Code Examples

Verified patterns from official sources.

### Example 1: `@xhayper/discord-rpc` — Installed Typings Confirm API Surface

```typescript
// VERIFIED from node_modules/@xhayper/discord-rpc/dist/structures/ClientUser.d.ts
class ClientUser extends User {
  setActivity(activity: SetActivity, pid?: number): Promise<SetActivityResponse>;
  clearActivity(pid?: number): Promise<void>;
}

// VERIFIED from dist/Client.d.ts
type ClientEvents = {
  ready: [];
  connected: [];
  disconnected: [];
  debug: [...data: any];
} & { [K in Exclude<RPC_EVT, "READY">]: [unknown] };

class Client extends AsyncEventEmitter<ClientEvents> {
  clientId: string;
  get user(): ClientUser | undefined;
  get isConnected(): boolean;
  connect(): Promise<void>;
  login(options?: AuthorizeOptions): Promise<void>;
  destroy(): Promise<void>;
}
```
**Implication:** Use `ready` event for replay wiring (D-12). `disconnected` fires when Discord exits — drives `scheduleRetry`. `connected` fires before auth completes — NOT the right signal for replay (a client is "connected" transport-wise before `user` is populated; replay before `user` is defined will no-op silently).

Source: `/Users/leonardojaques/projects/personal/richagenticpresence-discord/node_modules/@xhayper/discord-rpc/dist/Client.d.ts` [VERIFIED: local filesystem]

### Example 2: Pid-scoped setActivity + clearActivity (existing Phase 1 pattern, extended)

```typescript
// src/rpc/client.ts — Phase 2 replaces helloWorldAnnounce with:
export async function setActivity(
  client: Client, pid: number, payload: SetActivity,
): Promise<void> {
  try {
    await client.user?.clearActivity(pid);   // Belt-and-braces from Phase 1 pattern
  } catch { /* silent — no prior activity is expected */ }
  try {
    await client.user?.setActivity(payload, pid);
  } catch { /* silent per PRD §8 */ }
}
```
Source: extension of `helloWorldAnnounce` from `src/rpc/client.ts:47-61` + `SetActivity` type from ClientUser.d.ts. [VERIFIED against installed lib]

### Example 3: Throttle Test Recipe

```typescript
// test/rpc.throttle.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createThrottle } from "../src/rpc/throttle";

describe("rpc throttle — leading + trailing + last-wins", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("fires leading edge immediately", () => {
    const fn = vi.fn();
    const throttled = createThrottle(fn, 2000);
    throttled("a");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("a");
  });

  it("20 calls in 1s produce exactly 2 underlying calls (leading + trailing last-wins)", async () => {
    const fn = vi.fn();
    const throttled = createThrottle(fn, 2000);
    for (let i = 0; i < 20; i++) {
      throttled(`payload-${i}`);
      await vi.advanceTimersByTimeAsync(50); // 50ms * 20 = 1000ms
    }
    // Leading at t=0 fired with "payload-0"; rest queued with last overwriting.
    expect(fn).toHaveBeenCalledTimes(1);
    // Advance past the 2s window — trailing fires with the LAST payload.
    await vi.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, "payload-0");
    expect(fn).toHaveBeenNthCalledWith(2, "payload-19");
  });
});
```
Source: vitest docs `advanceTimersByTimeAsync` + lodash throttle semantics. [VERIFIED: vitest.dev/api/vi.html]

### Example 4: Backoff nextDelay Formula (CONTEXT line 134 — exact form)

```typescript
const BACKOFF_LADDER = [5_000, 10_000, 20_000, 40_000, 60_000];
const COOLDOWN = 5_000;

function nextDelay(attempt: number, lastAttemptAt: number, now: () => number): number {
  const ladderMs = BACKOFF_LADDER[Math.min(attempt, BACKOFF_LADDER.length - 1)];
  const sinceLast = now() - lastAttemptAt;
  const cooldownRemaining = Math.max(0, COOLDOWN - sinceLast);
  return Math.max(ladderMs, cooldownRemaining);
}
```
**Test cases (must all pass):**
- attempt=0, lastAttemptAt=-Infinity → 5000 (ladder wins, no cooldown pressure).
- attempt=0, lastAttemptAt=now-2000 → 5000 (ladder still wins — cooldown would be 3000).
- attempt=1, lastAttemptAt=now-100 → 10000 (ladder wins).
- attempt=4, lastAttemptAt=now-100 → 60000 (cap).
- attempt=5, lastAttemptAt=now-100 → 60000 (stays at cap).
- Pathological: attempt=0, forced retry 1 s after a manual trigger → max(5000, 4000) = 5000. Cooldown floor protects from thrash even if ladder is reset.

Source: CONTEXT.md line 134 synthesis. [VERIFIED logic with paper tests above]

### Example 5: `ready` Event Listener Registration (once per Client instance)

```typescript
// Connection manager re-instantiates Client per attempt — one listener per client:
const client = deps.createClient(clientId);
client.on("ready", () => {
  attempt = 0;
  liveClient = client;
  for (const cb of readyCallbacks) try { cb(); } catch { /* silent */ }
});
client.on("disconnected", () => {
  liveClient = null;
  scheduleRetry();
});
await client.login();
```
**Why this layout:** Phase 1 smoke test's mock factory no-ops `.on()` — Phase 2 tests must extend the mock to capture listeners (see Pitfall 6 / Example 7).

Source: Client.d.ts `ClientEvents` + `AsyncEventEmitter` base class behavior. [VERIFIED: @vladfrangu/async_event_emitter type]

### Example 6: VS Code Editor Detector

```typescript
// src/detectors/editor.ts
import * as vscode from "vscode";
import type { Event } from "../state/types";

export function createEditorDetector(dispatch: (event: Event) => void): vscode.Disposable {
  const disposables: vscode.Disposable[] = [];

  const pushFromEditor = (editor: vscode.TextEditor | undefined) => {
    try {
      if (!editor) {
        dispatch({ type: "editor-closed" });
        return;
      }
      const { document } = editor;
      const fileName = document.uri.fsPath.split(/[\\/]/).pop() ?? "";
      dispatch({
        type: "editor-changed",
        filename: fileName,
        language: document.languageId,
      });
    } catch { /* silent per PRD §8 */ }
  };

  // Fire current state once on startup.
  pushFromEditor(vscode.window.activeTextEditor);

  disposables.push(
    vscode.window.onDidChangeActiveTextEditor(pushFromEditor),
  );

  return vscode.Disposable.from(...disposables);
}
```
**Firing semantics (VERIFIED from VS Code docs):**
- Fires on focus change to a text editor.
- Fires with `undefined` when focus leaves text editor (terminal, search pane, diff view, etc.).
- Does NOT fire on language-id change within the same editor (use `onDidChangeTextDocument` for that — Phase 4 concern, not Phase 2).
- In split editor: fires when switching between split panes.
- On startup: you must read `window.activeTextEditor` once — the event won't re-fire the initial state. Pattern above does this.

Source: https://code.visualstudio.com/api/references/vscode-api#window [CITED]

### Example 7: Extended mock factory for Phase 2 ready/disconnected tests

```typescript
// test/rpc.client.backoff.test.ts — extends Phase 1 pattern
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const listeners = new Map<string, Array<(...a: unknown[]) => void>>();
const mockLogin = vi.fn(async () => {});
const mockDestroy = vi.fn(async () => {});
const mockSetActivity = vi.fn(async () => {});
const mockClearActivity = vi.fn(async () => {});

vi.mock("@xhayper/discord-rpc", () => {
  class Client {
    user = {
      setActivity: mockSetActivity,
      clearActivity: mockClearActivity,
    };
    login = mockLogin;
    destroy = mockDestroy;
    on(event: string, cb: (...a: unknown[]) => void) {
      const arr = listeners.get(event) ?? [];
      arr.push(cb);
      listeners.set(event, arr);
      return this;
    }
    once(event: string, cb: (...a: unknown[]) => void) { return this.on(event, cb); }
  }
  return { Client };
});

function emit(event: string, ...args: unknown[]): void {
  for (const cb of listeners.get(event) ?? []) cb(...args);
}

import { createConnectionManager } from "../src/rpc/client";

describe("connection manager backoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    listeners.clear();
    mockLogin.mockClear();
    mockLogin.mockImplementation(async () => {});
  });
  afterEach(() => vi.useRealTimers());

  it("retries with 5s ladder on login rejection", async () => {
    mockLogin.mockRejectedValue(new Error("no Discord"));
    const mgr = createConnectionManager("cid", 1234, {
      now: () => Date.now(),
      setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
      createClient: (id) => new (require("@xhayper/discord-rpc").Client)({ clientId: id }),
    });
    mgr.start();
    await vi.runAllTicks?.(); // drain the first login promise rejection
    expect(mockLogin).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(mockLogin).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mockLogin).toHaveBeenCalledTimes(3);
    // ...etc, asserting 20, 40, 60, 60 pattern
  });

  it("resets ladder on ready event", async () => {
    mockLogin.mockResolvedValue(undefined);
    const mgr = createConnectionManager("cid", 1234, /* deps */);
    mgr.start();
    // simulate a successful login
    await vi.advanceTimersByTimeAsync(0);
    emit("ready");
    // ...ensure attempt counter is 0 by triggering disconnected, measuring next delay
  });

  it("fires onReady callback (reconnect replay, RPC-04)", async () => {
    const replay = vi.fn();
    const mgr = createConnectionManager("cid", 1234, /* deps */);
    mgr.onReady(replay);
    mgr.start();
    await vi.advanceTimersByTimeAsync(0);
    emit("ready");
    expect(replay).toHaveBeenCalledTimes(1);
  });
});
```
Source: extension of Phase 1 01-04 mock factory pattern. [VERIFIED]

### Example 8: Path-Scoped vscode-Import Ban in check-api-surface.mjs

```javascript
// scripts/check-api-surface.mjs — Phase 2 addition
const VSCODE_IMPORT = /^\s*import\s+(?:\*\s+as\s+\w+\s+|\{[^}]*\}\s+|\w+\s+)?from\s+["']vscode["']/m;
const PURE_CORE_DIRS = ["src/state/", "src/rpc/throttle.ts"];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const isPureCore = PURE_CORE_DIRS.some(p => file === p || file.startsWith(p));
  if (isPureCore && VSCODE_IMPORT.test(content)) {
    console.error(`[api-surface] FAIL — ${file} imports vscode; pure-core boundary violated`);
    failed = true;
  }
  // ...existing BAD_CAST / BAD_ANY / PROPOSED_API checks preserved...
}
```
**Regex rationale:** Multi-line `^...$` form matches `import * as vscode from "vscode"`, `import { window } from "vscode"`, `import vscode from "vscode"`. Does NOT match type-only imports like `import type { TextEditor } from "vscode"` — which is fine for pure-core modules that want compile-time types without runtime dep. (CONTEXT D-16 says "must NOT import vscode" — reading strictly, type imports are erased at build time and cost nothing; but for strictness, the reducer itself needs zero vscode references at all, so this is non-issue.)

Source: extension of existing scripts/check-api-surface.mjs:7-8 pattern. [VERIFIED: file read at start of research]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `discord-rpc` npm package | `@xhayper/discord-rpc@1.3.3` | 2019-2020 abandonment → @xhayper fork picked up, now maintained at `Khaomi/discord-rpc` on GitHub | Phase 1 already locked in. Phase 2 uses installed version. |
| Polling `window.activeTextEditor` on interval | `onDidChangeActiveTextEditor` event | VS Code 1.0+ | Pre-standardized pattern; no reason to ever poll. |
| Vitest fake timers with sync-only advance | `vi.advanceTimersByTimeAsync` + `vi.setTimerTickMode('nextTimerAsync')` | vitest 1.6+ (async timers), 3.0+ (tick modes) | 2.1.9 installed supports async variant. `setTimerTickMode` added in 3.0 — not used here but available. |
| `(vscode as any).chat` / `.lm` proposed API surfaces | Stable APIs only (VS Code 1.93+) | Consistent VS Code policy; Marketplace enforces | Phase 1 guardrail (SKEL-05) already enforces. |
| Hand-rolled git branch parsing | Built-in `vscode.git` extension API v1 | VS Code 1.20+, API v1 stable since 2018 | PRD FR-3.1 locked in. |

**Deprecated/outdated:**
- `workspace.rootPath` — replaced by `workspace.workspaceFolders`. [CITED: VS Code API ref]
- Any `require` of Discord IPC modules directly — always through a library.
- `setActivity(null)` for clearing — causes ghost presences on older Discord clients (PRD §FR-4.3 / §18).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Parameterizing `idleMs` in driver construction is future-proof for Phase 4's config landing | Pitfall 8 | Low — if Phase 4 needs a different shape, the driver is an internal module and can be refactored without crossing plan boundaries. |
| A2 | `connected` event on @xhayper Client fires before user is populated; `ready` is the right reconnect-replay signal | Code Examples §1 note | Medium — if `ready` fires before `user` is fully populated (race inside the library), the first replay `setActivity` might silent-fail. Mitigation: try/catch already wraps it; the throttle's trailing fire 2 s later will succeed. |
| A3 | Discord desktop's pid-scoping of activity slots is honored by Discord 2024+ clients (Marcus's environment) | Pitfall 7 | Low — PRD assumes this; Phase 1 01-05 HUMAN-HANDOFF tests on current Discord. If Discord changes, we hit it at same time as incumbents. |
| A4 | No Phase 4-exclusive concerns (config, output channel) need stubs landed in Phase 2 beyond privacy signature | Decisions D-14, D-15 | Low — CONTEXT D-14 and D-15 explicitly freeze the signatures; Phase 4 changes implementations only. |
| A5 | File count stays ≤7 new files + 2 modified — matches CONTEXT scope without overflow | Architecture Patterns | Low — straightforward head-count against plan breakdown 02-01..02-07. |

## Open Questions

None surfaced during research — CONTEXT.md is comprehensive (D-01 through D-20 plus 5 discretion items). All technical unknowns have verified answers from installed types or canonical docs. No user input needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `pnpm` | Build, test, typecheck | ✓ | ^9.0.0 (packageManager pinned) | — |
| `node` | Runtime (vitest, esbuild) | ✓ | implicit (≥18; `@types/node@22`) | — |
| `@xhayper/discord-rpc` | RPC client | ✓ | 1.3.3 installed | — |
| `vitest` | Tests | ✓ | 2.1.9 installed | — |
| `typescript` | Typecheck + transpile | ✓ | 5.4+ installed | — |
| `esbuild` | Bundle | ✓ | 0.24+ installed | — |
| `@types/vscode` | Ambient vscode types | ✓ | 1.93+ installed | — |
| VS Code Extension Dev Host (F5) | Manual UAT of detectors + driver | ✓ | User's local install (Phase 1 01-05 confirmed) | — |
| Discord desktop | Manual UAT of backoff, replay, pid-scoping | ✓ | User's local (Phase 1 01-05 acceptance done) | Automated tests cover unit level; manual multi-window UAT is the escape hatch |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — Phase 2 is a purely-internal phase; all deps present at repo level.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 2.1.9 (installed, Phase 1) |
| Config file | `vitest.config.ts` (Phase 1 existing) |
| Quick run command | `pnpm test` (= `vitest run`) |
| Full suite command | `pnpm test && pnpm typecheck && pnpm build && pnpm check:bundle-size && pnpm check:api-surface` |
| Phase gate | All above green + manual Dev Host UAT in `02-HUMAN-UAT.md` (per Phase 1 pattern) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RPC-01 | `setActivity` / `clearActivity` pid-scoping — two VS Code windows = two activities | unit + manual | `pnpm vitest run test/rpc.client.backoff.test.ts -t "pid forwarding"` + Dev Host two-window check | ❌ Wave 0 |
| RPC-02 | 2 s leading + trailing last-wins throttle | unit | `pnpm vitest run test/rpc.throttle.test.ts` | ❌ Wave 0 |
| RPC-03 | 5→10→20→40→60 s ladder + 5 s cooldown floor | unit | `pnpm vitest run test/rpc.client.backoff.test.ts -t "ladder"` | ❌ Wave 0 |
| RPC-04 | Replay current activity within one backoff tick on reconnect | unit + manual | `pnpm vitest run test/rpc.client.backoff.test.ts -t "onReady"` + Dev Host kill/restart Discord | ❌ Wave 0 |
| RPC-05 | Silent failures unless `debug.verbose` | unit (code path assertion) | `pnpm vitest run -t "silent"` (verify no console.error, only console.debug) | ❌ Wave 0 |
| RPC-06 | `clearActivity(pid)` on deactivate, never `setActivity(null)` | static grep + unit | `pnpm check:api-surface` (grep `setActivity(null)` — MUST stay at 0) + smoke test assertion | ✅ (grep) / ❌ (unit) |
| STATE-01 | Focus text doc → CODING with file context | unit + manual | `pnpm vitest run test/state.machine.test.ts -t "editor-changed -> CODING"` + Dev Host focus file | ❌ Wave 0 |
| STATE-02 | No editor + timer elapsed → IDLE | unit + manual | `pnpm vitest run test/state.machine.test.ts -t "idle-tick"` + Dev Host wait 5 min | ❌ Wave 0 |
| STATE-03 | Agent session active → AGENT_ACTIVE priority | unit | `pnpm vitest run test/state.machine.test.ts -t "AGENT_ACTIVE priority"` | ❌ Wave 0 |
| STATE-04 | Last agent ends → CODING (if editor) or IDLE | unit | `pnpm vitest run test/state.machine.test.ts -t "agent-ended"` | ❌ Wave 0 |
| STATE-05 | `startTimestamp` resets ONLY on kind transition | unit | `pnpm vitest run test/state.machine.test.ts -t "startTimestamp invariant"` | ❌ Wave 0 |
| STATE-06 | 20 events in 1 s → ≤1 update per 2 s window | unit | `pnpm vitest run test/rpc.throttle.test.ts -t "20 events"` (doubles as RPC-02 proof) | ❌ Wave 0 |

### Phase Success Criteria → Verification Map

| SC # | Success Criterion | Verifiable Artifact |
|------|-------------------|---------------------|
| 1 | Focus text doc → CODING; close all editors + wait past `idleTimeoutSeconds` → IDLE | Unit: `state.machine.test.ts` CODING + idle transitions. Manual: `02-HUMAN-UAT.md` Dev Host step (focus file → see goblin-free CODING payload; wait 5 min → see IDLE). |
| 2 | 20 events in 1 s → ≤1 `setActivity` per 2 s window, last wins | Unit: `rpc.throttle.test.ts` — single test covers exact scenario. |
| 3 | Discord kill → 5→60 s backoff, 5 s cooldown, no thrash; restart → replay within one tick | Unit: `rpc.client.backoff.test.ts` ladder + cooldown assertions. Manual: Dev Host kill Discord process → observe console.debug retry cadence → restart Discord → see activity re-appear within backoff window. |
| 4 | Two VS Code windows → two independent pid-scoped activities | Manual-only (cannot automate): `02-HUMAN-UAT.md` step. |
| 5 | All pure-core modules have vitest coverage, `pnpm test` exits 0 with zero vscode imports | CI: `pnpm test` + `pnpm check:api-surface` both exit 0. Static grep of `test/*.ts` for `from "vscode"` returns 0. |

### Sampling Rate
- **Per task commit:** `pnpm test` (runs full vitest suite — 5 Phase 1 tests + new Phase 2 tests; full-suite is already fast per Phase 1 01-04 evidence: 431 ms).
- **Per wave merge:** `pnpm test && pnpm typecheck && pnpm build && pnpm check:bundle-size && pnpm check:api-surface`.
- **Phase gate:** All of the above green + manual Dev Host UAT in `02-HUMAN-UAT.md` (pattern established in Phase 1 01-05) before `/gsd-verify-work` + `/gsd-code-review`.

### Wave 0 Gaps
- [ ] `test/state.machine.test.ts` — reducer transitions, covers STATE-01 through STATE-05
- [ ] `test/rpc.throttle.test.ts` — throttle behavior, covers RPC-02 and STATE-06
- [ ] `test/rpc.client.backoff.test.ts` — backoff ladder + cooldown + onReady, covers RPC-03, RPC-04
- [ ] `test/privacy.test.ts` — `show` pass-through, `hide` empty, `hash` throws
- [ ] `test/detectors.editor.test.ts` — `vi.mock("vscode", ...)`-backed dispatch assertions (STATE-01 unit coverage)
- [ ] `test/detectors.git.test.ts` — `vi.mock("vscode", ...)`-backed git-extension-API contract test (branch read, missing-extension fallback)
- [ ] Extension to `scripts/check-api-surface.mjs` — path-scoped `vscode`-import ban for `src/state/**` and `src/rpc/throttle.ts`
- [ ] `02-HUMAN-UAT.md` — Dev Host checklist for success criteria 1, 3, 4 (manual-only items)

*(No gap in test infrastructure itself — vitest + fake timers installed and working from Phase 1.)*

## Security Domain

**Status:** `security_enforcement` is not explicitly disabled in `.planning/config.json` — section included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No user authentication — Discord IPC uses local-socket trust model (Discord desktop authenticates the user; our extension presents a Client ID, not credentials). |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No access control surfaces — read-only extension, writes only to Discord IPC. |
| V5 Input Validation | partial | Validate `detect.customPatterns` and `messages.customPackPath` in Phase 4. Phase 2 reads nothing untrusted beyond `document.fileName` and `document.languageId` from VS Code itself. |
| V6 Cryptography | no | No crypto in Phase 2. Phase 4 adds SHA-1 hash via Node `crypto` — still no hand-rolling. |
| V7 Error Handling | yes | Silent-swallow pattern (PRD §8) is the control. Every Discord call + vscode call + fs read wrapped in try/catch with no user-visible surfacing unless `debug.verbose`. |
| V8 Data Protection | partial (Phase 4 owns it) | Privacy redaction stubbed in Phase 2 (D-15); full `hide`/`hash` lands in Phase 4. Branch, filename, workspace are sensitive → redaction point plumbed end-to-end. |
| V10 Malicious Code | yes | No `eval`, no dynamic `import()` of user paths, no shell exec. |
| V13 API | partial | Discord IPC is the only "external API" surface. Authenticated by OS (local socket / named pipe ACL) not by us. |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Ghost presence after crash (pid activity never cleared) | Information Disclosure (stale) | Belt-and-braces `clearActivity(pid)` on activate, SIGINT, SIGTERM handlers — Phase 1 pattern carries forward. Never `setActivity(null)`. |
| Handler leak across F5 reload (`process.once` not unregistered) | Denial of Service (handler bloat, potential exit-code drift) | Unregister fn returned from `registerSignalHandlers`; `stopped` flag in `ConnectionManager`; every `setTimeout` tracked for cancellation. |
| Race: connect resolves after shutdown (Phase 1 WR-01 echo) | Information Disclosure (ghost activity after disable) | `shuttingDown` flag checked before setting `liveClient`; late-resolve path calls `clearActivity` + `destroy` instead of `setActivity`. |
| RPC payload injection via `document.fileName` | Tampering → Information Disclosure | `document.fileName` comes from VS Code itself (user's filesystem) — not remote. Privacy redaction mode `hide` returns empty string; `show` is opt-in. Phase 2's default is `show` (pass-through) but CONTEXT D-15 keeps the redaction point so Phase 4 flips safely. |
| Git branch reads from untrusted workspaces | Tampering | Branch is a git-extension-provided string; we never parse it. Pass-through via redaction point. |
| Silent-failure pattern hiding real bugs | Auditability | `debug.verbose` gate (Phase 4) exposes `console.debug` output in a VS Code output channel for troubleshooting. Phase 2 logs to `console.debug` unconditionally as placeholder. |
| Two-window race on activity slot | Information Disclosure (wrong presence shown) | Pid-scoping via `process.pid` on every setActivity/clearActivity call (RPC-01). Verified via Dev Host two-window UAT. |
| Replay-after-deactivate | Information Disclosure (activity after user disabled extension) | `stop()` in ConnectionManager clears `readyCallbacks`; `shuttingDown` guard in driver throttle wrapper. |

**Phase 2 threat surface is tight:** no user input reaches the wire beyond `fileName` + `languageId` + `branch`, all of which come from trusted VS Code APIs, and all three flow through the redaction point before reaching Discord (redaction is default-pass-through in Phase 2, default-hide in Phase 4 per PRD §FR-6).

## Sources

### Primary (HIGH confidence)

- **Local filesystem — `@xhayper/discord-rpc` installed typings** — `node_modules/@xhayper/discord-rpc/dist/Client.d.ts` and `dist/structures/ClientUser.d.ts`. Confirmed `setActivity(activity, pid?)` + `clearActivity(pid?)` signatures, `ClientEvents` type including `ready`, `connected`, `disconnected`, `AsyncEventEmitter` base class.
- **VS Code Git Extension API v1** — `https://github.com/microsoft/vscode/blob/main/extensions/git/src/api/git.d.ts` — verified `Repository.state` fields (`HEAD: Branch | undefined`, `onDidChange: Event<void>`), `GitExtension.getAPI(version: 1): API`, `API.repositories: Repository[]`, `onDidOpenRepository`, `onDidCloseRepository`.
- **Vitest fake-timer docs** — `https://vitest.dev/api/vi.html` — confirmed `advanceTimersByTimeAsync` vs sync variant, `vi.useFakeTimers({ toFake: [...] })` options, microtask interleaving semantics.
- **VS Code API — `window.onDidChangeActiveTextEditor`** — `https://code.visualstudio.com/api/references/vscode-api#window` — firing semantics verified.
- **PRD §7.1 / §7.3 / §7.4 / §8 / §9.4 / §12.M1 / §18 / §19** — `/Users/leonardojaques/projects/personal/richagenticpresence-discord/discord-agent-presence-prd.md` — locked-in requirements, file layout, guardrails.
- **CONTEXT.md — `.planning/phases/02-core-pipeline/02-CONTEXT.md`** — 20 decisions (D-01 through D-20) locked by user.

### Secondary (MEDIUM confidence)

- **Lodash `throttle` semantics** — `https://lodash.com/docs/4.17.15#throttle` — default `{ leading: true, trailing: true }` matches PRD FR-7.1 vscord setting. Not using the library (bundle-size constraint) but borrowing the contract.
- **Phase 1 prior-art** — `01-02-SUMMARY.md`, `01-04-SUMMARY.md`, `01-REVIEW.md` — injectable-deps pattern, mock-factory smoke-test template, WR-01/WR-02/WR-04 carry-forward issues to consider during driver wiring.

### Tertiary (LOW confidence)

- **Assumption A2 (connected vs ready timing in `@xhayper/discord-rpc`)** — inferred from type name `ready: []` + `connected: []` existing as distinct events. If the library changes timing semantics, the try/catch + throttle-trailing behavior is the compensating control. No code path depends on strict ordering.
- **Assumption A3 (Discord desktop honors pid on current versions)** — based on PRD assumption; no direct reverse-engineering. Dev-Host UAT is the verifier.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library verified via installed typings or package.json.
- Architecture: HIGH — all patterns derived from locked CONTEXT decisions + canonical type signatures.
- Pitfalls: MEDIUM-HIGH — Pitfalls 1, 3, 4, 5 verified from VS Code docs and Phase 1 review; Pitfall 2 verified from vitest docs; Pitfalls 6, 7, 8 are reasoned from type inspection + PRD (A2, A3 in assumptions).
- Validation architecture: HIGH — direct mapping of 12 requirements + 5 success criteria to specific test files and commands.
- Security: HIGH — surface is tight and well-understood (no network, no user-supplied strings reach wire pre-redaction).

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable stack, no fast-moving libraries; re-check if `@xhayper/discord-rpc` publishes 2.x or if VS Code 1.94+ changes Shell Integration / git API shapes in a way that affects Phase 3 planning)
