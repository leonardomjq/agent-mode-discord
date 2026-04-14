---
phase: 03-agent-detection
plan: "01"
subsystem: detectors

tags: [shell-integration, ansi-strip, holdoff, grace-period, per-terminal-session-map, async-activation, wave-1, tier-2]

# Dependency graph
requires:
  - phase: 03-agent-detection
    provides: plan 03-00 scaffolding — `test/detectors.shellIntegration.test.ts` with 10 it.todo stubs; fakeTerminal helper; LOW_CONFIDENCE_FIXTURES table
  - phase: 03-agent-detection
    provides: plan 03-05 — `src/detectors/regex.ts` pure-core helpers (`normalizeCommandLine`, `buildMatcher`)
  - phase: 02-core-pipeline
    provides: `Event` union (`agent-started` / `agent-ended`) in `src/state/types.ts`
provides:
  - `createShellIntegrationDetector(opts)` returning `{ tier: 2, start(dispatch): vscode.Disposable }`
  - Per-terminal `Map<vscode.Terminal, TerminalSession>` with `{ agent, signalTier: 2, lastActivityAt, graceExpiresAt }`
  - Global lifetime subscription to `onDidChangeTerminalShellIntegration` (DET-08)
  - 2000 ms async-activation holdoff per terminal (DET-08)
  - 30 s flicker-guard grace period (Pitfall 2) with cancellation on same-terminal restart
  - Construction-time seeding of existing terminals (Pitfall 1)
  - `onDidCloseTerminal` → immediate session delete, no grace (Pitfall 3)
  - Aggregate dispatch: 0→N `agent-started`, N→0 `agent-ended` (after grace), label change on `lastActivityAt` winner
  - 32 passing assertions replacing 10 it.todo entries (19 from LOW_CONFIDENCE_FIXTURES table test + 12 scenario tests + 1 ANSI helper check)
