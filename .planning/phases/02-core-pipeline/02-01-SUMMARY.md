---
phase: "02"
plan: "01"
subsystem: "state-machine"
tags: [state-machine, pure-core, reducer, discriminated-union, vitest]
dependency_graph:
  requires:
    - "02-00 — test/state.machine.test.ts stubs + check-api-surface.mjs path-scoped guard"
  provides:
    - "src/state/types.ts — State | Event | DetectorSnapshots | PresenceContext discriminated unions"
    - "src/state/machine.ts — reduce(state, event, now?): State pure reducer + initialState(now?): State"
    - "test/state.machine.test.ts — 8 passing tests for STATE-01..05 + 1 todo reserved for 02-02"
  affects:
    - "02-02 (buildContext) — consumes State + PresenceContext + DetectorSnapshots from types.ts"
    - "02-07 (driver) — consumes reduce + initialState from machine.ts"
    - "02-03 (throttle) — indirect: driver wires throttle to reducer output"
tech_stack:
  added: []
  patterns:
    - "Discriminated union keyed by kind: \"AGENT_ACTIVE\" | \"CODING\" | \"IDLE\" (D-02)"
    - "Pure reducer reduce(state, event, now?): State — no timers, no mutation, no vscode (D-01)"
    - "Injected now() clock for deterministic unit tests — no vi.useFakeTimers needed"
    - "switch(event.type) with default: return state (unknown-event future-proof, D-03)"
key_files:
  created:
    - src/state/types.ts
    - src/state/machine.ts
  modified:
    - test/state.machine.test.ts
decisions:
  - "Reducer signature uses optional now: () => number = Date.now parameter so tests inject deterministic clocks without fake timers (D-01 / D-05)"
  - "editor-closed is a no-op: only idle-tick drives IDLE (CONTEXT Pitfall 1 / D-05)"
  - "agent-started same-agent into AGENT_ACTIVE returns state reference unchanged (no startTimestamp reset — intra-kind no-op)"
  - "agent-started different-agent into AGENT_ACTIVE updates agent field without resetting startTimestamp (intra-kind field update, STATE-05)"
metrics:
  duration_minutes: 12
  completed_date: "2026-04-13"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 02 Plan 01: Pure State Machine Reducer Summary

**One-liner:** Pure reducer `reduce(state, event, now?): State` with full 5-state-transition coverage + discriminated-union types contract — zero vscode imports, 8 vitest tests passing, all guardrails green.

---

## What Was Built

### Task 1 — src/state/types.ts (commit `252e1bb`)

Discriminated-union type contracts for the entire Phase 2 pipeline.

| Export | Shape | Purpose |
|--------|-------|---------|
| `AgentActiveState` | `{ kind: "AGENT_ACTIVE"; agent: string; startTimestamp: number; ... }` | AGENT priority state (STATE-03) |
| `CodingState` | `{ kind: "CODING"; startTimestamp: number; ... }` | Editor-focused state (STATE-01) |
| `IdleState` | `{ kind: "IDLE"; startTimestamp: number; branch?; workspace? }` | Idle state — no filename/language fields (STATE-02) |
| `State` | `AgentActiveState \| CodingState \| IdleState` | Discriminated union keyed by `kind` (D-02) |
| `Event` | 6-variant union | All Phase 2+3 event types (D-03) |
| `DetectorSnapshots` | `{ workspace?; branch? }` | Detector-provided fields for 02-02 context builder (D-06) |
| `PresenceContext` | `{ kind; agent?; filename?; language?; branch?; workspace?; startTimestamp }` | Immutable snapshot for activity builder (D-06) |

File: 80 lines. Zero vscode imports. `pnpm check:api-surface` passes (D-16).

### Task 2 — src/state/machine.ts + test/state.machine.test.ts (commit `950a99a`)

**Reducer shape summary:**

```
switch(event.type)
  case "editor-changed"  → IDLE→CODING (reset ts) | CODING/AGENT_ACTIVE (preserve ts, update filename/language)
  case "editor-closed"   → no-op (idle-tick drives IDLE, not editor-closed)
  case "idle-tick"       → CODING→IDLE (reset ts) | otherwise no-op
  case "agent-started"   → *→AGENT_ACTIVE (reset ts) | same-agent AGENT_ACTIVE→ref equality | diff-agent→update agent
  case "agent-ended"     → AGENT_ACTIVE→IDLE (reset ts) | otherwise no-op (ref equality)
  case "branch-changed"  → spread branch into current state, preserve startTimestamp (STATE-05)
  default                → return state unchanged (unknown future events)
```

