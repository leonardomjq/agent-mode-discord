---
phase: 01-skeleton-rpc-seam
plan: 02
subsystem: rpc-seam
tags: [discord-rpc, xhayper, ipc, signal-handlers, vscode-extension, esbuild]

requires:
  - pnpm scaffold from plan 01-01 (package.json, esbuild.mjs, tsconfig.json, src/extension.ts stub)
  - "@xhayper/discord-rpc@1.3.3 installed as sole runtime dep"
provides:
  - src/rpc/client.ts injectable RPC adapter (connect, helloWorldAnnounce, clearActivity, destroy, registerSignalHandlers)
  - Fully-wired src/extension.ts activate/deactivate with fire-and-forget connect
  - SIGINT/SIGTERM signal handler lifecycle (register on connect, unregister on shutdown)
  - Belt-and-braces clearActivity(pid) BEFORE setActivity (SKEL-08)
  - Silent RPC failure mode (every Discord call wrapped in try/catch)
  - Bundle-shim pattern for websocket-transport deps (undici / ws / @discordjs/rest aliased to throwing Proxy)
affects: [01-03, 01-04, 01-05, 02-04]

tech-stack:
  added: []
  patterns:
    - "Injectable RpcDeps pattern: createClient factory + pid — enables vitest vi.mock in plan 01-04 without a real Discord socket"
    - "Fire-and-forget connect in activate(): void connectAndAnnounce() — activation returns before login resolves (SKEL-03)"
    - "Module-level liveClient + unregisterSignalHandlers state: only mutable state in the module, reset on shutdown to avoid F5-reload leaks"
    - "Signal-handler lifecycle: registerSignalHandlers returns an unregister fn that deactivate() calls — prevents double-registration on extension reload"
    - "esbuild alias to empty-Proxy shim: strips unused websocket-transport modules from the bundle while preserving IPC-only runtime semantics"

key-files:
  created:
    - src/rpc/client.ts
  modified:
    - src/extension.ts
    - esbuild.mjs
    - .gitignore
    - .vscodeignore

key-decisions:
  - "Shim undici/ws/@discordjs/rest via esbuild alias with a throwing Proxy — RESEARCH §1 documented mitigation for the 500 KB SKEL-02 guardrail when @xhayper/discord-rpc is added"
  - "DEFAULT_CLIENT_ID uses process.env.AGENT_MODE_CLIENT_ID ?? \"REPLACE_ME_IN_PHASE_1_HANDOFF\" — placeholder is a one-line edit for the [HUMAN] handoff in plan 01-05"
  - "Signal handlers registered ONLY after successful connect — nothing to clean up until the client is live"
  - "src/rpc/client.ts never imports vscode — keeps the module pure-Node testable (plan 01-04 relies on this boundary)"
  - "Connect failure is logged via console.debug only — output channel + debug.verbose gating lands in Phase 4 per CONF-05/RPC-05"

patterns-established:
  - "RPC adapter interface: connect() / helloWorldAnnounce() / clearActivity() / destroy() / registerSignalHandlers() — plan 01-04 mocks this exact surface; plan 02-04 adds backoff/throttle on top without breaking the contract"
  - "Silent failure contract: every Discord API call wrapped in try/catch with empty catch body (comment-only) — PRD §8 mandate"
  - "Never setActivity with a null payload — PRD §18 hard rule; clearActivity(pid) is the only clear path"

requirements-completed: [SKEL-06, SKEL-07, SKEL-08]

duration: ~4min
completed: 2026-04-12
---

# Phase 01 Plan 02: Discord RPC seam — hello world + SIGINT/SIGTERM cleanup Summary

**Added the v0 RPC adapter (src/rpc/client.ts) and wired src/extension.ts activate/deactivate to it — on connect the extension publishes a hardcoded `hello world` activity, on shutdown it calls clearActivity(pid) before destroy, and SIGINT/SIGTERM handlers run the same cleanup; belt-and-braces clearActivity runs BEFORE any setActivity so SKEL-08 is satisfied. Bundle stays at 196 KB via esbuild alias shim for websocket-transport deps.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-12T23:08:51Z
- **Completed:** 2026-04-12T23:12:47Z
- **Tasks:** 2
- **Files modified:** 1 created + 4 modified

## Accomplishments

