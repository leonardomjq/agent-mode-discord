# PRD — Agent Mode

**Discord Rich Presence for Claude Code and AI coding agents. A VS Code / Cursor extension that knows when you're actually cooking.**

| | |
|---|---|
| **Author** | Leonardo Jaques |
| **Date** | 2026-04-12 |
| **Status** | Draft v0.2 — ready to build |
| **Target release** | v0.1.0 (MVP public launch) |
| **Ship window** | 2 weeks — imminent competitive threat (see §14) |
| **Distribution** | VS Code Marketplace + OpenVSX (Cursor, VSCodium, Windsurf) |
| **License** | MIT |
| **Tagline** | *Let your friends know when you're cooking.* |

---

## 0. How to use this document

**This PRD is the spec-of-record for v0.1.** Every section is a locked decision unless explicitly flagged as open (§17). If you are a Claude Code / AI agent session executing this:

- Work milestones sequentially (§12, M0 → M7). Each has a **Definition of Done** — do not advance until every DoD item is checked.
- Sections marked **`[HUMAN]`** are owner-only (Discord Developer Portal, Marketplace publisher creation, OpenVSX namespace claim, asset design). Pause and surface these, don't improvise.
- Guardrails for implementers are in §18. Read them before M0.
- `CLAUDE.md` at repo root (created in M0) restates the allowed toolchain, commit style, and forbidden actions — it's your local operating manual. This PRD is the *what*; `CLAUDE.md` is the *how*.
- Do not expand v0.1 scope. Roadmap items (§3) belong to v0.2.

---

## 1. TL;DR

Every existing Discord Rich Presence extension was built before agentic coding. Their state model is editor-centric: the moment focus leaves the text editor — terminal, agent panel, diff view — `vscode.window.activeTextEditor` becomes `undefined` and the overlay reverts to "Idling." For a workflow where the work happens in `claude` running in the integrated terminal for hours, the overlay lies about the majority of the real session.

**Agent Mode** fixes this. It detects when Claude Code (or aider / codex-cli / gemini-cli / OpenCode) is running in the integrated terminal — as a first-class active state, using VS Code's stable Shell Integration API (1.93+). It treats the overlay as a personality surface: cycling copy packs, frames, and context-aware status. And it leaves room in the roadmap for the telemetry the community actually flexes: model, session cost, burn rate, context %.

One install. Many agents. No daemons. No proposed APIs.

---

## 2. Problem

**Core problem:** the existing category misrepresents modern creative work.

| Overlay says | Actual state |
|---|---|
| "Idling in unknown project" | Running `claude` for 40 min, unattended agent session |
| "Idling" | Reviewing the agent's diff in the diff view |
| "Idling" | Typing in the integrated terminal |
| Correct: "Editing auth.ts" | Only when text editor has focus |

**Why this matters:** a rich presence is a **social signal**. You're at your PC all day, online in a handful of Discord servers, and the server sees "Idling" while you're driving a long-running Claude Code session. Two failure modes stack:

1. **Understated effort.** Hours of agentic work read as AFK.
2. **Wasted flex surface.** The overlay is a personality channel. No existing extension uses it as one.

