---
phase: "04"
plan: "05"
subsystem: presence-goblin-pack
tags: [presence, pack-data, goblin, wave-1]
dependency_graph:
  requires:
    - src/presence/packLoader.ts (04-01 Pack contract + loadPack)
    - src/presence/types.ts (04-01 Pack type)
  provides:
    - src/presence/goblin.json (canonical built-in pack, PERS-01)
    - src/presence/packLoader.ts BUILTIN_GOBLIN_PACK export
    - scripts/check-pack-inlined.mjs (esbuild-inline guardrail)
    - package.json check:pack-inlined script
  affects:
    - 04-02 animator (consumes BUILTIN_GOBLIN_PACK as first rotation pack)
    - 04-04 activityBuilder (passes BUILTIN_GOBLIN_PACK to loadPack as fallback)
    - 04-08 extension.ts wiring (imports BUILTIN_GOBLIN_PACK → forces bundle inclusion)
tech_stack:
  added: []
  patterns:
    - esbuild default JSON loader inlining (zero-config, Pitfall 8 mitigation)
    - named guardrail script over raw grep (reviewer R1)
    - canonical content committed verbatim from CONTEXT D-05 (no editorial drift)
key_files:
  created:
    - src/presence/goblin.json
    - scripts/check-pack-inlined.mjs
  modified:
    - esbuild.mjs (documentation comment — default JSON loader strategy)
    - package.json (check:pack-inlined script wired)
    - src/presence/packLoader.ts (import goblin.json + export BUILTIN_GOBLIN_PACK)
decisions:
  - Committed D-05 content verbatim (zero editorializing); intentional arrow `→` in "prompt → PR" preserved
  - Added BUILTIN_GOBLIN_PACK export to packLoader.ts (Rule 2 refinement) so the import graph exists the moment Wave-2 plans wire up; avoids duplicating `import goblin from "./goblin.json"` across activityBuilder + extension.ts
  - Default esbuild JSON loader is used — no explicit `loader: { ".json": "json" }` entry needed; documented this in esbuild.mjs comment so future readers know it's intentional
  - check-pack-inlined.mjs asserts two distinct D-05 strings ("letting it cook", "the agent is cooking") so a partial inline still fails the guardrail
metrics:
  duration: ~6min
  completed: 2026-04-15
  tasks: 2
  commits: 2
---

# Phase 4 Plan 05: Built-in Goblin Pack + esbuild Inline Guardrail Summary

Ships the canonical goblin pack (`src/presence/goblin.json`) verbatim from CONTEXT D-05 — 15 `_primary` entries, 4 `claude` sub-pool, 2 `codex` sub-pool, 7 CODING, 7 IDLE, 4 time-of-day buckets — and the `scripts/check-pack-inlined.mjs` guardrail that asserts two distinct canonical strings survive into `dist/extension.cjs` once the Wave-2 import chain lands. Also exports `BUILTIN_GOBLIN_PACK` from `packLoader.ts` so Wave-2 plans import a single named constant instead of re-importing the JSON at each consumer site.

## What Shipped

- **`src/presence/goblin.json` (59 lines)** — canonical goblin pack matching D-05 verbatim. 15 `_primary` messages (including two frame sequences `["cooking.", "cooking..", "cooking..."]` and `["thinking.", "thinking..", "thinking..."]`), 4 `claude` sub-pool entries, 2 `codex` sub-pool entries, 7-entry CODING pool, 7-entry IDLE pool, and four time-of-day buckets (3 × lateNight / 3 × morning / 2 × afternoon / 2 × evening). Every message ≤ 50 chars (max observed: 27). Intentional Unicode arrow `→` preserved in `"prompt → PR"`.
- **`scripts/check-pack-inlined.mjs` (30 lines)** — reads `dist/extension.cjs` and asserts the presence of two distinct canonical strings from D-05 (`"letting it cook"` and `"the agent is cooking"`). Fails with a pointer to Pitfall 8 if either is missing. Named script per reviewer R1 (not a raw grep in acceptance text).
- **`src/presence/packLoader.ts`** — added `import goblinPackJson from "./goblin.json"` + exported `BUILTIN_GOBLIN_PACK: Pack`. Wave-2 consumers (04-02 animator, 04-04 activityBuilder, 04-08 extension wiring) `import { BUILTIN_GOBLIN_PACK } from "./presence/packLoader"` instead of duplicating the JSON import at each site.
- **`esbuild.mjs`** — comment block above the build context documents that goblin.json inlines via esbuild's default JSON loader; no explicit loader override required. Call-out cites 04-RESEARCH.md Pitfall 8 for future-reader context.
- **`package.json`** — new `"check:pack-inlined": "node scripts/check-pack-inlined.mjs"` npm script wired alongside the other check:* guardrails.

## Verification

