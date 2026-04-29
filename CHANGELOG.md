# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

## [0.1.0] - 2026-04-16

Initial release. Detects Claude Code (and other AI coding agents) running in
your VS Code or Cursor integrated terminal and flips your Discord status to
AGENT_ACTIVE with goblin-voice copy — instead of "Idling" during 2-4 hour AI
sessions when you're reading diffs and prompting, not typing.

### Added

- Tiered agent detection pipeline — companion lockfile (tier-1, <100 ms),
  Shell Integration API (tier-2, <500 ms), session-file fs-watch (tier-3,
  ~1 s), terminal name polling (tier-4, ~2 s); highest active tier wins
  automatically.
- Built-in agent recognizers for `claude` (and `npx @anthropic-ai/claude-code`,
  `bunx`, `pnpm dlx` variants), `aider`, `codex` (and `npx @openai/codex`),
  `gemini`, `opencode`. Custom regex patterns extend the set via
  `agentMode.detect.customPatterns`.
- Companion Claude Code plugin (`companion/claude-code-plugin/`) — optional,
  install via `claude plugin install ./companion/claude-code-plugin` for
  tier-1 detection fidelity.
- Goblin personality pack (`presence/goblin.json`) inlined into the bundle —
  weighted message pools per state (AGENT_ACTIVE / CODING / IDLE), 2-second
  frame animations, 20-second message rotation, Fisher-Yates no-repeat,
  time-of-day bucketing.
- Custom copy pack support via `agentMode.messages.customPackPath` — 100 KB
  size cap, schema-validated, falls back to built-in pack on any error.
- 14 configuration keys under `agentMode.*` — Discord Client ID override,
  idle behavior, animations toggle, custom pack path, three privacy
  controls (filename / git branch / workspace name), four ignore lists
  (git hosts / organizations / repositories / workspaces), two detection
  tunables (custom patterns, session-file staleness threshold), debug
  verbose toggle. Settings apply on the next rotation tick — no window
  reload required.
- Privacy controls — `show` / `hide` / `hash` for workspace name, `show` /
  `hide` for filename and git branch. Hash mode uses a 6-hex-char SHA-1
  prefix of the normalized absolute path, deterministic across runs.
- Ignore lists — silence the extension entirely for matching workspaces
  (glob), repositories (regex), organizations (regex), or git hosts
  (case-insensitive substring).
- Bundled third-party license aggregate at `dist/THIRD_PARTY_LICENSES.md`,
  generated on every production build by walking the esbuild metafile.
- Companion plugin manifest declares `homepage` and `repository` so
  installers can find the project source.
- OSS hygiene — MIT `LICENSE` (2026 Leonardo Jaques), Contributor Covenant
  2.1 `CODE_OF_CONDUCT.md`, `SECURITY.md`, `CONTRIBUTING.md`, GitHub issue +
  PR templates, Dependabot config (npm + github-actions, weekly).
- 3-OS CI matrix (Ubuntu, macOS, Windows) on every PR — install / lint /
  build / bundle-size / API-surface / config-keys / no-network /
  pack-inlined / test guardrails.
- README — bus-factor + own-Client-ID override instructions, Discord
  Developer Portal observability, privacy FAQ, competitive positioning
  table, troubleshooting (Cursor on Windows / fish / cmd.exe / Flatpak
  Discord), maintainer-posture statement.
- `docs/MULTI-WINDOW.md` — documented multi-window VS Code behavior.
- `docs/CURSOR-COMPAT.md` — documented Cursor compatibility statement.

### Changed

- Marketplace metadata — `displayName` is now `Agent Mode — Discord
  Presence for Claude Code & AI Agents`; `categories` is
  `["Visualization", "Other"]`; `keywords` array added with 9 search
  terms; `icon` field points at `assets/icon.png`.
- `.vscodeignore` no longer re-includes `node_modules/@xhayper/**` —
  esbuild already bundles `@xhayper/discord-rpc` into `dist/extension.cjs`,
  so the re-include was dead weight inflating the VSIX.

### Removed

- Unreachable `companionStalenessMs` orchestrator option in
  `src/detectors/index.ts` — the option was declared but never wired
  from `extension.ts` and had no corresponding `agentMode.*` config key.
  The companion detector continues to use its internal 5-minute default.

### Fixed

- `SECURITY.md` Threat Model Notes — clarified that the extension itself
  makes zero outbound HTTP requests, while Discord IPC's onward
  transmission to Discord's servers is intentional, controlled by Discord,
  and subject to Discord's privacy policy. Earlier wording conflated the
  two.
- `SECURITY.md` companion-detector note — corrected an inaccurate claim
  that lockfiles are "size-capped (≤ 4 KB) and JSON-validated before
  parsing"; the detector reads `mtimeMs` only via `fs.watchFile` and
  never opens the file.
- `README.md` configuration-key count corrected from 20 to 14 (in both
  the prose claim and the competitive-positioning table).
- `README.md` and `assets/CAPTURE-INSTRUCTIONS.md` install commands
  reconciled — `claude plugin install ./companion/claude-code-plugin`
  from a shell, `/plugin install ./companion/claude-code-plugin` from
  a running Claude Code session.
- `assets/CAPTURE-INSTRUCTIONS.md` no longer references a non-existent
  `pnpm vscode:package` script; replaced with
  `npx @vscode/vsce package --no-dependencies`.
- `CODE_OF_CONDUCT.md` enforcement section duplicated preposition
  ("at via") fixed.
- `companion/claude-code-plugin/scripts/{start,stop}.sh` now use
  `set -euo pipefail` and a `${HOME:?...}` guard so a missing `$HOME`
  fails loudly instead of silently no-op'ing.
- `src/detectors/companion.ts` — added a code comment documenting the
  `mtimeMs > 0` ⇔ "file exists" invariant for `fs.watchFile`, so the
  pattern is not accidentally "fixed" by a future maintainer.

### Security

- Zero outbound HTTP — verified by `scripts/check-no-network.mjs` greping
  the built bundle for `http.request`, `https.request`, `fetch`,
  `undici`, `node-fetch`, and `XMLHttpRequest` patterns. Discord IPC
  (Unix socket / named pipe) is the only network surface.
- Zero VS Code proposed APIs — verified by `scripts/check-api-surface.mjs`
  greping for `(vscode as any).*` and proposed-API references.
- Configuration surface capped at ≤ 20 keys — `scripts/check-config-keys.mjs`
  blocks PRs that grow it past the budget.
- All file reads in detectors and pack loader are wrapped in `try/catch`
  with silent failure modes per project discipline; no user-visible error
  path leaks filesystem details.

[Unreleased]: https://github.com/leonardomjq/agent-mode-discord/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/leonardomjq/agent-mode-discord/releases/tag/v0.1.0
