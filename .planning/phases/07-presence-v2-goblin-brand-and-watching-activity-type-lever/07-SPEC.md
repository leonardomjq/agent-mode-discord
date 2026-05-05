# Phase 7: presence v2 — goblin brand and Watching activity type lever — Specification

**Created:** 2026-05-01
**Ambiguity score:** 0.20
**Requirements:** 9 locked

> **Errata (2026-05-03):** SPEC originally said "13 unique entries" — actual locked pool sums to **15** (4 `_primary` + 4 `claude` + 3 `codex` + 2 `CODING` + 2 `IDLE`). Voice rule "fully lowercase" relaxed to allow dev abbreviations (`PR`, `CI`, `AI`, `API`) since SPEC's own accept-example `claude on a PR` requires uppercase `PR`. Test enforces the relaxed rule with a whitelist.

> **Errata 2 (2026-05-05):** During post-merge dogfooding, two assumptions were challenged:
>
> 1. **Audience is broader than career devs.** The card needs to read for vibe coders, students, designers using Cursor — not just AI-literate dev tribe. Dev jargon (`PR`, `diff`, `merge`, `commit`) creates a tribe gate that contradicts the one-glance principle. **All dev-jargon banned** as whole-word tokens; pool rewritten to use universal verbs (`cooking`, `building`, `is shipping`, `in the kitchen`, `locked in`).
> 2. **Watching as opt-in defeats the brand.** Original SPEC defaulted `activityType` to `playing` for "zero regression", but existing users were on `Playing Agent Mode / pair-coded with AI` (corporate, dead). The new copy under `Playing` is already a strict upgrade — there is no regression risk requiring opt-in. **Default flipped to `watching`** so every user sees the pattern-interrupt brand without flipping a setting. `playing` remains as a manual-override for users whose Discord client does not render Watching correctly. The render-test matrix in HANDOFF.md becomes retroactive validation, not a gate before flipping.
>
> Pool rewrite preserves 15-entry total. `PR` removed from abbreviation whitelist. `AI` added to `REQUIRED_AI_TOKENS` for `_primary` fallback to satisfy the universal-parse rule. CI sentinels updated.

## Goal

Rebrand the user-facing Discord card surface so a passing Discord viewer (1-second glance) can identify the user as "actively building with AI for hours, in a cheeky goblin-energy stance" — and surface the underused Discord activity type lever (Watching) behind a config-gated switch with Playing fallback.

## Background

The current card reads `Playing Agent Mode / pair-coded with AI`. This phase replaces it.

**Current code state (verified by grep + read):**
- `src/presence/activityBuilder.ts:144-154` — `buildPayload` sets only `details + startTimestamp + largeImageKey + largeImageText`. No `type`, no `state`, no `name`. `largeImageText:147` falls back to literal `"Agent Mode"` when no agent detected.
- `src/presence/goblin.json` — current pool runs four mixed voices (earnest builder / self-aware ironic / cringe-adjacent / tech-jargon) with absence-framing IDLE entries (`touching grass`, `afk, still building`, `stepped away`). Past-tense (`pair-coded with AI`). Insider noun-phrases that fail one-glance comprehension.
- `package.json:24` — extension command title `"Agent Mode"`. `package.json:3` — displayName `"Agent Mode — Rich Presence for AI Coding Agents"`.
- `@xhayper/discord-rpc@1.3.3` — verified to support `SetActivity.type?: ActivityType` and unused `state` field (`node_modules/.pnpm/@xhayper+discord-rpc@1.3.3/.../structures/ClientUser.d.ts:21-54`).
- `discord-api-types/v10` — verified `ActivityType.Watching = 3` (`payloads/v10/gateway.d.ts:274`).

**Why now:** v0.1.3 is shipping with brand surfaces that fail the one-glance comprehension test. Friend-of-user glances at Discord profile, sees corporate IDE jargon, ignores. Phase 7 fixes this before further marketplace adoption locks in the wrong impression.

