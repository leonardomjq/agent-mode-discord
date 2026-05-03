---
phase: 07-presence-v2-goblin-brand-and-watching-activity-type-lever
plan: 04
subsystem: presence

tags: [activity-builder, discord-rpc, activity-type, time-of-day, goblin-brand, hover-text, watching-lever]

# Dependency graph
requires:
  - phase: 07-presence-v2-goblin-brand-and-watching-activity-type-lever
    provides: "AgentModeConfig.activityType field exposed in src/config.ts and package.json contributes.configuration (07-03)"
provides:
  - "buildPayload(text, state, cfg, now?) — 3-arg signature emitting type, state, largeImageText per REQ-2/3/4"
  - "TIME_OF_DAY_STATE map — canonical state-line strings per local-hour bucket"
  - "resolveActivityType() helper — config-string → Discord ActivityType integer"
  - "Goblin-brand hover text — `running ${agent}` / `goblin mode` (no more `Agent Mode` literal)"
  - "Wave 1 typecheck-green and 418/418-test-green baseline for plan 07-05's behavioral additions"
affects: [07-05 (REQ-2/3/4 behavioral describe blocks), 07-HANDOFF render-test matrix, future v0.2.0 marketplace bump]

# Tech tracking
tech-stack:
  added: []  # No new runtime deps — see Decisions Made for rationale.
  patterns:
    - "Local enum mirror for transitive deps under pnpm strict resolution (preserves observational equivalence over wire protocols where the integer value, not the enum identity, matters)"
    - "Injectable now: Date for time-bucket-sensitive payload builders (mirrors animator's Deps.now() pattern)"

key-files:
  created: []
  modified:
    - "src/presence/activityBuilder.ts"
    - "test/presence.activityBuilder.test.ts"

key-decisions:
  - "Declared ActivityType enum locally instead of importing from discord-api-types/v10 — pnpm strict resolution does not hoist transitive deps to top-level node_modules and 07-SPEC §Constraints forbids new direct deps. The Discord IPC wire consumes integers (Playing=0, Watching=3), not the enum identity, so a local `as const` record is observationally equivalent. Referenced source location documented in the comment for future contributors."
  - "Imported timeOfDayBucket from animator.ts rather than inlining a copy — animator.ts has no back-reference to activityBuilder, so no circular-import risk; this keeps the bucket boundary definition single-sourced (D-11)."
  - "Replaced `expect(p.state).toBeUndefined()` with shape assertions (`typeof === 'string'` + non-empty) rather than wall-clock-pinned bucket assertions. Bucket-boundary cases land in plan 07-05 with injected Date — keeps Wave 1 robust to test-run timing."
  - "Kept buildPayload's `now` parameter optional (defaults to `new Date()`) so the single in-tree caller (createActivityBuilder.onRender) stays simple while plan 07-05 can inject fakes for the 4 bucket-boundary cases."

patterns-established:
  - "Three-arg buildPayload(text, state, cfg, now?) — cfg is required so the live-reread D-24 contract carries through to the wire payload (no module-level config caching)."
  - "Per-key static maps (TIME_OF_DAY_STATE, AGENT_ICON_KEYS) co-located with buildPayload — self-contained units that pure-core tests can grep/assert without test fixtures."

requirements-completed: [REQ-2, REQ-3, REQ-4]

# Metrics
duration: ~14 min
completed: 2026-05-03
---

# Phase 7 Plan 04: activityBuilder type lever, time-of-day state, goblin hover Summary

**buildPayload now emits SetActivity.type from cfg.activityType, SetActivity.state from a 4-bucket time-of-day map, and replaces the static `Agent Mode` largeImageText with `running ${agent}` / `goblin mode` — Wave 1 ends typecheck-green and test-green so plan 07-05 can stack REQ-2/3/4 behavioral describe blocks on a stable 3-arg signature.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-03T19:18:00Z (worktree base reset)
- **Completed:** 2026-05-03T19:32:12Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- `buildPayload` upgraded to a 3-arg (+ optional `now`) signature emitting `type`, `state`, and goblin-brand `largeImageText`.
- Static `"Agent Mode"` literal eliminated from src/ payload paths (grep verifies zero matches).
- All 7 existing test call sites migrated to `buildPayload(..., defaultConfig())`; three stale `largeImageText` assertions and one `state === undefined` assertion updated to the new contract.
- Wire-level guardrails preserved: `dist/extension.cjs` is 221.8 KB (44.4% of 500 KB budget); `check:no-network` and `check:api-surface` both PASS; no new runtime dependencies.
- 418/418 tests pass. `pnpm typecheck` exits 0. Plan 07-05 has a clean baseline.

