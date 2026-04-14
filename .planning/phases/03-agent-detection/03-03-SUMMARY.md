---
phase: 03-agent-detection
plan: "03"
subsystem: detectors

tags: [polling, tier-4, empty-by-default, zero-false-positive, wave-1, terminal-name-patterns]

# Dependency graph
requires:
  - phase: 03-agent-detection
    provides: plan 03-00 scaffolding — `test/detectors.polling.test.ts` with 5 it.todo stubs
  - phase: 02-core-pipeline
    provides: `Event` union (`agent-started` / `agent-ended`) in `src/state/types.ts`
provides:
  - `createPollingDetector(opts)` returning `{ tier: 4, start(dispatch): vscode.Disposable }`
  - DET-06 zero-false-positive short-circuit: empty patterns → no setInterval registered, no iteration, no dispatches
  - Auto-anchored (`^`) regex compile with silent-drop on invalid source (D-18)
  - Aggregate 0↔N transition dispatch (never per-terminal fan-out)
  - Per-terminal active `Set<vscode.Terminal>` tracking for close / rename detection
  - 10 passing assertions replacing 5 it.todo entries
affects: [03-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injectable setInterval/clearInterval/getTerminals surface — detector is fully testable without touching real vscode or real timers"
    - "Empty-array short-circuit BEFORE any side-effect construction — prevents idle CPU on default config installs"
    - "Aggregate transition dispatch (0↔N) delegates per-terminal discrimination to the orchestrator (plan 03-04)"
    - "vi.mock('vscode', () => ({})) — minimal shim when the detector only uses vscode for the Terminal *type* via injected getTerminals (no runtime constructors needed)"

key-files:
  created:
    - src/detectors/polling.ts
  modified:
    - test/detectors.polling.test.ts

key-decisions:
  - "Short-circuit on empty patterns runs BEFORE compile/setInterval/Set allocation — Pitfall 5 from RESEARCH. Default config = literally zero runtime cost."
  - "Auto-anchor with plain `^` prepend (not escaping) so user writes `Claude Code` and gets `^Claude Code` — same DX as regex.ts DET-10 handling."
  - "Invalid regex sources silent-drop at compile time (D-18) — detector keeps polling with any still-valid patterns rather than throwing at start()."
  - "Aggregate dispatch on 0↔N transitions only; multiple matching terminals do NOT fan out multiple agent-started events. The orchestrator (plan 03-04) owns per-terminal aggregation; this tier contributes a single 'any terminal name matches' signal."
  - "setInterval/clearInterval/getTerminals all injectable — test determinism without patching globals. Mirrors the options-bag pattern established by plan 03-02's sessionFiles detector."

patterns-established:
  - "Empty-config short-circuit: opt-in detectors with empty defaults MUST exit start() before any timer/Set allocation"
  - "Aggregate-only dispatch contract for tiers 3 and 4: transitions fire on fleet flip, not per-terminal"
  - "Silent-drop (D-18) at regex compile boundary for user-supplied patterns — matches regex.ts buildMatcher precedent"

requirements-completed: [DET-06]

# Metrics
duration: ~2 min
completed: 2026-04-14
---

# Phase 03 Plan 03: Tier-4 Polling Detector Summary

**Tier-4 last-resort detector polling `vscode.window.terminals` every 5 s against user-supplied regex sources; DET-06 zero-false-positive guarantee — empty default patterns means the detector allocates nothing, registers no timer, dispatches nothing; 10 tests flipped from 5 it.todo stubs.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-14T23:02:41Z
- **Completed:** 2026-04-14T23:04:39Z
- **Tasks:** 2
- **Files created:** 1 (`src/detectors/polling.ts`, 136 lines — exceeds plan's 100-line soft target; under the project 200-line hard cap. See Deviations.)
- **Files modified:** 1 (`test/detectors.polling.test.ts`, 166 lines)

## Accomplishments

- `src/detectors/polling.ts` authored — `createPollingDetector(opts)` returning `{ tier: 4, start(dispatch) }`. Covers every bullet in plan `<behavior>`: empty-patterns short-circuit, auto-anchor, silent-drop, 5 s interval, per-terminal Set tracking, aggregate 0↔N dispatch, clean dispose.
- 10 passing assertions in `test/detectors.polling.test.ts` — 5 original it.todo entries expanded per the plan's `<behavior>` block (plan spec'd 10 test cases; stub had 5 todos because it was authored earlier with a smaller surface).
- `pnpm typecheck` PASS, `pnpm test` 116 pass + 17 todo (17 remaining are plans 03-01 / 03-04), `pnpm check:api-surface` PASS (6 pure-core files; polling.ts NOT pure-core — vscode import allowed), `pnpm build` PASS (201.0 KB / 40.2% of 500 KB), `pnpm check:bundle-size` PASS.
- DET-06 zero-false-positive guarantee verified two ways: (1) `setIntervalSpy` proves no timer registration when patterns empty; (2) `advanceTimersByTime(60_000)` + assertion on empty events array proves no dispatches ever fire.

## Task Commits

1. **Task 1 (feat): Implement tier-4 polling detector** — `73beed4`
2. **Task 2 (test): Flip 5 it.todo entries to 10 passing tests** — `64d0bd0`

## Files Created/Modified

- `src/detectors/polling.ts` — new module (136 lines)
  - `PollingDetectorOptions` / `PollingDetector` interfaces matching plan `<interfaces>`
  - `createPollingDetector(opts)` returning `{ tier: 4, start(dispatch) }`
  - Internal logic: compile patterns with try/catch silent-drop, `activeSet: Set<vscode.Terminal>`, tick callback that does add-new / remove-stale / aggregate-transition dispatch
  - Constants: `DEFAULT_INTERVAL_MS = 5000`, `DEFAULT_AGENT = "claude"`
- `test/detectors.polling.test.ts` — flipped (166 lines total)
  - `vi.mock("vscode", () => ({}))` minimal shim (detector uses vscode only for the Terminal *type*; runtime is fully injected)
  - `makeFakeTerminal(name)` helper returning `{ name }` — structural typing via `as unknown as vscode.Terminal`
  - `startDetector(patterns)` helper wrapping the common test setup
  - 10 `it(...)` blocks — no `it.todo` or `it.skip` remaining in this file

## Decisions Made

- **Short-circuit on empty patterns runs BEFORE any allocation** — the plan `<behavior>` explicitly calls out "Do NOT register a setInterval. Do NOT iterate terminals. Do NOT dispatch." This is the DET-06 zero-false-positive contract for users on the default config. Every keystroke of `setInterval`, `new RegExp`, `new Set` appears AFTER the `if (patterns.length === 0) return { dispose: (): void => {} };` line.
- **Silent-drop on invalid regex (D-18)** — users may typo a pattern (`[unclosed`). The detector wraps `new RegExp("^" + p)` in try/catch per pattern so one bad entry doesn't kill the others. No error surface is exposed; the user sees "my pattern didn't match" and can correct it.
- **Aggregate 0↔N transitions only** — plan `<behavior>` and Pitfall 2 explicitly say "Do NOT dispatch one agent-started per matching terminal". The active-set size before and after each tick determines whether to fire. Two matching terminals arriving simultaneously → one `agent-started` (set went 0→2). Only the removal of the last matching terminal triggers `agent-ended`.
- **`vi.mock("vscode", () => ({}))`** — simpler than sessionFiles.ts's shim, which needed a Disposable class. Polling.ts returns a plain `{ dispose }` object directly (no `new vscode.Disposable(...)`), and tests inject `getTerminals` so the runtime never touches `vscode.window.terminals`. Empty-object mock suffices.
- **`startDetector()` test helper** — every test follows the same pattern (build options with spies + getTerminals, call start, capture events). Extracting the helper kept each `it(...)` block to ~5-10 lines of intent-revealing assertions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] Stub file had 5 it.todo; plan `<behavior>` specifies 10 test cases**
- **Found during:** Task 2 (reading plan vs existing stub)
- **Issue:** Wave 0 stub (`test/detectors.polling.test.ts` from plan 03-00) listed 5 todos, but the plan 03-03 `<behavior>` block enumerates 10 distinct test cases covering DET-06 exhaustively: empty default (both `[]` and `undefined` forms), 5 s interval verification, per-dispatch scenarios, no-double-dispatch, silent-drop, dispose, multi-terminal aggregation (both 0→N and N→0 ends). Flipping only the 5 stub todos would leave DET-06 under-sampled by Nyquist.
- **Fix:** Wrote all 10 test cases per plan `<behavior>`. The stub's 5 topic areas are all covered, plus 5 additional cases closing the coverage gap.
- **Files modified:** `test/detectors.polling.test.ts`
- **Verification:** `pnpm test test/detectors.polling.test.ts` — 10 pass, 0 todo remaining
- **Committed in:** `64d0bd0`

