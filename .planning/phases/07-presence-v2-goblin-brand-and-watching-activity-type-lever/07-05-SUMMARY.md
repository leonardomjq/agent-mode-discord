---
phase: 07-presence-v2-goblin-brand-and-watching-activity-type-lever
plan: 05
subsystem: testing
tags: [vitest, activitybuilder, discord-rpc, time-of-day, activitytype, req-2, req-3, req-4]

# Dependency graph
requires:
  - phase: 07-presence-v2-goblin-brand-and-watching-activity-type-lever
    provides: "buildPayload(text, state, cfg, now?) signature with type/state/largeImageText emission (plan 07-04)"
provides:
  - "16 new behavioral assertions covering REQ-2/3/4 contract"
  - "Bucket-boundary parametrized test sweep across all 8 hour boundaries (REQ-3)"
  - "Per-agent largeImageText assertions (REQ-4) — claude/codex/empty/IDLE/CODING"
  - "Grep-style guardrail test preventing future re-introduction of literal 'Agent Mode' in src/presence/"
affects: [08-future-render-test, marketplace-bump]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Local mirror of small enums when transitive dep is not hoistable under pnpm strict resolution (mirrors src/presence/activityBuilder.ts pattern)"
    - "Programmatic grep guardrail in unit tests for literal-string bans"
    - "Parametrized boundary-hour sweep via for-of over [hour, expected] tuples"

key-files:
  created: []
  modified:
    - "test/presence.activityBuilder.test.ts — +180 lines, +16 behavioral cases + 1 guardrail"

key-decisions:
  - "Mirror ActivityType locally in test file rather than importing from discord-api-types/v10 — pnpm does not hoist the transitive dep (verified TS2307); mirrors production code's identical local-record pattern; no new runtime deps added (07-SPEC constraint preserved)."
  - "Strip line comments before grep guardrail to focus the literal-string ban on runtime code paths, not historical commentary; block comments are not stripped (a future block-comment hit would require either editing the comment or narrowing the regex)."
  - "Guardrail scoped to src/presence/ directory so REQ-5 (internal output channel name 'Agent Mode (Discord)' in src/outputChannel.ts) is automatically excluded by directory boundary, not by file allowlist."

patterns-established:
  - "Bucket-boundary test sweep: parametrize the [hour, expected-string] tuples and let the runner generate per-hour `it()` cases — preserves canonical-state lock per bucket without drift."
  - "Literal-string guardrail: a unit test that greps source files in the payload-emitting directory for a banned substring, asserting offenders.length === 0. Cheap to run, hard to bypass."

requirements-completed: [REQ-2, REQ-3, REQ-4]

# Metrics
duration: 3min
completed: 2026-05-03
---

# Phase 7 Plan 5: activityBuilder REQ-2/3/4 behavioral test coverage Summary

**16 new vitest assertions lock the activityType/time-of-day-state/per-agent-hover contracts plus a directory-scoped grep guardrail that prevents re-introduction of the literal "Agent Mode" string into payload-emitting code.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-03T19:36:43Z
- **Completed:** 2026-05-03T19:39:27Z
- **Tasks:** 1 (plus SUMMARY)
- **Files modified:** 1

## Accomplishments

- **REQ-2 lock (2 cases):** `cfg.activityType="playing"` → `payload.type === 0`; `"watching"` → `payload.type === 3`. Both compared against a locally-mirrored `ActivityType` record matching production code.
- **REQ-3 lock (8 cases):** Each canonical bucket boundary hour (00, 05, 06, 11, 12, 17, 18, 23) maps to its SPEC-locked state string (`3am goblin shift` / `morning service` / `afternoon shift` / `evening service`). Date is injected via the existing `now` parameter — no global Date mocking, no flake risk.
- **REQ-4 lock (5 cases):** AGENT_ACTIVE with named agents emits `running ${agent}`; AGENT_ACTIVE with empty agent + IDLE + CODING all emit `goblin mode`. Pinned wall clock to a deterministic morning bucket so hover assertions never depend on real time.
- **REQ-4 guardrail (1 case):** Programmatically reads every `.ts` under `src/presence/`, strips line comments, and asserts the literal `"Agent Mode"` does not appear in any runtime code path. REQ-5's `src/outputChannel.ts` channel name is automatically preserved by directory scoping.

Test count moved from 37 → 53 in the file; full vitest suite is 434/434 across 22 files; `pnpm typecheck` is clean.

## Task Commits

1. **Task 1 (TDD combined): Migrate buildPayload tests + add REQ-2/3/4 behavioral assertions** — `9d021df` (test)

Note: The plan was authored as TDD (RED → GREEN → REFACTOR), but the underlying production behavior was already shipped by plan 07-04 in Wave 1. There was no implementation gap to drive — this plan adds test coverage against existing behavior. A single `test(07-05)` commit is the honest representation; manufacturing a synthetic RED → GREEN split would require temporarily breaking 07-04's already-merged production code, which would cross the wave boundary and risk unrelated regressions. The TDD gate intent (test-first contract lock) is preserved by the assertions themselves: each of the 16 new cases would fail if 07-04's implementation were reverted (sanity-checked via the manual mutation acceptance criteria — both mutations in the plan would flip a test from green to red).

**Plan metadata:** to be added in final commit alongside SUMMARY.md.

## Files Created/Modified

- `test/presence.activityBuilder.test.ts` — added node:fs imports, local `ActivityType` mirror record, four new top-level `describe` blocks (REQ-2, REQ-3, REQ-4, REQ-4-guardrail) totalling 16 behavioral cases.

## Decisions Made

