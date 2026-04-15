---
phase: "04"
plan: "03"
subsystem: presence-templater
tags: [presence, templater, pure-core, wave-1, PERS-06]
dependency_graph:
  requires:
    - test/presence.templater.test.ts (04-00 stub — 7 it.todo entries flipped)
  provides:
    - src/presence/templater.ts (renderTemplate + isBlank + TemplateTokens type)
  affects:
    - 04-02 animator (imports renderTemplate + isBlank for per-frame substitution + skip-blank logic)
    - 04-04 activityBuilder (imports renderTemplate for final activity-string render)
tech_stack:
  added: []
  patterns:
    - Pure-core module (zero dependencies, no vscode import)
    - Linear regex (T-04-03 ReDoS-safe) — no nested quantifiers, no user-supplied patterns
    - Deterministic substitution (same inputs → same output; no hidden state)
    - String.prototype.replace with function replacer for safe per-token resolution
key_files:
  created:
    - src/presence/templater.ts (46 lines)
  modified:
    - test/presence.templater.test.ts (7 it.todo → 17 passing tests)
decisions:
  - Unknown tokens render as empty string, not the literal {foo} — a pack author's typo never leaks into Discord
  - isBlank uses strict trim-based detection; callers (animator) own the skip-cap policy (10-attempt cap before hard-fallback to "building, afk" per 04-RESEARCH Pitfall 2)
  - {elapsed} formatting (ms → "20m" / "2h 15m") is the caller's concern — templater just substitutes pre-formatted strings; keeps the module at 46 lines and preserves single-responsibility
  - Task 2 (PURE_CORE_PATHS extension) was already satisfied by 04-00's pre-seed — no additional commit needed; verified grep count = 1 and check:api-surface passes
metrics:
  duration: ~6min
  completed: 2026-04-15
  tasks: 2
  commits: 2
---

# Phase 4 Plan 03: Render-Time Templater Summary

Ships the 46-line pure-core templater — `renderTemplate(message, tokens)` substitutes the 6 canonical tokens (`{workspace}` `{filename}` `{language}` `{branch}` `{agent}` `{elapsed}`) with linear-time regex, and `isBlank(s)` detects whitespace-only output so the animator can implement PERS-06 skip-blank semantics. Unknown tokens render as empty strings, never as the literal `{foo}` — a pack author's typo cannot leak into Discord. Zero dependencies, no vscode import, deterministic.

## What Shipped

- **`src/presence/templater.ts` (46 lines, pure-core)** — three exports:
  - `TemplateTokens` interface — optional `workspace` / `filename` / `language` / `branch` / `agent` / `elapsed` string fields.
  - `renderTemplate(message, tokens): string` — single-pass `message.replace(/\{(\w+)\}/g, ...)` with a function replacer that looks up each token in a `Record<string, string | undefined>` cast of the tokens bag. `string` values substitute directly; `undefined` (missing key) and unknown tokens both resolve to `""`. The regex is linear — no nested quantifiers, no user-supplied patterns — mitigating T-04-03 (ReDoS).
  - `isBlank(s): boolean` — one-liner `s.trim().length === 0`. Returns `true` only for empty or whitespace-only input; a bullet-separator like `" · "` is NOT blank (intentional per PERS-06 — separators are visible copy). Callers (animator) implement the 10-attempt skip cap before falling back to `"building, afk"` (that policy lives in plan 04-02 per 04-RESEARCH Pitfall 2).

- **17 passing tests in `test/presence.templater.test.ts`** (up from 7 it.todo stubs):
  - `renderTemplate` block (11 tests): 6-token composite substitution (PERS-06), static pass-through, filled-token substitution, empty-string token behavior, missing-token behavior, unknown-token renders empty, separator preservation, all-empty-token-with-separator intentional non-blank, determinism (1000-call identity), oversized `{filename}` unmodified (Pitfall 9), per-frame independence for `cooking.` / `cooking..` / `cooking...` sequences, `{elapsed}` passthrough of caller-formatted short-duration strings.
  - `isBlank` block (5 tests): empty → true, whitespace-only → true, non-whitespace → false, bullet-separator `" · "` → false (intentional), blank-after-substitution composition (`"{filename}"` + `filename=""` → blank; `"editing {filename}"` + `filename=""` → non-blank).