The secondary, confirmed pain (from vscord #26, discord-vscode #453): the "stuck on Idling" bug over Remote SSH / WSL, which the incumbents can't fix because they don't detect the terminal — the only place work is still happening on a remote box.

---

## 3. Goals & Non-Goals

### Goals (v0.1)
1. Detect Claude Code, aider, codex-cli, gemini-cli, and OpenCode sessions in the integrated terminal as an **active** state — not idle.
2. Ship with personality: three message packs (`default`, `goblin`, `professional`), frame cycling, elapsed timer, time-of-day pools.
3. Ship to **both** VS Code Marketplace and OpenVSX so Cursor / VSCodium / Windsurf users install natively.
4. Respect privacy by default — workspace names, filenames, and git branches hidden unless the user opts in.
5. Zero use of VS Code proposed APIs. Marketplace-safe from day one.
6. Optional Claude Code companion plugin for higher-fidelity session detection.

### Roadmap (reserved for v0.2 — **not** out of scope)
- **Agent telemetry bridge:** model name, session cost, today's cumulative cost, burn rate ($/hr), context usage %. The community has already standardized on these fields (ccusage, ccstatusline, ClaudeCodeStatusLine). Reserving this slot prevents a daemon competitor from wrapping their tool in a VSIX and eating our niche.
- OpenCode companion plugin (mirrors the Claude Code pattern, uses OpenCode's `session.idle` / `chat.message` events).
- Detection of Cline / Roo Code via `vscode.extensions.getExtension(...).isActive`.

### Non-Goals (v0.1 and beyond for now)
- Bidirectional control (sending prompts to the agent from Discord). That's Claude Code Channels' space; we stay read-only.
- Mobile, web, or Codespaces. Desktop Discord + desktop VS Code/Cursor only.
- Team features, shared activity dashboards, analytics.

---

## 4. Target User

Primary persona: **"Marcus."** 24. PC he built. Three monitors. Always in Discord — Anthropic's server, Cursor's server, a couple shitposty dev servers pinned. Online 14+ hrs a day. Streams occasionally. Plays Marvel Rivals between Claude sessions. Knows what "ratioed" means. Has typed "chat is this real" unironically this month.

Drives Claude Code as his primary tool. Lives in the integrated terminal + diff view. Occasionally breaks out into aider or OpenCode. Wants his Discord sidebar to reflect reality *and* flex a little.

Secondary persona: **"Steph."** Senior dev. Also online on Discord, but in professional servers. Wants the status to say "I'm shipping," not "I'm vibing." Runs the `professional` pack, disables most frames.

---

## 5. User Stories

1. *As Marcus, running Claude Code in my integrated terminal,* I want my Discord status to say "letting Claude cook" with a live elapsed timer, so my friends know I'm actually building.
2. *As Marcus,* I want the overlay to rotate through a pack of funny one-liners — "locked in fr (the agent is, not me)", "ratioed by an LLM" — so it feels alive.
3. *As Marcus running two parallel `claude` sessions,* I want the overlay to stay in AGENT state until all sessions end. "3 agents, 1 brain."
4. *As someone using a client repo,* I want workspace names hidden (or hashed) by default, so I can flex without leaking the client's name.
5. *As a Cursor user,* I want to install this from Cursor's Extensions panel without sideloading a VSIX.
6. *As a tinkerer,* I want to ship my own JSON message pack, so I can inject inside jokes.
7. *As Steph,* I want a `professional` pack and an off switch for frames, so the overlay reads clean in a work server.
8. *As a Claude Code power user,* I want the optional companion plugin so detection is exact, not heuristic.

---

## 6. Naming & Identity

Two strings matter, and they're distinct.

| Field | Value | Rationale |
|---|---|---|
| **Discord app name** (shows as "Playing X" in friends' sidebar) | `Agent Mode` | Brand identity. Multi-agent safe. Not Claude-Code-trademark-adjacent. |
| **Marketplace displayName** | `Agent Mode — Discord Presence for Claude & AI Agents` | Em-dash pattern (matches RikoAppDev and others). Searchable keywords after the brand. |
| **Extension slug (`name` in package.json)** | `agent-mode-discord` | Permanent URL fragment. Disambiguates from Cursor's / Copilot's "Agent Mode" features. |
| **Full extension ID** | `<publisher>.agent-mode-discord` | Publisher TBD (to be created during M7). |
| **Short description** | *Your Discord status, but it actually knows when Claude, Cursor, or an agent is cooking.* | One-liner for Marketplace card. |
| **Keywords (SEO array)** | `discord`, `rpc`, `rich presence`, `claude`, `claude code`, `cursor`, `ai agent`, `aider`, `codex`, `opencode`, `gemini`, `presence`, `status`, `terminal` | Covers long-tail Marketplace search. |
| **Repo** | `github.com/<user>/agent-mode-discord` | Public, MIT. |

Note: "Agent Mode" is also a generic feature name used by Cursor and GitHub Copilot. Not a trademark issue (descriptive). The overlap actually drives Marketplace discoverability from users searching for Cursor / Copilot agent features. We lean into it via the longer displayName which clarifies this is the Discord-facing surface.

---

## 7. Functional Requirements

### FR-1 · Terminal agent detection (the novel layer)

Detection is tiered. Each tier is a higher-fidelity signal; the extension prefers the best available at runtime.

**FR-1.1** — **Companion-plugin lockfile (highest fidelity, optional).** If the user installs the shipped Claude Code plugin (`claude plugin install agent-mode-discord`), `SessionStart` / `SessionEnd` hooks write / remove `~/.claude/agent-mode-discord.lock`. Extension `fs.watch`es this path; presence = AGENT_ACTIVE.

**FR-1.2** — **Shell Integration (primary signal).** Subscribe to:
- `vscode.window.onDidStartTerminalShellExecution`
- `vscode.window.onDidEndTerminalShellExecution`
- `vscode.window.onDidChangeTerminalShellIntegration` (critical — shell integration activates async; missing this event loses the first session in a fresh terminal).

Regex-match `execution.commandLine.value` (after stripping ANSI + leading prompt junk to handle `commandLine.confidence === Low`):

```
^\s*(claude|(npx|bunx|pnpm\s+dlx)\s+(@anthropic-ai/)?claude(-code)?|aider|(npx\s+)?@openai/codex|codex|gemini|opencode)(\s|$)
```

Agent identified per-match (Claude Code / aider / codex-cli / gemini-cli / OpenCode) and stored in the session.

**FR-1.3** — **Session map.** `Map<vscode.Terminal, AgentSession>` keyed by terminal. On `onDidEndTerminalShellExecution`, remove the entry. AGENT_ACTIVE holds while the set is non-empty.

**FR-1.4** — **Filesystem fallback (secondary).** If shell integration is unavailable (Command Prompt, fish without plugin, Cursor on Windows — documented in the research report), watch `~/.claude/projects/*.jsonl` via `fs.watch` for recently-modified session files (cc-discord-presence pattern). Coarser, but functional.

**FR-1.5** — **Polling fallback (last resort).** If tiers 1-2 are unavailable and tier 3 returns no signal within 10s of a new terminal opening, poll `vscode.window.terminals` on a 5s interval. Inspect each terminal's `Terminal.state.shell` (when exposed) and `Terminal.name`. This tier is deliberately narrow — we only look for explicit user rename patterns (configurable via `detect.polling.terminalNamePatterns`, empty by default). If the user hasn't renamed their terminals, this tier produces no signal and that's correct; we stay silent rather than false-flag. This tier exists mainly for power users running `claude` in a tmux pane they've named.

**FR-1.6** — **Detector precedence (dedup).** All tiers run concurrently. For a given `vscode.Terminal` instance, the session map holds *at most one* `AgentSession` keyed by terminal ID. When multiple tiers signal the same session, highest-fidelity wins: companion-lockfile > shell-integration > session-file-watch > polling. Lower-fidelity signals are logged (debug) but do not mutate state. When the lockfile disappears, demote to shell-integration signal if present, else transition the terminal out of AGENT_ACTIVE.

**FR-1.7** — **Custom patterns.** `detect.customPatterns: { [agentName: string]: string }` — regex strings per agent name. The agent name flows to templating (`{agent}`) and picks the per-agent copy sub-pool. Unknown agent names fall back to the default AGENT_ACTIVE pool.

**FR-1.8** — **Session-file format caveat.** `~/.claude/projects/*.jsonl` and `~/.codex/` are undocumented internal formats. Treat them as best-effort: wrap all reads in try/catch, never parse structurally, use file mtime + existence as the signal only. If Anthropic/OpenAI change the layout, our extension must continue to function via tier 2.

### FR-2 · Editor state

**FR-2.1** — Track `onDidChangeActiveTextEditor` and debounced `onDidChangeTextDocument` → `CODING` with current file + language.

**FR-2.2** — Priority: AGENT_ACTIVE > CODING > IDLE. Agent always wins.

**FR-2.3** — `idleTimeoutSeconds` with no activity → IDLE.

### FR-3 · Git context

**FR-3.1** — Bridge built-in git via `vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)` to read branch.

**FR-3.2** — Branch shown only if `privacy.gitBranch === 'show'`.

### FR-4 · Discord RPC

**FR-4.1** — Use `@xhayper/discord-rpc` (npm; upstream repo now at `Khaomi/discord-rpc` on GitHub, package name unchanged). Bundled default Client ID for the `Agent Mode` Discord app; user override via `clientId` setting.

**FR-4.2** — **Exponential backoff reconnect.** 5s → 10s → 20s → 40s → 60s cap. Cooldown guard: don't retry more than once per 5s under any circumstance (Codex-Discord-Rich-Presence pattern, `src/discord.rs:35-36, 276-282`).

**FR-4.3** — On `deactivate()`, call `client.user?.clearActivity(process.pid)` — NOT `setActivity(null)`. `setActivity(null)` leaves ghost presences in some Discord client versions; vscord learned this and switched.

**FR-4.4** — Pass `process.pid` to every `setActivity` / `clearActivity` call. Enables multi-window isolation (two VS Code windows, two independent presences).

**FR-4.5** — Connection failures are silent retries. Never block the editor, never toast an error unless `debug.verbose === true`.

### FR-5 · Personality layer

**FR-5.1** — Packs are JSON objects keyed by state (`AGENT_ACTIVE | CODING | IDLE`), optionally sub-keyed by agent (`CLAUDE | AIDER | CODEX | GEMINI | OPENCODE`) and time-of-day pool (`morning | afternoon | evening | late_night`).

**FR-5.2** — Each entry is a string or an array of frames (`["cooking.", "cooking..", "cooking..."]`).

**FR-5.3** — Templating: `{workspace}`, `{filename}`, `{language}`, `{branch}`, `{agent}`, `{elapsed}`. Resolution respects privacy settings.

**FR-5.4** — Shipped packs: `default` (playful-clean), `goblin` (Marcus voice), `professional` (boring).

**FR-5.5** — `messages.customPackPath` points to a user JSON file. See §9.6 for the JSON schema.

**FR-5.6** — **Animator schedule.** Two independent clocks:
- **Rotation clock**: fires every 20s. On fire, pick the next *message* from the current pool (AGENT_ACTIVE + agent sub-pool + time-of-day pool). Selection uses Fisher-Yates-shuffled queue; when queue is empty, re-shuffle excluding the most-recent entry (prevents back-to-back repeats).
- **Frame clock**: fires every 2s, but only when the current message is a frame array (e.g. `["cooking.", "cooking..", "cooking..."]`). Cycles through frames in order, looping. Does not trigger a rotation.

Both clocks respect the RPC throttle (FR-7.1); the rate limiter flushes whichever tick arrived latest. Frame clock is disabled when `animations.enabled === false` — in that case, the first frame of any array message is shown statically.

**FR-5.7** — Elapsed timer uses Discord's `startTimestamp`. Reset only on state-machine transitions (§9.2), *not* on frame or rotation ticks.

### FR-6 · Privacy

**FR-6.1** — `privacy.workspaceName`: `show | hide | hash` (default `hide`). `hash` = SHA-1 of workspace path, first 6 chars → "project ab12cd".

**FR-6.2** — `privacy.filename`: `show | hide` (default `hide`).

**FR-6.3** — `privacy.gitBranch`: `show | hide` (default `hide`).

**FR-6.4** — Ignore lists (vscord pattern):
- `ignore.workspaces: string[]` — glob patterns
- `ignore.repositories: string[]` — regex
- `ignore.organizations: string[]` — regex
- `ignore.gitHosts: string[]` — `github.com`, `gitlab.com`, etc.

Matching any ignore list = extension stays fully silent (no presence at all).

**FR-6.5** — All privacy changes apply on next presence tick. No reload required.

### FR-7 · Rate limiting

**FR-7.1** — Throttle `setActivity` calls to **2000ms** (leading + trailing edge) — matches vscord's production setting. Not 15s (the original PRD was overly conservative).

**FR-7.2** — Queue drops intermediate payloads; last call always wins.

### FR-8 · Configuration surface (tight — vscord has 160, we aim for ~20)

```jsonc
{
  "agentMode.clientId": "<bundled-default>",
  "agentMode.detect.companionPlugin": true,
  "agentMode.detect.customPatterns": {},
  "agentMode.messages.pack": "default",        // default | goblin | professional | custom
  "agentMode.messages.customPackPath": "",
  "agentMode.animations.enabled": true,
  "agentMode.privacy.workspaceName": "hide",   // show | hide | hash
  "agentMode.privacy.filename": "hide",
  "agentMode.privacy.gitBranch": "hide",
  "agentMode.ignore.workspaces": [],
  "agentMode.ignore.repositories": [],
  "agentMode.ignore.organizations": [],
  "agentMode.ignore.gitHosts": [],
  "agentMode.idleTimeoutSeconds": 300,
  "agentMode.idleBehavior": "show",            // show | clear
  "agentMode.debug.verbose": false
}
```

---

## 8. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Compatibility** | `engines.vscode: ^1.93.0` (shell integration stabilized Aug 2024). Cursor latest: tested. Cursor on Windows: best-effort (documented shell-integration issues — forum threads in §15). |
| **Workspace trust** | `capabilities.untrustedWorkspaces: { supported: true }` — we never execute workspace code. `virtualWorkspaces: false` — local IPC + local git required. |
| **Footprint** | Packaged VSIX < 500 KB. Activation cost < 50 ms. Activation event: `onStartupFinished` only. |
| **Dependencies** | Runtime: `@xhayper/discord-rpc@^1.3.1` (only). Dev: `@types/vscode@^1.93.0`, `@types/node@^22`, `typescript@^5.4`, `esbuild@^0.24`, `vitest@^2`, `@vscode/vsce@^3.7`, `ovsx@^0.10`. Pin `@xhayper/discord-rpc` exactly if tree-shaking of `@discordjs/rest`/`undici` breaks the bundle size target. |
| **API surface** | Stable VS Code APIs only. Zero `enabledApiProposals`. Zero `(vscode as any).*` casts to proposed surfaces. |
| **Network** | Discord IPC only (local Unix socket / Windows named pipe). No outbound HTTP. |
| **Failure mode** | Discord not running → silent retry loop forever. Never blocks editor, never toasts. |

---

## 9. Tech Design

### 9.1 Stack
TypeScript → esbuild single CJS bundle → `dist/extension.cjs`. `@xhayper/discord-rpc` as the only runtime dep. pnpm for dev. Published via `vsce` + `ovsx` from a GitHub Action on tag push.

### 9.2 State machine

6 states (inspired by Codex-Discord-Rich-Presence's `SessionActivityKind`, trimmed for our scope):

```
                   ┌──────────────────┐
    companion ────▶│  AGENT_ACTIVE    │◀──── claude/aider/codex/gemini/opencode
    lockfile or    │  (per-agent sub) │      detected running in terminal
    terminal match └──────┬───────────┘
                      no sessions │
                                  ▼
          ┌──────────┐     file focus    ┌──────────┐
          │  IDLE    │ ◀───────────────── │  CODING  │
          └──────────┘ idle timeout       └──────────┘
               ▲                                │
               └──── editor focus lost ─────────┘
```

AGENT_ACTIVE has an agent-name sub-label (`claude`, `aider`, `codex`, `gemini`, `opencode`) that drives which sub-pool of copy fires.

### 9.3 Detection stack (ordered by fidelity)

1. **Companion plugin lockfile** — `~/.claude/agent-mode-discord.lock` watched via `fs.watch`. Only Claude Code in v0.1; OpenCode plugin in v0.2.
2. **Shell integration events** — `onDidStart/EndTerminalShellExecution` + `onDidChangeTerminalShellIntegration`. Primary path. Low-confidence strings get ANSI/prompt stripped before regex.
3. **Session-file fs-watch** — `~/.claude/projects/*.jsonl` (Claude Code), `~/.codex/` (Codex). Fallback when shell integration is absent.
4. **Polling** — `vscode.window.terminals` every 5s. Weakest; only flips on terminal name heuristics.

### 9.4 File layout

```
agent-mode-discord/
├─ package.json                 # manifest, contributes.configuration, activationEvents
├─ tsconfig.json
├─ esbuild.mjs                  # single-bundle CJS output
├─ pnpm-lock.yaml
├─ .vscodeignore
├─ src/
│  ├─ extension.ts              # activate() / deactivate()
│  ├─ rpc/
│  │  ├─ client.ts              # @xhayper wrapper, connect + backoff + pid-scoped activity
│  │  └─ throttle.ts            # 2s leading+trailing throttle
│  ├─ state/
│  │  ├─ machine.ts             # transitions
│  │  └─ context.ts             # workspace, file, lang, branch, agent, startedAt
│  ├─ detectors/
│  │  ├─ index.ts               # detector chain orchestrator
│  │  ├─ companion.ts           # lockfile watcher
│  │  ├─ shellIntegration.ts    # primary — regex + ANSI strip
│  │  ├─ sessionFiles.ts        # ~/.claude/projects + ~/.codex fs-watch
│  │  ├─ polling.ts             # window.terminals fallback
│  │  ├─ editor.ts              # onDidChangeActiveTextEditor etc.
│  │  └─ git.ts                 # built-in git extension bridge
│  ├─ presence/
│  │  ├─ packs/                 # default.json, goblin.json, professional.json
│  │  ├─ animator.ts            # frame cycling + no-repeat rotation + time-of-day pools
│  │  ├─ templater.ts           # {workspace}, {agent}, {elapsed} substitution
│  │  └─ activityBuilder.ts     # (Context, Frame) → Discord activity payload
│  ├─ config.ts                 # typed workspace configuration accessor
│  └─ privacy.ts                # redacts fields per settings; ignore-list matcher
├─ companion/
│  └─ claude-code-plugin/
│     ├─ .claude-plugin/plugin.json
│     ├─ scripts/start.sh
│     └─ scripts/stop.sh
├─ assets/                      # Discord app large/small images + per-agent icons
├─ test/                        # vitest — no vscode dep
│  ├─ state.machine.test.ts
│  ├─ throttle.test.ts
│  ├─ animator.test.ts
│  ├─ regex.test.ts             # Low-confidence ANSI strip + all 5 agents
│  └─ privacy.test.ts           # hash + ignore lists
├─ README.md
├─ LICENSE                      # MIT
├─ CODE_OF_CONDUCT.md           # Contributor Covenant 2.1
├─ CONTRIBUTING.md              # dev loop, commit style, PR expectations
├─ SECURITY.md                  # vuln reporting email + scope
├─ .gitignore                   # Node + VS Code template
└─ .github/
   ├─ FUNDING.yml               # sponsor pointer (may be empty at launch)
   ├─ ISSUE_TEMPLATE/
   │  ├─ bug_report.md
   │  └─ feature_request.md
   ├─ PULL_REQUEST_TEMPLATE.md
   └─ workflows/
      ├─ ci.yml                 # pnpm lint + test + build on PRs
      └─ release.yml            # vsce + ovsx publish on tag push
```

### 9.5 Example payloads

**AGENT_ACTIVE — Claude Code, goblin pack, privacy=hash:**
```ts
{
  details: "locked in fr (the agent is, not me)",
  state: "claude · project ab12cd · 2h 47m",
  startTimestamp: 1712935200,
  largeImageKey: "claude-large",
  largeImageText: "Claude Code",
  smallImageKey: "agent-mode-small",
  smallImageText: "Agent Mode",
}
```

**CODING — default pack:**
```ts
{
  details: "wrangling the codebase",
  state: "project ab12cd",
  startTimestamp: 1712935200,
  largeImageKey: "vscode-large",
  smallImageKey: "agent-mode-small",
}
```

**IDLE — default pack:**
```ts
{
  details: "briefly human",
  state: "rubber-duck break",
  smallImageKey: "agent-mode-small",
}
```

### 9.6 Message-pack JSON schema

Packs live in `src/presence/packs/*.json` and ship bundled. User custom packs point to a file on disk via `messages.customPackPath`. Schema:

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/<user>/agent-mode-discord/main/schema/pack.schema.json",
  "name": "default",
  "version": 1,
  "AGENT_ACTIVE": {
    "claude": {
      "any":        ["letting Claude cook", "claude is on the grind"],
      "morning":    ["early cook, claude edition"],
      "late_night": ["3am claude run, locked in"],
      "frames":     [["cooking.", "cooking..", "cooking..."]]
    },
    "aider":   { "any": ["aider-pilled"] },
    "codex":   { "any": ["codex cooking"] },
    "gemini":  { "any": ["gemini on deck"] },
    "opencode":{ "any": ["opencode is working"] },
    "any":     { "any": ["agent active"] }
  },
  "CODING":  { "any": { "any": ["wrangling the codebase"] } },
  "IDLE":    { "any": { "any": ["briefly human"] } }
}
```

Rules:
- Pool resolution: state → agent → time-of-day (or `any`) → concatenate all matching arrays.
- `frames` arrays are picked by the rotation clock (FR-5.6); each inner array is a single frame set. Strings in non-`frames` arrays are static messages.
- Every state MUST define an `any` sub-key. Every agent sub-pool MUST define an `any` time-of-day key. Missing keys fall through to `any`.
- Templating tokens resolved at render time (FR-5.3): `{workspace}`, `{filename}`, `{language}`, `{branch}`, `{agent}`, `{elapsed}`. Tokens gated by privacy settings render as empty string when hidden; the animator must drop any message that becomes empty after substitution.

---

## 10. Voice & Copy

Voice calibration note: the user research found "vibe coding" has tipped into cringe with the senior tier of the persona. In-group phrases that still work: "letting X cook," "YOLO mode," `--dangerously-skip-permissions`, "locked in fr," "cooking." Out-of-group giveaways: unironic "vibe coding," hype emoji spam, "crushing it."

### `default` pack (playful-clean — the safe middle)

**AGENT_ACTIVE — claude:**
- `letting Claude cook`
- `claude is on the grind`
- `agent doing the heavy lifting`
- `["cooking.", "cooking..", "cooking..."]` (frames)
- `prompt → PR pipeline`

**AGENT_ACTIVE — aider / codex / gemini / opencode:** equivalent lines per agent.

**CODING:**
- `wrangling the codebase`
- `bending {language} to my will`
- `tinkering with {filename}`
- `in the zone`

**IDLE:**
- `briefly human`
- `rubber-duck break`
- `afk but still cracked`
- `stepped away, will be back`

### `goblin` pack (Marcus voice — the flex pack)

**AGENT_ACTIVE — claude:**
- `locked in fr (the agent is, not me)`
- `cooking harder than my GPU`
- `ratioed by an LLM`
- `chat is this vibecoding`
- `no thoughts, just prompts`
- `--dangerously-skip-permissions`
- `my agent is more locked in than i am`
- `gooning over type errors`
- `["yapping at claude.", "yapping at claude..", "yapping at claude..."]`

**AGENT_ACTIVE — aider:**
- `aider-pilled`
- `git commit and chill`

**AGENT_ACTIVE — codex / gemini / opencode:** equivalent lines.

**CODING:**
- `touching code personally (rare)`
- `going full caveman, no agent`
- `hand-writing {language} like a psycho`

**IDLE:**
- `touch grass? npm install not found`
- `brb 1v1ing my lunch`
- `technically logged in`
- `idle (actually coding, trust me)`
- `ctrl+c'd myself`

### `professional` pack (boring — for people who demo)

**AGENT_ACTIVE:**
- `AI pair programming`
- `running agent session`
- `Claude Code · {elapsed}`

**CODING:**
- `editing {filename}`
- `working in {language}`

**IDLE:**
- `away`
- `idle`

---

## 11. Success Metrics

Single-dev project — vanity metrics, tracked informally:

| Metric | Target, 30 days post-launch |
|---|---|
| VS Code Marketplace installs | ≥ 1,000 (RikoAppDev has 3 at 8 days; incumbents are 778k / 2.48M — 1k is a realistic early signal) |
| OpenVSX installs | ≥ 300 |
| GitHub stars | ≥ 100 |
| Open issues "stuck on idle during claude" | 0 |
| Demo screenshot in the wild on X or a Discord | ≥ 1 |
| Cited on HN, r/ClaudeAI, r/cursor, or Anthropic's Discord (83k) | ≥ 1 |

---

## 12. Milestones (~26h, 1.5–2 weekends)

Each milestone has a **Definition of Done**. Do not advance past a milestone until every DoD item is checked. `[HUMAN]` steps require the owner (not an agent) and pause the build.

### M0 — Skeleton (2h)

**Scope.** pnpm workspace bootstrapped. TypeScript + esbuild single-CJS-bundle config. VSIX boots in an Extension Development Host window. RPC connects with a hardcoded payload. `CLAUDE.md` written.

- `[HUMAN]` Create the `Agent Mode` Discord application at https://discord.com/developers/applications. Copy the Client ID into `src/rpc/client.ts` as the bundled default. Upload a placeholder 1024×1024 PNG as `large` (asset key: `agent-mode-large`) and a 512×512 as `small` (`agent-mode-small`). Final art ships in M6b.
- `[HUMAN]` `git init`, create the public GitHub repo, push initial scaffold.

**DoD.**
- [ ] `pnpm install && pnpm build` produces `dist/extension.cjs` under 500KB
- [ ] `F5` in VS Code launches Extension Dev Host; extension activates on `onStartupFinished` without error
- [ ] Discord desktop (not web) shows "Playing Agent Mode" with a hardcoded `details: "hello world"` payload
- [ ] `pnpm test` runs (with zero tests — scaffolding only, not failing)
- [ ] `CLAUDE.md` committed, includes: dev loop commands, allowed tools (pnpm / vitest / esbuild / vsce / ovsx), forbidden tools (yarn / npm install / jest / webpack / `discord-rpc` package), commit style (Conventional Commits), any-file-over-200-lines refactor rule, "ask before adding runtime deps" rule

### M1 — Detection core (5h)

**Scope.** All four detection tiers (FR-1.1 through FR-1.5). Regex covers 5 agents. `onDidChangeTerminalShellIntegration` wired. Low-confidence ANSI/prompt stripping. Per-terminal session map with precedence (FR-1.6).

**DoD.**
- [ ] Running `claude` in the dev-host terminal flips detector state to AGENT_ACTIVE with agent=`claude` within 500ms
- [ ] Same for `aider`, `codex`, `gemini`, `opencode`
- [ ] `npx @anthropic-ai/claude-code` and `bunx @anthropic-ai/claude-code` both detected as `claude`
- [ ] Two parallel `claude` terminals: state stays AGENT_ACTIVE until both exit
- [ ] Disabling shell integration in VS Code settings, then running `claude`: fs-watch tier picks it up (test with a fake `~/.claude/projects/test-session.jsonl` touched by script)
- [ ] `pnpm test` covers: regex matches all 5 agents + 3 invocation variants each; ANSI/prompt-prefix strip; session-map add/remove; precedence (lockfile beats shell integration)
- [ ] Zero calls to `(vscode as any).*` proposed API surfaces

### M2 — State + RPC hardening (4h)

**Scope.** 6-state machine with transitions. Discord client wrapper with `clearActivity(pid)` on deactivate, `pid`-scoped updates, exponential backoff reconnect (5→60s + 5s cooldown guard), 2s leading+trailing throttle. Git branch bridge via `vscode.git` extension.

**DoD.**
- [ ] Kill Discord desktop mid-session: extension logs reconnect attempts, no uncaught exceptions, no editor UI blocked
- [ ] Restart Discord: presence restored without manual action
- [ ] Open two VS Code windows, `claude` in each: each window's presence is independent (pid-scoped)
- [ ] Rapid state flips (simulate 20 state changes in 1s): Discord sees ≤ 1 update per 2s; last state always wins
- [ ] `pnpm test` covers: throttle (leading + trailing + latest-wins); backoff sequence 5/10/20/40/60/60…; state transition table exhaustive

### M3 — Personality (3h)

**Scope.** Pack loader reads `src/presence/packs/*.json`, validates schema (§9.6), loads user custom pack from disk. Rotation clock (20s) + frame clock (2s). Time-of-day pool resolution. Templating engine for `{workspace}`, `{filename}`, `{language}`, `{branch}`, `{agent}`, `{elapsed}`.

**DoD.**
- [ ] `default`, `goblin`, `professional` packs exist in `src/presence/packs/`, each valid against `schema/pack.schema.json`
- [ ] Switching `messages.pack` in settings applies without reload; next rotation uses new pack
- [ ] Rotation never repeats the same message back-to-back across two consecutive rotations
- [ ] Frame arrays cycle in order, looping; animations off → static first-frame
- [ ] Empty-after-substitution messages (e.g., `"editing {filename}"` with filename hidden → `"editing "`) are skipped by the animator
- [ ] `pnpm test` covers: pack validation, pool fallback chain, no-repeat invariant, frame cycle, template substitution under each privacy mode

### M4 — Config + privacy (2h)

**Scope.** Full settings schema in `package.json` `contributes.configuration` (20 keys from §7.8). `show/hide/hash` privacy modes. Four ignore lists (workspaces: glob; repositories/organizations/gitHosts: regex). Live config reload via `onDidChangeConfiguration`.

**DoD.**
- [ ] All 20 settings registered with `title`, `description`, `default`, enum values where applicable
- [ ] Workspace hash is deterministic: SHA-1 of normalized absolute path, first 6 hex chars (documented in the `description` field so users can reason about it)
- [ ] Ignore lists stop all presence updates (extension "goes silent") when any rule matches
- [ ] Flipping `privacy.workspaceName` from `show` → `hide` → `hash` reflects on the next rotation (max 20s)
- [ ] `pnpm test` covers: hash determinism, ignore-list matcher (glob + regex), settings reload

### M5 — Claude Code companion plugin (2h)

**Scope.** `companion/claude-code-plugin/` with `.claude-plugin/plugin.json` and `scripts/{start,stop}.sh`. Scripts write/remove `~/.claude/agent-mode-discord.lock` (empty file, mtime as signal). Extension-side watcher on that path. README section explaining optional install via `claude plugin install <github-url>`.

**DoD.**
- [ ] `claude plugin install ./companion/claude-code-plugin` from a Claude Code session installs it
- [ ] Starting a Claude Code session writes the lockfile within 200ms; ending it removes the file
- [ ] Extension detects lockfile presence and switches to companion-tier signal (observable in debug log)
- [ ] Lockfile signal takes precedence over terminal regex for that terminal (no double-count)
- [ ] README section added documenting install + what it improves

### M6a — OSS hygiene files (1h)

**Scope.** The boilerplate every public MIT repo should ship with, tuned for a solo maintainer. Most are templates from established sources.

- `LICENSE` — MIT, unmodified template text with current year + owner name.
- `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1, contact = repo owner's email.
- `SECURITY.md` — one-liner: "Report vulnerabilities privately to `<email>`. Please do not open public issues for security matters. Supported version: latest only for v0.x."
- `CONTRIBUTING.md` — dev loop (mirrors `CLAUDE.md` for humans), Conventional Commits, "file an issue before large PRs," "this is a side project — PRs welcome, merges at the owner's pace."
- `.github/ISSUE_TEMPLATE/bug_report.md` — structured fields: VS Code version, Cursor version, Discord version, OS, agent CLI used, shell, steps to reproduce, relevant logs (with `debug.verbose: true`).
- `.github/ISSUE_TEMPLATE/feature_request.md` — structured: problem, proposed solution, which persona this helps.
- `.github/PULL_REQUEST_TEMPLATE.md` — checklist: tests pass, no new runtime deps, follows guardrails (§18).
- `.github/FUNDING.yml` — commented-out scaffold; uncomment when §17 Q4 threshold hit.
- `.gitignore` — Node + VS Code via https://gitignore.io; `dist/`, `node_modules/`, `*.vsix`, `.vscode-test/`, `.env*`, `.DS_Store`.
- `.github/workflows/ci.yml` — triggers on pull_request; matrix: ubuntu-latest + macos-latest + windows-latest; steps: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm test`, `pnpm build`.
- **Branch protection on `main`:** require PR, require green CI, no direct pushes. Owner can self-approve but the flow is enforced.
- **Maintainer posture line in README:** *"Side project, maintained best-effort by one person. Responses may take days or weeks. PRs welcome — merges happen when I have time. Be kind."*

**DoD.**
- [ ] All 10 files committed and linked from the README ("Contributing • Security • Code of Conduct" footer)
- [ ] Branch protection rule active on `main`
- [ ] Dependabot enabled via repo settings (zero-config)
- [ ] CI workflow passes on a trivial test PR
- [ ] README's maintainer-posture line visible above the fold of the Support section

### M6b — Assets + README content (4h)

**Scope.** Final Discord assets, demo media, README, screenshots. `[HUMAN]` for design direction and asset creation; agent scaffolds the filenames and README structure.

**Asset specs (upload to Discord Developer Portal → Art Assets).**
- All PNG, sRGB, under 512 KB each.
- `agent-mode-large`: 1024×1024 (Discord renders it at 80×80 in the overlay; high DPI matters).
- `agent-mode-small`: 512×512.
- Per-agent icons: `claude-icon`, `aider-icon`, `codex-icon`, `gemini-icon`, `opencode-icon`, each 512×512.
- README screenshots: 1440×900 or 1280×800 PNG; show Discord sidebar zoomed in alongside VS Code.
- Demo GIF: 800×450 max, under 8 MB (GitHub embed limit), 15–30 s loop. Record with asciinema or OBS → gifski.

**DoD.**
- [ ] All Discord assets uploaded and verified by running the extension against the live Agent Mode app (asset keys resolve)
- [ ] README sections: install (Marketplace + OpenVSX + VSIX), demo GIF above the fold, 3-pack preview, privacy FAQ (answering the "what leaks by default" question), positioning table vs incumbents, sponsor button, license
- [ ] Marketplace listing preview (`vsce package` then preview generated HTML) renders without truncation

### M7 — Publish (3h)

**Scope.** Publisher + namespace setup, CI pipeline, first tag.

- `[HUMAN]` Create Azure DevOps account → create `Personal Access Token` scoped to `Marketplace: Manage` → `vsce create-publisher <name>`. Store PAT in repo secrets as `VSCE_PAT`.
- `[HUMAN]` Create Eclipse Foundation account → claim OpenVSX namespace at https://open-vsx.org/user-settings/namespaces → generate OpenVSX access token → store as `OVSX_PAT`.

**DoD.**
- [ ] `vsce package --pre-release` produces a VSIX under 500 KB with no warnings
- [ ] `vsce publish --pre-release --dry-run` succeeds
- [ ] `ovsx publish --dry-run` succeeds
- [ ] `.github/workflows/release.yml` runs on tag push, publishes to both registries, attaches VSIX to the GitHub Release
- [ ] Tag `v0.1.0` pushed; both Marketplace and OpenVSX listings live within 30 min
- [ ] Extension installs cleanly in a fresh VS Code profile AND a fresh Cursor profile; steps 3–10 of §15 pass on both

**Total: ~26h.**

---

## 13. Distribution

Three-phase launch structured across Owned / Rented / Borrowed channels (ORB). For free OSS, "owned" means repo stars/watchers + README; "rented" means HN/X/subreddits; "borrowed" means creator pitches.

### Phase A — Teaser (T−5 days to T−1 day)

Pre-build momentum before the HN post goes live. Goal: ≥30 GitHub stars before launch day. Stars-before-HN-post correlate with HN ranking (the HN algorithm tracks linked-repo velocity).

**Actions:**
- Repo goes public 5 days before launch with README complete but `v0.1.0` not tagged. Extension is Marketplace-ready but unpublished.
- Single teaser tweet from the owner's X account: 15-second screen recording showing Discord presence flipping from "Idling" to "letting Claude cook" the moment `claude` starts in the terminal. One sentence: *"shipping next week — Discord status that actually knows when Claude is cooking."* Pin to profile. Link to repo with "Watch for v0.1.0 release" CTA.
- Teaser post in Anthropic's Discord #show-and-tell (83k members) with same GIF + repo link.
- Run the validation RAT test in parallel (§17 Open Questions / validation memo): count "I'd install" responses.

### Phase B — Borrowed-channel outreach (T−3 days)

Pitch creators before the public launch so they have time to build a post of their own around it. Direct DM with: 15s GIF + VSIX attached + 3-line pitch + "ship date next Tuesday, feel free to cover any time."

**Targets** (in order of fit):
- **Simon Willison** — writes about AI CLI coding tools weekly on simonwillison.net. Highest-fit creator for this exact angle.
- **Theo Browne (@t3dotgg)** — Next-adjacent creator, tweets dev tools.
- **ThePrimeagen** — terminal-first, Claude Code user, high Marcus-persona overlap.
- **Fireship (@beyang or Jeff Delaney / Fireship itself)** — meme-forward short-form, fits the goblin-pack angle.
- **Anthropic Discord community mods** — ask if it fits any community roundup.
- **devtools.fm / Dev Tools FM podcast** — pitch a short segment or episode mention.

One DM each, no follow-up unless they reply. This is a shotgun, not a campaign.

### Phase C — Launch day (T=0, Tuesday–Thursday, 9am Eastern)

**Timing rules:**
- Show HN: post at **9:00 AM Eastern, Tuesday or Wednesday**. Avoid Monday (weekend-backlog noise), Friday (weekend drift), 2am PST (dead).
- X thread: same morning, 11am Eastern (dev-crowd peak).
- Subreddits: same morning, spaced 30 min apart to avoid cross-mod flagging.
- Anthropic Discord: after HN is up, so the link has something to point to.

**Channel sequence:**

1. **Show HN** (9:00 AM ET) — "Show HN: Agent Mode — Discord status for Claude Code and AI agents." Link to repo, not Marketplace (HN crowd prefers source).
2. **X thread** (11:00 AM ET) — 4-tweet structure:
   - **Tweet 1 (hook)**: The "stuck on Idling" screenshot from real vscord on top, "letting Claude cook" version on bottom. One line: *"every Discord presence extension thinks I'm idle when Claude is cooking for 3 hours. fixed it."*
   - **Tweet 2 (problem)**: 2 sentences on why existing extensions don't detect terminal work. Mention vscord #26 (SSH) as receipts.
   - **Tweet 3 (demo)**: 15s screen recording. Multi-agent support visible (claude + aider).
   - **Tweet 4 (install)**: Marketplace link + OpenVSX link + repo link. "free, open source, install from Cursor or VS Code."
3. **Anthropic Discord** #show-and-tell — same GIF, link to HN post (not repo) to funnel votes.
4. **r/ClaudeAI** — same morning, title: "built an extension so Discord knows when Claude Code is running — free + open source"
5. **r/cursor** — 30 min after r/ClaudeAI.
6. **r/ChatGPTCoding** — 30 min after r/cursor.

**Engagement budget:** The owner blocks 9am–4pm ET on launch day. Reply to *every* HN comment within 15 minutes for the first 3 hours. This is the single highest-ROI activity on launch day and the one the plan previously didn't allocate.

### Phase D — Wave 2 (T+14 days)

Compound the momentum instead of starting from zero again.

- **v0.1.1 release** with 2–3 polish items (whichever issues surfaced). Tag as "Response to launch week feedback" in release notes. Tweet: "in case you missed it last week — and here's what's new." Dev-tool audiences respond to active development signal.
- **Product Hunt launch** — prep period used well this time. Listing optimized, 2–3 hunters pre-committed, screenshots polished. Runs as a second visibility spike, not the main one.
- **"First 1,000 installs" recap** (if we hit that) — short blog post / X thread on lessons, metrics, and thanks to the creators who covered it. Provides a second shareable artifact from the same launch.

### Channel category mapping (ORB)

| Phase | Channel | O/R/B |
|---|---|---|
| A | Repo stars/watchers | Owned (the OSS waitlist) |
| A | Owner's X feed | Owned |
| A | Anthropic Discord (teaser) | Rented |
| B | Simon Willison / Theo / Prime / Fireship / podcasts | Borrowed |
| C | Show HN | Rented |
| C | X thread | Rented (but drives to owned repo) |
| C | Subreddits | Rented |
| D | v0.1.1 release notes | Owned (repo releases feed) |
| D | Product Hunt | Rented |
| D | Launch recap blog/thread | Owned |

Everything rented ultimately drives to the owned surface (repo + Marketplace page + owner's X profile). Missed in the original plan; fixed here.

---

## 14. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **RikoAppDev pivots ai-agent-activity-for-dc to terminal detection** — they shipped 2026-04-04, already have personality layer + BYO Client ID. If they swap `(vscode as any).chat` for `onDidStartTerminalShellExecution`, they close the gap in a weekend. | Medium | **Existential** | **Ship in 2 weeks.** Publish before they notice their detection is wrong. |
| tsanva wraps cc-discord-presence's Go daemon in a VSIX with token/cost telemetry | Low-Medium | High | Reserve v0.2 telemetry roadmap space. Companion-plugin pattern matches their fidelity. Multi-agent is our moat; they're Claude-only. |
| Shell integration disabled by user or shell | Medium | High (no detection) | Three-tier fallback: fs-watch on session files, then polling. Document in README. |
| Cursor on Windows: shell integration broken (forum threads cited in §15) | High (on that platform) | Medium | Tier Cursor-Windows as best-effort. fs-watch fallback covers most cases. |
| Discord rate-limit disconnect | Low | Medium | 2s leading+trailing throttle (vscord-proven). Backoff on disconnect. |
| `setActivity(null)` ghost presence (historical vscord bug) | Low | Low | Use `clearActivity(pid)` (FR-4.3). Always set fresh asset keys on transitions. |
| Multiple parallel `claude` sessions | High (2–3 median per user research) | Low | Per-terminal session map; AGENT_ACTIVE until set is empty. |
| Claude Code invocation changes (new CLI name, package move) | Medium | Medium | Regex covers common forms; `detect.customPatterns` escape hatch; extension doesn't crash on no-match. |
| Anthropic/Cursor sends trademark letter about app name collision | Very low | Medium | `Agent Mode` is descriptive, not a trademark. Rename path documented if needed; extension supports live `clientId` swap (no user-side breakage). |
| Marketplace rejects first submission | Low | Low | `vsce package` + `ovsx publish --dry-run` before tagging. No proposed APIs. |
| Flatpak Discord users — RPC socket not exposed | Medium | Medium-Low | Document workaround (`discord-flatpak-rpc-bridge`). Don't try to solve in-extension. |

---

## 15. Verification Plan

### Local dev loop
1. `pnpm install && pnpm watch` — esbuild in watch mode.
2. `F5` → Extension Development Host.
3. Ensure Discord desktop is running (RPC uses local IPC — web client won't work).
4. Run `claude` in the dev-host integrated terminal. **Expect:** presence flips to AGENT_ACTIVE (goblin pack: "locked in fr"), frame cycles every ~2s, elapsed timer starts at 0. Exit → CODING or IDLE.
5. Open a `.ts` file. **Expect:** CODING presence (respecting privacy mode).
6. Walk away for `idleTimeoutSeconds`. **Expect:** IDLE.
7. Flip each privacy setting live. **Expect:** next update redacts without reload.
8. Run `aider` / `codex` / `gemini` / `opencode` separately. **Expect:** correct agent sub-label, correct per-agent copy pool.
9. Open two `claude` sessions in parallel. **Expect:** AGENT_ACTIVE holds until both exit.
10. Install the companion plugin via `claude plugin install`. **Expect:** detection is instant and exact, not regex-dependent.

### Unit tests (`vitest`, no `vscode` dep)
- `state/machine.test.ts` — every transition
- `rpc/throttle.test.ts` — ≤ 1 flush / 2s, leading + trailing, latest-wins
- `presence/animator.test.ts` — pack + tick count → expected frame + no-repeat invariant
- `detectors/regex.test.ts` — all 5 agents + Low-confidence ANSI/prompt prefixes + `npx @anthropic-ai/claude-code` + shell alias variants
- `privacy.test.ts` — `hash` determinism, ignore lists (glob + regex)

### Cross-editor smoke
- `vsce package` → "Install from VSIX…" in Cursor → repeat local-dev steps 3–10.
- Best-effort test on Windows Cursor (known broken shell integration there; validate fs-watch fallback fires).

### Publish dry-run
- `vsce package` (inspect bundled files via `.vscodeignore`)
- `ovsx publish --dry-run` before tagging
- `vsce publish --pre-release` for the first 2–3 releases

---

## 16. Competitive Analysis

### Feature matrix

| | Terminal detect | Multi-agent | Idle handling | Custom packs | Privacy ignore | Git | Multi-editor | BYO Client ID | Active? |
|---|---|---|---|---|---|---|---|---|---|
| **vscord** | ✗ | ✗ | ✓ | partial | partial (binary) | ✓ | ✓ (5 apps) | ✓ | ✓ |
| **iCrawl/discord-vscode** | ✗ | ✗ | partial | partial | partial (regex) | ✓ | partial | ✗ | partial (Marketplace stale) |
| **RikoAppDev/ai-agent-activity** | ✗ (uses chat API + edit heuristic) | partial | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | new, dormant |
| **tsanva/cc-discord-presence** (Go daemon) | n/a | ✗ (Claude only) | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | dormant |
| **Codex-Discord-Rich-Presence** (Rust daemon) | n/a | ✗ (Codex only) | ✓ | ✗ | ✗ | partial | ✓ | required | active |
| **opencode-discord-presence** (plugin) | n/a | ✗ (OpenCode only) | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | dormant |
| **Agent Mode (this)** | ✓ | ✓ (5 agents) | ✓ | ✓ | ✓ (4 lists) | ✓ | ✓ (Marketplace + OpenVSX) | ✓ | — |

### Positioning one-liners

- **vs vscord / iCrawl:** "Finally stops saying 'Idling' while Claude cooks in your terminal."
- **vs RikoAppDev:** "Detects Claude Code where it actually runs — the terminal — not via fragile chat-API reflection."
- **vs cc-discord-presence / Codex / opencode daemons:** "No Go toolchain, no Rust, no plugin system. One VSIX. Five agents."

### What we don't copy

- vscord's **160 settings** (issue #151 — users hate it). We stay at ~20.
- RikoAppDev's `(vscode as any).chat` casts — proposed APIs break Marketplace compliance.
- RikoAppDev's edit heuristic — false-positives on Prettier / paste.
- cc-discord-presence's homegrown IPC — `@xhayper/discord-rpc` is the solved problem.
- Codex-Discord's BYO-Discord-app onboarding — kills install rate.
- iCrawl's "press button to reconnect" UX — #145 / #111 complaint generator.

---

## 17. Open Questions (mostly resolved — tracking for launch)

1. **Bundled default Client ID strategy.** Resolved: bundle the `Agent Mode` app's Client ID as default. Allow override via `agentMode.clientId` for tinkerers and future editor-variant brands.
2. **Idle: show vs clear.** Resolved: `show` default (personality-driven rotating messages), `clear` available via `idleBehavior` setting. Never "disconnect" — it orphans the reconnect loop.
3. **Commit-count pill.** Cut from v0.1. Revisit if telemetry bridge (v0.2) ships.
4. **Sponsor button.** Add GitHub Sponsors link post-launch if install count crosses 500.

---

## 18. Guardrails for implementing agents

These are hard rules. Violating them will produce a broken extension or a broken release.

**Do not:**
- Use the `discord-rpc` npm package. It's five years dead. Use `@xhayper/discord-rpc` (upstream: `Khaomi/discord-rpc`).
- Cast to proposed APIs (`(vscode as any).chat`, `(vscode as any).lm`). RikoAppDev's extension does this; ours will not. It breaks Marketplace compliance and Marcus doesn't use `vscode.chat` anyway.
- Parse `~/.claude/projects/*.jsonl` content. Use mtime + existence only. The format is undocumented and can change without notice (§FR-1.8).
- Call `setActivity(null)` to clear. Use `client.user?.clearActivity(process.pid)`. `setActivity(null)` leaves ghost presences on some Discord client versions.
- Ship activation events broader than `onStartupFinished`. No `"*"`, no `onLanguage:*`.
- Add runtime dependencies beyond `@xhayper/discord-rpc`. Ask the owner if something looks necessary — usually it isn't.
- Add settings beyond the 20 in §7.8 without explicit approval. vscord has 160 settings and users file issues about it (#151).
- Parse the `commandLine.value` string for anything beyond agent identification. Do not extract flags, file paths, or prompts from it.
- Store anything to disk beyond VS Code's standard extension storage API. No `~/.config/agent-mode-discord/`, no writes to `~/.claude/*` from the extension (the companion plugin writes lockfiles; the extension only reads).
- Make network requests other than Discord IPC. No telemetry, no update checks, no asset CDNs.

**Do:**
- Use pnpm. Not npm, not yarn.
- Use vitest. Not jest, not mocha.
- Use esbuild. Not webpack, not rollup.
- Use Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- Keep files under 200 lines. If a file grows past that, split it along natural boundaries.
- Gate every file system read and Discord call with try/catch; log at `debug` level; never toast errors unless `debug.verbose === true`.
- Write tests alongside feature code in the same milestone, not after.
- Pin `@xhayper/discord-rpc` exactly (no `^`) if bundle size becomes a problem — otherwise `^1.3.1` is fine.
- When unsure about a design choice, re-read §2 (problem) and §4 (Marcus). If Marcus wouldn't notice or care, cut it.

---

## 19. Appendix — Key Technical References

| Topic | Source |
|---|---|
| Shell Integration API (stable, 1.93+) | `vscode.d.ts` L7711-8142: https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.d.ts#L7711-L8142 |
| Release note (API introduced) | https://code.visualstudio.com/updates/v1_93 |
| `commandLine.confidence` semantics | `vscode.d.ts` L8027-8052 (Low / Medium / High) |
| Discord RPC lib | https://www.npmjs.com/package/@xhayper/discord-rpc (v1.3.1) — upstream now at https://github.com/Khaomi/discord-rpc |
| Claude Code hooks (`SessionStart` / `SessionEnd`) | https://code.claude.com/docs/en/hooks |
| Claude Code env vars (`CLAUDECODE=1`) | https://code.claude.com/docs/en/env-vars |
| Claude Code plugin reference (cc-discord-presence) | https://github.com/tsanva/cc-discord-presence/blob/main/.claude-plugin/plugin.json |
| OpenCode plugin API | https://opencode.ai/docs/plugins/ |
| Built-in git API | `vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)` |
| `@vscode/vsce` | https://www.npmjs.com/package/@vscode/vsce (3.7.1+) |
| OpenVSX namespace claim | https://open-vsx.org/namespace/ |
| vscord (incumbent, reference) | https://github.com/LeonardSSH/vscord (also transferred to https://github.com/narcisbugeag/vscord) |
| RikoAppDev (nearest competitor) | https://github.com/RikoAppDev/ai-agent-activity |
| Cursor Windows shell-integration issues | https://forum.cursor.com/t/terminal-commands-fail-due-to-shell-integration-error-on-windows-11-cursor-0-46-8/59440, https://forum.cursor.com/t/agent-terminal-no-longer-uses-interactive-shell-or-respects-vs-code-terminal-settings/134852 |
| vscord "stuck on Idling over SSH" (the pain we solve) | https://github.com/LeonardSSH/vscord/issues/26 |
| iCrawl "hide workspace name for private projects" (5-year privacy ask) | https://github.com/iCrawl/discord-vscode/issues/31 |
| ccusage statusline (v0.2 telemetry inspiration) | https://ccusage.com/guide/statusline |
