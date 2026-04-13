---
phase: "02"
plan: "03"
subsystem: "rpc-throttle"
tags: [throttle, pure-core, rate-limit, last-wins, vitest-fake-timers, RPC-02, STATE-06]
dependency_graph:
  requires:
    - "02-00 — test/rpc.throttle.test.ts stub file (5 it.todo placeholders)"
    - "02-00 — scripts/check-api-surface.mjs pure-core path ban (D-16)"
  provides:
    - "src/rpc/throttle.ts — createThrottle(fn, windowMs, deps?) pure leading+trailing last-wins throttle"
    - "test/rpc.throttle.test.ts — 5 passing assertions (RPC-02 / STATE-06 proof)"
  affects:
    - "02-04 — client hardening can wire setActivity wrapper into createThrottle"
    - "02-07 — driver calls createThrottle(setActivityWrapper, 2000) once at activation"
tech_stack:
  added: []
  patterns:
    - "Injectable timer deps (ThrottleDeps) for vi.useFakeTimers in vitest"
    - "Nullable sentinel { value: T } | null for pending payload (distinguishes no-pending from pending-undefined)"
    - "void fn(payload) fire-and-forget — throttle ignores async return, never awaits"
    - "lastFiredAt = -Infinity initial value ensures first call always takes leading edge"
    - "Trailing fire resets lastFiredAt to -Infinity — closes window without starting a new one"
key_files:
  created:
    - src/rpc/throttle.ts
  modified:
    - test/rpc.throttle.test.ts
decisions:
  - "Trailing fire resets lastFiredAt to -Infinity (not deps.now()) — trailing closes the window; the next call after a trailing fire is always a fresh leading edge. This matches test 5 semantics and the plan's intent."
  - "Plan's interface code had lastFiredAt = deps.now() in fireTrailing but test 5 requires the opposite — Rule 1 auto-fix applied."
metrics:
  duration_minutes: 3
  completed_date: "2026-04-13"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 02 Plan 03: Throttle Module Summary

**One-liner:** Pure-core leading + trailing last-wins throttle with injectable timer deps; 5 vitest assertions prove RPC-02 / STATE-06 semantics (leading immediate, trailing last-wins, no-trailer-on-single-call, window-reset after trailing, cancels-trailer-on-new-leading).

---

## What Was Built

### Task 1 — src/rpc/throttle.ts (commit `fa5ecee`)

Created `src/rpc/throttle.ts` (77 lines, under D-17 guardrail):

- Exports `ThrottleDeps` interface, `realThrottleDeps` production singleton, `createThrottle<T>` factory
- Pure-core: zero `vscode` imports, zero `@xhayper` imports — `pnpm check:api-surface` enforces via D-16 `PURE_CORE_PATHS` guard
- Injectable timer deps (`now`, `setTimeout`, `clearTimeout`) so tests use `vi.useFakeTimers` without patching globals
- Single `pendingPayload: { value: T } | null` slot — last-wins (D-10); no queuing possible
- Single `trailingTimer: NodeJS.Timeout | null` handle — cleared on leading edge, nulled in `fireTrailing`
- `lastFiredAt = -Infinity` initial value guarantees first call always takes leading-edge branch
- `void fn(payload)` fire-and-forget — async return value ignored; throttle is timing-only

### Task 2 — test/rpc.throttle.test.ts (commit `8806756`)

Flipped all 5 `it.todo` stubs to passing `it(..., async () => {...})` blocks:

| # | Test title | Behavior proved |
|---|-----------|----------------|
| 1 | fires leading edge immediately on first call | Leading fires synchronously on first dispatch |
| 2 | 20 calls across 1s → exactly 2 underlying calls (RPC-02 / STATE-06) | Burst of 20 at 50ms intervals → leading(payload-0) + trailing(payload-19) |
| 3 | trailing fire emits most recent payload (last-wins, D-10) | "third" overwrites "second"; trailing fires "third" not "second" |
| 4 | no trailing fire when only one call lands | Single leading call, no trailing after window elapses |
| 5 | cancels pending trailer when new leading edge fires | Trailing fires "b"; subsequent "c" is a fresh leading edge |

