# Stack Research

**Domain:** VS Code / Cursor extension — Discord Rich Presence with terminal-based AI agent detection
**Researched:** 2026-04-12
**Confidence:** HIGH on toolchain, HIGH on Discord RPC lib, HIGH on Shell Integration API, MEDIUM on TypeScript major-version choice, HIGH on Node LTS and publish tooling.

---

## Executive Summary (what moved since the PRD was written)

The PRD (drafted 2026-04-12) picked the right architecture. Version pins inside it are drifting:

| PRD pin | Actual latest (2026-04-12) | Action |
|---|---|---|
| `@xhayper/discord-rpc@^1.3.1` | `1.3.3` (published 2026-03-26, active) | Bump the caret floor to `^1.3.3`; keep option to pin exactly if bundle size blows past 500 KB. **Confidence: HIGH** |
| `@types/vscode@^1.93.0` | floor still correct; latest published is `1.115.0` | Keep `^1.93.0` as engine floor. **Confidence: HIGH** |
| `@types/node@^22` | latest 22.x is `22.19.17` (Node 22 is current Active LTS) | Keep `^22` caret; pin exactly in CI matrix. **Confidence: HIGH** |
| `typescript@^5.4` | `6.0.2` latest (released 2026-03-23). `5.9.3` is last 5.x. | **Recommend `^5.9.3` for ship window; TypeScript 6 is only ~3 weeks old.** Revisit post-v0.1. **Confidence: MEDIUM** |
| `esbuild@^0.24` | `0.28.0` latest | Bump to `^0.25` floor (first caret-compatible release). **Confidence: HIGH** |
| `vitest@^2` | `4.1.4` latest (released 2026-04-09) | **Bump to `^3.2.4`** (stable, mature, matches Node 22). Vitest 4 is 3 days old — too fresh for a 2-week ship. **Confidence: HIGH** |
| `@vscode/vsce@^3.7` | `3.7.1` (Node >=20) | Keep `^3.7.1`. **Confidence: HIGH** |
| `ovsx@^0.10` | `0.10.10` (Node >=20) | Keep `^0.10.10`. **Confidence: HIGH** |
| GH Actions Node runner | (unspecified) | **Pin `node-version: 22.19.17`** in CI workflows (Node 22 Active LTS, matches runtime engine). **Confidence: HIGH** |

**No category the PRD recommends has been deprecated, drifted, or replaced.** The PRD's architecture is sound. Only the version numbers need a refresh, and TypeScript 6 / Vitest 4 are too new to trust on a 2-week ship.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | `^5.9.3` | Source language | Last stable 5.x. TS 6.0.2 only landed 2026-03-23 and upstream tool compat (eslint, vitest, `@vscode/vsce`) is still catching up. For a 2-week ship, 5.9.3 is the safe, well-documented choice. Revisit TS 6 in v0.2. **Confidence: MEDIUM** (conservative call — 6 is fine but risky). |
| Node.js (runtime target for CI + dev) | `22.19.17` (Active LTS) | Runs esbuild, vitest, vsce, ovsx, and the GH Actions release workflow | Node 22 is the current Active LTS per the Node release schedule; Node 24 enters LTS in Oct 2026 but is still Current. All of `vitest@4` (engines `^20 || ^22 || >=24`), `@vscode/vsce@3.7` (`>=20`), and `ovsx@0.10` (`>=20`) accept Node 22. Pin exact version in GH Actions via `actions/setup-node@v4`. **Confidence: HIGH** |
| esbuild | `^0.25.0` | Bundles `src/extension.ts` → single CJS `dist/extension.cjs` | PRD mandate. esbuild is the VS Code team's own choice (see `microsoft/vscode-extension-samples`). Sub-100 ms cold-build, no plugin ecosystem bloat, tree-shakes `@discordjs/rest` to keep the VSIX under 500 KB. Latest is `0.28.0`; `^0.25` gives caret-compat without chasing weekly minor bumps. **Confidence: HIGH** |
| Vitest | `^3.2.4` | Unit tests for state machine, throttle, animator, detector regex, privacy | PRD mandate. Runs on Node 22, no need for a VS Code instance (`@vscode/test-electron` is out-of-scope — the extension separates pure logic from VS Code API glue precisely so vitest can cover everything). **Not Vitest 4** — released 2026-04-09, 3 days old. **Confidence: HIGH** |
| `@vscode/vsce` | `^3.7.1` | Packages + publishes VSIX to VS Code Marketplace | The only supported Marketplace CLI. Microsoft-owned. Last publish 2026-04-06, actively maintained. **Confidence: HIGH** |
| `ovsx` | `^0.10.10` | Publishes to Open VSX (Cursor / VSCodium / Windsurf) | The only supported Open VSX CLI (Eclipse Foundation). Last publish 2026-03-25. Required for primary target audience (the author is a Cursor user). **Confidence: HIGH** |
| pnpm | `^9.x` (recommend `^9.15` or `^10.x`) | Package manager | PRD mandate. Use `packageManager` field in `package.json` + Corepack so CI and local stay locked. Install via `pnpm/action-setup@v4` in GH Actions. **Confidence: HIGH** |

