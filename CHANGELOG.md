# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

## [0.1.3] - 2026-04-30

Drop `aider` from the built-in agent list — limited audience overlap with this
extension's primary users (Claude Code / Cursor / OpenAI / Gemini). The
`agentMode.detect.customPatterns` setting still lets anyone re-add it locally
without a code change. Agent label `aider` is still tolerated downstream as a
custom string, so existing user configs keep working; only the bundled regex
patterns and asset-key mapping are removed.

### Removed

- `BuiltInAgent` type: `aider` → no longer enumerated.
- `BUILT_IN_PATTERNS.aider` regex set (`^aider`, `^python -m aider`).
- `aider-icon` mapping in `AGENT_ICON_KEYS`. Custom-named agents fall back to
  `agent-mode-large` per existing fallback contract.
- Aider fixtures from the shell-integration low-confidence positive set.

### Notes

- Net test count: 332 (was 338 in v0.1.2 — 6 tests removed alongside aider
  patterns; no behavioral regression).

## [0.1.2] - 2026-04-30

Per-agent Discord rich-presence icons (SEED-002 closed). Replaces v0.1.0's
broken `?` placeholder with the recognizable provider logo for the agent
that's actually running. Asset uploads happen at the Discord Dev Portal —
no extension rebuild required to add new icons.

### Added

- `buildPayload` now sets `largeImageKey` + `largeImageText` on every
  SetActivity. Detected built-in agents (`claude`, `codex`, `gemini`, `aider`,
  `opencode`) map to per-provider Discord asset keys (`claude-icon` etc).
  IDLE state and unknown agents fall back to the generic `agent-mode-large`
  key so the icon never goes missing.
- 8 new test cases in `test/presence.activityBuilder.test.ts` covering each
  built-in agent mapping, custom-agent fallback, IDLE-state fallback, and
  case-insensitive matching.

### Notes

- Per-provider icons require uploading 1024×1024 PNGs to the Discord
  Developer Portal under matching keys. Until uploaded, Discord renders the
  broken-image placeholder for that key — same UX as before, but localized
  to whichever agent is unmapped instead of breaking globally.

## [0.1.1] - 2026-04-30

Marketplace listing unblock — VS Code Marketplace's brand-protection scan
auto-rejects new extensions whose `displayName` contains "Discord". Existing
Discord-presence extensions were grandfathered before this scan tightened
(per Microsoft staff in `microsoft/vsmarketplace#352`). v0.1.0 already shipped
to OpenVSX and GitHub Releases — this release republishes everywhere with a
trademark-safe display name.

### Changed

- `displayName`: "Agent Mode — Discord Presence for Claude Code & AI Agents" →
  "Agent Mode — Rich Presence for AI Coding Agents". Removes "Discord" from
  the listing title; description and README still describe the Discord
  integration accurately.
- `description`: rephrased to remove leading "Discord" so Marketplace search
  cards stay scan-safe while still surfacing supported agents (Claude Code,
  Cursor, Codex, Gemini).

### Fixed

- `pnpm/action-setup@v4` errored when both workflow `version: 9` and
  `package.json` `packageManager: pnpm@9.0.0` were set — kept the
  `packageManager` field as the single source of truth and dropped the
  workflow arg.
- `test/detectors.sessionFiles.test.ts` skipped on Windows (fake-fs uses
  forward-slash path literals; `path.join` returns backslash on win32, so
  `Map<string>` lookups missed). Production fs handling is unaffected; SEED-004
  tracks restoring full Windows test coverage.

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
