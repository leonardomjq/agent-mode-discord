# Roadmap: Agent Mode — Discord Rich Presence for Claude Code

## Overview

Six-phase path from empty repo to `v0.1.0` published on VS Code Marketplace + OpenVSX. Build order is RPC sink first, pure-core second, detectors third, personality/config/privacy fourth, companion+OSS+README fifth, publish sixth. Each phase leaves a working seam for the next — no big-bang integration. Parallelization is enabled: independent plans within a phase run concurrently.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Skeleton + RPC seam** — Extension loads, Discord IPC connects, CI bundle-size guardrail online, `[HUMAN]` credential prerequisites kicked off
- [ ] **Phase 2: Core pipeline** — Pure-core modules (state / throttle / privacy) + editor+git detectors plumbed end-to-end through hardened RPC
- [ ] **Phase 3: Agent detection** — Shell Integration + session-file fs-watch + polling tiers with precedence orchestrator; CODING upgrades to AGENT_ACTIVE
- [ ] **Phase 4: Personality + config + privacy** — Goblin pack, two-clock animator, templater, 20-key config surface, live reload, privacy modes
- [ ] **Phase 5: Companion plugin + OSS hygiene + assets + README** — Three parallel sub-deliverables: Claude Code plugin, OSS repo files + CI, demo GIF + portfolio README
- [ ] **Phase 6: Publish** — Release workflow on tag push; `v0.1.0` live on Marketplace + OpenVSX

## Phase Details

### Phase 1: Skeleton + RPC seam
**Goal**: Extension builds, loads, connects to Discord IPC with a hardcoded activity, cleans up on exit, stays under size/activation budgets. Bundle-size guardrail online in CI before any later phase can over-commit. Credential prerequisites with variable lead time started here.
**Depends on**: Nothing (first phase)
**Requirements**: SKEL-01, SKEL-02, SKEL-03, SKEL-04, SKEL-05, SKEL-06, SKEL-07, SKEL-08, SKEL-09, SKEL-10
**Success Criteria** (what must be TRUE):
  1. Loading the unpacked extension in a dev host connects to Discord desktop and shows a fixed "hello world" activity in the friends sidebar within 2 s of window open.
  2. `pnpm build` produces `dist/extension.cjs`; packaged VSIX is under 500 KB and CI fails a bloat-PR that pushes it past the threshold.
  3. Killing the extension host mid-session leaves no ghost presence in Discord (SIGINT / SIGTERM handlers call `clearActivity(pid)`; belt-and-braces `clearActivity(pid)` also runs once on `activate()`).
  4. Grep of the repo finds zero proposed-API references and zero `(vscode as any).*` casts; CI enforces this.
  5. `[HUMAN]` prerequisites kicked off before phase 2 starts: (a) Discord Developer Portal app created for bundled default Client ID (assets uploadable later); (b) OpenVSX namespace claim submitted (approval has variable lead time — blocks Phase 6 if not started now).
**Plans**: 5 plans

Plans:
- [x] 01-01-PLAN.md — Repo scaffolding (pnpm, TypeScript, esbuild, vitest, `package.json` manifest with `onStartupFinished`, `engines.vscode: ^1.93.0`, workspace trust + virtual workspaces flags)
- [x] 01-02-PLAN.md — `rpc/client.ts` v0 — connect, `setActivity` hardcoded, `clearActivity(pid)` on deactivate, SIGINT/SIGTERM handlers, belt-and-braces cleanup on activate
- [x] 01-03-PLAN.md — CI bundle-size check + api-surface check — esbuild metafile analysis + 500 KB threshold; proposed-API / `(vscode as any)` grep guard
- [x] 01-04-PLAN.md — Smoke test via vitest using a fake RPC transport; `pnpm test` exits 0
- [x] 01-05-PLAN.md — `[HUMAN]` handoff doc — Discord app creation checklist, OpenVSX namespace claim checklist, Phase 1 acceptance verification

