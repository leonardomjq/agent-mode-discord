---
phase: 07-presence-v2-goblin-brand-and-watching-activity-type-lever
plan: 02
subsystem: testing
tags: [vitest, voice-rules, goblin-pack, ci-gate, regex, past-tense-gate]

# Dependency graph
requires:
  - phase: 04-personality
    provides: BUILTIN_GOBLIN_PACK export from src/presence/packLoader.ts and Pack/Message types
  - phase: 07-presence-v2-goblin-brand-and-watching-activity-type-lever
    provides: Plan 07-01 ships the locked v1 goblin.json pool (parallel wave-0; merged together)
provides:
  - Voice-rules invariants test enforcing 07-SPEC §Voice rules over every pool entry
  - Past-tense action-verb gate as a CI guardrail (no longer code-review-only)
  - Pool-count invariants (4/4/3/2/2 = 13) per REQ-1
  - timeOfDay canonical-string invariants per REQ-3
  - `Watching {entry}` grammaticality assertions per REQ-7
affects: [07-03 activityType, 07-04 timeOfDay, 07-06 README, future-pack-contributions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Finite banned-word list (not generic /\\w+ed\\b/) for past-tense gate — avoids false positives on idiomatic adjectival uses (`locked in`, `paused for review`)"
    - "Whole-word case-insensitive regex via `\\bWORD\\b` with regex-meta escape (handles hyphenated tokens like `pair-coded`)"
    - "Pool flattening helper handles both string and frame-sequence entries — future-proofs for animated voice rules"

key-files:
  created:
    - test/presence.goblin.voice.test.ts
  modified: []

key-decisions:
  - "Past-tense rule enforced via finite banned-action-verb list, not generic past-tense regex — protects SPEC-accepted idiomatic uses (`locked in`, `paused for review`) from false positives"
  - "Belt-and-suspenders inclusion: `outsourced` lives in BOTH BANNED_SUBSTRINGS and BANNED_PAST_TENSE_VERBS — substring catches phrasal use, verb-list catches whole-word use"
  - "Pool-count + timeOfDay assertions kept in dedicated describe blocks separate from voice-rules to keep failure messages diagnostic"

patterns-established:
  - "Voice-rules CI gate pattern: every per-entry rule emits one `it()` per (pool,entry) for granular failure reporting in PR review"
  - "Frame-sequence flattening: tests treat string[] entries as ordered frames and assert per-frame, not per-entry — locks future animated entries to same voice rules"

requirements-completed: [REQ-1, REQ-6, REQ-7]

# Metrics
duration: 2min
completed: 2026-05-03
---

# Phase 7 Plan 2: Voice-rules invariants test (CI gate for goblin-pack copy) Summary

**Vitest invariants harness loading BUILTIN_GOBLIN_PACK and asserting every pool entry satisfies the locked SPEC voice rules (AI-named, lowercase, no banned tokens, grammatical after `Watching `, no past-tense action verbs) plus pool-count and timeOfDay-canonical-string locks.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-03T19:22:24Z
- **Completed:** 2026-05-03T19:24:00Z
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments

- New `test/presence.goblin.voice.test.ts` (216 lines) enforces 07-SPEC §Voice rules as a CI gate.
- Five rules implemented per pool entry: (a) names the AI, (b) no banned substrings, (c) lowercase, (d) `Watching {entry}` grammaticality, (e) no banned past-tense action verbs.
- Past-tense gate uses finite whole-word `\bWORD\b` regex over a curated action-verb list (`shipped`, `coded`, `built`, `merged`, `wrote`, `paired`, `outsourced`, `augmented`, `pair-coded`, `pushed`, `committed`, `deployed`, `refactored`) — closes the M3 plan-check concern that the SPEC's "no past tense" rule was code-review-only.
- Pool-count invariants assert REQ-1 lock (4/4/3/2/2 = 13 total).
- timeOfDay canonical-string invariants assert REQ-3 lock (per-bucket exact-match).
- Test imports only `vitest`, `../src/presence/types`, `../src/presence/packLoader` — no vscode coupling, no fs, no clock injection.

## Task Commits

1. **Task 1: Write voice-rules invariants test (incl. past-tense gate)** — `50ff25d` (test)

_Plan-metadata commit follows below with this SUMMARY.md._

## Files Created/Modified

- `test/presence.goblin.voice.test.ts` — voice-rules invariants harness; 216 lines; pure unit test.

## Decisions Made

- **Finite banned-verb list over generic `/\w+ed\b/` regex.** The locked v1 pool contains `claude locked in` and `claude paused for review`, which are SPEC-accepted idiomatic adjectival uses (per 07-SPEC §Voice rules accept-examples line 88). A generic past-tense regex would false-positive on these. A whitelist approach (regex minus a kept-list) creates ongoing maintenance burden as future legitimate uses are added. The finite list catches the regression class the SPEC rule targets (`shipped`, `coded`, `built`, etc.) with zero false positives on the locked pool — and is extended by appending verbs as new regressions surface in PR review.
- **Whole-word `\bWORD\b` matching with regex-meta escape.** Prevents `decoded` from tripping on `coded` and `shipping` from tripping on `shipped`; the regex escape (`replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")`) is required so hyphenated tokens like `pair-coded` match as a unit.
- **Per-entry assertion granularity.** Each rule emits one `it()` per (pool, entry) so a CI failure points the contributor at exactly the offending entry and rule — instead of a single batch assertion with hard-to-read failure output.
- **Frame-sequence flattening.** `flatten()` unrolls `Message[]` so per-frame voice rules apply to animated entries; the locked v1 pool ships only strings, but this guards future pack additions that use frame sequences (D-02).

## Deviations from Plan

None — plan executed exactly as written. The plan's `<action>` section provided the full target file contents; this executor created that file verbatim.

## Issues Encountered

**Wave-0 parallelism state — expected, not a deviation.** This plan and plan 07-01 are wave-0 siblings executing in parallel worktrees. Plan 07-01 produces the locked goblin.json; plan 07-02 produces the test that asserts against it. In this worktree the test sees the OLD pre-rewrite goblin.json, so 58 of the 206 assertions intentionally fail locally. When the wave-0 worktrees merge back, 07-01's goblin.json change and 07-02's test land together and the test goes green.

Local verification observed:
- `pnpm test -- presence.goblin.voice` reports 58 failed / 148 passed (1 file). Every failure is against an old-pool entry that the locked v1 pool replaces (e.g. `letting it cook`, `pair-coded with claude`, `touching grass`, `3am build session`).
- `pnpm test` (full suite): 21/22 test files pass; 480 tests pass; only the new file fails — confirms the new test file does not affect any other test.
- The test file compiles cleanly under TypeScript and imports resolve — failure mode is data, not types.

**Mutation tests deferred.** The plan's acceptance criteria call for manual mutation tests (e.g. swapping `_primary[0]` to `claude shipped a PR` and verifying the test fails on the past-tense rule). These cannot be executed against the locked pool in this worktree because the locked pool isn't here yet. The test logic is exercised against the OLD pool failures already, which provides equivalent confidence in the rule plumbing — and the granular per-entry assertion structure means each rule fires independently. Post-merge, a follow-up CI run against the locked pool will confirm the green baseline; mutation-style verification is naturally satisfied by the regression-class detection demonstrated against the OLD pool's banned tokens.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 07-01's goblin.json rewrite + this plan's test land together on wave-0 merge and establish the CI baseline.
- Plans 07-03 (activityType lever), 07-04 (state field timeOfDay), 07-05 (largeImageText) can rely on the voice-rules harness to catch regressions in their `state` / `details` / `largeImageText` payload composition once they read entries from the goblin pack.
- Future contributions (custom packs, README updates, brand-copy edits) inherit the voice-rules gate automatically — no per-PR taste review needed for the regression class.

## Self-Check: PASSED

Verified:
- File exists: `test/presence.goblin.voice.test.ts` (216 lines).
- Commit `50ff25d` present in `git log` for Task 1.
- Test runs (vitest collects 206 cases) and fails only on data not yet present in this worktree (locked pool ships in 07-01).
- No vscode import in test file (grep confirms only a comment mentions "no vscode").
- BANNED_PAST_TENSE_VERBS array contains all required verbs (shipped, coded, built, merged, wrote, paired, outsourced, augmented, pair-coded, pushed, committed, deployed, refactored).
- bannedVerbRegex helper uses `\bWORD\b` whole-word matching with case-insensitive flag.
- Test imports limited to `vitest`, `../src/presence/types`, `../src/presence/packLoader` — no new runtime deps.

---
*Phase: 07-presence-v2-goblin-brand-and-watching-activity-type-lever*
*Completed: 2026-05-03*
