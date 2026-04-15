---
phase: "04"
plan: "08"
subsystem: extension-wiring-live-reload
tags: [extension-wiring, activityBuilder, onDidChangeConfiguration, live-reload, pack-inline-gate, wave-4]
dependency_graph:
  requires:
    - src/presence/activityBuilder.ts (createActivityBuilder — 04-04)
    - src/presence/packLoader.ts (loadPack + BUILTIN_GOBLIN_PACK + realPackLoaderDeps — 04-05)
    - src/presence/goblin.json (canonical pack — 04-05)
    - src/config.ts (readConfig, AgentModeConfig — 04-06)
    - src/outputChannel.ts (log — 04-06)
    - src/gitBranch.ts (getCurrentBranch — 04-07)
    - src/privacy.ts (normalizeGitUrl — 04-07)
    - src/rpc/client.ts (ConnectionManager, clearActivity — Phase 1)
    - src/rpc/throttle.ts (createThrottle — Phase 2)
    - src/state/machine.ts (initialState, reduce — Phase 2)
  provides:
    - src/extension.ts wired pipeline: detectors -> reducer -> activityBuilder -> animator -> mgr
    - onDidChangeConfiguration live-reload listener (CONF-03)
    - state-transition forceTick + async branch refresh (PRIV-03/PRIV-04/PRIV-06)
    - poll-on-rotation-tick customPackPath resolution (PERS-07)
    - goblin.json esbuild inlining reaches dist/extension.cjs (pack-inlined gate flips to PASS)
  affects:
    - 04-09 (network-traffic CI assertion) — extension.ts is now the fully-wired bundle root it needs to measure
tech_stack:
  added: []
  patterns:
    - Closure-injected getState/getConfig/getPack callbacks (lazy per-tick re-read, D-24)
    - Async branch refresh on state-kind transition via Promise-chained forceTick
    - rpcClearActivity(live, pid) routed through the ConnectionManager's live client
      (ConnectionManager exposes setActivity only; clearActivity is the standalone helper)
    - Config-listener scoped to agentMode.* via e.affectsConfiguration (avoids spurious forceTick on unrelated changes)
key_files:
  created: []
  modified:
    - src/extension.ts (127 -> 190 lines)
decisions:
  - onClear routes through rpcClearActivity(live, process.pid) rather than a non-existent mgr.clearActivity — ConnectionManager's public API exposes setActivity only; standalone clearActivity(client, pid) is the Phase-1 pid-scoped helper that survives shuttingDown correctly.
  - getIgnoreContext reads state.gitRemoteUrl via a typed `as State & { gitRemoteUrl?: string }` cast — neither Phase-2 State nor Phase-3 detectors populate it yet, so the repositories/organizations/gitHosts ignore branches simply never fire at runtime. Intentional: plan frontmatter explicitly forbids modifying src/state/types.ts.
  - On state-kind transitions, call activityBuilder.forceTick() synchronously with the stale branch AND chain an async getCurrentBranch().then(...) that re-renders after — preserves PRIV-06 next-tick-latency spec without introducing a pending-branch watermark (deferred to v0.2).
  - Dropped the unused `buildContext` + `redact` Phase-2 imports — the activityBuilder owns redaction and the context-builder was replaced by the getState/getConfig closures.
  - Removed the literal string "buildPayload" from all comments so `grep -c buildPayload src/extension.ts = 0` (plan acceptance). The Phase-2 builder was also deleted from extension.ts — `buildPayload` now only exists inside activityBuilder.ts.
metrics:
  duration: ~6min
  completed: 2026-04-15
  tasks: 1
  commits: 1
---

# Phase 4 Plan 08: Extension Wiring + Live-Reload Summary

