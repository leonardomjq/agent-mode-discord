---
phase: 07-presence-v2-goblin-brand-and-watching-activity-type-lever
plan: 03
subsystem: config
tags: [vscode-config, contributes.configuration, activitytype, schema, REQ-2]

# Dependency graph
requires:
  - phase: 04-presence-card-pipeline
    provides: AgentModeConfig interface + readConfig() lazy pattern (CONF-03 / D-24)
provides:
  - agentMode.activityType config key exposed via package.json contributes.configuration (enum [playing, watching], default "playing")
  - AgentModeConfig.activityType: "playing" | "watching" typed field
  - readConfig() lazy reader with default-fallback to "playing"
  - test fixture builders updated (defaultConfig, makeConfig) preserving typecheck-green invariant
affects: [07-04 activityBuilder Watching/state/largeImageText, 07-05 behavioral test cases, 07-06 docs/release]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Required-field config keys with default fallback: zero-regression rollout pattern (default value matches prior behavior; opt-in via setting)"
    - "Wave-0 fixture-helper update co-located with schema change to keep typecheck-green at end of wave"

key-files:
  created: []
  modified:
    - package.json
    - src/config.ts
    - test/presence.activityBuilder.test.ts
    - test/presence.animator.test.ts

key-decisions:
  - "activityType is a REQUIRED (non-optional) field on AgentModeConfig — matches the rest of the non-optional fields and is more type-safe; this forces fixture-builder updates in the same plan."
  - "Default value 'playing' is locked by REQ-2 + Constraints (07-SPEC line 149): zero behavior regression for existing v0.1.3 users on update; Watching is explicitly opt-in."
  - "Read is lazy (CONF-03 / D-24) — no module-level caching of activityType."
  - "Plan 07-03 owns FIXTURE-helper updates only; plan 07-05 owns NEW behavioral test cases for type/state/largeImageText. test/config.test.ts was not touched because its literals are partial-config maps (Record<string, unknown>) not full AgentModeConfig literals — TS did not complain there."

patterns-established:
  - "Schema additions always include title + description + (when enum) enumDescriptions, validated by scripts/check-config-keys.mjs (CONF-01 / D-23)."
  - "When adding a required field to AgentModeConfig, the same plan updates every fixture builder so pnpm typecheck stays green at end of the wave."

requirements-completed: [REQ-2]

# Metrics
duration: ~10min
completed: 2026-05-03
---

# Phase 07 Plan 03: agentMode.activityType Config Setting Summary

**REQ-2 foundation: agentMode.activityType configuration key surfaced via package.json contributes.configuration (enum [playing, watching], default 'playing'), AgentModeConfig.activityType typed field, and lazy readConfig() reader — zero behavior regression for existing users.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-05-03T19:23:36Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments
- Exposed `agentMode.activityType` to the VS Code Settings UI with enum + default + title + description + enumDescriptions; CI guardrail `check:config-keys` continues to PASS at 15/20 keys (CONF-01 budget intact).
- Extended `AgentModeConfig` with `activityType: "playing" | "watching"` and wired `readConfig()` to read it lazily, falling back to `"playing"` when unset (Constraint: zero v0.1.3 → v0.2 behavior regression).
- Updated `defaultConfig()` (test/presence.activityBuilder.test.ts) and `makeConfig()` (test/presence.animator.test.ts) so `pnpm typecheck` stays green at end of Wave 0; full test suite (332/332) still passes.
- Foundation in place for plan 07-04 (`cfg.activityType` consumption in activityBuilder) and plan 07-05 (behavioral test cases for type/state/largeImageText).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add agentMode.activityType to package.json + extend AgentModeConfig + readConfig + update existing test fixtures** — `375e935` (feat, --no-verify)

## Files Created/Modified
- `package.json` — Added `agentMode.activityType` property under `contributes.configuration.properties` (15/20 keys, CONF-01 cap intact); enum `["playing","watching"]`, default `"playing"`, title `"Activity Type"`, full description + enumDescriptions per D-23.
- `src/config.ts` — Added `activityType: "playing" | "watching"` to `AgentModeConfig` interface; added `activityType: c.get<"playing" | "watching">("activityType", "playing") ?? "playing"` to `readConfig()` return literal.
- `test/presence.activityBuilder.test.ts` — Added `activityType: "playing"` to `defaultConfig()` `base` literal so the `AgentModeConfig` typecheck stays green.
- `test/presence.animator.test.ts` — Added `activityType: "playing"` to `makeConfig()` returned literal so the `AgentModeConfig` typecheck stays green.

## Decisions Made
- See `key-decisions` in frontmatter — required-field choice, default `"playing"` lockdown, lazy-read preservation, scope split between 07-03 (fixtures) and 07-05 (behavioral tests).

## Deviations from Plan

None - plan executed exactly as written.

The plan's note re. `test/config.test.ts` (line 160) anticipated that several `clientId:` literals there might be `Partial<AgentModeConfig>`/`Record<string, unknown>` shapes that would NOT need updating; that prediction held — the literals at lines 34/39/49/74/107/109 are all writes into `currentConfig: ConfigMap = Record<string, unknown>`, not full `AgentModeConfig` literals, so TS did not require an `activityType` addition there.

## Issues Encountered
- `node_modules` was missing on first `pnpm test` run inside the worktree (vitest binary not found). Resolved by running `pnpm install` once; `pnpm typecheck` was already green pre-install (TS only needs source files), and `pnpm test` produced 332/332 passing post-install. Not a deviation — expected worktree-bootstrap step.

## Verification

- `pnpm typecheck` → exits 0 (no missing-property errors at any AgentModeConfig literal).
- `pnpm test` → 332/332 passing (21 test files; existing assertions unchanged; no behavioral assertion added in this plan).
- `pnpm check:config-keys` → PASS — 15/20 keys, all have title/description/default + enum→enumDescriptions (CONF-01 / D-22 / D-23).
- JSON schema validation (`node -e "..."` from plan): `OK` — property exists, `default === "playing"`, `enum === ["playing","watching"]`.
- `grep -n "activityType" src/config.ts` → 2 lines (interface + readConfig assignment).
- `grep -n "activityType" package.json` → 1 line.
- `grep -n 'activityType: "playing"' test/presence.activityBuilder.test.ts test/presence.animator.test.ts` → 2 lines (one per fixture helper).

## Next Phase Readiness
- Plan 07-04 (Watching activity type lever in activityBuilder) can now consume `cfg.activityType` directly; the field is guaranteed present and defaults to `"playing"` so any v0.1.3-shaped install behaves identically until users opt into Watching.
- Plan 07-05 will add the new behavioral test cases (type/state/largeImageText) — fixture helpers are ready to accept `activityType: "watching"` overrides via the existing spread-override pattern.
- No blockers for downstream plans in this wave.

## Self-Check: PASSED

- File `package.json` — FOUND (modified, contains `agentMode.activityType`).
- File `src/config.ts` — FOUND (modified, contains `activityType` interface field + readConfig line).
- File `test/presence.activityBuilder.test.ts` — FOUND (modified, contains `activityType: "playing"` in defaultConfig).
- File `test/presence.animator.test.ts` — FOUND (modified, contains `activityType: "playing"` in makeConfig).
- Commit `375e935` — FOUND in `git log --oneline`.

---
*Phase: 07-presence-v2-goblin-brand-and-watching-activity-type-lever*
*Completed: 2026-05-03*
