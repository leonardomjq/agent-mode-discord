---
id: SEED-003
status: dormant
planted: 2026-04-16
planted_during: v0.1.0 / Phase 05.2 (multi-window-leadership-election)
trigger_when: Claude Desktop becomes Claude Code's primary surface (measurable via Discord Dev Portal DAU decline correlated with Claude Desktop adoption) OR Anthropic exposes a Claude Desktop plugin API OR GitHub issues requesting Claude-Desktop-native presence
scope: Large
target_milestone: v0.3.0+ (potentially sibling project)
---

# SEED-003: Claude Desktop / multi-surface architecture

## Why This Matters

**The strategic observation:** Anthropic recently revamped Claude Desktop; Claude Code inside the Desktop app is materially better than the terminal-only version. If Claude Desktop becomes the primary home for Claude Code usage, the VS Code / Cursor extension becomes less central — users running Claude Code in Desktop get **no Discord presence** from the current architecture because there's no VS Code process running.

This is an existential question for the project's long-term relevance: the "claude-in-terminal" detection moat matters only so long as Claude Code runs in terminals. If the center of gravity shifts to Desktop, we need a different surface to light up Discord.

**The lucky architectural asset:** the companion plugin (Phase 5-02) is a Claude Code plugin — it runs during every Claude Code session regardless of host. Inside VS Code terminal, Cursor terminal, raw bash, or **Claude Desktop**, the plugin writes `~/.claude/agent-mode-discord.lock` on SessionStart and removes it on SessionEnd. The lockfile signal is already surface-agnostic.

**The missing piece:** something has to READ that lockfile and drive Discord RPC when there's no VS Code process running. Today only the VS Code extension does this.

## When to Surface

**Trigger** — whichever comes first:

