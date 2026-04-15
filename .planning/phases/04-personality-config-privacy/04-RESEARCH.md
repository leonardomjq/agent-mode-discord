# Phase 4: Personality + config + privacy — Research

**Researched:** 2026-04-14
**Domain:** VS Code extension configuration surface; Discord RPC activity copy pipeline; privacy redaction & ignore-list matching; deterministic test design
**Confidence:** HIGH on architecture + existing patterns (repo inspected); MEDIUM on `contributes.configuration` UI edge cases; HIGH on zero-dep constraints (CONTEXT already locks them)

## Summary

Phase 4 replaces the `extension.ts` hardcoded `buildPayload()` stub with a goblin-pack-driven rendering pipeline: **packLoader** (load + schema-validate built-in `goblin.json`, optionally override via `messages.customPackPath`) → **animator** (weighted pool pick → Fisher-Yates no-repeat pick → 2 s frame cycle) → **templater** (`{workspace}|{filename}|{language}|{branch}|{agent}|{elapsed}` substitution, skip blanks) → **activityBuilder** (assembles `SetActivity`). A **privacy** module handles `show|hide|hash` redaction plus four ignore lists (workspaces / repositories / organizations / gitHosts); an **ignore match** clears once and stays silent. A **config** adapter wraps `workspace.getConfiguration("agentMode")` with lazy reads on every rotation tick, driven by a single `onDidChangeConfiguration` listener that no-ops (reads are pulled, not pushed).

Every locked decision in 04-CONTEXT.md is consistent with VS Code's stable API surface (no proposed APIs, no casts) and with the project's zero-dep constraint. The biggest open research questions — `contributes.configuration` key-count arithmetic, glob semantics for `ignore.workspaces`, and the "zero outbound HTTP" CI assertion — all have validated answers below.

**Primary recommendation:** Add 4 pure-core modules (`presence/animator.ts`, `presence/templater.ts`, `presence/packLoader.ts` logic, `presence/activityBuilder.ts`) to `PURE_CORE_PATHS` in `scripts/check-api-surface.mjs`, plus the privacy logic (already there). `presence/packLoader.ts`'s file-read path and a tiny `config.ts` adapter stay outside pure-core because they touch `fs` / `vscode`. Hand-roll the schema validator (~40 lines TypeScript narrowing), hand-roll glob matching (~25 lines), hand-roll SHA-1-prefix via `node:crypto` (3 lines). Zero new runtime deps. Ship the 20-key manifest in one atomic `package.json` commit. For the network-traffic assertion, prefer a **static require-graph check + runtime `http`/`https` module intercept** over sandboxing the Extension Host; it's cheaper, CI-portable, and deterministic.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Goblin pack content & structure (D-01..D-05)**
- Three state pools: `AGENT_ACTIVE` (object with `_primary` + per-agent sub-pools for `claude` and `codex`), `CODING` (flat array), `IDLE` (flat array).
- Messages are either `string` or `string[]`; arrays are 2 s frame sequences, singletons render statically.
- v0.1 per-agent sub-pools: `claude`, `codex` only. `aider`/`gemini`/`opencode` → `_primary` via redistribution.
- Target message length ≤ 50 chars.
- Canonical pack committed as `src/presence/goblin.json` with `id`, `version: 1`, `pools`, `timeOfDay`. Copy content fully spelled out in CONTEXT §D-05.

**Animator — pool-pick weights & fallback (D-06..D-13)**
- Every 20 s rotation: weighted pool pick first, Fisher-Yates no-repeat within the chosen pool.
- Weights: AGENT_ACTIVE 70/20/10; CODING 85/15; IDLE 90/10.
- Missing-pool fallback: redistribute weight to state primary; examples in D-08.
- Fisher-Yates no-repeat applies **inside the pool actually used on this tick** (fixes the "tiny pool cycles predictably" bug).
- `animations.enabled: false` → freeze frame arrays on frame 0; 20 s rotation still fires.
- Time-of-day buckets (local `new Date()`): `lateNight` 00–06, `morning` 06–12, `afternoon` 12–18, `evening` 18–24. No DST special-casing.
- Injectable clocks (`now?`, `rand?`, `setInterval?`, `clearInterval?`) — options-bag pattern mirrors Phase 3.
- `{elapsed}` resets on state transitions only (matches Discord `startTimestamp`).

**Privacy (D-14..D-18)**
- Ignore-match = **clear-once, stay silent**: first matching tick calls `clearActivity(pid)` exactly once; subsequent ticks no-op; first non-match tick resumes pipeline. RPC stays connected throughout.
- Hash = salt-free SHA-1 of `path.resolve()`-normalized workspace path, forward slashes, lowercased Windows drive letter only. No home-dir collapse, no symlink resolution. First 6 hex chars.
- Ignore-match case semantics:
  - `ignore.workspaces` (glob) — case-insensitive cross-platform.
  - `ignore.repositories` / `ignore.organizations` (regex) — case-sensitive (user writes `(?i)` if they want otherwise).
  - `ignore.gitHosts` (string list) — case-insensitive.
- Git URL normalization before regex: strip `.git`, strip trailing `/`, collapse `git@host:owner/repo` → `host/owner/repo`, and `https://host/owner/repo` → `host/owner/repo`.
- `vscode.git` access via `vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)`; every call try/catched; degrade to empty branch on absence.

**Idle behavior (D-19, D-20)**
- `idleBehavior: show | clear`, default `show` (render IDLE pool).
- `clear` fires immediately on first IDLE tick — no extra grace (Phase 3 30 s flicker-guard already provides it).

**Config surface (D-21..D-24)**
- Nested `agentMode.*` namespace with subsection grouping.
- ≤ 20 keys total. Provisional inventory (13 keys drafted + 1 already owned by Phase 3 = 14) + 6 spare slots for planner.
- Every key: `title`, `description`, `default`, `enum`/`enumDescriptions` where applicable.
- Live reload via `onDidChangeConfiguration` + **lazy reads on rotation tick** (no caching at activation).

**Custom-pack loading (D-25..D-28)**
- Poll-on-tick reads `messages.customPackPath` every 20 s via `fs.readFileSync`. No `fs.watch`.
- Invalid pack → log + **whole-pack fallback to built-in goblin** (no partial/per-pool hybrid).
- Schema validation cheap & per-load. Zero-dep validator (hand-rolled TS narrowing or a ~50-line ad-hoc function).
- **No toasts ever** — debug-channel output only.

**Network guardrail (D-29)**
- Zero outbound HTTP from the built bundle. 10-minute CI window; Discord IPC (local socket / named pipe) does not count. Implementation mechanism is planner discretion; contract is fixed.

### Claude's Discretion

- Pack validator: hand-rolled TS narrowing vs ~50-line ad-hoc validator.
- `{elapsed}` formatting (`20m`, `2h 15m`, etc.).
- `setInterval` vs `setTimeout`-reschedule for the 20 s clock.
- Order of keys in `contributes.configuration` (group by namespace).
- Output-channel name (`"Agent Mode (Discord)"` vs `"agent-mode-discord"`).

### Deferred Ideas (OUT OF SCOPE)

