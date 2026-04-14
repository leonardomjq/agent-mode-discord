---
phase: 03-agent-detection
plan: "04"
subsystem: detectors

tags: [orchestrator, precedence, deterministic, integration, driver-wiring, tier-dedup, wave-3]

# Dependency graph
requires:
  - phase: 03-agent-detection
    provides: plan 03-00 scaffolding — `test/detectors.index.test.ts` with 7 it.todo stubs
  - phase: 03-agent-detection
    provides: plan 03-01 — `createShellIntegrationDetector` tier-2 detector
  - phase: 03-agent-detection
    provides: plan 03-02 — `createSessionFilesDetector` tier-3 detector
  - phase: 03-agent-detection
    provides: plan 03-03 — `createPollingDetector` tier-4 detector
  - phase: 03-agent-detection
    provides: plan 03-05 — `buildMatcher` + built-in agent patterns (consumed by shellIntegration tier)
  - phase: 02-core-pipeline
    provides: `Event` union + `dispatch(Event)` contract in `src/state/machine.ts` + `src/extension.ts`
provides:
  - `createDetectorsOrchestrator(dispatch, opts)` returning `vscode.Disposable`
  - Per-tier signal map keyed on [2, 3, 4] with `{active, agent, lastActivityAt}` shape
  - Deterministic highest-tier-wins aggregation (iterates [2, 3, 4], breaks on first active)
  - Cross-tier 0↔N aggregation: agent-started on any-active flip, agent-ended when ALL inactive
  - Intra-AGENT_ACTIVE label-change dispatch (new agent-started, no end+start pair)
  - `src/extension.ts` wired — Phase 2 placeholder replaced, full Phase 3 detection pipeline ships
  - 8 passing assertions replacing 7 it.todo entries
