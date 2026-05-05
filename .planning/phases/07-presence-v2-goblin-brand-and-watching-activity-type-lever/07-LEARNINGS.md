---
phase: 07
phase_name: "presence v2: goblin brand and Watching activity type lever"
project: "Agent Mode — Discord Rich Presence for Claude Code"
generated: "2026-05-05"
counts:
  decisions: 8
  lessons: 10
  patterns: 12
  surprises: 10
missing_artifacts:
  - "07-VERIFICATION.md (verifier output captured in chat transcript only)"
  - "07-UAT.md (UAT happened via dogfooding + screenshot iteration, not formal artifact)"
---

# Phase 7 Learnings: presence v2 — goblin brand and Watching activity type lever

## Decisions

### App-name = `goblin mode` (lowercase, two words, treated as one phrase)
Brand banner for Discord card title — owns cheek + present + AI-native + building-energy. Lowercase enforces stance. Already half-anchored in codebase as the `goblin` pack id.

**Rationale:** Tested against Bia 1-second glance. Recognized phrase (2022 word-of-year still alive in dev circles). Outsiders parse instantly. Tools that won 2020s (Cursor, Linear, Raycast, Bun, Vite) didn't name themselves literally — they evoked. `goblin mode` fits that pattern.
**Source:** 07-SPEC.md §"Locked pool" + chat strategic conversation rounds 1–6

---

### Watching default with Playing fallback (re-grounded post-merge)
`agentMode.activityType` default flipped from `playing` (initial SPEC) to `watching` (post-dogfood errata 2). Setting remains as manual override.

**Rationale:** Original SPEC hedged "zero regression" but the new copy under either prefix is already a strict upgrade over v0.1.3's `pair-coded with AI`. No regression risk required opt-in. Watching as default ships the pattern interrupt every user sees without flipping a setting.
**Source:** 07-SPEC.md "Errata 2" + e89864a commit message

---

### Universal-parse copy rule (no dev jargon)
Every pool entry must parse for non-developers (vibe coders, students, designers). Banned: `PR`, `diff`, `merge`, `commit`, `repo`, `branch`, `pull request` (whole-word, case-insensitive).

**Rationale:** Audience for this extension is broader than career devs — includes anyone using Cursor / Claude / Codex regardless of dev tribe. Dev jargon = tribe gate that contradicts the one-glance principle.
**Source:** 07-SPEC.md "Errata 2" + test/presence.goblin.voice.test.ts BANNED_DEV_JARGON

---

### Local `ActivityType` enum mirror (not import from `discord-api-types/v10`)
Production code AND tests declare `const ActivityType = { Playing: 0, Watching: 3 } as const` locally instead of importing the official enum.

**Rationale:** pnpm strict resolution does not hoist transitive deps. SPEC §Constraints forbids new direct deps. Discord IPC consumes integers (Playing=0, Watching=3), not enum identity — local record is observationally equivalent over the wire.
**Source:** 07-04-SUMMARY.md, 07-05-SUMMARY.md (auto-fixed Rule-3 deviation in both)

---

### SPEC-verbatim ships when plan and SPEC math conflict
Plan 07-01's `<verify>` script asserted `length === 13` but SPEC §Locked pool sums to 15 (4+4+3+2+2). Executor shipped SPEC content (verbatim per `<action>` directive: "EXACTLY this content") and flagged the verify-script arithmetic as deviation.

**Rationale:** SPEC is the source of truth, not the plan's assertion. Voice-rules unit test (plan 07-02) encodes actual rules dynamically, not hardcoded count. Errata block in SPEC corrected the math.
**Source:** 07-01-SUMMARY.md "Decisions Made" + 07-SPEC.md "Errata 2026-05-03"

---

### `activityType` is a REQUIRED (non-optional) field on `AgentModeConfig`
Forces fixture-builder updates in the same plan as the schema change.

**Rationale:** More type-safe than optional + default-fallback. Co-locates the schema change with every consumer's update so Wave 0 ends typecheck-green. Plan 07-03 owns fixture updates; plan 07-05 owns NEW behavioral tests.
**Source:** 07-03-SUMMARY.md "key-decisions"

---

