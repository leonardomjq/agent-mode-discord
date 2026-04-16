---
phase: 05
name: companion-plugin-oss-hygiene-assets-readme
created: 2026-04-15
mode: auto
decisions: 14
deferred: 2
---

# Phase 5 Context — Companion Plugin + OSS Hygiene + Assets + README

<domain>
Three parallel sub-deliverables for the v0.1.0 milestone:
1. **Claude Code companion plugin** — external plugin that writes a lockfile on session start/stop; VS Code extension watches the lockfile as a tier-1 (highest fidelity) agent-detection signal.
2. **OSS repo hygiene** — LICENSE, COC, SECURITY, CONTRIBUTING, GitHub templates, CI matrix (3 OS), Dependabot.
3. **Demo GIF + portfolio-grade README** — the storefront for the extension.

No `src/` changes except `src/detectors/companion.ts` + orchestrator wiring (tier-1).

**In scope (from ROADMAP + REQUIREMENTS):**
- COMP-01..07: companion plugin structure, lockfile write/remove, tier-1 detector, suppression of lower tiers, VSIX exclusion
- DIST-01..10: OSS files, CI matrix, Dependabot, README with all sections, demo GIF

**Out of scope:**
- Phase 6 (publish): release workflow, Marketplace/OpenVSX listing, Discord Developer Portal assets
- OpenCode companion plugin (v0.2)
- Cline / Roo Code detection via `getExtension().isActive` (v0.2)
</domain>

## Decisions

### D-01: Companion tier is tier-1, not tier-0 [LOCKED]

The ROADMAP says "tier-0 (highest fidelity)" but the Phase 3 code explicitly reserves tier-1 for the companion plugin (`src/detectors/index.ts:15`: "tier 1 — companion (RESERVED for Phase 5)"). `TierNumber` is currently `2 | 3 | 4`.

**Decision:** Use tier-1. Extend `TierNumber` to `1 | 2 | 3 | 4`. Update the orchestrator's iteration array from `[2, 3, 4]` to `[1, 2, 3, 4]`. This is the design that Phase 3 prepared for.

### D-02: Lockfile path is `~/.claude/agent-mode-discord.lock` [LOCKED]

Per COMP-03. Resolved to platform-specific home:
- macOS/Linux: `$HOME/.claude/agent-mode-discord.lock`
- Windows: `%USERPROFILE%\.claude\agent-mode-discord.lock`

The VS Code extension resolves this via `os.homedir()` + `.claude/agent-mode-discord.lock`.

### D-03: Lockfile is empty file, mtime-as-signal [LOCKED]

Matches the sessionFiles tier-3 pattern (mtime + existence only). No content parsing. `start.sh` → `touch $LOCKFILE`; `stop.sh` → `rm -f $LOCKFILE`.

### D-04: Companion detector uses `fs.watchFile` (stat polling), not `fs.watch` [LOCKED]

`fs.watch` on a single file that may not exist yet is unreliable across platforms (macOS needs parent-dir watch; Windows has known issues with file creation events). `fs.watchFile` with a 1000ms stat interval is simpler, reliable, and costs negligible CPU for a single file. When the file appears (stat succeeds) → agent-started with agent="claude". When it disappears (stat ENOENT) → agent-ended.

**Rationale:** tier-3 (sessionFiles) already uses `fs.watch` on a directory. The companion tier watches a single known-path file — `fs.watchFile` is the standard Node approach for this.

### D-05: Companion detector agent label is always "claude" [LOCKED]

v0.1 ships only the Claude Code plugin. The lockfile doesn't encode which agent — it's a presence/absence signal. Agent label hardcoded to `"claude"`. Future v0.2 companion plugins for other agents would use separate lockfile names.

### D-06: `companion/claude-code-plugin/` structure [LOCKED]

```
companion/claude-code-plugin/
├── .claude-plugin/
│   └── plugin.json          # name, version, hooks config
├── scripts/
│   ├── start.sh             # touch ~/.claude/agent-mode-discord.lock
│   └── stop.sh              # rm -f ~/.claude/agent-mode-discord.lock
└── README.md                # install instructions
```

`plugin.json` declares `session_start` → `scripts/start.sh` and `session_end` → `scripts/stop.sh`.

### D-07: VSIX exclusion via `.vscodeignore` [LOCKED]

