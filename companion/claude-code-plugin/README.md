# Agent Mode Discord — Claude Code Companion Plugin

A Claude Code plugin that writes and removes a lockfile on session start/stop so the Agent Mode Discord VS Code extension can detect active Claude Code sessions with the highest possible fidelity (tier-1).

## Install

### Permanent install (recommended)

```bash
claude plugin install ./companion/claude-code-plugin
```

### Dev / testing (no install required)

```bash
claude --plugin-dir ./companion/claude-code-plugin
```

> **Note:** Claude Code's local directory plugin install (issue #12457) has known intermittent issues.
> Use `--plugin-dir` for testing to confirm the hooks fire before committing to a permanent install.

## How It Works

1. **SessionStart** fires when Claude Code starts a new session or resumes an existing one.
   The `start.sh` script runs `touch ~/.claude/agent-mode-discord.lock`, creating the lockfile.
2. **SessionEnd** fires on all exit paths (clear, logout, prompt_input_exit, etc.).
   The `stop.sh` script runs `rm -f ~/.claude/agent-mode-discord.lock`, removing the lockfile.
3. The VS Code extension watches the lockfile via `fs.watchFile` with a 1-second poll interval.
   When the file appears, Discord Rich Presence flips to AGENT_ACTIVE within ~1 second.
   When the file disappears, Discord Rich Presence clears the agent status.

## Lockfile Location

```
~/.claude/agent-mode-discord.lock
```

Resolved platform-specifically:
- **macOS / Linux:** `$HOME/.claude/agent-mode-discord.lock`
- **Windows:** `%USERPROFILE%\.claude\agent-mode-discord.lock`

The file is empty — only its presence and modification time are used as signals. Contents are never parsed.

## Troubleshooting

### Hook not firing

Verify the scripts are executable:

```bash
chmod +x companion/claude-code-plugin/scripts/start.sh
chmod +x companion/claude-code-plugin/scripts/stop.sh
```

Enable debug output to check hook execution:

```bash
claude --debug
```

Look for `SessionStart` / `SessionEnd` hook invocations in the debug log.

### Lockfile persists after crash

If Claude Code crashes (SIGKILL, power loss, etc.), `stop.sh` won't run and the lockfile stays.

The VS Code extension automatically detects stale lockfiles: if the lockfile's `mtime` is older
than 5 minutes, it is treated as orphaned and the agent-ended event fires.

To remove manually:

```bash
rm -f ~/.claude/agent-mode-discord.lock
```

### Extension not picking up the lockfile

Ensure the VS Code extension is installed and active. The extension starts watching the lockfile
path at activation (`onStartupFinished`). If you installed the plugin while VS Code was already
running, reload the window (`Developer: Reload Window`) or restart VS Code.

### Windows support

Claude Code hooks currently only invoke `.sh` scripts. The companion plugin is macOS/Linux-only
for v0.1. Windows users are covered by the tier-3 detector (fs-watch on `~/.claude/projects/`).
Windows `.cmd` companion scripts are planned for v0.2 if Claude Code adds Windows hook support.
