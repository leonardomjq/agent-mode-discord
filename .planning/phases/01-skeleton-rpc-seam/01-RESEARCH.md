# Phase 1: Skeleton + RPC seam — Research

**Status:** Research complete
**Date:** 2026-04-12
**Consumed by:** gsd-planner

Scope: concrete, actionable answers to the planner's open questions. Decisions locked in CONTEXT.md are not re-litigated — this doc focuses on **how** to execute them correctly.

---

## 1. `@xhayper/discord-rpc@^1.3.1` — usage patterns

### Instantiation + connect

```ts
import { Client } from "@xhayper/discord-rpc";

const client = new Client({
  clientId: DEFAULT_CLIENT_ID, // string
  // transport defaults to "ipc" — don't override
});

client.on("ready", () => {
  // client.user is populated here; setActivity calls are safe after this event
});

client.on("disconnected", () => {
  // library emits this on socket close; phase 2 will add reconnect
});

// login() returns a promise that resolves when connected; rejects if Discord desktop isn't running
await client.login();
```

- **`Client` constructor options:** `clientId` (required), `transport` (defaults to `"ipc"`). Do not pass `transport: "websocket"` — we rely on the local socket/named pipe.
- **`login()` is async and throws** if no Discord process is available. Wrap in try/catch; Phase 1 swallows the rejection silently (connect failures are non-fatal per PRD §8 "Failure mode").
- **`"ready"` event is the gate** for calling `setActivity` — if you call before `ready`, `client.user` is undefined.
- **`client.destroy()`** tears down the IPC socket. Call in `deactivate()` AFTER `clearActivity(pid)`.

### Activity payload shape

```ts
await client.user?.setActivity({
  details: "hello world",
  state: undefined,              // optional secondary line
  startTimestamp: Date.now(),    // Discord renders as "elapsed"
  // largeImageKey / smallImageKey / largeImageText / smallImageText — deferred
  // (asset keys land in Phase 6 after [HUMAN] uploads to Developer Portal)
});
```

- Fields are Discord's standard Rich Presence keys. Library type defs expose them.
- `startTimestamp` should be `Date.now()` (ms). Discord converts to "elapsed" display.
- `instance: true` is optional; omit for Phase 1.

### `clearActivity(pid)` signature

```ts
await client.user?.clearActivity(process.pid);
```

- **Yes, the pid argument is real.** The library forwards it to the RPC `SET_ACTIVITY` command with a null `activity` scoped to that pid. This matches SKEL-07 / SKEL-08 exactly.
- Calling with no pid would clear globally — don't do that.
- The call is async and returns a promise. Errors are possible if the socket has already closed; wrap in try/catch.

### Bundle-size concern

- `@xhayper/discord-rpc` transitively requires `@discordjs/rest` + `undici` for websocket transport. When bundling with `platform: "node"` + `format: "cjs"` + IPC-only usage, esbuild tree-shakes most of the websocket paths.
- **Empirical expectation:** minified bundle comes in well under 500 KB (typical: ~80–150 KB). If it regresses, pin `@xhayper/discord-rpc` to an exact version (no `^`) and consider marking `undici` as external if the Node runtime already provides it (Node 18+ ships undici internally).
- **Do NOT** add `--external:undici` pre-emptively in Phase 1 — it changes runtime semantics. Only reach for it if the size check fails.

### Cleanup on deactivate

Order matters:

```ts
export async function deactivate() {
  try { await client.user?.clearActivity(process.pid); } catch {}
  try { await client.destroy(); } catch {}
}
```

- VS Code gives `deactivate()` a short grace period (~5s default). Do not do heavy work.
- Return the async function — VS Code awaits the returned promise.

---

## 2. esbuild single-CJS-bundle config for a VS Code extension

### Canonical `esbuild.mjs`

```js
import * as esbuild from "esbuild";
import { writeFileSync } from "node:fs";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const ctx = await esbuild.context({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",                 // VS Code 1.93 Electron ships Node 20.x
  outfile: "dist/extension.cjs",
  external: ["vscode"],             // ALWAYS external
  minify: production,
  sourcemap: !production,
  treeShaking: true,
  metafile: true,                   // required for bundle-size check
  logLevel: "info",
});

if (watch) {
  await ctx.watch();
} else {
  const result = await ctx.rebuild();
  writeFileSync("dist/metafile.json", JSON.stringify(result.metafile, null, 2));
  await ctx.dispose();
}
```

