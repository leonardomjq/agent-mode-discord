---
phase: 01-skeleton-rpc-seam
plan: 05
subsystem: docs-handoff
tags: [human-handoff, discord-developer-portal, openvsx, phase-1-acceptance, checklists]

requires:
  - src/rpc/client.ts DEFAULT_CLIENT_ID + AGENT_MODE_CLIENT_ID from plan 01-02 (exact constant + env var names referenced in Checklist 1)
  - Phase 1 success criteria from ROADMAP.md (Checklist 3 mirrors the manual Dev Host verification steps)
provides:
  - docs/HUMAN-HANDOFF.md — Phase 1 exit artifact
  - Checklist 1 — Discord Developer Portal app creation (unblocks Phase 6 PUB-01)
  - Checklist 2 — OpenVSX publisher namespace claim (unblocks Phase 6 PUB-02; variable lead time flagged)
  - Checklist 3 — Phase 1 acceptance — manual Dev Host verification of SKEL-03, SKEL-06, SKEL-07
  - Sign-off block with date + initials (T-01-14 repudiation mitigation)
affects: [02-*, 06-01, 06-02, 06-05]

tech-stack:
  added: []
  patterns:
    - "Handoff-doc template: 3 sectioned checklists (external-service-1, external-service-2, manual-acceptance) each opening with estimated time + what-is-blocked declaration"
    - "Checkbox anchor pattern: every action item is a GitHub-style `- [ ]` checkbox so the human can tick-as-you-go on the rendered doc"
    - "Exact-reference pattern: Checklist 1 step 1.4 names the literal file path (src/rpc/client.ts), exact export (DEFAULT_CLIENT_ID), exact env override (AGENT_MODE_CLIENT_ID), and exact placeholder string (REPLACE_ME_IN_PHASE_1_HANDOFF) so no grep is needed"
    - "Manual-to-requirement mapping: Checklist 3 steps tagged (SKEL-03), (SKEL-06), (SKEL-07) so future reviewers can audit which requirement each step proves"

key-files:
  created:
    - docs/HUMAN-HANDOFF.md
  modified: []

key-decisions:
  - "Doc lives at docs/HUMAN-HANDOFF.md (not .planning/phases/...) so future contributors discover it via the repo root docs/ directory — aligns with PRD file-layout convention (CONTEXT.md §9.4)"
  - "Checkbox count (22) intentionally exceeds min-lines threshold (15) so every sub-step of every checklist is individually tickable — avoids compound items where skipping one sub-step would silently fail acceptance"
  - "Checklist 2 opens with `approval lead time is variable (hours to weeks)` as the FIRST sentence of the body — ensures the reader cannot miss the blocker even if they skim past the heading"
  - "Marketplace-only fallback for Checklist 2 is documented inline (step 2.6) so Phase 6 planning doesn't have to rediscover it — STATE.md blocker note + CONTEXT.md deferred-items are cross-referenced"
  - "Horizontal rules written as `---` (standard Markdown) in the actual doc; the plan template used `***` only to avoid colliding with the PLAN.md frontmatter regex, per plan's explicit IMPORTANT note"

patterns-established:
  - "Exit-artifact shape: one doc per phase that consolidates (a) external service actions with variable lead times and (b) manual acceptance verification — becomes the template for phase 6 release-readiness handoff"
  - "Sign-off ritual: date + initials per checklist to create an audit trail — addresses T-01-14 repudiation (future reviewers can confirm acceptance was actually performed)"
  - "Cross-phase blocker surfacing: when a phase discovers a variable-lead-time item that blocks a later phase, the handoff doc from the phase that discovers it is the canonical place to document both the action and the fallback"

requirements-completed: [SKEL-03, SKEL-06, SKEL-07]

duration: ~1 min
completed: 2026-04-12
---

# Phase 01 Plan 05: Human handoff checklist — Discord Portal + OpenVSX + Phase 1 acceptance Summary

