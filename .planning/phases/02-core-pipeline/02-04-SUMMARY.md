---
phase: "02"
plan: "04"
subsystem: "rpc-client-hardening"
tags: [rpc, backoff, cooldown, reconnect-replay, pid-scope, silent-failure, WR-01-fix, WR-04-fix, RPC-01, RPC-03, RPC-04, RPC-05, RPC-06]
dependency_graph:
  requires:
    - "02-00 — test/rpc.client.backoff.test.ts stub file (9 it.todo placeholders)"
    - "02-03 — src/rpc/throttle.ts (setActivity wrapper shape confirmed)"
  provides:
    - "src/rpc/client.ts — createConnectionManager(clientId, pid, deps): ConnectionManager"
    - "src/rpc/client.ts — setActivity(client, pid, payload): pid-scoped wrapper"
    - "src/rpc/client.ts — BACKOFF_LADDER_MS [5,10,20,40,60]s + COOLDOWN_FLOOR_MS 5s"
    - "src/rpc/client.ts — BackoffDeps + ConnectionManager interfaces + realBackoffDeps"
    - "src/rpc/client.ts — registerSignalHandlers updated for WR-04 (process.exit(130|143))"
    - "test/rpc.client.backoff.test.ts — 9 passing assertions (RPC-01/03/04/05 + WR-01/WR-04)"
  affects:
    - "02-07 — driver uses createConnectionManager().start(), wires onReady replay + throttled setActivity"
    - "Phase 1 smoke test — updated assertion 5 to mock process.exit for WR-04 compatibility"
tech_stack:
  added: []
  patterns:
    - "vi.hoisted() for mock fn declarations used inside vi.mock factory"
    - "Per-instance listener Map on mock Client (avoids shared-map cross-test pollution)"
    - "scheduleRetry reads nextDelay() BEFORE incrementing attempt (attempt-0 → ladder[0]=5s)"
    - "shuttingDown flag checked in attemptConnect guard + ready listener (WR-01 late-resolve guard)"
    - "process.exit(130|143) in finally block of signal handler (WR-04 process-hang fix)"
key_files:
  created: []
  modified:
    - src/rpc/client.ts
    - test/rpc.client.backoff.test.ts
    - test/rpc.client.smoke.test.ts
decisions:
  - "scheduleRetry calls nextDelay() BEFORE incrementing attempt — spec says attempt-0 → 5s delay; incrementing first would use ladder[1]=10s"
  - "Per-instance listener Map on mock Client instead of shared global map — prevents cross-test ready-listener accumulation when createConnectionManager creates new Clients on each reconnect"
  - "vi.hoisted() used for mock fns — required because vi.mock factory runs at hoist time before module-scope variable declarations"
metrics:
  duration_minutes: 35
  completed_date: "2026-04-13"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 3
---

# Phase 02 Plan 04: RPC Client Hardening Summary

**One-liner:** Production-grade connection manager with 5→10→20→40→60s backoff ladder, 5s cooldown floor, pid-scoped setActivity/clearActivity, onReady reconnect replay, WR-01 late-resolve guard + WR-04 signal-exit fix; 9 vitest assertions proving RPC-01/03/04/05/06 + WR-01/WR-04.

---

## What Was Built

### Task 1 — src/rpc/client.ts extended (commit `df3aa15`)

Extended from 99 lines (Phase 1) to 230 lines. All Phase 1 exports preserved.

**New exports:**

| Export | Description |
|--------|-------------|
| `BACKOFF_LADDER_MS` | `[5000, 10000, 20000, 40000, 60000] as const` |
| `COOLDOWN_FLOOR_MS` | `5000 as const` |
| `BackoffDeps` | Injectable timer deps interface (now, setTimeout, clearTimeout, createClient) |
| `realBackoffDeps` | Production singleton |
| `ConnectionManager` | Interface: start/stop/onReady/setActivity/getLiveClient |
| `createConnectionManager` | Factory: backoff ladder, cooldown floor, WR-01 guard, WR-04 signal handling |
| `setActivity(client, pid, payload)` | Pid-scoped wrapper: clearActivity first, then setActivity, both silent |