1. Claude Desktop exposes a plugin API (similar to Claude Code's plugin system but for the Desktop app itself) — direct-native integration becomes possible
2. Discord Developer Portal analytics show a meaningful DAU decline on the bundled Client ID AND the decline correlates with Claude Desktop release milestones (strong signal that users are migrating away from VS Code + extension)
3. A user files a GitHub issue: "Claude Code in Claude Desktop doesn't flip my Discord"
4. v0.3.0 scoping begins and cross-surface support is on the table
5. Anthropic ships any first-party Claude Desktop extension ecosystem (similar to MCP but surface-aware)

## Scope Estimate

**Large** — this is a milestone-level architectural shift, not a phase.

Three possible paths (presented in order of investment):

### Path A: Standalone daemon (medium effort, preserves existing extension)

A small Node CLI (`agent-mode-discord-daemon`) that:
1. Watches `~/.claude/agent-mode-discord.lock` the same way `src/detectors/companion.ts` does today
2. Connects to Discord RPC using the same `@xhayper/discord-rpc` dep
3. Reuses the same activity builder + presence logic
4. Runs as a background process — user installs via `npm install -g` or a macOS LaunchAgent / systemd service

**When it wins:** if Claude Desktop never exposes a plugin API but users want presence-when-Desktop-runs.

**Cost:** ~300-500 LoC for daemon wrapper + install docs + LaunchAgent plist / systemd unit / Windows Service script. New install UX to maintain.

**Leader-election:** daemon coexists with VS Code extension using the existing `agent-mode-discord.leader.lock` (Phase 5.2). If the extension is running and holds leadership, daemon backs off. If extension isn't running, daemon takes over. Already works.

### Path B: Extract pure-core to shared npm package (clean but refactor)

Monorepo structure:
- `packages/core` — state machine, RPC client, activity builder, privacy, leadership, companion detector (all pure — already mostly is)
- `apps/vscode-extension` — thin wrapper around core (current VS Code extension)
- `apps/daemon` — thin wrapper around core for standalone use
- `apps/claude-desktop-plugin` — thin wrapper when Claude Desktop exposes a plugin API (future)

**When it wins:** if cross-surface support becomes central to the project's identity.

**Cost:** moderate refactor — the pure-core is already mostly decoupled (state/machine.ts, rpc/client.ts, state/leadership.ts, presence/activityBuilder.ts all have no `vscode` imports or only Disposable types that can be replaced with a local interface). Extraction is ~1 week for someone familiar with the code.

### Path C: Wait-and-see (preserves optionality)

Ship v0.1.0 as VS Code-only. Instrument Discord Dev Portal usage. Watch Claude Desktop adoption. If the shift happens, build for it then — the existing companion plugin already provides the signal primitive so the future work doesn't require retrofits to the plugin side, just a new reader.

**When it wins:** if Claude Desktop never becomes dominant OR the project is OK with being VS Code-only and accepting a slow decline.

## Breadcrumbs

Code modules already architected to be reusable (VS Code-agnostic):

- `src/state/machine.ts` — pure reducer, no `vscode` import ✓
- `src/state/leadership.ts` — uses Node fs/os only ✓
- `src/rpc/client.ts` — uses `@xhayper/discord-rpc`, no `vscode` ✓
- `src/rpc/throttle.ts` — pure, no deps ✓
- `src/presence/activityBuilder.ts` — depends on State + Pack, no `vscode` ✓
- `src/presence/templater.ts`, `packLoader.ts`, `animator.ts` — pure ✓
- `src/privacy.ts`, `src/config.ts` (partial — `readConfig` wraps `vscode.workspace.getConfiguration` but the schema is pure) ✓
- `src/detectors/companion.ts` — uses `vscode.Disposable` type only (trivial to replace with a local interface) ✓

Code that is genuinely VS Code-specific and won't carry over:

- `src/detectors/editor.ts` — `vscode.window.activeTextEditor` — no equivalent outside VS Code; Claude Desktop has no "focused editor" concept
- `src/detectors/git.ts` — `vscode.extensions.getExtension('vscode.git')` — would need replacement (shell out to `git`, read `.git/HEAD`)
- `src/detectors/shellIntegration.ts` — VS Code's Shell Integration API; no equivalent in Claude Desktop
- `src/detectors/sessionFiles.ts` — uses `vscode.Disposable`; logic is fs-only and portable
- `src/detectors/polling.ts` — terminal name polling is VS Code-specific
- `src/extension.ts`, `src/leaderDriver.ts` — VS Code wrappers; daemon/desktop would have different wrappers

**Companion plugin stays identical** across surfaces — it's already agnostic.

## Related Decisions to Revisit

When this seed activates, revisit:

- **PRD §Core Value "claude-in-terminal, not file editing"** — may need to generalize to "claude-anywhere" if Desktop is the dominant surface
- **SEED-001 (extension-telemetry)** — if multi-surface, the telemetry needs to know which surface a presence event came from (VS Code vs daemon vs Desktop)
- **Phase 6 plan `06-01` (Discord asset upload)** — assets apply regardless of surface; no change needed
- **README competitive positioning** — the "VS Code extension" framing becomes limiting; rebrand to "Discord presence for Claude Code, anywhere"

## Philosophical Question

Is this the same project, or a sibling project?

**Arguments for same project:**
- ~70% of the code is reusable across surfaces
- Single brand ("Agent Mode") is stronger than fragmented per-surface products
- Users think of the outcome ("Discord shows I'm cooking") not the mechanism
- Companion plugin + shared core + per-surface wrappers is a clean architecture

**Arguments for sibling project:**
- VS Code Marketplace expects a VS Code extension, not a multi-surface project
- Install UX differs wildly (Marketplace vs npm install -g vs Claude Desktop plugin store)
- Release cadences may diverge
- Different users care about different surfaces

**Tentative answer (subject to revision at activation time):** same project, monorepo, shared core (Path B). The brand unity + code reuse + single Discord Developer Portal app win. The per-surface install UX is plumbing.

## Notes

- The companion plugin being surface-agnostic is the **strategic move that makes this seed cheap to activate later**. Without the companion plugin, the VS Code extension would be a dead-end for any non-VS-Code surface. With it, every future surface is a thin reader on top of an existing signal.
- Anthropic's plugin system in Claude Code → Claude Desktop might parallel VS Code's own extension API evolution. Worth tracking their announcements.
- MCP (Model Context Protocol) might be relevant if Claude Desktop exposes MCP servers for side-effects. An MCP server that emits Discord activity events could be another integration path to watch.
- For v0.2.0 decision-making: if we see any signal that Claude Desktop usage is rising, accelerate SEED-003 planning. If usage stays VS-Code-dominant, defer indefinitely.
