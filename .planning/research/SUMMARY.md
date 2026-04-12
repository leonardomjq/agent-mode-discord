# Project Research Summary

**Project:** Agent Mode — Discord Rich Presence for Claude Code
**Domain:** VS Code / Cursor extension (single CJS bundle, no backend, no server-side compute)
**Researched:** 2026-04-12
**Confidence:** HIGH

## Executive Summary

VS Code / Cursor extension that detects `claude` (and 4 other agents via generic regex) running in the integrated terminal and flips Discord Rich Presence to an AGENT_ACTIVE state with goblin-voice copy. Single CJS bundle via esbuild, no backend, no server-side compute, no outbound HTTP — Discord IPC only. Hard targets: VSIX under 500 KB, activation under 50 ms, zero VS Code proposed APIs, zero `(vscode as any).*` casts. `engines.vscode: ^1.93.0`.

**The moat is tiered terminal detection** — companion lockfile > Shell Integration > fs-watch > polling, with per-terminal precedence dedup. Not goblin copy. Not OpenVSX distribution. Not multi-agent support. Competitors (vscord 778k, discord-vscode 2.48M) track `activeTextEditor` only; the one terminal-aware competitor (RikoAppDev) uses proposed-API casts that will fail Marketplace review. Owning the four-tier stack is what separates this from every existing extension. Phase ordering must reflect that: build the RPC sink first (M0), get a working pipeline running on editor/git signals (M2), then bolt detectors on top (M1 → M5 companion).

**Stack drift from PRD worth surfacing to the roadmapper:**
- `@xhayper/discord-rpc`: bump `^1.3.1` → `^1.3.3` (published 2026-03-26, still active)
- Vitest: use `^3.2.4` (PRD said `^2`; Vitest 4.1.4 is 3 days old — too fresh)
- TypeScript: `^5.9.3` (PRD said `^5.4`; TS 6.0.2 exists but ecosystem lag makes it risky for a 2-week ship)
- esbuild: `^0.25` (PRD said `^0.24`)
- Node.js: pin `22.19.17` (Active LTS) in CI runners
- No architectural changes. Only version bumps.

**Architecture is intentionally decoupled.** Build order (M0 → M2 → M1 → M3 → M4 → M5) ships a working `client.setActivity(hardcoded, pid)` at M0 so every subsequent component has a seam to integrate against — never a big-bang integration. One simplification on PRD §9.4 file layout: split `animator.ts` into `animator.ts` + `packLoader.ts` because animator hits the 200-line cap with two clocks + no-repeat queue.

## Key Findings

### Recommended Stack

Single runtime dep (`@xhayper/discord-rpc`); everything else is Node stdlib or dev-only. Toolchain locked by PROJECT.md: pnpm, esbuild, vitest, TypeScript. See `.planning/research/STACK.md` for full version table + Node/tool compatibility matrix.

**Core technologies:**
- **`@xhayper/discord-rpc@^1.3.3`** — Discord IPC client (local socket/named pipe). The only runtime dep. `discord-rpc` npm package is 5 years dead; do not use.
- **TypeScript `^5.9.3`** — last stable 5.x. TS 6.0.2 (2026-03-23) is too new for a 2-week ship.
- **esbuild `^0.25`** — bundles `src/extension.ts` → `dist/extension.cjs`. Must tree-shake `@discordjs/rest`/`undici` transitives to stay under 500 KB.
- **Vitest `^3.2.4`** — pure-core tests, no `vscode` dep. Vitest 4.1.4 published 2026-04-09 — skip.
- **Node 22.19.17 (Active LTS)** — pin exactly in CI, matches VS Code Electron runtime.
- **`@vscode/vsce@^3.7.1` + `ovsx@^0.10.10`** — publish to Marketplace + OpenVSX on tag push.
- **`@types/vscode@^1.93.0`** — Shell Integration API stabilized in 1.93. Do not raise the floor.

### Expected Features