### Phase 2: Core pipeline
**Goal**: Pure-core modules (state machine, throttle, privacy, context) + editor/git detectors shipped and tested without vscode. RPC hardened with backoff + cooldown. One real state (CODING) flows end-to-end; IDLE transitions work on timer.
**Depends on**: Phase 1
**Requirements**: RPC-01, RPC-02, RPC-03, RPC-04, RPC-05, RPC-06, STATE-01, STATE-02, STATE-03, STATE-04, STATE-05, STATE-06
**Success Criteria** (what must be TRUE):
  1. Focusing a text document flips presence to CODING with filename + language reflected in the activity state string; closing all editors and waiting past `idleTimeoutSeconds` transitions to IDLE.
  2. Simulating 20 state-change events in 1 s produces at most one Discord `setActivity` call per 2 s window (leading + trailing throttle), verified by a vitest test on the throttle module; the final state shown is always the latest.
  3. Killing Discord desktop mid-session triggers exponential backoff (5 → 10 → 20 → 40 → 60 s cap), with no two reconnect attempts within 5 s of each other; when Discord restarts, the current activity replays within one backoff tick with no user action.
  4. Opening two VS Code windows simultaneously produces two independent Discord activities, each scoped to its own `process.pid`; closing one does not clear the other.
  5. All pure-core modules (state machine, throttle, privacy, context) have vitest coverage and pass `pnpm test` without any `vscode` import.
**Plans**: TBD

Plans:
- [ ] 02-01: `state/machine.ts` — pure reducer, AGENT > CODING > IDLE priority, `startTimestamp` reset on transitions only
- [ ] 02-02: `state/context.ts` — immutable snapshot builder
- [ ] 02-03: `rpc/throttle.ts` — 2 s leading + trailing, drops intermediates, last-wins
- [ ] 02-04: `rpc/client.ts` hardening — backoff 5→60 s, 5 s cooldown guard, silent failures unless `debug.verbose`, pid scoping, `clearActivity(pid)` on deactivate (never `setActivity(null)`)
- [ ] 02-05: `privacy.ts` single redaction point — `show | hide | hash` + ignore-list matcher (stub defaults; full config arrives in phase 4)
- [ ] 02-06: `detectors/editor.ts` — tracks `activeTextEditor` / `onDidChangeActiveTextEditor`
- [ ] 02-07: `detectors/git.ts` — reads branch via `vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)`; silent if unavailable

### Phase 3: Agent detection
**Goal**: Upgrade CODING to AGENT_ACTIVE via tiered detectors. Shell Integration tier with ANSI strip + async-activation race mitigation, session-file fs-watch tier (mtime only), polling tier, orchestrator with deterministic precedence.
**Depends on**: Phase 2
**Requirements**: DET-01, DET-02, DET-03, DET-04, DET-05, DET-06, DET-07, DET-08, DET-09, DET-10
**Success Criteria** (what must be TRUE):
  1. Running `claude` in the dev-host integrated terminal flips presence to AGENT_ACTIVE with agent=`claude` within 500 ms; running `npx @anthropic-ai/claude-code` / `bunx @anthropic-ai/claude-code` / `pnpm dlx @anthropic-ai/claude-code` produces the same result.
  2. Running `aider` / `codex` / `npx @openai/codex` / `gemini` / `opencode` in the terminal flips presence to AGENT_ACTIVE with the correct agent label (falls back to generic copy — no per-agent sub-pool yet).
  3. Two parallel `claude` sessions in two terminals hold AGENT_ACTIVE until both end; ending one leaves presence at AGENT_ACTIVE (per-terminal session map, vitest-verified).
  4. Disabling Shell Integration (shell without plugin, or Cursor-on-Windows simulation) and running `claude` still flips presence to AGENT_ACTIVE via the `~/.claude/projects/*.jsonl` fs-watch tier (mtime + existence only — no JSONL parsing).
  5. Regex tests against recorded Low-confidence `commandLine.value` fixtures (with ANSI + prompt prefixes) produce zero false negatives; custom `detect.customPatterns` extends detection at runtime and flows through to `{agent}` templating.
**Plans**: TBD

Plans:
- [x] 03-01: `detectors/shellIntegration.ts` — `onDidStartTerminalShellExecution` + `onDidEndTerminalShellExecution` + `onDidChangeTerminalShellIntegration`; ANSI strip + prompt-prefix strip; per-terminal session map; do not downgrade terminal to "no integration" for 2 s
- [x] 03-02: `detectors/sessionFiles.ts` — `fs.watch` on `~/.claude/projects/*.jsonl`; mtime + existence only; all reads wrapped in try/catch
- [x] 03-03: `detectors/polling.ts` — 5 s interval against `vscode.window.terminals`; matches user `detect.polling.terminalNamePatterns`; empty-by-default
- [x] 03-04: `detectors/index.ts` — precedence orchestrator (companion > shellIntegration > sessionFiles > polling), dedup with lower tiers logged at debug only; companion slot reserved for phase 5
- [x] 03-05: Regex module — claude / aider / codex / gemini / opencode built-ins + `customPatterns` extension; Low-confidence fixture suite in vitest

