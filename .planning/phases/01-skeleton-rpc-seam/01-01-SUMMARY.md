---
phase: 01-skeleton-rpc-seam
plan: 01
subsystem: infra
tags: [pnpm, typescript, esbuild, vitest, vscode-extension]

requires: []
provides:
  - pnpm workspace with frozen lockfile
  - TypeScript strict config (ES2022, ESNext module, Bundler resolution)
  - esbuild single-CJS bundle pipeline with metafile output
  - vitest node-environment config (passWithNoTests tolerated)
  - VS Code extension manifest (onStartupFinished only, engines ^1.93.0)
  - src/extension.ts activate/deactivate stub ready for plan 01-02 RPC wiring
  - dist/extension.cjs + dist/metafile.json artifacts for bundle-size guardrail
affects: [01-02, 01-03, 01-04, 01-05, all subsequent phases]

tech-stack:
  added:
    - "@xhayper/discord-rpc@1.3.3 (runtime, sole allowed runtime dep)"
    - "@types/node@22.19.17"
    - "@types/vscode@1.115.0"
    - "esbuild@0.24.2"
    - "typescript@5.9.3"
    - "vitest@2.1.9"
  patterns:
    - "Single-entry CJS bundle at dist/extension.cjs; vscode always external"
    - "esbuild --production minifies + strips sourcemaps; dev build keeps inline sourcemaps"
    - "Metafile emitted to dist/metafile.json for downstream bundle-size checks"
    - "Runtime-dependency allowlist enforced in manifest (only @xhayper/discord-rpc)"
    - "Workspace trust: supported=true; virtual workspaces: false"

key-files:
  created:
    - package.json
    - pnpm-lock.yaml
    - tsconfig.json
    - esbuild.mjs
    - vitest.config.ts
    - .gitignore
    - .vscodeignore
    - src/extension.ts
    - dist/extension.cjs (generated)
    - dist/metafile.json (generated)
  modified: []

key-decisions:
  - "Used node20 as esbuild target (VS Code 1.93 Electron ships Node 20+)"
  - "Added passWithNoTests: true to vitest config so empty test suite exits 0 during Wave 0"
  - "Committed pnpm-lock.yaml to enable CI --frozen-lockfile guardrail (added in plan 01-03)"
  - "src/extension.ts kept as pure stub (no @xhayper/discord-rpc import) — RPC seam lands in plan 01-02"

patterns-established:
  - "Manifest activation: onStartupFinished only — no wildcard, no onLanguage"
  - "Workspace trust contract: supported=true, virtualWorkspaces=false (requires local IPC + local git)"
  - "Dependency policy: exactly one runtime dep (@xhayper/discord-rpc); everything else devDependencies"
  - "Build pipeline: pnpm build -> node esbuild.mjs --production -> dist/extension.cjs + dist/metafile.json"

requirements-completed: [SKEL-01, SKEL-02, SKEL-09]

duration: ~2min
completed: 2026-04-12
---

# Phase 01 Plan 01: Skeleton pnpm + esbuild + vitest scaffold Summary

**Bootstrapped the VS Code extension repo with pnpm + TypeScript strict + esbuild single-CJS bundle + vitest, with a manifest that declares `onStartupFinished` only and pins engines.vscode ^1.93.0 — every downstream plan now has a working build/test floor.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-12T23:05:18Z
- **Completed:** 2026-04-12T23:07:06Z
- **Tasks:** 2
- **Files modified:** 8 created + 2 generated artifacts

## Accomplishments

- pnpm workspace initialized with a manifest satisfying SKEL-01 (onStartupFinished only), SKEL-02 (bundle size floor via metafile), and SKEL-09 (`pnpm build` produces dist/extension.cjs with no warnings)
- Runtime dependency list locked to exactly one entry: `@xhayper/discord-rpc@1.3.3` — enforced per PRD §18
- esbuild bundler produces a 565-byte stub `dist/extension.cjs` plus `dist/metafile.json` (well under the 500 KB guardrail that lands in plan 01-03)
- vitest configured for node environment; `pnpm test` exits 0 with no tests (passWithNoTests) so Wave 0 sampling latches green
- Workspace trust + virtual-workspace capabilities declared correctly (supported=true / false respectively) — T-01-06 mitigation in place
- No `enabledApiProposals`, no `(vscode as any)` casts anywhere — T-01-03 mitigation pre-emptive before plan 01-03 adds the CI grep guard

## Task Commits

