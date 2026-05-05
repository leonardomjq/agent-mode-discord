---
phase: 07-presence-v2-goblin-brand-and-watching-activity-type-lever
plan: 01
subsystem: presence
tags: [goblin-pack, copy, branding, voice-rules, json]

# Dependency graph
requires:
  - phase: 04-presence-engine
    provides: Pack v1 schema, packLoader.validatePack, esbuild static JSON inlining
provides:
  - "v2 locked goblin pool (AI-named, present-tense) replacing v1 mixed-voice pool"
  - "SPEC §3 canonical timeOfDay buckets (single entry per bucket)"
  - "Updated check-pack-inlined.mjs guardrail with v2 sentinels"
affects: [07-02-voice-rules-test, 07-activityBuilder-watching-config, future-pack-extensions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Brand-surface copy is owned by SPEC.md §Locked pool (verbatim ground truth)"
    - "CI guardrail (check-pack-inlined.mjs) uses two distinct SPEC sentinels per pool revision"

key-files:
  created: []
  modified:
    - src/presence/goblin.json
    - scripts/check-pack-inlined.mjs

key-decisions:
  - "Shipped SPEC-verbatim content (uppercase 'PR' in '... on a PR' lines) — SPEC §Voice rules accept-examples explicitly include 'claude on a PR', so PR is a SPEC-sanctioned acronym exception to the lowercase rule"
  - "Updated CI inlining guardrail sentinels alongside the pool rewrite (Rule 3) — guardrail asserted v1 strings ('letting it cook', 'the agent is cooking') that no longer exist; replaced with v2 sentinels ('claude cooking', 'the agent on a PR')"

patterns-established:
  - "Pool revision pattern: when changing goblin.json pool entries, update scripts/check-pack-inlined.mjs CANONICAL sentinels in the same commit so the inlining guardrail tracks the revision"

requirements-completed: [REQ-1, REQ-7]

# Metrics
duration: 3min
completed: 2026-05-03
---

# Phase 07 Plan 01: Replace goblin pool with locked 13-line AI-named v2 set Summary

**v2 brand-surface rewrite: src/presence/goblin.json now ships the SPEC-locked AI-named pool (claude/codex/agent, present-tense, no absence framing) plus the canonical timeOfDay buckets, with the CI inlining guardrail updated to track v2 sentinels.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-03T19:21:33Z
- **Completed:** 2026-05-03T19:24:08Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Replaced goblin.json pool entries with SPEC §"Locked pool" verbatim content (4 + 4 + 3 + 2 + 2 across the 5 pools).
- All entries name the AI explicitly (claude / codex / agent), use present-tense state, and are grammatical under both `Watching X` and `Playing goblin mode / X` prefixes (REQ-7).
- Removed every banned token (afk, pair-coded, touching grass, stepped away, agent-augmented, outsourced, vibe shipping, prompt → PR, letting it cook, between prompts, mid-brainstorm, etc.).
- Rewrote `timeOfDay` buckets to the SPEC §3 canonical strings — `3am goblin shift` / `morning service` / `afternoon shift` / `evening service` (one entry per bucket per v1 lock; pool expansion explicitly out of scope per SPEC line 144).
- Updated `scripts/check-pack-inlined.mjs` canonical sentinels to v2 strings so the esbuild-inlining CI guardrail keeps working against the new pool.
- Schema preserved (Pack v1, validatePack still passes); 332 existing tests remain green; bundle size 227 KB (well under 500 KB SKEL-04 budget).

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace goblin.json pool entries with locked 13-line set** - `27e10a2` (feat)

_Note: SUMMARY.md is committed separately by the orchestrator after this plan returns._

## Files Created/Modified
- `src/presence/goblin.json` - Replaced v1 mixed-voice pool with v2 AI-named locked pool; rewrote timeOfDay buckets to SPEC canonical strings.
- `scripts/check-pack-inlined.mjs` - Updated CANONICAL sentinels from v1 strings ('letting it cook', 'the agent is cooking') to v2 strings ('claude cooking', 'the agent on a PR') so the inlining guardrail asserts the new pool.

## Decisions Made
- **SPEC content wins over plan's verify script:** The plan's automated verify script in `<verify>` asserts `ent.length === 13` and "fully lowercase" — but the SPEC-locked content has 15 entries total (4+4+3+2+2) and includes the SPEC-accepted acronym `PR`. Shipped SPEC-verbatim content (which is the source of truth per the plan's `<action>` block: "EXACTLY this content (verbatim)") and documented the verify-script arithmetic mismatch as a deviation. The voice-rules unit test in plan 07-02 will encode the actual voice rules.
- **Guardrail sentinels updated alongside pool rewrite:** Rather than treat the failing `check:pack-inlined` as a separate task, updated the script's CANONICAL sentinels in the same commit because the guardrail's purpose (assert esbuild inlined the JSON) is preserved with the new sentinels and CI cannot be left red.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated check-pack-inlined.mjs sentinels to v2 pool**
- **Found during:** Task 1 verification (`pnpm check:pack-inlined`)
- **Issue:** The CI guardrail script asserted that the v1 strings `letting it cook` and `the agent is cooking` appear in `dist/extension.cjs`. After the pool rewrite, those strings no longer exist (they are banned tokens per SPEC voice rules), so the script failed and would have broken CI.
- **Fix:** Replaced CANONICAL sentinels with two distinct v2 SPEC-locked strings: `claude cooking` (from `claude` pool) and `the agent on a PR` (from `_primary` pool). Both are SPEC §"Locked pool" verbatim entries from different sub-pools so a partial embed still fails.
- **Files modified:** `scripts/check-pack-inlined.mjs`
- **Verification:** `pnpm check:pack-inlined` now PASSes (`2/2 canonical strings found in 226777 bytes`).
- **Committed in:** `27e10a2` (combined with Task 1 commit)

**2. [Plan typo, no code impact] Plan asserts "13 unique" entries; SPEC content has 15**
- **Found during:** Task 1 verification (running plan's `<verify>` automated script)
- **Issue:** The plan's `<verify>` block asserts `ent.length === 13` with `(4 + 4 + 3 + 2 + 2 = 13)`. That arithmetic is wrong (4+4+3+2+2=15). The SPEC §"Locked pool" lists 15 entries (4 _primary + 4 claude + 3 codex + 2 CODING + 2 IDLE). Shipped SPEC-verbatim content (15 entries). The "13" claim is a typo in both SPEC and plan headers; the actual locked content is 15 entries.
- **Fix:** No code change. Documented for plan 07-02 author and any future reader. Adjusted verification to assert per-pool counts (which match SPEC) rather than the typo'd total.
- **Verification:** Per-pool counts assertion passes verbatim against SPEC.
- **Committed in:** N/A (documentation deviation, not a code fix).

**3. [Plan typo, no code impact] Plan's lowercase rule conflicts with SPEC accept-example "claude on a PR"**
- **Found during:** Task 1 verification
- **Issue:** Plan acceptance criterion "Every pool entry is a string and is fully lowercase" + verify script `e !== e.toLowerCase()` rejects the SPEC-locked entries `claude on a PR`, `the agent on a PR`, `codex on a PR` because `PR` is uppercase. SPEC §"Voice rules" line 88 lists `claude on a PR` as an explicit ACCEPT example, and the SPEC's locked-pool block uses uppercase PR verbatim. SPEC content wins; PR is a SPEC-sanctioned acronym exception.
- **Fix:** No code change to goblin.json. Adjusted verification to allow the `PR` acronym. Plan 07-02's voice-rules unit test should encode the SPEC-true rule (lowercase except specific accepted acronyms).
- **Verification:** All other voice-rules checks pass (AI-named, no banned tokens, sentinels, timeOfDay canonical strings, version, id).
- **Committed in:** N/A (documentation deviation, not a code fix).

---

**Total deviations:** 1 auto-fixed (Rule 3 — guardrail update) + 2 documented plan/SPEC typos (no code impact)
**Impact on plan:** Single guardrail fix was strictly necessary to unbreak CI. Both plan typos are harmless contradictions between plan's verify script and SPEC's locked content; SPEC content shipped verbatim per plan's `<action>` directive ("EXACTLY this content"). No scope creep.

## Issues Encountered
- `pnpm test` initially failed with `vitest: command not found`; running `pnpm install` (lockfile up-to-date, just hydrated `node_modules`) resolved it. All 332 tests then green.
- Build initial check_pack_inlined failure resolved by Rule 3 guardrail-sentinel update (see deviation 1).

## User Setup Required

None - no external service configuration required for this plan. Manual brand actions (Discord Developer Portal app rename, marketplace displayName bump, render-test matrix) are tracked in 07-HANDOFF.md per SPEC §"Out of scope".

## Next Phase Readiness
- v2 pool is shipped and inlined into dist; voice-rules unit test (plan 07-02) can now enumerate every entry and assert the locked rules.
- Activity-type config wiring (REQ-2), state-field time-of-day population (REQ-3), and largeImageText replacement (REQ-4) are independent of this plan and can land in subsequent plans.
- No blockers for downstream plans in phase 07.

## Self-Check: PASSED

Verified items:
- `src/presence/goblin.json` — FOUND (modified, content matches SPEC verbatim)
- `scripts/check-pack-inlined.mjs` — FOUND (modified, sentinels updated)
- Commit `27e10a2` — FOUND in `git log`
- 332 existing tests — PASS (`pnpm test`)
- Build — PASS (`pnpm build`, 227 KB / 500 KB budget)
- Pack inlined guardrail — PASS (`pnpm check:pack-inlined`)
- No banned tokens in goblin.json — PASS (grep returned 0 matches)

---
*Phase: 07-presence-v2-goblin-brand-and-watching-activity-type-lever*
*Completed: 2026-05-03*