All tests use `vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })` in `beforeEach` and `vi.useRealTimers()` in `afterEach`. `advanceTimersByTimeAsync` used throughout (Pitfall 2 from RESEARCH: drains microtask queue reliably across iterations).

---

## Full Guardrail Suite Result

```
vitest run           — 10 passed, 32 todo (exit 0)
pnpm typecheck       — exit 0
pnpm build           — exit 0 (dist/extension.cjs: 196.5 KB, 39.3% of 500 KB threshold)
pnpm check:bundle-size — PASS (201255 bytes; throttle is pure functions, ~0 KB delta)
pnpm check:api-surface — PASS (3 .ts files, 1 pure-core, no violations)
```

Bundle-size delta from throttle: ~0 KB (pure functions, no runtime deps, tree-shaken at build time).

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed trailing fire lastFiredAt semantics**
- **Found during:** Task 2 — test 5 failed: "expected fn to be called 3 times, but got 2"
- **Issue:** Plan's `<interfaces>` code set `lastFiredAt = deps.now()` inside `fireTrailing`. This started a new throttle window from the trailing fire moment, so a call 1000ms after the trailing fire (which itself was 1000ms into the previous window) would be inside the new window and go to pending instead of leading edge.
- **Fix:** `fireTrailing` now resets `lastFiredAt = -Infinity`. Trailing fire closes the window; the next call is always a fresh leading edge. This is the semantically correct behavior for a "fire-and-forget" leading+trailing throttle where trailing is the final emission of a burst, not the start of a new rate-limit window.
- **Files modified:** `src/rpc/throttle.ts`
- **Commit:** `8806756` (bundled with test commit per TDD GREEN step)

---

## Requirements Completed

| Requirement | Description | Status |
|-------------|-------------|--------|
| RPC-02 | Throttle setActivity to 1 per 2000ms leading+trailing, drop intermediates, last-wins | Satisfied — test 2 proves 20 calls → exactly 2 fn invocations |
| STATE-06 | 20 state-change events in 1s → ≤1 Discord update per 2s window; user observes latest state | Satisfied — test 2 proves trailing carries payload-19 (latest) |

---

## Known Stubs

None — `createThrottle` is fully implemented. `realThrottleDeps` is the production path. No placeholder values or TODO markers.

---

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes. The throttle is a pure in-memory timing wrapper with no I/O.

All threat register mitigations from plan 02-03 are implemented:
- T-RPC-02-01 (unbounded queue DoS): single `pendingPayload` slot, overwrite semantics
- T-RPC-02-02 (stale payload): trailing fires with most recent held payload (test 3 asserts "third" not "second")
- T-RPC-02-03 (timer handle leak): `trailingTimer` nulled in `fireTrailing`, cleared on leading edge
- T-RPC-02-04 (fake deps in prod): `realThrottleDeps` is the default; no production codepath passes fake deps

---

## Next Plan Readiness

- **02-04 (client hardening):** `createThrottle` signature is locked — `(fn, windowMs, deps?)` returns `(payload: T) => void`. Client hardening can wire `setActivity(client, pid, payload)` wrapper directly.
- **02-07 (driver wiring):** Driver calls `createThrottle(setActivityWrapper, 2000)` once at activation. Reconnect replay (RPC-04) re-dispatches through the throttled fn — normal leading/trailing rules apply.

---

## Self-Check

### Created files exist:
- `test -f src/rpc/throttle.ts` — FOUND
- `test -f test/rpc.throttle.test.ts` — FOUND (modified)

### Commits exist:
- `fa5ecee` — feat(02-03): create src/rpc/throttle.ts
- `8806756` — feat(02-03): fill rpc.throttle.test.ts — 5 passing assertions; fix trailing lastFiredAt

## Self-Check: PASSED
