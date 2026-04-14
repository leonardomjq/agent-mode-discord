---
phase: "02"
plan: "07"
subsystem: integration-driver
tags: [detector, git, driver, wiring, integration, idle-timer, reconnect-replay, uat-refresh]
dependency_graph:
  requires: [02-01, 02-02, 02-03, 02-04, 02-05, 02-06]
  provides: [Phase 2 shipping pipeline — detectors → reducer → context → privacy → throttle → pid-scoped Discord RPC with backoff + replay]
  affects: [src/extension.ts, src/detectors/git.ts, test/detectors.git.test.ts, 02-HUMAN-UAT.md]
tech_stack:
  added: []
  patterns: [driver-composition, async-on-construction, shuttingDown-flag, idle-timer-in-driver, replay-on-ready]
key_files:
  created: [src/detectors/git.ts, test/detectors.git.test.ts (rewritten)]
  modified: [src/extension.ts, .planning/phases/02-core-pipeline/02-HUMAN-UAT.md]
decisions:
  - "Git detector uses async-on-construction IIFE so activate() returns synchronously (SKEL-03 safe)"
  - "MockRepo HEAD getter typed explicitly as returning '{ name: string | undefined } | undefined' to satisfy TypeScript in test (void return from throw is a compile error without explicit return type)"
  - "extension.ts buildPayload() passes mode='show' to all three redact() callsites — Phase 4 flips to config-driven mode"
metrics:
  duration_minutes: 4
  completed: "2026-04-14"
  tasks_completed: 4
  files_modified: 4
requirements:
  - RPC-01
  - RPC-02
  - RPC-03
  - RPC-04
  - RPC-05
  - RPC-06
  - STATE-01
  - STATE-02
  - STATE-03
  - STATE-04
  - STATE-05
  - STATE-06
---

# Phase 02 Plan 07: Integration Driver + Git Detector Summary

**One-liner:** Full Phase 2 pipeline wired in extension.ts — git detector + editor detector → reduce() → buildContext() → redact() → throttle → pid-scoped Discord RPC with 5→60s backoff and reconnect replay; WR-01 closed via shuttingDown flag.

## What Was Built

### Task 1 — src/detectors/git.ts (created, 106 lines)

`createGitDetector(dispatch)` adapts the vscode.git Extension API v1 into the existing `dispatch(Event)` contract:

- **Async-on-construction:** wraps extension lookup + activation in `void (async () => { ... })()` — returns `vscode.Disposable` synchronously so `activate()` doesn't block.
- **Silent no-op:** if `vscode.extensions.getExtension('vscode.git')` returns `undefined`, the detector returns an empty disposable and never dispatches.
- **Pitfall 3 (async activation):** checks `ext.isActive`; if false, awaits `ext.activate()` before calling `getAPI(1)`.
- **Pitfall 4 (multi-repo):** `pickRepository()` matches `window.activeTextEditor.document.uri.fsPath` against `repository.rootUri.fsPath` using `startsWith`; falls back to `repositories[0]`.
- **Per-repo subscription map:** `Map<GitRepository, vscode.Disposable>` tracks each `onDidChange` listener; `onDidCloseRepository` disposes the specific entry.
- **Initial branch dispatch:** calls `dispatchBranch(api)` once after API acquisition (the event doesn't re-fire on startup).
- **D-18:** every vscode call wrapped in try/catch with silent swallow.

### Task 2 — test/detectors.git.test.ts (rewritten, 5 passing)

Replaced 5 `it.todo` stubs with full `async` test bodies using a rich `vi.mock("vscode")` factory:

| # | Test name | What it proves |
|---|-----------|----------------|
| 1 | dispatches branch-changed on onDidChange | initial dispatch + triggered dispatch |
| 2 | silent when getExtension returns undefined | no-op path, dispose() doesn't throw |
| 3 | activates extension when isActive=false | Pitfall 3 activation path |
| 4 | multi-repo fsPath picker + repositories[0] fallback | Pitfall 4 repo selection |
| 5 | HEAD getter throw → silent no-op (D-18) | try/catch swallow on read failure |

**Deviation (Rule 1 — bug fix):** The throwing-HEAD getter had an implicit `void` return type, which TypeScript rejected against `MockRepo.state.HEAD: { name: string | undefined } | undefined`. Fixed by adding an explicit return type annotation to the getter.

### Task 3 — src/extension.ts (rewritten, 123 lines)

Replaces Phase 1's `connectAndAnnounce` / `shutdown` with a `createDriver()` factory:

**Pipeline data flow:**
```
editor event          git event
      ↓                    ↓
createEditorDetector  createGitDetector
      ↓                    ↓
              dispatch(Event)
                    ↓
              reduce(state, event)   ← pure reducer (02-01)
                    ↓
              scheduleIdle()         ← driver-owned timer (D-05)
                    ↓
              buildPayload()
                ↓          ↓        ↓
          buildContext()  redact()   (02-02, 02-05)
                    ↓
              throttled(payload)     ← 2s leading+trailing (02-03)
                    ↓
              mgr.setActivity()      ← pid-scoped + backoff (02-04)
                    ↓
              Discord IPC
```

**Key behaviors:**

- **Idle timer (D-05):** `scheduleIdle()` resets a `setTimeout(IDLE_MS=300_000)` on every `dispatch()` call while `state.kind === "CODING"`. Fires `{ type: "idle-tick" }` only if no newer editor event lands. Cancelled in `dispose()`.
- **Reconnect replay (RPC-04/D-12):** `mgr.onReady(() => throttled(buildPayload()))` — routes through the normal throttle path so 2s leading/trailing still applies. First ready call also captures `registerSignalHandlers` unregister fn.
- **shuttingDown flag (WR-01):** `dispose()` sets `shuttingDown = true` before any teardown. Every `dispatch()` call checks `if (shuttingDown) return`. Idle timer callback checks too. Closes WR-01 at the integration layer.
- **WR-04:** `unregisterSignals` captured on first `mgr.onReady()` (not on every reconnect); called in `dispose()`.
- **Privacy plumbing (D-15):** `redact("filename", …, "show")`, `redact("branch", …, "show")`, `redact("workspace", …, "show")` — three callsites pass-through in Phase 2; Phase 4 flips mode from config.
- **Removed:** `connectAndAnnounce`, `helloWorldAnnounce` call site, `liveClient` module-scope var, `unregisterSignalHandlers` module-scope var, `eslint-disable` pragma (IN-01).

### Task 4 — 02-HUMAN-UAT.md (refreshed)

Updated from `status: pending` to `status: ready-for-uat`. Three targeted additions:

- **Checklist 1 step 4a:** confirms no `[agent-mode-discord]` log lines fire on editor-closed (reducer no-ops; only idle-tick fires 5 min later).
- **Checklist 1 step 7a:** Discord state-string shows "Idle" with empty fields dropped (Phase 2 payload; goblin copy arrives Phase 4).
- **Checklist 2 step 4:** replaced vague "connect failed" with exact log prefix `[agent-mode-discord] RPC login rejected:` + explicit ladder cadence `5 s → 10 s → 20 s → 40 s → 60 s cap` + 5 s cooldown floor statement.
- **Checklist 3 step 6:** added pid-isolation failure observation — if both windows show same filename, isolation failed; document Discord client version.

## Test Results

```
Test Files  7 passed (7)
     Tests  42 passed (42)
```

Full suite breakdown:
- `test/rpc.client.smoke.test.ts` — Phase 1 regression (connect/announce/clear/destroy) — still green
- `test/state.machine.test.ts` — 9 reducer tests
- `test/rpc.throttle.test.ts` — 5 throttle tests
- `test/rpc.client.backoff.test.ts` — 9 backoff + connection manager tests
- `test/privacy.test.ts` — privacy redact tests
- `test/detectors.editor.test.ts` — 5 editor detector tests
- `test/detectors.git.test.ts` — 5 git detector tests (NEW — all flipped from todo)

## Guardrail Results

| Check | Result | Notes |
|-------|--------|-------|
| `pnpm test` | PASS | 42/42 tests |
| `pnpm typecheck` | PASS | 0 errors |
| `pnpm build` | PASS | esbuild production bundle |
| `pnpm check:bundle-size` | PASS | 200.9 KB / 40.2% of 500 KB |
| `pnpm check:api-surface` | PASS | 9 files scanned, 0 violations |

**Bundle-size delta:** 205,745 bytes after plan 07 vs ~204 KB baseline from Wave 2 — delta ≈ 1 KB (driver imports 6 internal modules, no new external deps). Well within the ≤5 KB delta target.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed implicit `void` return type on MockRepo throwing HEAD getter**
- **Found during:** Task 2 — `pnpm typecheck` after writing test
- **Issue:** TypeScript infers `get HEAD() { throw new Error("boom"); }` as returning `void`, which is not assignable to `{ name: string | undefined } | undefined` required by the `MockRepo` type
- **Fix:** Added explicit return type annotation: `get HEAD(): { name: string | undefined } | undefined { throw new Error("boom"); }`
- **Files modified:** `test/detectors.git.test.ts`
- **Commit:** eddf563

## Requirements Completed at Integration Layer

All 12 Phase 2 requirements satisfied — unit-level coverage by 02-01..02-06; integration-layer closure by this plan:

| Requirement | Where Proved |
|-------------|-------------|
| RPC-01 pid-scoped activity | createConnectionManager(pid) in driver |
| RPC-02 2s throttle | createThrottle(THROTTLE_MS=2000) in driver |
| RPC-03 backoff ladder | createConnectionManager with realBackoffDeps |
| RPC-04 reconnect replay | mgr.onReady → throttled(buildPayload()) |
| RPC-05 silent failures | mgr.setActivity + dispatch try/catch |
| RPC-06 clearActivity on deactivate | mgr.stop() → clearActivity + destroy |
| STATE-01 CODING on editor-changed | reduce() + editorDetector dispatch |
| STATE-02 IDLE on idle-tick | reduce() + driver idle timer |
| STATE-03 AGENT_ACTIVE priority | reduce() handles agent-started |
| STATE-04 agent-ended → IDLE | reduce() handles agent-ended |
| STATE-05 startTimestamp resets on kind transition | reduce() pure logic |
| STATE-06 last-wins throttle | createThrottle last-wins semantics |

## Phase 2 DoD Status

| Criterion | Status |
|-----------|--------|
| SC-1: IDLE after 5 min | Unit: vitest fake-timer dispatch; Dev Host: PENDING (manual UAT) |
| SC-2: 20 events/sec → ≤1 setActivity/2s | Unit: rpc.throttle.test.ts |
| SC-3: backoff + replay | Unit: rpc.client.backoff.test.ts; Dev Host: PENDING (manual UAT) |
| SC-4: two-window pid isolation | Dev Host only: PENDING (manual UAT) |
| SC-5: bundle ≤500 KB | PASS: 200.9 KB (40.2%) |

## WR Status

| WR | Status |
|----|--------|
| WR-01 (dispatch after deactivate) | CLOSED — shuttingDown flag in createDriver() |
| WR-04 (signal handler leak on F5 reload) | CLOSED — unregisterSignals captured on first ready, called in dispose() |

## Next Phase Readiness

Phase 3 adds agent detectors (`agent-started` / `agent-ended` events). The `dispatch` contract is already defined in `src/state/types.ts` and handled by `reduce()`. Phase 3 plugs new detectors into the existing `dispatch` function in `src/extension.ts` — no Phase 2 code changes expected.

Manual sign-off pending: `02-HUMAN-UAT.md` Checklists 1, 2, 3 against Dev Host + Discord desktop.

## Self-Check: PASSED

- `src/detectors/git.ts` — FOUND
- `src/extension.ts` — FOUND
- `test/detectors.git.test.ts` — FOUND
- `.planning/phases/02-core-pipeline/02-HUMAN-UAT.md` — FOUND
- Commit 2c239d2 (feat: git.ts) — FOUND
- Commit eddf563 (test: git test) — FOUND
- Commit 34d2997 (feat: extension.ts driver) — FOUND
- Commit 5229d80 (docs: UAT refresh) — FOUND
