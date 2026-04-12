---
phase: 01-skeleton-rpc-seam
plan: 03
subsystem: ci-guardrails
tags: [ci, github-actions, bundle-size, api-surface, guardrails, pnpm]

requires:
  - pnpm scaffold + manifest from plan 01-01 (scripts `check:bundle-size`, `check:api-surface`, `build`, `test` registered)
  - src/rpc seam + dist/metafile.json from plan 01-02 (non-trivial bundle for the size check)
provides:
  - scripts/check-bundle-size.mjs (500 KB guardrail — SKEL-02, SKEL-04)
  - scripts/check-api-surface.mjs (no proposed APIs, no (vscode as any) — SKEL-05)
  - .github/workflows/ci.yml (single ubuntu-latest job: install -> build -> bundle-size -> api-surface -> test)
affects: [01-04, 01-05, 02-*, 03-*, 04-*, 05-*, 06-*]

tech-stack:
  added: []
  patterns:
    - "Pure-Node guardrail scripts (node:fs + node:path only, zero deps) — cross-platform and lockfile-stable"
    - "Bundle-size guardrail reads esbuild metafile (not filesystem stat) — consistent with build-tool truth"
    - "api-surface regex tolerates whitespace variants for (vscode as any) / (vscode: any)"
    - "CI step ordering: static checks before tests (bundle-size needs metafile; api-surface needs only source; tests last)"
    - "pnpm install --frozen-lockfile in CI — mandatory per PRD M6a"

key-files:
  created:
    - scripts/check-bundle-size.mjs
    - scripts/check-api-surface.mjs
    - .github/workflows/ci.yml
  modified: []

key-decisions:
  - "Used existsSync guard in walk() so api-surface script handles missing src/ directory gracefully (beyond RESEARCH §7 canonical version)"
  - "Both traps for BAD_CAST and BAD_ANY report separately so a single file hitting both patterns produces two FAIL lines"
  - "No YAML parser available locally (no yaml python module) — validated .github/workflows/ci.yml via tab-character + step-order regex check in Node"
  - "No continue-on-error, no lint step, no matrix — all three explicitly deferred to Phase 5 per CONTEXT.md §Guardrails"

patterns-established:
  - "Guardrail script interface: pnpm check:<name> -> node scripts/check-<name>.mjs, exits 0 PASS / non-zero FAIL, human-readable console output"
  - "CI pipeline shape: checkout -> pnpm setup -> node setup -> install --frozen-lockfile -> build -> static checks -> test"
  - "Phase 1 CI is the guardrail minimum — Phase 5 M6a layers on matrix (ubuntu/macos/windows), lint, branch protection, Dependabot"

requirements-completed: [SKEL-02, SKEL-04, SKEL-05]

duration: ~2min
completed: 2026-04-12
---

# Phase 01 Plan 03: CI guardrails — bundle-size + api-surface + workflow Summary

**Landed the two CI guardrails every later phase depends on: a pure-Node 500 KB bundle-size check (SKEL-02, SKEL-04), a pure-Node grep guard banning `(vscode as any)` and `enabledApiProposals` (SKEL-05), and a minimal single-job `.github/workflows/ci.yml` that runs install -> build -> bundle-size -> api-surface -> test on every PR and push-to-main. No regression past 500 KB or any proposed-API reappearance can silently reach main after this plan.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-12T23:15:12Z
- **Completed:** 2026-04-12T23:17:10Z
- **Tasks:** 3
- **Files modified:** 3 created

## Accomplishments

- **SKEL-02 + SKEL-04 wired:** `scripts/check-bundle-size.mjs` reads `dist/metafile.json`, fails if `outputs["dist/extension.cjs"].bytes > 500 * 1024`. Exits non-zero on regression with a `FAIL` line naming the offending byte count.
- **SKEL-05 wired:** `scripts/check-api-surface.mjs` scans `src/**/*.ts` for `(vscode as any)` / `(vscode: any)` and checks `package.json` for a non-empty `enabledApiProposals`. Pure-Node walker (no shell-out, no glob dep) — runs identically on Ubuntu, macOS, Windows.
- **CI pipeline online:** `.github/workflows/ci.yml` runs on `pull_request` + `push` to `main`, single `ubuntu-latest` job, with the ordered pipeline `install -> build -> bundle-size -> api-surface -> test`.
- **Frozen-lockfile enforced:** CI uses `pnpm install --frozen-lockfile`, which fails on any drift between `package.json` and `pnpm-lock.yaml` — supply-chain surprises require an explicit lockfile-update commit.
- **Zero external deps in guardrail scripts:** only `node:fs` + `node:path`. No chalk, no kleur, no glob library. Scripts are reviewable in a single screen.
- **All three failure modes proved locally:** over-threshold bundle, missing metafile, `(vscode as any)` cast injection, non-empty `enabledApiProposals`. Each exits non-zero with a clear `FAIL` line; each restored cleanly to green afterwards.