### Phase 4: Personality + config + privacy
**Goal**: Replace hardcoded activity with animator-driven copy from the goblin pack. 20-key configuration surface with live reload. Full privacy mode implementation with ignore lists. Single `package.json` manifest edit for all three sub-areas.
**Depends on**: Phase 3
**Requirements**: PERS-01, PERS-02, PERS-03, PERS-04, PERS-05, PERS-06, PERS-07, PERS-08, PRIV-01, PRIV-02, PRIV-03, PRIV-04, PRIV-05, PRIV-06, PRIV-07, CONF-01, CONF-02, CONF-03, CONF-04, CONF-05
**Success Criteria** (what must be TRUE):
  1. With `claude` running, the Discord activity cycles frames every 2 s (e.g., `cooking.` → `cooking..` → `cooking...`) and rotates to a new goblin message every 20 s; the same message never shows twice in a row (Fisher-Yates no-repeat invariant, vitest-verified).
  2. Changing `privacy.workspaceName` from `show` to `hash` via settings applies on the next rotation tick (≤ 20 s) with no window reload; hashed output is 6-hex-char SHA-1 prefix of the normalized absolute path and deterministic across runs.
  3. Pointing `ignore.workspaces` at the current workspace produces zero Discord updates (full silence — not partial redaction); removing the rule restores updates on the next tick.
  4. `package.json` `contributes.configuration` contains ≤ 20 keys, each with `title`, `description`, `default`, and enum values where applicable; flipping any setting applies without reload.
  5. Static analysis of the built bundle + network-traffic test against a fresh VS Code profile running the extension for 10 minutes records zero outbound HTTP requests (Discord IPC only); verifiable in CI.
**Plans**: 10 plans

Plans:
- [x] 04-00-PLAN.md — Wave 0 test scaffolding (it.todo stubs for 7 Phase-4 specs, packFixtures + fakeClocks helpers, check-api-surface/check-no-network/check-config-keys skeletons, 04-HUMAN-UAT.md)
- [x] 04-01-PLAN.md — `presence/types.ts` + `presence/packLoader.ts` — Pack/Message/ValidateResult types; hand-rolled schema validator + loadPack with 100 KB size-cap, proto-pollution safe, fallback to builtin on any error
- [x] 04-02-PLAN.md — `presence/animator.ts` — weighted pool pick (AGENT 70/20/10, CODING 85/15, IDLE 90/10) + Fisher-Yates no-repeat per-pool memory + 20s rotation + 2s frame clocks + animations.enabled freeze-on-frame-0 + blank-skip cap + time-of-day bucketing
- [x] 04-03-PLAN.md — `presence/templater.ts` — 6-token substitution (`{workspace}` / `{filename}` / `{language}` / `{branch}` / `{agent}` / `{elapsed}`); isBlank helper for blank-after-substitution detection
- [x] 04-04-PLAN.md — `presence/activityBuilder.ts` — glue module: formatElapsed (Discord short form) + buildTokens (redact per field) + buildPayload (SetActivity) + createActivityBuilder (ignore clear-once + idleBehavior=clear clear-once, never setActivity(null), never destroy RPC)
- [x] 04-05-PLAN.md — `presence/goblin.json` — canonical pack committed verbatim from D-05 (AGENT_ACTIVE._primary + claude + codex + CODING + IDLE + timeOfDay); esbuild inlines into dist/extension.cjs
- [x] 04-06-PLAN.md — `config.ts` + `outputChannel.ts` + `package.json` contributes.configuration — 14-key manifest under agentMode.* (≤20 per CONF-01); readConfig() lazy per tick; log() debug.verbose-gated; `check:config-keys.mjs` CI guardrail
- [x] 04-07-PLAN.md — `privacy.ts` full impl (SHA-1 6-hex hash + globMatch + normalizeGitUrl + ReDoS-safe regex + evaluateIgnore) + `gitBranch.ts` adapter (vscode.git async-activation pattern with silent degrade)
- [x] 04-08-PLAN.md — `extension.ts` wiring — replaces Phase-2 buildPayload with createActivityBuilder; onDidChangeConfiguration no-op + forceTick; state-transition branch refresh; poll-on-tick custom pack via loadPack
- [x] 04-09-PLAN.md — `scripts/check-no-network.mjs` + `.github/workflows/ci.yml` — static grep of dist/extension.cjs for forbidden HTTP patterns (http.request / https.request / fetch / undici / node-fetch / XMLHttpRequest); CI wires check:no-network + check:config-keys