**Delivered `docs/HUMAN-HANDOFF.md` — the Phase 1 exit artifact with three tickable checklists: (1) Discord Developer Portal app creation that points the human at `src/rpc/client.ts` `DEFAULT_CLIENT_ID` / `AGENT_MODE_CLIENT_ID` for the one-line edit, (2) OpenVSX publisher namespace claim with the variable-lead-time blocker surfaced in the first sentence and a Marketplace-only fallback documented inline, (3) Phase 1 acceptance — seven concrete Dev Host steps (F5, Show Running Extensions, kill -TERM, kill -INT, relaunch-no-duplicate) that prove SKEL-03 / SKEL-06 / SKEL-07 on real infrastructure. 22 GitHub-style checkboxes, 95 lines, sign-off block with date + initials as the audit trail.**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-04-12T23:23:30Z
- **Completed:** 2026-04-12T23:24:58Z
- **Tasks:** 1
- **Files created:** 1 (`docs/HUMAN-HANDOFF.md`)
- **Files modified:** 0

## Accomplishments

- **Phase 1 closeable:** execute → verify → checker → handoff ticks now have a single artifact that consolidates every remaining manual action into three checklists.
- **Checklist 1 unblocks PUB-01:** walks the maintainer from `https://discord.com/developers/applications` to a committed `DEFAULT_CLIENT_ID` in 6 steps. Names the exact file (`src/rpc/client.ts`), exact constant (`DEFAULT_CLIENT_ID`), exact env override (`AGENT_MODE_CLIENT_ID`), exact placeholder string (`REPLACE_ME_IN_PHASE_1_HANDOFF`) — zero grep required.
- **Checklist 2 unblocks PUB-02 (variable-lead-time):** opens with `approval lead time is variable (hours to weeks)` and `BLOCKS Phase 6` in the first sentence. Step 2.5 requires the reader to record namespace + submission date. Step 2.6 documents the Marketplace-only fallback path so Phase 6 planning doesn't have to rediscover it.
- **Checklist 3 = Phase 1 acceptance gate:** 7 steps cover SKEL-03 (activation <50 ms via Show Running Extensions), SKEL-06 (hello world in Discord friends sidebar within 2 s), SKEL-07 (kill -TERM + kill -INT leave no ghost presence). Relaunch-no-duplicate step also indirectly validates SKEL-08's belt-and-braces cleanup in real conditions.
- **Audit trail in place:** sign-off block with date + initials per checklist — T-01-14 repudiation mitigation as specified in the plan's threat model.
- **Reader-hostile clauses eliminated:** all checklist items are `- [ ]` checkboxes (no compound bullets), estimated times + blocker declarations in every heading body, failure-to-proceed instructions ("open a GitHub issue titled …") at the end of Checklist 3.

## Task Commits

1. **Task 1: Write `docs/HUMAN-HANDOFF.md` with three checklists** — `1cb34ea` (docs)

## Files Created/Modified

- `docs/HUMAN-HANDOFF.md` (new, 95 lines) — Phase 1 exit artifact with three sectioned checklists, embedded code block showing the exact `DEFAULT_CLIENT_ID` shape, sign-off block with date + initials per checklist.

## Verification Evidence

Every plan-level `<automated>` predicate ran and passed:

| Check | Result |
|-------|--------|
| `test -f docs/HUMAN-HANDOFF.md` | PASS |
| `grep -q "Discord Developer Portal"` | PASS |
| `grep -q "OpenVSX"` | PASS |
| `grep -q "DEFAULT_CLIENT_ID"` | PASS |
| `grep -q "AGENT_MODE_CLIENT_ID"` | PASS |
| `grep -q "SKEL-03"` | PASS |
| `grep -q "SKEL-06"` | PASS |
| `grep -q "SKEL-07"` | PASS |
| `grep -q "variable lead time"` | PASS |
| `grep -q "Phase 6"` | PASS |
| `grep -q "Checklist 1"`, `"Checklist 2"`, `"Checklist 3"` | PASS (3/3) |
| `grep -q "F5"` | PASS |
| `grep -q "kill -TERM"` | PASS |
| `grep -q "kill -INT"` | PASS |
| `grep -q "Show Running Extensions"` | PASS |
| `grep -cE "^- \[ \]"` (≥15 required) | 22 (PASS) |
| `grep -c "^## Checklist [1-3]"` (≥3 required) | 3 (PASS) |
| `grep -c "SKEL-"` (≥3 required) | 7 (PASS) |
| Line count (≥60 required) | 95 (PASS) |
| Zero `***` horizontal rules (plan template hygiene) | 0 matches (PASS) |