## Task Commits

1. **Task 1: Write scripts/check-bundle-size.mjs (500 KB guardrail)** — `6222079` (feat)
2. **Task 2: Write scripts/check-api-surface.mjs (proposed-API + (vscode as any) guardrail)** — `5dd68cf` (feat)
3. **Task 3: Write .github/workflows/ci.yml (single ubuntu-latest job)** — `ab97944` (feat)

## Files Created/Modified

- `scripts/check-bundle-size.mjs` (new, 34 lines) — Reads `dist/metafile.json`, looks up `outputs["dist/extension.cjs"].bytes`, fails if > 500 * 1024. Prints PASS/FAIL + bytes + KB + % of threshold.
- `scripts/check-api-surface.mjs` (new, 55 lines) — Walks `src/` recursively via `node:fs` (existsSync-guarded), regex-matches `(vscode as any)` / `(vscode: any)`, parses `package.json` for non-empty `enabledApiProposals`. Empty array counts as pass (no opt-in).
- `.github/workflows/ci.yml` (new, 38 lines) — Single ubuntu-latest job: `actions/checkout@v4`, `pnpm/action-setup@v4` (v9), `actions/setup-node@v4` (node 20, cache: pnpm), install --frozen-lockfile, build, bundle-size, api-surface, test.

## Local Exercise Results

### check-bundle-size.mjs

| Scenario | Exit code | Output contains |
|----------|-----------|-----------------|
| Happy path (`dist/extension.cjs` = 196.5 KB) | 0 | `PASS`, `39.3% of threshold` |
| Injected over-threshold (`bytes = 600000`) | 1 | `FAIL`, `bundle is 88000 bytes over threshold` |
| Missing `dist/metafile.json` | 1 | `FAIL`, `Did you run \`pnpm build\` first?` |
| Restored (after each injection) | 0 | `PASS` — latches back to green |

### check-api-surface.mjs

| Scenario | Exit code | Output contains |
|----------|-----------|-----------------|
| Happy path (2 .ts files, no violations) | 0 | `PASS — scanned 2 .ts files` |
| Appended `// (vscode as any).fake` to src/extension.ts | 1 | `FAIL — src/extension.ts contains (vscode as any) cast` |
| Injected `"enabledApiProposals": ["test-proposal"]` | 1 | `FAIL — package.json has non-empty enabledApiProposals` |
| Injected `"enabledApiProposals": []` (empty) | 0 | `PASS` — empty array = no opt-in |
| Restored (after each injection) | 0 | `PASS` — latches back to green |

### ci.yml structure

| Check | Result |
|-------|--------|
| Required strings present (11 tokens: pnpm/action-setup@v4, actions/setup-node@v4, frozen-lockfile, pnpm build / test / check:bundle-size / check:api-surface, node-version: 20, cache: pnpm, ubuntu-latest, actions/checkout@v4) | PASS |
| Forbidden matrix platforms (macos-latest, windows-latest) | absent (PASS) |
| `continue-on-error` anywhere | absent (PASS) |
| Step order (checkout -> pnpm -> node -> install -> build -> bundle-size -> api-surface -> test) | matches expected |
| Tab characters at indentation | none (PASS) |

## What Phase 5 Will Add

The plan explicitly defers these to Phase 5 (CONTEXT.md §Guardrails + RESEARCH.md §8):

- **Cross-platform matrix:** `macos-latest` + `windows-latest` alongside `ubuntu-latest` (DIST-06, PRD M6a)
- **Lint step:** ESLint or equivalent (not mandated for M0; lands with OSS hygiene pass)
- **Branch protection:** required status checks on `main`, enforced via GitHub settings (M6a DoD)
- **Dependabot:** automated dependency update PRs via `.github/dependabot.yml` (M6a DoD)
- **Release workflow:** `.github/workflows/release.yml` gated on tag push — Phase 6 (PUB-* requirements)

Phase 1 CI is the guardrail minimum: any bundle regression past 500 KB OR any `(vscode as any)` / proposed-API reappearance fails the PR. That is the non-negotiable floor Phase 1 promises the rest of the project.

## Deviations from Plan

### Auto-fixed Issues

None — both scripts were copy-verbatim from RESEARCH.md §6 / §7 with the plan-documented `existsSync` guard tweak in the api-surface walker (plan behavior section explicitly required this: "Script handles `src/` not yet containing any .ts files … still passes").

### Process note (not a code deviation)