### Key decisions

- **`target: "node20"`** — VS Code 1.93 (Aug 2024) bundles Electron 30+, which runs Node 20. Safe lowest bar; `node18` also works. CONTEXT.md leaves this to planner discretion — `node20` is the defensible pick.
- **`external: ["vscode"]`** — always. VS Code provides it at runtime via require interception.
- **`format: "cjs"`** — VS Code loads extensions via `require()`. Do not use ESM for `extension.cjs`.
- **`minify: production` + `sourcemap: !production`** — dev builds get inline sourcemaps for F5 debugging; prod builds are minified with no sourcemap (keeps VSIX small).
- **`metafile: true`** — writes analysis JSON that the bundle-size check script consumes.
- **`treeShaking: true`** — default for bundled builds, made explicit so reviewers see the intent.
- **`__dirname` / `__filename`** — with `format: "cjs"` + `platform: "node"`, esbuild leaves these as-is; they resolve correctly when VS Code `require`s the bundle. Do not use `import.meta.url`.

### `package.json` scripts

```jsonc
{
  "scripts": {
    "build": "node esbuild.mjs --production",
    "build:dev": "node esbuild.mjs",
    "watch": "node esbuild.mjs --watch",
    "check:bundle-size": "node scripts/check-bundle-size.mjs",
    "check:api-surface": "node scripts/check-api-surface.mjs",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

---

## 3. `package.json` manifest minimums

### Required fields for a loadable, vsce-packageable extension

```jsonc
{
  "name": "agent-mode-discord",
  "displayName": "Agent Mode",
  "description": "Discord Rich Presence for Claude Code and AI coding agents.",
  "version": "0.0.1",
  "publisher": "<TBD-set-in-phase-6>",
  "engines": { "vscode": "^1.93.0" },
  "main": "./dist/extension.cjs",
  "activationEvents": ["onStartupFinished"],
  "categories": ["Other"],
  "capabilities": {
    "untrustedWorkspaces": { "supported": true },
    "virtualWorkspaces": false
  },
  "repository": { "type": "git", "url": "<TBD>" },
  "license": "MIT",
  "contributes": {}
}
```

### Notes

- **`publisher`** — can be a placeholder string (e.g., `"agent-mode-dev"`) in Phase 1. `vsce package` in Phase 6 requires a real claimed publisher name, but Phase 1 doesn't package, only builds.
- **`capabilities.virtualWorkspaces: false`** — boolean, not object. Object form (`{ supported: false, description: "..." }`) is also valid; boolean is simpler.
- **`capabilities.untrustedWorkspaces: { supported: true }`** — must be object form. Boolean shortcut is NOT valid here.
- **`contributes.configuration`** — can be absent entirely in Phase 1. Empty object `{}` also fine. The ≤20-key surface arrives in Phase 4.
- **`icon`** — absent in Phase 1. Added in Phase 6 with final art.
- **`categories`** — required by Marketplace; `"Other"` is the safest placeholder.
- **`activationEvents`** — must be an array with ONLY `"onStartupFinished"`. No `"*"`, no `"onLanguage:*"` (per PRD §18 + SKEL-01).
- **`engines.vscode: "^1.93.0"`** — pinned to the shell-integration stabilization release (Aug 2024). Do not lower.

### Activation event + `main` wiring

- `activationEvents: ["onStartupFinished"]` means VS Code calls `require("./dist/extension.cjs").activate(ctx)` once the window has finished startup. This is the cheapest stable activation.
- The extension must export `activate(context: vscode.ExtensionContext)` and optionally `deactivate()`. Both symbols are discovered by name via CJS `require`.

---

## 4. VS Code extension lifecycle + signal handlers

### `activate` / `deactivate` contract

```ts
import * as vscode from "vscode";

export async function activate(context: vscode.ExtensionContext) {
  // setup: connect RPC, clearActivity, setActivity, register SIGINT/SIGTERM
  context.subscriptions.push({
    dispose: () => { /* idempotent cleanup */ },
  });
}

