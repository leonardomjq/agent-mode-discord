---
phase: "04"
plan: "09"
subsystem: ci-network-guardrail
tags: [ci, network-guardrail, bundle-static, zero-http, priv-07]
dependency_graph:
  requires:
    - dist/extension.cjs (Wave-4 built bundle from plan 04-08)
    - scripts/check-bundle-size.mjs + scripts/check-api-surface.mjs + scripts/check-config-keys.mjs (existing sibling guards — pattern template)
    - .github/workflows/ci.yml (pre-existing CI workflow with build / bundle-size / api-surface / test steps)
  provides:
    - scripts/check-no-network.mjs — static grep tool asserting zero outbound HTTP surface in dist/extension.cjs; <100 ms, CI-portable, deterministic
    - scripts/__fixtures__/forbidden-fixture.cjs — 10-line synthetic bad bundle proving the guard fails when a violation is introduced (negative test)
    - .github/workflows/ci.yml — wires check:config-keys (CONF-01) + check:no-network (PRIV-07) into the PR gate after the existing build/bundle-size/api-surface chain
    - Closes PRIV-07 for v0.1
  affects:
    - Every future PR — the check:no-network CI step now fails on any newly introduced HTTP surface
    - Every future PR touching package.json contributes.configuration — check:config-keys enforces the ≤20-key invariant
tech_stack:
  added: []
  patterns:
    - Static-grep guardrail pattern (mirrors check-bundle-size / check-api-surface / check-config-keys style: node shebang, ESM, PASS/FAIL output, exit-0/exit-1 gate)
    - Negative-test fixture pattern — a synthetic "bad bundle" committed under scripts/__fixtures__/ used as the inverse proof that the guard works
    - FORBIDDEN-list + per-entry reason annotations for auditability (reviewer R2)
    - IPC-vs-TCP heuristic via TCP_NET_HEURISTIC regex — documents the Discord IPC exemption without whitelisting `net.createConnection` outright
key_files:
  created:
    - scripts/__fixtures__/forbidden-fixture.cjs (15 lines)
  modified:
    - scripts/check-no-network.mjs (55 -> 106 lines — Wave-0 skeleton promoted to full PRIV-07 implementation)
    - .github/workflows/ci.yml (38 -> 44 lines — two new CI steps)
decisions:
  - Kept the static-grep approach (Option 2 + partial Option 1 from 04-RESEARCH.md §Pattern 7); deferred the 10-minute runtime intercept (Option 1 full / `@vscode/test-electron` harness) to v0.2. Rationale: static grep runs in <100 ms vs 10 minutes, is deterministic, CI-portable, and catches every HTTP regression at the *import* level — which is the attack surface we actually care about. Runtime intercept is a defense-in-depth layer worth shipping, but not required to close PRIV-07.
  - Missing-bundle is FAIL, not SKIP (reviewer R2). The Wave-0 skeleton exited 0 when dist/extension.cjs was absent — safe for pre-build state, unsafe for CI where a missing build artefact should block the merge. The default `pnpm build` → `pnpm check:no-network` ordering guarantees the bundle exists at check time.
  - `fetch(` is FAIL, not WARN (reviewer R2 promotion). Node 18+ has a global `fetch` — any call site is a real outbound-HTTP attempt. WARN would let a regression slip through silently.
  - IPC exemption is NOT an allowlist — it's a documented negative. `net.createConnection({ path: ... })` is allowed because it's not in FORBIDDEN; the TCP_NET_HEURISTIC sweep catches the TCP form (`host:` literal within 120 chars of the call) as WARN for manual review. Never whitelist the FORBIDDEN list — sharpen regexes instead.
  - Existing `package.json` `check:no-network` entry was already present from Wave-0 (plan 04-06 scaffolding); no edit required for that file in this plan.
metrics:
  duration: ~4min
  completed: 2026-04-15
  tasks: 2
  commits: 2
---

# Phase 4 Plan 09: CI Network-Egress Guardrail Summary

Closes **PRIV-07** (zero outbound HTTP) by promoting the Wave-0 `scripts/check-no-network.mjs` skeleton into the full Plan 04-09 static-grep guardrail and wiring it (plus the sibling `check:config-keys` / CONF-01 gate) into the GitHub Actions PR pipeline. A negative-test fixture under `scripts/__fixtures__/forbidden-fixture.cjs` proves the guard fails correctly when a violation is introduced. Phase-4 guardrail suite is now complete end-to-end: `bundle-size` + `api-surface` + `config-keys` + `no-network` run on every PR.

## What Shipped