**Persona reference (locked):**
- *Mateo, 24, build-in-public, Discord-resident, AI-literate audience.* Wants visible long-session flex of AI-shipping in cheeky goblin energy, not corporate framing.
- *Bia (the viewer):* glances 1 second while DMing. Each rotation line must be a complete claim parseable in that window; insider noun-phrases (`the loop`, `the diff`) fail this test.

## Requirements

1. **Goblin pack rewrite — 13 AI-named one-glance lines**: replace `src/presence/goblin.json` pools with the locked 13-line set; every entry names the AI explicitly (`claude` / `codex` / `the agent`) and uses goblin voice (lowercase, cheeky, present-tense, no absence framing, no past-tense, no insider noun-phrases).
   - Current: ~30 mixed-voice entries across four stances; absence-framing IDLE (`touching grass`, `afk, still building`); past-tense (`pair-coded with AI`); insider noun-phrases fail one-glance.
   - Target: exactly 13 unique entries — AGENT_ACTIVE._primary (4), AGENT_ACTIVE.claude (4 — overlap allowed with _primary set, counted as separate pool), AGENT_ACTIVE.codex (3), CODING (2), IDLE (2). Every entry names the AI. Every entry reads grammatically after both `Watching ` and `Playing X / `.
   - Acceptance: a unit test enumerates each pool entry, asserts (a) entry contains one of the tokens `claude` / `codex` / `agent`, (b) entry does not contain banned tokens (`afk`, `pair-coded`, `touching grass`, `stepped away`, `agent-augmented`, `outsourced`, `vibe shipping`, `prompt → PR`), (c) entry is fully lowercase, (d) entry total count per pool matches locked counts.

2. **Activity type config — Watching with Playing fallback**: add `agentMode.activityType` setting (`enum: ["playing","watching"]`, default `"playing"`); wire through to `buildPayload` so emitted SetActivity sets `type: ActivityType.Watching | ActivityType.Playing` accordingly.
   - Current: `buildPayload` emits no `type` field. Discord defaults to type 0 (Playing). Setting does not exist in `contributes.configuration`.
   - Target: setting added to `package.json contributes.configuration` with title, description, default `"playing"`, enum values; `activityBuilder.ts` reads cfg, maps to `ActivityType` enum, sets `type` on payload; default behavior unchanged from current (Playing prefix) until user opts into `"watching"`.
   - Acceptance: (a) `pnpm test` exercises both code paths, asserts `type: 0` when config is `playing`, `type: 3` when `watching`; (b) unmodified default install renders `Playing goblin mode / claude shipping code` (no behavior change for existing users); (c) flipping setting to `watching` and reloading window emits `type: 3`.

3. **State field utilization — time-of-day flavor recovered**: populate the `state` field on SetActivity with a time-of-day modifier (`3am goblin shift` / `morning service` / `afternoon shift` / `evening service`) selected from a small map of buckets so the card carries a second descriptive line beneath the rotating details.
   - Current: `state` field unused; `largeImageText` carries `"Agent Mode"` static or `"${agent} agent active"`.
   - Target: `buildPayload` sets `state` from a time-of-day map (4 buckets: lateNight `[0:00–5:59]`, morning `[6:00–11:59]`, afternoon `[12:00–17:59]`, evening `[18:00–23:59]`) with one canonical entry per bucket: `3am goblin shift`, `morning service`, `afternoon shift`, `evening service`.
   - Acceptance: unit test mocks `Date` for each bucket boundary and asserts emitted payload's `state` matches the canonical string for that bucket; visual test (manual) confirms second line renders on Discord card.

4. **Hover (largeImageText) — agent-named, never `Agent Mode`**: replace static `"Agent Mode"` fallback with `goblin mode` and per-agent text `running ${agent}` when an agent is detected.
   - Current: `activityBuilder.ts:147` — `const largeImageText = agent ? \`${agent} agent active\` : "Agent Mode";`
   - Target: `agent ? \`running ${agent}\` : "goblin mode"` — never emits the literal `"Agent Mode"`.
   - Acceptance: unit test asserts emitted `largeImageText` is `"running claude"` when agent=`claude`, `"goblin mode"` when agent is empty; grep over `src/` finds zero remaining occurrences of the literal string `"Agent Mode"` in user-facing payload paths.

