---
phase: "04"
plan: "04"
subsystem: presence-activity-builder
tags: [presence, activityBuilder, ignore-clear-once, idle-behavior, pure-core, wave-3]
dependency_graph:
  requires:
    - src/presence/animator.ts (createAnimator, realAnimatorDeps, AnimatorContext — 04-02)
    - src/presence/templater.ts (TemplateTokens — 04-03)
    - src/presence/packLoader.ts (BUILTIN_GOBLIN_PACK — 04-05, for test wiring)
    - src/presence/types.ts (Pack — 04-01)
    - src/privacy.ts (redact, evaluateIgnore, IgnoreContext — 04-07)
    - src/config.ts (AgentModeConfig — 04-06)
    - src/state/types.ts (State — Phase 2)
    - test/presence.activityBuilder.test.ts (04-00 stub — 7 it.todo flipped + 23 new)
    - test/presence/__helpers__/fakeClocks.ts (makeFakeClocks virtual-time runner)
  provides:
    - src/presence/activityBuilder.ts (formatElapsed + buildTokens + buildPayload + createActivityBuilder)
    - ActivityBuilderOpts / ActivityBuilderDeps types
  affects:
    - 04-08 extension wiring (imports createActivityBuilder + wires Phase-1 RPC onSet/onClear + vscode.git IgnoreContext resolver)
tech_stack:
  added: []
  patterns:
    - Options-bag injection (getState / getConfig / getPack / onSet / onClear / getIgnoreContext / getIgnoreContext) — mirrors animator + packLoader
    - Stateful clear-once latch (lastWasCleared) covering both D-14 + D-20 code paths uniformly
    - Post-redact workspace basename (show mode) while preserving hash determinism over absolute path (hash mode)
    - Lazy getConfig/getPack per rotation tick (D-24 live-reload) — delegated to animator's renderCurrent closure
key_files:
  created:
    - src/presence/activityBuilder.ts (210 lines)
  modified:
    - test/presence.activityBuilder.test.ts (7 it.todo → 30 passing tests)
