# Agent Mode

Discord Rich Presence that knows when you're cooking with Claude -- not idling.

[![CI](https://github.com/leonardojaques/agent-mode-discord/actions/workflows/ci.yml/badge.svg)](https://github.com/leonardojaques/agent-mode-discord/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
<!-- Uncomment after Phase 6 publish -->
<!-- [![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/agent-mode-dev.agent-mode-discord)](https://marketplace.visualstudio.com/items?itemName=agent-mode-dev.agent-mode-discord) -->
<!-- [![OpenVSX](https://img.shields.io/open-vsx/v/agent-mode-dev/agent-mode-discord)](https://open-vsx.org/extension/agent-mode-dev/agent-mode-discord) -->
<!-- [![Installs](https://img.shields.io/visual-studio-marketplace/i/agent-mode-dev.agent-mode-discord)](https://marketplace.visualstudio.com/items?itemName=agent-mode-dev.agent-mode-discord) -->

---

<!-- Demo GIF: see assets/CAPTURE-INSTRUCTIONS.md -->

> Your Discord friends see "cooking with Claude" instead of a stale away dot.

---

## Features

- **Real-time agent detection** -- flips to "cooking" the moment `claude` starts in the integrated terminal
- **Multi-tier detection** -- Shell Integration API (VS Code 1.93+) > session file watch > terminal polling; highest-fidelity tier wins automatically
- **Companion plugin** -- optional Claude Code plugin writes a lockfile signal for the highest-fidelity tier (tier-1)
- **Goblin personality** -- rotating goblin-voice copy with frame animations; every status message feels personal, not generic
- **Privacy controls** -- show / hide / hash workspace name, filename, branch; ignore lists for repos, orgs, git hosts, and workspace paths
- **Zero network** -- Discord IPC only (local Unix socket / Windows named pipe); zero outbound HTTP, zero telemetry
- **Lightweight** -- packaged VSIX under 500 KB, extension activates in under 50ms

### How Detection Works

Agent Mode uses a tiered detection pipeline. The highest tier with an active signal wins:

| Tier | Method | Latency | When available |
|------|--------|---------|----------------|
| 1 | Companion plugin lockfile (`~/.claude/agent-mode-discord.lock`) | <100ms | Companion plugin installed |
| 2 | Shell Integration API (`onDidStartTerminalShellExecution`) | <500ms | VS Code 1.93+, shell integration enabled |
| 3 | Session file watch (`~/.claude/projects/*.jsonl` mtime) | ~1s | Claude Code project directory exists |
| 4 | Terminal output polling | ~2s | Always available (fallback) |

Every existing Discord presence extension (vscord, discord-vscode, RikoAppDev) watches `onDidChangeActiveTextEditor` only -- so Discord flips to idle during 2-4 hour AI sessions when you're reading diffs and prompting, not typing. Agent Mode closes that gap.

---

## Install

### VS Code Marketplace

```
ext install agent-mode-dev.agent-mode-discord
```

Or search **"Agent Mode"** in the Extensions sidebar (Ctrl+Shift+X / Cmd+Shift+X).

### OpenVSX (Cursor / VSCodium / Windsurf)

```
ext install agent-mode-dev.agent-mode-discord
```

Or download directly from [open-vsx.org](https://open-vsx.org/extension/agent-mode-dev/agent-mode-discord).

### Manual VSIX

```bash
# Download the latest .vsix from GitHub Releases
code --install-extension agent-mode-discord-0.1.0.vsix
```

### Companion Plugin (optional, recommended)

Clone or download this repository, then from the repo root run (in a shell):

```bash
claude plugin install ./companion/claude-code-plugin
```

Or, from an already-running Claude Code session, use the slash command:

```
/plugin install ./companion/claude-code-plugin
```

Provides the highest-fidelity agent-detection signal (tier-1 lockfile). See [companion/claude-code-plugin/README.md](companion/claude-code-plugin/README.md) for troubleshooting.

---

## Goblin Pack Preview

Agent Mode ships with the `goblin` personality pack. Messages rotate every 20 seconds with frame animations.

```
AGENT_ACTIVE (claude):   "the goblin is consulting claude on dungeon logistics"
AGENT_ACTIVE (generic):  "a creature is receiving instructions from the abyss"
CODING:                  "the goblin is scribbling runes into the editor"
IDLE:                    "the goblin waits... tapping its claws on the desk..."
```

Point `agentMode.messages.customPackPath` at your own JSON file to use a custom pack.

---

## Configuration

Agent Mode exposes 14 settings under `agentMode.*`. All changes apply on the next rotation tick -- no reload required.

Open: **Preferences: Open Settings (UI)** and search **"Agent Mode"**.

| Setting | Default | Description |
|---------|---------|-------------|
| `agentMode.clientId` | (bundled) | Override Discord Client ID |
| `agentMode.idleBehavior` | `show` | `show` or `clear` on idle |
| `agentMode.privacy.workspaceName` | `show` | `show` / `hide` / `hash` |
| `agentMode.privacy.filename` | `show` | `show` / `hide` |
| `agentMode.privacy.gitBranch` | `show` | `show` / `hide` |
| `agentMode.animations.enabled` | `true` | Enable frame cycling |
| `agentMode.messages.customPackPath` | `""` | Absolute path to a custom JSON copy pack |
| `agentMode.ignore.workspaces` | `[]` | Glob patterns for paths to silence entirely |
| `agentMode.ignore.repositories` | `[]` | Regex patterns matched against host/owner/repo |
| `agentMode.debug.verbose` | `false` | Verbose output channel logging |

---

## Privacy FAQ

**What does this extension send to the internet?**
Nothing. It communicates exclusively over Discord's local IPC socket (Unix socket on macOS/Linux, named pipe on Windows). Zero outbound HTTP requests. Verified by a CI check that greps the built bundle for HTTP patterns.

**What shows in Discord by default?**
Your workspace name, active filename, git branch, and goblin-voice status copy. All visible to your Discord friends.

**How do I hide sensitive info?**
Set `agentMode.privacy.workspaceName` to `hide` or `hash`, `agentMode.privacy.filename` to `hide`, `agentMode.privacy.gitBranch` to `hide`. Use `agentMode.ignore.workspaces` glob patterns to fully silence the extension in specific workspaces.

**Can my employer see my activity?**
Only your Discord friends can see your Rich Presence. There is no server-side component, no analytics, no telemetry.

---

## Competitive Positioning

How Agent Mode compares to existing Discord presence extensions (as of v0.1.0, April 2026):

| Feature | Agent Mode | [vscord](https://marketplace.visualstudio.com/items?itemName=LeonardSSH.vscord) | [discord-vscode](https://marketplace.visualstudio.com/items?itemName=icrawl.discord-vscode) | [RikoAppDev](https://marketplace.visualstudio.com/items?itemName=RikoAppDev.ai-agent-activity) |
|---------|-----------|--------|----------------|------------|
| Terminal agent detection | Yes (multi-tier) | No | No | Partial (proposed API) |
| Shell Integration API | Yes (stable API) | No | No | No (uses `(vscode as any).chat`) |
| Claude Code companion | Yes (lockfile) | No | No | No |
| Multi-agent support | Yes (5 agents) | No | No | Partial (edit heuristic) |
| Marketplace-compliant | Yes (zero proposed APIs) | Yes | Yes | No (`(vscode as any).*`) |
| Bundle size | <500 KB | ~2 MB | ~1 MB | ~500 KB |
| Configuration keys | 14 | 160+ | ~30 | ~15 |
| Privacy controls | show/hide/hash + ignore lists | Limited | Basic | None |
| Network requests | None (IPC only) | None | None | Unknown |
| Copy personality | Goblin pack + custom packs | Generic | Generic | Generic |

---

## Troubleshooting

**Cursor on Windows**
Shell Integration may be unreliable in Cursor on Windows. Agent Mode falls back automatically to `~/.claude/projects/*.jsonl` file watching (tier-3). For best results, install the companion plugin (tier-1 lockfile bypasses shell integration entirely).

**fish shell**
Shell Integration works with fish. If detection fails, check that fish's VS Code integration script is loaded:
```fish
string match -q "$TERM_PROGRAM" vscode
```
If not matched, source the VS Code shell integration script from your `config.fish`.

**Command Prompt (cmd.exe)**
Shell Integration is not available in cmd.exe. Use PowerShell or install the companion plugin for agent detection.

**Flatpak Discord**
Discord installed via Flatpak may not expose the IPC socket to other applications. Use the `.deb` / `.tar.gz` install instead, or configure Flatpak to share the socket:
```bash
flatpak override --user --filesystem=xdg-run/discord-ipc-*
```

**"No presence showing"**
1. Ensure Discord desktop is running (not browser Discord).
2. Check Activity Privacy: Discord Settings > Activity Privacy > "Display current activity as a status message" must be **ON**.
3. Enable `agentMode.debug.verbose` and check the **"Agent Mode (Discord)"** output channel for connection errors.

---

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

File an issue first for anything beyond a typo fix. All submitted code must pass `pnpm test` and `pnpm run typecheck`.

Bug reports with a minimal reproduction case are especially welcome -- detection edge cases across shells and OSes are the hardest to cover solo.

---

<!-- Sponsor placeholder: activated if install count crosses 500 (DIST-V2-01) -->
If this extension saves you from looking AFK during your AI sessions, consider starring the repo.

---

## License

[MIT](LICENSE) -- 2026 Leonardo Jaques

---

Solo project, maintained on my own schedule. Issues welcome; PRs require a filed issue first. Response time varies -- this is a passion project, not a product.