### Phase 5: Companion plugin + OSS hygiene + assets + README
**Goal**: Three parallel sub-deliverables — Claude Code companion plugin (tier-1 detector signal per D-01), OSS repo hygiene + CI workflow, demo GIF + portfolio-grade README. No `src/` changes except `src/detectors/companion.ts` + orchestrator wiring.
**Depends on**: Phase 4
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07, DIST-01, DIST-02, DIST-03, DIST-04, DIST-05, DIST-06, DIST-07, DIST-08, DIST-09, DIST-10
**Success Criteria** (what must be TRUE):
  1. `claude plugin install ./companion/claude-code-plugin` installs cleanly; starting a Claude Code session writes `~/.claude/agent-mode-discord.lock` within 200 ms; ending the session removes it within 200 ms.
  2. With the plugin installed, the extension promotes the detection signal to tier-1 (highest fidelity per D-01) on lockfile creation and suppresses lower-tier signals at debug-log level only (no double-count, no state churn); packaged VSIX does not contain `companion/**` (verified by `.vscodeignore` + `vsce ls`).
  3. PR against `main` triggers CI matrix on ubuntu-latest + macos-latest + windows-latest; steps `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm test`, `pnpm build`, bundle-size check all pass; `main` branch protection requires green CI before merge; Dependabot is enabled via `.github/dependabot.yml`.
  4. Repo root contains LICENSE (MIT with current year + owner), CODE_OF_CONDUCT.md (Contributor Covenant 2.1), SECURITY.md, CONTRIBUTING.md, plus `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md`, `.github/PULL_REQUEST_TEMPLATE.md` — each with the structured fields listed in DIST-03/04/05.
  5. README renders at repo root with: one-sentence tagline, demo GIF above the fold (under 8 MB, 15–30 s loop, shows Discord flipping Idling → AGENT_ACTIVE), install sections (Marketplace + OpenVSX + VSIX), goblin preview, privacy FAQ, competitive positioning table, troubleshooting (Cursor-on-Windows + fish + Command Prompt + Flatpak Discord), sponsor placeholder, MIT line, maintainer-posture line.
**Plans**: 7 plans

Plans:
- [x] 05-01-PLAN.md — `detectors/companion.ts` — `fs.watchFile` on `~/.claude/agent-mode-discord.lock`; wires into orchestrator as tier-1 (D-01); orphan detection at 5min staleness
- [x] 05-02-PLAN.md — `companion/claude-code-plugin/` — `.claude-plugin/plugin.json`, `hooks/hooks.json`, `scripts/{start,stop}.sh`; excluded from VSIX via `.vscodeignore`
- [x] 05-03-PLAN.md — OSS hygiene — LICENSE (MIT), CODE_OF_CONDUCT.md (CC 2.1), SECURITY.md, CONTRIBUTING.md (with branch protection docs per D-10)
- [x] 05-04-PLAN.md — GitHub templates — `.github/ISSUE_TEMPLATE/{bug_report,feature_request}.md` + `.github/PULL_REQUEST_TEMPLATE.md`
- [x] 05-05-PLAN.md — CI matrix expansion + Dependabot — 3-OS matrix, `pnpm lint` (tsc --noEmit per D-09), fail-fast:false; `.github/dependabot.yml`
- [x] 05-06-PLAN.md — Demo GIF capture — [HUMAN] checkpoint; 15–30 s loop, under 8 MB, Discord sidebar flipping Idling → AGENT_ACTIVE
- [x] 05-07-PLAN.md — README — 13 sections per D-12; tagline, demo GIF, install, goblin preview, privacy FAQ, competitive table, troubleshooting, maintainer-posture (D-13); `package.json` repo URL update (D-14)

### Phase 05.2: Multi-window leadership election (INSERTED)