- **`scripts/check-api-surface.mjs`** — already contains `src/presence/templater.ts` in `PURE_CORE_PATHS` (seeded by plan 04-00). Verified Task 2's acceptance criteria: `grep -c "src/presence/templater.ts" scripts/check-api-surface.mjs` = 1 and `pnpm check:api-surface` passes with 9 pure-core files scanned.

## Verification

| Gate | Result |
|------|--------|
| `pnpm typecheck` | PASS |
| `pnpm vitest run test/presence.templater.test.ts` | PASS (17 passed) |
| `pnpm vitest run` (full suite) | PASS (191 passed / 39 todo across 19 files, 14 passed / 5 skipped) |
| `pnpm check:api-surface` | PASS (17 .ts files, 9 pure-core, zero violations) |
| `pnpm build` | PASS |
| `pnpm check:bundle-size` | PASS (212528 bytes / 207.5 KB — 41.5% of 500 KB threshold; +5 KB delta from 04-01 because templater is now wired into the pure-core tree; still well under budget) |
| `wc -l src/presence/templater.ts` | 46 (< 50 target) |
| `grep -c "export function renderTemplate" src/presence/templater.ts` | 1 |
| `grep -c "export function isBlank" src/presence/templater.ts` | 1 |
| `grep -c 'import.*from "vscode"' src/presence/templater.ts` | 0 (pure-core holds) |

## Deviations from Plan

None — plan executed exactly as written. Task 2's single file change (appending `"src/presence/templater.ts"` to `PURE_CORE_PATHS`) was already applied by plan 04-00's proactive seed, so no additional edit or commit was necessary; the plan's own `<action>` block anticipated this possibility ("may already have packLoader entry from plan 04-01"). Task 2's acceptance criteria were verified rather than applied.

## Threat Mitigation

| Threat ID | Mitigation | Evidence |
|-----------|------------|----------|
| T-04-03 (ReDoS on renderTemplate regex) | Linear `/\{(\w+)\}/g` regex — no nested quantifiers, no user-supplied patterns compiled; regex is hard-coded against the module's own token syntax | Code-level: `grep -c "new RegExp" src/presence/templater.ts` = 0; the single regex literal matches only `\{\w+\}` with no backtracking risk |

## Known Stubs

None. Templater is feature-complete for PERS-06. The `{elapsed}` formatter (ms → `"20m"` / `"2h 15m"`) lives outside templater by design — plan 04-04 (activityBuilder) or plan 04-02 (animator) owns that conversion and passes the pre-formatted string into `renderTemplate`. The plan's Claude's Discretion note confirms formatting is the caller's concern.

## Threat Flags

None — this plan introduces no new network endpoints, auth paths, file access patterns, or trust-boundary schema changes beyond the T-04-03 mitigation documented in the plan's `<threat_model>`.

## Self-Check: PASSED

- FOUND: src/presence/templater.ts
- FOUND: test/presence.templater.test.ts (flipped from 7 it.todo stubs to 17 passing tests)
- FOUND commit cdc0e23 (Task 1 RED: failing templater tests)
- FOUND commit 5b41193 (Task 1 GREEN: templater implementation)
- Verified: `git log --oneline debf549..HEAD` shows both hashes
- Verified: `pnpm vitest run test/presence.templater.test.ts` → 17 passed
- Verified: `pnpm vitest run` full suite → 191 passed / 39 todo
- Verified: `pnpm check:api-surface` → PASS (9 pure-core files)
- Verified: `pnpm typecheck` → PASS
- Verified: `pnpm build` → PASS (207.5 KB / 41.5% of 500 KB)
