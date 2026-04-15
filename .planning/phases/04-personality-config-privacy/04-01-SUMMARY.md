---
phase: "04"
plan: "01"
subsystem: presence-pack-loader
tags: [presence, packLoader, schema-validation, pure-core, wave-1]
dependency_graph:
  requires:
    - test/presence/__helpers__/packFixtures.ts (04-00 fixture)
    - test/presence.packLoader.test.ts (04-00 stub)
  provides:
    - src/presence/types.ts (Pack, Message, PoolId, ValidateResult — contracts every Wave-2 plan imports)
    - src/presence/packLoader.ts (validatePack + loadPack + realPackLoaderDeps)
    - scripts/check-api-surface.mjs PURE_CORE extended with src/presence/types.ts
  affects:
    - 04-02 animator (imports Pack, Message)
    - 04-03 templater (imports Message)
    - 04-04 activityBuilder (imports Pack)
    - 04-05 built-in goblin pack (replaces temp minimal builtin)
    - 04-07 privacy ignore-list evaluator (shares PackLoaderDeps options-bag pattern)
tech_stack:
  added: []
  patterns:
    - hand-rolled TS narrowing validator (zero-dep; D-27)
    - options-bag injection (readFile / stat / now / log) — mirrors src/detectors/sessionFiles.ts
    - Result-style discriminated union (ValidateResult { ok, pack | error })
    - prototype-pollution-safe validator (enumerated keys only; no spread on raw input)
key_files:
  created:
    - src/presence/types.ts
    - src/presence/packLoader.ts
  modified:
    - test/presence.packLoader.test.ts (10 it.todo → 15 passing tests)
    - scripts/check-api-surface.mjs (types.ts added to PURE_CORE_PATHS)
decisions:
  - Split contracts into src/presence/types.ts so Wave-2 plans import from a pure type module; packLoader.ts re-exports via `export type { … } from "./types"` for convenience
  - isAgentActivePool helper is a single-purpose check (requires _primary + every key is Message[]); replaces the plan's dual-purpose isMessageArrayOrObject(requirePrimary) helper for clarity — same behavior
  - MAX_CUSTOM_PACK_BYTES extracted as a named constant (100_000) instead of a magic number — easier to grep + future tune without touching logic
  - Test harness uses a FakeDepsState record rather than ad-hoc closures; readFileMap / statMap / throw hooks cover all six loadPack branches uniformly
  - validatePack only rejects timeOfDay when it's `!== undefined && invalid`; a missing timeOfDay key is valid (matches D-01 optional-field semantics)
metrics:
  duration: ~12min
  completed: 2026-04-15
  tasks: 2
  commits: 2
---

# Phase 4 Plan 01: Pack Loader + Schema Validator Summary

Ships the pure-core pack contract layer — `Pack / Message / ValidateResult` types, a 40-line hand-rolled schema validator, and a fs-injected `loadPack()` that executes the D-25/D-26/D-28 decision chain (prefer custom pack → size-gate at 100 KB → schema-validate → on any failure, debug-log + whole-pack fallback to built-in). Every Wave-2 plan (04-02 animator, 04-03 templater, 04-04 activityBuilder, 04-07 privacy) can now `import type { Pack, Message } from "src/presence/types"` without scavenging from competing definitions.

## What Shipped

- **`src/presence/types.ts` (40 lines)** — pure type module exporting `Pack`, `Message`, `PoolId`, `ValidateResult`. No runtime code. Matches 04-01-PLAN `<interfaces>` exactly. AGENT_ACTIVE is typed as `{ _primary: Message[]; [agent: string]: Message[] }` — object with mandatory `_primary` + open per-agent sub-pools (claude/codex in v0.1 per D-03).
- **`src/presence/packLoader.ts` (160 lines)** — three exports:
  - `validatePack(raw: unknown): ValidateResult` — hand-rolled narrowing over unknown; enumerates `id / version / pools / timeOfDay` only (T-04-02 safe); returns `{ ok: true, pack }` on success or `{ ok: false, error: string }` on failure with a descriptive error for every reject path.
  - `loadPack(opts, depsOverride?): Pack` — six-branch decision chain: empty path → builtin (no fs read); stat fails → log + builtin; size > 100 KB → log + builtin (T-04-01); readFile fails → log + builtin; JSON.parse fails → log + builtin; validator fails → log + builtin (D-26 whole-pack fallback). All error paths go through `deps.log(...)` which is a no-op by default — plan 04-08 will inject the real output-channel sink.
  - `realPackLoaderDeps: PackLoaderDeps` — `readFile: readFileSync(p, "utf8")`, `stat: statSync(p)` returning `{ size }`, `now: () => new Date()`, `log: () => {}`. Tests inject a `Partial<PackLoaderDeps>` and the loader shallow-merges over the real deps, so a test can override just `readFile` + `stat` + `log` and leave `now` untouched.