### Supporting Libraries (runtime)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@xhayper/discord-rpc` | `^1.3.3` | Discord RPC client over local IPC (Unix socket / Windows named pipe) | The **only** runtime dependency. Actively maintained (upstream: `Khaomi/discord-rpc` on GitHub; npm owner `xhayper`; 1.3.3 published 2026-03-26). Pulls in `@discordjs/rest`, `discord-api-types`, `ws`, `@vladfrangu/async_event_emitter`. esbuild tree-shakes what isn't used — verify bundle stays < 500 KB during M2; if not, pin exactly (`1.3.3`, no caret) and/or externalize. **Confidence: HIGH** |

**No other runtime dependency is permitted without explicit approval (PRD §8, §18, PROJECT.md constraints).** Everything else — templating, throttle, animator, regex stripping, SHA-1 hashing — is hand-rolled in `src/` using Node stdlib.

### Development Tools & Types

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| `@types/vscode` | `^1.93.0` | Types for stable VS Code API (Shell Integration stabilized in 1.93) | The caret range is load-bearing: it forbids using any newer API mistakenly added by the editor. Do not bump the floor without a reason. **Confidence: HIGH** |
| `@types/node` | `^22.19.17` | Types matching Node 22 LTS (used by `fs.watch`, `process.pid`, `net.Socket`, `crypto.createHash` for workspace hashing) | Pair with `@tsconfig/node22` base if desired. **Confidence: HIGH** |
| `@tsconfig/node22` (optional) | `^22.x` | Shared strict tsconfig base for Node 22 target | Optional — a hand-written `tsconfig.json` with `"target": "ES2022"`, `"module": "commonjs"`, `"lib": ["ES2022"]` is equivalent. **Confidence: MEDIUM** |
| eslint + `@typescript-eslint/*` | `^9.x` / `^8.x` | Lint | PRD doesn't mandate a linter but CI should run one. Recommend the minimal flat-config setup — a single `eslint.config.js`. **Confidence: MEDIUM** |
| Conventional Commits (tooling optional) | n/a | Commit style | PRD mandate. No enforcement tool required for v0.1 (skip commitlint/husky — runtime-dep discipline extends to dev-dep discipline). Author keeps the convention by hand. **Confidence: HIGH** |
| `actions/setup-node@v4` | `v4` | GH Actions Node setup | Standard. Pin `node-version: 22.19.17`. **Confidence: HIGH** |
| `pnpm/action-setup@v4` | `v4` | GH Actions pnpm setup | Standard. **Confidence: HIGH** |
| `softprops/action-gh-release@v2` (optional) | `v2` | Attach `.vsix` to the GitHub Release on tag | Nice-to-have: publish the .vsix as a GH Release asset so OpenVSX/Marketplace-averse users can sideload. **Confidence: MEDIUM** |

---

## Installation

```bash
# One-time: enable corepack so pnpm version is pinned
corepack enable
corepack prepare pnpm@9.15.0 --activate

# Runtime
pnpm add @xhayper/discord-rpc@^1.3.3

# Dev: types, toolchain, tests, publishing
pnpm add -D \
  @types/vscode@^1.93.0 \
  @types/node@^22.19.17 \
  typescript@^5.9.3 \
  esbuild@^0.25.0 \
  vitest@^3.2.4 \
  @vscode/vsce@^3.7.1 \
  ovsx@^0.10.10
```

