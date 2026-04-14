---
phase: 03-agent-detection
fixed_at: 2026-04-14T00:00:00Z
review_path: .planning/phases/03-agent-detection/03-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-04-14
**Source review:** `.planning/phases/03-agent-detection/03-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (0 Critical + 2 Warning; Info deferred per `fix_scope=critical_warning`)
- Fixed: 2
- Skipped: 0

Scope note: the 6 Info findings (IN-01 through IN-06) are intentionally NOT
addressed in this iteration per the orchestrator's `critical_warning` scope.
They remain open in `03-REVIEW.md` for a future pass.

Test impact: baseline 156 tests → 159 tests after fixes (all passing). The
3 new tests cover the WR-01 future-mtime clamp (far-future stale, <=1s
forward-skew tolerance, and just-past-1s boundary).

## Fixed Issues

### WR-01: Future-mtime (clock skew or touched-future file) counts as active indefinitely

**Files modified:** `src/detectors/sessionFiles.ts`, `test/detectors.sessionFiles.test.ts`
**Commits:** `b39d10f` (source fix), `2d94c88` (test coverage)
**Applied fix:** Replaced the bare staleness predicate `nowMs - mtimeMs < thresholdMs`
with an absolute-delta bound. Computed `age = nowMs - mtimeMs` and required
`age >= -1000 && age < thresholdMs` so a file whose mtime is more than 1s in
the future (clock skew, NFS / Samba, restored backup, deliberate `touch -t`)
no longer counts as fresh indefinitely. Added 3 tests: `+60s` future mtime
is stale, `+500ms` within tolerance is fresh, `+1500ms` past tolerance is stale.

### WR-02: `dirPollTimer` bypasses the injected clock — Linux dir-appearance path is hard to test and hard-codes the real `setInterval`

**Files modified:** `src/detectors/sessionFiles.ts`
**Commit:** `6519352`
**Applied fix:** Added `setInterval`, `clearInterval`, `setTimeout`, `clearTimeout`
to `SessionFilesDetectorOptions` and threaded them through the module-local
`setIntervalFn` / `clearIntervalFn` / `setTimeoutFn` / `clearTimeoutFn` bindings
(mirroring the existing pattern in `src/detectors/polling.ts`). Replaced all
five call sites — the debounce `setTimeout`/`clearTimeout` in `onWatchEvent`,
the two `setInterval(rescan, ...)` calls in `beginWatching` (Linux poll +
watch-throw fallback), the `clearInterval(dirPollTimer)` in `checkAndStart`,
the `setInterval(checkAndStart, ...)` at startup, and all three cleanup
branches in the `Disposable`. The 11 existing sessionFiles tests continue
to pass because `vi.useFakeTimers()` monkey-patches `globalThis.setInterval`
(the default fallback) — so no test-surface change was needed, but future
consumers injecting `now` without faking timers will now get a consistent
clock.

---

_Fixed: 2026-04-14_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
