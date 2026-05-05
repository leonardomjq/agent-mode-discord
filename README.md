# goblin mode — Discord rich presence for AI coding

Friends see when **Claude Code**, **Cursor**, **Codex**, or **Gemini** is shipping for you — not when your cursor blinks.

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/leonardomjq.goblin-mode?label=Marketplace)](https://marketplace.visualstudio.com/items?itemName=leonardomjq.goblin-mode)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/leonardomjq.goblin-mode?label=installs)](https://marketplace.visualstudio.com/items?itemName=leonardomjq.goblin-mode)
[![OpenVSX](https://img.shields.io/open-vsx/v/leonardomjq/goblin-mode?label=OpenVSX)](https://open-vsx.org/extension/leonardomjq/goblin-mode)
[![CI](https://github.com/leonardomjq/agent-mode-discord/actions/workflows/ci.yml/badge.svg)](https://github.com/leonardomjq/agent-mode-discord/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What your Discord card looks like

While Claude (or Codex / Gemini / OpenCode) is working in your terminal:

```
Watching goblin mode
claude is cooking
afternoon shift
```

Lines rotate. Time-of-day flips automatically. Your friends DMing you see *something is happening* — not a stale away dot.

> Demo screenshot — coming soon.

---

## Why this beats every other Discord presence extension

Every other one (vscord, discord-vscode, RikoAppDev) watches your editor cursor. The moment you stop typing, they flip to idle — useless during the 2-hour stretches where AI is doing the actual work and you're reading diffs.

goblin mode watches the **terminal** + **Claude Code session files** + an optional **companion lockfile**. As long as the AI is doing something for you, the card stays alive.

---

## Install

### VS Code

Search **"goblin mode"** in the Extensions sidebar (`Cmd+Shift+X` / `Ctrl+Shift+X`), or:

```
ext install leonardomjq.goblin-mode
```

### Cursor / VSCodium / Windsurf

Same — search **"goblin mode"** in Extensions. Pulls from OpenVSX automatically.

### Companion plugin (optional, recommended)

Highest-fidelity AI detection. From this repo's root, in any shell:

```sh
claude plugin install ./companion/claude-code-plugin
```

Or from inside a Claude Code session:

```
/plugin install ./companion/claude-code-plugin
```

Detail: [companion/claude-code-plugin/README.md](companion/claude-code-plugin/README.md).

---

## Privacy

- **Zero outbound HTTP.** Discord IPC only — local socket on macOS/Linux, named pipe on Windows. CI-verified by `scripts/check-no-network.mjs` on every build.
- **Hide what you don't want shared.** Per-field `show` / `hide` / `hash` controls for workspace name, filename, and git branch.
- **Silence specific repos, orgs, hosts, or paths.** Glob + regex ignore lists.
- **No analytics. No telemetry. No server.** Solo project, MIT licensed.

Anything Discord receives is forwarded by your local Discord client, not by this extension. That hop is governed by [Discord's privacy policy](https://discord.com/privacy).

---

## Configuration

Open Settings → search **Agent Mode**. Most-used knobs:

| Setting | Default | What it does |
|---|---|---|
| `agentMode.activityType` | `watching` | Discord card prefix. Switch to `playing` if your client doesn't render Watching. |
| `agentMode.idleBehavior` | `show` | When no AI is active — `show` rotation copy, or `clear` the card. |
| `agentMode.privacy.workspaceName` | `show` | `show` / `hide` / `hash` |
| `agentMode.privacy.filename` | `show` | `show` / `hide` |
| `agentMode.privacy.gitBranch` | `show` | `show` / `hide` |
| `agentMode.animations.enabled` | `true` | Frame-cycling rotation. |
| `agentMode.messages.customPackPath` | `""` | Path to your own JSON copy pack. |

Full setting reference lives in [`package.json`](package.json) under `contributes.configuration`.

---

## Troubleshooting

**Discord shows nothing**
1. Discord desktop is running (not the browser).
2. Discord Settings → Activity Privacy → "Display current activity as a status message" must be **ON**.
3. Enable `agentMode.debug.verbose` and check the **Agent Mode (Discord)** output channel.

**Card stuck on old copy after upgrade**
Cursor's extension cache survives `Reload Window`. Cmd+Q the app, reopen.

More edge cases: [docs/CURSOR-COMPAT.md](docs/CURSOR-COMPAT.md) · [docs/MULTI-WINDOW.md](docs/MULTI-WINDOW.md) · [Advanced section below](#advanced).

---

## Advanced

<details>
<summary><strong>How detection works (multi-tier pipeline)</strong></summary>

Highest-fidelity tier with an active signal wins.

| Tier | Method | Latency | When available |
|---|---|---|---|
| 1 | Companion plugin lockfile (`~/.claude/agent-mode-discord.lock`) | <100 ms | Companion plugin installed |
| 2 | Shell Integration API (`onDidStartTerminalShellExecution`) | <500 ms | VS Code 1.93+, shell integration enabled |
| 3 | Session-file watch (`~/.claude/projects/*.jsonl` mtime) | ~1 s | Claude Code project directory exists |
| 4 | Terminal output polling | ~2 s | Always available (fallback) |

</details>

<details>
<summary><strong>Goblin pack — actual lines that ship</strong></summary>

```
AGENT_ACTIVE — primary:   AI is cooking · AI in the kitchen · AI is locked in · AI is building
AGENT_ACTIVE — claude:    claude is cooking · claude in the kitchen · claude is locked in · claude is building
AGENT_ACTIVE — codex:     codex is cooking · codex in the kitchen · codex is locked in
CODING:                   claude awaiting input · claude is paused
IDLE:                     claude on standby · claude is resting
```

Time-of-day modifier (the second card line): `3am goblin shift` · `morning service` · `afternoon shift` · `evening service`.

Ship a custom pack: point `agentMode.messages.customPackPath` at your own JSON file.

</details>

<details>
<summary><strong>Custom Discord Client ID (bus factor)</strong></summary>

By default this extension talks to a Discord Application owned by me (Client ID `1493599126217297981`). If I lose access to that account, every install goes silent.

Insulate yourself in 2 minutes:

1. [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. Copy the **Application ID**.
3. VS Code Settings → `agentMode.clientId` → paste.

Also lets you upload custom large/small assets (your own goblin art).

Env-var override for ad-hoc / CI use: `AGENT_MODE_CLIENT_ID=your-id-here code .`

</details>

<details>
<summary><strong>Comparison vs other Discord presence extensions</strong></summary>

| Feature | goblin mode | [vscord](https://marketplace.visualstudio.com/items?itemName=LeonardSSH.vscord) | [discord-vscode](https://marketplace.visualstudio.com/items?itemName=icrawl.discord-vscode) | [RikoAppDev](https://marketplace.visualstudio.com/items?itemName=RikoAppDev.ai-agent-activity) |
|---|---|---|---|---|
| Terminal AI agent detection | ✅ multi-tier | ✗ | ✗ | partial (proposed API) |
| Stable VS Code APIs only | ✅ | ✅ | ✅ | ✗ uses `(vscode as any).chat` |
| Claude Code companion | ✅ lockfile | ✗ | ✗ | ✗ |
| Multi-agent (claude / codex / gemini / opencode) | ✅ | ✗ | ✗ | partial |
| Watching activity type default | ✅ | ✗ | ✗ | ✗ |
| Bundle size | ~220 KB | ~2 MB | ~1 MB | ~500 KB |
| Privacy controls | show / hide / hash + ignore lists | limited | basic | none |
| Network requests | none (IPC only) | none | none | unknown |

</details>

<details>
<summary><strong>Edge-case troubleshooting (shells, OS specifics)</strong></summary>

- **Cursor on Windows:** Shell Integration is unreliable. Falls back to session-file watch automatically. For best results install the companion plugin.
- **fish shell:** Confirm VS Code's integration script is loaded — `string match -q "$TERM_PROGRAM" vscode` should match. If not, source the script in `config.fish`.
- **cmd.exe:** Shell Integration not supported. Use PowerShell or the companion plugin.
- **Flatpak Discord:** IPC socket may not be exposed across the sandbox. Use the `.deb` / `.tar.gz` Discord install, or:
  ```sh
  flatpak override --user --filesystem=xdg-run/discord-ipc-*
  ```

</details>

<details>
<summary><strong>Observability — what's externally visible (no telemetry shipped)</strong></summary>

This extension ships zero telemetry. What's visible elsewhere:

- **Discord Developer Portal** (private to the maintainer) shows DAU/MAU and activity counts for Client ID `1493599126217297981`. Use your own Client ID per "Custom Discord Client ID" above to opt out entirely.
- **VS Code Marketplace** and **OpenVSX** show public install counts on the listing pages.

</details>

---

## Contributing

Issues + PRs welcome. File an issue first for anything beyond a typo. All code must pass `pnpm test` and `pnpm typecheck`.

## License

[MIT](LICENSE) — 2026 Leonardo Jaques

If goblin mode keeps you out of the AFK pit during AI sessions, ⭐ the [repo](https://github.com/leonardomjq/agent-mode-discord).