Add to `package.json`:

```jsonc
{
  "engines": {
    "vscode": "^1.93.0",
    "node": ">=22.0.0"
  },
  "packageManager": "pnpm@9.15.0"
}
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@xhayper/discord-rpc` | `discord-rpc` (official, unmaintained) | **Never.** Five years dead. PRD §18 forbids it. Listed here only so the roadmapper can reject it on sight. |
| `@xhayper/discord-rpc` | Hand-rolled IPC over `net.createConnection()` to `\\?\pipe\discord-ipc-0` / `/tmp/discord-ipc-0` | Only if `@xhayper/discord-rpc` blows the 500 KB bundle budget even after esbuild tree-shakes it. Estimated 200-300 LOC of bespoke IPC + payload framing. Defer to v0.2 spike. |
| `esbuild` | Rollup | Never for this project — PRD forbids. Rollup gives better dead-code elimination for libraries, but a VS Code extension is an app; esbuild's speed wins. |
| `esbuild` | `tsup` | Valid alternative (wraps esbuild). Skipped to avoid an extra dep — the PRD already dictates `esbuild.mjs`. |
| `vitest` | `jest` | Never — PRD forbids. Jest requires babel for TS, adds 10× install weight, slower on Node 22. |
| `vitest` | `node:test` (built-in) | Valid for ultra-minimal projects, but its watch mode and ergonomics lag vitest. PRD mandates vitest. |
| `pnpm` | `npm` / `yarn` | Never — PRD forbids. pnpm's content-addressable store + strict hoisting matches the "one runtime dep" discipline. |
| TypeScript `^5.9.3` | TypeScript `^6.0.2` | If v0.1 slips past end-April, upgrade. TS 6 brings faster compiles + better inference, but ecosystem (eslint plugins, some types) lags by weeks typically. |
| Vitest `^3.2.4` | Vitest `^4.1.4` | After v0.1.0 ships. Vitest 4 is literally 3 days old as of 2026-04-12. |
| `@vscode/vsce` | VS Code Marketplace web upload | For emergency releases if the CLI breaks. Not a substitute. |
| `ovsx` | Manual upload via Open VSX web UI | Same as above. |
| Node 22 LTS | Node 24 (Current, enters LTS Oct 2026) | Only if a hard dep requires Node 24. None of ours do. Node 22 is the Active LTS and matches what VS Code ships its own Electron runtime against. |

---

## What NOT to Use