decisions:
  - Workspace display uses basename only in "show" mode (user-facing repo name, not absolute path); "hash" mode hashes the full absolute path (determinism with plan 04-07 normalizeForHash); "hide" mode returns ""
  - Empty rendered text → FALLBACK_DETAILS "building, afk" inside buildPayload — Discord RPC silently rejects empty `details`; the fallback is the phase's canonical copy (04-CONTEXT audience frame)
  - SetActivity v0.1 carries only { details, startTimestamp } — no secondary `state` string. Future v0.2 may split animator text across details/state (04-RESEARCH Claude's Discretion)
  - Task 3 (PURE_CORE_PATHS extension) was already satisfied by Wave-0's pre-seed in scripts/check-api-surface.mjs — verified grep count = 1 and pnpm check:api-surface passes with 11 pure-core files. No additional commit required; mirrors 04-02 + 04-03 handling
  - lastWasCleared reset ONLY on a successful non-ignored + non-idle-clear onSet call — per plan pitfall, never reset on forceTick() alone (otherwise a rapid state flap could fire multiple clearActivities)
  - ActivityBuilderDeps is a type alias of AnimatorDeps — both layers share the same clock/rand/timer injection surface; no new option names to learn
metrics:
  duration: ~9min
  completed: 2026-04-15
  tasks: 3
  commits: 2
---

# Phase 4 Plan 04: Activity Builder Glue Module Summary

Ships the pure-core glue that binds packLoader + animator + templater + privacy + Phase-1 RPC: `src/presence/activityBuilder.ts` (210 lines, 11th pure-core module). Exports `formatElapsed` (Discord short form), `buildTokens` (State + config → TemplateTokens with privacy redaction), `buildPayload` (rendered text + State → SetActivity), and `createActivityBuilder({ getState, getConfig, getPack, onSet, onClear, getIgnoreContext }, deps?)` — the single factory plan 04-08 will drop into extension.ts to replace the Phase-2 hardcoded buildPayload.

Implements D-14 ignore-match = clear-once-stay-silent and D-20 idleBehavior='clear' = clear-once-stay-silent via a shared `lastWasCleared` latch. RPC stays connected throughout — never calls `setActivity(null)`, never calls `destroy()`. Token redaction delegates to `redact()` from plan 04-07 per field; workspace hash preserves determinism over absolute paths while "show" mode displays the basename only.

## What Shipped

- **`src/presence/activityBuilder.ts` (210 lines, pure-core)** — four public exports + two types:
  - `formatElapsed(ms)` — Discord-convention short form. Handles NaN / undefined / negative / Infinity → "0s". Boundary: `<60s` → `${s}s`; `<60m` → `${m}m`; otherwise `${h}h ${m}m` (always emits the minute component even at round hours, e.g. `1h 0m`).
  - `buildTokens(state, cfg, now)` — resolves `TemplateTokens` (workspace / filename / language / branch / agent / elapsed) from State + AgentModeConfig. Calls `redact(field, value, mode)` per field; workspace post-processing extracts basename only in `show` mode so the user sees "my-repo" not `/Users/leo/my-repo`. Hash mode returns the 6-hex SHA-1 prefix over the full absolute path (preserves the determinism contract from plan 04-07's `normalizeForHash`). `agent` token is empty unless `state.kind === "AGENT_ACTIVE"`.
  - `buildPayload(renderedText, state)` — produces `SetActivity { details, startTimestamp }`. Empty rendered text falls back to `"building, afk"` (the canonical Phase-4 copy line) so Discord never sees an empty `details` string. `state` field stays undefined in v0.1.
  - `createActivityBuilder(opts, depsOverride?)` — wraps `createAnimator` with the decision pipeline:
    1. Build `AnimatorContext` from live State + config via the animator's `getContext` callback (lazy per rotation tick, D-24).
    2. `onRender(text)` checks `evaluateIgnore(cfg.ignore, getIgnoreContext(), log)` — on first match, call `onClear()` once and latch `lastWasCleared=true`; subsequent matches are silent no-ops.
    3. Check `state.kind === "IDLE" && cfg.idleBehavior === "clear"` — same clear-once latch.
    4. Normal path: reset `lastWasCleared=false`, call `onSet(buildPayload(text, state))`.
    Returns `{ start, stop, forceTick }` — thin wrappers over the animator.
  - Types: `ActivityBuilderOpts`, `ActivityBuilderDeps` (alias of `AnimatorDeps`).

- **30 passing tests in `test/presence.activityBuilder.test.ts`** (flipped from 7 it.todo stubs):
  - **formatElapsed** (10 tests): 0/45s/1m/20m/1h 0m/2h 15m happy cases + NaN/undefined/negative/Infinity guards.
  - **buildTokens** (8 tests): show-mode composite token resolution with 20m elapsed; per-field privacy hide (filename/branch); hash mode returns 6-hex; IDLE state → empty agent; missing workspace → empty workspace; past-time guard (`now` before `startTimestamp`) → "0s"; hash determinism (different paths → different hashes).
  - **buildPayload** (2 tests): details passthrough + startTimestamp preservation; empty text → `"building, afk"` fallback.
  - **createActivityBuilder** (10 tests): ignore clear-once across 5 ticks; ignore exit → resumes onSet pipeline; idleBehavior=clear clear-once across 3 ticks; idleBehavior=show renders IDLE pool via onSet; onClear called with zero args (RPC stays connected); startTimestamp passthrough; stop() halts all ticks; forceTick() synchronous onSet; config flip `show → clear` applies on next rotation tick; never calls onSet with null/undefined/empty details across 3 rotations.

- **`scripts/check-api-surface.mjs`** — already contains `src/presence/activityBuilder.ts` in `PURE_CORE_PATHS` (Wave-0 pre-seed, verified grep count = 1). `pnpm check:api-surface` passes with 11 pure-core files scanned — zero violations, activityBuilder.ts counted.

## Verification

| Gate | Result |
|------|--------|
| `pnpm vitest run test/presence.activityBuilder.test.ts` | PASS (30/30, zero todo) |
| `pnpm vitest run` (full suite) | PASS (309 passed across 19 files — up from 280 post-04-07) |
| `pnpm typecheck` | PASS |
| `pnpm check:api-surface` | PASS (11 pure-core files, zero violations — activityBuilder counted) |
| `pnpm build` | PASS |
| `pnpm check:bundle-size` | PASS (208.0 KB / 41.6% of 500 KB — no delta, activityBuilder not yet reachable from extension.ts bundle root) |
| `pnpm check:no-network` | PASS |
| `pnpm check:config-keys` | PASS (14/20 keys) |
| `pnpm check:pack-inlined` | **FAIL (expected, see Deferred Issues)** — flips to PASS when plan 04-08 wires activityBuilder into extension.ts |
| `wc -l src/presence/activityBuilder.ts` | 210 (< 250 soft limit buffer) |
| `grep -c "export function formatElapsed"` | 1 |
| `grep -c "export function buildTokens"` | 1 |
| `grep -c "export function buildPayload"` | 1 |
| `grep -c "export function createActivityBuilder"` | 1 |
| `grep -c "lastWasCleared"` | 8 (≥ 2 required — 1 declaration, 1 reset, 3 checks, 3 assignments) |
| `grep -c "setActivity(null)"` | 0 (forbidden per CONF-04) |
| `grep -c "destroy"` | 0 (never disconnect RPC) |
| `grep -c 'import.*from "vscode"'` | 0 (pure-core holds) |
| `grep -c "src/presence/activityBuilder.ts" scripts/check-api-surface.mjs` | 1 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing node_modules**
- **Found during:** pre-Task-1 baseline (`test -d node_modules` → MISSING; lockfile present, worktree fresh).
- **Fix:** Ran `pnpm install` (849 ms from lockfile, no version drift).
- **Scope:** dependency install only — did not modify package.json / pnpm-lock.yaml.
- **Commit:** n/a (no source changes).

### Non-deviating refinements

- **Task 3 PURE_CORE_PATHS extension was already satisfied by Wave-0.** Plan 04-00's pre-seed added `src/presence/activityBuilder.ts` to `PURE_CORE_PATHS` in `scripts/check-api-surface.mjs`. Task 3's `<action>` block anticipated this ("append only if not present"). Verified rather than applied — same pattern as plans 04-02 and 04-03.
- **`buildPayload` fallback string extracted as a named constant `FALLBACK_DETAILS = "building, afk"`** rather than an inline literal. One place to change; one place to grep for if the phase's canonical copy evolves.
- **`workspaceBasename` filters empty segments from the path split.** A trailing slash in the workspace path (e.g. `/Users/leo/my-repo/`) otherwise returns `""` as the last segment. Filter keeps the human-readable basename.
- **Test scope extended to 30 assertions** (plan indicated ~13 it.todo entries need flipping). Added additional coverage for: `language` field carry-through, past-time elapsed guard, hash-mode determinism across different paths, `onClear()` arity = 0 RPC-stay-connected contract, `forceTick()` synchronous behavior, config flip mid-session, null-payload audit across multiple rotations.

### Deferred Issues

**1. `pnpm check:pack-inlined` currently exits 1 (FAIL) — scope-boundary defer.**

The `check-pack-inlined` guardrail (added in plan 04-05) scans `dist/extension.cjs` for canonical D-05 goblin strings. It currently fails because `src/extension.ts` still imports only the Phase-2 hardcoded builder and has no path to `packLoader`. Plan 04-04's `<objective>` explicitly excludes extension.ts wiring ("What it does NOT do: actually wire itself into extension.ts — that's plan 04-08's job"). The guardrail flips to PASS automatically the moment 04-08 adds `import { createActivityBuilder } from "./presence/activityBuilder"` to extension.ts (activityBuilder.ts imports packLoader indirectly via the test wiring; the production graph wires in through 04-08's new `import { loadPack, BUILTIN_GOBLIN_PACK }`).

No action from plan 04-04 is appropriate — editing `src/extension.ts` would violate the plan's `files_modified` frontmatter.

## Threat Mitigation

| Threat ID | Disposition | Evidence |
|-----------|-------------|----------|
| T-04-10 (DoS via RPC thrash on idle flap) | mitigate | `lastWasCleared` latch ensures `onClear()` fires exactly once per ignore/idle entry; subsequent matching ticks are silent no-ops. Test `"ignore-rule match fires onClear exactly once across 5 ticks"` simulates 5 consecutive ignored ticks and asserts `onClear.callCount === 1, onSet.callCount === 0`. Test `"idleBehavior='clear' on IDLE state fires onClear exactly once across 3 ticks"` does the equivalent for the D-20 path. Recovery test `"first non-ignored tick after ignored run resumes setActivity pipeline"` verifies the latch resets correctly. |
| T-04-11 (Information Disclosure via workspace hash) | transfer | `buildTokens` calls `redact("workspace", absPath, cfg.privacy.workspaceName)` — the hash implementation lives in plan 04-07's `hashWorkspace` (SHA-1 6-hex prefix over normalized absolute path per D-15). `buildTokens` adds no new surface. Test `"privacy.workspaceName='hash' → workspace is 6-hex SHA-1 prefix"` + `"hash mode: different workspace paths → different hashes"` pin the contract. |

## Known Stubs

None. `src/presence/activityBuilder.ts` is feature-complete for CONF-04 / PERS-06 / PRIV-05 / PRIV-06 as scoped by 04-04-PLAN. Plan 04-08 owns the extension.ts wiring that turns the factory into a running presence feed.

## Threat Flags

None — this plan introduces no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. `activityBuilder.ts` consumes already-validated Pack (04-01), already-redacted tokens (04-07 redact + hashWorkspace), already-compiled ignore rules (04-07 evaluateIgnore), and State from the Phase-2 reducer (trusted pure core). The Phase-1 RPC callbacks `onSet` / `onClear` are the only side-channel and they were enumerated in the Phase-1 threat register.

## Self-Check: PASSED

- FOUND: src/presence/activityBuilder.ts (210 lines, pure-core, 0 vscode imports)
- FOUND: test/presence.activityBuilder.test.ts (flipped from 7 it.todo stubs to 30 passing tests)
- FOUND: scripts/check-api-surface.mjs (activityBuilder.ts in PURE_CORE_PATHS — seeded by 04-00, verified not re-applied)
- FOUND commit ddb31b3 (Task 1 RED: failing activityBuilder tests)
- FOUND commit 769070b (Task 1+2 GREEN: activityBuilder impl covering all 30 test assertions)
- Verified: `git log --oneline -3` shows both hashes
- Verified: `pnpm vitest run test/presence.activityBuilder.test.ts` → 30 passed, 0 todo
- Verified: `pnpm vitest run` (full suite) → 309 passed across 19 files
- Verified: `pnpm typecheck` → PASS
- Verified: `pnpm check:api-surface` → PASS (11 pure-core files)
- Verified: `pnpm build` → PASS
- Verified: `pnpm check:bundle-size` → PASS (208.0 KB / 41.6% of 500 KB)
- Verified: `pnpm check:no-network` → PASS
- Verified: `pnpm check:config-keys` → PASS (14/20)
- Verified: `grep -c "src/presence/activityBuilder.ts" scripts/check-api-surface.mjs` = 1
