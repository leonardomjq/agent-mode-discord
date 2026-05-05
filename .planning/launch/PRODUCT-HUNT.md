# Product Hunt launch — goblin mode

**Target launch:** Tue/Wed/Thu, 12:01 AM Pacific Time. Avoid Mon (Hunt-fatigue from weekend), avoid Fri/weekend (low traffic).

**Asset checklist before launch day:**

- [ ] Demo GIF/video — 10–15 sec, terminal `claude` running → Discord card live + animating
- [ ] Gallery banner 1270×760 PNG — hero shot of the Discord card
- [ ] 4–6 supplemental gallery images (terminal + card, multi-agent variants, settings panel)
- [ ] Tagline (≤60 chars)
- [ ] Description (≤260 chars)
- [ ] First maker comment (long-form, ~300 words)
- [ ] Hunter outreach DMs (3 hunters, queued before launch)
- [ ] Reply-bank for common Q&A (privacy, Discord bot perms, Cursor support, multi-window)

---

## Tagline (≤60 chars)

**Primary:**
> Discord rich presence for AI coding agents

**Variants:**
> Show friends when AI is shipping for you, not idling
> Watching Claude Code in your Discord status

Pick primary. Punchy + keyword-loaded for Hunt search.

---

## Description (≤260 chars)

> Friends see when **Claude Code, Cursor, Codex, or Gemini** is building for you — not when your cursor blinks. Watches your terminal + session files, not the editor cursor. Open source, MIT, runs locally. Zero servers. Zero telemetry.

258 chars. Front-loads keywords. Closes on trust signals.

---

## First maker comment (post at 12:02 AM PT, immediately after launch)