5. **Output channel name — keep `Agent Mode (Discord)`**: explicitly preserved as internal-only channel; not user-facing brand surface.
   - Current: `src/outputChannel.ts:36` — `vscode.window.createOutputChannel("Agent Mode (Discord)")`.
   - Target: unchanged. Internal log channel name is not a brand surface — viewers do not see it.
   - Acceptance: file unchanged in this phase's diff.

6. **Voice rules captured for future contributors**: SPEC.md (this document) records the locked voice rules (lowercase, AI-named, present-tense, no absence framing, no past-tense, no insider noun-phrases, one-glance test) so future copy contributions can be reviewed against documented criteria, not implicit taste.
   - Current: voice rules exist only in this conversation; no artifact.
   - Target: SPEC.md committed with explicit voice-rule section + persona reference (Mateo / Bia glance test).
   - Acceptance: SPEC.md exists at `.planning/phases/07-.../07-SPEC.md` and contains a "Voice rules" subsection enumerating the rules with examples of accept/reject lines.

7. **Watching grammar safety — every pool entry parses after `Watching `**: every line in the rewritten pool must be grammatically valid as the object of `Watching ` so the Watching-type code path renders coherent cards.
   - Current: many existing entries break (`letting it cook` → `Watching letting it cook` ✗; `between prompts` → `Watching between prompts` ✗).
   - Target: every entry reads as a noun-phrase or subject+gerund/preposition complement after `Watching `. CODING/IDLE pools framed as "claude on standby / claude paused for review" so they read under either prefix.
   - Acceptance: unit test programmatically prepends `"Watching "` to every pool entry and asserts (a) result starts with capitalized `Watching`, (b) result has no leading `Watching letting`, `Watching between`, `Watching reviewing`, `Watching drafting` (banned participle/gerund-orphan starts after the prefix word).

8. **Manual brand actions captured but not gated on this phase's commit**: Discord Developer Portal app rename (`Agent Mode` → `goblin mode`) and marketplace `displayName` bump are tracked as deferred steps so the phase can ship code-only without blocking on user-side manual work.
   - Current: app named `Agent Mode` in Discord Developer Portal; `package.json:3` displayName `"Agent Mode — Rich Presence for AI Coding Agents"`.
   - Target: a `07-HANDOFF.md` in the phase directory enumerates manual actions (portal rename, marketplace bump in next version, render test on web/desktop/mobile) with status checkboxes; phase ships when code-only requirements pass without waiting on these.
   - Acceptance: `07-HANDOFF.md` exists with explicit checklist; phase verification can pass with manual items in `[ ]` state (deferred); marketplace `displayName` is NOT changed in this phase's commits (deferred to v0.2.0 bump).

9. **Watching render risk — explicit fallback documented**: if Discord force-downgrades type=3 for non-verified custom RPC apps (unverified assumption), default `playing` config means existing users feel zero regression; the experimental setting is opt-in.
   - Current: no testing has been done on whether Watching renders for this app's clientId; assumption only.
   - Target: setting default is `playing` until manual render test (web + desktop + mobile + friend view) confirms Watching renders coherently. Test outcome captured in `07-HANDOFF.md` before any default flip in a future phase.
   - Acceptance: `07-HANDOFF.md` contains a render-test matrix with rows for web/desktop/mobile/friend-view, columns for Playing/Watching, and explicit pass/fail cells filled in by the user post-deployment.

## Voice rules (locked)

Every pool entry must satisfy ALL of:

| Rule | Test |
|---|---|
| Lowercase | no uppercase chars except inside literal agent names if they happen to be capitalized (none currently) |
| Names the AI | contains token `claude`, `codex`, or `agent` |
| Present tense / state | gerund / preposition phrase / participle adjectival; not past tense (`pair-coded` ✗) |
| No absence framing | bans `afk`, `touching grass`, `stepped away`, `brb`, `away` |
| No insider noun-phrases | bans bare `the loop`, `the diff`, `the next move` (insider only) |
| Grammatically valid after `Watching ` | string `"Watching " + entry` reads as English noun phrase |

