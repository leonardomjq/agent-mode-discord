# Cursor Compatibility

goblin mode is built against the VS Code Extension API at `^1.93.0` (see `package.json` `engines.vscode`). Cursor inherits the full VS Code Extension API, so any Cursor build with a VS Code 1.93+ baseline runs the extension.

Cursor pulls extensions via OpenVSX (with a VS Code Marketplace proxy fallback). Search **`leonardomjq.goblin-mode`** in the Extensions panel, or:

```bash
cursor --install-extension leonardomjq.goblin-mode
```

Live-tested on Cursor for macOS (v0.3.2). Windows and Linux Cursor are untested by the maintainer — bug reports welcome via [GitHub Issues](https://github.com/leonardomjq/goblin-mode/issues) with the Cursor version, OS, and `agentMode.debug.verbose` log.

## Known Differences from VS Code

- **Shell Integration on Cursor for Windows** is historically less reliable than VS Code proper. goblin mode auto-falls-back to tier-3 (`~/.claude/projects/*.jsonl` watching) when shell integration doesn't fire. For best results install the [companion plugin](../README.md#companion-plugin-optional-recommended) — tier-1 lockfile detection bypasses shell integration entirely.
- **Settings:** all `agentMode.*` settings work identically in Cursor.
- **No proposed APIs** are used (verified by `scripts/check-api-surface.mjs`), so Cursor's stable-API-only posture is fine.

## See Also

- [README → Troubleshooting](../README.md#troubleshooting)
- [README → Companion Plugin](../README.md#companion-plugin-optional-recommended)
