---
phase: 01-skeleton-rpc-seam
reviewed: 2026-04-12T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - .github/workflows/ci.yml
  - esbuild.mjs
  - package.json
  - scripts/check-api-surface.mjs
  - scripts/check-bundle-size.mjs
  - src/extension.ts
  - src/rpc/client.ts
  - test/rpc.client.smoke.test.ts
  - tsconfig.json
  - vitest.config.ts
  - .gitignore
  - .vscodeignore
  - docs/HUMAN-HANDOFF.md
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-04-12
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 1 delivers a clean, well-scoped skeleton: activation, an IPC-only Discord RPC seam
with silent-failure semantics (PRD §8), belt-and-braces cleanup (SKEL-08), signal handlers
with an unregister return, and three CI guardrails (build, bundle-size <500 KB,
api-surface). The production code in `src/` is small, focused, and readable.

No Critical issues. The code is free of hardcoded secrets (the placeholder client ID is
intentional per the handoff doc and is a public identifier, not a secret), no dangerous
sinks (`eval`/`exec`/`innerHTML`), and no auth/injection surface in this phase.

The Warnings below are about **race windows and test robustness** — correctness issues that
could bite in Phase 2 when concurrency widens. The Info items are light polish.

## Warnings

### WR-01: `activate()` → `shutdown()` race — connect may resolve after dispose

**File:** `src/extension.ts:19-45`
**Issue:** `activate()` returns immediately and `connectAndAnnounce()` runs in the
background. If the extension host disposes the subscription (user closes window, F5
reload, deactivate path) BEFORE `connect()` resolves, the sequence is:

1. `dispose` runs → `shutdown()` sees `liveClient === undefined` → returns early.
2. `connectAndAnnounce()` then resolves → sets `liveClient = client` and calls
   `helloWorldAnnounce` + `registerSignalHandlers`.
3. The now-orphaned client is never cleaned up → **ghost presence on Discord** (violates
   SKEL-07 intent) and a leaked SIGINT/SIGTERM handler surviving the reload.

**Fix:** Track shutdown state and abort the late resolution. Minimal patch:

```ts
let liveClient: Client | undefined;
let unregisterSignalHandlers: (() => void) | undefined;
let shuttingDown = false;

export function activate(context: vscode.ExtensionContext): void {
  void connectAndAnnounce();
  context.subscriptions.push({ dispose: async () => { await shutdown(); } });
}

async function connectAndAnnounce(): Promise<void> {
  try {
    const client = await connect(DEFAULT_CLIENT_ID);
    if (shuttingDown) {
      // Lost the race. Tear down what we just built.
      await clearActivity(client, process.pid);
      await destroy(client);
      return;
    }
    liveClient = client;
    await helloWorldAnnounce(client, process.pid);
    unregisterSignalHandlers = registerSignalHandlers(client, process.pid);
  } catch (err) {
    console.debug("[agent-mode-discord] RPC connect failed:", err);
  }
}

async function shutdown(): Promise<void> {
  shuttingDown = true;
  // ...existing body...
}
```

### WR-02: `deactivate()` + disposable both call `shutdown()` — double-teardown

**File:** `src/extension.ts:24-29, 64-66`
**Issue:** The `context.subscriptions.push({ dispose })` runs `shutdown()`, and VS Code
also invokes the exported `deactivate()`. Both paths call `shutdown()`, which calls
`destroy(client)`. The `destroy` wrapper swallows errors, so this does not throw — but
the *second* call races an already-destroyed client, and `unregisterSignalHandlers` is
nulled in shutdown #1 so shutdown #2 no-ops on handlers. Functionally safe today, but
depends entirely on the silent-catch wrappers. If Phase 2 tightens any of those
try/catches, this becomes a real bug.

**Fix:** Make `shutdown()` idempotent explicitly:

```ts
let shutdownPromise: Promise<void> | undefined;
async function shutdown(): Promise<void> {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    // ...existing body...
  })();
  return shutdownPromise;
}
```

### WR-03: Test helper `expect(...).resolves.toBeUndefined()` does not match current `clearActivity` contract

**File:** `test/rpc.client.smoke.test.ts:73-77`
**Issue:** Assertion 3 asserts that `clearActivity` resolves to `undefined`. That matches
the current implementation, but the function signature is `Promise<void>` — resolving
to `undefined` is a TS implementation detail, not part of the public contract. If a
future refactor has `clearActivity` return a boolean ("was cleared?") for Phase 2's
state machine, this test fails for the wrong reason (not the silent-failure contract).

**Fix:** Assert "does not reject" rather than "resolves to undefined":

```ts
await expect(clearActivity(client, 99)).resolves.not.toThrow();
// or simply:
await clearActivity(client, 99); // will throw if it rejects
```

### WR-04: SIGINT/SIGTERM handler does not `process.exit()` — may block graceful shutdown

**File:** `src/rpc/client.ts:88-99`
**Issue:** The registered handler awaits `clearActivity` + `destroy`, but never calls
`process.exit()` or re-emits the signal. When the VS Code extension host forwards
SIGINT/SIGTERM, Node's default behavior (exit on SIGINT/SIGTERM) is **suppressed** once
you attach a listener. The handler cleans up Discord state but the process may now hang
waiting on other listeners / open handles — opposite of the intent in SKEL-07 step 3.5
("Wait 5 s. Confirm 'Playing Agent Mode' disappears").

