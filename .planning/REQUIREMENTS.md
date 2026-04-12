# Requirements: Agent Mode — Discord Rich Presence for Claude Code

**Defined:** 2026-04-12
**Core Value:** When `claude` is running in the integrated terminal, Discord shows you as "cooking" — not "Idling" — with goblin-voice copy that feels personal, not corporate.

## v1 Requirements

Requirements for initial public release (v0.1.0). Each maps to one roadmap phase. All are user-observable behaviors or Marketplace-gated qualities — not implementation details.

### Skeleton (SKEL)

- [ ] **SKEL-01**: Extension activates on VS Code startup via `onStartupFinished` event only (no `"*"`, no `onLanguage:*`)
- [ ] **SKEL-02**: Packaged VSIX file size is under 500 KB
- [ ] **SKEL-03**: Extension activation completes in under 50 ms (measured with VS Code's built-in profiler)
- [ ] **SKEL-04**: CI fails the build if `dist/extension.cjs` bundle size regresses past the 500 KB threshold
- [ ] **SKEL-05**: Extension registers zero VS Code proposed APIs and contains zero `(vscode as any).*` casts (verified by grep in CI)
- [ ] **SKEL-06**: Extension connects to Discord desktop via local IPC on activation and displays a fixed placeholder activity ("hello world") visible in the friends sidebar
- [ ] **SKEL-07**: Extension handles SIGINT / SIGTERM / extension-host-exit by calling `client.user?.clearActivity(process.pid)` so no ghost presence remains in Discord after abnormal termination
- [ ] **SKEL-08**: Extension calls `clearActivity(pid)` once on `activate()` before setting any new payload (belt-and-braces cleanup from prior crashed session)
- [ ] **SKEL-09**: Running `pnpm install && pnpm build` produces `dist/extension.cjs` with no warnings
- [ ] **SKEL-10**: Running `pnpm test` exits 0 (with at minimum a smoke test that exercises the RPC connect + clearActivity flow using a fake transport)

### RPC Pipeline (RPC)

- [ ] **RPC-01**: Extension scopes every `setActivity` / `clearActivity` call to `process.pid` so two simultaneously-open VS Code windows each display their own independent Discord activity
- [ ] **RPC-02**: Extension throttles `setActivity` calls to one per 2000 ms (leading + trailing edge), dropping intermediate payloads; last call always wins
- [ ] **RPC-03**: When Discord desktop is killed mid-session, extension retries connection with exponential backoff 5→10→20→40→60 s cap and does not thrash (no two attempts within 5 s of each other)
- [ ] **RPC-04**: When Discord desktop restarts, extension re-establishes RPC without any user action and replays the current activity state within one backoff tick
- [ ] **RPC-05**: All RPC connection failures are silent — never toast, never block the editor — unless `debug.verbose === true`, in which case debug-level output appears in the extension output channel
- [ ] **RPC-06**: Extension cleanly deactivates via `client.user?.clearActivity(process.pid)` (never `setActivity(null)`) when the user disables the extension or closes the window normally

### State Machine (STATE)

- [ ] **STATE-01**: When user focuses a text document, extension presence transitions to CODING with the current file context reflected in the activity state string
- [ ] **STATE-02**: When the user has no focused editor and no agent running for longer than `idleTimeoutSeconds` (default 300 s), presence transitions to IDLE
- [ ] **STATE-03**: When any tracked agent session is active, presence is AGENT_ACTIVE regardless of editor focus (agent state has highest priority)
- [ ] **STATE-04**: When the last tracked agent session ends, presence transitions to CODING (if an editor is focused) or IDLE
- [ ] **STATE-05**: Elapsed-time timer uses Discord `startTimestamp` and resets only on state-machine transitions — never on copy rotation or frame ticks
- [ ] **STATE-06**: Rapid repeated state flips (up to 20 per second) produce at most one Discord update per 2 s window; the user observes the latest state, never a stale one

### Agent Detection (DET)

- [ ] **DET-01**: When the user runs `claude` in the VS Code integrated terminal, presence flips to AGENT_ACTIVE within 500 ms with agent label = `claude`
- [ ] **DET-02**: When the user runs `npx @anthropic-ai/claude-code` or `bunx @anthropic-ai/claude-code` or `pnpm dlx @anthropic-ai/claude-code`, detection identifies the session as `claude`
- [ ] **DET-03**: Detection regex also matches `aider`, `codex` / `npx @openai/codex`, `gemini`, and `opencode` command invocations — these detect correctly and set the agent label, even though v0.1 ships no per-agent copy for them (they fall back to generic AGENT_ACTIVE copy)
- [ ] **DET-04**: Two parallel `claude` sessions in two integrated terminals hold presence at AGENT_ACTIVE until BOTH sessions end (per-terminal session map)
- [ ] **DET-05**: When Shell Integration is unavailable (shell without integration plugin, fresh terminal before integration activates, Cursor-on-Windows), extension falls back to `~/.claude/projects/*.jsonl` fs-watch tier and still detects active Claude sessions (coarser — uses mtime + existence only, never parses JSONL content)
- [ ] **DET-06**: When fs-watch tier finds no signal, polling tier checks `vscode.window.terminals` every 5 s against user-configured `detect.polling.terminalNamePatterns`; empty-by-default so no false positives unless user opts in
- [ ] **DET-07**: Detector precedence is deterministic per terminal: companion-lockfile > shell-integration > session-file-watch > polling; when multiple tiers signal, the highest-fidelity one sets state while lower tiers log at debug level only
- [ ] **DET-08**: Missing `onDidChangeTerminalShellIntegration` subscription case is handled: subscribing to the event prevents loss of the first command in a fresh terminal where integration activates asynchronously
- [ ] **DET-09**: Low-confidence `commandLine.confidence === Low` values are ANSI-stripped and prompt-prefix-stripped before regex matching (no first-run false negative from shell prompt bytes)
- [ ] **DET-10**: User-supplied `detect.customPatterns` extends the built-in regex; custom agent names flow through to templating (`{agent}`) and fall back to default AGENT_ACTIVE copy pool when no sub-pool exists

### Personality (PERS)

- [ ] **PERS-01**: v0.1 ships the `goblin` copy pack as the default and only built-in pack (no `default`, no `professional` — intentionally cut per PROJECT.md decision)
- [ ] **PERS-02**: Copy rotation clock fires every 20 s and selects the next message from the active pool (state → agent sub-pool → time-of-day pool fallback chain)
- [ ] **PERS-03**: Rotation never shows the same message twice in a row across two consecutive rotations (Fisher-Yates no-repeat invariant)
- [ ] **PERS-04**: Frame animation clock fires every 2 s and cycles frames of a multi-frame message (e.g. `["cooking.", "cooking..", "cooking..."]`) in order, looping
- [ ] **PERS-05**: Setting `animations.enabled: false` holds any frame array on its first frame statically (no cycling), and still rotates messages on the 20 s clock
- [ ] **PERS-06**: Copy templating substitutes `{workspace}`, `{filename}`, `{language}`, `{branch}`, `{agent}`, `{elapsed}` at render time; tokens hidden by privacy settings render as empty strings, and the animator skips any message that becomes blank after substitution
- [ ] **PERS-07**: User can point `messages.customPackPath` at a JSON file conforming to the documented pack schema, and the animator picks up the custom pool on next rotation (no reload)
- [ ] **PERS-08**: Pack schema validation runs on load; invalid packs log an error at debug level and fall back to the built-in `goblin` pack

### Privacy (PRIV)

- [ ] **PRIV-01**: `privacy.workspaceName` supports three modes: `show` (default, per PROJECT.md decision), `hide` (renders as empty string), `hash` (SHA-1 of normalized workspace absolute path, first 6 hex chars, deterministic)
- [ ] **PRIV-02**: `privacy.filename` supports two modes: `show` (default) and `hide`
- [ ] **PRIV-03**: `privacy.gitBranch` supports two modes: `show` (default) and `hide`; when `show`, the extension reads the current branch via the built-in `vscode.git` extension API (`vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)`) without adding a dependency
- [ ] **PRIV-04**: If the built-in `vscode.git` extension is disabled or unavailable, extension logs at debug level and continues without branch info; no crash, no toast
- [ ] **PRIV-05**: `ignore.workspaces` (glob), `ignore.repositories` (regex), `ignore.organizations` (regex), `ignore.gitHosts` (string list) — when any ignore rule matches, extension stays fully silent (no presence updates at all, not partial redaction)
- [ ] **PRIV-06**: Flipping any privacy setting applies on the next rotation tick (max 20 s) without requiring a window reload
- [ ] **PRIV-07**: Extension never makes any outbound HTTP request; only Discord IPC (local Unix socket / Windows named pipe) — verifiable via CI with a network-traffic assertion against the built bundle

### Configuration (CONF)

- [ ] **CONF-01**: `contributes.configuration` in `package.json` exposes no more than 20 settings keys total, each with `title`, `description`, `default`, and enum `enumValues` where applicable
- [ ] **CONF-02**: `agentMode.clientId` setting allows override of the bundled default Discord Client ID; blank/unset uses the bundled default
- [ ] **CONF-03**: Changing any setting via `onDidChangeConfiguration` applies on the next presence tick with no window reload required
- [ ] **CONF-04**: `idleBehavior` setting accepts `show` (default, IDLE copy pack) or `clear` (clears Discord activity on idle but keeps the RPC connection alive — never disconnect-and-reconnect, which orphans the reconnect loop)
- [ ] **CONF-05**: `debug.verbose` setting toggles verbose logging in the extension output channel; default `false`

### Companion Plugin (COMP)

- [ ] **COMP-01**: `companion/claude-code-plugin/` contains a valid Claude Code plugin with `.claude-plugin/plugin.json` and `scripts/{start,stop}.sh`
- [ ] **COMP-02**: Running `claude plugin install ./companion/claude-code-plugin` from a Claude Code session installs the plugin successfully
- [ ] **COMP-03**: When the user starts a Claude Code session with the plugin installed, the `start` hook writes `~/.claude/agent-mode-discord.lock` (empty file, mtime as signal) within 200 ms of session start
- [ ] **COMP-04**: When the user ends a Claude Code session, the `stop` hook removes `~/.claude/agent-mode-discord.lock` within 200 ms
- [ ] **COMP-05**: Extension watches `~/.claude/agent-mode-discord.lock` via `fs.watch` and, when the file appears, promotes the detection signal to tier-0 (highest fidelity) in the precedence ladder
- [ ] **COMP-06**: Lockfile-tier signal suppresses lower-tier signals for the same terminal at the debug-log level only (no double-count, no state churn)
- [ ] **COMP-07**: `companion/` directory is excluded from the VSIX package via `.vscodeignore` (plugin is a separate deliverable, installed independently by the user)

### Distribution (DIST)

- [ ] **DIST-01**: `LICENSE` contains unmodified MIT template text with current year and owner name
- [ ] **DIST-02**: Repository has `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md` (private vulnerability reporting address), and `CONTRIBUTING.md` (dev loop, Conventional Commits, "file issue before large PRs", maintainer-pace expectations)
- [ ] **DIST-03**: `.github/ISSUE_TEMPLATE/bug_report.md` includes structured fields: VS Code version, Cursor version, Discord version, OS, agent CLI used, shell, steps to reproduce, `debug.verbose: true` log capture
- [ ] **DIST-04**: `.github/ISSUE_TEMPLATE/feature_request.md` includes structured fields: problem, proposed solution, persona (Marcus / Steph / other)
- [ ] **DIST-05**: `.github/PULL_REQUEST_TEMPLATE.md` includes checklist: tests pass, no new runtime deps, follows PRD §18 guardrails
- [ ] **DIST-06**: `.github/workflows/ci.yml` runs on `pull_request` with matrix ubuntu-latest + macos-latest + windows-latest; steps: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm test`, `pnpm build`, bundle-size check
- [ ] **DIST-07**: `main` branch has protection requiring PR + green CI; no direct pushes (owner self-approval allowed)
- [ ] **DIST-08**: Dependabot is enabled on the repo via `.github/dependabot.yml`
- [ ] **DIST-09**: README renders at repo root with: one-sentence tagline, demo GIF above the fold, install sections for VS Code Marketplace + OpenVSX + manual VSIX, `goblin` pack preview, privacy FAQ ("what leaks by default"), competitive positioning table vs vscord / discord-vscode / RikoAppDev, troubleshooting section covering Cursor-on-Windows + fish + Command Prompt + Flatpak Discord, sponsor link placeholder, MIT license line, maintainer-posture line
- [ ] **DIST-10**: Demo GIF is under 8 MB (GitHub embed limit), 15–30 s loop, shows Discord sidebar flipping from "Idling" to AGENT_ACTIVE when `claude` starts in the terminal

### Publish (PUB)

- [ ] **PUB-01**: Discord application named "Agent Mode" exists in the Discord Developer Portal with uploaded `agent-mode-large` (1024×1024) and `agent-mode-small` (512×512) PNG assets, plus per-agent icon placeholders (`claude-icon` — others reserved for v0.2)
- [ ] **PUB-02**: OpenVSX namespace is claimed and approved under the chosen publisher name (requires Eclipse Foundation account; flagged at phase 1 due to variable lead time)
- [ ] **PUB-03**: VS Code Marketplace publisher account exists with a valid Azure DevOps Personal Access Token scoped to `Marketplace: Manage`, stored as GitHub repo secret `VSCE_PAT`
- [ ] **PUB-04**: OpenVSX access token stored as GitHub repo secret `OVSX_PAT`
- [ ] **PUB-05**: `vsce package --pre-release` produces a VSIX with no warnings; `vsce publish --pre-release --dry-run` succeeds locally; `ovsx publish --dry-run` succeeds locally
- [ ] **PUB-06**: `.github/workflows/release.yml` triggers on git tag push (`v*`), publishes the VSIX to both Marketplace and OpenVSX in parallel, and attaches the VSIX file to the GitHub Release
- [ ] **PUB-07**: Pushing tag `v0.1.0` results in both Marketplace and OpenVSX listings live within 30 minutes (verified by clicking the resulting listing URLs)
- [ ] **PUB-08**: Extension installs cleanly in a fresh VS Code profile AND a fresh Cursor profile, and local-dev verification steps 3–10 from PRD §15 pass on both

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Personality extensions

- **PERS-V2-01**: `default` copy pack (playful-clean) available alongside `goblin`
- **PERS-V2-02**: `professional` copy pack (boring, for work/client servers)
- **PERS-V2-03**: Per-agent copy sub-pools for `aider`, `codex`, `gemini`, `opencode` (v0.1 ships Claude sub-pool only; others fall back to generic AGENT_ACTIVE copy)
- **PERS-V2-04**: Per-agent icons for `aider`, `codex`, `gemini`, `opencode`

### Agent extensions

- **DET-V2-01**: OpenCode companion plugin mirroring the Claude Code pattern (uses OpenCode `session.idle` / `chat.message` events)
- **DET-V2-02**: Cline and Roo Code detection via `vscode.extensions.getExtension(...).isActive`
- **DET-V2-03**: Agent telemetry bridge — model name, session cost, today's cumulative cost, burn rate ($/hr), context usage % (reserved slot to prevent a daemon competitor wrapping ccusage/ccstatusline in a VSIX)

### Distribution extensions

- **DIST-V2-01**: Sponsor button in README + `FUNDING.yml` pointer, activated post-launch if install count crosses 500
- **DIST-V2-02**: Active social distribution (launch campaign) — Show HN, X thread, subreddit drops, creator DMs, Product Hunt wave (explicitly out of scope for v0.1)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Bidirectional control (sending prompts from Discord) | That's Claude Code Channels' problem space; Agent Mode stays read-only |
| Mobile Discord support | Mobile Discord has no Rich Presence API (Rich Presence is desktop-only) |
| Web Discord support | Web Discord has no local IPC socket (RPC is desktop-only) |
| Codespaces support | Remote-only workflows lack access to the user's Discord desktop socket |
| Team / shared-activity / analytics features | Single-user local tool; no backend, no server-side compute |
| Structural parsing of `~/.claude/projects/*.jsonl` | Undocumented Anthropic internal format; will break on upstream change; use mtime + existence only (PRD §FR-1.8, §18) |
| BYO Discord Client ID as onboarding requirement | Codex-Discord pattern kills install rate; we ship a bundled default, allow override only for tinkerers |
| 160+ settings keys | vscord has that and gets issues about it (#151); we cap at ≤20 |
| Telemetry, update checks, asset CDNs | Extension makes zero outbound HTTP requests; Discord IPC only |
| Writes outside VS Code extension storage | Extension never writes to `~/.claude/*` or `~/.config/agent-mode-discord/`; only companion plugin writes the lockfile |
| VS Code proposed APIs or `(vscode as any).*` casts | Marketplace compliance — RikoAppDev's approach is explicitly what we don't do |
| Full launch campaign (HN/X/subreddits/creators/Product Hunt) | User decision: small public release as portfolio piece, no growth push (see PROJECT.md Key Decisions) |
| `default` and `professional` copy packs | User decision: `goblin` is the whole point; hedging for audiences we don't care about is scope padding (see PROJECT.md Key Decisions) |
| Claude copy fidelity extended to other agents in v0.1 | Detection covers all 5 agents, but per-agent copy/assets for aider/codex/gemini/opencode deferred to v0.2 |
| Node runtime deps beyond `@xhayper/discord-rpc` | Bundle size target (<500 KB), attack surface, audit overhead — ask before adding any |

## Traceability

Verified by roadmapper on 2026-04-12. Requirement counts recounted from the v1 Requirements section above — the earlier header claim of "60 v1 requirements" was incorrect; true count is 77 across 10 categories.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SKEL-01 through SKEL-10 (10) | Phase 1 — Skeleton + RPC seam | Pending |
| RPC-01 through RPC-06 (6) | Phase 2 — Core pipeline | Pending |
| STATE-01 through STATE-06 (6) | Phase 2 — Core pipeline | Pending |
| DET-01 through DET-10 (10) | Phase 3 — Agent detection | Pending |
| PERS-01 through PERS-08 (8) | Phase 4 — Personality + config + privacy | Pending |
| PRIV-01 through PRIV-07 (7) | Phase 4 — Personality + config + privacy | Pending |
| CONF-01 through CONF-05 (5) | Phase 4 — Personality + config + privacy | Pending |
| COMP-01 through COMP-07 (7) | Phase 5 — Companion + OSS + assets + README | Pending |
| DIST-01 through DIST-10 (10) | Phase 5 — Companion + OSS + assets + README | Pending |
| PUB-01 through PUB-08 (8) | Phase 6 — Publish | Pending |

**Per-phase totals:**
- Phase 1: 10 reqs (SKEL)
- Phase 2: 12 reqs (RPC + STATE)
- Phase 3: 10 reqs (DET)
- Phase 4: 20 reqs (PERS + PRIV + CONF)
- Phase 5: 17 reqs (COMP + DIST)
- Phase 6: 8 reqs (PUB)

**Coverage:**
- v1 requirements: 77 total (10 + 6 + 6 + 10 + 8 + 7 + 5 + 7 + 10 + 8)
- Mapped to phases: 77
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-12*
*Last updated: 2026-04-12 after initial definition*