export async function deactivate() {
  // async cleanup: clearActivity(pid), client.destroy()
  // VS Code awaits this promise with a bounded timeout (~5s)
}
```

- `activate` may be sync or async; either is fine. If connect takes time, make it async and `await` login — but DON'T block activation on Discord connect. SKEL-03 requires <50ms activation, so start the connect but return before it resolves. Pattern:

```ts
export async function activate(context: vscode.ExtensionContext) {
  const client = new Client({ clientId: DEFAULT_CLIENT_ID });
  // Fire-and-forget — do not await
  connectAndAnnounce(client).catch(() => { /* silent per §8 */ });
  registerSignalHandlers(client);
  context.subscriptions.push({ dispose: async () => {
    try { await client.user?.clearActivity(process.pid); } catch {}
    try { await client.destroy(); } catch {}
  }});
}
```

### Signal handlers

```ts
function registerSignalHandlers(client: Client): () => void {
  const handler = async () => {
    try { await client.user?.clearActivity(process.pid); } catch {}
    try { await client.destroy(); } catch {}
  };
  process.once("SIGINT", handler);
  process.once("SIGTERM", handler);
  return () => {
    process.off("SIGINT", handler);
    process.off("SIGTERM", handler);
  };
}
```

- **`process.once`** not `process.on` — avoid re-entry on extension host reload.
- **Return an unregister fn** that `deactivate()` calls to remove handlers — prevents leaks across reload cycles (common during F5 debugging).
- **VS Code does intercept some signals.** SIGTERM gets through to extension host Node process; SIGINT behavior depends on platform (Ctrl+C in the host terminal on Linux/macOS). The handlers are belt-and-braces — normal deactivate path covers clean shutdown.
- **`process.pid` is per-window.** VS Code spawns one extension host per window; each gets a unique pid. This maps exactly to "two VS Code windows = two independent Discord activities" (RPC-01 in Phase 2 depends on this).

### Async cleanup timeout

- VS Code's grace period for `deactivate()` is not formally documented but empirically ~5s. Our clearActivity + destroy finishes in <50ms under normal conditions; no concern.
- If the RPC socket is unresponsive, `client.destroy()` may hang. Wrap in `Promise.race` with a 1s timeout if paranoid — probably overkill for Phase 1.

---

## 5. Testing pattern: vitest with fake RPC transport

### Separation of concerns in `src/rpc/client.ts`

Structure the module so the Client instance is injectable:

```ts
// src/rpc/client.ts
import { Client } from "@xhayper/discord-rpc";

export interface RpcDeps {
  createClient: (clientId: string) => Client;
  pid: number;
}

export const defaultDeps: RpcDeps = {
  createClient: (clientId) => new Client({ clientId }),
  pid: process.pid,
};

export async function connect(clientId: string, deps: RpcDeps = defaultDeps) {
  const client = deps.createClient(clientId);
  await client.login();
  return client;
}

export async function clearActivity(client: Client, pid: number) {
  try { await client.user?.clearActivity(pid); } catch {}
}
```

### vitest config

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
  },
});
```

### Fake transport via `vi.mock`

```ts
// test/rpc.client.smoke.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockClearActivity = vi.fn(async () => {});
const mockLogin = vi.fn(async () => {});
const mockDestroy = vi.fn(async () => {});

vi.mock("@xhayper/discord-rpc", () => {
  class Client {
    user = { clearActivity: mockClearActivity };
    login = mockLogin;
    destroy = mockDestroy;
    on() { return this; }
    constructor(public opts: { clientId: string }) {}
  }
  return { Client };
});

import { connect, clearActivity } from "../src/rpc/client";

describe("rpc client smoke", () => {
  beforeEach(() => {
    mockClearActivity.mockClear();
    mockLogin.mockClear();
    mockDestroy.mockClear();
  });

  it("connects via login()", async () => {
    const client = await connect("fake-client-id");
    expect(mockLogin).toHaveBeenCalledOnce();
    expect(client).toBeDefined();
  });

  it("clearActivity forwards the pid", async () => {
    const client = await connect("fake-client-id");
    await clearActivity(client as any, 12345);
    expect(mockClearActivity).toHaveBeenCalledWith(12345);
  });

  it("clearActivity swallows errors silently", async () => {
    mockClearActivity.mockRejectedValueOnce(new Error("socket closed"));
    const client = await connect("fake-client-id");
    await expect(clearActivity(client as any, 99)).resolves.toBeUndefined();
  });
});
```

### No `vscode` import in tests

- The test file imports from `../src/rpc/client` only — which itself never imports `vscode`. That module must stay vscode-free (CONTEXT.md §9.4 mandates).
- If `src/rpc/client.ts` needs to log, use `console.debug` (Phase 1 placeholder) — NOT `vscode.window.createOutputChannel`. The output channel moves into a separate module in Phase 4.