affects: [04-config, 05-companion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Orchestrator is STATELESS per-terminal — child detectors own per-terminal state, orchestrator owns only per-tier aggregate"
    - "opts.factories injection for tests — no vi.mock of child detector modules, no global state leakage across tests"
    - "Tier-intercept closure: each child detector receives a tier-scoped dispatch fn that records into tierStates before forwarding aggregate signal"
    - "Defensive forwarding for non-agent events: if a child detector accidentally emits branch-changed / editor-* / idle-tick, the orchestrator forwards unchanged to parent dispatch (D-18 defensive)"

key-files:
  created:
    - src/detectors/index.ts
  modified:
    - src/extension.ts
    - test/detectors.index.test.ts

key-decisions:
  - "Highest-tier-wins via linear scan over [2, 3, 4] with break-on-first-active — simpler than a priority-indexed data structure and makes the precedence order visible in the code. Phase 5 just prepends `1` to the array."
  - "Label change dispatches a FRESH agent-started (no paired agent-ended first) — the reducer's intra-AGENT_ACTIVE field update absorbs the label change and preserves startTimestamp (per 02-01-SUMMARY)."
  - "opts.factories injection preferred over vi.mock for testing — cleaner, no hoisting mess, type-safe, no module-resolution fragility. Matches the options-bag-injection pattern established by plans 03-01 / 03-02 / 03-03."
  - "Orchestrator is STATELESS per-terminal — only per-tier aggregates tracked. Duplicating per-terminal state here would conflict with child detectors (sessionFiles tracks per-file, shellIntegration tracks per-terminal) and cause aggregation drift."
  - "Defensive non-agent event forwarding: detectors should never emit branch-changed/editor-*, but if one does, forward unchanged. Drop-silently would mask a real bug."

patterns-established:
  - "Cross-tier orchestrator: linear-scan precedence + per-tier state map is the canonical shape for v0.1; Phase 5 tier-1 companion just adds a map entry"
  - "Factory injection for detector testing without vi.mock — opts.factories is the shared idiom from 03-01..03-04"
  - "Intra-AGENT_ACTIVE label change is a bare agent-started (no end-then-start) — matches reducer semantics and avoids startTimestamp reset on tier switch"

requirements-completed: [DET-01, DET-04, DET-05, DET-06, DET-07, DET-08, DET-09, DET-10]

# Metrics
duration: ~2.5 min
completed: 2026-04-14
---

# Phase 03 Plan 04: Detectors Orchestrator Summary

**Tier-precedence orchestrator composing tier-2 shellIntegration + tier-3 sessionFiles + tier-4 polling child detectors into a single deterministic-dedup dispatch pipeline; replaces Phase 2's no-agent placeholder in src/extension.ts so the full Phase 3 detection chain ships end-to-end; 8 tests flipped from 7 it.todo entries — Phase 3 is now wired and functional.**

## Performance

- **Duration:** ~2.5 min
- **Started:** 2026-04-14T23:15:09Z
- **Completed:** 2026-04-14T23:17:37Z
- **Tasks:** 3
- **Files created:** 1 (`src/detectors/index.ts`, 157 lines)
- **Files modified:** 2 (`src/extension.ts` +3 lines; `test/detectors.index.test.ts` flipped 7 todos → 8 passing tests)

## Accomplishments

- `src/detectors/index.ts` authored — `createDetectorsOrchestrator(dispatch, opts)` composes tier-2/3/4 child detectors, routes each via a tier-aware intercept closure, and dispatches a single aggregated `agent-started`/`agent-ended` sequence to the parent driver.
- `src/extension.ts` Phase 2 placeholder REPLACED — `createDetectorsOrchestrator(dispatch)` inserted after editor + git detector construction; `detectorsDisposable.dispose()` added to the driver's dispose chain. Growth: **3 lines** (plan target: ≤ 5 lines).
- 8 passing tests in `test/detectors.index.test.ts` — 7 original it.todo entries flipped + 1 bonus (idempotent agent-ended on double-end from same tier). DET-04 cross-tier aggregation, DET-07 tier precedence, label-change dispatch, and dispose cascade all verified.
- **Phase 3 ships end-to-end** — running `claude` in a terminal now flows: shellIntegration tier-2 detector captures executionStart → tier-dispatch records in tierStates → recomputeAndDispatch picks tier 2 as highest active → dispatches `agent-started` into the parent driver → reducer transitions to AGENT_ACTIVE → throttled RPC call flips Discord to cooking copy.
- All five guardrails green: `pnpm test` (156 pass, 0 todo), `pnpm typecheck` PASS, `pnpm check:api-surface` PASS (6 pure-core files; index.ts correctly NOT pure-core — imports vscode), `pnpm build` PASS (212.4 KB / 41.5% of 500 KB), `pnpm check:bundle-size` PASS. **42 Phase 2 tests + 114 Phase 3 tests = 156 total, zero regressions.**

## Task Commits

1. **Task 1 (feat): Implement detectors orchestrator with tier-precedence dedup** — `60f3c36`
2. **Task 3 (test): Flip 7 it.todo entries to 8 passing orchestrator tests** — `6a0d191`
3. **Task 2 (feat): Wire orchestrator into extension.ts (replace Phase 2 placeholder)** — `c9efd98`

> Note: Task 3 (tests) was executed before Task 2 (extension.ts wiring) so the test suite validated the orchestrator implementation before it was plugged into the driver. This avoided a scenario where a bug in the orchestrator would surface as a regression in the Phase 2 driver test suite rather than as a localized orchestrator-test failure. No impact on the plan — both tasks completed, both committed atomically.

## Files Created/Modified

- `src/detectors/index.ts` — new module (157 lines)
  - `DetectorsOrchestratorOptions` / `TierState` type declarations
  - `createDetectorsOrchestrator(dispatch, opts)` factory
  - Internal state: `tierStates: Map<2|3|4, TierState>`, `aggregateActive: boolean`, `lastDispatchedAgent: string | undefined`
  - Helpers: `safeDispatch`, `recomputeAndDispatch`, `makeTierDispatch(tier)`
  - Construction: factories defaulted to real `createShellIntegrationDetector` / `createSessionFilesDetector` / `createPollingDetector`; opts.factories overrides for tests
  - Return: `{ dispose }` that iterates childDisposables with try/catch per D-18
- `src/extension.ts` — modified (+3 lines)
  - Import `createDetectorsOrchestrator` from `./detectors`
  - `const detectorsDisposable = createDetectorsOrchestrator(dispatch);` after gitDisposable
  - `try { detectorsDisposable.dispose(); } catch { /* silent */ }` in dispose chain
- `test/detectors.index.test.ts` — modified (flipped 7 todos → 8 passing tests)
  - `vi.mock("vscode", () => ({}))` minimal shim (orchestrator doesn't construct vscode types directly; children are injected)
  - `makeFakeDetector(tier)` helper — returns `{ factory, emit, disposeSpy, startSpy }`
  - `setup()` helper — wires 3 fakes + captures dispatch events into an array
  - 8 `it(...)` blocks — 0 it.todo remaining

## Decisions Made

- **Linear scan over [2, 3, 4] with break-on-first-active** — simpler to read than a priority-indexed sorted collection; Phase 5 tier-1 companion just prepends `1` to the array in one line. Iteration visible in code = easier audit when adding new tiers.
- **Label change = bare `agent-started`, no paired `agent-ended` first** — the 02-01 reducer contract treats `agent-started` with a different agent while already in AGENT_ACTIVE as an intra-state field update (agent label changes, startTimestamp preserved). Emitting end-then-start would incorrectly reset startTimestamp.
- **Orchestrator is per-tier stateful, NOT per-terminal** — per-terminal state lives in the child detectors (shellIntegration's `sessions: Map<Terminal, TerminalSession>`, sessionFiles' per-file mtime tracking, polling's `Set<Terminal>`). Duplicating it up here would create aggregation drift.
- **Defensive non-agent event forwarding** — if a child detector ever emits branch-changed / editor-* / idle-tick (which it shouldn't), forward unchanged to parent dispatch rather than silently drop. Matches D-18 defensive philosophy — surface bugs rather than mask them.
- **Task 3 executed before Task 2** — tests validate the orchestrator in isolation BEFORE it's wired into the driver, so a bug in createDetectorsOrchestrator shows up as a localized test failure rather than a regression in the Phase 2 driver test suite. No functional impact; plan's <verify> blocks both still pass.

## Deviations from Plan

### Task Ordering (Intentional, Safe)

**1. [Ordering Choice] Task 3 (tests) executed before Task 2 (extension.ts wiring)**
- **Found during:** Task 1 completion (deciding next task)
- **Rationale:** Running tests against the orchestrator before wiring it into the extension.ts driver lets bugs surface as localized test failures rather than as Phase 2 driver-test regressions. Reduces debugging cost if the orchestrator implementation has an issue.
- **Impact:** Zero — both tasks completed atomically and independently. Plan's `<done>` criteria for both still pass (Task 2 requires pnpm typecheck + pnpm test green; Task 3 requires test file green).
- **Committed in:** `6a0d191` (Task 3 tests) landed before `c9efd98` (Task 2 wiring).

### No Auto-fixes

No Rule 1 / Rule 2 / Rule 3 deviations triggered. Plan `<behavior>` and `<interfaces>` blocks matched reality precisely; child detector shapes from plans 03-01..03-03 + 03-05 composed cleanly.

---

**Total deviations:** 1 task-ordering choice (documented for transparency; zero functional impact).
**Impact on plan:** No scope creep, no interface changes, no auto-fixes. `<interfaces>` block preserved exactly. Every bullet in the plan's `<behavior>` for all three tasks implemented verbatim.

## Issues Encountered

None. No fix-attempt cycling; all three tasks cleared on first iteration after implementation pass. Baseline test count (148 pass + 7 todo) → final (156 pass + 0 todo) = exactly 8 new tests, zero regressions.

## User Setup Required

None — pure code change. Phase 3 is now functionally complete. `pnpm test` + `pnpm typecheck` + `pnpm check:api-surface` + `pnpm build` + `pnpm check:bundle-size` all green. The full Phase 3 detection pipeline (shellIntegration + sessionFiles + polling → orchestrator → driver → reducer → throttle → RPC) is wired and shippable.

## Next Phase Readiness

- **Phase 3 is DONE.** All 6 plans (00, 01, 02, 03, 04, 05) complete. Every DET requirement (DET-01..DET-10) has passing automated tests. HUMAN-UAT (SC-3.1..SC-3.8) ready for real-Cursor + real-Claude-Code sign-off against the 03-HUMAN-UAT.md checklist.
- **Phase 4 (config) unblocked** — the orchestrator's `DetectorsOrchestratorOptions` already defines `customPatterns`, `pollingPatterns`, `sessionFileStalenessSeconds` hooks. Phase 4 will:
  1. Read `detect.customPatterns` from VS Code config → pass into `createDetectorsOrchestrator`
  2. Read `detect.polling.terminalNamePatterns` → pass as `pollingPatterns`
  3. Read `detect.sessionFileStalenessSeconds` → pass as `sessionFileStalenessSeconds`
  4. Wire `onDidChangeConfiguration` → rebuild orchestrator on config change (live reload)
- **Phase 5 (companion plugin) unblocked** — will add tier-1 companion-lockfile detector; the orchestrator's tier-scan array `[2, 3, 4]` becomes `[1, 2, 3, 4]` with one line change. Companion signal will automatically take precedence over shellIntegration per the existing highest-tier-wins rule.
- **Guardrails all green:**
  - `pnpm test` — 156 pass, 0 todo (all 7 Phase 3 it.todo entries across 5 detector test files flipped; 42 Phase 2 tests still passing)
  - `pnpm typecheck` PASS
  - `pnpm check:api-surface` PASS (6 pure-core files; orchestrator correctly vscode-adapter)
  - `pnpm build` PASS (212.4 KB / 41.5% of 500 KB — up from 201 KB baseline; 11.4 KB added across all 4 Phase 3 detector modules, well under 500 KB cap)
  - `pnpm check:bundle-size` PASS

## Self-Check

- `src/detectors/index.ts` — FOUND (157 lines; exports `createDetectorsOrchestrator` + `DetectorsOrchestratorOptions`; imports all three child factories; imports vscode as `vscode.Disposable` type)
- `src/extension.ts` — MODIFIED (import of `createDetectorsOrchestrator` added; `detectorsDisposable` constructed after gitDisposable; dispose added to chain; +3 net lines — under plan's 5-line budget)
- `test/detectors.index.test.ts` — MODIFIED (8 `it(...)` passing, 0 it.todo remaining)
- Commit `60f3c36` — FOUND (feat: orchestrator implementation)
- Commit `6a0d191` — FOUND (test: flip 7 todos to 8 passing tests)
- Commit `c9efd98` — FOUND (feat: wire orchestrator into extension.ts)
- `pnpm typecheck` — PASS
- `pnpm test` — 156 pass, 0 todo, 12 test files
- `pnpm check:api-surface` — PASS (6 pure-core; orchestrator correctly vscode-adapter)
- `pnpm build` — PASS (212.4 KB / 41.5% of 500 KB)
- `pnpm check:bundle-size` — PASS

## Self-Check: PASSED

---
*Phase: 03-agent-detection*
*Completed: 2026-04-14*