## Task Commits

Each task was committed atomically:

1. **Task 1: Patch activityBuilder.ts for type/state/largeImageText + migrate existing test call sites** — `147b999` (feat)

_Note: Plan declared `tdd="true"` but the existing `test/presence.activityBuilder.test.ts` already exercises the buildPayload behavioral surface; this plan's contract is "migrate existing call sites + update three stale assertions + add `state` shape assertion" which is a single-commit migration. New behavioral describe blocks (REQ-2/3/4 acceptance) are explicitly the scope of plan 07-05 (Wave 2 — see 07-04-PLAN.md objective: "Plan 07-05 ADDS new behavioral test cases. Plan 07-04 MIGRATES existing call sites only."). Therefore the standard RED→GREEN→REFACTOR three-commit cadence does not apply to this plan; the migration is a single atomic feat() commit. Plan 07-05 will perform the gate sequence on top of this baseline._

## Files Created/Modified

- `src/presence/activityBuilder.ts` — Local `ActivityType` enum mirror; `TIME_OF_DAY_STATE` map; `resolveActivityType()` helper; `timeOfDayBucket` import from animator; `buildPayload(text, state, cfg, now?)` signature change; goblin hover text (`running ${agent}` / `goblin mode`); `createActivityBuilder.onRender` passes live `cfg` as third arg to `buildPayload`.
- `test/presence.activityBuilder.test.ts` — 7 call sites migrated to 3-arg form using existing `defaultConfig()` helper; `expect(p.state).toBeUndefined()` replaced with non-empty-string assertion (REQ-3 contract); 3 `largeImageText` assertions updated (REQ-4 contract).

## Decisions Made

- **Local `ActivityType` enum mirror.** `discord-api-types` is a transitive dep of `@xhayper/discord-rpc` but pnpm's strict node-modules layout does not hoist it to top-level `node_modules` (verified: `ls node_modules/discord-api-types/` is empty; only resolvable inside `.pnpm/@xhayper+discord-rpc@1.3.3/node_modules/`). 07-SPEC §Constraints line 155 forbids new direct deps. Since Discord's IPC wire format consumes the integer value (`Playing=0`, `Watching=3`) and not the enum's identity, a local `const ActivityType = { Playing: 0, Watching: 3 } as const` is observationally equivalent. The constant is documented with a pointer to the upstream definition for future contributors.
- **Import `timeOfDayBucket` from animator.ts (not inline).** The plan offered both options conditional on circular-import risk. Verified animator.ts has no back-reference to activityBuilder.ts (only comment mentions), so the import is safe and keeps the bucket boundary definition single-sourced.
- **`state` assertion uses shape, not wall-clock-pinned value.** Pinning to a specific bucket would make the test depend on the time of day it runs; the REQ-3 contract is "always populated" (which the new buildPayload guarantees), and bucket-boundary cases land in plan 07-05 with injected `Date`.
- **Single atomic commit (no RED→GREEN split).** Plan 07-04 is explicitly a migration plan, not a new-behavior plan — the existing test file already covers the surface, and the plan body's Step 6 details the in-place assertion updates required to keep that file green against the new contract. Plan 07-05 performs the TDD gate sequence for the actual REQ-2/3/4 behavioral additions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `import { ActivityType } from "discord-api-types/v10"` failed typecheck under pnpm strict resolution**