- **15 passing tests in `test/presence.packLoader.test.ts`** (up from 10 it.todo stubs):
  - `validatePack` block (9 tests): accept valid fixture + round-trip id; reject non-object; reject `id: 1`; reject `version: 2`; reject missing pools; reject AGENT_ACTIVE plain-array shape; reject non-string inside CODING; reject timeOfDay bucket as string; prototype-pollution smoke test (JSON.parse of `{"__proto__":{polluted:"yes"}}`) confirming `Object.prototype.polluted` stays undefined after validation.
  - `loadPack` block (6 tests): empty path → builtin (identity check); valid custom pack → loaded; invalid JSON → builtin + log match `/parse/i`; schema-invalid → builtin + log match `/pools/i`; size > 100 KB → builtin + log match `/too large/i`; ENOENT on stat → builtin + log non-empty.
- **`scripts/check-api-surface.mjs`** — added `src/presence/types.ts` to `PURE_CORE_PATHS` (now 8 pure-core files: state/, rpc/throttle, privacy, detectors/regex, and the four presence modules). `src/presence/packLoader.ts` was already seeded by 04-00.

## Verification

| Gate | Result |
|------|--------|
| `pnpm typecheck` | PASS |
| `pnpm test --run test/presence.packLoader.test.ts` | PASS (15 passed) |
| `pnpm test` (full suite) | PASS (174 passed / 46 todo across 19 files) |
| `pnpm check:api-surface` | PASS (8 pure-core files, zero violations) |
| `pnpm build` | PASS |
| `pnpm check:bundle-size` | PASS (207.5 KB / 41.5% of 500 KB — no delta; packLoader not yet wired into extension.ts) |
| `wc -l src/presence/packLoader.ts` | 160 (< 200 target) |
| `wc -l src/presence/types.ts` | 40 |
| `grep -c '^export ' src/presence/types.ts` | 4 (Message, PoolId, Pack, ValidateResult — plan required ≥3) |
| `grep -c '^export function' src/presence/packLoader.ts` | 2 (validatePack, loadPack) |
| `grep -c 'import.*from "vscode"' src/presence/packLoader.ts` | 0 (pure-core holds) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing node_modules**
- **Found during:** Task 1 RED verification (`pnpm test` failed with "vitest: command not found", lockfile present but `node_modules/` absent).
- **Fix:** Ran `pnpm install` (802 ms from lockfile, no version changes).
- **Scope:** dependency install — did not modify package.json / pnpm-lock.yaml.
- **Commit:** n/a (no source changes).

### Non-deviating refinements

- Split the plan's `isMessageArrayOrObject(x, requirePrimary)` helper into a single-purpose `isAgentActivePool(x)` (always requires `_primary`). The plan passed `requirePrimary=true` at the only call site, so the branch for `requirePrimary=false` was dead. Same behavior, clearer intent, same line budget.
- Extracted `MAX_CUSTOM_PACK_BYTES = 100_000` as a named constant.
- Added one extra `loadPack` test case (ENOENT on stat → fallback) beyond the plan's five — covers the outer try/catch branch cleanly.

## Threat Mitigation

| Threat ID | Mitigation | Evidence |
|-----------|------------|----------|
| T-04-01 (DoS via huge file) | `stat(path).size > 100_000` guard BEFORE any `readFile` call | Test "file-size > 100_000 bytes at customPackPath rejected; falls back to built-in" + MAX_CUSTOM_PACK_BYTES constant |
| T-04-02 (prototype pollution) | Validator reads only enumerated keys (`id`/`version`/`pools`/`timeOfDay`); never calls `Object.assign` or `{...raw}`; `JSON.parse()` demotes `__proto__` to an own enumerable property, which the validator then rejects because it has no `id` key | Test "does not mutate prototype when input contains __proto__ / constructor keys" + code-level grep confirms no `Object.assign(result, raw)` / `{...raw}` in packLoader.ts |
| T-04-03 (ReDoS) | Accepted — validator contains zero regex against user input; only structural `typeof` / `Array.isArray` checks | Code-level: `grep -c "new RegExp\\|\\.test(" src/presence/packLoader.ts` = 0 |

## Known Stubs

- **Temporary built-in fallback:** `loadPack()` takes `opts.builtin` as a parameter; the actual `goblin.json` built-in pack is scheduled for plan 04-05. Until 04-05 lands, wire-up code (plan 04-04 / 04-08) passes a minimal valid pack literal or consumes `MINIMAL_GOBLIN_FIXTURE` from the test helpers. This is called out in 04-01-PLAN objective ("for Wave 1 this plan hard-codes a minimal fallback that plan 04-05 swaps for the full pack") and is intentional.

## Threat Flags

None — this plan introduces no new network endpoints, auth paths, file access patterns, or trust-boundary schema changes beyond the T-04-01/T-04-02/T-04-03 register in the plan's `<threat_model>`.

## Self-Check: PASSED

- FOUND: src/presence/types.ts
- FOUND: src/presence/packLoader.ts
- FOUND: test/presence.packLoader.test.ts (flipped from stubs)
- FOUND: scripts/check-api-surface.mjs (types.ts added)
- FOUND commit eb6ab7f (Task 1: types + packLoader + test flip)
- FOUND commit ba856af (Task 2: PURE_CORE_PATHS extension)
- Verified: `git log --oneline -3` shows both hashes
- Verified: `pnpm test --run test/presence.packLoader.test.ts` → 15 passed
- Verified: `pnpm check:api-surface` → PASS (8 pure-core)
- Verified: `pnpm typecheck` → PASS