- **SKEL-06 path ready:** `helloWorldAnnounce(client, pid)` publishes `{ details: "hello world", startTimestamp: Date.now() }` after login resolves. Manual Dev Host verification (F5 → Discord sidebar) lands in plan 01-05.
- **SKEL-07 satisfied:** `registerSignalHandlers(client, pid)` subscribes via `process.once("SIGINT"/"SIGTERM", handler)` and returns an unregister fn that `deactivate()` calls. Handler runs `clearActivity(pid)` then `destroy()` — no ghost presences on kill.
- **SKEL-08 satisfied:** `helloWorldAnnounce` calls `client.user?.clearActivity(pid)` BEFORE `client.user?.setActivity({...})`. Belt-and-braces on activate clears ghosts from a prior crashed session before publishing the new payload.
- **Fire-and-forget activation:** `activate()` uses `void connectAndAnnounce()` — returns synchronously without awaiting login. Preserves SKEL-03 <50 ms activation target even when Discord desktop is absent.
- **Silent failure mode:** every Discord API call wrapped in try/catch with empty body. Connect failure logs once at `console.debug` level; no toasts, no editor blocking. Matches PRD §8 exactly.
- **Zero proposed API usage, zero `(vscode as any)` casts, zero `setActivity(null)` — all three SKEL-05 / PRD §18 invariants hold across the whole `src/` tree.
- **Bundle size:** `dist/extension.cjs` = **201,255 bytes (196.5 KB)** — 39% of the 500 KB SKEL-02 threshold. Headroom for Phase 2-4 additions.

## Task Commits

1. **Task 1: Implement src/rpc/client.ts — injectable RPC adapter with belt-and-braces cleanup** — `4730210` (feat)
2. **Task 2: Wire src/extension.ts activate/deactivate to the RPC adapter (+ bundle-size shim)** — `2069258` (feat)

## Files Created/Modified

- `src/rpc/client.ts` (new, 99 lines) — Exports `DEFAULT_CLIENT_ID`, `RpcDeps`, `defaultDeps`, `connect()`, `helloWorldAnnounce()`, `clearActivity()`, `destroy()`, `registerSignalHandlers()`. No vscode import — pure-Node testable.
- `src/extension.ts` (modified) — Full activate/deactivate wiring. Fire-and-forget connect, module-level `liveClient` + `unregisterSignalHandlers` state, silent failure via `console.debug`.
- `esbuild.mjs` (modified) — Auto-generates a throwing-Proxy shim at `build-shims/empty.cjs`; aliases `undici`, `ws`, `@discordjs/rest` to the shim so the websocket-transport code path is stripped from the bundle.
- `.gitignore` (modified) — Added `build-shims/` so the generated shim is not committed.
- `.vscodeignore` (modified) — Added `build-shims/**` so the shim doesn't ship in the VSIX.

## Exact Resolved Dependency Version

- `@xhayper/discord-rpc@1.3.3` (already installed in plan 01-01; no new deps)

## Bundle Size (Proof)

`dist/extension.cjs`: **201,255 bytes (196.5 KB)** — well under the 500 KB SKEL-02 guardrail.

Without the websocket-transport shim, the bundle would be 695 KB (over threshold). The shim pattern is documented inline in `esbuild.mjs` and referenced in RESEARCH.md §1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Bundle exceeded 500 KB after adding @xhayper/discord-rpc**

- **Found during:** Task 2 verification (`pnpm build` produced a 695 KB bundle, failing the acceptance criterion `bundle < 500 KB`).
- **Issue:** `@xhayper/discord-rpc` statically requires `@discordjs/rest` (via `Client.js`) and `ws` / `undici` (via `WebSocket.js` transport). Even though we only use the IPC transport at runtime, esbuild pulls all three into the bundle at build time, blowing ~500 KB.
- **Fix:** Added an `alias` block to `esbuild.mjs` mapping `undici` / `ws` / `@discordjs/rest` to an auto-generated empty-Proxy shim (`build-shims/empty.cjs`). The Proxy throws on property access, so if the IPC code path ever reached these modules the error would be caught by the try/catch wrappers in `src/rpc/client.ts` (silent failure mode). Verified the bundled `dist/extension.cjs` loads cleanly via `node -e "require('./dist/extension.cjs')"` — exports `activate` and `deactivate` as expected.
- **Files modified:** `esbuild.mjs` (alias + shim generation), `.gitignore` (exclude `build-shims/`), `.vscodeignore` (exclude `build-shims/**` from VSIX).
- **Verification:** Bundle dropped from 695 KB to 196.5 KB. `require()` of the bundle succeeds. No new runtime deps. No new runtime code paths.
- **Committed in:** `2069258` (Task 2 commit).
- **Rationale link:** RESEARCH.md §1 explicitly calls out this mitigation: *"consider marking `undici` as external if the Node runtime already provides it (Node 18+ ships undici internally)"*. Using `alias` instead of `external` produces a self-contained bundle (no missing-module errors when VS Code loads it), which is strictly stronger.

