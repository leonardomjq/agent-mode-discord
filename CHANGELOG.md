# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

## [0.3.1] - 2026-05-05

Restoration release. v0.2.2/0.2.3/0.2.4 minimized README, scrubbed bundle
Discord URLs, and stripped metadata as test rungs against the MS Marketplace
"suspicious content" rejection. v0.3.0 (T4 — slug rename) was the only fix
that worked. Everything stripped during T1–T3 is restoration work, not
problem-solving. This release puts it back.

### Changed

- `README.md`: full restoration with Discord-forward branding, install
  commands updated to `leonardomjq.goblin-mode`, marketplace + OpenVSX
  badges live, Watching activity-type section added, Cursor stale-cache +
  Cmd+Q troubleshooting note added.
- `package.json` `description`: long Discord-forward sentence naming the
  supported AI agents (Claude Code, Cursor, Codex, Gemini).
- `package.json` `keywords`: 3 → 17 (`discord`, `discord rich presence`,
  `discord rpc`, `discord presence`, `rich presence`, `presence`,
  `claude`, `claude code`, `cursor`, `codex`, `gemini`, `ai agent`,
  `ai coding`, `vibe coding`, `goblin mode`, `rpc`, `status`).
- `package.json` `categories`: `["Other"]` → `["Visualization", "Other"]`
  (matches v0.1.x pre-test state).
- `esbuild.mjs`: removed the T2 bundle URL-scrub step. Proven unnecessary
  (T2 was a wrong hypothesis — slug was the trigger, not bundled URLs).
  Bundle truth > obscurity.

### Unchanged

- `displayName` stays `"goblin mode"` (Phase 7 brand stance — short form).
- Internal lockfile paths (`~/.claude/agent-mode-discord.lock`,
  `~/.claude/agent-mode-discord.leader.lock`) preserved — companion
  plugin contract unchanged.
- Repo URLs unchanged (GitHub repo still `agent-mode-discord` slug).

### Migration impact

None. Marketplace + OpenVSX users on `leonardomjq.goblin-mode` v0.3.0
auto-update to v0.3.1. ~428 OpenVSX users still on the old
`leonardomjq.agent-mode-discord` slug remain orphaned (separate
follow-up: deprecation notice or unpublish).

## [0.3.0] - 2026-05-05

T4 in marketplace publish-test ladder. T1 (README), T2 (bundle URL scrub),
T3 (metadata minimization) all failed against MS Marketplace's
"suspicious content" auto-rejection. After dashboard inspection
confirmed displayName is NOT the trigger (passing test extensions had
displayNames "Agent Mode" and "Agent Mode for Claude Code"), the slug
`agent-mode-discord` is the only constant left across all 9 prior
rejections. T4 renames the extension `name` field to drop "discord"
from the slug.

### Changed

- `package.json` `name`: `agent-mode-discord` → `goblin-mode`. New
  extension ID is `leonardomjq.goblin-mode`. Marketplace URL becomes
  `https://marketplace.visualstudio.com/items?itemName=leonardomjq.goblin-mode`.
- Version major bump 0.2.4 → 0.3.0 to signal the breaking ID change.

### Migration impact

- **OpenVSX:** Old extension `leonardomjq.agent-mode-discord` (last
  version 0.2.4, ~428 downloads) becomes orphaned. New extension
  `leonardomjq.goblin-mode` published under same `leonardomjq` namespace.
  Existing OpenVSX/Cursor users do NOT auto-migrate — different ID =
  different installation. Will add a deprecation notice to the old
  extension in a follow-up.
- **Internal lockfile paths preserved** at `~/.claude/agent-mode-discord.lock`
  and `~/.claude/agent-mode-discord.leader.lock` (companion plugin
  contract unchanged; brand transition does not break tier-1 detection).
- **Repo URLs unchanged** (GitHub repo still `agent-mode-discord` slug).

## [0.2.4] - 2026-05-05

T3 in marketplace publish-test ladder. T2 (bundle URL scrub, v0.2.3)
failed. Last cheap test before the slug-rename nuclear option:
radical metadata simplification.

### Changed

- `displayName`: `goblin mode — rich presence for AI coding agents` →
  `goblin mode` (no em-dash, no descriptor — em-dash unicode may be
  a content-scan trigger).
- `description`: long sentence → `Rich presence for AI coding.`
- `keywords`: 17 → 3 (`presence`, `ai`, `claude`). Removed all
  `discord`-prefixed variants and most others.
- `categories`: `["Visualization", "Other"]` → `["Other"]`.

No code changes. README + bundle scrubbing from v0.2.2/v0.2.3 retained.

## [0.2.3] - 2026-05-05

T2 in marketplace publish-test ladder. T1 (README minimization, v0.2.2)
failed — same auto-reject. Hypothesis updated: bundled `@xhayper/discord-rpc`
imports `discord-api-types` URL constants (`RouteBases.api` etc.) that
survive tree-shaking. T2 scrubs external Discord URLs from the bundle
post-build.

