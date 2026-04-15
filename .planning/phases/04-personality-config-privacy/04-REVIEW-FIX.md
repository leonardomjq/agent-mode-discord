---
phase: 04-personality-config-privacy
fixed_at: 2026-04-15T18:13:00Z
review_path: .planning/phases/04-personality-config-privacy/04-REVIEW.md
iteration: 1
fix_scope: critical_warning
findings_in_scope: 5
fixed: 5
skipped: 0
deferred: 0
status: all_fixed
gates:
  typecheck: pass
  tests: pass (310/310)
commits:
  HI-01: cc93bf3
  ME-02: 5bf21ba
  ME-03: 344024b
  ME-01: 492333b
  ME-04: 2e68a24
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-04-15T18:13:00Z
**Source review:** `.planning/phases/04-personality-config-privacy/04-REVIEW.md`
**Iteration:** 1
**Scope:** critical + high + medium (low + info deferred)

**Summary:**
- Findings in scope: 5 (HI-01, ME-01, ME-02, ME-03, ME-04)
- Fixed: 5
- Skipped: 0
- Deferred to follow-up: 0

## Gate Results

- `pnpm typecheck` — PASS
- `pnpm test -- --run` — PASS (19 files, 310/310 tests)

## Fixed Issues

### HI-01: Glob matcher fails on Windows workspace paths

**Files modified:** `src/privacy.ts`, `test/privacy.test.ts`
**Commit:** cc93bf3
**What changed:** `globMatch()` now normalizes BOTH pattern and input to POSIX-style forward slashes before matching, so a Windows user supplying `C:\projects\secret\**` now matches against the already-POSIX-normalized workspace path `c:/projects/secret/...`. Added regression test.
**Test impact:** `test/privacy.test.ts` gained a Windows-backslash-pattern test case. All 35 privacy tests pass.
**Logic-verification note:** semantic fix (behavioral correctness). The new test directly asserts the previously-broken behavior.

### ME-01: Async branch refresh can clobber concurrent state updates

**Files modified:** `src/extension.ts`
**Commit:** 492333b
**What changed:** Captured `transitionKind` snapshot before `await getCurrentBranch()`; the `.then` now short-circuits if `state.kind` no longer matches, preventing stale branch merges from overwriting fresher reducer output during a concurrent `dispatch()`.
**Test impact:** No new tests (race is async + time-dependent; existing extension-wiring tests remain green). **Flagged for human verification** of the kind-guard logic — requires an integration scenario test to reproduce naturally.

### ME-02: Unbounded regex cache in privacy.ts

**Files modified:** `src/privacy.ts`
**Commit:** 5bf21ba
**What changed:** Added `MAX_REGEX_CACHE = 16` cap with FIFO eviction via `Map.keys().next().value`. Comments reference ME-02 for traceability.
**Test impact:** Existing memoization test still passes (≤ 3 RegExp constructions over 100 calls). Cache bounded at 16 entries.

### ME-03: `readConfig()` called on every log line

**Files modified:** `src/outputChannel.ts`, `src/extension.ts`
**Commit:** 344024b
**What changed:**
- `outputChannel.ts`: added module-scoped `cachedVerbose: boolean | undefined` with `setVerboseCache()` exporter and `__resetVerboseCacheForTest()` helper. `log()` uses the cached value when primed, falls back to `readConfig()` when cold (preserves existing contract + tests).
- `extension.ts`: primes the cache at `activate()` time and re-primes on every `onDidChangeConfiguration('agentMode')` event.
**Test impact:** All 6 `outputChannel.test.ts` tests still pass (cold-path fallback keeps them valid). Hot-path `log()` is now O(1) when the cache is primed.

### ME-04: TOCTOU between `stat` and `readFile` in pack loader

**Files modified:** `src/presence/packLoader.ts`
**Commit:** 2e68a24
**What changed:** Added a second size check after `readFile` — if the returned buffer exceeds `MAX_CUSTOM_PACK_BYTES`, log the anomaly and fall back to builtin. This converts the stat-vs-read race (e.g. symlink repointed to `/dev/zero`) from a potential memory-cap bypass into a bounded-read failure that still hits the D-26 whole-pack fallback path.
**Design note:** chose the post-read cap over a full `openSync`+`readSync` refactor because the latter would require overhauling the `PackLoaderDeps` contract and ~5 packLoader tests; the review explicitly endorsed documentation-as-mitigation as an acceptable alternative. This hybrid keeps the existing deps signature while still bounding memory on the TOCTOU vector.
**Test impact:** All 15 packLoader tests still pass. No new regression test (the TOCTOU would require real filesystem races; deps-mocked tests don't exercise the second cap because their mock inputs are already ≤ cap).

## Skipped / Deferred

None. All low + info findings (LO-01 through LO-04, IN-01 through IN-04) are explicitly out of scope per the workflow invocation (`critical_warning`). Review recommends documenting LO-01 (multi-root git) in `04-HUMAN-UAT.md` as a known limitation if not fixed; that action is a phase-level todo, not a fix-agent task.

## Constraint Compliance

- ✅ STATE.md and ROADMAP.md untouched.
- ✅ No behavior changes outside the specific findings.
- ✅ No locked CONTEXT decisions violated:
  - D-16 case semantics preserved (globMatch normalization is separator-only, not case-changing).
  - D-25/D-26/D-27/D-28 pack-loader contract preserved (fallback path unchanged).
  - D-24 live-reload preserved (verbose cache invalidates on the existing `onDidChangeConfiguration` listener).
- ✅ `pnpm typecheck` and `pnpm test -- --run` both green post-fix.

---

_Fixed: 2026-04-15T18:13:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