| Gate | Result |
|------|--------|
| `test -f src/presence/goblin.json` | PASS (exists) |
| `node -e "const p=require('./src/presence/goblin.json'); assert p.id==='goblin' && p.version===1"` | PASS |
| `_primary.length === 15` | PASS |
| `claude.length === 4`, `codex.length === 2` | PASS |
| Every message ≤ 50 chars (D-04 audit) | PASS (max length: 27) |
| `grep -c '→' src/presence/goblin.json` | PASS (= 1, the intentional arrow) |
| Hand-rolled validator mirror (isAgentActivePool / isMessageArray / isTimeOfDay) | PASS (all six structural checks green) |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS (191 passed / 39 todo across 19 files) |
| `pnpm test -- test/presence.packLoader.test.ts` | PASS (15 / 15 — packLoader still green with new BUILTIN_GOBLIN_PACK export) |
| `pnpm build` | PASS (no loader warnings) |
| `pnpm check:bundle-size` | PASS (207.5 KB / 41.5% of 500 KB — no delta, packLoader not yet in bundle graph) |
| `pnpm check:api-surface` | PASS (9 pure-core files, zero violations) |
| `node scripts/check-pack-inlined.mjs` | **FAIL (expected, see Deferred Issues)** — inline requires extension.ts to import packLoader, which lands in plan 04-04/04-08 |
| `grep -c '"check:pack-inlined"' package.json` | PASS (= 1, script wired) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added BUILTIN_GOBLIN_PACK export**
- **Found during:** Task 2 (addressing the inline-verification gap).
- **Issue:** Plan 04-05's frontmatter declares a key_link `src/presence/packLoader.ts (future consumer) → src/presence/goblin.json` but `packLoader.ts` did not yet import the JSON. Wave-2 plans (04-02, 04-04, 04-08) would each independently `import goblin from "./goblin.json"`, duplicating the import and scattering the PERS-01 single-source-of-truth.
- **Fix:** Added `import goblinPackJson from "./goblin.json"` and exported `BUILTIN_GOBLIN_PACK: Pack` from packLoader.ts with a doc comment pointing to D-26 (whole-pack fallback semantics). Wave-2 consumers import the named constant.
- **Files modified:** `src/presence/packLoader.ts`
- **Commit:** 73b99e3

### Deferred Issues

**1. `node scripts/check-pack-inlined.mjs` currently exits 1 (FAIL)**

Plan 04-05 Task 2's `<verify automated>` and `<acceptance_criteria>` list `node scripts/check-pack-inlined.mjs` as PASS. The plan's own `<action>` text explicitly acknowledges this contradiction: *"(We don't have dist/ yet at Wave-1 time; this check belongs to the plan 04-04 acceptance gate. For this task, the acceptance is config-level plus creating the named script.)"*

Current state:
- Script exists, is well-formed, and wired into `package.json` as `check:pack-inlined`.
- `src/presence/packLoader.ts` imports `./goblin.json` and exports `BUILTIN_GOBLIN_PACK`.
- `src/extension.ts` does not yet import `packLoader` (that wiring is scheduled for plan 04-04 activityBuilder + plan 04-08 extension wiring).
- Because extension.ts is the bundle root and packLoader is not reachable from it, esbuild tree-shakes packLoader + goblin.json out of `dist/extension.cjs`. `check:pack-inlined` therefore reports FAIL.

Resolution: the gate flips to PASS automatically when plan 04-04 lands `import { BUILTIN_GOBLIN_PACK, loadPack } from "./presence/packLoader"` in activityBuilder.ts (and activityBuilder is imported from extension.ts / driver.ts). No additional work from plan 04-05 is required — the import graph is ready to light up the moment Wave-2 begins.

This is documented as a deferred issue rather than a blocking failure because:
1. The plan's `<action>` text explicitly scopes 04-05 to "config-level plus creating the named script."
2. The `<files_modified>` frontmatter excludes extension.ts and activityBuilder.ts (which are owned by other plans).
3. All other 04-05 success criteria (goblin.json verbatim, ≤50 char audit, bundle-size guardrail green, script wired) are GREEN.

## Threat Mitigation

| Threat ID | Mitigation | Evidence |
|-----------|------------|----------|
| T-04-04 (VSIX supply chain tampering) | goblin.json checked into git verbatim; CI build reproduces it from source; any tampering surfaces as a PR diff against the D-05 canonical text | goblin.json commit 9a23fb8 + `scripts/check-pack-inlined.mjs` asserts two distinct D-05 strings survive in `dist/extension.cjs`, so a build-time swap would fail the guardrail |

## Known Stubs

None. This plan ships finalized data; no placeholders or TODOs in goblin.json, esbuild.mjs, packLoader.ts, or check-pack-inlined.mjs.

## Threat Flags

None — this plan introduces no new network endpoints, auth paths, file access patterns, or trust-boundary schema changes. Goblin pack is author-controlled static data shipped in the VSIX (T-04-04 register already captures this).

## Self-Check: PASSED

- FOUND: src/presence/goblin.json
- FOUND: scripts/check-pack-inlined.mjs
- FOUND: esbuild.mjs (modified)
- FOUND: package.json (check:pack-inlined script wired)
- FOUND: src/presence/packLoader.ts (BUILTIN_GOBLIN_PACK exported)
- FOUND commit 9a23fb8 (Task 1: goblin.json)
- FOUND commit 73b99e3 (Task 2: inline guardrail + BUILTIN_GOBLIN_PACK export)
- Verified: `git log --oneline -3` shows both hashes
- Verified: `pnpm typecheck` → PASS
- Verified: `pnpm test` → 191 passed / 39 todo
- Verified: `pnpm build` → PASS
- Verified: `pnpm check:bundle-size` → PASS (207.5 KB)
- Verified: `pnpm check:api-surface` → PASS (9 pure-core, no violations)
- Verified: goblin.json passes validatePack structural checks (id/version/pools/timeOfDay)