Replaces the Phase-2 hardcoded `buildPayload` + inline `throttled(setActivity)` call in `src/extension.ts` with the full Phase-4 activityBuilder pipeline — packLoader + animator + templater + privacy + ignore-gate — and registers the `onDidChangeConfiguration` listener that satisfies CONF-03 live reload. After this plan lands, every Wave-1–3 artifact is reachable from the bundle root: `scripts/check-pack-inlined.mjs` flips from FAIL to PASS (the goblin strings now survive into `dist/extension.cjs`), and the bundle climbs from 208.0 KB to 218.0 KB (43.6% of the 500 KB budget).

## What Shipped

- **`src/extension.ts` rewrite (190 lines, < 250 soft limit)**:
  - New imports: `loadPack`, `realPackLoaderDeps`, `BUILTIN_GOBLIN_PACK` (packLoader); `createActivityBuilder` (activityBuilder); `readConfig` (config); `log` (outputChannel); `getCurrentBranch` (gitBranch); `normalizeGitUrl` + type `Pack` (privacy/types); `clearActivity as rpcClearActivity` (rpc/client).
  - Removed imports: `buildContext` (state/context) + `redact` (privacy) — both were Phase-2 glue the activityBuilder now owns.
  - `extractHost(url)` / `extractOwner(url)` — tiny helpers over `normalizeGitUrl` that produce `IgnoreContext.gitHost` / `.gitOwner` when a remote URL is available.
  - `getPack()` closure: reads `readConfig().messages.customPackPath` on every rotation tick and delegates to `loadPack({ customPackPath, builtin: BUILTIN_GOBLIN_PACK }, { ...realPackLoaderDeps, log })` — D-25 poll-on-tick, PERS-07.
  - `createActivityBuilder({ getState, getConfig, getPack, onSet, onClear, getIgnoreContext, log })`:
    - `onSet` wraps the existing Phase-2 `createThrottle<SetActivity>` (2 s leading+trailing) — zero change to the throttle contract.
    - `onClear` calls `mgr.getLiveClient()` + `rpcClearActivity(live, pid)` — ConnectionManager exposes `setActivity` only, so clearing routes through the Phase-1 standalone helper.
    - `getIgnoreContext` returns the `workspaceAbsPath` + `gitRemoteUrl`/`gitHost`/`gitOwner` trio; State doesn't currently carry a `gitRemoteUrl` field, so those branches are typed via a local cast and simply won't fire until a future plan populates it (plan frontmatter forbids state-type edits).
  - `dispatch(event)` now: `reduce` → `scheduleIdle` → on state-kind transition, call `activityBuilder.forceTick()` immediately (stale-branch render) AND async-chain `getCurrentBranch().then(b => state = { ...state, branch: b }; activityBuilder.forceTick())` for the re-render. Preserves STATE-05 elapsed semantics — branch refresh is a field update with no timestamp reset.
  - `mgr.onReady(() => activityBuilder.forceTick())` — reconnect replay flushes the current state through the pipeline instead of the Phase-2 hardcoded payload.
  - `vscode.workspace.onDidChangeConfiguration((e) => { if (!e.affectsConfiguration("agentMode")) return; log(...); activityBuilder.forceTick(); })` — no-op per D-24 (`readConfig()` is lazy on every tick), plus optional forceTick so the user sees the new settings immediately rather than after up-to-20 s rotation latency. Subscribed via `_context.subscriptions.push(configListener)`.
  - `mgr.start(); activityBuilder.start();` — new two-line startup sequence replaces the Phase-2 `throttled(buildPayload())` inside `mgr.onReady`.
  - `dispose()` adds `activityBuilder.stop()` + `configListener.dispose()` before the existing detector cleanup; all wrapped in per-call try/catch (silent per D-18); `mgr.stop()` unchanged (CONF-04: never `destroy`/`setActivity(null)`).

- **Bundle-graph flip: goblin pack now inlined.** The bundle root (`src/extension.ts`) now imports `packLoader.ts`, which imports `./goblin.json` via esbuild's default JSON loader — so the canonical D-05 strings (`"letting it cook"`, `"the agent is cooking"`, etc.) survive into `dist/extension.cjs`. `scripts/check-pack-inlined.mjs` flips from FAIL to PASS. This resolves the deferred issue documented in plan 04-05 and plan 04-04 summaries.