### Changed

- `esbuild.mjs` now post-processes `dist/extension.cjs` after esbuild
  emits, replacing 7 external Discord URL patterns with `.invalid`
  placeholders: `discord.com/api/v`, `discord.com/events`, `discord.gg`,
  `discord.gift`, `discord.new`, `discordapp.com`, `discordapp.net`.
- Observationally safe: IPC transport never makes HTTP calls (verified
  by `pnpm check:no-network` CI guardrail). The scrubbed URLs are
  dead-code constants from REST/OAuth code paths the extension never
  reaches.
- Bundle size unchanged at 222 KB; all 449 tests green.

## [0.2.2] - 2026-05-05

T1 in marketplace publish-test ladder. v0.2.0 + v0.2.1 hit MS Marketplace
"suspicious content" auto-rejection. v0.2.2 strips README to minimal
content (no badges, no external image links, no discord.com URLs in body)
to test if README content was the trigger. No code changes.

### Changed

- README.md reduced from 251 lines to ~20 lines: title, description,
  install instructions, link to GitHub for full docs. Eliminated 2 SVG
  badges (img.shields.io + GitHub Actions), 2 discord.com URLs (developer
  portal + privacy), comparison-extension marketplace links, and the
  long-form features/architecture sections. Full README still available
  in the GitHub repo.

## [0.2.1] - 2026-05-05

VS Code Marketplace publish-fix for v0.2.0. The auto-rejection scanner
("suspicious content") tripped on v0.2.0's description that mentioned
Discord twice in two sentences. v0.2.0 published successfully to
OpenVSX (Cursor users have it), but Marketplace required a re-publish
with lighter Discord density in the description. No code changes.

### Changed

- Description rewritten to mention Discord once instead of twice, leading
  with "Rich presence for AI coding agents". Discord-keyword stays in
  keywords (proven safe in v0.1.3 publishes) for marketplace search
  discoverability.

## [0.2.0] - 2026-05-05

Brand and copy rebuild. The Discord card now reads as a flex for anyone using
AI coding agents — not just career devs. Default activity type is now
`Watching` (pattern interrupt vs sea of `Playing X`); copy is rewritten in
universal-parse, AI-named voice with no dev jargon.

### Changed

- `displayName`: `Agent Mode — Rich Presence for AI Coding Agents` →
  `goblin mode — rich presence for AI coding agents`. Lowercase brand,
  cheeky tribe-banner stance. Discord-keyword removed from `displayName`
  per Marketplace constraint; preserved in description + keywords +
  README so search discoverability is unaffected.
- Description rewritten to lead with Discord + AI-named verbs (Marketplace
  search snippet now communicates the use case directly).
- `agentMode.activityType` default flipped from `playing` → `watching`.
  Existing users on default get the Watching pattern interrupt
  automatically; flip back to `playing` if your Discord client renders
  Watching incorrectly.
- `goblin.json` pool rewritten to 15 universal-parse, AI-named entries.
  No dev jargon (`PR`, `diff`, `merge`, `commit` banned as whole-word
  tokens with CI guardrail). Banned absence framing (`afk`, `touching
  grass`) and past-tense action verbs (`shipped`, `coded`, `built`).
  Every entry reads grammatically after both `Watching ` and `Playing X /`.
- `largeImageText` (Discord card hover) flips from static `Agent Mode`
  to per-agent `running ${agent}` / `goblin mode` fallback. Literal
  `"Agent Mode"` is now CI-banned in `src/presence/` via grep guardrail
  (output channel name in `outputChannel.ts` preserved as internal-only).

### Added

- `agentMode.activityType` config setting — enum `["watching", "playing"]`,
  default `"watching"`. Maps to `SetActivity.type` (Watching=3, Playing=0).
- `state` field on Discord activity — populated with time-of-day modifier
  (`3am goblin shift`, `morning service`, `afternoon shift`, `evening
  service`) for a second descriptive line on the card.
- `test/presence.goblin.voice.test.ts` — voice-rules CI gate enforcing
  AI-named, lowercase-with-abbreviations-allowed, no-banned-tokens,
  Watching-grammar, no-past-tense, no-dev-jargon rules over every pool
  entry. 86 voice tests + pool-count + timeOfDay invariants.
- 16 behavioral tests covering activity-type fallback, time-of-day
  buckets, and per-agent hover text.

### Notes

- Net test count: 449 (was 332 in v0.1.3 — 117 added).
- Bundle size: 221.8 KB (44% of 500 KB SKEL-04 budget).
- Discord Developer Portal app should be renamed `Agent Mode` →
  `goblin mode` for the title to update on Discord cards. Render-test
  matrix in `.planning/phases/07-.../07-HANDOFF.md` documents
  cross-client validation steps.
- For full strategic context (persona, voice rules, why these decisions),
  see `.planning/phases/07-.../07-SPEC.md` and `07-LEARNINGS.md`.

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