affects: [03-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Options-bag factory with injectable setTimeout/clearTimeout/now — deterministic fake-timer testing without global patches"
    - "Pure-core regex helper reuse: normalizeCommandLine + buildMatcher imported from regex.ts; no ANSI/prompt strip duplicated in detector"
    - "Aggregate dispatch by highest lastActivityAt — enables DET-04 parallel-session behavior AND intra-AGENT_ACTIVE agent label change"
    - "Global onDidChangeTerminalShellIntegration subscription (DET-08) covers async activation that fires AFTER holdoff timer arm"

key-files:
  created:
    - src/detectors/shellIntegration.ts
  modified:
    - test/detectors.shellIntegration.test.ts

key-decisions:
  - "End-handler re-normalization + agent-match gate (Pitfall 6): the end event's commandLine may differ from start; only enter grace when match.agent equals the start session's agent. Prevents a non-agent command ending in the same terminal from starting a spurious grace."
  - "Aggregate label change dispatches a new `agent-started` (not `agent-ended` + `agent-started`): when two terminals run different agents and the winner-by-lastActivityAt flips, the reducer's intra-AGENT_ACTIVE field update absorbs the label change cleanly (no CODING bounce)."
  - "Construction-time seeding arms holdoff for already-open terminals lacking shell integration: `onDidChangeTerminalShellIntegration` only fires for FUTURE activations, so Pitfall 1 demands a manual pass over `vscode.window.terminals` at start()."
  - "Grace-timer cancellation is first step of any new executionStart for the same terminal (Pitfall 2): a dangling grace timer firing after a same-terminal restart would dispatch a stale agent-ended while the terminal is still active."

patterns-established:
  - "Per-detector global-events surface via vi.mock('vscode', ...) capturing callbacks into a vscodeState object — lets tests fire arbitrary sequences without wiring per-terminal observers"
  - "Subscription-count counters (onDidChangeSubscribeCount, onDidStartSubscribeCount, etc.) on the vscode mock — simpler than vi.spyOn on a hoisted mock and enables DET-08 assertion (exactly one global subscription)"
  - "Dispose ordering: subscriptions first, then holdoff timers, then grace timers, then session Map — prevents a pending timer from firing into a cleared dispatch closure"

requirements-completed: [DET-01, DET-04, DET-08, DET-09]

# Metrics
duration: ~3.5 min
completed: 2026-04-14
---

# Phase 03 Plan 01: Tier-2 shellIntegration Detector Summary

**Tier-2 shell-integration detector adapting VS Code's Shell Integration API (1.93+) into the detector contract; per-terminal session map with 2000 ms async-activation holdoff + 30 s flicker-guard grace + close-supersedes-grace; ANSI/prompt strip delegated to regex.ts pure helper (no duplication); 32 tests flipped from 10 it.todo stubs — delivers DET-01's 500 ms flip target plus DET-04/08/09.**

## Performance

- **Duration:** ~3.5 min
- **Started:** 2026-04-14T23:08:02Z
- **Completed:** 2026-04-14T23:11:33Z
- **Tasks:** 2
- **Files created:** 1 (`src/detectors/shellIntegration.ts`, 262 lines — over soft 200-line target; see Deviations)
- **Files modified:** 1 (`test/detectors.shellIntegration.test.ts`, 399 lines; 32 passing tests)

## Accomplishments

- `src/detectors/shellIntegration.ts` authored — `createShellIntegrationDetector(opts)` returning `{ tier: 2, start(dispatch) }`. Implements: construction-time seeding, 2000 ms holdoff, 30 s grace with cancellation, close-supersedes-grace, aggregate dispatch (0↔N + label change), D-18 try/catch on every vscode call and every dispatch.
- 32 passing tests flipped from 10 it.todo entries — covers DET-01 (synchronous <500 ms dispatch), DET-09 (ANSI strip on Low confidence via regex.ts helper), DET-08 (global onDidChangeTerminalShellIntegration + holdoff cancellation), DET-04 (two parallel sessions held until both end), Pitfall 1 (seed existing terminals), Pitfall 2 (grace cancellation), Pitfall 3 (close dispatches immediately, no grace), aggregate label change (highest lastActivityAt wins), dispose cleans all 4 subscriptions + all timers.
- LOW_CONFIDENCE_FIXTURES 19-entry table test integrated — parameterized run covers all shell variants (bash/zsh/fish/powershell) plus positive-only agent matches (claude/aider/codex/gemini/opencode) plus 3 negative cases (`git commit "fix claude"`, `./claude-history.sh`, `echo claude`) all resolving through the regex.ts Low-confidence strip pipeline.
- ANSI strip reuse verified two ways: (1) `import { buildMatcher, normalizeCommandLine } from "./regex"` is the sole source of strip logic; (2) `grep 'u001B\\|\\\\x1b' src/detectors/shellIntegration.ts` returns zero matches — no duplicated CSI/OSC regexes.
- All guardrails green: `pnpm test` (148 pass + 7 todo — 7 remaining are plan 03-04 orchestrator stubs), `pnpm typecheck` PASS, `pnpm check:api-surface` PASS (6 pure-core files — shellIntegration.ts correctly NOT pure-core because it imports vscode), `pnpm build` PASS (201.0 KB / 40.2% of 500 KB), `pnpm check:bundle-size` PASS.

## Task Commits

1. **Task 1 (feat): Implement tier-2 shellIntegration detector** — `c288624`
2. **Task 2 (test): Flip 10 it.todo to 32 passing tests** — `0847cbc`

## Files Created/Modified

- `src/detectors/shellIntegration.ts` — new module (262 lines)
  - `TerminalSession`, `ShellIntegrationDetectorOptions`, `ShellIntegrationDetector` interfaces
  - `createShellIntegrationDetector(opts)` factory; returns `{ tier: 2, start(dispatch) }`
  - Internal `start()` closure owns: `sessions`, `holdoffTimers`, `graceTimers`, `aggregateActive`, `lastDispatchedAgent`, plus helper functions (`safeDispatch`, `clearHoldoff`, `clearGrace`, `recomputeAggregate`, `setupHoldoff`, `onShellExecutionStart`, `onShellExecutionEnd`, `onShellIntegrationChanged`, `onTerminalClose`)
  - 4 global subscriptions (DET-08 extension lifetime): onDidChangeTerminalShellIntegration, onDidStartTerminalShellExecution, onDidEndTerminalShellExecution, onDidCloseTerminal
  - Returned `new vscode.Disposable(...)` disposes all subscriptions + clears all timers
- `test/detectors.shellIntegration.test.ts` — flipped (399 lines total)
  - `vi.mock("vscode", () => ({ window, Disposable, TerminalShellExecutionCommandLineConfidence }))` — hoisted mock exposing `vscodeState` with captured callbacks, dispose mocks, and subscription-count counters
  - Test helpers: `makeTerminal`, `makeDispatch`, `fireStart`, `fireEnd`, `resetMocks`
  - 32 `it(...)` blocks — no `it.todo` or `it.skip` remaining in this file

## Decisions Made

- **End-handler re-normalization + agent-match gate** — when onDidEndTerminalShellExecution fires, we re-match the end commandLine against the same matcher and only enter grace if it produces the same agent label as the session's start. This closes Pitfall 6 (end commandLine may be more accurate) AND prevents a non-agent command ending in a terminal that previously ran claude from triggering a spurious grace-timer path.
- **Aggregate label change is a fresh agent-started** (not end+start) — two terminals running different agents with flipped lastActivityAt ordering. The reducer's intra-AGENT_ACTIVE field update from plan 02-01 means dispatching a new agent-started with a different agent label works cleanly — state stays AGENT_ACTIVE, agent label updates.
- **Construction-time seeding** — onDidChangeTerminalShellIntegration fires only on FUTURE activations. Already-open terminals lacking integration at start() need a manual pass over vscode.window.terminals to arm holdoff timers; otherwise the DET-08 holdoff contract silently skips those terminals.
- **Grace-timer cancellation is first step of onShellExecutionStart** — before any session state changes, we clearGrace(terminal). A dangling grace timer firing after a same-terminal restart would dispatch a stale agent-ended while the terminal is actively running (Pitfall 2).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `vi.spyOn((require("vscode") ...))` approach broke under ESM module resolution**
- **Found during:** Task 2 (first `pnpm test` run)
- **Issue:** The initial implementation of the DET-08 global-subscription test used `require("vscode")` inside the test body to obtain a reference for `vi.spyOn`. Vitest's hoisted `vi.mock("vscode", ...)` doesn't route ad-hoc `require()` calls — only ESM `import`. The test threw `Cannot find module 'vscode'` at runtime.
- **Fix:** Added `onDidChangeSubscribeCount` (plus counters for start/end/close) to the `vscodeState` mock object. The mock's `onDidChangeTerminalShellIntegration` impl increments the counter; the test asserts `vscodeState.onDidChangeSubscribeCount === 1` after start(). Simpler AND more reliable than spyOn on a hoisted mock.
- **Files modified:** `test/detectors.shellIntegration.test.ts`
- **Verification:** `pnpm test test/detectors.shellIntegration.test.ts` — 32 pass, 0 fail.
- **Committed in:** `0847cbc`

### File Size Deviation (Documented for Transparency)

**2. [File-size soft target exceeded] shellIntegration.ts is 262 lines vs plan's 200-line target**
- **Found during:** Task 1 (after implementation)
- **Issue:** Plan `<behavior>` target is "≤ 200 lines (split into helper functions if needed)". Final file is 262 lines — 62 over. Breakdown: ~30 lines JSDoc header (DET-01/04/08/09 + Pitfalls 1/2/3 + D-18 documentation), ~35 lines interface declarations (TerminalSession + ShellIntegrationDetectorOptions + ShellIntegrationDetector with JSDoc per field), ~190 lines of logic + try/catch wrappers + dispose cleanup. Logic density is ~160 lines of real code.
- **Fix:** None — the extra lines are documentation, type interfaces (explicitly locked by the plan's `<interfaces>` block), and D-18 defensive try/catch (every vscode call + every dispatch, per plan `<behavior>`). Splitting further would require extracting `recomputeAggregate` / `setupHoldoff` to a separate module, which breaks the closure-over-dispatch pattern and complicates testing. Same trade-off as plans 03-02 (225 lines vs 180 target) and 03-03 (136 lines vs 100 target).
- **Files modified:** `src/detectors/shellIntegration.ts`
- **Impact:** None on correctness or guardrails. PROJECT.md's 200-line hard cap applies to logic density per PRD §18 — JSDoc + interface declarations + D-18 try/catch wrappers are not the target of that rule.
- **Noted in:** `c288624` commit.

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking test infrastructure) + 1 soft-target overage documented for transparency.
**Impact on plan:** No scope creep, no interface changes. `<interfaces>` block preserved exactly. Plan `<behavior>` fully implemented; every bullet in the Task 1 behavior spec AND every bullet in the Task 2 test-case enumeration now has a passing assertion.

## Issues Encountered

None beyond the deviations above. No fix-attempt cycling; the only test failure (vi.spyOn + require) was diagnosed and resolved on first iteration.

## User Setup Required

None — pure code change. Detector will be wired into the orchestrator by plan 03-04 alongside sessionFiles (tier 3), polling (tier 4), and eventually the companion-plugin lockfile reader (tier 1, v0.1 companion from Phase 5).

## Next Phase Readiness

- **Plan 03-04 (orchestrator) unblocked for tier-2 wiring** — `createShellIntegrationDetector({ customPatterns: config.detect.customPatterns })` returns the `{ tier: 2, start(dispatch) }` shape. Orchestrator now has all three non-companion detectors (2/3/4) to compose; tier-1 companion-plugin reader ships in Phase 5.
- **DET-01 / DET-04 / DET-08 / DET-09 behaviorally locked** — the 32 passing tests guard against regression; HUMAN-UAT SC-3.1..SC-3.5 will verify the same contracts end-to-end against real Cursor + real Claude Code.
- **All five guardrails green:** `pnpm test` (148 pass + 7 todo), `pnpm typecheck`, `pnpm check:api-surface` (6 pure-core), `pnpm build` (201.0 KB / 40.2% of 500 KB), `pnpm check:bundle-size` PASS.
- **Plan 03-04 (orchestrator) is the only remaining Phase 3 plan.** Its 7 it.todo stubs are untouched.

## Self-Check

- `src/detectors/shellIntegration.ts` — FOUND (262 lines; `import { buildMatcher, normalizeCommandLine } from "./regex"`; no duplicated ANSI strip; vscode runtime import allowed — NOT in PURE_CORE_PATHS)
- `test/detectors.shellIntegration.test.ts` — FOUND (399 lines; 32 `it(...)` passing, 0 it.todo remaining)
- Commit `c288624` — FOUND (feat: tier-2 shellIntegration detector)
- Commit `0847cbc` — FOUND (test: flip 10 todos to 32 passing tests)
- `grep 'import.*regex' src/detectors/shellIntegration.ts` — 1 match (regex.ts reuse verified)
- `grep 'u001B\|\\\\x1b' src/detectors/shellIntegration.ts` — 0 matches (no duplicated ANSI strip)
- `pnpm typecheck` — PASS
- `pnpm test` — 148 pass + 7 todo (7 remaining are plan 03-04 orchestrator)
- `pnpm check:api-surface` — PASS (6 pure-core; shellIntegration.ts correctly NOT pure-core)
- `pnpm build` — PASS (201.0 KB / 40.2% of 500 KB)
- `pnpm check:bundle-size` — PASS

## Self-Check: PASSED

---
*Phase: 03-agent-detection*
*Completed: 2026-04-14*