See `.planning/research/FEATURES.md` for full competitor matrix + issue-tracker citations (vscord #205/#273/#286/#324/#362/#415, discord-vscode #1922/#1825, etc.).

**Must have (table stakes — missing any produces a week-one issue):**
- RPC exponential backoff reconnect (5→60s) with 5s cooldown guard
- `clearActivity(process.pid)` on deactivate (never `setActivity(null)` — ghost presences)
- pid-scoped activity for multi-window isolation
- Idle handling with explicit IDLE copy (not blank)
- Privacy ignore lists (workspaces/repos/orgs/gitHosts) — match = full silence, not partial redact
- Per-field privacy toggles (show | hide | hash)
- 2s leading+trailing throttle on `setActivity`
- Live config reload via `onDidChangeConfiguration`
- Git branch via `vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)` (no new dep)
- Remote SSH / WSL stability — Shell Integration works over remote; document explicitly
- Marketplace compliance (zero proposed APIs, zero `any` casts)
- OpenVSX publish (Cursor/VSCodium/Windsurf native install)

**Should have (the moat):**
- Tiered terminal detection: companion lockfile > Shell Integration > fs-watch > polling, with per-terminal precedence dedup
- Multi-agent regex (claude/aider/codex/gemini/opencode) + `detect.customPatterns`
- Claude Code companion plugin (`SessionStart`/`SessionEnd` → `~/.claude/agent-mode-discord.lock`)
- Bundled default Discord Client ID (no BYO — Codex-Discord's UX killer)
- Two-clock animator (rotation 20s + frame 2s) with Fisher-Yates no-repeat invariant
- `goblin` pack only for v0.1 (default/professional cut per PROJECT.md decision)
- ≤ 20 configuration keys (vs vscord's 160)
- Time-of-day copy pools

**Defer (v0.2+):**
- Default + Professional packs (trigger: ≥3 community requests)
- Agent telemetry bridge (model/cost/burn rate/context %) — reserved slot
- OpenCode companion plugin
- Per-agent icons + copy sub-pools for aider/codex/gemini/opencode
- Cline / Roo Code detection
- Structural JSONL parsing (never, unless Anthropic publishes stable schema)

**Explicit non-goals:**
- Bidirectional control (Claude Code Channels' space)
- Mobile / web Discord / Codespaces (Discord RPC is local IPC only)
- Team / shared-activity / analytics
- Launch campaign (HN / X / subreddits / creators / Product Hunt)

### Architecture Approach

18 components, ~1870 LOC, every file < 200 lines. Pure core / adapter shell: 11 of 18 modules have zero `vscode` import and are directly testable in Vitest. Host-coupled code confined to `extension.ts`, `config.ts`, and `detectors/*`. See `.planning/research/ARCHITECTURE.md` for full diagram + component table.

**Major components:**
1. **RPC transport** — `rpc/client.ts` (@xhayper wrapper, backoff, pid-scoped) + `rpc/throttle.ts` (2s leading+trailing, pure)
2. **State core** — `state/machine.ts` (pure reducer, AGENT>CODING>IDLE) + `state/context.ts` (immutable snapshot)
3. **Detection layer** — `detectors/index.ts` (orchestrator + precedence dedup) + 6 tiered detectors (companion, shellIntegration, sessionFiles, polling, editor, git)
4. **Personality layer** — `presence/animator.ts` (two clocks) + `presence/packLoader.ts` **(split from animator — one deviation from PRD §9.4)** + `presence/templater.ts` + `presence/activityBuilder.ts`
5. **Single redaction point** — `privacy.ts` at `src/` root; `show | hide | hash` + ignore-list matcher; called from context builder, templater, and detectors/index
6. **Companion plugin** — separate artifact in `companion/claude-code-plugin/`, **not bundled into VSIX**; writes lockfile on `SessionStart`, removes on `SessionEnd`; extension only reads

**Build order (M0 → M2 → M1 → M3 → M4 → M5) — critical ordering insight:** RPC sink first, then pure-core modules, then detectors bolt on top. Every component has a working seam before the next one lands. No big-bang integration.

### Critical Pitfalls

Top 5 from `.planning/research/PITFALLS.md` (the doc covers more; these are the show-stoppers):

1. **Shell-integration async activation race** — user opens fresh terminal, types `claude`, first `onDidStartTerminalShellExecution` never fires because integration hadn't injected yet. Fix: always subscribe to `onDidChangeTerminalShellIntegration` as a second entry point; accept first-command miss and lean on tier-3 fs-watch backfill; don't downgrade a terminal to "no integration" for at least 2s. (Phase: M1.)
2. **Bundle size overrun from `@discordjs/rest` + `undici` transitives** — `@xhayper/discord-rpc` pulls REST/WS libs that can push VSIX past 500 KB if not tree-shaken. Fix: CI size-check starting at M0 (fails build on regression), audit with `esbuild --metafile`, last-resort `--external:@discordjs/rest` + pin RPC lib exactly. (Phase: M0 — must be online before anyone can over-commit.)
3. **Reconnect thrashing after Discord restart** — naive backoff retries immediately on every IPC error, hammering the socket and triggering Discord's own rate limiter. Fix: 5s wall-clock cooldown guard (no retry within 5s of last attempt) + exponential escalation 5→10→20→40→60s; replay last throttled payload on success. (Phase: M2.)
4. **Cursor-on-Windows shell-integration breakage** — documented platform failure; primary tier silently broken on ~15-25% of target users. Fix: tier-3 fs-watch is the mitigation path, companion plugin (M5) is the durable fix (lockfile is platform-agnostic); README caveat documents ~5s latency on this combo. (Phase: M1 fallback, M5 durable, M6b README.)
5. **Crash-path ghost presence** — extension host crash or SIGINT/SIGTERM without cleanup leaves activity live in Discord until next restart. Fix: SIGINT/SIGTERM handlers that call `client.user?.clearActivity(process.pid)` synchronously; always `clearActivity(pid)` on `activate()` too (belt-and-braces — clears any leftover from a previous crashed session); never `setActivity(null)`. (Phase: M0 + M2.)

## Implications for Roadmap

**Recommendation, not mandate — roadmapper makes final call.** User selected standard granularity (5-8 phases, 3-5 plans each) and `parallelization: true` (independent plans within a phase run concurrently).

Suggest **6 phases** aligned to PRD §12 milestones. Build order (M0 → M2 → M1 → M3 → M4 → M5) is load-bearing: RPC sink before detectors means every subsequent phase has a working seam to integrate against.

### Phase 1: Skeleton + RPC seam (PRD M0)
**Rationale:** Build the sink before the sources. Prove VSIX loads, activation <50ms, bundle <500KB, Discord IPC connects. Until `client.setActivity(hardcoded, pid)` works, nothing else matters.
**Delivers:** extension.ts stub + config.ts stub + `rpc/client.ts` connect + hardcoded activity + SIGINT/SIGTERM handlers + CI bundle-size check + `.vscodeignore` excluding `companion/**`.
**Avoids:** Pitfalls #2 (bundle size, check online from day one), #5 (ghost presence — cleanup handlers present before any state logic).
**[HUMAN] actions to flag for start of phase 1:** (a) Discord Developer Portal app creation for default Client ID, (b) OpenVSX namespace claim submission — variable lead time, must start here, not M7.
**Parallelizable:** skeleton, CI bundle-size check, Discord app creation — independent.

### Phase 2: Core pipeline (PRD M2)
**Rationale:** Pure-core modules first (vitest-testable without vscode), then plumb one real state (CODING) end-to-end through throttle + RPC with reconnect hardening.
**Delivers:** `rpc/throttle.ts` (2s leading+trailing) + `state/machine.ts` (pure reducer) + `state/context.ts` (immutable snapshot) + `privacy.ts` (single redaction point) + `rpc/client.ts` hardened (backoff + cooldown + pid) + `detectors/editor.ts` + `detectors/git.ts` + full vitest coverage of pure modules.
**Implements:** Components 3, 4, 5, 6, 7, 13, 14.
**Avoids:** Pitfall #3 (reconnect thrashing — cooldown guard shipped here).
**Parallelizable:** throttle, state machine, privacy, editor detector, git bridge — all independent pure-core modules; 5-way parallel viable.

### Phase 3: Agent detection (PRD M1)
**Rationale:** CODING pipeline exists; bolting on detectors just upgrades state to AGENT_ACTIVE via the state machine already wired. Regex unit-tested without vscode; integration tested in dev host.
**Delivers:** `detectors/shellIntegration.ts` (with ANSI strip + `onDidChangeTerminalShellIntegration`) + `detectors/index.ts` (precedence orchestrator) + `detectors/sessionFiles.ts` (mtime-only fs.watch) + `detectors/polling.ts` + `test/regex.test.ts` with Low-confidence payload fixtures.
**Implements:** Components 8, 10, 11, 12.
**Avoids:** Pitfalls #1 (async activation race — `onDidChangeTerminalShellIntegration` subscription), #4 (Cursor-on-Windows — fs-watch tier 3 online).
**Parallelizable:** shellIntegration, sessionFiles, polling — independent per-tier; orchestrator last (depends on the three).

### Phase 4: Personality + config + privacy (PRD M3 + M4)
**Rationale:** State + RPC are solid; replace hardcoded payload with animator-driven copy. Settings surface comes online here because all three (personality, config, privacy) hit the same `onDidChangeConfiguration` listener and same 20-key manifest edit — keeping them in one phase avoids churning `package.json` twice.
**Delivers:** `presence/packLoader.ts` (split from animator — schema validation + pool resolution) + `presence/animator.ts` (two clocks + no-repeat) + `presence/templater.ts` + `presence/activityBuilder.ts` + `goblin.json` pack + expanded `config.ts` + `contributes.configuration` ≤20 keys + live config reload.
**Implements:** Components 2, 15, 16, 17, 18.
**Parallelizable:** packLoader + animator + templater + activityBuilder are four independent pure-core modules; config expansion runs alongside.

### Phase 5: Companion plugin + OSS hygiene + assets + README (PRD M5 + M6a + M6b)
**Rationale:** All code features shipped; remaining work is non-code deliverables that run in parallel. M6a (OSS hygiene) and M6b (assets + README) are different disciplines from M5 (companion plugin), but all three can run concurrently — the companion plugin is a separate artifact, hygiene files don't touch `src/`, and README/assets are authoring work. One phase, three parallel sub-deliverables.
**Delivers:** `detectors/companion.ts` + `companion/claude-code-plugin/` artifact + LICENSE + CODE_OF_CONDUCT + SECURITY + CONTRIBUTING + PR/issue templates + CI workflow + branch protection + demo GIF + polished README (install / privacy FAQ / competitive positioning / troubleshooting for fish/nu/Cursor-on-Windows).
**Implements:** Component 9 + all non-code deliverables.
**Avoids:** Pitfall #4 (durable Cursor-on-Windows fix via lockfile); also README troubleshooting section closes the "no shell integration ever" user confusion case.
**Parallelizable:** three sub-deliverables run concurrently (plugin / hygiene / assets+README).

### Phase 6: Publish (PRD M7)
**Rationale:** Last phase. Non-code, gated by [HUMAN] credentials.
**Delivers:** GitHub Actions release workflow on tag push, `v0.1.0` tag, Marketplace listing, OpenVSX listing, `.vsix` attached to GitHub Release for manual install.
**[HUMAN] actions required:** VSCE_PAT (Azure DevOps Personal Access Token), OVSX_PAT (requires OpenVSX namespace claim already approved — flagged in phase 1).
**Parallelizable:** Marketplace + OpenVSX publish are independent once creds exist.

### Phase Ordering Rationale

- **RPC sink before detectors** — M0 ships a working `setActivity` call; every later component has a seam to integrate against, not a big-bang moment.
- **Pure-core before host-coupled** — state/throttle/privacy are testable in vitest without vscode, so they get built with fast feedback loops; the host-coupled detectors then emit framework-agnostic events into an already-proven reducer.
- **Personality after state** — animator needs a working state machine to pick the right sub-pool; building it earlier means mocking the state, which defeats the point.
- **Companion last among code** — the orchestrator already has the tier-0 precedence slot; plugin addition is purely additive, zero refactor.
- **Non-code parallelized** — phase 5 batches three independent authoring/config disciplines to avoid creating three near-empty phases.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (M0):** CI bundle-size check harness — no prior art in `@xhayper/discord-rpc` tree-shaking; esbuild metafile analysis + threshold enforcement needs a 30-min spike.
- **Phase 3 (M1):** Low-confidence `commandLine.value` ANSI/prompt-prefix fixtures — need real captures from Cursor-on-Windows, fish, Command Prompt. May require Windows VM time.
- **Phase 5 (M5):** Companion plugin `claude plugin install` UX — Claude Code plugin system docs are terse; plan a short spike to validate `SessionStart`/`SessionEnd` hook reliability + file-writing timing.

Phases with standard patterns (can skip research-phase):
- **Phase 2 (M2):** Throttle, state machine, privacy hash — textbook pure-core patterns.
- **Phase 4 (M3+M4):** Pack loader + templater are vanilla string/JSON work; config surface is standard `contributes.configuration`.
- **Phase 6 (M7):** `vsce publish` + `ovsx publish` — documented CLI workflows.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against npm registry (live 2026-04-12), head-of-main `vscode.d.ts` (Shell Integration stable, no proposed markers), Node release notes (22 Active LTS). |
| Features | HIGH | Grounded in live competitor issue trackers: vscord #205/#273/#286/#324/#326/#354/#362/#415, discord-vscode #1825/#1922/#1947/#1968; every "must have" maps to a real user-filed bug. |
| Architecture | HIGH | Verifies PRD §9.4 file layout; only one proposed split (`animator.ts` → `animator.ts` + `packLoader.ts`) for line-count discipline. 18 components, 1870 LOC, every file under 200. |
| Pitfalls | HIGH | PRD §14 + §18 completeness-checked against issue trackers and library source; 9 additional pitfalls surfaced beyond PRD, every one mapped to a milestone. |

**Overall confidence:** HIGH.

### Gaps to Address

- **`@xhayper/discord-rpc` transitive bundle size** — `@discordjs/rest` + `undici` can blow the 500 KB budget. CI bundle-size check must come online at **phase 1 (M0)**, not later, so no phase can over-commit without the guardrail catching it. If M2 bundle test fails, fallback path is pin-exact + `--external:@discordjs/rest` + (last resort) hand-rolled ~300 LOC IPC client — defer to v0.2 spike.
- **OpenVSX namespace claim lead time is variable.** Move to **phase 1 as a `[HUMAN]` action**, not M7. Marketplace publish via `vsce publish` can proceed standalone on tag push; OpenVSX publish gets a try/continue-on-error in the release workflow if the claim hasn't cleared.
- **Cursor-on-Windows fs-watch fallback needs real Windows testing** — no existing verifier evidence. Note as a verifier gap; plan a `[HUMAN]` validation step during phase 5 (README troubleshooting section depends on knowing the actual observed latency on this combo).

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` — version research + compatibility matrix (live npm queries 2026-04-12, `vscode.d.ts` head-of-main verification)
- `.planning/research/FEATURES.md` — competitor issue-tracker evidence, PRD §16 matrix extension
- `.planning/research/ARCHITECTURE.md` — 18-component map verified against PRD §9
- `.planning/research/PITFALLS.md` — PRD §14/§18 completeness check + 9 additions
- `.planning/PROJECT.md` — active requirements, out-of-scope, key decisions
- `discord-agent-presence-prd.md` — PRD §3, §7, §9, §12, §14, §16, §18, §19

### Secondary (MEDIUM confidence)
- Cursor forum threads on Windows shell-integration breakage (PRD §19)
- vscord / discord-vscode issue trackers (live fetch 2026-04-12)
- Codex-Discord-Rich-Presence `src/discord.rs` for backoff + cooldown pattern

---
*Research completed: 2026-04-12*
*Ready for roadmap: yes*