### Past-tense rule = finite banned-action-verb list (not generic regex)
`/\bWORD\b/i` whole-word match over a curated 13-verb list (`shipped`, `coded`, `built`, `merged`, `wrote`, `paired`, `outsourced`, `augmented`, `pair-coded`, `pushed`, `committed`, `deployed`, `refactored`).

**Rationale:** Generic `\w+ed\b` regex would false-positive on idiomatic adjectival uses (`locked in`, `paused for review`) that the SPEC accepts. Finite list catches regression class without false positives, append-only when new regressions surface.
**Source:** 07-02-SUMMARY.md "patterns-established" + plan-check M3 resolution

---

### File-grep guardrail scoped by directory (not file allowlist)
Test greps `src/presence/` for literal `"Agent Mode"`; REQ-5's preserved `outputChannel.ts` exclusion happens automatically by directory boundary.

**Rationale:** Allowlist drift is a maintenance hazard. Directory boundary is durable — future contributors can't accidentally re-introduce the literal in payload-emitting code.
**Source:** 07-05-SUMMARY.md "key-decisions"

---

## Lessons

### "Default opt-in" defeats the brand — default what you believe in
Initial SPEC made Watching opt-in via setting for "zero regression" safety. Real user behavior: almost nobody flips an opt-in setting → almost nobody experiences the brand. Caught only during dogfood when card showed `Playing` despite the strategic conversation pitching Watching as the killer move.

**Context:** Triggered post-merge re-grounding (Errata 2). Recovery cost: one extra commit + SPEC errata block. Earlier-default would have saved the round trip.
**Source:** 07-SPEC.md "Errata 2" + chat re-grounding round

---

### Dev jargon is a tribe gate that contradicts the one-glance rule
`PR` shipped in initial pool ("the agent on a PR", "claude on a PR"). Looked fine in code review. Failed only when user asked "people who are not developers and are building with AI don't even know what a PR is."

**Context:** Audience for AI-coding tools in 2026 includes vibe coders, students, designers — not just career devs. Earlier audience definition (Mateo persona) was too narrow.
**Source:** Chat re-grounding round + 07-SPEC.md Errata 2

---

### Persona-lock kills design-bouncing
Strategic conversation bounced between candidates (`cooking` → `Agent` → `afk` → `goblin mode` → `Watching` → reverted → restored). Each turn ran options against fresh principles → every framing seemed plausible. User called it out: "you keep changing your mind".

**Context:** Resolution came from naming the persona (Mateo, 24, build-in-public, AI-literate Discord audience) + viewer scenario (Bia, 1-second glance during DM). With persona locked, every option got run through the same test once. No bouncing.
**Source:** Chat strategic conversation rounds 1–6 + 07-SPEC.md Interview Log

---

### SPEC math typos compound — dynamic test caught it, not human eyes
SPEC text said "13 unique entries" but locked pool sums to 15. Two human reviewers (planner + plan-checker) missed it. Voice-rules test asserted `total === 13` literally, failed on merge.