1. **Task 1: Initialize pnpm workspace + manifest + tsconfig + .gitignore + .vscodeignore** - `ff5b231` (chore)
2. **Task 2: Write esbuild.mjs + vitest.config.ts + src/extension.ts stub** - `c81a44b` (feat)

## Files Created/Modified

- `package.json` - Manifest: onStartupFinished activation, engines.vscode ^1.93.0, capabilities, scripts (build/test/check:*), dependency allowlist
- `pnpm-lock.yaml` - Locked dependency graph for CI --frozen-lockfile
- `tsconfig.json` - Strict TS, ES2022 target, ESNext module, Bundler resolution, noEmit (esbuild owns emit)
- `esbuild.mjs` - Canonical single-CJS bundler config; CJS / node20 / vscode external / metafile
- `vitest.config.ts` - Node environment, passWithNoTests for empty Wave 0 suite
- `.gitignore` - node_modules, dist, vsix, vscode-test, env files, DS_Store, coverage
- `.vscodeignore` - Excludes source/test/scripts/planning/github from VSIX; allows dist + the single @xhayper runtime dep
- `src/extension.ts` - activate/deactivate stub (pure, no RPC yet) to keep esbuild happy until plan 01-02

## Exact Resolved Dependency Versions

- Runtime: `@xhayper/discord-rpc@1.3.3`
- devDependencies: `@types/node@22.19.17`, `@types/vscode@1.115.0`, `esbuild@0.24.2`, `typescript@5.9.3`, `vitest@2.1.9`

## Bundle Size (Proof)

`dist/extension.cjs`: **565 bytes** (0.55 KB) — 0.1% of the 500 KB guardrail. Stub headroom is effectively all of the budget; real RPC wiring in plan 01-02 will still sit well under.

## Decisions Made

- `target: "node20"` in esbuild — matches Electron-30 bundled Node in VS Code 1.93+
- Added `passWithNoTests: true` to vitest config (minor deviation — see below)
- `rootDir: "."` in tsconfig so esbuild.mjs / scripts / vitest.config.ts all participate in typecheck without fighting include globs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `passWithNoTests: true` to vitest.config.ts**
- **Found during:** Task 2 verification
- **Issue:** Plan verification requires `pnpm test` to exit 0 with no tests yet, but vitest ^2 exits 1 by default when no test files match the include glob. The plan objective explicitly states "passWithNoTests tolerated" but the config snippet in the task body omitted the flag.
- **Fix:** Appended `passWithNoTests: true` to the test config block.
- **Files modified:** vitest.config.ts
- **Verification:** `pnpm test` now prints "No test files found, exiting with code 0" — passes Task 2 acceptance criteria and Validation Architecture Wave 0 sampling.
- **Committed in:** c81a44b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for Wave 0 sampling latch; matches the plan's stated tolerance. No scope creep.

## Issues Encountered

None. Install + build + test pipeline produced clean output on first pass (ignoring a single Vite CJS-deprecation warning that is a Vite-internal noise, not our bundle — tracked upstream and safe to ignore).

## Threat Flags

None — the scaffold introduces no new security-relevant surface beyond what the threat model already catalogs (T-01-03 / T-01-06 / T-01-07 are pre-emptively mitigated).

## User Setup Required

None yet. `[HUMAN]` handoff for Discord Developer Portal + OpenVSX namespace is authored in plan 01-05.

## Next Phase Readiness

- **Plan 01-02 ready:** `src/extension.ts` stub awaits RPC client wiring; `@xhayper/discord-rpc@1.3.3` is already installed.
- **Plan 01-03 ready:** `dist/metafile.json` + manifest contract give the CI scripts (`check:bundle-size`, `check:api-surface`) everything they need to scan.
- **Plan 01-04 ready:** `vitest.config.ts` accepts `test/**/*.test.ts` — smoke test lands next.
- **Plan 01-05 ready:** Docs directory is not yet created; handoff plan will create it.
- **No blockers.** Build pipeline is green, test pipeline is green, manifest passes every acceptance assertion.

## Self-Check: PASSED

- FOUND: package.json
- FOUND: pnpm-lock.yaml
- FOUND: tsconfig.json
- FOUND: esbuild.mjs
- FOUND: vitest.config.ts
- FOUND: .gitignore
- FOUND: .vscodeignore
- FOUND: src/extension.ts
- FOUND: dist/extension.cjs
- FOUND: dist/metafile.json
- FOUND commit: ff5b231
- FOUND commit: c81a44b

---
*Phase: 01-skeleton-rpc-seam*
*Completed: 2026-04-12*