### ESM/CJS interop

- `@xhayper/discord-rpc` ships CJS with type defs. vitest (^2) handles CJS imports cleanly.
- `vi.mock("@xhayper/discord-rpc", factory)` works for CJS modules. No `importOriginal` shenanigans needed.
- **tsconfig `module` setting:** use `"ESNext"` with `"moduleResolution": "Bundler"` — esbuild + vitest both handle ESM-style import syntax against CJS packages. Avoid `"CommonJS"` (clunkier source). Avoid `"NodeNext"` (requires `.js` extensions in imports, annoying). `"ESNext"` + `"Bundler"` is the modern pick.

---

## 6. CI bundle-size check

### `scripts/check-bundle-size.mjs`

```js
#!/usr/bin/env node
import { readFileSync } from "node:fs";

const THRESHOLD_BYTES = 500 * 1024; // 500 KB
const METAFILE = "dist/metafile.json";

let meta;
try {
  meta = JSON.parse(readFileSync(METAFILE, "utf8"));
} catch (e) {
  console.error(`[bundle-size] FAIL — could not read ${METAFILE}: ${e.message}`);
  console.error("[bundle-size] Did you run `pnpm build` first?");
  process.exit(1);
}

const out = meta.outputs?.["dist/extension.cjs"];
if (!out) {
  console.error("[bundle-size] FAIL — no entry for dist/extension.cjs in metafile");
  process.exit(1);
}

const size = out.bytes;
const pct = ((size / THRESHOLD_BYTES) * 100).toFixed(1);
const status = size <= THRESHOLD_BYTES ? "PASS" : "FAIL";

console.log(`[bundle-size] ${status}`);
console.log(`[bundle-size] dist/extension.cjs: ${size} bytes (${(size / 1024).toFixed(1)} KB)`);
console.log(`[bundle-size] threshold: ${THRESHOLD_BYTES} bytes (500.0 KB)`);
console.log(`[bundle-size] usage: ${pct}% of threshold`);

if (size > THRESHOLD_BYTES) {
  console.error(`[bundle-size] FAIL — bundle is ${size - THRESHOLD_BYTES} bytes over threshold`);
  process.exit(1);
}
```

- Reads the esbuild metafile emitted by the build step.
- Exits non-zero on regression; PR fails.
- Prints both bytes and KB + % of threshold for human-readable CI logs.
- No deps — pure Node.

### Deferred to later phases

- **VSIX size check** (the packaged file, including `package.json` + `README` + assets) — lands in Phase 5 or 6 when `vsce package` is actually run. Phase 1 bundle check is the primary guardrail; the VSIX will be a few KB bigger but well under 500 KB.

---

## 7. CI proposed-API / `(vscode as any)` grep guard

### `scripts/check-api-surface.mjs`

```js
#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC_DIR = "src";
const PKG = "package.json";
const BAD_CAST = /\(\s*vscode\s+as\s+any\s*\)/;
const BAD_ANY = /\(\s*vscode\s*:\s*any\s*\)/;
const PROPOSED_API = "enabledApiProposals";

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".ts")) out.push(full);
  }
  return out;
}

let failed = false;

// 1. package.json must not contain enabledApiProposals
try {
  const pkg = JSON.parse(readFileSync(PKG, "utf8"));
  if (PROPOSED_API in pkg && Array.isArray(pkg[PROPOSED_API]) && pkg[PROPOSED_API].length > 0) {
    console.error(`[api-surface] FAIL — package.json has non-empty ${PROPOSED_API}`);
    failed = true;
  }
} catch (e) {
  console.error(`[api-surface] FAIL — could not read package.json: ${e.message}`);
  process.exit(1);
}

// 2. No (vscode as any) casts in src/**/*.ts
const files = walk(SRC_DIR);
for (const file of files) {
  const content = readFileSync(file, "utf8");
  if (BAD_CAST.test(content) || BAD_ANY.test(content)) {
    console.error(`[api-surface] FAIL — ${file} contains (vscode as any) cast`);
    failed = true;
  }
}

if (failed) {
  console.error("[api-surface] FAIL — see errors above");
  process.exit(1);
}
console.log(`[api-surface] PASS — scanned ${files.length} .ts files, no proposed-API or (vscode as any) usage`);
```

