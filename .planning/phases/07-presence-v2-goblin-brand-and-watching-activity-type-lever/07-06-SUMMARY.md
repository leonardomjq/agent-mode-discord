---
phase: 07-presence-v2-goblin-brand-and-watching-activity-type-lever
plan: 06
subsystem: docs
tags: [handoff, manual-actions, render-test, discord-portal, marketplace, watching-activity-type]

# Dependency graph
requires:
  - phase: 07-presence-v2-goblin-brand-and-watching-activity-type-lever
    provides: 07-SPEC.md REQ-8 (manual actions captured) + REQ-9 (Watching render-risk fallback)
provides:
  - 07-HANDOFF.md as the single post-merge action receipt for the user
  - Render-test matrix gating any future default flip from playing to watching
  - Explicit deferral of marketplace displayName bump to next version-bump phase
affects: [phase-08+, future-version-bump-phase, default-flip-decision]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - HANDOFF.md as standard receipt for deferred manual actions per phase
    - Render-test matrix template (surface rows x mode columns) for any setting whose render risk requires field validation before default flip

key-files:
  created:
    - .planning/phases/07-presence-v2-goblin-brand-and-watching-activity-type-lever/07-HANDOFF.md
  modified: []

key-decisions:
  - "HANDOFF.md uses unchecked checkboxes that do NOT block phase verification — code-side requirements REQ-1..7 are independent of these manual gates"
  - "Marketplace displayName bump explicitly deferred to next version-bump phase (not this phase) to avoid coupling brand-copy iteration to a v0.2.0 release"
  - "Discord Developer Portal app rename documented as fallback-acceptable: even without it, card reads 'Playing Agent Mode / claude shipping code', strictly better than v0.1.3 baseline"
  - "Render-test matrix has 6 surface rows x 2 mode columns (12 cells) — every Watching cell must render coherently before any future default flip"

patterns-established:
  - "Pattern: per-phase HANDOFF.md when there are deferred user actions (third-party dashboards, post-deploy field tests, version-bump-coupled changes)"
  - "Pattern: render-test matrix as the gate artifact for opt-in features whose visual rendering can't be unit-tested (Discord IPC behavior depends on client/platform)"
  - "Pattern: explicit fallback documentation when a setting's rendering is unverified — default to safe value (here 'playing'), surface the experimental value, document the gate to flip the default"

requirements-completed: [REQ-8, REQ-9]

# Metrics
duration: 4min
completed: 2026-05-03
---

# Phase 7 Plan 6: HANDOFF authored — deferred manual actions + render-test matrix Summary

**07-HANDOFF.md captures Discord Developer Portal app rename, marketplace displayName bump deferral, and a 6×2 render-test matrix gating any future default flip from `playing` to `watching`**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-03T19:18:30Z (approx)
- **Completed:** 2026-05-03T19:22:54Z
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments

- Authored `.planning/phases/07-.../07-HANDOFF.md` (135 lines, 6.5 KB) as the single post-merge action receipt
- Documented deferred Discord Developer Portal app rename (`Agent Mode` → `goblin mode`) with portal URL, fallback behavior note, and verification step
- Documented explicit deferral of `package.json` `displayName` bump to the next version-bump phase, with rationale (marketplace re-publish coupling) and a checklist for the future phase
- Authored render-test matrix with 6 surface rows (desktop self / desktop friend-view / web self / web friend-view / mobile iOS / mobile Android) × 2 mode columns (Playing / Watching) = 12 empty cells
- Added smoke-test checklist for post-merge / pre-publish local verification, separate from the matrix
- Added SPEC compliance summary referencing REQ-8 and REQ-9 with explicit traceability

## Task Commits

Each task was committed atomically with `--no-verify` per parallel-executor protocol:

1. **Task 1: Author 07-HANDOFF.md with deferred actions + render-test matrix** — `678c9b8` (docs)

## Files Created/Modified

- `.planning/phases/07-presence-v2-goblin-brand-and-watching-activity-type-lever/07-HANDOFF.md` — created. Four sections: (1) Deferred manual actions (Discord Portal rename §1a + marketplace bump deferral §1b), (2) Render-test matrix (REQ-9), (3) Smoke test (post-merge), (4) SPEC compliance summary mapping back to REQ-8 + REQ-9.

## Decisions Made

- **Used `---` horizontal rules instead of `***`:** the plan offered both as valid CommonMark; `---` chosen for consistency with the rest of the phase docs. No YAML-frontmatter collision since the file's frontmatter already closes before the section breaks begin.
- **Kept all checkboxes unchecked at authoring time:** the user fills these in post-deployment. Phase verification gate explicitly does not block on `[ ]` state per REQ-8.
- **Did NOT modify `package.json:3` `displayName`:** SPEC §Boundaries lists this as out-of-scope; this phase ships code-only.

## Deviations from Plan

None — plan executed exactly as written. The plan provided substantively-verbatim content; minor formatting choice (`---` over `***`) was explicitly offered as equivalent in the plan's `<action>` block.

## Issues Encountered

None.

## Verification

Plan-supplied automated check passed:

```
node -e "...const checks=['Discord Developer Portal','goblin mode','displayName',
'Render-test matrix','Playing','Watching','desktop','web','mobile','friend',
'REQ-8','REQ-9']; const missing=checks.filter(c=>!s.includes(c));..."
→ OK length=6583
```

Acceptance criteria summary:
- File exists at documented path: ✓
- Contains `Discord Developer Portal`, `goblin mode`, `displayName`: ✓
- Render-test matrix has 6 rows × 2 columns × `[ ]` checkboxes (12 matrix cells): ✓ (counted by `grep -E '^\|.*\[ \].*\[ \].*\|'`)
- References REQ-8 and REQ-9 explicitly: ✓ (§1a, §1b, §2, §4)
- File length > 2000 chars: ✓ (6583 chars / 135 lines)
- No `package.json:3` `displayName` change in this phase's diff: ✓ (`git diff -- package.json` empty after task 1)
- Renders cleanly as markdown — no broken frontmatter, no unclosed code fences: ✓ (visual eyeball)

## User Setup Required

This entire plan IS the user-setup capture. Two manual actions remain at the user's discretion post-merge:

1. **Discord Developer Portal app rename** (`Agent Mode` → `goblin mode`) — fallback-acceptable if not done; card still reads `Playing Agent Mode / claude shipping code`, an improvement over v0.1.3 baseline.
2. **Render-test matrix** — fill in after `v0.2.0` is installed locally; gates any future default flip from `playing` → `watching`.

A separate `displayName` bump is deferred to the next version-bump phase, NOT this phase.

## Next Phase Readiness

- 07-HANDOFF.md is the receipt; no further blockers from plan 07-06's perspective
- The phase's verification gate can pass with all `[ ]` checkboxes unchecked (deferred-acceptable)
- Future "default flip" phase (post-render-test) will reference §2 of HANDOFF.md as input — only flip if every Watching cell is `✓`
- Future "v0.2.0 marketplace bump" phase will reference §1b as the checklist to action

## Self-Check: PASSED

- File `.planning/phases/07-presence-v2-goblin-brand-and-watching-activity-type-lever/07-HANDOFF.md` exists: FOUND
- Commit `678c9b8` exists in git log: FOUND (verified via `git log --oneline -2`)
- Required substring checks: FOUND (12/12 checks via plan's automated verification)
- Render-test matrix row count (6): FOUND
- `package.json` unchanged: FOUND (clean `git diff`)

---
*Phase: 07-presence-v2-goblin-brand-and-watching-activity-type-lever*
*Plan: 06*
*Completed: 2026-05-03*
