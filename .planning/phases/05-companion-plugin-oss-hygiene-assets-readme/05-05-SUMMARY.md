---
phase: 05-companion-plugin-oss-hygiene-assets-readme
plan: "05"
subsystem: ci-dependabot
tags: [ci, github-actions, dependabot, matrix, lint, oss-hygiene]
dependency_graph:
  requires: []
  provides: [3-OS-matrix-CI, dependabot-config, lint-script]
  affects: [.github/workflows/ci.yml, .github/dependabot.yml, package.json]
tech_stack:
  added: []
  patterns: [github-actions-matrix, dependabot-yaml]
key_files:
  created:
    - .github/dependabot.yml
  modified:
    - .github/workflows/ci.yml
    - package.json
decisions:
  - lint = tsc --noEmit (D-09): no new linter dependency; identical to existing typecheck script
  - fail-fast:false: Windows CI may flake on fs.watch tests; all OS jobs complete regardless
  - open-pull-requests-limit 10: weekly cadence + limit prevents overwhelming solo maintainer
metrics:
  duration: 1min
  completed: "2026-04-16"
  tasks_completed: 2
  files_modified: 3
---

# Phase 05 Plan 05: CI Matrix + Dependabot Summary

**One-liner:** 3-OS matrix CI (ubuntu/macos/windows) with tsc lint step + Dependabot for npm and github-actions, no new dependencies added.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Expand CI to 3-OS matrix with lint step | 9166a06 | .github/workflows/ci.yml, package.json |
| 2 | Create Dependabot configuration | 19deff9 | .github/dependabot.yml |

## What Was Built

### Task 1: CI Matrix Expansion (9166a06)

Updated `.github/workflows/ci.yml`:
- Added `strategy.matrix.os: [ubuntu-latest, macos-latest, windows-latest]`
- Changed `runs-on` from `ubuntu-latest` to `${{ matrix.os }}`
- Added `fail-fast: false` so Windows flakes don't cancel ubuntu/macos jobs
- Added `pnpm lint` step between Install and Build (type errors caught before build)
- All existing steps preserved: bundle-size, api-surface, config-keys, no-network, test

Added `lint` script to `package.json`:
- `"lint": "tsc --noEmit"` — identical to `typecheck` per D-09 (no ESLint/Biome dependency)

### Task 2: Dependabot Configuration (19deff9)

Created `.github/dependabot.yml`:
- `npm` ecosystem — weekly updates covering `@xhayper/discord-rpc` + all devDependencies
- `github-actions` ecosystem — weekly updates for checkout@v4, pnpm/action-setup@v4, setup-node@v4
- `open-pull-requests-limit: 10` prevents PR flood on weekly cadence

## Verification

All success criteria met:
- CI workflow triggers on PR and push to main: confirmed
- All 3 OS runners execute lint, build, bundle-size, api-surface, config-keys, no-network, test: confirmed
- Dependabot enabled for npm and github-actions: confirmed
- lint = tsc --noEmit (no new dependency): confirmed

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Dependabot PRs will be validated by the CI matrix before merge (T-05-08 mitigated per plan threat model).

## Self-Check: PASSED

- `.github/workflows/ci.yml` exists and contains matrix, macos-latest, windows-latest, fail-fast: false, pnpm lint
- `.github/dependabot.yml` exists and contains npm, github-actions, weekly
- `package.json` lint script = "tsc --noEmit"
- Commit 9166a06 exists: confirmed
- Commit 19deff9 exists: confirmed