While injecting the `enabledApiProposals` fixture via `JSON.stringify(pkg, null, 2)`, Node rewrote the inline `{ "vscode": "^1.93.0" }` style into expanded multi-line form. Caught immediately via `git diff package.json` and restored with `git checkout package.json`. Final `pnpm check:api-surface` re-run on the original package.json confirmed PASS. No permanent change to package.json.

---

**Total deviations:** 0 code deviations; 1 process note (fixture injection reformatted JSON, reverted before commit).
**Impact on plan:** None — plan executed exactly as written.

## Verification Evidence

| Check | Command | Result |
|-------|---------|--------|
| scripts/check-bundle-size.mjs exists | `test -f scripts/check-bundle-size.mjs` | PASS |
| scripts/check-api-surface.mjs exists | `test -f scripts/check-api-surface.mjs` | PASS |
| .github/workflows/ci.yml exists | `test -f .github/workflows/ci.yml` | PASS |
| Bundle-size PASS path | `pnpm check:bundle-size` | exit 0, `PASS`, 39.3% of threshold |
| Bundle-size FAIL path (600000 bytes) | injected + `pnpm check:bundle-size` | exit 1, `FAIL — bundle is 88000 bytes over threshold` |
| Bundle-size missing-metafile path | `mv dist/metafile.json /tmp/ && pnpm check:bundle-size` | exit 1, `Did you run \`pnpm build\` first?` |
| API-surface PASS path | `pnpm check:api-surface` | exit 0, `scanned 2 .ts files` |
| API-surface cast FAIL path | append `// (vscode as any).fake` + rerun | exit 1, `src/extension.ts contains (vscode as any) cast` |
| API-surface proposed-API FAIL path | add `enabledApiProposals: ["x"]` + rerun | exit 1, `package.json has non-empty enabledApiProposals` |
| API-surface empty-array PASS path | `enabledApiProposals: []` + rerun | exit 0, `PASS` |
| ci.yml required tokens present | Node regex check | PASS |
| ci.yml no `macos-latest` / `windows-latest` | grep | absent (PASS) |
| ci.yml no `continue-on-error` | grep | absent (PASS) |
| ci.yml step order matches spec | Node regex extraction | matches |
| ci.yml no tab indentation | Node line scan | none (PASS) |

## Threat Flags

None new. The plan's `<threat_model>` mitigations are fully implemented:

- **T-01-02 (bundle bloat regression):** `scripts/check-bundle-size.mjs` reads esbuild metafile, fails CI if `dist/extension.cjs > 500 * 1024`. No `continue-on-error` escape hatch anywhere in the workflow.
- **T-01-03 (proposed-API / (vscode as any) regression):** `scripts/check-api-surface.mjs` regex-matches both patterns in `src/**/*.ts` and checks `package.json` for non-empty `enabledApiProposals`. Pure-Node walker — no shell-out, runs identically on every CI platform.
- **T-01-09 (lockfile drift):** `pnpm install --frozen-lockfile` in ci.yml rejects any drift between `package.json` and `pnpm-lock.yaml`.
- **T-01-10 (CI running untrusted PR code):** accepted — Phase 1 CI uses default `pull_request` event (not `pull_request_target`), exposes no secrets to PR branches, publishes no artifacts. Release workflow + secrets arrive in Phase 6.

## User Setup Required

None for plan 01-03. The CI runs automatically on any PR or push-to-main after this commit lands on the remote. No secrets, no environment variables, no branch protection to configure yet (those land in Phase 5 M6a).

## Next Plan Readiness

- **Plan 01-04 ready:** `pnpm test` is wired as the last CI step — the vitest smoke test for `src/rpc/client.ts` will run on every PR once it lands. No changes needed to ci.yml; the smoke test slots into the existing `Test` step.
- **Plan 01-05 ready:** Manual Dev Host checklist (human-verify) is independent of CI. The `[HUMAN]` handoff doc will reference CI as the automated floor and the Dev Host F5 session as the manual acceptance gate.
- **Phase 2+ ready:** any code that drifts past 500 KB or sneaks in `(vscode as any)` fails the PR — downstream plans can freely add features knowing the guardrail is enforced.
- **No blockers.** All three scripts verified; CI workflow structure validated; step order matches RESEARCH.md §8 spec exactly.

## Self-Check: PASSED

- FOUND: scripts/check-bundle-size.mjs
- FOUND: scripts/check-api-surface.mjs
- FOUND: .github/workflows/ci.yml
- FOUND commit: 6222079 (Task 1: bundle-size)
- FOUND commit: 5dd68cf (Task 2: api-surface)
- FOUND commit: ab97944 (Task 3: ci.yml)

---
*Phase: 01-skeleton-rpc-seam*
*Completed: 2026-04-12*