**Goal:** Replace the v0.1.0 multi-window behavior (every window opens its own Discord RPC connection; Discord's desktop client picks which to display) with a deterministic single-leader design: the first VS Code window to start acquires `~/.claude/agent-mode-discord.leader.lock` (atomic `open(wx)` per D-02) and owns Discord presence; subsequent windows detect the leader and stay silent. 30s heartbeat keeps the lockfile fresh; 90s staleness threshold allows any follower to greedily take over when the leader exits or crashes. Mirrors the fs.watchFile+mtime lockfile pattern already proven by `src/detectors/companion.ts`. Ships before v0.1.0 so the multi-window UX is clean from day one.

**Requirements**: None new (polish/architecture phase; supports PRD §4 multi-window expectations + existing DIST-09 README accuracy; honors 13 locked decisions D-01..D-13 in 05.2-CONTEXT.md)
**Depends on:** Phase 5
**Plans:** 3/3 plans complete

Plans:
- [x] 05.2-01-PLAN.md — `src/state/leadership.ts` + `test/state.leadership.test.ts` (TDD: RED → GREEN → REFACTOR; covers D-01..D-11, D-13)
- [x] 05.2-02-PLAN.md — `src/extension.ts` leader/follower wire-in (acquire() before mgr.start; lazy takeover; covers D-05, D-06, D-10, D-13)
- [x] 05.2-03-PLAN.md — `docs/MULTI-WINDOW.md` rewrite + `05.1-HUMAN-UAT.md` smoke-test update (single-leader semantics; covers D-12)

### Phase 05.1: Polish & marketplace prep (INSERTED)

**Goal:** Polish v0.1.0 to publishable Marketplace + OpenVSX quality. Bundling cleanup (drop redundant @xhayper re-include from .vscodeignore; emit dist/THIRD_PARTY_LICENSES.md from esbuild metafile), manifest metadata pass (displayName/categories/keywords/version/icon), README polish (Client ID bus-factor, Discord Dev Portal observability, accurate Privacy FAQ wording), CHANGELOG.md v0.1.0 entry (Keep a Changelog 1.1.0), SECURITY.md three-stage threat-model rewrite, multi-window + Cursor compat docs, and address the 7 IN-* findings from 05-REVIEW.md.
**Requirements**: None new (polishes existing DIST-01..DIST-10 already delivered in Phase 5; honors 15 locked decisions D-01..D-15 in 05.1-CONTEXT.md)
**Depends on:** Phase 5
**Plans:** 7/7 plans complete

Plans:
- [x] 05.1-01-PLAN.md — Bundling cleanup (D-01 .vscodeignore re-include removal + D-02 dist/THIRD_PARTY_LICENSES.md emission from esbuild metafile)
- [x] 05.1-02-PLAN.md — Manifest metadata pass (D-03..D-07: displayName, categories, keywords, version 0.0.1→0.1.0, icon field + assets/icon.png HUMAN gate)
- [x] 05.1-03-PLAN.md — README polish (D-08 Bus factor / Client ID override + D-09 Observability section + D-10 corrected Privacy FAQ wording)
- [x] 05.1-04-PLAN.md — CHANGELOG.md v0.1.0 entry in Keep a Changelog 1.1.0 format (D-11)
- [x] 05.1-05-PLAN.md — SECURITY.md Threat Model Notes three-stage rewrite (D-12)
- [x] 05.1-06-PLAN.md — Multi-window + Cursor compat docs (D-13 docs/MULTI-WINDOW.md + smoke test checkpoint + D-14 docs/CURSOR-COMPAT.md)
- [x] 05.1-07-PLAN.md — Address 7 IN-* findings from 05-REVIEW.md (D-15: IN-01..IN-07, one commit per finding; depends on 03 + 04 to avoid README/CHANGELOG merge conflicts)

### Phase 6: Publish
**Goal**: Release workflow on tag push; `v0.1.0` goes live on VS Code Marketplace + OpenVSX. Non-code phase gated on `[HUMAN]` credentials (VSCE_PAT, OVSX_PAT, Discord assets uploaded to Developer Portal, OpenVSX namespace claim approved).
**Depends on**: Phase 5
**Requirements**: PUB-01, PUB-02, PUB-03, PUB-04, PUB-05, PUB-06, PUB-07, PUB-08
**Success Criteria** (what must be TRUE):
  1. Discord Developer Portal "Agent Mode" app has `agent-mode-large` (1024×1024), `agent-mode-small` (512×512), and `claude-icon` assets uploaded and returning HTTP 200 in IPC activity payloads.
  2. `vsce package --pre-release` produces a VSIX with zero warnings; `vsce publish --pre-release --dry-run` and `ovsx publish --dry-run` both succeed locally.
  3. `.github/workflows/release.yml` triggers on `v*` tag push, publishes to Marketplace and OpenVSX in parallel, and attaches the VSIX to the GitHub Release; repo has `VSCE_PAT` and `OVSX_PAT` secrets set.
  4. Pushing tag `v0.1.0` results in both Marketplace and OpenVSX listings live within 30 minutes (listing URLs clickable and rendering the README).
  5. Installing the published extension from Marketplace in a fresh VS Code profile and from OpenVSX in a fresh Cursor profile passes the local-dev verification flow (start `claude` → Discord flips to AGENT_ACTIVE with goblin copy) on both.
**Plans**: TBD

**Scope amendments (added 2026-04-16 after Phase 5 retrospective):**
- Microsoft Partner Center publisher account creation (real `publisher` field, replacing `agent-mode-dev` placeholder; pursue verified-badge if criteria met)
- Post-publish README update wiring Marketplace + OpenVSX install-count badges (uses official shields.io marketplace endpoint — surfaces install metrics directly on the listing page)
- Document Discord Developer Portal as the primary observability surface (DAU/MAU/activity counts already collected for the bundled Client ID; the README's Privacy/Observability section explains what's measurable without writing any extension-side telemetry code)
- Address the 6 v0.1.0 marketplace metadata gaps that didn't fit Phase 5.1 if any remain unfixed (e.g., `keywords` array refinement, listing description tuning)
- These amendments will be integrated into the plan breakdown when `/gsd-discuss-phase 6` runs

Plans:
- [ ] 06-01: Asset upload — Discord Developer Portal (`agent-mode-large`, `agent-mode-small`, `claude-icon`)
- [ ] 06-02: Credential setup — `VSCE_PAT` (Azure DevOps PAT scoped Marketplace: Manage) + `OVSX_PAT` as GitHub repo secrets
- [ ] 06-03: `.github/workflows/release.yml` — on `v*` tag, publish Marketplace + OpenVSX in parallel, attach VSIX to GitHub Release
- [ ] 06-04: Local dry-runs — `vsce package --pre-release`, `vsce publish --pre-release --dry-run`, `ovsx publish --dry-run`
- [ ] 06-05: Tag `v0.1.0` and verify — Marketplace + OpenVSX listings live within 30 min; fresh-profile install on VS Code + Cursor passes PRD §15 verification
- [ ] 06-06 (NEW): Publisher account creation in Microsoft Partner Center; update `package.json` `publisher` field; pursue verified-badge if eligible
- [ ] 06-07 (NEW): Post-publish README update — wire shields.io Marketplace install-count + version badges, OpenVSX install-count badge, GitHub Release link
- [ ] 06-08 (NEW): README Observability section — document Discord Developer Portal analytics as the primary metrics surface (DAU/MAU/activity counts available without extension-side telemetry)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Skeleton + RPC seam | 0/5 | Not started | - |
| 2. Core pipeline | 0/7 | Not started | - |
| 3. Agent detection | 0/5 | Not started | - |
| 4. Personality + config + privacy | 0/10 | Not started | - |
| 5. Companion + OSS + assets + README | 0/7 | Not started | - |
| 6. Publish | 0/5 | Not started | - |

## Backlog

Unsequenced ideas captured for future review. Promote with `/gsd-review-backlog`.

### Phase 999.1: Cursor-on-Windows reproduction harness for fs-watch fallback (BACKLOG)

**Goal:** [Captured for future planning]
**Requirements:** TBD
**Plans:** 0 plans

Currently a documented troubleshooting entry in README (Cursor-on-Windows uses
different fs-watch behavior than VS Code, falls back to polling) but never
actually tested by us. Real Windows + Cursor install needed to verify the
fallback path doesn't regress. Not blocking v0.1.0 ship — Marcus persona is
Cursor-first but the documented behavior is conservative enough to be defensible
if untested.

**Tags:** testing, windows, cursor, detector

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 7: presence v2: goblin brand and Watching activity type lever

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 6
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 7 to break down)