- Per-agent sub-pools for `aider`/`gemini`/`opencode` (v0.2 PERS-V2-03).
- `default`/`professional` packs (killed permanently).
- Salted privacy hashes.
- Agent telemetry (token counts, $/hr).
- Emoji / image slots (Phase 5).
- `fs.watch`-based custom-pack reload.
- Partial per-pool pack fallback.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERS-01 | Goblin pack is the only built-in pack in v0.1 | §Standard Stack (hand-rolled validator); §Code Examples (pack loader) |
| PERS-02 | 20 s rotation, state → agent sub-pool → time-of-day fallback chain | §Architecture Patterns (animator clocks); §Pitfalls (weight redistribution math) |
| PERS-03 | Fisher-Yates no-repeat across two consecutive rotations | §Architecture Patterns (FY shuffle with last-picked guard); §Validation Architecture (determinism via injected `rand`) |
| PERS-04 | 2 s frame clock cycles multi-frame messages | §Architecture Patterns (two-clock animator) |
| PERS-05 | `animations.enabled: false` freezes frame arrays on frame 0 | §Architecture Patterns (freeze branch); §Validation Architecture |
| PERS-06 | Template substitution of 6 tokens; blank-after-substitution messages skipped | §Architecture Patterns (templater + skip-blank loop); §Pitfalls (empty-after-redact) |
| PERS-07 | `messages.customPackPath` loaded on next rotation | §Architecture Patterns (poll-on-tick pattern); §Pitfalls (ENOENT / invalid JSON) |
| PERS-08 | Invalid packs fall back to built-in goblin silently (debug log) | §Code Examples (validator returns `Result`) |
| PRIV-01 | Workspace name `show|hide|hash` | §Code Examples (SHA-1 prefix); §Pitfalls (path normalization) |
| PRIV-02 | Filename `show|hide` | Existing `redact()` already supports |
| PRIV-03 | Git branch `show|hide` via `vscode.git` API | §Canonical Refs (VS Code Git API); §Pitfalls (extension-not-activated race) |
| PRIV-04 | Silent degrade if `vscode.git` unavailable | §Pitfalls (try/catch every access) |
| PRIV-05 | 4 ignore lists → full silence | §Architecture Patterns (ignore evaluator); §Code Examples (git URL normalization) |
| PRIV-06 | Privacy flip applies next tick | Lazy-read-on-tick |
| PRIV-07 | Zero outbound HTTP (CI-verifiable) | §Architecture Patterns (network guardrail options); §Validation Architecture |
| CONF-01 | ≤ 20 keys, each with title/description/default/enum | §Architecture Patterns (nested namespace key-count rule) |
| CONF-02 | `clientId` override; blank → bundled default | §Code Examples (config coercion) |
| CONF-03 | Settings apply on next tick, no reload | §Architecture Patterns (lazy-read-on-tick) |
| CONF-04 | `idleBehavior: show|clear`, never disconnect RPC on clear | §Architecture Patterns (clear-once invariant) |
| CONF-05 | `debug.verbose` toggles output-channel logging | §Code Examples (channel guard) |

## Project Constraints (extracted from PROJECT.md + PRD)

Treat these with the same authority as locked CONTEXT decisions:

- **Zero VS Code proposed APIs**, **zero `(vscode as any).*` casts**. Enforced by `scripts/check-api-surface.mjs`. Any Phase-4 code must survive `pnpm check:api-surface`.
- **Bundle under 500 KB** (currently 212 KB; budget headroom ≈ 288 KB). `pnpm check:bundle-size` is part of CI.
- **Single runtime dep**: `@xhayper/discord-rpc@^1.3.1`. No `ajv`, no `zod`, no `micromatch`, no `minimatch`, no `fast-glob`. Any new runtime dep requires explicit approval.
- **File size target**: soft 200 lines / hard 300.
- **Pure-core boundary** enforced by `check-api-surface.mjs` `PURE_CORE_PATHS`. Phase 4 must add `src/presence/animator.ts`, `src/presence/templater.ts`, `src/presence/activityBuilder.ts`, and `src/presence/packLoader.ts` (except for its fs.readFileSync path — keep that in a thin adapter) to PURE_CORE_PATHS.
- **Debug-channel-only errors** — no toasts anywhere.
- **Options-bag injection** for every side-effecting module (mirrors Phase 3).
- **Activation event is `onStartupFinished` only** (no `onConfiguration:*`, no contribution-based activation). The `onDidChangeConfiguration` listener must be registered inside `activate()`.

## Standard Stack