## Decisions Made

- Doc lives at `docs/HUMAN-HANDOFF.md` (repo-root-relative) not `.planning/phases/...` — aligns with PRD file-layout convention so future contributors find it via the `docs/` directory.
- Horizontal rules rendered as `---` (standard Markdown) per the plan's explicit IMPORTANT note; the plan itself used `***` only to avoid frontmatter-regex collision.
- Sign-off block requires date + initials per checklist (T-01-14 repudiation mitigation), not a single blanket acknowledgment.
- Marketplace-only fallback for Checklist 2 is documented inline as step 2.6 so Phase 6 planning does not have to rediscover the escape hatch.

## Deviations from Plan

None - plan executed exactly as written. The `<action>` block template in the plan was transcribed verbatim with only the documented `***` → `---` horizontal-rule substitution that the plan itself instructed. All 15 plan-level verification predicates passed on the first run.

## Issues Encountered

None.

## Threat Flags

None new. The plan's `<threat_model>` mitigations are implemented as specified:

- **T-01-04 (Client ID placeholder shipped to public):** Checklist 1 step 1.4 names the exact file (`src/rpc/client.ts`), exact constant (`DEFAULT_CLIENT_ID`), and exact placeholder string (`REPLACE_ME_IN_PHASE_1_HANDOFF`) so the update is a one-line edit with no grep. Step 1.6 instructs `pnpm build && pnpm test` to catch typos. Phase 6 publish gate (future plan) should also grep for `REPLACE_ME_IN_PHASE_1_HANDOFF` and refuse to tag if found.
- **T-01-13 (Phase 6 blocked by late OpenVSX claim submission):** Checklist 2's opening sentence — `approval lead time is variable (hours to weeks)` and `BLOCKS Phase 6` — is unmissable even on a skim. Marketplace-only fallback documented inline (step 2.6). STATE.md blocker note and CONTEXT.md deferred-items cross-reference this doc.
- **T-01-14 (manual acceptance skipped without trace):** Sign-off block at doc end requires date + initials per checklist. Future reviewers can audit whether acceptance was actually performed.

## User Setup Required

The handoff doc IS the user setup. Phase 1 code is complete; the three checklists in `docs/HUMAN-HANDOFF.md` are the remaining user actions. No separate `{phase}-USER-SETUP.md` needed — the handoff doc covers its ground with the same structure (env vars would have been `DEFAULT_CLIENT_ID` override, dashboard config = Discord Developer Portal + OpenVSX namespace, verification = Checklist 3 Dev Host steps).

## Next Phase Readiness

- **Phase 1 complete on paper:** plans 01-01 through 01-05 all have SUMMARY files; all Phase 1 success-criteria are either automated (SKEL-01/02/04/05/08/09/10 enforced by CI) or manually verifiable via `docs/HUMAN-HANDOFF.md` Checklist 3 (SKEL-03/06/07).
- **Phase 2 gate:** Phase 2 (Core pipeline) depends on Checklist 3 confirming the real IPC seam works on a real Dev Host. Checklist 1 and Checklist 2 do NOT block Phase 2 — they block Phase 6. Per the plan's explicit `<verification>` directive: *"Doc does NOT claim Checklist 3 blocks Phase 2"* — complied with ("Phase 2 can start once Checklist 3 confirms the IPC seam works").
- **Phase 6 long-lead items kicked off:** Once the human starts Checklist 1 and Checklist 2 today, both items are in flight while Phases 2–5 build; Phase 6 opens up to publish within its 2-week window even if OpenVSX approval takes the full variable lead time.
- **No blockers.** Handoff doc is written, all 15 plan predicates pass, commit is clean.

## Self-Check: PASSED

- FOUND: docs/HUMAN-HANDOFF.md (95 lines, 22 checkboxes, 3 Checklist sections, 7 SKEL references)
- FOUND commit: 1cb34ea (docs(01-05): add Phase 1 human handoff checklist)
- FOUND: all 15 plan-level automated verification predicates pass

---
*Phase: 01-skeleton-rpc-seam*
*Completed: 2026-04-12*