In the VS Code extension host this is *probably* masked because the host's own shutdown
logic wins, but the handler is written as a fallback for cases where the host doesn't
run `deactivate()` (that is its entire purpose). In that scenario it should actively
exit after cleanup.

**Fix:** Either re-emit the default signal behavior after cleanup, or exit:

```ts
export function registerSignalHandlers(client: Client, pid: number): () => void {
  const handler = async (signal: NodeJS.Signals) => {
    try {
      await clearActivity(client, pid);
      await destroy(client);
    } finally {
      // Preserve conventional exit code (128 + signal number).
      process.exit(signal === "SIGINT" ? 130 : 143);
    }
  };
  process.once("SIGINT", () => void handler("SIGINT"));
  process.once("SIGTERM", () => void handler("SIGTERM"));
  return () => { /* ...unchanged... */ };
}
```

Note: confirm with the manual UAT (docs/HUMAN-HANDOFF.md Checklist 3 steps 3.5/3.6)
before changing — if those steps pass as-is the VS Code host is exiting us and this is
moot. Still worth documenting the reliance.

## Info

### IN-01: `console.debug` violates `no-console` rule that is disabled inline

**File:** `src/extension.ts:42-43`
**Issue:** `// eslint-disable-next-line no-console` is present but there is no ESLint
config committed in this phase. The disable comment is dead weight. Either add an ESLint
config (Phase 4 per the phase plan) or drop the pragma.

**Fix:** Remove the `eslint-disable-next-line` comment for now; reintroduce it alongside
ESLint in the phase that adds the linter.

### IN-02: Shim Proxy message references "agent-mode-discord" but the activity label is "Agent Mode"

**File:** `esbuild.mjs:20`
**Issue:** Error string `'[agent-mode-discord] websocket transport not bundled — IPC only'`
is fine for developer logs but differs from the user-visible branding. Not a bug; worth
standardising as you add more log strings in Phase 2.

**Fix:** Pick one prefix (`[agent-mode]` or `[agent-mode-discord]`) and use it
consistently. The extension in `src/extension.ts:43` already uses
`[agent-mode-discord]` — keep that.

### IN-03: `check-api-surface.mjs` regex misses multi-line and backtick variants

**File:** `scripts/check-api-surface.mjs:7-8`
**Issue:** `BAD_CAST` = `/\(\s*vscode\s+as\s+any\s*\)/` will not catch:

- `vscode as any` without wrapping parens (valid TS at many positions).
- `(vscode as\nany)` — newline between identifier and cast.
- `(vscode as unknown as any)` — chained casts.

Phase 1 source is small enough that the current regex works, but any reviewer trusting
this guardrail in Phase 2+ will be surprised.

**Fix:** Broaden the pattern or swap to a TS-AST-based check (ts-morph) once Phase 2
adds more source. For now at minimum:

```js
const BAD_CAST = /\bvscode\s+as\s+(?:unknown\s+as\s+)?any\b/;
```

### IN-04: `scripts/walk()` recursion can overflow on deep dirs; no `node_modules` filter

**File:** `scripts/check-api-surface.mjs:11-21`
**Issue:** `walk(SRC_DIR)` is fine because SRC_DIR = `src`, but the function itself has
no node_modules/dist guard. If someone ever points it at `.` it recurses into
`node_modules`. Minor future-proofing.

**Fix:**

```js
if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
```

### IN-05: `.vscodeignore` includes `!node_modules/@xhayper/**` but bundle is self-contained

**File:** `.vscodeignore:17`
**Issue:** The esbuild step bundles `@xhayper/discord-rpc` into `dist/extension.cjs`
(confirmed by the shim logic in `esbuild.mjs`). Whitelisting `node_modules/@xhayper/**`
back into the VSIX therefore ships the dependency *twice* (once bundled, once as raw
`node_modules`), bloating the package. This is the kind of thing that silently doubles
your VSIX size pre-publish.

**Fix:** Remove line 17 `!node_modules/@xhayper/**` unless there is a runtime reason
(e.g. native addon) to ship the unbundled copy. Verify with a `pnpm vsce package
--no-dependencies` dry run in Phase 6.

### IN-06: `helloWorldAnnounce` hardcodes details + timestamp with no indirection

**File:** `src/rpc/client.ts:47-61`
**Issue:** `"hello world"` and `Date.now()` are inlined inside the RPC client. Phase 1
acceptance wants exactly this, but Phase 2 will replace the payload with a state-derived
object. Extracting a `buildHelloPayload()` now (even as a one-liner) would shrink the
Phase 2 diff and keep `helloWorldAnnounce` responsible only for the clear→set sequence.

**Fix:**

```ts
function buildHelloPayload() {
  return { details: "hello world", startTimestamp: Date.now() };
}

export async function helloWorldAnnounce(client: Client, pid: number): Promise<void> {
  try { await client.user?.clearActivity(pid); } catch { /* ... */ }
  try { await client.user?.setActivity(buildHelloPayload()); } catch { /* ... */ }
}
```

---

_Reviewed: 2026-04-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