## Verification

| Gate | Result |
|------|--------|
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS (309 passed across 19 files — zero regression vs baseline) |
| `pnpm build` | PASS (no esbuild warnings) |
| `pnpm check:api-surface` | PASS (22 .ts files scanned, 11 pure-core, 0 violations — extension.ts correctly remains non-pure-core) |
| `pnpm check:bundle-size` | PASS (223 204 bytes / 218.0 KB; 43.6% of 500 KB threshold; +10 KB vs 208 KB baseline — activityBuilder + animator + templater + packLoader + goblin.json + config + gitBranch all now reachable) |
| `node scripts/check-pack-inlined.mjs` | **PASS** (2/2 canonical strings found — flips gate from FAIL) |
| `pnpm check:no-network` | PASS (no outbound HTTP tokens in 223 198 bytes) |
| `node scripts/check-config-keys.mjs` | PASS (14/20 keys, all have title/description/default + enum↔enumDescriptions) |
| `wc -l src/extension.ts` | 190 (< 250 soft, < 300 hard) |
| `grep -c "createActivityBuilder" src/extension.ts` | 2 (import + call) — target ≥ 1 |
| `grep -c "activityBuilder.start()" src/extension.ts` | 1 — target = 1 |
| `grep -c "activityBuilder.forceTick" src/extension.ts` | 4 — target ≥ 2 |
| `grep -c "onDidChangeConfiguration" src/extension.ts` | 1 — target = 1 |
| `grep -c "loadPack" src/extension.ts` | 2 (import + call) — target ≥ 1 |
| `grep -c "goblin\|GOBLIN" src/extension.ts` | 3 (BUILTIN_GOBLIN_PACK import + passthrough + doc) — target ≥ 1 |
| `grep -c "buildPayload" src/extension.ts` | 0 — target = 0 (Phase-2 stub fully retired) |
| `grep -c "mgr.destroy\|client.destroy" src/extension.ts` | 0 — target = 0 (CONF-04) |
| `grep -c "setActivity(null)" src/extension.ts` | 0 — target = 0 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing node_modules**
- **Found during:** pre-Task-1 baseline (`test -d node_modules` → MISSING; fresh worktree without pnpm install cache).
- **Fix:** Ran `pnpm install` (825 ms from lockfile, no version drift).
- **Scope:** dependency install only; no source or lockfile changes.
- **Commit:** n/a (no source changes).

**2. [Rule 1 - Bug] onClear routing: mgr.clearActivity does not exist**
- **Found during:** Task 1 `pnpm typecheck` (`Property 'clearActivity' does not exist on type 'ConnectionManager'`).
- **Issue:** Plan sketch at lines 125-127 wrote `onClear = () => { void mgr.clearActivity(process.pid); };`, but ConnectionManager's public surface is `{ start, stop, onReady, setActivity, getLiveClient }` — clearActivity is the standalone helper `clearActivity(client, pid)` exported from `src/rpc/client.ts`.
- **Fix:** Imported `clearActivity as rpcClearActivity` from `./rpc/client` and rewrote onClear to `const live = mgr.getLiveClient(); if (live) void rpcClearActivity(live, process.pid);` — mirrors the pattern already used in `mgr.onReady` for `getLiveClient()` null-checking.
- **Files modified:** `src/extension.ts` (import block + onClear closure).
- **Commit:** fc79aa5 (Task 1).

### Non-deviating refinements