- **Local `ActivityType` mirror over `discord-api-types/v10` import.** Probe (`test/_probe_ActivityType.ts` — created and removed during planning verification) returned `TS2307: Cannot find module 'discord-api-types/v10'`. The package lives only inside `node_modules/.pnpm/@xhayper+discord-rpc@1.3.3/node_modules/` under pnpm strict resolution. Production `src/presence/activityBuilder.ts` already uses a local `const ActivityType = { Playing: 0, Watching: 3 } as const;` pattern for the same reason. Mirrored it in the test file with a comment block explaining why. Discord IPC consumes the integer over the wire, so observational equivalence holds.
- **Comment-stripping in the grep guardrail.** Used `line.replace(/\/\/.*$/, "")` to drop line comments before the regex check so the guardrail targets runtime strings, not commentary. Block comments are deliberately not stripped — a future `/* ... "Agent Mode" ... */` would still trip the guard, which is the correct conservative posture (forces the contributor to either edit the comment or refine the regex with explicit reasoning).
- **Directory-scoped guardrail (`src/presence/` only).** REQ-5 explicitly preserves `"Agent Mode (Discord)"` in `src/outputChannel.ts`. Restricting the guardrail to `src/presence/` excludes that file by structural boundary rather than a file allowlist — fewer failure modes, no hardcoded paths to maintain.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced `import { ActivityType } from "discord-api-types/v10"` with a local mirror record**

- **Found during:** Task 1, Step 2 (importing ActivityType into the test file).
- **Issue:** The plan's Step 2 instructed `import { ActivityType } from "discord-api-types/v10";`. This module is a transitive dependency of `@xhayper/discord-rpc` and is only present at `node_modules/.pnpm/discord-api-types@0.38.45/node_modules/discord-api-types/v10.d.ts`. Pnpm's strict resolution does not symlink it into the top-level `node_modules/`, so a probe import (`test/_probe_ActivityType.ts`) failed with `TS2307: Cannot find module 'discord-api-types/v10' or its corresponding type declarations.`
- **Fix:** Defined `const ActivityType = { Playing: 0, Watching: 3 } as const;` at the top of `test/presence.activityBuilder.test.ts`, mirroring the identical pattern already in `src/presence/activityBuilder.ts:105-108`. Added a 9-line comment block explaining why this is observationally equivalent to the import.
- **Files modified:** `test/presence.activityBuilder.test.ts`
- **Verification:** `pnpm typecheck` exits 0; all 16 new assertions pass; the assertion `expect(payload.type).toBe(ActivityType.Playing)` is now strictly equal to `expect(payload.type).toBe(0)` — both forms are present in REQ-2 cases as belt-and-suspenders.
- **Committed in:** `9d021df` (Task 1 commit).
- **Why not architectural (Rule 4):** Adding `discord-api-types` as a direct dependency would resolve the import but is explicitly out-of-scope per 07-SPEC Constraint: "No new runtime dependencies." The local mirror produces the same observable test outcome without violating the constraint.

---

**Total deviations:** 1 auto-fixed (Rule 3 - Blocking).
**Impact on plan:** No scope creep. The contract being tested is identical; the import mechanism differs from the plan's instruction by necessity (transitive dep not hoistable under pnpm strict resolution).

## Issues Encountered

- **Post-execution-check guardrail #4 expectation mismatch.** The post_execution_check spec says `grep -rn '"Agent Mode"' src/outputChannel.ts` must return 1 match. Actual result: 0 matches. The literal in `src/outputChannel.ts:36` is `"Agent Mode (Discord)"` (a single quoted string with internal spaces and parens), so the bounded pattern `"Agent Mode"` (closing quote immediately after `Mode`) does not appear in that file — the grep returns 0. Substantively REQ-5 is preserved: the channel name `"Agent Mode (Discord)"` is unchanged in this plan's diff (only `test/presence.activityBuilder.test.ts` is modified). Verified via `grep -c "Agent Mode" src/outputChannel.ts` → 2 (one comment ref, one runtime ref). Flagging this as a check-spec quirk, not a substantive failure. The unit-test-level guardrail (REQ-4 directory-scoped over `src/presence/`) is the SPEC-locked test and it passes.

## User Setup Required

None - this plan ships test code only.

## Next Phase Readiness

- All Phase 7 acceptance criteria for REQ-2, REQ-3, REQ-4 are now contract-locked at the unit-test level. Future contributors who regress any of (a) the activityType lever wiring, (b) any time-of-day bucket boundary, (c) any per-agent largeImageText case, (d) re-introduction of the literal `"Agent Mode"` into `src/presence/`, will be caught by `pnpm test` before merge.
- Plan 07-06 (next in queue) can rely on the test surface as-is.
- Manual render-test matrix in `07-HANDOFF.md` (REQ-9) remains the only outstanding gate for flipping the default `activityType` from `playing` to `watching` in a future phase — that work is correctly deferred.

## Self-Check: PASSED

- `test/presence.activityBuilder.test.ts` — FOUND (modified)
- Commit `9d021df` — FOUND in `git log`
- `.planning/phases/07-presence-v2-goblin-brand-and-watching-activity-type-lever/07-05-SUMMARY.md` — written by this step
- `pnpm typecheck` — exit 0 (clean)
- `pnpm test` — 434/434 passing (53 in `test/presence.activityBuilder.test.ts`, including 16 new + 1 guardrail)
- `grep -rn '"Agent Mode"' src/presence/` — 0 matches (REQ-4 substantively preserved)
- `grep -c "Agent Mode" src/outputChannel.ts` — 2 matches (REQ-5 preserved; see Issues Encountered for the bounded-literal grep nuance)

---
*Phase: 07-presence-v2-goblin-brand-and-watching-activity-type-lever*
*Completed: 2026-05-03*
