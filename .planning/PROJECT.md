# Agent Mode — Discord Rich Presence for Claude Code

## What This Is

A VS Code / Cursor extension that shows a real Discord Rich Presence status when Claude Code is running in the integrated terminal — so your status actually reflects that you're cooking with an agent instead of saying "Idling" for hours. Built for people (like the author) who mostly talk to agents instead of typing code, and whose Discord sidebar should show that.

## Core Value

**When `claude` is running in the integrated terminal, Discord shows you as "cooking" — not "Idling" — with goblin-voice copy that feels personal, not corporate.**

Everything else (multi-agent support, privacy modes, custom packs, companion plugin, OpenVSX distribution) serves or extends this single outcome. If terminal agent detection → Discord update doesn't work, nothing else matters.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Terminal agent detection: Shell Integration API (VS Code 1.93+) watches for `claude` / `npx @anthropic-ai/claude-code` / `bunx @anthropic-ai/claude-code` starting in the integrated terminal; presence flips to AGENT_ACTIVE within 500ms
- [ ] Multi-tier detection fallback: companion lockfile > shell integration > `~/.claude/projects/*.jsonl` fs-watch > terminal polling (tiered precedence, highest fidelity wins)
- [ ] Generic detection infrastructure: regex + `detect.customPatterns` supports aider/codex/gemini/opencode from day one, even though only Claude copy/assets ship in v0.1
- [ ] Discord RPC via `@xhayper/discord-rpc`: bundled default Client ID, `clearActivity(pid)` on deactivate, 2s leading+trailing throttle, exponential backoff reconnect (5→60s), pid-scoped activity for multi-window isolation
- [ ] 6-state state machine: AGENT_ACTIVE (per-agent sub-label) > CODING > IDLE; agent always wins priority
- [ ] Personality layer: `goblin` pack only for v0.1 (default+only shipped pack), frame cycling (2s), rotation clock (20s) with no-repeat invariant, time-of-day pools
- [ ] Templating: `{workspace}`, `{filename}`, `{language}`, `{branch}`, `{agent}`, `{elapsed}` substitution at render time
- [ ] Privacy settings exist (`show | hide | hash` for workspace/filename/branch) but default to `show` for all — personal use, no client work concern; ignore lists (workspaces/repos/orgs/gitHosts) still implemented for edge cases
- [ ] Live config reload on `onDidChangeConfiguration`, no window reload required
- [ ] Claude Code companion plugin: `~/.claude/agent-mode-discord.lock` written on SessionStart, removed on SessionEnd; extension `fs.watch`es the path; highest-fidelity signal in the detector precedence
- [ ] `package.json` configuration surface ≤ 20 keys (vs vscord's 160)
- [ ] Zero VS Code proposed APIs, zero `(vscode as any).*` casts — Marketplace-compliant from day one
- [ ] Stable-API only: activation event `onStartupFinished`, workspace trust `supported: true`, virtual workspaces `false`
- [ ] Bundle: TypeScript → esbuild single CJS → `dist/extension.cjs`, packaged VSIX under 500 KB, activation cost under 50ms
- [ ] Unit tests via vitest (no vscode dep): state machine transitions, throttle, animator (no-repeat + frame cycle), detector regex (Claude variants + ANSI strip), privacy (hash determinism, ignore lists)
- [ ] Publishing: VS Code Marketplace + OpenVSX, GitHub Actions release workflow on tag push, first tag `v0.1.0`
- [ ] OSS hygiene files: LICENSE (MIT), CODE_OF_CONDUCT, SECURITY, CONTRIBUTING, PR/issue templates, CI workflow, branch protection on `main`
- [ ] Portfolio-grade presentation: polished README with demo GIF above the fold, install instructions (Marketplace + OpenVSX + VSIX), privacy FAQ, competitive positioning table, screenshots

### Out of Scope

- **default / professional copy packs** — scrapped. Goblin is the point; default/professional exist only to hedge for audiences the author doesn't care about. If community asks, revisit in v0.2
- **Agent-specific copy/assets beyond Claude in v0.1** — aider/codex/gemini/opencode detection works (regex + custom patterns) but falls back to generic "agent active" copy. Per-agent icons + copy sub-pools deferred to v0.2
- **Launch campaign (Phase C from PRD §13)** — HN Show post, X thread, subreddit drops, creator DMs (Simon Willison / ThePrimeagen / Theo / Fireship), Product Hunt wave. Too much overhead for a weekend project. Repo goes public, README is portfolio-grade, let organic discovery happen
- **Agent telemetry bridge (model/cost/burn rate/context %)** — reserved for v0.2; would require JSONL parsing or statusline integration. v0.1 stays on terminal-presence detection only
- **Bidirectional control (sending prompts from Discord)** — that's Claude Code Channels' space; Agent Mode stays read-only
- **Mobile, web Discord, Codespaces** — desktop Discord + desktop VS Code/Cursor only
- **Team / shared-activity / analytics features** — single-user local tool
- **OpenCode companion plugin** — deferred to v0.2; Claude companion ships in v0.1
- **Cline / Roo Code detection via `vscode.extensions.getExtension().isActive`** — deferred to v0.2

## Context

- **Personal-pain origin:** author uses Cursor, runs Claude Code in the integrated terminal for hours at a time, and Discord always shows "Idling" because existing extensions track `vscode.window.activeTextEditor`. The author checked Cursor's extensions tab and found only stale results — nobody's built this properly yet. Scratching own itch first, portfolio piece second.
- **Competitive landscape:** vscord (778k installs) and iCrawl/discord-vscode (2.48M) don't detect terminals. RikoAppDev/ai-agent-activity (shipped 2026-04-04) tries but uses `(vscode as any).chat` casts and an edit heuristic — Marketplace-non-compliant and false-positive-prone. cc-discord-presence (Go daemon), Codex-Discord-Rich-Presence (Rust daemon), opencode-discord-presence (plugin) are per-agent daemons, not unified VSIX extensions.
- **Technical context:** Shell Integration API stabilized in VS Code 1.93 (Aug 2024). `onDidStartTerminalShellExecution` + `onDidEndTerminalShellExecution` + `onDidChangeTerminalShellIntegration` give us terminal command events natively. `commandLine.confidence` can be `Low` (requires ANSI/prompt-prefix stripping before regex). Cursor on Windows has documented shell-integration issues → tier-3 fs-watch fallback on `~/.claude/projects/*.jsonl` covers that case.
- **Claude Code hooks:** `SessionStart` / `SessionEnd` are stable and invoke scripts; `~/.claude/` is a writable-by-user zone so a companion plugin can drop a lockfile there without permissions hassle.
- **RPC library:** `@xhayper/discord-rpc` (upstream now `Khaomi/discord-rpc`) is the maintained choice. The old `discord-rpc` npm package is five years dead.
- **Distribution story:** VS Code Marketplace + OpenVSX. OpenVSX gives Cursor / VSCodium / Windsurf users native install (no VSIX sideloading), which matters since the author is a Cursor user and that's the primary target client.

## Constraints

- **Timeline**: Locked to 2 weeks (~26h of build time across 8 milestones per PRD §12) — weekend-project pacing but with a hard end date
- **Audience scope**: Small public release. Public repo, Marketplace + OpenVSX listings, polished README as a portfolio artifact. No Show HN / X thread / creator DMs / Product Hunt. Growth push is out of scope
- **Dependencies**: Runtime deps locked to `@xhayper/discord-rpc@^1.3.1` (only). Dev-only: `@types/vscode`, `@types/node`, `typescript`, `esbuild`, `vitest`, `@vscode/vsce`, `ovsx`. Adding any other runtime dep requires explicit approval
- **Toolchain**: pnpm (not npm, not yarn), vitest (not jest, not mocha), esbuild (not webpack, not rollup), Conventional Commits
- **API surface**: Zero VS Code proposed APIs. Zero `(vscode as any).*` casts to proposed surfaces. Marketplace publish must succeed on first try
- **Compatibility**: `engines.vscode: ^1.93.0`. Cursor latest tested. Cursor on Windows is best-effort (documented shell-integration issues — fs-watch fallback covers it)
- **Network**: Discord IPC only (local Unix socket / Windows named pipe). No outbound HTTP, no telemetry, no update checks, no asset CDNs
- **Footprint**: Packaged VSIX under 500 KB. Activation cost under 50ms. Activation event `onStartupFinished` only — no `"*"`, no `onLanguage:*`
- **File size discipline**: Any file growing past 200 lines must be split along natural boundaries (per PRD §18 guardrail)
- **Privacy-on-disk**: No writes outside VS Code's standard extension storage API. The extension never writes to `~/.claude/*`; only the companion plugin writes (lockfile), only the extension reads. No `~/.config/agent-mode-discord/`
- **JSONL handling**: `~/.claude/projects/*.jsonl` is an undocumented Anthropic internal format. Use mtime + existence as signal only; never parse structurally; wrap all reads in try/catch
- **Discord activity cleanup**: Always use `client.user?.clearActivity(process.pid)` on deactivate — never `setActivity(null)` (ghost-presence bug in some Discord client versions)
- **License**: MIT

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build this at all | Author's own Discord shows "Idling" all day because they only talk to agents now; no existing extension solves it; stale Cursor extensions tab results = gap in the market | — Pending |
| Ship Claude Code copy/assets only for v0.1, keep detection infra generic | Author only uses Claude. Building copy + icons + asset pipelines for 4 agents they don't use is scope padding; regex supports all 5 so they slot in later without rewrites | — Pending |
| `goblin` pack as default+only shipped pack | Author wanted `goblin` from day one; `default` and `professional` existed to hedge for imaginary audiences. Scratch-own-itch calibration says cut them | — Pending |
| Privacy defaults flipped: show everything by default | Personal projects, no client work, no shame. PRD's hide-by-default was paranoid overreach. Ignore lists still exist as escape valve | — Pending |
| Keep M5 companion plugin in v0.1 | 2h cost for meaningful fidelity upgrade on author's own primary use case | — Pending |
| Skip launch campaign (HN, X, subreddits, creators) | Portfolio flex + small public release is enough; full launch is weeks of overhead for a weekend project | — Pending |
| Lock to 2-week ship window | Author's stated deadline; PRD §12 milestone plan (~26h) fits; avoids feature creep | — Pending |
| Publish to Marketplace + OpenVSX | Author is a Cursor user; OpenVSX = native install for Cursor/VSCodium/Windsurf; Marketplace = VS Code discoverability | — Pending |
| `@xhayper/discord-rpc` over `discord-rpc` | Latter is 5-year-dead. Former is maintained (upstream Khaomi/discord-rpc) | — Pending |
| Zero VS Code proposed APIs | Marketplace compliance from day one; RikoAppDev's `(vscode as any).chat` is explicitly what we don't do | — Pending |
| Runtime deps locked to one (`@xhayper/discord-rpc`) | Bundle size target (<500 KB); activation cost (<50ms); attack surface minimization | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-12 after initialization*