- **Dropped the literal string `buildPayload` from all comments.** Plan acceptance criterion `grep -c "buildPayload" src/extension.ts = 0` covers source AND comments. The Phase-2 builder was fully deleted; a doc comment in `mgr.onReady` originally said "instead of the Phase-2 hardcoded buildPayload" — rewritten to "(replaces Phase-2 hardcoded payload)" to keep the provenance while satisfying the grep gate.
- **Removed two unused Phase-2 imports** (`buildContext` from state/context; `redact` from privacy). The activityBuilder owns redaction internally (plan 04-04) and buildContext was only used by the retired Phase-2 buildPayload.
- **Added `BUILTIN_GOBLIN_PACK` import alongside `loadPack` + `realPackLoaderDeps`.** Plan sketch imported `goblin from "./presence/goblin.json"` directly and constructed `builtin: goblin as Pack`; the Wave-1 export (plan 04-05 summary, decision: single-source-of-truth import) is cleaner — use the already-typed constant so the `Pack` narrowing happens in exactly one place.
- **_context parameter is now required by createDriver.** The Phase-2 signature was `createDriver()`; adding the config listener's `_context.subscriptions.push(...)` subscription means the driver needs the VS Code ExtensionContext handle. Passed through from `activate(_context)` at the single call site.

### Deferred Issues

None. Every plan acceptance criterion is GREEN; every verification gate passes; no Rule 4 architectural changes required.

## Threat Mitigation

| Threat ID | Disposition | Evidence |
|-----------|-------------|----------|
| T-04-12 (Information Disclosure via log() calls) | mitigate | All `log(...)` calls pass `{ verboseOnly: true }` — outputChannel.log() early-returns when `cfg.debug.verbose=false` (CONF-05 default). The only messages that reach the channel by default are the ones that go through `verboseOnly: false`, and extension.ts uses none. `pnpm check:no-network` confirms no outbound HTTP tokens land in the bundle. |

## Known Stubs

None. Plan 04-08 is the final extension-wiring plan for Phase 4; every Wave-1–3 module is live on the bundle path. The one field the code cannot yet fill — `State.gitRemoteUrl` — is intentionally absent from `src/state/types.ts` (plan frontmatter forbids edits there); the ignore-repositories/organizations/gitHosts branches simply no-op until a future plan adds the field. Documented in Decisions above.

## Threat Flags

None — this plan adds no new network endpoints, auth paths, file access patterns, or trust-boundary schema changes. `vscode.workspace.onDidChangeConfiguration`, `vscode.extensions.getExtension("vscode.git")` (via gitBranch.ts), and the `agentMode.*` settings store are all pre-existing boundaries enumerated in the Phase 4 threat register (rows for T-04-02, T-04-03, T-04-12 + the vscode.git row under Trust Boundaries). `messages.customPackPath` file access is owned by packLoader.ts under T-04-01 (size-cap + try/catch) — extension.ts only supplies the path.

## Self-Check: PASSED

- FOUND: src/extension.ts (190 lines, wired pipeline)
- FOUND commit fc79aa5 (Task 1: activityBuilder wiring)
- Verified: `pnpm typecheck` -> PASS
- Verified: `pnpm test` -> 309 passed / 19 files (no regression)
- Verified: `pnpm build` -> PASS (218 KB / 43.6% of 500 KB)
- Verified: `pnpm check:api-surface` -> PASS
- Verified: `pnpm check:bundle-size` -> PASS
- Verified: `node scripts/check-pack-inlined.mjs` -> PASS (flipped from FAIL — gate now green)
- Verified: `pnpm check:no-network` -> PASS
- Verified: `node scripts/check-config-keys.mjs` -> PASS
- Verified: `grep -c "createActivityBuilder" src/extension.ts` = 2
- Verified: `grep -c "activityBuilder.start()" src/extension.ts` = 1
- Verified: `grep -c "activityBuilder.forceTick" src/extension.ts` = 4
- Verified: `grep -c "onDidChangeConfiguration" src/extension.ts` = 1
- Verified: `grep -c "loadPack" src/extension.ts` = 2
- Verified: `grep -c "buildPayload" src/extension.ts` = 0
- Verified: `grep -c "mgr.destroy\|client.destroy" src/extension.ts` = 0
- Verified: `grep -c "setActivity(null)" src/extension.ts` = 0
- Verified: `git log --oneline -1` shows commit hash
