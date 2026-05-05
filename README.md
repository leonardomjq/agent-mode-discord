# goblin mode — Discord rich presence for AI coding

Discord rich presence that knows when you're cooking with **Claude Code**, **Cursor**, **Codex**, **Gemini**, or **OpenCode** — not idling.

[![CI](https://github.com/leonardomjq/agent-mode-discord/actions/workflows/ci.yml/badge.svg)](https://github.com/leonardomjq/agent-mode-discord/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/leonardomjq.goblin-mode)](https://marketplace.visualstudio.com/items?itemName=leonardomjq.goblin-mode)
[![OpenVSX](https://img.shields.io/open-vsx/v/leonardomjq/goblin-mode)](https://open-vsx.org/extension/leonardomjq/goblin-mode)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/leonardomjq.goblin-mode)](https://marketplace.visualstudio.com/items?itemName=leonardomjq.goblin-mode)

---

> Your Discord friends see **"Watching claude shipping code"** instead of a stale away dot.

---

## Features

- **Real-time AI agent detection** — flips to "cooking" the moment `claude`, `codex`, `gemini`, or `opencode` starts in the integrated terminal
- **Multi-tier detection** — Shell Integration API (VS Code 1.93+) > session-file watch > terminal polling; highest-fidelity tier wins automatically
- **Companion plugin** — optional Claude Code plugin writes a lockfile signal for the highest-fidelity tier (tier-1)
- **Watching activity type by default** — Discord card reads `Watching goblin mode` instead of generic `Playing`; pattern-interrupts the typical IDE-presence look
- **Goblin voice copy** — rotating one-glance lines that name the AI explicitly (`claude shipping code`, `codex on a PR`, `the agent locked in`); custom packs supported
- **Privacy controls** — show / hide / hash workspace name, filename, branch; ignore lists for repos, orgs, git hosts, and workspace paths
- **Zero network** — Discord IPC only (local Unix socket / Windows named pipe); zero outbound HTTP, zero telemetry
- **Lightweight** — packaged VSIX under 500 KB, extension activates in under 50 ms

### How detection works

goblin mode uses a tiered detection pipeline. The highest tier with an active signal wins:

| Tier | Method | Latency | When available |
|------|--------|---------|----------------|
| 1 | Companion plugin lockfile (`~/.claude/agent-mode-discord.lock`) | <100 ms | Companion plugin installed |
| 2 | Shell Integration API (`onDidStartTerminalShellExecution`) | <500 ms | VS Code 1.93+, shell integration enabled |
| 3 | Session-file watch (`~/.claude/projects/*.jsonl` mtime) | ~1 s | Claude Code project directory exists |
| 4 | Terminal output polling | ~2 s | Always available (fallback) |

Every existing Discord presence extension (vscord, discord-vscode, RikoAppDev) watches `onDidChangeActiveTextEditor` only — so Discord flips to idle during 2–4 hour AI sessions when you're reading diffs and prompting, not typing. goblin mode closes that gap.

---

## Install

### VS Code Marketplace

```
ext install leonardomjq.goblin-mode
```

Or search **"goblin mode"** in the Extensions sidebar (Ctrl+Shift+X / Cmd+Shift+X).

Direct link: [marketplace.visualstudio.com/items?itemName=leonardomjq.goblin-mode](https://marketplace.visualstudio.com/items?itemName=leonardomjq.goblin-mode)

### Cursor / VSCodium / Windsurf (OpenVSX)

```
ext install leonardomjq.goblin-mode
```

Or download directly from [open-vsx.org](https://open-vsx.org/extension/leonardomjq/goblin-mode).

> **Note for Cursor users:** Cursor proxies OpenVSX through `marketplace.cursorapi.com`, which can serve stale cache for hours after a publish. If `cursor --install-extension leonardomjq.goblin-mode --force` returns 503, fall back to a local VSIX install (see "Manual VSIX" below).

### Manual VSIX

```bash
# Download the latest .vsix from GitHub Releases
code --install-extension goblin-mode-*.vsix
# Or in Cursor:
cursor --install-extension goblin-mode-*.vsix --force
```

### Companion plugin (optional, recommended)

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

## Goblin pack preview

goblin mode ships with the `goblin` personality pack. Lines name the AI explicitly and pass the one-glance test (a Discord viewer should parse the card in under a second).

```
AGENT_ACTIVE (claude):   "claude cooking" / "claude shipping code" / "claude on a PR" / "claude locked in"
AGENT_ACTIVE (codex):    "codex cooking" / "codex shipping code" / "codex on a PR"
AGENT_ACTIVE (generic):  "the agent cooking" / "the agent shipping code" / "the agent on a PR" / "the agent locked in"
CODING:                  "claude paused for review" / "claude waiting on the prompt"
IDLE:                    "claude on standby" / "claude awaiting the spec"
```

Point `agentMode.messages.customPackPath` at your own JSON file to ship a custom pack.

---

## Configuration

goblin mode exposes its settings under `agentMode.*`. Changes apply on the next rotation tick — no reload required.

Open: **Preferences: Open Settings (UI)** and search **"Agent Mode"** (the configuration namespace is unchanged for backwards compatibility).

| Setting | Default | Description |
|---------|---------|-------------|
| `agentMode.activityType` | `watching` | `watching` or `playing` — Discord ActivityType prefix |
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

### Activity type — Watching vs Playing

Default is **Watching** — your Discord card reads `Watching goblin mode / claude shipping code`. This is the brand stance: you're supervising the AI agent, not pretending to type every keystroke yourself.

If your Discord client doesn't render the Watching prefix correctly (some older mobile clients), switch `agentMode.activityType` to `playing`. The card then reads `Playing goblin mode / claude shipping code`.

---

## Privacy FAQ

**What does this extension send to the internet?**
The extension itself makes **zero outbound HTTP requests** — verified by a CI check (`scripts/check-no-network.mjs`) that greps the built bundle for `http.request`, `https.request`, `fetch`, `undici`, `node-fetch`, and `XMLHttpRequest`. All communication uses Discord's local IPC (Unix socket on macOS/Linux, named pipe on Windows) to the Discord desktop client running on your machine.

From there, the local Discord client forwards your activity payload (workspace name, filename, branch, status copy — whatever you have not redacted via the `agentMode.privacy.*` settings) to Discord's servers. That last hop is part of how Discord rich presence works, controlled by the Discord client itself, not by this extension. Anything Discord receives is subject to [Discord's privacy policy](https://discord.com/privacy) — not ours.

**What shows in Discord by default?**
Your workspace name, active filename, git branch, and goblin-voice status copy. All visible to your Discord friends.

**How do I hide sensitive info?**
Set `agentMode.privacy.workspaceName` to `hide` or `hash`, `agentMode.privacy.filename` to `hide`, `agentMode.privacy.gitBranch` to `hide`. Use `agentMode.ignore.workspaces` glob patterns to fully silence the extension in specific workspaces.

**Can my employer see my activity?**
Only your Discord friends can see your rich presence. There is no server-side component, no analytics, no telemetry.

### Bus factor — using your own Client ID

Every install of this extension talks to the same Discord Application — Client ID `1493599126217297981`, owned by the maintainer ([Leonardo Jaques](https://github.com/leonardomjq)). That works fine until it doesn't: if I lose access to the Discord developer account (lost MFA device, account banned, hit by the proverbial bus), all installs go silent until someone files a PR with a new ID.

To insulate yourself from that, register your own Discord Application in 2 minutes and override the bundled Client ID in your VS Code settings:

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and click **New Application**. Give it any name — only you and your Discord friends will see it.
2. Copy the **Application ID** from the General Information page.
3. In VS Code, open settings (`Cmd/Ctrl + ,`), search for `agentMode.clientId`, and paste your ID into the override field.
4. Reload the window (or wait for the next rotation tick). Your presence is now flowing through your own Discord application; no further dependency on this project's bundled ID.

The override path also accepts an environment variable for ad-hoc / CI use: `AGENT_MODE_CLIENT_ID=your-id-here code .` (see [`src/rpc/client.ts`](src/rpc/client.ts) line 9). The setting wins over the env var when both are present.

This is also the recommended path if you want to upload custom large/small assets (e.g., your own goblin art) — Discord rich presence asset uploads are scoped to the Application that owns them.

---

## Observability

This project doesn't ship telemetry — no analytics SDK, no opt-in tracker, no extension-side metrics surface. What follows is a description of what's *already* visible through external surfaces, so you know what's measurable without any extension code:

**Discord Developer Portal** exposes the following metrics for the bundled Client ID `1493599126217297981`:

- **DAU / MAU** — daily and monthly active users with this extension talking to Discord
- **Activity counts** — how often rich presence payloads are sent
- **Authorized installs** — total Discord accounts that have ever connected

These are visible only to the Discord developer account that owns the Application. They aren't public, and they aren't sent anywhere else. If you've followed the *Bus factor* section above and registered your own Client ID, these metrics for your install flow into your own Developer Portal dashboard, not mine.

**VS Code Marketplace** and **OpenVSX** expose extension install counts and version-over-version uptake on the listing pages.

---

## Competitive positioning

How goblin mode compares to existing Discord presence extensions:

| Feature | goblin mode | [vscord](https://marketplace.visualstudio.com/items?itemName=LeonardSSH.vscord) | [discord-vscode](https://marketplace.visualstudio.com/items?itemName=icrawl.discord-vscode) | [RikoAppDev](https://marketplace.visualstudio.com/items?itemName=RikoAppDev.ai-agent-activity) |
|---------|-------------|--------|----------------|------------|
| Terminal AI agent detection | Yes (multi-tier) | No | No | Partial (proposed API) |
| Shell Integration API | Yes (stable API) | No | No | No (uses `(vscode as any).chat`) |
| Claude Code companion | Yes (lockfile) | No | No | No |
| Multi-agent support | Yes (claude / codex / gemini / opencode) | No | No | Partial (edit heuristic) |
| Watching activity type | Yes (default) | No | No | No |
| Marketplace-compliant | Yes (zero proposed APIs) | Yes | Yes | No (`(vscode as any).*`) |
| Bundle size | <500 KB | ~2 MB | ~1 MB | ~500 KB |
| Privacy controls | show / hide / hash + ignore lists | Limited | Basic | None |
| Network requests | None (IPC only) | None | None | Unknown |
| Copy personality | goblin pack + custom packs | Generic | Generic | Generic |

---

## Troubleshooting

**Cursor on Windows**
Shell Integration may be unreliable in Cursor on Windows. goblin mode falls back automatically to `~/.claude/projects/*.jsonl` file watching (tier-3). For best results, install the companion plugin (tier-1 lockfile bypasses shell integration entirely).

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

**Card stuck on old copy after upgrade**
Cursor's extension cache can survive `Developer: Reload Window`. Fully quit Cursor (Cmd+Q on macOS, then reopen) to pick up new copy.

---

## Contributing

Contributions welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

File an issue first for anything beyond a typo fix. All submitted code must pass `pnpm test` and `pnpm typecheck`.

Bug reports with a minimal reproduction case are especially welcome — detection edge cases across shells and OSes are the hardest to cover solo.

---

If this extension saves you from looking AFK during your AI sessions, consider starring [the repo](https://github.com/leonardomjq/agent-mode-discord).

---

## License

[MIT](LICENSE) — 2026 Leonardo Jaques

---

Solo project, maintained on my own schedule. Issues welcome; PRs require a filed issue first. Response time varies — passion project, not a product.