**Connection manager contract:**
- `start()` fires first `attemptConnect` immediately (no delay on first attempt)
- Login rejection → `scheduleRetry()`: reads `nextDelay()` BEFORE incrementing `attempt` → ladder[0]=5s on first failure
- `nextDelay()`: `max(ladder[attempt], max(0, 5000 - sinceLast))` — cooldown floor enforced
- `ready` event → `attempt = 0` (ladder reset), `liveClient = client`, all `readyCallbacks` invoked
- `disconnected` event → `liveClient = null`, `scheduleRetry()`
- `stop()` → `shuttingDown = true`, cancel pending retry, destroy liveClient — idempotent (second call returns cached promise)
- WR-01 late-resolve guard: `ready` listener checks `shuttingDown` — orphan client torn down via `clearActivity + destroy`, never stored as `liveClient`

**WR-04 signal handler update:**
```typescript
// process.exit(130 | 143) in finally block prevents process-hang
// when VS Code host skips deactivate()
process.exit(signal === "SIGINT" ? 130 : 143); // WR-04: prevent process-hang
```

**Phase 1 smoke test updated (df3aa15):** Assertion 5 now mocks `process.exit` before invoking the SIGINT handler (the `sigintBound` wrapper is synchronous; microtask drain via `setTimeout(r, 0)` ensures the async handler body — including `process.exit` — completes before assertions run).

### Task 2 — test/rpc.client.backoff.test.ts filled (commit `67250d5`)

All 9 `it.todo` stubs flipped to passing assertions:

| # | Test title | What it proves |
|---|-----------|----------------|
| 1 | login rejection schedules retry at 5s (attempt 0, ladder head) | First failure → 5s delay (not 10s) |
| 2 | second rejection waits 10s, third 20s, fourth 40s, fifth+ capped at 60s (ladder progression RPC-03) | Full ladder 5→10→20→40→60→60 |
| 3 | cooldown floor: forced retry at 1s after last attempt waits full 5s, not the ladder value (5s floor) | Timestamps gap ≥ 5000ms on rapid reconnect cycles |
| 4 | ready event resets attempt counter back to 5s on next disconnect (ladder resets on success) | After ready, next disconnect delays 5s not 80s+ |
| 5 | ready event triggers onReady callback for reconnect replay (RPC-04 / D-12) | Replay fires on each ready; 2 reconnects = 2 replays |
| 6 | pid is forwarded into setActivity / clearActivity on every call (RPC-01) | clearActivity(9999) + setActivity(payload, 9999) confirmed |
| 7 | stop() clears pending retry timeout and prevents late-resolve orphan clients (Phase 1 WR-01 carry-forward) | getLiveClient()=null after stop+ready; orphan torn down |
| 8 | SIGINT handler registered by ConnectionManager unregisters on stop() (Phase 1 WR-04 carry-forward) | process.once("SIGINT") + process.off("SIGINT") symmetry |
| 9 | all connect/setActivity/clearActivity errors swallowed — only console.debug, never console.error (RPC-05) | errorSpy not called; debugSpy called on login rejection |

---

## Full Guardrail Suite Result

```
pnpm vitest run test/rpc.client.backoff.test.ts  — 9 passed (exit 0)
pnpm vitest run test/rpc.client.smoke.test.ts    — 5 passed (exit 0)
pnpm test                                         — 31 passed, 11 todo (exit 0)
pnpm typecheck                                    — exit 0
pnpm build                                        — exit 0 (dist/extension.cjs: 196.6 KB)
pnpm check:bundle-size                            — PASS (201350 bytes; delta +95 bytes from connection manager)
pnpm check:api-surface                            — PASS (6 .ts files, 4 pure-core, no violations)
```

Bundle delta: +95 bytes (connection manager state + closures, no new deps — well under 3 KB expectation).

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed scheduleRetry delay-before-increment ordering**
- **Found during:** Task 2 — test 1 failed: "expected mockLogin called 2 times, got 1 times" (retry fired at 10s not 5s)
- **Issue:** `scheduleRetry` incremented `attempt` BEFORE calling `nextDelay()`. So after the first failure, `attempt=1` → `ladder[1]=10s`. Spec says attempt-0 should yield 5s.
- **Fix:** Read `nextDelay()` BEFORE `attempt += 1` in `scheduleRetry`. Attempt-0 now correctly maps to `ladder[0]=5000ms`.
- **Files modified:** `src/rpc/client.ts`
- **Commit:** `67250d5`

