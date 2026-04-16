---
phase: 05-companion-plugin-oss-hygiene-assets-readme
plan: "01"
subsystem: detectors
tags:
  - companion
  - tier-1
  - lockfile
  - fs.watchFile
  - tdd
dependency_graph:
  requires:
    - "03-04: detectors orchestrator (createDetectorsOrchestrator)"
    - "src/state/types.ts: Event type"
  provides:
    - "src/detectors/companion.ts: createCompanionDetector (tier-1 lockfile detector)"
    - "src/detectors/index.ts: TierNumber=1|2|3|4, companion wired as tier-1"
  affects:
    - "src/detectors/index.ts: orchestrator now starts companion before shellIntegration"
tech_stack:
  added:
    - "Node.js fs.watchFile (built-in, no new deps)"
  patterns:
    - "fs injection via opts.fs for hermetic unit testing"
    - "mutable clock injection via opts.now for staleness time-travel tests"
    - "TDD: RED (failing tests) → GREEN (implementation) → no refactor needed"
key_files:
  created:
    - src/detectors/companion.ts
    - test/detectors.companion.test.ts
  modified:
    - src/detectors/index.ts
    - .vscodeignore
decisions:
  - "Injected CompanionFsSurface (watchFile/unwatchFile) into opts.fs for hermetic testing — avoids vi.mock('node:fs') module-level mock which would affect other tests in the suite"
  - "Staleness test uses mutable closure clock (let currentTime) rather than creating a second detector instance — allows in-place time travel within the same active=true state"
  - "companion/** added to .vscodeignore alongside src/** and test/** — companion plugin files are install-separately artifacts, not part of the VSIX bundle"
metrics:
  duration: "~4 minutes"
  completed: "2026-04-16"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 05 Plan 01: Companion Lockfile Detector Summary

**One-liner:** fs.watchFile-based tier-1 companion lockfile detector with 5-minute orphan detection, injected into the orchestrator's [1,2,3,4] tier iteration.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Failing companion detector tests | 2269d72 | test/detectors.companion.test.ts |
| GREEN | Companion lockfile detector implementation | e76d1b1 | src/detectors/companion.ts, test/detectors.companion.test.ts |
| 2 | Wire tier-1 into orchestrator + VSIX exclusion | 4b341fc | src/detectors/index.ts, .vscodeignore |

## What Was Built

### src/detectors/companion.ts

`createCompanionDetector` factory that:
- Uses `fs.watchFile` with `{ persistent: false, interval: 1000ms }` to poll `~/.claude/agent-mode-discord.lock`
- Dispatches `agent-started` with `agent="claude"` when `curr.mtimeMs > 0` and not stale and `!active`
- Dispatches `agent-ended` with `agent="claude"` when `curr.mtimeMs === 0` (file gone) or `mtime > 5min` stale (T-05-01 orphan detection)
- `start()` returns a `vscode.Disposable` that calls `fs.unwatchFile` on dispose
- Injectable surface: `opts.lockfilePath`, `opts.pollIntervalMs`, `opts.stalenessMs`, `opts.now`, `opts.fs`

### src/detectors/index.ts

- `TierNumber` expanded from `2 | 3 | 4` to `1 | 2 | 3 | 4`
- `createCompanionDetector` imported and created as tier-1
- `recomputeAndDispatch` iterates `[1, 2, 3, 4]` — companion wins over all lower tiers when active
- `companionStalenessMs?: number` added to `DetectorsOrchestratorOptions`
- `companion?: typeof createCompanionDetector` added to `factories` type for test injection

### .vscodeignore

- `companion/**` added — companion plugin scripts are a separate install, not bundled in VSIX (D-07)

## Verification Results

| Check | Result |
|-------|--------|
| Companion tests (9 tests) | PASS |
| Full test suite (319 tests, 20 files) | PASS |
| Build (esbuild --production) | PASS |
| Bundle size | PASS — 219.2 KB / 43.8% of 500 KB limit |
| .vscodeignore contains companion/** | PASS |
| TierNumber includes 1 | PASS |

## TDD Gate Compliance

1. RED gate: `test(05-01)` commit `2269d72` — 9 failing tests (module not found)
2. GREEN gate: `feat(05-01)` commit `e76d1b1` — all 9 tests pass
3. REFACTOR: not needed — implementation is clean on first pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Staleness test used wrong design pattern**
- **Found during:** GREEN phase (1 test failing out of 9)
- **Issue:** Original staleness test created a second detector instance with fresh `active=false` state, then expected it to dispatch `agent-ended`. But the staleness → `agent-ended` path requires `active=true` first — a fresh detector has no state to flip.
- **Fix:** Rewrote the test to use a mutable closure clock (`let currentTime`), advance it past 5 minutes, then trigger the same detector's listener again. This properly exercises the state machine.
- **Files modified:** test/detectors.companion.test.ts
- **Commit:** e76d1b1 (part of GREEN commit)

**2. [Rule 2 - Missing critical functionality] CompanionFsSurface injection**
- **Found during:** Task 1 implementation
- **Issue:** The RESEARCH code example used `fs.watchFile` directly (no injection). Tests need to capture the listener without real filesystem access.
- **Fix:** Added `CompanionFsSurface` interface (`watchFile` + `unwatchFile`) to `CompanionDetectorOptions.fs`, defaulting to `node:fs`. Tests inject a `vi.fn()` fake that captures the listener for synchronous invocation.
- **Files modified:** src/detectors/companion.ts, test/detectors.companion.test.ts

## Known Stubs

None. All functionality is fully wired.

## Threat Flags

None. No new network endpoints, auth paths, or file access patterns beyond what the plan's threat model already covers (T-05-01 orphan detection implemented; T-05-02 accepted).

## Self-Check: PASSED

- [x] src/detectors/companion.ts exists
- [x] test/detectors.companion.test.ts exists (9 tests, all pass)
- [x] src/detectors/index.ts TierNumber = 1|2|3|4
- [x] .vscodeignore contains companion/**
- [x] Commit 2269d72 exists (RED)
- [x] Commit e76d1b1 exists (GREEN)
- [x] Commit 4b341fc exists (Task 2)
- [x] All 319 tests pass
- [x] Bundle size 219.2 KB < 500 KB