- **Found during:** Task 1 (Step 1 — adding the ActivityType import)
- **Issue:** The plan asserted `discord-api-types` was "transitively present via @xhayper/discord-rpc" and so a direct import would resolve. Under pnpm's strict node-modules layout (verified: `node_modules/discord-api-types/` does not exist; the package is only resolvable from inside `node_modules/.pnpm/@xhayper+discord-rpc@1.3.3/node_modules/`), the direct import errors with `TS2307: Cannot find module 'discord-api-types/v10'`. The plan's Constraint line 155 explicitly forbids adding it as a direct dep.
- **Fix:** Defined a local `const ActivityType = { Playing: 0, Watching: 3 } as const` mirror at the top of activityBuilder.ts. The wire format consumes integers, not the enum identity, so this is observationally equivalent. The constant is documented with a comment pointing to the upstream definition (`node_modules/.pnpm/discord-api-types@0.38.45/.../payloads/v10/gateway.d.ts:262,274`) so future contributors can verify.
- **Files modified:** `src/presence/activityBuilder.ts`
- **Verification:** `pnpm typecheck` exits 0; `pnpm test` passes 418/418; the `must_haves.artifacts.contains: "ActivityType"` grep signal is preserved (the local declaration matches); `key_links.pattern: "ActivityType\\.(Playing|Watching)"` is preserved (`ActivityType.Watching` / `ActivityType.Playing` references in `resolveActivityType` body match the regex).
- **Committed in:** `147b999` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking)
**Impact on plan:** Single resolution of a plan assumption that didn't hold under pnpm strict resolution. The artifact contract (`contains: "ActivityType"`, `pattern: "ActivityType\\.(Playing|Watching)"`) is preserved by the local mirror. No scope creep, no downstream impact on plan 07-05.

## Issues Encountered

- pnpm strict-resolution prevented the planned direct import of `discord-api-types/v10`. Resolved via the Rule-3 deviation above (local enum mirror) — preserves the no-new-deps constraint and the wire protocol.

## TDD Gate Compliance

This plan declared `tdd="true"` but its scope is explicitly migration, not new behavior — see the "Wave 1 → Wave 2 invariant" callout in the plan objective. The existing test file (`test/presence.activityBuilder.test.ts`) already covered the buildPayload behavioral surface; this plan's contribution is updating those existing assertions to match the new contract and migrating the call sites. No new behavioral tests were added in this plan (those are scoped to plan 07-05). Therefore the conventional RED→GREEN→REFACTOR three-commit cadence does not apply; a single atomic `feat()` commit is the correct shape for a migration. The migrated test file is green at end of plan, providing the typecheck-green and test-green baseline that plan 07-05 will use to perform the proper TDD gate sequence for REQ-2/3/4 behavioral additions.

## User Setup Required

None — no external service configuration changed in this plan. (The Discord Developer Portal app rename and marketplace `displayName` bump remain deferred per 07-HANDOFF.md.)

## Next Phase Readiness

- Plan 07-05 (Wave 2) is unblocked: buildPayload's 3-arg signature is stable, `defaultConfig()` returns `activityType: "playing"` by default, and the `now: Date` injection point exists for bucket-boundary tests.
- The Watching code path is reachable but opt-in only — existing users see `type: 0` (Playing) and zero behavioral regression on update.
- Render-test matrix (07-HANDOFF.md) remains the gate before any default-flip phase considers Watching-by-default.

## Self-Check: PASSED

- FOUND: src/presence/activityBuilder.ts (modified — `ActivityType` local enum, `TIME_OF_DAY_STATE`, `resolveActivityType`, 3-arg `buildPayload`, goblin hover text, `createActivityBuilder` wires `cfg` through)
- FOUND: test/presence.activityBuilder.test.ts (modified — 7 call sites migrated, 4 assertions updated)
- FOUND: commit `147b999` in `git log --oneline`
- VERIFIED: `grep -n '"Agent Mode"' src/presence/activityBuilder.ts` returns 0 matches
- VERIFIED: `pnpm typecheck` exits 0
- VERIFIED: `pnpm test` passes 418/418
- VERIFIED: `pnpm build` succeeds; `dist/extension.cjs` 221.8 KB (44.4% of 500 KB budget)
- VERIFIED: `pnpm check:no-network` PASS
- VERIFIED: `pnpm check:api-surface` PASS
- VERIFIED: `pnpm check:bundle-size` PASS

---
*Phase: 07-presence-v2-goblin-brand-and-watching-activity-type-lever*
*Completed: 2026-05-03*