**2. [Rule 1 - Bug] Fixed smoke test process.exit invocation for WR-04**
- **Found during:** Task 1 — smoke test assertion 5 called signal handler which now calls `process.exit`, crashing the runner
- **Issue:** The WR-04 fix adds `process.exit(130|143)` to the handler. The smoke test invokes the handler directly. `sigintBound` is synchronous (`() => void handler("SIGINT")`), so `await sigint!.handler()` doesn't actually await the async body — `process.exit` fires after the test resumes.
- **Fix:** Spy `process.exit` before calling the bound wrapper, then `await new Promise<void>((r) => setTimeout(r, 0))` to drain microtasks before asserting.
- **Files modified:** `test/rpc.client.smoke.test.ts`
- **Commit:** `df3aa15`

**3. [Rule 1 - Bug] Fixed mock design to use per-instance listener Maps**
- **Found during:** Task 2 — tests 4/5 failing due to accumulated listeners across Client instances
- **Issue:** Original mock used a shared `listeners` Map. Each `attemptConnect` creates a new Client and calls `client.on("ready", cb)`. After a reconnect, the listeners Map had entries from both the old and new Client. `emit("ready")` fired both, calling `readyCallbacks` twice.
- **Fix:** Mock Client uses an instance-level `this.listeners` Map. `emit()` targets `getLastClient()._ref.listeners` — only the most recently created Client's listeners are fired. `vi.hoisted()` used to ensure mock fns are available at hoist time.
- **Files modified:** `test/rpc.client.backoff.test.ts`
- **Commit:** `67250d5`

---

## Requirements Completed

| Requirement | Description | Status |
|-------------|-------------|--------|
| RPC-01 | pid-scoped setActivity/clearActivity on every call | Satisfied — test 6 proves pid forwarding |
| RPC-03 | Exponential backoff 5→60s cap + 5s cooldown floor | Satisfied — tests 1, 2, 3 prove ladder + floor |
| RPC-04 | Reconnect replay via onReady callback | Satisfied — test 5 proves replay fires on each ready |
| RPC-05 | Silent failures — debug only, never error | Satisfied — test 9 proves no console.error |
| RPC-06 | Never setActivity(null) | Satisfied — grep gate returns 0 in client.ts |

Phase 1 carry-forwards closed:
- **WR-01:** `shuttingDown` flag + orphan-client teardown — test 7 proves
- **WR-04:** `process.exit(130|143)` in signal handler finally block — test 8 verifies registration symmetry; smoke test 5 verifies cleanup path

---

## Known Stubs

None — `createConnectionManager`, `setActivity`, `BACKOFF_LADDER_MS`, `COOLDOWN_FLOOR_MS`, `realBackoffDeps` are fully implemented. `connect` and `helloWorldAnnounce` remain in the file (unused after Phase 2 driver wiring) per plan scope boundary — 02-07 removes them.

---

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. All STRIDE mitigations from the plan's threat register are implemented:

| Threat | Mitigation | Test |
|--------|-----------|------|
| T-RPC-01 (ghost activity after deactivate) | `shuttingDown` checked in `attemptConnect` + `ready` listener | test 7 |
| T-RPC-02 (handler leak across reload) | `registerSignalHandlers` returns unregister fn with bound closure refs | test 8 |
| T-RPC-03 (late-resolve race) | Ready listener tears down orphan (clearActivity + destroy), never stores as liveClient | test 7 |
| T-RPC-04 (setActivity(null) ghost presences) | Grep gate: 0 occurrences; only clearActivity(pid) used | acceptance criteria |
| T-RPC-05 (login retry loop < 5s) | Cooldown floor in nextDelay() | test 3 |
| T-RPC-07 (process hang on SIGINT) | process.exit(130|143) in finally block | test 8 + smoke test 5 |

---

## Next Plan Readiness

- **02-07 (driver wiring):** `createConnectionManager(DEFAULT_CLIENT_ID, process.pid, realBackoffDeps).start()` at activation; `mgr.onReady(replay)` wires replay; `mgr.setActivity` wrapped in `createThrottle` from 02-03; `registerSignalHandlers(liveClient, pid)` unregister fn captured in `shutdown()`. The `connect` + `helloWorldAnnounce` + `connectAndAnnounce` driver from Phase 1 will be deleted in 02-07.

---

## Self-Check

### Modified files exist:
- `test -f src/rpc/client.ts` — FOUND
- `test -f test/rpc.client.backoff.test.ts` — FOUND
- `test -f test/rpc.client.smoke.test.ts` — FOUND

### Commits exist:
- `df3aa15` — feat(02-04): extend client.ts with createConnectionManager, setActivity wrapper, WR-01/WR-04 fixes
- `67250d5` — feat(02-04): fill rpc.client.backoff.test.ts — 9 passing assertions; fix delay-before-increment

## Self-Check: PASSED