- **`scripts/check-no-network.mjs` — full PRIV-07 implementation (106 lines)**
  - Accepts optional path arg (default `dist/extension.cjs`) so the negative-test fixture can be fed in via `node scripts/check-no-network.mjs scripts/__fixtures__/forbidden-fixture.cjs`.
  - Missing-target is now FAIL (was SKIP in Wave-0) — CI should fail if someone forgot to `pnpm build` first.
  - **FORBIDDEN list** with per-entry `reason:` annotations (reviewer R2):
    - `http.request(` / `https.request(` — direct Node core HTTP calls
    - `require('http')` / `require('https')` / `require('node:http')` / `require('node:https')` — loading the HTTP stdlib
    - `require('undici')` / `require('got')` / `require('axios')` / `require('node-fetch')` — known HTTP libs (CJS)
    - `from "http"` / `"https"` / `"node:http"` / `"node:https"` — ESM HTTP stdlib
    - `from "undici"` / `"got"` / `"axios"` / `"node-fetch"` — ESM HTTP libs
    - `new XMLHttpRequest` — web-style HTTP
    - `globalThis.fetch` — global fetch access
    - `fetch(` — any fetch call site (reviewer R2 promoted WARN→FAIL since Node 18+ has a global `fetch`)
  - **`TCP_NET_HEURISTIC`** — `/\bnet\.(createConnection|connect)\s*\([^)]{0,120}\bhost\s*:/g` sweeps for the TCP form of `net.createConnection/connect` (IPC's `path:` form is the allowed Discord channel); matches emit WARN for manual review.
  - Surrounding-context sample on every FAIL (±40 chars around the first match, whitespace-collapsed) — makes CI logs actionable without opening the bundle.
  - Bottom-line output: `[no-network] PASS — zero outbound HTTP patterns in <path> (<bytes> bytes scanned)` on success; non-zero exit with itemised FAIL lines on failure.

- **`scripts/__fixtures__/forbidden-fixture.cjs` — 15-line negative fixture**
  - `const https = require("node:https"); module.exports = function badRequest() { return https.request("https://example.com/health"); };`
  - Running `node scripts/check-no-network.mjs scripts/__fixtures__/forbidden-fixture.cjs` exits 1 with two FAIL lines (`https.request()` + `require('node:https')`). If this fixture ever stops failing, the guard has been weakened — escalate before merging.

- **`.github/workflows/ci.yml` — two new PR-gate steps**
  - Order: checkout → pnpm setup → Node setup → install → build → bundle-size → api-surface → **config-keys** → **no-network** → test.
  - `check:no-network` runs after `pnpm build` (required — it reads `dist/extension.cjs`). `check:config-keys` only reads `package.json` so ordering is flexible but placed alongside the other static gates for visual coherence.
  - Existing matrix (ubuntu-latest), Node version (20), pnpm version (9), triggers (pull_request + push to main), and all other steps preserved verbatim.

- **`package.json` `check:no-network` entry** — already present from Wave-0 (plan 04-06 CI-invariant work); no edit required.

## Verification

| Gate | Result |
|------|--------|
| `pnpm build` | PASS (218.0 KB / 43.6% of 500 KB budget) |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS (309 passed across 19 test files — zero regression) |
| `pnpm check:bundle-size` | PASS (223 204 bytes) |
| `pnpm check:api-surface` | PASS (22 .ts files / 11 pure-core / 0 violations) |
| `pnpm check:config-keys` | PASS (14/20 keys) |
| `pnpm check:no-network` | **PASS** (0 forbidden tokens in 223 198 bytes of `dist/extension.cjs`) |
| `pnpm check:pack-inlined` | PASS (goblin strings reach the bundle) |
| `node scripts/check-no-network.mjs scripts/__fixtures__/forbidden-fixture.cjs` | **EXIT 1** (negative-test proves the guard fires on `https.request` + `require('node:https')`) |
| `! node scripts/check-no-network.mjs scripts/__fixtures__/forbidden-fixture.cjs` (bash negation) | PASS — the shell-level invariant from the plan's `<automated>` gate |
| `grep -c "\"check:no-network\"" package.json` | 1 (target = 1) |
| `grep -c "check:no-network" .github/workflows/ci.yml` | 1 (target ≥ 1) |
| `grep -c "check:config-keys" .github/workflows/ci.yml` | 1 (target ≥ 1) |
| `grep -c "check:bundle-size" .github/workflows/ci.yml` | 1 (preserved) |
| `grep -c "check:api-surface" .github/workflows/ci.yml` | 1 (preserved) |
| `wc -l scripts/check-no-network.mjs` | 106 (< 200 soft, < 300 hard) |
| `wc -l scripts/__fixtures__/forbidden-fixture.cjs` | 15 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Missing `node_modules` in fresh worktree.**
- **Found during:** pre-Task-1 baseline (`test -d node_modules` → MISSING).
- **Fix:** Ran `pnpm install --frozen-lockfile` (845 ms from lockfile, zero version drift).
- **Scope:** Dependency install only; no source or lockfile changes.
- **Commit:** n/a (no source changes).

### Non-deviating refinements

- **Kept the existing `package.json` `check:no-network` script entry unchanged.** Wave-0 (plan 04-06) already added `"check:no-network": "node scripts/check-no-network.mjs"` — plan 04-09's Task 1 action paragraph noted "Add to package.json scripts" which would have been a no-op edit. The `grep -c "\"check:no-network\"" package.json = 1` acceptance criterion is satisfied by the existing entry.
- **Preserved the `[no-network]` log prefix** from the Wave-0 skeleton for CI-log consistency with sibling guards (`[bundle-size]`, `[api-surface]`, `[config-keys]`, `[pack-inlined]` all use the same bracketed-slug prefix).

### Deferred Issues

None. Every plan acceptance criterion is GREEN; every verification gate passes; no Rule 4 architectural changes required.

## Deferred: Runtime Network Assertion (v0.2)

Plan 04-09's objective explicitly called this out: the 10-minute runtime intercept (Option 1 full from 04-RESEARCH.md §Pattern 7) is **not** shipped in this plan. It requires:

- `@vscode/test-electron` + a network-blocking harness (monkey-patch `http.request` / `https.request` / global `fetch` to throw-and-count).
- Extension-host lifecycle orchestration (spawn → load built bundle → idle 10 min → assert counter = 0 → teardown).
- A new CI matrix job or nightly workflow (10 minutes is too long for every PR).

**Why static grep is enough for v0.1:** the attack surface we care about is *importing* an HTTP stack. esbuild bundles every reachable module into `dist/extension.cjs` at build time — if `http`/`https`/`undici`/`axios`/`fetch` is reachable, it appears in the bundle text and the grep catches it. The runtime intercept catches a strict superset (dynamically constructed requires, worker threads, eval'd HTTP), but those patterns don't exist in our code or in `@xhayper/discord-rpc`'s IPC path today.

**Tracking:** v0.2 PRIV-V2 requirement will add `scripts/runtime-network-assertion.test.ts` + a `ci-nightly.yml` matrix entry. Filed as a post-Phase-4 deferred-items note.

## Threat Mitigation

| Threat ID | Disposition | Evidence |
|-----------|-------------|----------|
| T-04-09 (Information Disclosure / egress via dist/extension.cjs) | **mitigate** | Static regex scan of the built bundle against the FORBIDDEN list; CI-blocking PR gate (`.github/workflows/ci.yml` step `Check zero outbound HTTP in built bundle (PRIV-07)`); negative-test fixture proves the guard fires on injected violations. Current bundle: 0/18 FORBIDDEN patterns matched in 223 198 bytes. |
| T-04-09b (Evasion via minifier obfuscation) | **accept** | esbuild preserves property-access syntactically (`http.request` stays as `http.request` across both minify: true and false). Verified: `pnpm build` uses `minify: production` (esbuild.mjs:62) and the production bundle still has zero FORBIDDEN matches. If a future minifier rewrites `http.request` as `http["request"]`, add `/\bhttp\[\s*["']request["']\s*\]\s*\(/` to FORBIDDEN; this remains a deferred mitigation because esbuild's current behaviour doesn't exhibit it. |

## Known Stubs

None. Plan 04-09 is the final deliverable for Phase 4 — the static guardrail is a complete, shipping artefact (not a placeholder waiting on a later plan). The only documented deferral is the v0.2 runtime assertion (§"Deferred" above), which is an additive defence-in-depth layer, not a missing stub.

## Threat Flags

None — this plan adds no new network endpoints, auth paths, file access patterns, or trust-boundary schema changes. `scripts/check-no-network.mjs` is a pure filesystem-read tool; it uses only `node:fs` (`readFileSync` + `existsSync`) against local paths supplied via argv. The fixture is a leaf file under `scripts/__fixtures__/` — never `require()`d at runtime, CI-only.

## Self-Check: PASSED

- FOUND: `scripts/check-no-network.mjs` (106 lines, FORBIDDEN list + TCP heuristic + negative-test-ready CLI)
- FOUND: `scripts/__fixtures__/forbidden-fixture.cjs` (15 lines)
- FOUND: `.github/workflows/ci.yml` with `check:config-keys` + `check:no-network` steps
- FOUND commit `72ad880`: `feat(04-09): full PRIV-07 check-no-network guard + negative fixture`
- FOUND commit `d636a6c`: `ci(04-09): wire check:config-keys + check:no-network into CI`
- Verified: `pnpm build` → PASS
- Verified: `pnpm typecheck` → PASS
- Verified: `pnpm test` → 309 passed / 19 files (no regression)
- Verified: `pnpm check:bundle-size` → PASS (218 KB / 43.6%)
- Verified: `pnpm check:api-surface` → PASS
- Verified: `pnpm check:config-keys` → PASS (14/20 keys)
- Verified: `pnpm check:no-network` → PASS (0 FORBIDDEN matches)
- Verified: `pnpm check:pack-inlined` → PASS
- Verified: `! node scripts/check-no-network.mjs scripts/__fixtures__/forbidden-fixture.cjs` → EXIT 1 with expected FAIL messages (negative test)
- Verified: `grep -c "check:no-network" .github/workflows/ci.yml` = 1
- Verified: `grep -c "check:config-keys" .github/workflows/ci.yml` = 1
- Verified: `grep -c "check:bundle-size" .github/workflows/ci.yml` = 1 (preserved)
- Verified: `grep -c "check:api-surface" .github/workflows/ci.yml` = 1 (preserved)
- Verified: `git log --oneline -2` shows both commits on the worktree branch
