# Launch distribution copy — goblin mode

Channels in priority order. Stagger by 30–60 min — don't blast simultaneously (looks bot-like + dilutes engagement).

---

## X / Twitter thread (5 tweets)

**Tweet 1 (hook + visual)** — attach `images/discord-card.png`

> stop letting Discord show you as "Away" while Claude Code is 30 minutes deep into a refactor.
>
> goblin mode lights up your Discord rich presence while AI agents ship for you.
>
> free, open source, just shipped to the VS Code Marketplace 🧌
>
> 🧵 ↓

**Tweet 2 (the problem)**

> every other Discord-VS Code extension watches your editor cursor.
>
> the moment you stop typing → idle dot.
>
> useless during the long stretches where AI is doing the actual work and you're reading diffs.

**Tweet 3 (the fix)**

> goblin mode watches your terminal + Claude Code session files.
>
> as long as the AI is working, the card stays alive.
>
> rotates text: "claude is cooking" → "AI in the kitchen" → "afternoon shift"
>
> friends DMing you see → something is happening, not Away.

**Tweet 4 (proof + tech notes)**

> built around Claude Code (live-tested). Same regex detector layer covers Cursor agent, Codex, Gemini, OpenCode — if you use one of those and detection misses, file an issue, regex fix is a 5-min PR.
>
> uses Discord's "Watching" activity type (not Playing) — you're watching the agent build, not gaming.
>
> zero files / paths / project names sent to Discord. 100% local IPC. MIT licensed.

**Tweet 5 (CTA)**

> install: search `leonardomjq.goblin-mode` in your Extensions panel
>
> repo: https://github.com/leonardomjq/agent-mode-discord
>
> would love a star if you find it useful 🦆

Hashtags (last tweet only, sparingly): #ClaudeCode #VibeCoding #BuildInPublic

---

## Show HN

**Title:**
> Show HN: Discord rich presence for Claude Code, Cursor, Codex, Gemini

**Body:**

> Hi HN — I built a small VS Code extension that lights up your Discord rich presence while AI coding agents are working for you.
>
> Other Discord-VS Code extensions watch your editor cursor — as soon as you stop typing they flip to idle, which is wrong during the long stretches where Claude Code (or Cursor / Codex / Gemini) is doing the actual work and you're reading diffs.
>
> goblin mode watches three things: terminal process names (regex match for `claude`, `cursor-agent`, etc.), Claude Code session files at `~/.claude/projects/*.jsonl` via fs.watch, and an optional companion lockfile. As long as any of those signal "agent active", the Discord card stays alive. Card rotates a phrase pool ("claude is cooking", "AI in the kitchen") and a time-of-day shift ("morning service", "3am goblin shift").
>
> Tech: TypeScript, [@xhayper/discord-rpc] for the IPC, esbuild bundle, ~110KB. Multi-window leadership election via file lock so N open VS Code windows = one Discord card. Privacy default: zero file paths, project names, or content sent to Discord — verifiable in `src/presence/activityBuilder.ts`. We pass `pnpm check:no-network` (no HTTP calls to Discord; all IPC is local Unix socket).
>
> Honest scope: Claude Code is live-verified. Codex / Gemini / OpenCode / Cursor agent share the same regex-based detector layer (`src/detectors/regex.ts`) and have unit-test coverage but I don't have those subscriptions to live-test. PRs welcome.
>
> MS Marketplace's "suspicious content" auto-scanner blocked the original slug `agent-mode-discord` for ~9 publish attempts before I figured out the slug-as-trigger pattern. Saga is in the repo (`.planning/MARKETPLACE-PUBLISH-SAGA.md`) if you enjoy bureaucratic horror stories.
>
> Free, MIT.
>
> Repo: https://github.com/leonardomjq/agent-mode-discord
> Marketplace: https://marketplace.visualstudio.com/items?itemName=leonardomjq.goblin-mode

HN tone: technical detail forward, no hype, honest about failure modes.

---

## Reddit posts

