---
phase: 01-skeleton-rpc-seam
plan: 04
subsystem: rpc-seam-tests
tags: [vitest, smoke-test, discord-rpc, vi-mock, tdd, pure-node]

requires:
  - src/rpc/client.ts adapter surface from plan 01-02 (connect, clearActivity, helloWorldAnnounce, registerSignalHandlers)
  - vitest config + test script from plan 01-01 (vitest.config.ts, pnpm test → vitest run)
provides:
  - test/rpc.client.smoke.test.ts — 5 passing behavioral assertions covering SKEL-07, SKEL-08, SKEL-10
  - Working `pnpm test` step for CI (plan 01-03's ci.yml already references it)
  - Behavioral contract lockdown — future plans cannot silently break belt-and-braces ordering or pid forwarding
affects: [02-04, all future phases (CI smoke baseline)]

tech-stack:
  added: []
  patterns:
    - "vi.mock('@xhayper/discord-rpc', factory) — intercepts the real IPC library; no Discord socket is ever opened in CI"
    - "Invocation order tracker (callOrder array) — asserts clearActivity-before-setActivity without brittle timestamp comparisons"
    - "vi.spyOn(process, 'once') — captures registered signal handlers so they can be invoked directly, avoiding real OS signal emission that would kill the test runner"
    - "Hoisted mock state (mockClearActivity, mockLogin, etc.) reset in beforeEach — each test starts from a clean mock baseline"
    - "Import-after-mock ordering — vi.mock is hoisted by vitest, but we defer the module-under-test import until after the mock block for clarity"

key-files:
  created:
    - test/rpc.client.smoke.test.ts
  modified: []

key-decisions:
  - "Use vi.spyOn(process, 'once') over process.emit — emitting a real SIGINT could terminate the vitest runner on some platforms; the spy pattern captures the handler and invokes it directly (T-01-11 mitigation)"
  - "Single describe block with 5 it() cases — VALIDATION.md §Minimum smoke-test asserts maps 1:1 to the test names for easy traceability"
  - "No fake timers — Phase 1 adapter has no setTimeout/setInterval; throttle tests land in Phase 2 (test/rpc.throttle.test.ts per RESEARCH §5)"
  - "Call order tracker (callOrder: string[]) pushed from inside the mock factory methods — more robust than mock.invocationCallOrder for cross-object ordering"
  - "Test file is pure-Node: zero vscode imports, zero @xhayper/discord-rpc real imports (only the mocked surface)"

patterns-established:
  - "Smoke test topology: one vi.mock factory emulating the Client class + user.clearActivity/setActivity/login/destroy; module under test imported after the mock; beforeEach resets all mocks and callOrder"
  - "Signal-handler assertion recipe: spy process.once, capture handler, invoke directly, assert side effects on the mocked RPC client"
  - "Silent-failure assertion recipe: mockImplementationOnce to reject; await expect(wrapper()).resolves.toBeUndefined()"

requirements-completed: [SKEL-07, SKEL-08, SKEL-10]

duration: ~1min
completed: 2026-04-12
---

# Phase 01 Plan 04: RPC adapter smoke suite — 5 behavioral assertions Summary

**Delivered `test/rpc.client.smoke.test.ts` — a vitest smoke suite with 5 passing assertions covering connect wiring, pid forwarding, silent error swallowing, belt-and-braces ordering (SKEL-08), and SIGINT/SIGTERM handler wiring (SKEL-07). `pnpm test` exits 0 in 431ms. Zero vscode imports, zero real Discord IPC, zero `process.emit` calls — pure-Node test locked to the plan 01-02 adapter surface.**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-04-12T23:20:33Z
- **Completed:** 2026-04-12T23:21:25Z
- **Tasks:** 1
- **Files created:** 1 (`test/rpc.client.smoke.test.ts`)
- **Files modified:** 0

## Accomplishments

- **SKEL-10 satisfied:** `pnpm test` exits 0 with 5/5 passing tests. CI step in `.github/workflows/ci.yml` (from plan 01-03) now has a non-trivial test suite to run.
- **SKEL-07 behaviorally verified (unit):** Assertion 2 (pid forwarding) + Assertion 5 (signal handler → clearActivity(pid) via captured SIGINT handler) — signal-triggered cleanup is locked in as a unit-testable invariant.
- **SKEL-08 behaviorally verified (unit):** Assertion 4 uses the callOrder tracker to prove `clearActivity` is called before `setActivity` in `helloWorldAnnounce`. Any future refactor that silently drops the belt-and-braces step fails CI.
- **Silent-failure contract locked:** Assertion 3 proves that a rejected `clearActivity` still resolves the wrapper without throwing — PRD §8 "Failure mode" codified in a test.
- **Pure-Node test boundary preserved:** `src/rpc/client.ts` never imports vscode, so the smoke test never needs to stub the vscode API. This keeps the adapter module testable by Phase 2+ plans that will add backoff/throttle coverage.
- **Fast suite:** 431ms total runtime — well under the 5-second budget.

## Assertion → Requirement Mapping

| Assertion | VALIDATION.md §Minimum smoke-test asserts | Requirement | Test name |
|-----------|-------------------------------------------|-------------|-----------|
| 1 | #1 Connect wiring | SKEL-10 | `connect() calls client.login() exactly once` |
| 2 | #2 clearActivity forwards the pid | SKEL-07 | `clearActivity forwards the pid to client.user.clearActivity` |
| 3 | #3 Errors are swallowed | PRD §8 | `clearActivity swallows rejection errors silently` |
| 4 | #4 Activate sequence (clearActivity BEFORE setActivity) | SKEL-08 | `helloWorldAnnounce calls clearActivity BEFORE setActivity` |
| 5 | #5 Signal handler wiring | SKEL-07 | `registerSignalHandlers handler invokes clearActivity(pid) when fired` |

## Task Commits

1. **Task 1: Write test/rpc.client.smoke.test.ts — RED/GREEN in one shot (adapter already built)** — `a7dc6cb` (test)

## `pnpm test` Output (Proof)

```
 RUN  v2.1.9 /Users/leonardojaques/projects/personal/richagenticpresence-discord

 ✓ test/rpc.client.smoke.test.ts (5 tests) 3ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Duration  431ms (transform 35ms, setup 0ms, collect 27ms, tests 3ms, environment 0ms, prepare 47ms)
```

- **Pass count:** 5
- **Fail count:** 0
- **Skipped:** 0
- **Runtime:** 431ms (3ms for tests themselves; rest is vitest startup)
- **Exit code:** 0

## Static Check Evidence

| Check | Result |
|-------|--------|
| `test -f test/rpc.client.smoke.test.ts` | PASS |
| `grep -c 'from "vscode"' test/rpc.client.smoke.test.ts` | 0 (pure-Node, no vscode import) |
| `grep -c "from 'vscode'" test/rpc.client.smoke.test.ts` | 0 |
| `grep -c 'vi.mock("@xhayper/discord-rpc"' test/rpc.client.smoke.test.ts` | 1 (fake transport) |
| `grep -c "it(" test/rpc.client.smoke.test.ts` | 5 (5 required behaviors) |
| `grep -c "process.emit" test/rpc.client.smoke.test.ts` | 0 (no real signal emission — would kill runner) |
| `grep -c "describe(" test/rpc.client.smoke.test.ts` | 1 |
| Line count | 122 (under 150-line target, over 80-line min_lines) |
| `pnpm test` exit code | 0 |

## Deviations from Plan

None — plan executed exactly as written. The test code in the PLAN.md `<action>` block was transcribed verbatim and passed on the first run because plan 01-02 built the adapter to this exact behavioral contract.

## Threat Flags

None new. The plan's `<threat_model>` mitigations are implemented as specified:

- **T-01-01 (ghost presence regression):** Assertions 2, 4, 5 codify the SKEL-07/SKEL-08 contract. Any future plan that removes belt-and-braces clearActivity, breaks pid forwarding, or silently drops the signal handler wiring fails `pnpm test` in CI.
- **T-01-11 (test harness kills CI runner via real signal):** Mitigated via `vi.spyOn(process, "once")`. No `process.emit("SIGINT"/"SIGTERM")` anywhere in the file (grep-verified: 0 matches).
- **T-01-12 (fake transport drifts from real library surface):** Accepted per plan — the fake `Client` in the mock factory only exposes the Phase 1 surface (`user.clearActivity`, `user.setActivity`, `login`, `destroy`, `on`, `once`). Phase 2 hardening will surface any gap.

## User Setup Required

None. The `[HUMAN]` handoff doc (plan 01-05) is the only remaining Phase 1 user action — it's orthogonal to this test suite.

## Next Plan Readiness

- **Plan 01-05 ready:** Last plan in Phase 1 (HUMAN-HANDOFF.md). This plan has no dependency on it; they can run in any order.
- **Phase 2 ready:** The vi.mock recipe + order-tracker pattern + signal-handler spy pattern established here extend directly to `test/rpc.throttle.test.ts` (RESEARCH §5 calls this out).
- **CI ready:** `.github/workflows/ci.yml` from plan 01-03 runs `pnpm test` — now it exercises real assertions instead of an empty suite.
- **No blockers.** Suite passes, static checks all green, bundle unaffected.

## Note on Phase 2 Extension

Phase 2 will add `test/rpc.throttle.test.ts` covering the 2s leading+trailing throttle and 5→60s exponential backoff. This Phase 1 smoke suite is intentionally narrow — it locks in the v0 adapter contract (no throttle, no backoff) so Phase 2 tests can evolve around it rather than replacing it.

## Self-Check: PASSED

- FOUND: test/rpc.client.smoke.test.ts
- FOUND: commit a7dc6cb (test(01-04): add rpc client smoke suite — 5 behavioral assertions)
- FOUND: 5 `it(` blocks
- FOUND: 1 `vi.mock("@xhayper/discord-rpc"` call
- FOUND: 0 `from "vscode"` or `from 'vscode'` imports
- FOUND: 0 `process.emit` calls
- FOUND: `pnpm test` exit code 0, 5 passed, 0 failed

---
*Phase: 01-skeleton-rpc-seam*
*Completed: 2026-04-12*
