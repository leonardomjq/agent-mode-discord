# Fresh-context prompt — paste after /clear

Copy everything between the lines below into your next message after `/clear`.

---

## Context for this session

I just finished a multi-day saga shipping Phase 7 (brand rebuild) + getting v0.3.0 live on MS Marketplace. The Marketplace publish was blocked for 9 attempts by an auto-rejection scan. Root cause: extension slug `agent-mode-discord` containing `-discord` was tripping MS's "suspicious content" scanner. Renamed slug to `goblin-mode` → passed instantly.

**MUST read before doing anything:**
1. `.planning/MARKETPLACE-PUBLISH-SAGA.md` — full ordeal log + locked-in causes + things NOT to redo
2. `.planning/phases/07-presence-v2-goblin-brand-and-watching-activity-type-lever/07-LEARNINGS.md` — Phase 7 design decisions and brand stance
3. `.planning/phases/07-.../07-SPEC.md` — voice rules, persona (Mateo / Bia), locked decisions

**Key project rule:** this extension is a **Discord** project. Built for Discord users. Must be searchable on the Marketplace via Discord-related queries. The slug-rename only affected the `name` field — Discord must still appear loud in description, keywords, README. Marketplace scanner ALREADY proved fine with "Discord" in those fields (only the slug was blocked).

## Current state (verified live)

- **MS Marketplace:** `leonardomjq.goblin-mode` v0.3.0 LIVE  
  https://marketplace.visualstudio.com/items?itemName=leonardomjq.goblin-mode
- **OpenVSX (new):** `leonardomjq.goblin-mode` v0.3.0 LIVE
- **OpenVSX (orphaned):** `leonardomjq.agent-mode-discord` v0.2.4 still up, ~428 stranded users
- Branch: `main`. Last commit: `057542d release(v0.3.0): T4 — slug rename`
- Tests: 449/449 green. Bundle: 222 KB (44% of 500 KB budget).

## What's broken (from the test-ladder triage)

During the publish-test ladder, I stripped/minimized things to test what was tripping the scan. Now that we know slug was the only cause, those minimizations need reverting:

| File | Current state (broken) | Restore to |
|---|---|---|
| `readme.md` | 20-line minimal stub (T1 strip) | Full README with Discord branding, "goblin mode" hero, features, install, configuration, troubleshooting. The pre-T1 content was 251 lines — restore + update brand from "Agent Mode" → "goblin mode" + reflect v0.3.0 slug rename in install commands. |
| `package.json` `description` | `"Rich presence for AI coding."` (T3 minimal) | Discord-forward, AI-named, ~150 chars: e.g. `"Discord rich presence for AI coding agents — Claude Code, Cursor, Codex, Gemini. Show your friends when AI is building for you."` |
| `package.json` `keywords` | `["presence", "ai", "claude"]` (T3 minimal — 3 keywords) | Restore full list ~15 keywords: `discord`, `discord rich presence`, `discord rpc`, `discord presence`, `rich presence`, `presence`, `claude`, `claude code`, `cursor`, `codex`, `gemini`, `ai agent`, `ai coding`, `vibe coding`, `goblin mode`, `rpc`, `status` |
| `package.json` `categories` | `["Other"]` (T3 minimal) | `["Visualization", "Other"]` (matches v0.1.x pre-test state) |
| `esbuild.mjs` bundle URL scrubbing | Active — replaces 7 discord.com URLs with `.invalid` placeholders | OPTIONAL — proven unnecessary (T2 was a wrong hypothesis). Remove for cleaner build OR keep as defensive measure. Recommend remove since bundle truth > obscurity. |
| `displayName` | `"goblin mode"` (T3 minimal) | Could stay short OR restore richer form like `"goblin mode — Discord rich presence for AI coding"`. User preference is the short form `goblin mode` per Phase 7 brand work — keep short. |

## Critical anti-patterns (DON'T retry these)

These were tested during the publish-test ladder and ALL FAILED to fix the scan rejection:

1. ❌ Stripping README to minimal (v0.2.2 T1)
2. ❌ Scrubbing bundle discord.com URLs (v0.2.3 T2)
3. ❌ Minimizing metadata aggressively (v0.2.4 T3)
4. ❌ Changing displayName variants (Apr 30 v0.1.0–0.1.3 + May 5 v0.2.0–0.2.1)

Slug rename (T4 → v0.3.0) was the ONLY thing that worked. **Everything else is restoration work, not problem-solving.**

## Open follow-up (not part of the restoration task)

~428 OpenVSX users are on the old `leonardomjq.agent-mode-discord` slug. Don't auto-migrate. Discussion options when restoration is done:
- Publish a final v0.2.5 of the old slug with description = "Deprecated. Install `leonardomjq.goblin-mode` instead."
- Or unpublish entirely via OpenVSX UI.
- Or leave it. User decides.

## What I want you to do (in this session)

1. Read the 3 must-read files above.
2. Restore README, description, keywords, categories per the table above. Discord-forward branding throughout.
3. Decide on the esbuild URL scrub (recommend remove).
4. Bump version `0.3.0` → `0.3.1` (patch — no behavior change, just metadata/README restoration).
5. Add CHANGELOG entry for v0.3.1.
6. `pnpm typecheck && pnpm test && pnpm build` — must all pass.
7. Commit + tag + push v0.3.1. Release workflow auto-publishes to both registries.
8. Verify post-publish: Marketplace items page shows new description; keywords searchable.
9. THEN: discuss the ~428 OpenVSX orphan migration (don't auto-execute).

## Reference docs (read before guessing)

- `.planning/MARKETPLACE-PUBLISH-SAGA.md` — what NOT to redo
- `.planning/phases/07-.../07-SPEC.md` — voice rules + persona
- `.planning/phases/07-.../07-LEARNINGS.md` — Phase 7 lessons
- `~/.claude/projects/-Users-leonardojaques-projects-personal-richagenticpresence-discord/memory/project_marketplace_constraints.md` — registry constraints + confirmed root cause

---

**End of prompt.**