Add `companion/**` to `.vscodeignore`. Verify with `vsce ls` during planning. The companion plugin is installed independently via `claude plugin install`.

### D-08: CI matrix expands existing `.github/workflows/ci.yml` [LOCKED]

Don't create a new workflow. Expand the existing CI to:
- Matrix: `[ubuntu-latest, macos-latest, windows-latest]`
- Add missing steps: `pnpm lint` (need to add a lint script), `pnpm typecheck` (already works)
- Keep existing checks: build, bundle-size, api-surface, config-keys, no-network, test

### D-09: Lint = `tsc --noEmit` (no new linter dep) [LOCKED]

The project has no ESLint/Biome/Prettier. Bundle is 218 KB / 500 KB — headroom is fine. Adding a linter dependency + config is scope creep for Phase 5 (OSS hygiene, not DX overhaul).

**Decision:** `pnpm lint` = `tsc --noEmit` (aliased in package.json). This satisfies DIST-06's "pnpm lint" CI step requirement without adding deps. A real linter can be added in v0.2 as a DX improvement.

### D-10: Branch protection is documented, not automated [LOCKED]

DIST-07 requires branch protection. This is a GitHub repo settings toggle, not a code artifact. The CONTRIBUTING.md will document the expected protection rules. The actual protection is set manually by the repo owner (requires admin access, possibly [HUMAN] step).

### D-11: Demo GIF is a [HUMAN] checkpoint [LOCKED]

DIST-10 requires a real screen recording showing Discord sidebar flipping states. This cannot be automated by an AI agent — it requires:
1. A running Discord client with the extension's app connected
2. A terminal running `claude` with the companion plugin installed
3. Screen capture software (VHS, ScreenToGif, or OBS)

**Decision:** Plan 05-06 is marked `autonomous: false`. The plan provides a capture script/instructions but execution requires human interaction.

### D-12: README structure follows DIST-09 exactly [LOCKED]

Section order:
1. One-sentence tagline + badges
2. Demo GIF (above the fold)
3. Features (short bullet list)
4. Install (Marketplace / OpenVSX / VSIX tabs or sections)
5. Goblin pack preview (code block showing goblin.json pools)
6. Configuration (link to settings + key table)
7. Privacy FAQ
8. Competitive positioning table (vs vscord / discord-vscode / RikoAppDev)
9. Troubleshooting (Cursor-on-Windows, fish, Command Prompt, Flatpak Discord)
10. Contributing (link to CONTRIBUTING.md)
11. Sponsor placeholder
12. MIT license line
13. Maintainer-posture line

### D-13: Maintainer-posture tone [LOCKED]

"Solo project, maintained on my own schedule. Issues welcome; PRs require a filed issue first. Response time varies — this is a passion project, not a product."

Honest, sets expectations, doesn't over-promise.

### D-14: Repository URL in package.json [LOCKED]

Currently `"TODO/agent-mode-discord"`. Needs the real GitHub username. Use `leonardojaques/agent-mode-discord` (matching the git user config). Update `package.json` repository field + README links.

## Deferred Ideas

- **Real linter (ESLint/Biome):** v0.2 DX improvement. Phase 5 ships `tsc --noEmit` as lint.
- **Windows `start.cmd` / `stop.cmd` for companion plugin:** Claude Code hooks currently support `.sh` only. If Windows support is added to Claude Code's plugin system, add `.cmd` equivalents.

## Threats

- **T-05-01 (lockfile orphan):** If Claude Code crashes without running `stop.sh`, the lockfile persists → extension thinks agent is active forever. **Mitigation:** detector checks lockfile mtime; if mtime > 5 minutes stale, treat as orphaned and fire agent-ended. Document in companion README.
- **T-05-02 (CI flake on Windows):** `fs.watch`/`fs.watchFile` tests may behave differently on Windows CI. **Mitigation:** skip companion detector tests on Windows if they flake; file an issue to stabilize.
- **T-05-03 (demo GIF size):** Screen recordings easily exceed 8 MB. **Mitigation:** capture at 720p, 10 fps, optimize with `gifsicle --optimize=3`.
- **T-05-04 (competitive positioning accuracy):** Feature claims about competitors must be verifiable. **Mitigation:** link to each extension's marketplace page; state "as of v0.1.0" with date.