> Hey Hunters 👋
>
> I built goblin mode after the 47th time my Discord said I was "Away" while Claude Code was 30 minutes deep into a refactor. Every existing Discord-VS Code extension watches your editor cursor — useless during the long stretches where AI is doing the actual work.
>
> goblin mode watches the **terminal** + **Claude Code session files** + an optional companion lockfile. As long as the AI agent is doing something for you, the card stays alive. Card text rotates ("claude is cooking", "AI in the kitchen", "afternoon shift") so it never goes stale.
>
> **What's in the box (v0.3.2):**
> - Detects: Claude Code, Cursor agent, Codex, Gemini, OpenCode (regex-based, plus opt-in custom patterns)
> - Activity type: "Watching" not "Playing" (Discord brand lever — you're watching the AI build, not gaming)
> - Time-of-day shifts (`morning service` / `afternoon shift` / `evening service` / `3am goblin shift`)
> - Multi-window leadership election (one Discord card across N open windows)
> - Privacy default: zero file paths, zero project names sent to Discord. Verifiable in source.
>
> **Tech notes for the curious:**
> - TypeScript, MIT licensed, [@xhayper/discord-rpc] for the IPC, esbuild bundle
> - Build-time URL scrub passes `pnpm check:no-network` (no Discord HTTP calls — pure local IPC)
> - Saga of getting it through MS Marketplace's "suspicious content" scanner is in the repo if you enjoy bureaucratic horror stories
>
> Free forever. Issues + PRs welcome. Would love feedback on:
> 1. What other agents should I detect? (currently regex-based, easy to add)
> 2. The phrase pool — too goblin? not enough goblin?
> 3. Anyone want a JetBrains version?
>
> 🦆 Quack.

Tone: founder-honest, technical-but-warm, asks for feedback (Hunt boost signal). 348 words.

---

## Hunter outreach DM template

Send to 3 active hunters 48h before launch:

> Hey [name] — built a free open-source thing that lights up your Discord status while Claude Code / Cursor / Codex are shipping for you. Replaces the "Away" dot during 30-min AI refactor stretches.
>
> Live on the VS Code Marketplace + OpenVSX, MIT licensed, ~50 downloads on day one with zero promotion (just bots + curiosity). Launching Hunt [day] [time] PT.
>
> Repo + screenshot: https://github.com/leonardomjq/agent-mode-discord
>
> Would love to have you hunt it. No pressure if it's not your vibe.

Pick hunters who hunted: VS Code extensions, AI dev tools, Discord-related, indie maker tools. Avoid mass DM.

---

## Gallery image specs

| Slot | Size | Content |
|---|---|---|
| Banner (1) | 1270×760 | Hero: Discord card on dark background, terminal w/ `claude` running peeking from side |
| Image 2 | 1270×760 | Terminal screencap + card together — "this is what your friends see" |
| Image 3 | 1270×760 | Multi-agent grid: claude / codex / cursor cards side by side |
| Image 4 | 1270×760 | Settings panel — privacy toggles, custom phrase pool |
| Image 5 (GIF) | 1270×760 | 10–15 sec loop: agent starts → card appears → text rotates → agent ends → card clears |

Tools: macOS screencaps + [Cleanshot] / [Kap] for GIF capture. Compress GIF <8MB (Hunt limit).

---

## Pre-launch QA reply bank

Anticipated Q → answer pre-baked, copy-paste during launch.

**Q: Does this send my code to Discord?**
A: No. Zero file content, paths, project names. Source-verifiable: `src/presence/activityBuilder.ts` only emits the rotating phrase, agent name, and elapsed timer. We pass `pnpm check:no-network` — zero HTTP requests to Discord servers. All comm is local IPC over the Discord client's Unix socket.

**Q: Cursor support?**
A: Yes. Cursor is Electron + VS Code extension API, fully supported. Tested live on Cursor 2026-05-05. (Cursor pulls extensions via OpenVSX or VSCM proxy — search `leonardomjq.goblin-mode`.)

**Q: Why "Watching" not "Playing"?**
A: Brand lever. Discord's activity types are Playing / Listening / Watching / Streaming / Competing. "Watching" lands the metaphor — you're watching the agent build, not playing a game. Configurable.

**Q: Multi-window — does each VS Code window spam Discord?**
A: No. File-lock leadership election (`~/.claude/agent-mode-discord.leader.lock`). One window owns the Discord connection; others observe. Failover within 5 seconds if leader dies.

**Q: JetBrains/Zed/Helix?**
A: Not yet. Architecture supports it (detector layer is host-agnostic) but needs a JetBrains plugin shell + Zed extension manifest. Open to PRs or sponsoring.

**Q: How does it detect Claude Code specifically?**
A: Three tiers: (1) terminal process name regex (`^claude` exact-match), (2) `~/.claude/projects/*.jsonl` session file fs.watch, (3) optional companion lockfile from a Claude Code plugin. Tier 2 is the most reliable — it watches actual session activity, not process presence.

**Q: Battery / CPU?**
A: fs.watch is kernel-level, near-zero idle cost. Polling fallback (Cursor on Windows) is 5-second interval. Bundle 110KB. Discord IPC is local socket — no network.

---

## Launch-day timeline (Pacific Time)

| Time | Action |
|---|---|
| T-48h | DMs to 3 hunters |
| T-24h | Schedule X thread, queue Reddit drafts |
| T-2h | Final asset check, banner upload test |
| T-30m | Caffeine, water, friends-Discord ping |
| 12:01 AM | Hunt goes live |
| 12:02 AM | Post first maker comment |
| 12:05 AM | Tweet thread go |
| 12:10 AM | Show HN |
| 12:30 AM | Reddit (one sub at a time, hourly) |
| +6h | Reply to every comment within 30 min |
| +12h | Status update tweet w/ install count |
| +24h | Wrap-up post — thank, share metrics |

---

## Success metrics (post-mortem inputs)

- Hunt rank by EOD-1 (top 10 = win, top 5 = celebrate)
- Marketplace installs delta (24h)
- GitHub stars delta (24h)
- Discord-server share count (manual)
- New issues opened (signal of real users)