Mirrors PRD §18 + PROJECT.md constraints. This is a hard list — the roadmapper should treat each row as a merge blocker.

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `discord-rpc` (npm package by `discordjs`) | Five years unmaintained. No support for modern Discord RPC protocol features. PRD §18 forbid. | `@xhayper/discord-rpc@^1.3.3` |
| `(vscode as any).chat.*` / `(vscode as any).lm.*` / any `enabledApiProposals` cast | Proposed APIs. Marketplace publish rejects extensions that use them outside of Insiders. RikoAppDev's extension does this — that's the mistake we're explicitly not repeating. | Shell Integration API (`onDidStart/EndTerminalShellExecution`, `onDidChangeTerminalShellIntegration`) — all stable in 1.93+ as of `vscode.d.ts` head of main (2026-04-12 check: no `@proposed` markers). |
| webpack | PRD forbid. Slow cold builds, 200+ transitive deps, plugin ecosystem drift, poor tree-shaking of `@discordjs/rest`. | `esbuild@^0.25` |
| rollup | PRD forbid. Better for libraries, not apps. Config overhead isn't worth it for a single CJS output. | `esbuild@^0.25` |
| jest | PRD forbid. Slow, requires babel for TS on Node 22, 10× install weight. | `vitest@^3.2.4` |
| mocha | PRD forbid. Ancient, no TS-native mode. | `vitest@^3.2.4` |
| yarn | PRD forbid. Classic (v1) is unmaintained; Berry (v2+) is a different tool with PnP weirdness. | `pnpm@^9.15` |
| `npm install` (as the chosen manager) | PRD forbid. No workspace discipline, slower installs, no content-addressable cache. | `pnpm install` |
| activationEvents broader than `onStartupFinished` | PRD forbid. `"*"` and `onLanguage:*` balloon activation cost and violate the <50 ms target. Marketplace also downranks extensions with `"*"`. | `"activationEvents": ["onStartupFinished"]` only |
| Parsing `~/.claude/projects/*.jsonl` as JSON | PRD §FR-1.8 forbid. Undocumented Anthropic internal format — can break silently on any Claude Code release. | Use `fs.watch` for mtime + existence as a coarse signal; wrap every read in try/catch. |
| `setActivity(null)` to clear presence | PRD §FR-4.3 forbid. Leaves ghost presences on some Discord client versions (vscord learned this the hard way). | `client.user?.clearActivity(process.pid)` — always with explicit pid. |
| Writes outside `context.globalState` / `context.workspaceState` | PRD forbid. No `~/.config/agent-mode-discord/`. The companion plugin writes `~/.claude/agent-mode-discord.lock`; the **extension only reads**. | VS Code standard extension storage API. |
| Outbound HTTP (telemetry, update checks, asset CDN) | PRD forbid. Discord IPC is local-only (Unix socket / Windows named pipe). | Bundle all assets. No `fetch` / `undici` calls at runtime. |
| `engines.vscode: ^1.94.0` or later | Nothing added after 1.93 is load-bearing for us. Raising the floor excludes Marcus's friends who haven't updated. | `engines.vscode: ^1.93.0` |
| `@types/node@^24` | Node 24 is Current, not LTS (until Oct 2026). Mixing LTS runtime + Current types risks subtle API drift. | `@types/node@^22.19.17` |
| `typescript@^6.0.2` (for v0.1) | 3 weeks old. Eslint + some type packages still catching up. Safe after v0.1 ships. | `typescript@^5.9.3` |
| `vitest@^4.1.4` (for v0.1) | 3 days old. Wait one minor cycle. | `vitest@^3.2.4` |

---

## Stack Patterns by Variant

**If bundle-size budget (<500 KB VSIX) is blown during M2:**
- Pin `@xhayper/discord-rpc` exactly (drop the caret): `"@xhayper/discord-rpc": "1.3.3"`.
- Add esbuild `--external:@discordjs/rest` and verify the RPC lib doesn't need it at runtime (it pulls rest for REST-API features we don't use; the IPC-only code path should be reachable without it).
- Last resort: hand-roll the ~300 LOC IPC client directly against `net.createConnection()` + Discord's documented IPC payload format. Defer to v0.2 spike unless M2 bundle test fails.

**If Cursor's Open VSX listing is delayed (namespace claim blocked):**
- Ship to Marketplace via `vsce publish` first on tag push.
- Distribute `.vsix` as a GitHub Release asset (via `softprops/action-gh-release@v2`) so Cursor users can `Extensions → Install from VSIX…` manually.
- Revisit `ovsx publish` once the Eclipse Open VSX namespace claim email clears.

**If GitHub Actions Node 22 runner changes image default (e.g., apt pin slips):**
- Hard-pin `node-version: 22.19.17` in both `ci.yml` and `release.yml` (never `node-version: lts/*`, never `22.x`).
- Cache pnpm store keyed by `pnpm-lock.yaml` hash via `pnpm/action-setup@v4` + `actions/cache@v4`.

**If the Shell Integration API ships new stable surface post-1.93 that we want (none as of 2026-04-12):**
- Do **not** bump `engines.vscode` floor. Feature-detect at runtime: `if ('executeCommand' in shellIntegration) { ... }`.
- Keep the 1.93 floor as the compat promise.

---

