---
phase: "04"
plan: "00"
subsystem: test-scaffolding
tags: [wave-0, test-scaffolding, fixtures, api-surface-guard, network-guard, config-guard, human-uat]
dependency_graph:
  requires: []
  provides:
    - test/presence/__helpers__/packFixtures.ts
    - test/presence/__helpers__/fakeClocks.ts
    - 7 it.todo stub files covering PERS-01..08 / PRIV-01..07 / CONF-01..05
    - scripts/check-no-network.mjs skeleton
    - scripts/check-config-keys.mjs skeleton
    - PURE_CORE_PATHS extension for 4 Phase-4 pure-core modules
    - 04-HUMAN-UAT.md SC-4.1..SC-4.8 checklist
  affects: [wave-1-plans-04-01..04-08]
tech_stack:
  added: []
  patterns:
    - options-bag injection (now/rand/setInterval/clearInterval) mirrored from Phase-3 detectors
    - Wave-0 it.todo → Wave-1 flip pattern (Phase-3 03-00 precedent)
    - Safe-empty CI guards (SKIP when pre-build or pre-manifest state)
key_files:
  created:
    - test/presence/__helpers__/packFixtures.ts
    - test/presence/__helpers__/fakeClocks.ts
    - test/presence.packLoader.test.ts
    - test/presence.animator.test.ts
    - test/presence.templater.test.ts
    - test/presence.activityBuilder.test.ts
    - test/privacy.gitBranch.test.ts
    - test/config.test.ts
    - test/outputChannel.test.ts
    - scripts/check-no-network.mjs
    - scripts/check-config-keys.mjs
    - .planning/phases/04-personality-config-privacy/04-HUMAN-UAT.md
  modified:
    - scripts/check-api-surface.mjs
    - package.json
decisions:
  - Exhaustiveness guard in makeInvalidPack uses `never` check so adding a new InvalidPackKind variant fails at compile time
  - fakeClocks.advance() caps iteration at 10_000 to defensively break pathological timer storms
  - No-network script treats missing dist/ as SKIP (exit 0) so Wave-0 remains green before first src/presence build
  - Config-keys script treats empty properties{} as SKIP so Wave-0 remains green before 04-06 manifest fill
  - api-surface PURE_CORE_PATHS lists 4 specific presence files (animator, templater, activityBuilder, packLoader) — NOT a broad `src/presence/` prefix, so that src/presence/goblin.json (data) + any future vscode-consuming helper stay excluded
metrics:
  duration: ~8min
  completed: 2026-04-15
  tasks: 3
  commits: 3
---

# Phase 4 Plan 00: Wave 0 Test Scaffolding Summary

Seeded Phase-4 Nyquist compliance: 7 it.todo stub files + 2 fixture helpers + 3 CI guards + HUMAN-UAT checklist, so Wave 1+ plans flip placeholders into passing tests instead of authoring scaffolding alongside implementation.

## What Shipped

- **Two pure-TS helpers** (`test/presence/__helpers__/`): `packFixtures.ts` exports `MINIMAL_GOBLIN_FIXTURE` + `makeValidPack(overrides?)` + `makeInvalidPack(kind)` covering six invalid-kind branches (not-object, bad-version, missing-pools, bad-agent-active-shape, bad-message-type, bad-time-of-day). `fakeClocks.ts` exports `makeFakeClocks()` with injectable `now` / `rand` / `setInterval` / `clearInterval` + `advance(ms)` / `setNow()` / `setRandSequence()` for deterministic timer control. Contract matches 04-00-PLAN <interfaces> exactly.
- **Seven it.todo stub files** totalling 56 pending tests covering every Phase-4 requirement:
  - `presence.packLoader.test.ts` — 10 todos (PERS-01/07/08 + D-25..28 + T-04-01/02)
  - `presence.animator.test.ts` — 17 todos (PERS-02..05 + CONF-03 + PRIV-06 + D-06..13, D-24)
  - `presence.templater.test.ts` — 7 todos (PERS-06 + D-13)
  - `presence.activityBuilder.test.ts` — 7 todos (PRIV-05 + CONF-04 + D-14/19/20)
  - `privacy.gitBranch.test.ts` — 6 todos (PRIV-03/04 + D-18)
  - `config.test.ts` — 5 todos (CONF-02 + D-24)
  - `outputChannel.test.ts` — 4 todos (CONF-05)
- **PURE_CORE_PATHS extension** in `scripts/check-api-surface.mjs` — explicit listing of 4 new pure-core presence modules (`animator.ts`, `templater.ts`, `activityBuilder.ts`, `packLoader.ts`). Not a broad prefix — `src/config.ts` / `src/outputChannel.ts` (04-06) import vscode and stay outside pure-core.
- **`scripts/check-no-network.mjs`** — static grep of `dist/extension.cjs` for forbidden HTTP/fetch/undici/node-fetch tokens. SKIPs (exit 0) when bundle absent (Wave-0 pre-build safe). Promoted to full runtime harness by plan 04-09.
- **`scripts/check-config-keys.mjs`** — counts `contributes.configuration.properties`, asserts ≤20 keys + each has title/description/default + enum→enumDescriptions per D-23. SKIPs when properties empty (Wave-0 pre-manifest safe). Becomes required gate when 04-06 fills the manifest.
- **`package.json`** — added `check:no-network` and `check:config-keys` scripts.
- **`04-HUMAN-UAT.md`** — 8 manual sign-off items (SC-4.1..SC-4.8) grouped into Animator / Privacy / Ignore Lists / Config checklists; hard-gate vs secondary distinction called out.

## Verification

| Gate | Result |
|------|--------|
| `pnpm typecheck` | PASS |
| `pnpm test -- --run` | 12 passed / 7 skipped files; 159 passed / 56 todo |
| `pnpm check:api-surface` | PASS (6 pure-core files scanned, zero violations) |
| `pnpm check:no-network` | PASS (skeleton; SKIP pre-build, then PASS after `pnpm build` — 212522 bytes scanned, zero forbidden tokens) |
| `pnpm check:config-keys` | PASS (SKIP — properties empty) |
| `pnpm check:bundle-size` | PASS (207.5 KB / 41.5% of 500 KB) |
| `04-HUMAN-UAT.md` | Authored with 8 SC entries |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: test/presence/__helpers__/packFixtures.ts
- FOUND: test/presence/__helpers__/fakeClocks.ts
- FOUND: test/presence.packLoader.test.ts
- FOUND: test/presence.animator.test.ts
- FOUND: test/presence.templater.test.ts
- FOUND: test/presence.activityBuilder.test.ts
- FOUND: test/privacy.gitBranch.test.ts
- FOUND: test/config.test.ts
- FOUND: test/outputChannel.test.ts
- FOUND: scripts/check-no-network.mjs
- FOUND: scripts/check-config-keys.mjs
- FOUND: .planning/phases/04-personality-config-privacy/04-HUMAN-UAT.md
- FOUND commit 6ab543a (helpers)
- FOUND commit 32aa737 (test stubs)
- FOUND commit 39c5f17 (CI guards + UAT)