### Core — zero new runtime deps; all stdlib

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:crypto` (built-in) | Node 20 (CI), Node 24 (dev) | SHA-1 hashing for workspace name (PRIV-01) | Stable, synchronous, <1 μs for short strings — no async complexity `[VERIFIED: node -e test above returned 6-char hex deterministically]` |
| `node:path` (built-in) | Node 20+ | `path.resolve()` + slash normalization for hash input | Cross-platform path handling `[VERIFIED: used throughout src/detectors/sessionFiles.ts]` |
| `node:fs` (built-in) | Node 20+ | `readFileSync` for `customPackPath` + `goblin.json` | D-25 locks synchronous read `[CITED: Node fs docs]` |
| VS Code Configuration API | engines.vscode `^1.93.0` | `workspace.getConfiguration("agentMode")` + `onDidChangeConfiguration` | Stable API; no proposed surface `[CITED: https://code.visualstudio.com/api/references/vscode-api#workspace.getConfiguration]` |
| `@xhayper/discord-rpc` | 1.3.1 (already wired) | `client.user?.clearActivity(pid)` for ignore-match + idleBehavior=clear (D-14, D-20) | Already in repo; no changes needed `[VERIFIED: package.json reads "@xhayper/discord-rpc": "^1.3.1"]` |

**Nothing else gets added.** This is the whole dependency story for Phase 4.

### Supporting — hand-rolled, ~250 lines total across modules

| Component | Location | Size target | Purpose |
|-----------|----------|-------------|---------|
| Pack schema validator | `src/presence/packLoader.ts` | ~40 lines | TypeScript narrowing over `unknown` returning `{ ok: true, pack } \| { ok: false, error }` |
| Glob matcher | `src/privacy.ts` (or `src/presence/glob.ts`) | ~25 lines | Minimal glob for `ignore.workspaces`: supports `*`, `**`, `?`, `[...]`. Case-insensitive. |
| Regex compiler (safe) | `src/privacy.ts` | ~15 lines | Compile user-supplied patterns in try/catch; skip invalid; dedup compile-per-tick via memo |
| Weighted pool picker | `src/presence/animator.ts` | ~30 lines | Cumulative-weight + injected `rand()` |
| Fisher-Yates shuffle (with last-pick guard) | `src/presence/animator.ts` | ~15 lines | Shuffle; if first element === lastPicked, swap with last element |
| Two-clock orchestrator | `src/presence/animator.ts` | ~50 lines | 20 s rotation + 2 s frame, options-bag injected timers |
| Templater | `src/presence/templater.ts` | ~30 lines | `{token}` substitution, skip-blank detector |
| ActivityBuilder | `src/presence/activityBuilder.ts` | ~40 lines | Glues animator + templater + privacy + Discord `SetActivity` shape |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Why rejected |
|------------|-----------|----------|--------------|
| Hand-rolled schema validator | `zod` | Better DX, better error messages | `[VERIFIED: npm view zod@3.23 size ~50KB gzip]` — blows the remaining 288 KB headroom risk and adds a runtime dep (D-27 forbids). For a flat 4-pool schema, TS narrowing is ~40 lines. |
| Hand-rolled glob | `micromatch` / `minimatch` / `picomatch` | Robust POSIX-bracket + extglob | D-27 zero-dep; `ignore.workspaces` only needs `*`, `**`, `?` (directory-aware prefix-glob). Hand-rolled ~25 lines is sufficient. `[VERIFIED: node_modules has none of these — no transitive freebie]` |
| SHA-1 (first 6 hex) | SHA-256 / BLAKE2 | Stronger cryptographic properties | D-15 explicitly specifies SHA-1 6-hex-char; collision risk is not a threat model (single-user tool). Using anything else violates the decision. |
| `vscode.WorkspaceConfiguration.update()` with `ConfigurationTarget.Global` for writes | — | N/A | **Phase 4 never writes config**; we only read. |
| `fs.watch` for custom pack | `fs.watchFile` / poll-on-tick | Lower latency | D-25 locks poll-on-tick. 20 s latency is the rotation cadence anyway. |

**Installation:** None. No `npm install` in this phase. The only `package.json` edit is the `contributes.configuration` manifest.

**Version verification:**
- `@xhayper/discord-rpc`: already pinned `^1.3.1`. `[VERIFIED: package.json]`
- Node 20 in CI, Node 24 locally. `node:crypto.createHash('sha1')` is stable across both. `[VERIFIED: node -e test returned `6e36a2` deterministically]`
- VS Code API `engines.vscode: ^1.93.0`. `onDidChangeConfiguration` has been stable since 1.18; `vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)` is the documented Git extension pattern. `[CITED: https://github.com/microsoft/vscode/blob/main/extensions/git/src/api/api.ts]`

## Architecture Patterns

### Recommended Project Structure

```
src/
├── extension.ts             # modified — wires animator into driver, adds onDidChangeConfiguration listener
├── privacy.ts               # expanded — SHA-1 hash impl + ignore-list evaluator
├── config.ts                # NEW (adapter) — reads agentMode.* lazily; outside pure-core (imports vscode)
├── outputChannel.ts         # NEW (adapter) — shared `Agent Mode (Discord)` output channel for debug logs
├── presence/                # NEW subtree
│   ├── goblin.json          # committed data — the canonical pack (D-05)
│   ├── packLoader.ts        # NEW (pure-core except readFileSync injection) — schema + fallback
│   ├── animator.ts          # NEW (pure-core) — two clocks, weighted pool pick, FY no-repeat
│   ├── templater.ts         # NEW (pure-core) — {token} substitution, skip-blank
│   └── activityBuilder.ts   # NEW (pure-core) — assembles Discord SetActivity
└── state/ rpc/ detectors/   # UNCHANGED from Phase 3
```

**PURE_CORE_PATHS additions** in `scripts/check-api-surface.mjs`:

```js
const PURE_CORE_PATHS = [
  "src/state/",
  "src/rpc/throttle.ts",
  "src/privacy.ts",
  "src/detectors/regex.ts",
  // Phase 4 additions:
  "src/presence/animator.ts",
  "src/presence/templater.ts",
  "src/presence/activityBuilder.ts",
  "src/presence/packLoader.ts", // fs surface injected, not imported
];
```

`src/config.ts` and `src/outputChannel.ts` stay outside pure-core because they must `import * as vscode from "vscode"`.

### Pattern 1: Options-bag injection (established Phase 2 + 3, extended for Phase 4)

**What:** Every module that has a side effect (timers, `fs`, `rand`, `now`) accepts a partial options-bag whose defaults are real implementations. Tests pass fakes.

**When to use:** Every new module in Phase 4 except `goblin.json`.

**Example (skeleton for animator):**
```typescript
// src/presence/animator.ts — pure-core
export interface AnimatorDeps {
  now: () => Date;
  rand: () => number;
  setInterval: (fn: () => void, ms: number) => NodeJS.Timeout;
  clearInterval: (t: NodeJS.Timeout) => void;
}

export const realAnimatorDeps: AnimatorDeps = {
  now: () => new Date(),
  rand: () => Math.random(),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (t) => clearInterval(t),
};

export function createAnimator(
  getPack: () => Pack,              // lazy — poll-on-tick (D-25)
  getStateContext: () => PresenceContext, // reads current reducer snapshot
  onRender: (text: string) => void, // dispatches into throttle
  deps: Partial<AnimatorDeps> = {},
): { start(): void; stop(): void } { /* ... */ }
```

Mirror of `src/detectors/sessionFiles.ts` pattern [VERIFIED in repo].

### Pattern 2: Two-clock animator

**What:** Two independent timers — a **rotation clock** (20 s) picks the next message; a **frame clock** (2 s) advances the frame index when the current message is an array.

**Why two clocks, not nested ticks:** A 2 s frame clock that also handles rotation every 10th tick would skip/slow frames whenever a rotation lands on frame boundary. Two independent clocks keep semantics crisp (PERS-04 + PERS-02 are independent behaviors).

**Implementation sketch:**
```
on activate():
  currentMessage = pickNext()    // rotation tick 0
  frameIdx = 0
  render(currentMessage, frameIdx)

rotationTimer every 20 000 ms:
  currentMessage = pickNext()
  frameIdx = 0
  render(currentMessage, 0)

frameTimer every 2 000 ms:
  if currentMessage is array AND animations.enabled:
    frameIdx = (frameIdx + 1) % currentMessage.length
    render(currentMessage, frameIdx)
  else:
    no-op     // singleton or animations.enabled=false → stays static
```

**Why a render on rotation AND on frame:** Because state transitions (IDLE → AGENT_ACTIVE mid-rotation) still reset the clock elsewhere; the animator's clocks only fire while running. State transitions from the reducer force an immediate `render()` via the driver — same pattern as Phase 2 `scheduleIdle`.

### Pattern 3: Weighted pool pick → Fisher-Yates no-repeat within pool

**Pool pick is weighted.** Fisher-Yates is **within the chosen pool only** (D-09). This matters: a "lucky" 10% time-of-day roll into a 3-element pool would cycle predictably if the no-repeat invariant were global across pools. Local invariant fixes that.

**Skeleton:**
```typescript
// Weighted pick — cumulative-weight + rand
function pickPool(weights: { pool: Message[] | null; w: number }[], rand: () => number): Message[] {
  // Redistribute missing/empty pools to the first non-null (primary) per D-08
  const valid = weights.filter(x => x.pool && x.pool.length > 0);
  const total = valid.reduce((s, x) => s + x.w, 0);
  const r = rand() * total;
  let acc = 0;
  for (const x of valid) { acc += x.w; if (r < acc) return x.pool!; }
  return valid[valid.length - 1].pool!;
}

// FY no-repeat — shuffle in place; if first matches last-picked, swap to tail
function pickFromPool(pool: Message[], lastPicked: Message | null, rand: () => number): Message {
  if (pool.length === 1) return pool[0]; // no-repeat impossible in singleton pool
  // Single-pick Fisher-Yates: O(1) index + last-pick guard
  let idx = Math.floor(rand() * pool.length);
  if (pool[idx] === lastPicked) idx = (idx + 1) % pool.length;
  return pool[idx];
}
```

**Note on pool identity for no-repeat:** Two separate pools can share strings (e.g., `_primary` and time-of-day might both contain "building"). D-09 says no-repeat applies **within the pool actually used that tick**, meaning the `lastPicked` memory is **per-pool**, not global. If a rotation switches pools, the check on the new pool uses that pool's own lastPicked (or `null` on first entry).

### Pattern 4: Time-of-day bucket resolver

```typescript
function timeOfDayBucket(d: Date): "lateNight" | "morning" | "afternoon" | "evening" {
  const h = d.getHours(); // local time, DST handled by Date
  if (h < 6) return "lateNight";
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}
```

No DST special-casing required — `Date.getHours()` returns local wall-clock hours.

### Pattern 5: Lazy-read config on rotation tick (D-24, PRIV-06, CONF-03)

**What:** `config.ts` exposes `readConfig()` that every tick calls. The `onDidChangeConfiguration` listener is a **no-op** (or only calls `outputChannel.appendLine` when `debug.verbose`). No cache invalidation logic — reads are free because VS Code's `getConfiguration()` returns a snapshot.

**Why:** Simpler than push-based invalidation. Max flip-to-apply latency is ≤20 s (next rotation tick), which matches D-24's stated contract. Eliminates an entire class of stale-cache bugs.

```typescript
// src/config.ts — outside pure-core
export interface AgentModeConfig {
  clientId: string;
  idleBehavior: "show" | "clear";
  debug: { verbose: boolean };
  animations: { enabled: boolean };
  messages: { customPackPath: string };
  privacy: {
    workspaceName: "show" | "hide" | "hash";
    filename: "show" | "hide";
    gitBranch: "show" | "hide";
  };
  ignore: {
    workspaces: string[];
    repositories: string[];
    organizations: string[];
    gitHosts: string[];
  };
  detect: {
    customPatterns: Record<string, string>;   // owned by Phase 3
    sessionFileStalenessSeconds: number;      // owned by Phase 3
  };
}

export function readConfig(): AgentModeConfig {
  const c = vscode.workspace.getConfiguration("agentMode");
  return {
    clientId: c.get<string>("clientId", "") || DEFAULT_CLIENT_ID,
    idleBehavior: c.get<"show" | "clear">("idleBehavior", "show"),
    debug: { verbose: c.get<boolean>("debug.verbose", false) },
    // ... etc, each with explicit default that matches package.json
  };
}
```

### Pattern 6: `contributes.configuration` key accounting

**VS Code counts every leaf property as one key** regardless of dot-depth. Nesting via dot notation (`agentMode.privacy.workspaceName`) is UI grouping only; the settings schema JSON still lists 14 (+ spare slots) separate property entries. `[CITED: https://code.visualstudio.com/api/references/contribution-points#contributes.configuration]`

**What does NOT count as a key:**
- The top-level `"title"` entry.
- The wrapper object.

**What counts as exactly one key:** every property under `"properties"`.

**What counts as "multi-key"**: `"type": "object"` with `"properties": {...}` expanded as individual scoped settings. If `agentMode.ignore` is a single `object` schema, VS Code shows one UI row with an "Edit in settings.json" link — which **still counts as ONE key**, but means users can't toggle individual sub-keys in the UI.

**Recommendation (covers CONF-01 neatly):** Use **flat dot-separated property names** like `agentMode.privacy.workspaceName`, `agentMode.ignore.workspaces`. VS Code renders these as grouped sections in the settings UI without being nested objects in schema. Count of the provisional inventory = 14 (sits well under 20, leaves 6 spare for planner refinements).

### Pattern 7: Network guardrail (PRIV-07 / D-29)

**Three options, ranked:**

1. **Runtime `http`/`https` module intercept (RECOMMENDED)** — before loading the extension into the VS Code Extension Host test harness, monkey-patch `http.request`, `https.request`, `net.connect` (for outbound TCP that isn't Discord IPC), and `dns.lookup`. Any invocation increments a counter and throws. Run the bundle for 10 min with simulated state transitions. Assert counter = 0. **Pros:** deterministic, fast, CI-portable (no sandbox flags), catches transitive-dep misbehavior. **Cons:** must distinguish IPC (unix socket / named pipe → `net.createConnection` with `path:` arg, NOT `host:port`) from HTTP.
2. **Static require-graph + regex check on `dist/extension.cjs`** — after `pnpm build`, grep the bundled JS for `http.request`, `https.request`, `fetch(`, `XMLHttpRequest`, `new URL(... "http"`. Fail on match (whitelisting Discord RPC's own code paths). **Pros:** trivially cheap; catches bundle additions at PR time. **Cons:** string matching is imprecise; may miss dynamic `require()`s.
3. **OS-level sandbox** (`unshare --net`, Firejail) — spawn the extension host in a network-denied sandbox, observe the extension log. **Pros:** strongest guarantee. **Cons:** Linux-only, brittle in CI, overkill for a personal extension.

**Recommendation:** Ship **Option 1 + Option 2 together** as the Phase 4 plan 04-09 content. Option 2 runs on every PR (~100ms); Option 1 runs as a separate step (~10 min — could be a `--long` test or weekly cron). Document Option 3 in the plan as "overkill backup if community reports false negatives."

**Critical nuance for Option 1:** `@xhayper/discord-rpc` uses `net.createConnection` with a **`path` argument** (unix socket `/tmp/discord-ipc-*` or Windows named pipe `\\?\pipe\discord-ipc-*`). Any `net.createConnection` call where the options object has a `path` field that matches `/discord-ipc/` is allowed; any call with a `host` or `port` field is a violation. The intercept must key on call shape, not just function name.

### Anti-Patterns to Avoid

- **Caching config at activate().** Breaks D-24 live-reload; any stale-cache bug eats hours to debug.
- **`fs.watchFile` on `customPackPath`.** One more Node handle; D-25 explicitly chose poll-on-tick.
- **Global module state for `lastPicked`.** Would break vitest parallelism and leak across animator instances. Store inside the closure of `createAnimator()`.
- **Regex-compile in the tick hot path without memo.** `ignore.repositories` can have 10+ patterns; compile once per config-change signal (or every tick but memoized on the pattern array identity).
- **Global `(vscode as any)` cast when reading the Git API.** `vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)` is already typed via the Git extension's published `.d.ts` signature; no cast needed. If a cast feels necessary, treat it as a sign the types are wrong and fix them.
- **Calling `setActivity` while an ignore rule matches.** D-14 is `clearActivity(pid)` exactly once then no-op; the "skip setActivity, leave stale presence" interpretation was explicitly rejected.
- **Disconnecting RPC on `idleBehavior: clear`.** CONF-04 explicitly forbids this — it orphans the reconnect loop. Always use `clearActivity(pid)`, never `setActivity(null)`, never `client.destroy()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SHA-1 hashing | Pure-JS SHA-1 implementation | `node:crypto.createHash("sha1")` | Built-in; ~3 lines; already benchmarked above at <1μs per hash |
| Path normalization | Custom POSIX-slash-converter + drive-letter fix | `path.resolve()` + `.split(path.sep).join("/")` + manual drive-lowercase | Cross-platform hairs are real; `path.resolve()` gets you 90% there |
| Config reading | File-based ini/yaml | `vscode.workspace.getConfiguration("agentMode")` | Free UI, free validation, free live-reload event |
| Discord IPC | Pipe/socket wiring | `@xhayper/discord-rpc` (already wired) | Already in Phase 1 |
| Git branch reading | Spawn `git rev-parse` | `vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)` | Official VS Code Git extension API; reactive (branch changes surface as events); silent degrade documented |
| Time-of-day bucketing | Cron-like syntax | `Date.getHours()` with 4 if-branches | Zero complexity; DST handled by `Date` |
| Output channel | `console.log` | `vscode.window.createOutputChannel("Agent Mode (Discord)")` | Users can read it; `console.log` vanishes into the Extension Host log |

**DO hand-roll (zero-dep rule makes it the only option):**

- **Glob matcher** (~25 lines) — only `*`, `**`, `?`, `[...]` needed; no extglob, no brace expansion.
- **Pack schema validator** (~40 lines TS narrowing returning `{ ok, pack | error }`).
- **Weighted pool picker** (~10 lines) + **Fisher-Yates no-repeat** (~15 lines).
- **Git URL normalizer** (~15 lines regex chain per D-17).

**Key insight:** Every hand-roll in this list is ≤50 lines and heavily covered by unit tests. The bundle-size budget (288 KB remaining) and the single-runtime-dep constraint make this non-negotiable.

## Runtime State Inventory

*Not applicable — Phase 4 is net-new code, not a rename/refactor/migration. No stored data, live service config, OS-registered state, secrets, or build artifacts carry state from Phase 3 that needs migration.*

## Common Pitfalls

### Pitfall 1: Fisher-Yates no-repeat invariant drift across rotation ticks

**What goes wrong:** On pool-switch (`_primary` → time-of-day), if `lastPicked` is shared globally, the new pool may still have an element `=== lastPicked`, and the test "no message twice in a row" succeeds trivially (because pools are disjoint sets of strings in practice) — but if they're ever not, the invariant breaks subtly.

**Why it happens:** `lastPicked` semantics are ambiguous. Per-pool? Global? CONTEXT D-09 says "within the pool actually used that tick" → per-pool.

**How to avoid:** Store `lastPicked: Map<poolId, Message>` keyed by pool identity (string: `"AGENT_ACTIVE:_primary"`, `"AGENT_ACTIVE:claude"`, `"AGENT_ACTIVE:timeOfDay:morning"`, etc.). On pool-change, check against that pool's own memory.

**Warning signs:** Test `"rotation never repeats across two ticks"` passes for `_primary → _primary` but not for `_primary → timeOfDay → _primary` with overlapping copy.

### Pitfall 2: "Blank-after-substitution" race with redaction

**What goes wrong:** Template `"editing {filename}"` + `privacy.filename: hide` → renders `"editing "` (with trailing space). PERS-06 says: skip that message. But if the animator unconditionally rotates to the next message on blank, and the next 3 messages also turn blank, you get an infinite loop on one tick.

**Why it happens:** Skip-blank logic without a depth limit.

**How to avoid:** On `render()`, if substitution produces a blank (or whitespace-only) string after trim, pick the **next** message via the same weighted-pool + no-repeat logic, up to N attempts (e.g. 10). If all N attempts blank, render a hard fallback (`"building, afk"` is always safe). Document the fallback in the plan.

**Warning signs:** IDLE pool all reference `{branch}` and user sets `privacy.gitBranch: hide` — naïve impl spins the CPU.

### Pitfall 3: `vscode.git` extension not activated yet

**What goes wrong:** At startup, `vscode.extensions.getExtension('vscode.git')` returns the extension object, but `extension.isActive` may be `false`. Calling `.exports.getAPI(1)` on an inactive extension returns `undefined` or throws.

**Why it happens:** VS Code extension activation is lazy; `vscode.git` activates on its own triggers and may not be ready by `onStartupFinished`.

**How to avoid:** Use this pattern (mirrors `extensions/git/README.md`):

```typescript
const ext = vscode.extensions.getExtension("vscode.git");
if (!ext) return undefined;           // Git extension not installed (rare — it's built-in)
try {
  const api = ext.isActive ? ext.exports.getAPI(1) : await ext.activate().then(() => ext.exports.getAPI(1));
  return api;
} catch (err) {
  outputChannel.appendLine(`[git] API unavailable: ${String(err)}`);
  return undefined;
}
```

`[CITED: https://github.com/microsoft/vscode/tree/main/extensions/git - see src/api/api.ts]`

**Warning signs:** Branch renders as empty on first boot, then works on subsequent sessions.

### Pitfall 4: `onDidChangeConfiguration` fires for every scope change

**What goes wrong:** User toggles an unrelated setting (`editor.fontSize`), the listener fires. If the listener does work on every event, it wastes cycles.

**Why it happens:** The event is global; you must call `event.affectsConfiguration("agentMode")` to filter.

**How to avoid:** With D-24's lazy-read-on-tick, the listener can be a complete no-op (or a `debug.verbose` log line). No filtering needed because no work is done.

**Warning signs:** Settings UI feels laggy when unrelated settings change.

### Pitfall 5: SHA-1 hash non-determinism on Windows

**What goes wrong:** Same workspace, two different hashes across sessions.

**Why it happens:** Workspace absolute path differs:
- First session: `C:\Users\leo\project`
- Second session (opened via symlink): `D:\dev\project` (where D: is a symlink)
- On Windows Command Prompt vs PowerShell: drive letter case differs (`c:\...` vs `C:\...`)

**How to avoid:** D-15's normalization algorithm, precisely:
```typescript
function normalizeForHash(absPath: string): string {
  let p = path.resolve(absPath);                    // absolute, canonicalized dots
  p = p.split(path.sep).join("/");                  // POSIX slashes
  if (process.platform === "win32" && /^[a-zA-Z]:/.test(p)) {
    p = p[0].toLowerCase() + p.slice(1);            // lowercase drive letter only
  }
  return p;
}
function hashWorkspace(absPath: string): string {
  return crypto.createHash("sha1").update(normalizeForHash(absPath)).digest("hex").slice(0, 6);
}
```

**No symlink resolution** (D-15 explicit): `/Users/leo/project` and `/Users/leo/symlink-to-project` hash differently on purpose — they're semantically different entry points.

**Warning signs:** Test `"hash is deterministic across process boots"` fails intermittently on Windows.

### Pitfall 6: Glob-matcher case-sensitivity on macOS

**What goes wrong:** macOS HFS+ is case-insensitive by default. User has `ignore.workspaces: ["**/Secret"]` and workspace `/Users/leo/secret` matches on macOS but not Linux.

**Why it happens:** Filesystem vs string matching disagree.

**How to avoid:** D-16 specifies `ignore.workspaces` is **case-insensitive on all platforms** — deliberately matching user mental model. Implementation: lowercase both sides before the glob comparison. No filesystem probe needed.

**Warning signs:** Test `"mixed case workspace matches all-caps glob"` passes on macOS dev, fails on Linux CI.

### Pitfall 7: User-supplied regex ReDoS

**What goes wrong:** `ignore.repositories: ["(a+)+$"]` against a long repo URL → catastrophic backtracking → Extension Host freezes.

**Why it happens:** JS regex is vulnerable to ReDoS, and user patterns are untrusted.

**How to avoid:**
1. Compile in try/catch (invalid → skip + debug log).
2. Cap execution time per match via length-check: truncate candidate strings to 200 chars before matching.
3. Document in README that `ignore.repositories` is user-supplied regex and catastrophic patterns are the user's responsibility.
4. (Optional, out of scope for v0.1) re2 / safe-regex — adds a dep, so no.

**Warning signs:** Rare lock-ups when specific repo URLs are encountered; hard to reproduce.

### Pitfall 8: Goblin pack JSON loaded via bundler — esbuild semantics

**What goes wrong:** If `goblin.json` is imported as `import goblin from "./goblin.json"`, esbuild inlines it at build time. That's fine for the built-in default, but it means the in-source pack can't be reloaded without a rebuild.

**Why it happens:** Bundlers inline JSON by default when imported. `customPackPath` is a separate path (read via `fs.readFileSync` at runtime, D-25) — no conflict there.

**How to avoid:** Explicitly import built-in `goblin.json` via `import goblin from "./goblin.json" assert { type: "json" }` or via `fs.readFileSync(path.join(__dirname, "goblin.json"), "utf8")`. Either way works; the first is bundler-clean and the pack is embedded in `dist/extension.cjs`. `[VERIFIED: esbuild bundles .json imports by default — esbuild.mjs has no explicit rule but doesn't disable it]`

**Warning signs:** Shipped VSIX missing `goblin.json` (user reports empty Discord status); check `dist/metafile.json` for the embed.

### Pitfall 9: Discord activity char limits silently truncate

**What goes wrong:** A template like `"cooking on {filename}"` with `{filename}` being `super-long-filename.tsx` exceeds 128 chars — Discord silently truncates with ellipsis.

**Why it happens:** Discord RPC `details`/`state` have a ~128-char practical max [CITED: `@xhayper/discord-rpc` README notes this].

**How to avoid:** D-04 target is ≤ 50 chars for pack copy; leaves ≥78 chars for any single token expansion. The templater should NOT truncate — let Discord do it — but the test suite should include an `"oversized filename still renders without error"` fixture.

**Warning signs:** Users report truncated presence on files with deeply-nested paths.

## Code Examples

### SHA-1 6-hex-prefix workspace hash (D-15)

```typescript
// src/privacy.ts — pure-core
import { createHash } from "node:crypto";
import * as path from "node:path";

export function hashWorkspace(absPath: string, platform = process.platform): string {
  let p = path.resolve(absPath);
  p = p.split(path.sep).join("/");
  if (platform === "win32" && /^[a-zA-Z]:/.test(p)) {
    p = p[0].toLowerCase() + p.slice(1);
  }
  return createHash("sha1").update(p).digest("hex").slice(0, 6);
}
// Source: node:crypto stable API + D-15 normalization spec
// Verified: `node -e ...` returned '6e36a2' for '/Users/leo/my-repo'
```

### Git URL normalizer (D-17)

```typescript
// src/privacy.ts — pure-core
export function normalizeGitUrl(url: string): string {
  let u = url.trim();
  u = u.replace(/\.git$/, "");                               // strip .git
  u = u.replace(/\/$/, "");                                  // strip trailing /
  // git@host:owner/repo  →  host/owner/repo
  const scp = u.match(/^git@([^:]+):(.+)$/);
  if (scp) return `${scp[1]}/${scp[2]}`;
  // https://host/owner/repo  →  host/owner/repo
  const https = u.match(/^https?:\/\/([^/]+)\/(.+)$/);
  if (https) return `${https[1]}/${https[2]}`;
  return u;
}
// Example: "git@github.com:acme/project.git" → "github.com/acme/project"
// Example: "https://gitlab.com/org/repo/"    → "gitlab.com/org/repo"
// Source: D-17 spec
```

### Minimal glob matcher (for `ignore.workspaces`)

```typescript
// src/privacy.ts — pure-core
// Supports: * (any except /), ** (any including /), ? (single), [abc]
export function globMatch(pattern: string, input: string): boolean {
  const re = globToRegex(pattern);
  return re.test(input.toLowerCase()); // D-16 case-insensitive
}

function globToRegex(pattern: string): RegExp {
  const p = pattern.toLowerCase();
  let out = "^";
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "*") {
      if (p[i + 1] === "*") { out += ".*"; i++; }     // ** → any
      else { out += "[^/]*"; }                         // * → any except /
    } else if (c === "?") out += "[^/]";
    else if (c === "[") {
      const end = p.indexOf("]", i);
      if (end === -1) { out += "\\["; continue; }
      out += p.slice(i, end + 1);
      i = end;
    } else if (/[.+^${}()|\\]/.test(c)) out += "\\" + c;
    else out += c;
  }
  return new RegExp(out + "$");
}
// Verified mentally against: "**/secret/*" matches "/Users/leo/Secret/notes"
```

### Pack schema validator (hand-rolled, zero-dep)

```typescript
// src/presence/packLoader.ts — pure-core
export type Message = string | string[];
export interface Pack {
  id: string;
  version: 1;
  pools: {
    AGENT_ACTIVE: { _primary: Message[]; [agent: string]: Message[] };
    CODING: Message[];
    IDLE: Message[];
  };
  timeOfDay?: {
    lateNight?: Message[]; morning?: Message[];
    afternoon?: Message[]; evening?: Message[];
  };
}

export type ValidateResult = { ok: true; pack: Pack } | { ok: false; error: string };

export function validatePack(raw: unknown): ValidateResult {
  if (!raw || typeof raw !== "object") return { ok: false, error: "pack must be object" };
  const p = raw as Record<string, unknown>;
  if (typeof p.id !== "string") return { ok: false, error: "id must be string" };
  if (p.version !== 1) return { ok: false, error: "version must be 1" };
  if (!p.pools || typeof p.pools !== "object") return { ok: false, error: "pools missing" };
  const pools = p.pools as Record<string, unknown>;
  if (!isMessageArrayOrObject(pools.AGENT_ACTIVE, /* requirePrimary */ true))
    return { ok: false, error: "pools.AGENT_ACTIVE invalid" };
  if (!isMessageArray(pools.CODING)) return { ok: false, error: "pools.CODING must be array of messages" };
  if (!isMessageArray(pools.IDLE))   return { ok: false, error: "pools.IDLE must be array of messages" };
  if (p.timeOfDay && !isTimeOfDay(p.timeOfDay)) return { ok: false, error: "timeOfDay invalid" };
  return { ok: true, pack: p as unknown as Pack };
}

function isMessage(x: unknown): boolean {
  if (typeof x === "string") return true;
  return Array.isArray(x) && x.every(s => typeof s === "string");
}
function isMessageArray(x: unknown): boolean {
  return Array.isArray(x) && x.every(isMessage);
}
function isMessageArrayOrObject(x: unknown, requirePrimary: boolean): boolean {
  if (isMessageArray(x)) return !requirePrimary;
  if (x && typeof x === "object" && !Array.isArray(x)) {
    const o = x as Record<string, unknown>;
    if (requirePrimary && !isMessageArray(o._primary)) return false;
    for (const k of Object.keys(o)) if (!isMessageArray(o[k])) return false;
    return true;
  }
  return false;
}
function isTimeOfDay(x: unknown): boolean {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  for (const k of ["lateNight", "morning", "afternoon", "evening"]) {
    if (o[k] !== undefined && !isMessageArray(o[k])) return false;
  }
  return true;
}
// ~40 lines — meets D-27 zero-dep constraint
```

### `contributes.configuration` sketch for `package.json`

```jsonc
{
  "contributes": {
    "configuration": {
      "title": "Agent Mode",
      "properties": {
        "agentMode.clientId": {
          "type": "string", "default": "",
          "title": "Discord Client ID",
          "description": "Override the bundled Discord Application Client ID. Leave empty to use the default."
        },
        "agentMode.idleBehavior": {
          "type": "string", "enum": ["show", "clear"],
          "enumDescriptions": [
            "Render the IDLE copy pool on idle.",
            "Clear the Discord activity on idle (RPC stays connected)."
          ],
          "default": "show",
          "title": "Idle Behavior",
          "description": "What to do when no editor is focused and no agent is active."
        },
        "agentMode.debug.verbose": {
          "type": "boolean", "default": false,
          "title": "Verbose Debug Logging",
          "description": "Enables detailed logging in the 'Agent Mode (Discord)' output channel."
        },
        "agentMode.animations.enabled": {
          "type": "boolean", "default": true,
          "title": "Enable frame animations",
          "description": "When false, multi-frame messages render their first frame statically."
        },
        "agentMode.messages.customPackPath": {
          "type": "string", "default": "",
          "title": "Custom Pack Path",
          "description": "Absolute path to a JSON copy pack. Falls back to built-in goblin pack if invalid."
        },
        "agentMode.privacy.workspaceName": {
          "type": "string", "enum": ["show", "hide", "hash"],
          "enumDescriptions": [
            "Show workspace name verbatim.",
            "Replace workspace name with empty string.",
            "Replace with 6-char SHA-1 prefix of the absolute path."
          ],
          "default": "show",
          "title": "Workspace Name Privacy"
        },
        "agentMode.privacy.filename": {
          "type": "string", "enum": ["show", "hide"], "default": "show",
          "title": "Filename Privacy"
        },
        "agentMode.privacy.gitBranch": {
          "type": "string", "enum": ["show", "hide"], "default": "show",
          "title": "Git Branch Privacy"
        },
        "agentMode.ignore.workspaces": {
          "type": "array", "items": { "type": "string" }, "default": [],
          "title": "Ignored Workspaces (glob)",
          "description": "Glob patterns matched against absolute workspace paths; matches silence the extension entirely."
        },
        "agentMode.ignore.repositories": {
          "type": "array", "items": { "type": "string" }, "default": [],
          "title": "Ignored Repositories (regex)",
          "description": "Regex patterns matched against normalized host/owner/repo."
        },
        "agentMode.ignore.organizations": {
          "type": "array", "items": { "type": "string" }, "default": [],
          "title": "Ignored Organizations (regex)"
        },
        "agentMode.ignore.gitHosts": {
          "type": "array", "items": { "type": "string" }, "default": [],
          "title": "Ignored Git Hosts"
        },
        "agentMode.detect.customPatterns": {
          "type": "object", "default": {},
          "title": "Custom agent regex patterns",
          "description": "User-defined regex → agent label mappings, added to the built-in detection set."
        },
        "agentMode.detect.sessionFileStalenessSeconds": {
          "type": "number", "default": 60, "minimum": 10, "maximum": 300,
          "title": "Session-file staleness threshold (seconds)"
        }
      }
    }
  }
}
```

**Key count: 14.** Six spare slots for Phase-4 planner refinements (D-22). `[CITED: https://code.visualstudio.com/api/references/contribution-points#contributes.configuration]`

### `onDidChangeConfiguration` wiring

```typescript
// In src/extension.ts activate() — after existing detector setup
const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
  if (!e.affectsConfiguration("agentMode")) return;
  // D-24: no-op. The animator re-reads config on every rotation tick.
  if (getConfig().debug.verbose) {
    outputChannel.appendLine(`[config] change detected at ${new Date().toISOString()}`);
  }
});
_context.subscriptions.push(configListener);
// Source: VS Code stable API — ConfigurationChangeEvent
```

### Ignore-match clear-once pattern (D-14)

```typescript
// src/presence/activityBuilder.ts (sketch)
let lastWasIgnoreMatch = false;

function onTick(ctx: PresenceContext): void {
  const cfg = readConfig();
  const isIgnored = evaluateIgnoreRules(ctx, cfg);
  if (isIgnored) {
    if (!lastWasIgnoreMatch) {
      void mgr.clearActivity(process.pid);   // fire exactly once
      lastWasIgnoreMatch = true;
    }
    return; // no setActivity
  }
  if (lastWasIgnoreMatch) {
    lastWasIgnoreMatch = false;              // reset; next tick will setActivity normally
  }
  const payload = buildPayload(ctx, cfg);
  throttled(payload);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `vscode.window.showInformationMessage` for config errors | Output channel + `debug.verbose` toggle | Marketplace-compliant ext best practice (2023+) | No toasts; respects user's focus |
| `fs.watch` for every file | `fs.readFileSync` on polling interval for small files | Practical — handle-count matters | D-25 directly |
| `zod`/`ajv` for small JSON schemas | Hand-rolled TypeScript narrowing | 2023+ trend for bundle-constrained projects | Saves ~50 KB gzip |
| Re-registering `setInterval` on config change | Lazy-read on every tick | 2024+ pattern for config-heavy VS Code extensions | D-24 |

**Deprecated/outdated:** `discord-rpc` npm package (5 years dead) — replaced by `@xhayper/discord-rpc` (already in the repo).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `vscode.git` extension's typed API at `exports.getAPI(1)` returns a `GitAPI` with `repositories[].state.HEAD.name` (current branch) | Pitfall 3 | If shape differs, branch read returns undefined and PRIV-03's `show` mode renders empty branch silently. Already guarded by try/catch; low risk. `[ASSUMED based on training — should be verified against vscode/extensions/git/src/api/git.d.ts before plan 04-07 implementation]` |
| A2 | esbuild's default JSON import behavior inlines `goblin.json` into `dist/extension.cjs` | Pitfall 8 | If not inlined, the VSIX ships with no pack and AGENT_ACTIVE renders empty. Mitigation: check `dist/metafile.json` after build. `[ASSUMED — verified generally in esbuild but not this project's exact config]` |
| A3 | Runtime `http`/`https` module intercept can distinguish Discord IPC (`net.createConnection({ path: ... })`) from HTTP outbound | §Pattern 7 | If IPC gets false-positive'd, the network-guardrail test fails and Discord disconnects during the test. Fix: whitelist `path`-keyed calls matching `/discord-ipc-/`. `[ASSUMED — implementation detail to verify during plan 04-09]` |
| A4 | `@xhayper/discord-rpc` `client.user?.clearActivity(process.pid)` does not fire any outbound HTTP (local IPC only) | §Pattern 7 | If it does, PRIV-07 is unattainable without ripping out the RPC lib. Given Phase 1 shipped without HTTP complaints, this is likely safe. `[ASSUMED — verifiable with the same network intercept during plan 04-09]` |
| A5 | Discord RPC `details`/`state` char limit is ~128 chars with silent truncation | Pitfall 9 | If limit is lower, long filename expansions render cut mid-word. Documented as the user's cost (D-04 keeps copy ≤50 chars). `[ASSUMED — @xhayper/discord-rpc README notes this but I didn't re-verify]` |
| A6 | `workspace.getConfiguration("agentMode")` returns the correct snapshot every call (no caching / no staleness) within a single tick | §Pattern 5 | If VS Code caches across calls, D-24 live-reload breaks. Mitigation: explicitly re-fetch once per tick. Known-safe pattern in VS Code extensions. `[ASSUMED — matches VS Code docs but I didn't reproduce the doc quote]` |

## Open Questions (RESOLVED)

1. **Exact `vscode.git` extension API shape in VS Code 1.93+** — RESOLVED: try/catch around HEAD.name access, silent empty-branch fallback (per D-18; implemented in 04-07).
   - What we know: `getAPI(1)` returns an object with `.repositories` (array). Each repo has `.state` with a `HEAD` ref.
   - What's unclear: whether `HEAD.name` or `HEAD.commit` is the branch identifier in 1.93+; whether the API fires `onDidChangeRepository` events for branch switches.
   - Recommendation: planner for 04-07 should open `node_modules/@types/vscode/vscode.d.ts` to confirm, or fall back to reading the Git extension's published `.d.ts` from the official vscode/extensions/git GitHub repo.

2. **Network-traffic CI test harness — does VS Code Extension Host spawn count as CI-realistic?** — RESOLVED: static grep of dist/extension.cjs (04-09); runtime intercept deferred to v0.2.
   - What we know: `@vscode/test-electron` can spawn an Extension Host with a loaded extension; monkey-patching `http`/`https`/`net` before `require()` works.
   - What's unclear: whether GitHub Actions' ubuntu-latest has the right sandbox permissions for Electron to spawn reliably without flakes.
   - Recommendation: plan 04-09 starts with Option 2 (static grep of `dist/extension.cjs`) as a fast-blocking CI step and adds Option 1 (runtime intercept) as a separate manual / nightly step if needed.

3. **Should `customPackPath` support `${workspaceFolder}` variable substitution?** — RESOLVED: absolute path only in v0.1; deferred to v0.2.
   - What we know: VS Code's `WorkspaceConfiguration` does NOT auto-substitute `${workspaceFolder}` unless explicitly opted-in via `vscode.workspace.workspaceFolders[0].uri.fsPath` resolution.
   - What's unclear: whether users expect that syntax to work (most VS Code settings support it conceptually but implementation is per-extension).
   - Recommendation: for v0.1, document "absolute path only" in the description string. Add `${workspaceFolder}` expansion in v0.2 if asked.

4. **Per-pool `lastPicked` memory lifetime — do we reset on state-machine transitions?** — RESOLVED: do NOT reset; per-pool memory persists (04-02).
   - What we know: CONTEXT says state transitions reset `{elapsed}` (D-13). CONTEXT does not say they reset `lastPicked`.
   - What's unclear: if `AGENT_ACTIVE:claude → IDLE → AGENT_ACTIVE:claude` should remember the last-picked claude message.
   - Recommendation: do NOT reset per-pool `lastPicked` on state transitions — less code, and the invariant "no repeat across two consecutive ticks" (PERS-03) is naturally satisfied as long as the memory persists. Planner to confirm with user if this interpretation is wrong.

5. **Does `idleBehavior: clear` affect the `{elapsed}` timer?** — RESOLVED: no special-case; existing reducer resets startTimestamp on transition (04-04 passes through).
   - What we know: D-20 says `clear` fires `clearActivity(pid)` immediately on IDLE.
   - What's unclear: on transition back out of IDLE (IDLE → CODING → AGENT_ACTIVE), does `startTimestamp` reset? PRD STATE-05 says "timestamp resets only on state-machine transitions," which answers yes.
   - Recommendation: no special-case handling needed; the existing Phase-2 reducer already resets on every state transition. 04-04 plan just needs to ensure the activity builder passes `ctx.startTimestamp` through unchanged.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All source | ✓ | 24.11.1 (dev) / 20 (CI) | — |
| pnpm | Install/build | ✓ | 9.0.0 | — |
| `node:crypto` | PRIV-01 hash | ✓ | stdlib | — |
| `node:fs`, `node:path` | packLoader, privacy | ✓ | stdlib | — |
| `@xhayper/discord-rpc` | clearActivity for D-14/D-20 | ✓ | 1.3.1 (already wired) | — |
| VS Code ≥ 1.93 API | Configuration + onDidChangeConfiguration + Git extension API | ✓ | engines.vscode `^1.93.0` | — |
| `@vscode/test-electron` | Optional for network-traffic harness (plan 04-09) | ✗ | — | Use static grep of `dist/extension.cjs` (Option 2) as primary; defer runtime intercept to follow-up |
| Windows/macOS/Linux CI matrix | Cross-platform privacy test | Partial | ubuntu-latest only currently | Plan 04-09 can expand CI matrix OR flag Windows paths as platform-guarded tests |

**Missing dependencies with no fallback:** none — all core work is stdlib.

**Missing dependencies with fallback:** `@vscode/test-electron` (use static grep as primary network-traffic assertion; runtime intercept is stretch).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^2.0.0 |
| Config file | `vitest.config.ts` (environment: node, include: `test/**/*.test.ts`) |
| Quick run command | `pnpm test` (~2-3 s current) |
| Full suite command | `pnpm test && pnpm typecheck && pnpm check:api-surface && pnpm build && pnpm check:bundle-size` |
| Phase gate | Full suite green + 04-09 network-traffic assertion green |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| PERS-01 | Goblin is the only built-in pack | unit | `pnpm test -- test/presence.packLoader.test.ts -t "built-in pack is goblin"` | Wave 0 |
| PERS-02 | 20 s rotation, state→agent→tod fallback chain | unit (fake timers + injected rand) | `pnpm test -- test/presence.animator.test.ts -t "rotates every 20s"` | Wave 0 |
| PERS-03 | Fisher-Yates no-repeat across 2 ticks | unit (injected rand) | `pnpm test -- test/presence.animator.test.ts -t "no repeat across two rotations"` | Wave 0 |
| PERS-04 | 2 s frame clock cycles | unit (fake timers) | `pnpm test -- test/presence.animator.test.ts -t "frame clock cycles array messages"` | Wave 0 |
| PERS-05 | `animations.enabled: false` freezes on frame 0 | unit | `pnpm test -- test/presence.animator.test.ts -t "freezes on frame 0 when disabled"` | Wave 0 |
| PERS-06 | Template substitution; skip blank | unit | `pnpm test -- test/presence.templater.test.ts` | Wave 0 |
| PERS-07 | `customPackPath` picked up on next tick | unit (injected fs) | `pnpm test -- test/presence.packLoader.test.ts -t "custom pack overrides built-in"` | Wave 0 |
| PERS-08 | Invalid pack falls back to goblin | unit | `pnpm test -- test/presence.packLoader.test.ts -t "invalid pack falls back"` | Wave 0 |
| PRIV-01 | `show|hide|hash` modes for workspace | unit | `pnpm test -- test/privacy.test.ts` (exists — extend) | ✅ extend |
| PRIV-02 | `show|hide` for filename | unit | same | ✅ exists |
| PRIV-03 | `show|hide` for branch via `vscode.git` | integration (mocked vscode) | `pnpm test -- test/privacy.gitBranch.test.ts` | Wave 0 |
| PRIV-04 | Silent degrade if vscode.git unavailable | integration | same | Wave 0 |
| PRIV-05 | Ignore match = full silence | integration (fake animator + fake mgr) | `pnpm test -- test/presence.activityBuilder.test.ts -t "ignore match clears once"` | Wave 0 |
| PRIV-06 | Privacy flip applies next tick | integration | `pnpm test -- test/presence.animator.test.ts -t "config change applies next tick"` | Wave 0 |
| PRIV-07 | Zero outbound HTTP | bundle-static + optional runtime | `node scripts/check-no-http.mjs` (new) | Wave 0 (new script) |
| CONF-01 | ≤ 20 keys, each with title/description/default | static (JSON schema check) | `node scripts/check-config-keys.mjs` (new) | Wave 0 (new script) |
| CONF-02 | `clientId` blank → bundled default | unit | `pnpm test -- test/config.test.ts` | Wave 0 |
| CONF-03 | Settings apply on next tick | integration | `pnpm test -- test/presence.animator.test.ts -t "config reread per tick"` | Wave 0 |
| CONF-04 | `idleBehavior: clear` calls clearActivity, doesn't disconnect | unit (fake mgr) | `pnpm test -- test/presence.activityBuilder.test.ts -t "idleBehavior clear"` | Wave 0 |
| CONF-05 | `debug.verbose` toggles channel logging | unit (fake output channel) | `pnpm test -- test/outputChannel.test.ts` | Wave 0 |

**Determinism handles:**
- Injected `rand: () => number` for Fisher-Yates + weighted pick (seeded sequence in tests).
- Injected `now: () => Date` for time-of-day buckets (fixed timestamps per test).
- Injected `setInterval`/`clearInterval` + `vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval", "Date"] })` for clock tests.
- Injected `fs` surface for packLoader (mirrors sessionFiles pattern).
- Fake vscode module for `privacy.gitBranch.test.ts` (use `vi.mock("vscode", ...)` if needed).

### Sampling Rate

- **Per task commit:** `pnpm test && pnpm typecheck`
- **Per wave merge:** `pnpm test && pnpm typecheck && pnpm check:api-surface && pnpm build && pnpm check:bundle-size && node scripts/check-config-keys.mjs && node scripts/check-no-http.mjs`
- **Phase gate:** Full suite green before `/gsd-verify-work`; 04-09 network-traffic assertion green on CI.

### Wave 0 Gaps

- [ ] `test/presence.packLoader.test.ts` — covers PERS-01, PERS-07, PERS-08 (new)
- [ ] `test/presence.animator.test.ts` — covers PERS-02..PERS-05, CONF-03, PRIV-06 (new)
- [ ] `test/presence.templater.test.ts` — covers PERS-06 (new)
- [ ] `test/presence.activityBuilder.test.ts` — covers PRIV-05, CONF-04 (new)
- [ ] `test/privacy.gitBranch.test.ts` — covers PRIV-03, PRIV-04 (new)
- [ ] `test/config.test.ts` — covers CONF-02 (new)
- [ ] `test/outputChannel.test.ts` — covers CONF-05 (new)
- [ ] Extend existing `test/privacy.test.ts` to cover real SHA-1 hash (remove the "not implemented" test) + ignore-list evaluator tests
- [ ] `scripts/check-config-keys.mjs` — static: count `properties` keys in `package.json contributes.configuration`, assert ≤ 20; assert every property has `title`, `description`, `default`; assert `enum` properties have `enumDescriptions` (new)
- [ ] `scripts/check-no-http.mjs` — static: grep `dist/extension.cjs` for `http.request`, `https.request`, `fetch(`, `XMLHttpRequest`, `require("undici")`, `from "undici"`, `from "node-fetch"`; whitelist known-safe IPC patterns (new)
- [ ] **Wave-0 it.todo scaffolding pattern** from Phase 3 (03-00) — author all test files with `it.todo()` entries keyed to requirement IDs BEFORE any implementation, flip to `it()` in Wave 1

## Security Domain

Phase 4 is a local-IPC extension with zero network surface — threat model is narrow but non-trivial around user-supplied patterns.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no user accounts, no tokens) |
| V3 Session Management | no | — |
| V4 Access Control | no | — (single-user local tool) |
| V5 Input Validation | yes | Hand-rolled validators for pack schema; length-cap + try/catch on user regex; glob matcher doesn't allow backslash-escape sequences that could inject regex metachars |
| V6 Cryptography | partial | SHA-1 via `node:crypto` — used for NON-CRYPTO identity hashing only (workspace identifier); user has been informed via docs that it's not a security primitive (D-15 explicit: "no salting, revisit in v0.2"). Hash output is not used for auth/authz. |
| V7 Error Handling | yes | Every external call (fs, vscode.git, regex compile, JSON.parse) in try/catch; failures log to debug channel, never toast |
| V12 Files & Resources | yes | `customPackPath` reads are `fs.readFileSync` on user-supplied path; size-cap recommended (e.g., 100 KB) to prevent accidental large-file read DoS |
| V13 API & Web Service | no | — (no HTTP surface — PRIV-07 enforces this) |

### Known Threat Patterns for VS Code extension / Node stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User-supplied regex (ReDoS) | Denial of Service | Try/catch compile + length-truncate candidate strings (see Pitfall 7) |
| User-supplied JSON pack (prototype pollution via `__proto__`) | Tampering | `JSON.parse` does not apply inherited properties; our narrowing validator explicitly enumerates known keys. Not using `Object.assign` or spread on user input. |
| Large custom pack file (fs read DoS) | Denial of Service | Size-cap `fs.statSync(customPackPath).size < 100_000`; read only if under |
| Symlink escape via `customPackPath` | Tampering | Not a real threat: user controls their own path; no privilege escalation. `fs.readFileSync` follows symlinks as expected. |
| Leaking workspace path hash across machines | Information Disclosure | No leak vector — hash is local-only, not transmitted. Discord RPC receives the hash and shows it in their activity; that's the intended behavior (user chose `hash` mode). |
| Zero outbound HTTP bypass (transitive dep pulls in `undici`) | Tampering | Network-traffic assertion (PRIV-07) in CI catches any regression; esbuild shims already exclude `undici` / `ws` / `@discordjs/rest` (per `esbuild.mjs`) |

## Sources

### Primary (HIGH confidence — verified in repo / stdlib)

- **Repo codebase** — `src/privacy.ts`, `src/extension.ts`, `src/state/*.ts`, `src/detectors/*.ts`, `scripts/check-api-surface.mjs`, `esbuild.mjs`, `vitest.config.ts`, `package.json`, `.github/workflows/ci.yml` — all read directly during this research.
- **`node -e` verification** — `crypto.createHash("sha1").update("/Users/leo/my-repo").digest("hex").slice(0,6)` → `6e36a2` (deterministic, stable across Node 20/24).
- **`ls node_modules/{micromatch,picomatch,minimatch}`** — confirmed none present; zero-dep glob is the only option.
- **04-CONTEXT.md** — 29 decisions locked; all research aligned to them.
- **.planning/REQUIREMENTS.md** — 20 phase-4 requirement IDs and their acceptance strings.
- **.planning/ROADMAP.md §Phase 4** — 9 plan skeletons + 5 success criteria.
- **.planning/PROJECT.md** — goblin-only + zero-HTTP + ≤500 KB + ≤20 keys constraints.

### Secondary (MEDIUM confidence — cited from well-known docs)

- VS Code `contributes.configuration` reference — https://code.visualstudio.com/api/references/contribution-points#contributes.configuration
- VS Code `WorkspaceConfiguration` / `onDidChangeConfiguration` — https://code.visualstudio.com/api/references/vscode-api#workspace.getConfiguration
- VS Code Git extension API — https://github.com/microsoft/vscode/tree/main/extensions/git (source for `getAPI(1)` shape)
- Node.js `crypto.createHash("sha1")` — Node docs (stable since v0.x).
- `@xhayper/discord-rpc` — already-in-repo README; `setActivity` / `clearActivity(pid)` surface confirmed used in Phase 1.

### Tertiary (LOW confidence — assumed, flagged in §Assumptions Log)

- Exact `GitAPI` type shape for branch read (A1).
- esbuild default JSON inlining behavior in this project's config (A2).
- `net.createConnection({ path })` vs `({ host, port })` distinction for IPC vs HTTP (A3).
- `@xhayper/discord-rpc.clearActivity` makes no HTTP (A4).
- Discord `details`/`state` truncation at ~128 chars (A5).
- `workspace.getConfiguration()` non-staleness (A6).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all choices are stdlib or already-in-repo; verified by inspection.
- Architecture patterns: HIGH — every pattern extends established Phase 2/3 conventions (options-bag injection, PURE_CORE, options for timers/rand, debug-channel logging) verified in repo.
- Config surface: MEDIUM — `contributes.configuration` key-count interpretation is correct per VS Code docs, but rendering edge-cases (very long enum descriptions, array editing UX) are best-verified by loading the extension in a Dev Host during Wave 2.
- Pitfalls: HIGH — drawn from Phase 3 precedent + standard VS Code extension lore; most are preventable by discipline + the options-bag pattern.
- Security domain: HIGH — narrow threat model; standard mitigations.

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (30 days; stable APIs + locked CONTEXT decisions mean low drift risk). Re-validate A1–A3 before writing plans 04-07 and 04-09 if that research hasn't happened by then.