Stagger one sub per hour. Read each sub's rules first — some require flair, no self-promo on launch day, etc.

### r/ClaudeAI

**Title:** I built a free Discord rich presence extension specifically for Claude Code

> Got tired of Discord showing me "Away" while Claude was 30 minutes into a refactor. Built goblin mode — watches your terminal + `~/.claude/projects/*.jsonl` session files. As long as Claude is working, your Discord status stays alive with rotating text.
>
> Free, open source, MIT. Search `leonardomjq.goblin-mode` in VS Code or Cursor.
>
> Repo + screenshots: https://github.com/leonardomjq/agent-mode-discord
>
> Feedback welcome — especially on what other agents you'd want detected.

### r/cursor

**Title:** Discord rich presence extension built for AI-coding workflows (works in Cursor)

> Most Discord-VS Code extensions break on Cursor or only watch the cursor (heh). This one watches the terminal + AI session files, so while Claude Code or Cursor agent is shipping a long task, your Discord shows "Watching goblin mode" instead of going Away.
>
> Honest scope: I built it around Claude Code (only one I subscribe to). Cursor agent uses the same regex-based detector layer — if it misses for you, the regex fix is a 5-minute PR.
>
> Live on OpenVSX (which Cursor proxies). Search `leonardomjq.goblin-mode`.
>
> https://github.com/leonardomjq/agent-mode-discord

### r/discordapp

**Title:** Custom Discord rich presence for AI coding agents (open source, no bot needed)

> Built a small thing that uses local Discord IPC (not the bot API) to show a rich presence card while AI coding agents are working for you. Activity type is Watching (not Playing) — felt closer to the metaphor.
>
> No bot perms, no server, no telemetry. Just a VS Code extension talking to your local Discord client.
>
> Code: https://github.com/leonardomjq/agent-mode-discord

### r/vscode

**Title:** [Free / OSS] goblin mode — Discord rich presence extension built specifically for AI coding workflows

> Watches your terminal for Claude Code / Cursor / Codex / Gemini activity. Card stays alive while AI is working, clears when it stops. Multi-window leadership election so multiple VS Code instances don't fight over the Discord connection.
>
> https://marketplace.visualstudio.com/items?itemName=leonardomjq.goblin-mode

### r/programming (last — strict no-self-promo rules; only post if response from above is good)

Skip unless first 4 land well. r/programming auto-removes new accounts + flags self-promo aggressively.

---

## Discord servers

Manual posts in #showcase / #self-promo / #made-by-me channels. Read pinned rules first.

Target servers (in priority):
1. **Vibe Coders** (if exists, or generic AI-coding Discords) — exact target audience
2. **Cursor official Discord** — `#community-projects` or equivalent
3. **Anthropic builders Discord** (claude.ai/discord) — Claude Code subforum
4. **Indie Hackers Discord** — for the indie-maker audience
5. **The Server Group** (general dev Discords you're already in)

Single-line message format:
> shipped a tiny VS Code extension that lights up Discord rich presence while Claude Code / Cursor / Codex are shipping for you. free, OSS, MIT — repo: https://github.com/leonardomjq/agent-mode-discord
>
> would love feedback (and a star if you dig it 🦆)

---

## Mastodon / Bluesky (lower priority)

Same as Tweet 1, single post. Hashtags: #VSCode #Cursor #ClaudeCode #OpenSource

---

## LinkedIn (only if your audience is tech recruiters / managers)

Skip unless you have a tech-recruiter following. LinkedIn audience overweights "career achievement" framing — feels off-brand for goblin mode.

---

## Anti-patterns

- Don't post to all channels in the same hour — looks coordinated/bot-y
- Don't pin the Hunt link as primary CTA on Reddit — Reddit downranks Hunt links. Lead with GitHub repo.
- Don't reply to your own thread immediately ("bumping" tactics get flagged on HN/Reddit)
- Don't auto-DM new GitHub stars — annoying, breaks trust
- Don't say "going viral" or "blew up overnight" preemptively — credibility loss