## Version Compatibility Matrix

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@xhayper/discord-rpc@1.3.3` | `ws@^8.20.0`, `@discordjs/rest@^2.6.1`, `discord-api-types@^0.38.42`, `@vladfrangu/async_event_emitter@^2.4.7` | Transitive deps — esbuild bundles the IPC path, tree-shakes the rest. Validate actual bundle size at M2. |
| `typescript@5.9.3` | `esbuild@^0.25`, `vitest@^3.2.4`, `@types/vscode@^1.93.0`, `@types/node@^22.19.17` | No known issues. |
| `vitest@3.2.4` | `node@^20 \|\| ^22 \|\| >=24` | Node 22 LTS is fully supported. |
| `@vscode/vsce@3.7.1` | `node@>=20` | Node 22 LTS supported. Run via `pnpm exec vsce` in CI. |
| `ovsx@0.10.10` | `node@>=20` | Same as vsce. |
| `@types/vscode@1.93.x` | `engines.vscode: ^1.93.0` in consumer `package.json` | Types version must match the declared `engines.vscode` lower bound, not the upper bound. |
| VS Code `^1.93.0` | Cursor latest, VSCodium `^1.93.0`, Windsurf latest | Per PRD §8. Cursor on Windows: best-effort (shell integration known-flaky; fs-watch tier 3 covers it). |
| Node 22 LTS | esbuild/vitest/vsce/ovsx/tsc all `>=20` | Clean intersection. |

---

## VS Code Shell Integration API — stability re-verification (as of 2026-04-12)

Direct inspection of `microsoft/vscode` main branch `src/vscode-dts/vscode.d.ts` (not `vscode.proposed.*.d.ts`):

- `TerminalShellIntegration` interface — stable, line ~7828
- `TerminalShellExecution` interface — stable
- `TerminalShellExecutionCommandLine` interface — stable, includes `readonly value: string`, `readonly confidence: TerminalShellExecutionCommandLineConfidence`, `readonly isTrusted: boolean`
- `TerminalShellExecutionCommandLineConfidence` enum — stable: `Low = 0 | Medium = 1 | High = 2`
- `window.onDidChangeTerminalShellIntegration` — stable event
- `window.onDidStartTerminalShellExecution` — stable event
- `window.onDidEndTerminalShellExecution` — stable event
- `Terminal.shellIntegration: TerminalShellIntegration | undefined` — stable

**No proposed markers anywhere in the shell integration block.** PRD's `engines.vscode: ^1.93.0` is correct. No newer stable-API additions after 1.93 are load-bearing for our use case. **Confidence: HIGH.**

---

## Sources

- npm registry (live queries 2026-04-12):
  - `@xhayper/discord-rpc` → `1.3.3`, deps: `@discordjs/rest ^2.6.1`, `discord-api-types ^0.38.42`, `ws ^8.20.0`, published 2026-03-26
  - `@vscode/vsce` → `3.7.1`, engines `node >= 20`, published 2026-04-06
  - `ovsx` → `0.10.10`, engines `node >= 20`, published 2026-03-25
  - `typescript` → `6.0.2` latest, `5.9.3` last 5.x (2025-09-30), `5.8.3` (2025-04-05)
  - `esbuild` → `0.28.0`
  - `vitest` → `4.1.4` (2026-04-09), `3.2.4` stable, engines `node ^20 || ^22 || >=24`
  - `@types/vscode` → `1.115.0`, `1.93.0` exists as a distinct version
  - `@types/node` → `22.19.17` latest 22.x, `25.6.0` overall latest
- `microsoft/vscode` head-of-main `src/vscode-dts/vscode.d.ts` lines 7700–8142, 11190–11215 — Shell Integration API stable, no proposed markers
- Node.js release schedule (nodejs.org/en/about/previous-releases, endoflife.date/nodejs): Node 22 = Active LTS through Oct 2026 (then Maintenance through April 2027); Node 24 = Current, LTS promotion Oct 2026
- VS Code 1.93 release notes (https://code.visualstudio.com/updates/v1_93) — Shell Integration API stabilization (Aug 2024)
- GitHub `Khaomi/discord-rpc` — confirmed as upstream for `@xhayper/discord-rpc` (author: `xhayper`, repo: `xhayper/discord-rpc`; upstream maintenance continues under the Khaomi fork as noted in PRD §19 and PROJECT.md)
- PRD `discord-agent-presence-prd.md` §8 (NFRs), §9.1 (stack), §9.4 (file layout), §18 (guardrails), §19 (references)
- PROJECT.md constraints (runtime dep allowlist, toolchain, file size discipline)

---

*Stack research for: VS Code / Cursor extension — Discord Rich Presence with terminal-based AI agent detection*
*Researched: 2026-04-12*
*Prescriptive for: roadmapper planning v0.1.0 across M0 → M7 (PRD §12)*