**Context:** Dynamic count assertions in tests (vs hardcoded literals matching the SPEC's prose number) catch this class of error. Errata corrected SPEC + test in same fix commit.
**Source:** 07-SPEC.md "Errata 2026-05-03" + commit 3037c7b

---

### Cursor extension cache requires Cmd+Q, not Reload Window
Hit this twice in the session — once on initial dogfood (saw `prompt → PR` from old pool), once on user-confirmed reload. Reload-window picks up extension binary changes but extension cache may persist.

**Context:** SPEC-level brand surface dogfooding requires full app quit on Cursor (and likely VS Code). Document in any future render-test runbooks.
**Source:** Chat dogfood iteration

---

### Cursor marketplace proxy (cursorapi.com) returns 503 + stale cache on publish day
`cursor --install-extension <name> --force` hit "Server returned 503" 8 hours after marketplace publish. Workaround: build local VSIX (`npx @vscode/vsce package --no-dependencies`) and `cursor --install-extension ./*.vsix --force` to bypass the proxy.

**Context:** Cursor doesn't pull from VS Code Marketplace direct — proxies via marketplace.cursorapi.com which has stale-cache + outage windows. Local VSIX is the reliable dogfood path.
**Source:** Chat marketplace troubleshooting earlier in session

---

### Worktree cwd leaks into orchestrator pwd across bash calls
After agent's worktree-isolated execution completed, subsequent `Bash` tool calls ran from the agent's worktree directory (where `node_modules` had been removed by worktree teardown), causing `pnpm test` to fail with "vitest: command not found". Required explicit `cd /Users/leonardojaques/projects/personal/richagenticpresence-discord` to recover.

**Context:** Bash tool persists cwd between calls; isolation=worktree changes it. Always cd back to project root after worktree-isolated agents return.
**Source:** Chat Wave 1 merge troubleshooting

---

### Squash merge dropped local-only planning commits — push planning commits to feature branch, not main
Planning commits (3b7a7cb, 8051c0d, 1beb17c) committed to local main during /gsd-spec-phase + /gsd-plan-phase, never pushed to origin/main. Squash merge consolidated all phase-07 work (including those commits) into one commit on origin/main. Local main diverged 4-vs-1 from origin/main → required `git reset --hard origin/main` to resync.

**Context:** GSD orchestrator commits planning artifacts directly on whatever branch is current. If branch is main, those commits never go through PR. Future fix: branch off main BEFORE invoking /gsd-spec-phase or /gsd-plan-phase.
**Source:** Chat post-merge resync

---

### CI guardrail sentinels need updating WITH pool changes, not after
Plan 07-01 only specified rewriting `goblin.json`. Executor caught that `scripts/check-pack-inlined.mjs` asserted v1 sentinels that no longer existed — would fail CI immediately. Auto-fixed (Rule 3 deviation) by updating sentinels in same commit.

**Context:** Pattern: pool revision + sentinel update is a single atomic change. Future plan templates should include sentinel-update task explicitly.
**Source:** 07-01-SUMMARY.md "Decisions Made"

---

### Discord Watching prefix uses `details` field as headline (not app name)
SPEC initially assumed app name `goblin mode` would headline both prefixes. Discord enum docs (`Watching {details}`) revealed details field becomes the headline under Watching — app name moves to secondary slot. Required pool-grammar rule: every entry reads grammatically after `Watching ` (banned `Watching letting`, `Watching between`, `Watching reviewing`, `Watching drafting`).

**Context:** Discord activity-type rendering varies by type. Always check official enum doc for `{details}` vs `{name}` placement before assuming card layout.
**Source:** 07-SPEC.md "Critical finding" + 07-02 BANNED_AFTER_WATCHING

---

## Patterns

### Persona-locked design discipline
Name the persona (Mateo) + viewer scenario (Bia, 1-second glance) → run every option through that single test → commit on first option that passes → don't reconsider on fresh framings.

**When to use:** Any creative/strategic decision with multiple plausible candidates. The bar to flip a decision becomes "does this improve the persona test outcome?", not "is there a new framing where this seems better?"
**Source:** Chat strategic conversation final round + 07-SPEC.md Persona reference

---

### SPEC-as-source-of-truth + executor ships verbatim
When plan and SPEC conflict, executor ships SPEC content + flags the deviation. Catches plan-derivation errors (math typos, accept-example inconsistencies) without re-running planning.

**When to use:** Any phase where SPEC defines locked content and plans translate it into tasks. SPEC errata blocks correct mismatches post-execution rather than blocking on planning re-runs.
**Source:** 07-01-SUMMARY.md + 07-SPEC.md errata pattern

---

### Voice-rules CI gate — per-entry granular `it()` reporting
Every voice rule emits one `it()` per (pool, entry) tuple. Failure messages name the offending entry directly: `is lowercase [AGENT_ACTIVE:claude] "claude on a PR"`.

**When to use:** Any test enforcing rules over a content corpus. Granular `it()` blocks make PR-review failure diagnosis trivial vs. one aggregate test that requires drilldown.
**Source:** test/presence.goblin.voice.test.ts (216 lines, 86 voice tests + pool counts + timeOfDay)

---

### Frame-sequence flattening in voice tests
String[] entries (animated frames) flattened to per-frame strings before applying voice rules. Future-proofs animated additions.

**When to use:** Any rule that must apply per-rendered-frame, not per-entry. Locks future contributors from sneaking bad copy through frame arrays.
**Source:** 07-02 SUMMARY.md flatten() helper

---

### Wave-end typecheck-green invariant via co-located fixture updates
When adding required fields to shared types, the same plan that mutates the type updates every fixture builder. Wave ends typecheck-green so the next wave can stack.

**When to use:** Any non-optional schema/type addition. Prevents red-bar interim states between waves.
**Source:** 07-03 + 07-04 SUMMARY.md (plan 07-04 ALSO migrates 7 existing test call sites alongside the type change)

---

### Three-arg `buildPayload(text, state, cfg, now?)` — required `cfg` carries live-reread
`cfg` is required (not module-cached) so `D-24` live-reread contract carries through to the wire payload. `now` defaults to `new Date()` for production but is injectable for time-bucket tests.

**When to use:** Any pure-core builder that consumes config + clock. Required-cfg + injectable-clock is the test-friendly + production-correct pattern.
**Source:** 07-04-SUMMARY.md patterns-established

---

### Per-key static maps co-located with builders (`as const` records)
`TIME_OF_DAY_STATE`, `AGENT_ICON_KEYS` declared as `as const` records adjacent to `buildPayload`. Pure-core tests can grep/assert without test fixtures.

**When to use:** Static lookup tables that belong to a single consumer. Avoids extracting to a separate module when there's one caller.
**Source:** 07-04-SUMMARY.md

---

### HANDOFF.md per phase for deferred manual user actions
Single artifact captures third-party dashboard work (Discord Developer Portal rename), version-coupled changes (marketplace displayName bump), and post-deploy field tests (render-test matrix). Unchecked checkboxes do NOT block phase verification.

**When to use:** Any phase whose acceptance can pass code-only but has user-side gates. Prevents losing manual TODOs to chat scrollback.
**Source:** 07-06-SUMMARY.md + 07-HANDOFF.md

---

### Render-test matrix as gate artifact for opt-in features
6 surface rows × 2 mode columns = 12 cells. Every cell must be filled before flipping default. Locks experimental features behind real-world rendering validation.

**When to use:** Any setting whose visual rendering can't be unit-tested (Discord IPC behavior, browser-specific renders, mobile vs desktop). Cheap structure, prevents shipping unverified defaults.
**Source:** 07-HANDOFF.md §2

---

### Local file-grep guardrail unit test (directory-scoped)
A vitest file that reads source under `src/presence/` and asserts banned literal strings have zero matches. Cheap, fast, hard to bypass.

**When to use:** Any literal-string ban that survives refactors and copy-pasta. Directory boundary > file allowlist for durability.
**Source:** 07-05-SUMMARY.md grep guardrail

---

### Octopus merge for parallel-wave worktree branches
When wave plans modify disjoint files, single `git merge` consolidates 4+ worktree branches into one merge commit. No sequential cherry-pick.

**When to use:** Wave executions where files_modified overlap analysis confirms no conflicts. Single merge commit keeps history readable.
**Source:** Wave 0 merge commit 8dd185c

---

### Strategic conversation as Socratic-interview substitute
When SPEC ambiguity is already low because of extensive prior strategic conversation, the entire conversation can serve as the spec-phase interview. Write SPEC.md directly with errata-friendly format for post-merge corrections.

**When to use:** Phases preceded by deep design discussion. Skip 6-round Socratic interview, log decisions in "Interview Log" table after the fact, write SPEC at gate threshold (0.20). Errata blocks handle subsequent corrections without re-running planning.
**Source:** 07-SPEC.md "Interview Log" + chat spec-phase invocation

---

## Surprises

### SPEC voice rule conflicted with SPEC's own accept-example
"Fully lowercase" rule rejected `claude on a PR` — which SPEC explicitly listed as an accept-example. Required errata + abbreviation whitelist (`PR`, `CI`, `AI`, `API`, `URL`, `JSON`, `TS`, `JS`).

**Impact:** One extra fix commit (3037c7b) on Wave 0 merge. Caught by voice-rules test, not pre-merge review.
**Source:** 07-SPEC.md "Errata 2026-05-03" + commit 3037c7b

---

### "13 unique entries" math wrong (actually 15)
Two reviewers (planner + plan-checker) read SPEC and missed the arithmetic. Voice-rules test caught it on first integration run.

**Impact:** Errata block + test assertion update. No code change; SPEC text correction only.
**Source:** Same as above

---

### Cursor extension cache survived `Developer: Reload Window`
Hit twice in the session. Reload-window is supposed to pick up extension changes, but cache layer (or leadership lockfile from Phase 5.2) held the old extension live. Required Cmd+Q full quit.

**Impact:** ~10 minutes of dogfood confusion ("why does it still show old copy?") before Cmd+Q recovered. Pattern noted in chat for future render-tests.
**Source:** Chat dogfood iteration (twice)

---

### `cursor --install-extension <name> --force` returned 503 from cursorapi.com proxy
Marketplace publish was 8 hours old. Cursor's proxy hadn't synced yet. Workaround: local VSIX install bypasses the proxy entirely.

**Impact:** ~30 minutes of marketplace-troubleshooting before VSIX bypass landed. Lesson now captured in user-memory project_marketplace_constraints.md.
**Source:** Chat earlier in session + WebSearch verification of Cursor forum reports

---

### Squash merge dropped local-only planning commits
Local main diverged 4-vs-1 from origin/main after squash. Phase 7 work was on origin/main inside the squash commit, but local-only commits (planning artifacts) had never been pushed.

**Impact:** Required `git reset --hard origin/main` + branch cleanup. No data loss (squash contained everything), but confusing initial state.
**Source:** Chat post-merge resync

---

### Discord client timer rendering jumps in 10-second increments
Card showed elapsed timer freezing then jumping ~10s instead of smooth 1s/1s ticks. Initial assumption: our `startTimestamp` was being mutated. Investigation showed `startTimestamp` is stable from state machine (STATE-05 invariant). User confirmed it was a Discord client artifact, resolved on its own next session.

**Impact:** Triage time only; no code change. Preserved learning for future render-test reports — Discord client rendering can have transient bugs unrelated to our payload.
**Source:** Chat dogfood iteration

---

### pnpm strict resolution does not hoist `discord-api-types/v10`
Required local enum mirror in BOTH production code (`src/presence/activityBuilder.ts`) AND tests (`test/presence.activityBuilder.test.ts`). Two auto-fixed Rule-3 deviations from same root cause.

**Impact:** Two near-identical local-record blocks. Code comments document the rationale + reference to upstream enum file. No new runtime deps added (constraint preserved).
**Source:** 07-04-SUMMARY.md + 07-05-SUMMARY.md

---

### Watching prefix uses `{details}` field as headline (not app name)
Initial brand pitch assumed `goblin mode` headline under both prefixes. Discord enum doc revealed Watching renders as `Watching {details}` — details field becomes the headline. Required pool-grammar safety rule (every entry must read after `Watching `).

**Impact:** SPEC was updated mid-strategic-conversation to add the grammar rule. Avoided shipping broken cards under Watching.
**Source:** 07-SPEC.md "Critical finding" mid-spec-conversation

---

### The biggest design pivot came from POST-MERGE dogfooding
Initial SPEC was reviewed by planner + plan-checker + verifier and PASSED all gates. The "drop dev jargon" + "default Watching" reframing came only when the user saw `the agent on a PR` on their actual Discord card and asked: "people who aren't developers don't know what a PR is. Also, if I have to change a setting for it to be Watching, what's the point?"

**Impact:** One re-grounding commit (e89864a) on the open PR. SPEC errata block added. Demonstrates that real-world UAT catches assumptions that pre-merge gates miss — particularly assumptions about audience and default behavior.
**Source:** Chat re-grounding round + commit e89864a

---

### Brand-stance bouncing pattern (cooking → Agent → afk → goblin → Watching)
Strategic conversation bounced through 6+ candidates before locking. User explicit feedback: "you keep changing your mind". Discipline (persona-lock + viewer scenario) emerged AFTER the bouncing, not before.

**Impact:** ~3 message rounds of churn before the discipline locked. Once locked, the same persona test resolved every subsequent question without bounce.
**Source:** Chat strategic conversation rounds 1–7

---