### Scope-boundary note

`pnpm check:api-surface` script does not yet exist — it lands in plan 01-03 per the plan's own verification section: *"the check:api-surface script is installed in plan 01-03; pre-01-03 this task runs via Task 2's inline grep checks"*. Out-of-scope for this plan. The inline grep checks (no `setActivity(null)`, no `(vscode as any)`, no vscode import in client.ts) all pass.

---

**Total deviations:** 1 auto-fixed (1 blocking, documented in RESEARCH)
**Impact on plan:** Necessary to hit SKEL-02 after introducing the real RPC dep. Pattern is documented in the esbuild config for future reviewers.

## Verification Evidence

| Check | Result |
|-------|--------|
| `pnpm build` exits 0 | PASS |
| `pnpm typecheck` exits 0 | PASS |
| `dist/extension.cjs` < 500 KB | PASS (196.5 KB / 39% of threshold) |
| `grep -c "setActivity(null)" src/` | 0 |
| `grep -c "vscode as any" src/` | 0 |
| `grep -c "process.once" src/rpc/client.ts` | 2 (SIGINT + SIGTERM) |
| `grep -c "clearActivity" src/rpc/client.ts` | 6 |
| `grep -c "helloWorldAnnounce" src/rpc/client.ts` | 1 (export) |
| `grep -c "registerSignalHandlers" src/rpc/client.ts` | 1 (export) |
| `src/rpc/client.ts` imports vscode | NO (pure-Node testable) |
| `require('./dist/extension.cjs')` | Loads OK, exports: `activate`, `deactivate` |

## Threat Flags

None new. The plan's `<threat_model>` mitigations are fully implemented:

- **T-01-01 (ghost presence):** `clearActivity(pid)` on deactivate, SIGINT, SIGTERM, and belt-and-braces on activate. Never `setActivity(null)`. Handler lifecycle managed via unregister fn.
- **T-01-04 (Client ID placeholder):** Accepted — placeholder is a non-secret public identifier, overridable via env var; final value comes from plan 01-05 [HUMAN] handoff.
- **T-01-05 (RPC payload injection):** Accepted — Phase 1 payload is fully hardcoded (`"hello world"` + `Date.now()`); no user input reaches Discord.
- **T-01-08 (activation blocked by Discord unreachable):** Mitigated — `connect()` is fire-and-forget inside `activate()`; login rejection caught at debug log only.

## User Setup Required

None for plan 01-02. The `[HUMAN]` handoff (Discord Developer Portal app creation to populate `DEFAULT_CLIENT_ID`) is authored in plan 01-05 and flagged in `REPLACE_ME_IN_PHASE_1_HANDOFF` placeholder.

## Next Plan Readiness

- **Plan 01-03 ready:** `dist/extension.cjs` now contains real RPC code (196.5 KB), giving the `check:bundle-size` script a non-trivial target to validate. `check:api-surface` will scan `src/` and find zero forbidden patterns.
- **Plan 01-04 ready:** `src/rpc/client.ts` is vscode-free and exports the exact adapter surface (`connect`, `clearActivity`, `helloWorldAnnounce`, `registerSignalHandlers`) the smoke test must mock.
- **Plan 01-05 ready:** `DEFAULT_CLIENT_ID` placeholder string `REPLACE_ME_IN_PHASE_1_HANDOFF` is the anchor for the [HUMAN] handoff doc.
- **Plan 02-04 ready:** The injectable `RpcDeps` pattern + `connect()` contract unblock backoff/throttle hardening without breaking the adapter surface.
- **No blockers.** Build is green. Typecheck is green. No new deps.

## Self-Check: PASSED

- FOUND: src/rpc/client.ts
- FOUND: src/extension.ts (modified)
- FOUND: esbuild.mjs (modified — shim + alias)
- FOUND: .gitignore (modified — build-shims/)
- FOUND: .vscodeignore (modified — build-shims/**)
- FOUND: dist/extension.cjs (196.5 KB, loads cleanly)
- FOUND: dist/metafile.json
- FOUND commit: 4730210 (Task 1)
- FOUND commit: 2069258 (Task 2)

---
*Phase: 01-skeleton-rpc-seam*
*Completed: 2026-04-12*