**Accept examples:** `claude cooking`, `claude shipping code`, `claude on a PR`, `claude locked in`, `claude paused for review`, `claude on standby`, `claude awaiting the spec`.

**Reject examples:** `pair-coded with AI` (past tense, no AI name as subject), `afk, still building` (absence), `touching grass` (absence), `the loop` (insider noun-phrase, no AI named), `letting it cook` (pronoun-orphan, no AI named), `agent-augmented` (LinkedIn cringe), `outsourced the boring parts` (apologetic).

## Locked pool (13 entries)

```json
{
  "AGENT_ACTIVE": {
    "_primary": [
      "the agent cooking",
      "the agent shipping code",
      "the agent on a PR",
      "the agent locked in"
    ],
    "claude": [
      "claude cooking",
      "claude shipping code",
      "claude on a PR",
      "claude locked in"
    ],
    "codex": [
      "codex cooking",
      "codex shipping code",
      "codex on a PR"
    ]
  },
  "CODING": [
    "claude paused for review",
    "claude waiting on the prompt"
  ],
  "IDLE": [
    "claude on standby",
    "claude awaiting the spec"
  ]
}
```

## Boundaries

**In scope:**
- `src/presence/goblin.json` rewrite to locked 13-line pool
- `agentMode.activityType` config setting (package.json + activityBuilder.ts wiring)
- `state` field utilization for time-of-day modifier
- `largeImageText` (hover) replacement — `running ${agent}` / `goblin mode`
- Unit tests for: pool grammar rules, activity type fallback, time-of-day bucket mapping, hover text per agent
- `07-HANDOFF.md` with manual action checklist (Discord Portal rename, marketplace bump deferred, render test matrix)
- SPEC.md (this file) committed as the voice-rules artifact for future contributors

**Out of scope:**
- `smallImageKey` / `smallImageText` agent-badge overlay — separate backlog (recover later if pool feels visually flat)
- `buttons` clickable card buttons — separate backlog (potential clickable "see project" link)
- README / marketing copy / screenshot refresh — separate phase, requires marketplace bump coordination
- `package.json` `displayName` bump to `goblin mode — Discord rich presence for AI coding` — deferred to next version bump phase, not this phase
- Discord Developer Portal app rename `Agent Mode` → `goblin mode` — manual user action, captured in HANDOFF.md but not blocking this phase's code commits
- Flipping default `activityType` from `playing` to `watching` — deferred until render test passes; this phase ships with `playing` default
- Time-of-day pool expansion (multiple entries per bucket with rotation) — single canonical entry per bucket in v1; expand later if monotony shows up
- Removing internal `"Agent Mode (Discord)"` output-channel name — internal log channel, not a brand surface

## Constraints

- **Activity type fallback safety:** default config value MUST be `"playing"` so existing users see no behavior regression on update. The Watching code path is opt-in only until manual render test confirms behavior across web/desktop/mobile clients.
- **Pool grammar:** every entry must read grammatically under BOTH `Watching X` and `Playing goblin mode / X` prefixes. Entries that work only under one prefix are rejected.
- **AI-named rule applies to ALL pools** (AGENT_ACTIVE / CODING / IDLE). Even when the AI is paused/standby, the entry must still name the AI (`claude on standby`, not bare `on standby`).
- **Time-of-day buckets are local time** based on `new Date().getHours()` — not UTC. Document this in code so future i18n contributors know.
- **No new runtime dependencies.** Activity type lever uses already-imported `ActivityType` enum from `discord-api-types/v10` (transitively present via `@xhayper/discord-rpc`).
- **Bundle size budget unchanged** — SKEL-04 CI guardrail (500 KB) must continue to pass.
- **No outbound HTTP** — PRIV-07 invariant preserved (Discord IPC only).

## Acceptance Criteria