### File Size Deviation (Documented for Transparency)

**2. [File-size soft target exceeded] polling.ts is 136 lines vs plan's 100-line target**
- **Found during:** Task 1 (after implementation)
- **Issue:** Plan `<behavior>` specifies "File size: target ≤ 100 lines". Final file is 136 lines — 36 over. The extra lines are: the JSDoc header (~25 lines documenting DET-06 / Pitfall 5 / aggregation rule / D-18), the `PollingDetectorOptions` / `PollingDetector` interfaces (~30 lines with JSDoc per field), and defensive try/catch around the compile / tick / clearInterval blocks. Logic density is ~60 lines of real code.
- **Fix:** None — the extra lines are documentation, type interfaces (which the plan `<interfaces>` block already specified), and D-18 defensive programming. Stripping any of them would be net-negative. The 200-line hard split rule from PROJECT.md applies to logic density; JSDoc + interface declarations + try/catch wrappers don't trigger a natural split.
- **Files modified:** `src/detectors/polling.ts`
- **Impact:** None on correctness or guardrails. Same pattern as plan 03-02 (sessionFiles.ts 225 lines vs 180 target).
- **Noted in:** `73beed4` commit — logic surface is still well under any split threshold.

---

**Total deviations:** 1 auto-fixed (Rule 2 — test coverage gap closed) + 1 soft-target overage documented for transparency.
**Impact on plan:** No scope creep, no interface changes. `<interfaces>` block preserved exactly. Plan `<behavior>` fully implemented including the 10 test cases the stub couldn't anticipate at Wave 0 authoring time.