- Pure Node — no ripgrep / grep / glob dep.
- Scans `src/**/*.ts` recursively.
- Checks `package.json` for `enabledApiProposals` (absent OR empty array = pass; non-empty = fail).
- Regex matches both `(vscode as any)` and `(vscode: any)` patterns.
- Prints file:line would be nicer; Phase 1 can do whole-file match and defer line numbers.

---

## 8. GitHub Actions workflow shape

### `.github/workflows/ci.yml` for Phase 1

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build

      - name: Bundle size check
        run: pnpm check:bundle-size

      - name: API surface check
        run: pnpm check:api-surface

      - name: Test
        run: pnpm test
```

- **Single job on ubuntu-latest.** Cross-platform matrix (Ubuntu + macOS + Windows) is a Phase 5 concern per PRD M6a. Phase 1 just needs the guardrail online.
- **`pnpm/action-setup@v4`** — current, not v2. Version 9 matches the expected pnpm major line (update in phase 5 if needed).
- **`actions/setup-node@v4`** with `node-version: 20` + `cache: pnpm` — matches esbuild target and caches `node_modules` / pnpm store.
- **`--frozen-lockfile`** required per PRD M6a DoD — fails if `pnpm-lock.yaml` is out of sync.
- **No lint step in Phase 1** — PRD doesn't mandate lint for M0; CONTEXT.md doesn't list a linter. Add in Phase 5 with the OSS hygiene pass if desired. (Plan step will note this as deferred.)
- **Order matters:** build → bundle-size → api-surface → test. Size check depends on `dist/metafile.json` existing from build. api-surface only needs source. Test is independent of build output.

### Branch protection

- Not set in Phase 1. Phase 5 M6a establishes `main` protection after OSS files land.
- `push: branches: [main]` ensures CI still runs on direct pushes in the interim.

---

## 9. Pitfalls to warn planner about

### `setActivity(null)` is a trap

PRD §18 explicit: **never** call `setActivity(null)` to clear. Some Discord client versions leave ghost presences. Always `clearActivity(pid)`. Phase 1 never calls setActivity with null — just enforce in code review.

### SIGINT/SIGTERM handler double-registration

Pattern: register on activate, store the unregister fn on the disposable, call it in deactivate. Without this, reloading the extension during development (F5, then reload window) leaks handlers and can fire multiple clearActivity calls on process exit.

### Client ID placeholder + silent connect failure

```ts
const DEFAULT_CLIENT_ID = process.env.AGENT_MODE_CLIENT_ID ?? "REPLACE_ME_IN_PHASE_1_HANDOFF";
```

- When Client ID is `REPLACE_ME_...`, `client.login()` will reject (Discord rejects unknown app IDs). Our try/catch swallows it silently.
- The `[HUMAN]` handoff doc must flag this: "until you complete the Discord Developer Portal step, the extension will load fine but no activity appears."
- In CI the test uses a mocked client — the placeholder never hits Discord.

### vitest + CJS package

- `@xhayper/discord-rpc` is CJS. `vi.mock("@xhayper/discord-rpc", factory)` works without issues in vitest ^2.
- If you see "Cannot use import statement outside a module" errors, check that `vitest.config.ts` has `environment: "node"` (default is "node" — should be fine).

### tsconfig drift

Recommended minimum:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- `noEmit: true` — esbuild handles bundling; tsc is type-check only. Optional `typecheck` script: `tsc --noEmit`.
- `types: ["node", "vitest/globals"]` — enables both `process.pid` and vitest's `describe/it`.
- `@types/vscode` is a dev dep but NOT in `types[]` — it gets picked up via explicit `import * as vscode from "vscode"` (per `@types/vscode` convention, it's ambient).

### `dist/` in git

`.gitignore` must include `dist/`, `node_modules/`, `*.vsix`, `.vscode-test/`, `.env*`, `.DS_Store`. PRD M6a lists these.

### pnpm lockfile commitment

`pnpm-lock.yaml` MUST be committed. CI uses `--frozen-lockfile` which fails if it's missing or out of sync.

---

## 10. Validation Architecture

Defines test boundaries and the minimum assertions needed to satisfy SKEL-01 through SKEL-10.

### Test boundaries

| Boundary | What it covers | Tool |
|---|---|---|
| **Pure unit** (vitest, no vscode, no Discord) | RPC client adapter (connect wiring, clearActivity pid forwarding, error swallowing) | vitest with `vi.mock` on `@xhayper/discord-rpc` |
| **Static checks** (no runtime) | Bundle size, `enabledApiProposals` absence, `(vscode as any)` cast absence, file-size < 500 KB, lockfile presence | `scripts/check-bundle-size.mjs`, `scripts/check-api-surface.mjs`, CI step exit codes |
| **Manual Dev Host verification** (`[HUMAN]`) | SKEL-06 (hello world visible in Discord friends sidebar), activation time < 50ms via VS Code profiler, SIGINT/SIGTERM leaves no ghost presence | Run `F5` in VS Code with Discord desktop open; observe |
| **Future phases** | Throttle, backoff, multi-window pid scoping, state machine | Not Phase 1 |

### Requirement → validation mapping

| Req | How validated | Boundary |
|---|---|---|
| SKEL-01 (onStartupFinished only) | `check:api-surface` can extend to grep `package.json` for forbidden patterns; also visible in manifest review | Static + review |
| SKEL-02 (VSIX < 500 KB) | Phase 1 enforces bundle < 500 KB via `check:bundle-size`. VSIX check lands Phase 5/6. | Static (bundle proxy) |
| SKEL-03 (activation < 50 ms) | Dev Host manual check via VS Code extension profiler | Manual |
| SKEL-04 (CI fails on bundle regression) | `check:bundle-size` exit code non-zero; verified by running with an artificial payload in a spike test | Static + CI |
| SKEL-05 (no proposed APIs, no `(vscode as any)`) | `check:api-surface` | Static |
| SKEL-06 (hello world visible in friends sidebar) | Dev Host manual — run extension, open Discord, confirm | Manual `[HUMAN]` |
| SKEL-07 (SIGINT/SIGTERM → clearActivity(pid)) | vitest smoke test asserts signal handler wiring + pid forwarding (handler call → mockClearActivity called with pid). Real signal firing = manual Dev Host kill test. | Unit + manual |
| SKEL-08 (clearActivity once on activate) | vitest smoke test: invoke the activate-time cleanup helper directly; assert `mockClearActivity` called before any `setActivity` | Unit |
| SKEL-09 (`pnpm build` produces dist/extension.cjs no warnings) | CI step exit code; esbuild logs captured | Static + CI |
| SKEL-10 (`pnpm test` exits 0) | CI step runs `pnpm test`; must pass | Static + CI |

### Minimum smoke-test asserts (for SKEL-07/08/10)

The Phase 1 smoke test suite must include at minimum:

1. **Connect wiring** — `connect()` calls `client.login()` exactly once.
2. **clearActivity forwards the pid** — `clearActivity(client, 12345)` results in `client.user.clearActivity` being called with `12345`.
3. **Errors are swallowed** — if `clearActivity` rejects, the wrapper resolves (does not throw).
4. **Activate sequence** — the activate-time cleanup helper calls clearActivity BEFORE setActivity (order matters for SKEL-08).
5. **Signal handler wiring** — registering signal handlers and invoking the handler fn results in `clearActivity(pid)` being called.

Any additional assertions are bonus; these five cover the SKEL requirements a unit test can reach.

### Manual verification checklist (Dev Host)

Documented in `docs/HUMAN-HANDOFF.md` as a "Phase 1 Acceptance Checklist":

1. `pnpm install && pnpm build` — produces `dist/extension.cjs`, no warnings, bundle size check passes.
2. `pnpm test` — exits 0.
3. Open repo in VS Code, press `F5` — Extension Development Host window opens without error.
4. In the Dev Host window, open Discord desktop.
5. Within 2s, Discord friends sidebar shows "Playing Agent Mode" with `hello world` in details.
6. Kill the Dev Host window with Cmd/Ctrl+Q (or close it normally) — Discord presence disappears; no ghost remains after 5s.
7. Kill the Dev Host process with `kill -TERM <pid>` or the OS task manager — Discord presence disappears; no ghost.
8. Restart the Dev Host — only one "Playing Agent Mode" appears (not duplicated from ghost).

### Future-phase extensibility

- This Validation Architecture intentionally does not mock Discord integration tests. Real IPC testing is infeasible in CI (no Discord running). Phase 2+ hardens RPC with backoff/throttle — those are unit-testable on the pure modules side.
- The grep guard (`check:api-surface`) is reusable across all phases and serves as the enforcement mechanism for SKEL-05 through the lifetime of the project.

---

## RESEARCH COMPLETE