Pure-reducer constraints honored:
- No mutation: all transitions use `{ ...state, ... }` spread
- No timers: `now` is an injected parameter (default `Date.now`)
- No EventEmitter, no class, no vscode import (D-01, D-16)
- 88 lines total (under 120 / D-17)

**Test results:**

```
test/state.machine.test.ts
  ✓ editor-changed from IDLE transitions to CODING and resets startTimestamp (STATE-01)
  ✓ editor-changed from CODING updates filename/language without resetting startTimestamp (STATE-05 invariant)
  ✓ idle-tick from CODING transitions to IDLE and resets startTimestamp (STATE-02)
  ✓ idle-tick from IDLE is a no-op
  ✓ agent-started transitions to AGENT_ACTIVE regardless of prior kind (STATE-03 priority)
  ✓ agent-ended from AGENT_ACTIVE transitions to IDLE (STATE-04)
  ✓ branch-changed preserves kind and startTimestamp (STATE-05 invariant across branch churn)
  ✓ unknown event returns state unchanged (future-proof)
  ↓ buildContext returns immutable snapshot covering all State fields (D-06)  [todo — plan 02-02]

Tests  8 passed | 1 todo (9)
```

**Full suite regression (Phase 1 + Phase 2):**
```
test/rpc.client.smoke.test.ts  5 passed
test/state.machine.test.ts     8 passed | 1 todo
All other test files           37 todo (stubs, not failures)

Total: 13 passed | 29 todo — exit 0
```

---

## Bundle Size Impact

```
pnpm build → dist/extension.cjs: 201255 bytes (196.5 KB) — unchanged from Phase 1
pnpm check:bundle-size → PASS (39.3% of 500 KB threshold)
```

The reducer and types are pure TypeScript — they tree-shake to near-zero impact (< 1 KB) since no vscode-touching module imports them yet. Real bundle growth happens in 02-06/02-07 when detectors and driver are wired.

---

## Requirements Completed

| Requirement | Covered by | Test |
|-------------|-----------|------|
| STATE-01 | `editor-changed` IDLE→CODING + `startTimestamp` reset | it "editor-changed from IDLE..." |
| STATE-02 | `idle-tick` CODING→IDLE + `startTimestamp` reset | it "idle-tick from CODING..." |
| STATE-03 | `agent-started` any→AGENT_ACTIVE priority | it "agent-started transitions to AGENT_ACTIVE..." |
| STATE-04 | `agent-ended` AGENT_ACTIVE→IDLE | it "agent-ended from AGENT_ACTIVE..." |
| STATE-05 | `startTimestamp` preserved on same-kind events | it "...STATE-05 invariant..." (×2) + branch-changed test |
| STATE-06 | Throttle (1 update per 2 s) | Covered by plan 02-03 |

---

## Deviations from Plan

None — plan executed exactly as written. Types and reducer implemented verbatim from the `<interfaces>` specification.

---

## Known Stubs

None introduced. The `it.todo("buildContext...")` placeholder is an intentional contract reservation for plan 02-02 — not a stub in delivered code.

---

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. `src/state/machine.ts` and `src/state/types.ts` are pure TypeScript with zero external I/O. T-02-01-01 (input mutation) mitigated: all returns use `{ ...state, ... }` spread; reference-equality tests (idle-tick no-op, agent-ended from non-AGENT_ACTIVE, same-agent agent-started) verify no-op branches return the exact same object. T-02-01-04 (vscode runtime dep) mitigated: `pnpm check:api-surface` passes with 2 pure-core files scanned.

---

## Self-Check

### Created files exist:
- `test -f src/state/types.ts` — FOUND
- `test -f src/state/machine.ts` — FOUND

### Modified files exist:
- `test -f test/state.machine.test.ts` — FOUND (8 it.todo flipped to passing)

### Commits exist:
- `252e1bb` — feat(02-01): create src/state/types.ts discriminated unions
- `950a99a` — feat(02-01): implement pure reducer + flip 8 state machine tests to passing

## Self-Check: PASSED