## Issues Encountered

None beyond the deviations above. No fix-attempt cycling; both tasks cleared on first iteration after the implementation pass.

## User Setup Required

None — pure code change. Detector will be wired into the orchestrator by plan 03-04 via `config.detect.polling.terminalNamePatterns` (default `[]`). No `package.json` `contributes.configuration` changes needed in this plan — Phase 4 config plans own that surface.

## Next Phase Readiness

- **Plan 03-04 (orchestrator) unblocked for tier-4 wiring** — `createPollingDetector({ patterns: config.detect.polling.terminalNamePatterns })` returns the `{ tier: 4, start(dispatch) }` shape the orchestrator consumes. Empty patterns (default) result in a disposable no-op detector — orchestrator adds it to the tier list without runtime cost.
- **All guardrails green:** `pnpm test` (116 pass + 17 todo), `pnpm typecheck`, `pnpm check:api-surface` (6 pure-core files, polling.ts correctly NOT in pure-core), `pnpm build` (201.0 KB / 40.2% of 500 KB), `pnpm check:bundle-size` PASS.
- **DET-06 behaviorally locked:** adding this detector to the orchestrator chain cannot introduce CPU overhead for users on the default config — the empty-patterns short-circuit test proves no setInterval is registered.
- **Plans 03-01 (shellIntegration.ts) and 03-04 (orchestrator) remain.** Their it.todo stubs (10 + 7 = 17) are untouched.

## Self-Check

- `src/detectors/polling.ts` — FOUND (136 lines; empty-patterns short-circuit on line 72; no readFileSync; vscode runtime import allowed — not in PURE_CORE_PATHS)
- `test/detectors.polling.test.ts` — FOUND (166 lines; 10 `it(...)` passing, 0 it.todo remaining)
- Commit `73beed4` — FOUND (feat: tier-4 polling detector)
- Commit `64d0bd0` — FOUND (test: flip 5 todos to 10 passing tests)
- `pnpm typecheck` — PASS
- `pnpm test` — 116 pass + 17 todo (17 remaining are plans 03-01/03-04)
- `pnpm check:api-surface` — PASS (6 pure-core files; polling.ts correctly vscode-adapter)
- `pnpm build` — PASS (201.0 KB / 40.2% of 500 KB)
- `pnpm check:bundle-size` — PASS

## Self-Check: PASSED

---
*Phase: 03-agent-detection*
*Completed: 2026-04-14*
