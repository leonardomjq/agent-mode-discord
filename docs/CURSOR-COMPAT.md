# Cursor Compatibility

> **Status:** Documented compatibility statement. v0.1.0 ships with no automated Cursor CI install test. Live Cursor reproduction is tracked in [backlog phase 999.1](../.planning/phases/999.1-cursor-on-windows-reproduction-harness-for-fs-watch-fallback/) and will land in a later release.

## Supported

Agent Mode is built against the VS Code Extension API at `^1.93.0` (see `package.json` `engines.vscode`). Any Cursor build whose bundled VS Code baseline is **1.93 or newer** should load and run the extension — Cursor inherits the full VS Code Extension API.

## Install Path

Cursor consumes the OpenVSX registry rather than the official VS Code Marketplace. After Phase 6 publishes v0.1.0:

```bash
# From the Cursor command palette: "Extensions: Install Extension"
# Search for "Agent Mode"
# Or, install the VSIX manually:
cursor --install-extension agent-mode-discord-*.vsix
```

Pre-Phase 6 (no Marketplace listing yet):

```bash
# Build the VSIX from source
pnpm build
npx @vscode/vsce package --no-dependencies
cursor --install-extension agent-mode-discord-*.vsix
```

## Known Differences from VS Code

- **Shell Integration on Cursor for Windows.** Cursor's Windows builds have historically had less reliable Shell Integration support than VS Code proper. Agent Mode falls back to tier-3 (`~/.claude/projects/*.jsonl` file watching) automatically when Shell Integration doesn't fire. For best results on Cursor for Windows, install the [companion plugin](../README.md#companion-plugin-optional-recommended) — tier-1 lockfile detection bypasses Shell Integration entirely.
- **Setting names match VS Code.** All `agentMode.*` settings in `package.json` `contributes.configuration` work identically in Cursor — the configuration UI is the same.
- **No proposed APIs used.** Agent Mode uses zero proposed VS Code APIs (verified by `scripts/check-api-surface.mjs`), so Cursor's stable-API-only posture is not a problem.

## What's Not Tested

The following are not currently part of the v0.1.0 verification matrix:

- Live install on Cursor for Windows (tracked in [phase 999.1](../.planning/phases/999.1-cursor-on-windows-reproduction-harness-for-fs-watch-fallback/))
- Live install on Cursor for Linux
- Cursor versions older than the VS Code 1.93 baseline

Bug reports from real Cursor installs are welcome — please file via [GitHub Issues](https://github.com/leonardomjq/agent-mode-discord/issues) with the Cursor version, OS, and `agentMode.debug.verbose` log.

## See Also

- [README.md Troubleshooting → Cursor on Windows](../README.md#troubleshooting)
- [README.md Companion Plugin](../README.md#companion-plugin-optional-recommended)
- [`scripts/check-api-surface.mjs`](../scripts/check-api-surface.mjs)