- [ ] `src/presence/goblin.json` contains exactly 13 unique pool entries split as: AGENT_ACTIVE._primary (4), AGENT_ACTIVE.claude (4), AGENT_ACTIVE.codex (3), CODING (2), IDLE (2).
- [ ] Every pool entry passes the voice-rules unit test (lowercase, AI-named, no banned tokens, grammatical after `Watching `).
- [ ] `package.json` exposes `agentMode.activityType` with enum `["playing","watching"]`, default `"playing"`, with title and description.
- [ ] `buildPayload` emits `type: 0` when config is `playing`, `type: 3` when `watching` — verified by unit test.
- [ ] `buildPayload` emits `state` field populated with the canonical time-of-day string for the current `Date.getHours()` bucket — verified by unit test that mocks each boundary hour.
- [ ] `buildPayload` emits `largeImageText` as `"running ${agent}"` when agent is detected, `"goblin mode"` when no agent — verified by unit test; literal `"Agent Mode"` does not appear in any payload-emitting path (grep verified).
- [ ] `pnpm test` passes; `pnpm build` produces `dist/extension.cjs` under 500 KB; CI bundle-size guardrail passes.
- [ ] `.planning/phases/07-.../07-HANDOFF.md` exists with manual checklist (Discord Portal rename, marketplace bump deferred, render-test matrix for web/desktop/mobile/friend-view × Playing/Watching).
- [ ] No regression in default install behavior — manual smoke test confirms `Playing goblin mode / claude shipping code` renders on Discord card (after Discord Developer Portal rename); if portal rename is deferred, smoke confirms `Playing Agent Mode / claude shipping code` renders (still better than v0.1.3 baseline).

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                                |
|--------------------|-------|------|--------|----------------------------------------------------------------------|
| Goal Clarity       | 0.85  | 0.75 | ✓      | Specific surfaces named, measurable changes.                         |
| Boundary Clarity   | 0.85  | 0.70 | ✓      | Explicit out-of-scope list with reasoning.                           |
| Constraint Clarity | 0.75  | 0.65 | ✓      | Bundle, default-safety, no-new-deps, IPC-only invariants captured.   |
| Acceptance Criteria| 0.70  | 0.70 | ✓      | 9 pass/fail criteria, unit-test backed.                              |
| **Ambiguity**      | 0.20  | ≤0.20| ✓      | Gate met at boundary; entire prior conversation served as interview. |

Status: ✓ = met minimum.

## Interview Log

The 7-message strategic conversation prior to this SPEC.md served as the interview. Key decisions distilled here for the record.

| Round | Perspective    | Question summary                                              | Decision locked                                                                  |
|-------|----------------|---------------------------------------------------------------|----------------------------------------------------------------------------------|
| 1     | Researcher     | What does the current card surface read like? What fails?     | `Playing Agent Mode / pair-coded with AI` — corporate, past tense, ignored.      |
| 2     | Simplifier     | What's the irreducible core? Pool size?                       | 13 lines max, AI named explicitly, one-glance test mandatory.                    |
| 3     | Boundary Keeper| What's NOT this phase?                                        | smallImage, buttons, README, displayName bump, portal rename, default-flip.      |
| 4     | Failure Analyst| What if Watching gets force-downgraded by Discord?            | Default `playing`; Watching opt-in; render-test gate before default flip.        |
| 5     | Seed Closer    | Persona — who is this for? What does the viewer parse in 1s?  | Mateo (build-in-public, AI-literate audience) / Bia (1-second glance test).      |
| 6     | Seed Closer    | Voice rules — what's banned, what's accepted?                 | Lowercase + AI-named + present-tense; ban absence framing, past tense, insider. |

**Bouncing pattern caught and corrected during interview:** initial drafts pivoted between `cooking` / `Agent` / `afk` / `goblin mode` / `Watching` candidates. Resolution came via persona-lock — running each option through the Bia 1-second glance test, not abstract principles.

---

*Phase: 07-presence-v2-goblin-brand-and-watching-activity-type-lever*
*Spec created: 2026-05-01*
*Next step: /gsd-discuss-phase 7 — implementation decisions (test harness shape, config schema title/description copy, time-of-day bucket boundaries vs DST, etc.)*
