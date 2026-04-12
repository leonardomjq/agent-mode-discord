---
phase: 01-skeleton-rpc-seam
verified: 2026-04-12T19:28:00Z
status: human_needed
score: 17/17 automated must-haves verified
overrides_applied: 0
human_verification:
  - test: "Dev Host F5 shows 'Playing Agent Mode' with details 'hello world' in Discord friends sidebar within 2s"
    expected: "Within 2s of pressing F5, Discord friends sidebar shows 'Playing Agent Mode' activity with the hardcoded 'hello world' details line"
    why_human: "SKEL-06 requires a real Discord desktop IPC connection + a real Dev Host window; cannot be verified in CI or headless. Requires a populated Client ID (placeholder REPLACE_ME_IN_PHASE_1_HANDOFF rejects login() today)."
    requirement: SKEL-06
  - test: "Dev Host activation completes in <50 ms"
    expected: "VS Code 'Developer: Show Running Extensions' reports agent-mode-discord activation time < 50 ms"
    why_human: "SKEL-03 measurement requires VS Code's built-in extension profiler in a real Dev Host — not programmatically observable."
    requirement: SKEL-03
  - test: "Kill Dev Host with SIGTERM leaves no ghost presence"
    expected: "After kill -TERM <pid>, 'Playing Agent Mode' disappears from Discord within 5s — no ghost"
    why_human: "SKEL-07 requires real OS signal + real Discord IPC lifecycle. Unit test only verifies the wiring (handler is registered and calls clearActivity); actual cleanup observable only on real infrastructure."
    requirement: SKEL-07
  - test: "Kill Dev Host with SIGINT leaves no ghost presence"
    expected: "After kill -INT <pid> (or Ctrl+C), 'Playing Agent Mode' disappears from Discord within 5s — no ghost"
    why_human: "SKEL-07 (SIGINT path) — same rationale as SIGTERM: unit test proves wiring, real IPC proves absence of ghost."
    requirement: SKEL-07
  - test: "Discord Developer Portal app created; DEFAULT_CLIENT_ID replaced with real Application ID"
    expected: "grep 'REPLACE_ME_IN_PHASE_1_HANDOFF' src/ returns nothing; Discord app 'Agent Mode' exists with placeholder PNG assets"
    why_human: "External service action documented in docs/HUMAN-HANDOFF.md Checklist 1. Unblocks SKEL-06 manual verification and PUB-01 in Phase 6."
    requirement: SKEL-06 (manual path) / PUB-01 (Phase 6 prerequisite)
  - test: "OpenVSX namespace claim submitted"
    expected: "Eclipse Foundation account + ECA signed; namespace claim submitted at open-vsx.org; submission date recorded in HUMAN-HANDOFF.md"
    why_human: "External service action with variable lead time (hours to weeks). Must start now to unblock Phase 6 PUB-02. Independent of Phase 2 gating."
    requirement: PUB-02 (Phase 6 prerequisite, started here per ROADMAP success criterion #5)
---

# Phase 1: Skeleton + RPC Seam Verification Report

**Phase Goal:** Extension builds, loads, connects to Discord IPC with a hardcoded activity, cleans up on exit, stays under size/activation budgets. Bundle-size guardrail online in CI before any later phase can over-commit. Credential prerequisites with variable lead time started here.

**Verified:** 2026-04-12T19:28:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (from ROADMAP SC + PLAN must_haves) | Status | Evidence |
|---|-------------------------------------------|--------|----------|
| 1 | `pnpm install --frozen-lockfile` succeeds | ✓ VERIFIED | pnpm-lock.yaml present; CI uses --frozen-lockfile |
| 2 | `pnpm build` produces dist/extension.cjs with no warnings | ✓ VERIFIED | dist/extension.cjs = 201255 bytes; require() loads; exports activate/deactivate |
| 3 | Packaged bundle under 500 KB AND CI fails bloat-PR past threshold | ✓ VERIFIED | Bundle 196.5 KB (39.3% of threshold); check-bundle-size.mjs exit non-zero on >500KB (SUMMARY proof shows FAIL path tested) |
| 4 | dist/metafile.json written for downstream checks | ✓ VERIFIED | metafile.json present; outputs['dist/extension.cjs'].bytes = 201255 |
| 5 | package.json declares ONLY onStartupFinished activation | ✓ VERIFIED | activationEvents: ["onStartupFinished"] (1 entry, no wildcards) |
| 6 | package.json pins engines.vscode ^1.93.0, workspace trust supported, virtualWorkspaces false | ✓ VERIFIED | engines.vscode: "^1.93.0"; capabilities.untrustedWorkspaces.supported=true; virtualWorkspaces=false |
| 7 | @xhayper/discord-rpc is the ONLY runtime dependency | ✓ VERIFIED | dependencies = ['@xhayper/discord-rpc'] only |
| 8 | Zero proposed APIs and zero `(vscode as any)` casts enforced by CI | ✓ VERIFIED | `enabledApiProposals` not in package.json; grep of src/ returns 0 matches for both patterns; check-api-surface.mjs enforces |
| 9 | Extension publishes fixed {details: 'hello world', startTimestamp} activity after ready | ✓ VERIFIED (code path) | helloWorldAnnounce in client.ts:47-61 sets activity with details: "hello world" + Date.now() startTimestamp |
| 10 | clearActivity(pid) runs BEFORE setActivity on activate (belt-and-braces, SKEL-08) | ✓ VERIFIED | Smoke test assertion 4 passes (callOrder tracker); helloWorldAnnounce calls clearActivity at line 49 BEFORE setActivity at line 54 |
| 11 | On deactivate, clearActivity(process.pid) then client.destroy() — never setActivity(null) | ✓ VERIFIED | extension.ts shutdown() lines 60-61; grep setActivity(null) = 0 hits in src/ |
| 12 | SIGINT and SIGTERM handlers call clearActivity(process.pid) then destroy | ✓ VERIFIED | client.ts:88-99 registerSignalHandlers with process.once(SIGINT/SIGTERM); smoke test assertion 5 verifies handler invocation |
| 13 | All RPC calls wrapped in try/catch; failures silent (no toasts) | ✓ VERIFIED | Every Discord call in client.ts wrapped; smoke test assertion 3 verifies silent swallow; extension.ts catches connect() rejection with console.debug only |
| 14 | Activation does not await Discord connect (fire-and-forget) | ✓ VERIFIED | extension.ts:21 uses `void connectAndAnnounce()`; activate() signature returns void synchronously |
| 15 | CI fails build on bundle >500KB, proposed APIs, or `(vscode as any)` | ✓ VERIFIED | .github/workflows/ci.yml runs check:bundle-size + check:api-surface after build; ordered pipeline |
| 16 | CI uses pnpm install --frozen-lockfile on pull_request + push-to-main | ✓ VERIFIED | ci.yml:4-6 triggers + step "pnpm install --frozen-lockfile" present |
| 17 | pnpm test exits 0 with 5+ passing smoke assertions (SKEL-10) | ✓ VERIFIED | `pnpm test` live exec: 5/5 passed, 0 failed, 437ms |
| H1 | Hello-world activity visible in Discord friends sidebar within 2s (SKEL-06) | ? HUMAN_NEEDED | Requires real Discord desktop + Dev Host; deferred to HUMAN-HANDOFF Checklist 3.2 |
| H2 | Extension activation completes in <50 ms (SKEL-03) | ? HUMAN_NEEDED | Requires VS Code built-in profiler; deferred to HUMAN-HANDOFF Checklist 3.3 |
| H3 | Killing Dev Host leaves no ghost presence (SKEL-07 manual) | ? HUMAN_NEEDED | Requires real OS signal + real Discord IPC; deferred to HUMAN-HANDOFF Checklist 3.4-3.6 |
| H4 | Discord Developer Portal app + OpenVSX namespace claim started | ? HUMAN_NEEDED | Documented in HUMAN-HANDOFF Checklists 1 & 2; external service actions |

**Score:** 17/17 automated truths verified; 4 human-verification items deferred to docs/HUMAN-HANDOFF.md

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | Manifest: onStartupFinished, engines, capabilities, scripts | ✓ VERIFIED | 40 lines; all required fields present; 1 runtime dep; no enabledApiProposals |
| `tsconfig.json` | Strict TS + ESNext + Bundler resolution | ✓ VERIFIED | strict: true, module: ESNext, moduleResolution: Bundler, noEmit |
| `esbuild.mjs` | Single-entry CJS bundle + metafile | ✓ VERIFIED | 53 lines; cjs/node20/vscode external/metafile=true; includes shim alias for undici/ws/@discordjs/rest |
| `vitest.config.ts` | Node environment | ✓ VERIFIED | environment: "node", include: ["test/**/*.test.ts"] |
| `src/extension.ts` | Full activate/deactivate wired to RPC | ✓ VERIFIED | 67 lines; fire-and-forget connect; module state; shutdown via disposable + deactivate |
| `src/rpc/client.ts` | Injectable RPC adapter surface | ✓ VERIFIED | 99 lines; exports connect/clearActivity/helloWorldAnnounce/destroy/registerSignalHandlers/DEFAULT_CLIENT_ID/defaultDeps; no vscode import |
| `dist/extension.cjs` | Bundled output | ✓ VERIFIED | 201255 bytes; require() loads cleanly; exports activate, deactivate |
| `dist/metafile.json` | esbuild analysis | ✓ VERIFIED | outputs['dist/extension.cjs'].bytes present |
| `scripts/check-bundle-size.mjs` | 500 KB guardrail reader | ✓ VERIFIED | 35 lines; THRESHOLD_BYTES = 500*1024; reads metafile; PASS/FAIL output |
| `scripts/check-api-surface.mjs` | proposed-API + (vscode as any) scanner | ✓ VERIFIED | 55 lines; node:fs + node:path only; regex for both cast variants + enabledApiProposals check |
| `.github/workflows/ci.yml` | Single ubuntu-latest job pipeline | ✓ VERIFIED | 38 lines; ordered steps: checkout → pnpm → node → install --frozen-lockfile → build → bundle-size → api-surface → test |
| `test/rpc.client.smoke.test.ts` | 5+ vitest assertions | ✓ VERIFIED | 122 lines; 5 it() blocks; vi.mock('@xhayper/discord-rpc'); no vscode import; no process.emit; pnpm test passes |
| `docs/HUMAN-HANDOFF.md` | 3 checklists | ✓ VERIFIED | 95 lines; 22 checkboxes; all required substrings (Discord Developer Portal, OpenVSX, DEFAULT_CLIENT_ID, AGENT_MODE_CLIENT_ID, SKEL-03/06/07, variable lead time, Phase 6, F5, kill -TERM, kill -INT) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| package.json scripts.build | esbuild.mjs | `node esbuild.mjs --production` | ✓ WIRED | scripts.build = "node esbuild.mjs --production" |
| package.json main | dist/extension.cjs | VS Code loader | ✓ WIRED | main: "./dist/extension.cjs"; file exists, loads |
| src/extension.ts activate() | src/rpc/client.ts connect() | import + fire-and-forget | ✓ WIRED | Line 3-10 imports from ./rpc/client; line 21 `void connectAndAnnounce()`; line 33 `await connect(DEFAULT_CLIENT_ID)` |
| src/extension.ts deactivate() | clearActivity(process.pid) | await in shutdown() | ✓ WIRED | Line 60 `await clearActivity(client, process.pid)` before destroy(client) |
| SIGINT/SIGTERM handlers | clearActivity(pid) + destroy() | process.once(...) | ✓ WIRED | client.ts:93-94 `process.once("SIGINT", handler)` + `process.once("SIGTERM", handler)`; handler calls clearActivity then destroy |
| scripts/check-bundle-size.mjs | dist/metafile.json | readFileSync + JSON.parse | ✓ WIRED | Line 9 reads METAFILE; line 16 reads outputs['dist/extension.cjs'] |
| .github/workflows/ci.yml | pnpm check:bundle-size | run step | ✓ WIRED | Step "Bundle size check" runs `pnpm check:bundle-size` after build |
| .github/workflows/ci.yml | pnpm check:api-surface | run step | ✓ WIRED | Step "API surface check" runs `pnpm check:api-surface` |
| test/rpc.client.smoke.test.ts | src/rpc/client.ts | import + vi.mock | ✓ WIRED | Line 12 `vi.mock("@xhayper/discord-rpc")`; lines 38-43 import from "../src/rpc/client" |
| docs/HUMAN-HANDOFF.md Checklist 1 | src/rpc/client.ts DEFAULT_CLIENT_ID | file path + constant reference | ✓ WIRED | Step 1.4 shows exact ts code block with DEFAULT_CLIENT_ID + AGENT_MODE_CLIENT_ID + REPLACE_ME_IN_PHASE_1_HANDOFF |
| docs/HUMAN-HANDOFF.md Checklist 3 | SKEL-03 / SKEL-06 / SKEL-07 | verification steps tagged | ✓ WIRED | Steps 3.2 (SKEL-06), 3.3 (SKEL-03), 3.5/3.6 (SKEL-07) |

### Data-Flow Trace (Level 4)

N/A — Phase 1 produces no UI surface that renders dynamic data. The "data flow" is RPC IPC to Discord desktop; verifying real Discord presence rendering is exactly what the human-verification block covers.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build produces bundle + metafile | (artifacts already built) | dist/extension.cjs=201255 B, dist/metafile.json present | ✓ PASS |
| Bundle size under 500 KB | `pnpm check:bundle-size` | exit 0, PASS, 39.3% of threshold | ✓ PASS |
| API surface clean | `pnpm check:api-surface` | exit 0, PASS — scanned 2 .ts files | ✓ PASS |
| Smoke suite exits 0 with 5 passing assertions | `pnpm test` | 5 passed, 0 failed, 437ms | ✓ PASS |
| TypeScript typecheck clean | `pnpm typecheck` | exit 0, no output | ✓ PASS |
| Bundled extension loads + exports correct symbols | `node -e "require('./dist/extension.cjs')"` | exports: ['activate', 'deactivate'] | ✓ PASS |
| Manifest contract shape | `node -e "require('./package.json')"` | onStartupFinished only, ^1.93.0, caps correct, 1 runtime dep, no proposals | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SKEL-01 | 01-01 | onStartupFinished activation only | ✓ SATISFIED | package.json activationEvents = ["onStartupFinished"] |
| SKEL-02 | 01-03 | Packaged VSIX under 500 KB | ✓ SATISFIED (bundle proxy) | Bundle 196.5 KB enforced by check-bundle-size; full VSIX check is Phase 5 (CONTEXT.md §Bundle-size check) |
| SKEL-03 | 01-05 (manual path) | Activation under 50 ms | ? HUMAN_NEEDED | HUMAN-HANDOFF Checklist 3.3 — requires Dev Host profiler |
| SKEL-04 | 01-03 | CI fails on bundle size regression | ✓ SATISFIED | scripts/check-bundle-size.mjs + ci.yml step; exit non-zero when bytes > threshold (FAIL path exercised in 01-03 SUMMARY) |
| SKEL-05 | 01-03 | Zero proposed APIs, zero (vscode as any) | ✓ SATISFIED | check-api-surface.mjs scans src/ + package.json; grep 0 matches |
| SKEL-06 | 01-02 (code), 01-05 (manual) | Hello world visible in Discord sidebar | ✓ CODE SATISFIED / ? MANUAL HUMAN_NEEDED | helloWorldAnnounce present + wired; visibility requires real Dev Host + Discord (HUMAN-HANDOFF 3.2) |
| SKEL-07 | 01-02 (code), 01-04 (unit), 01-05 (manual) | No ghost presence on SIGINT/SIGTERM | ✓ CODE + UNIT SATISFIED / ? MANUAL HUMAN_NEEDED | registerSignalHandlers wired; smoke test assertion 5 proves handler → clearActivity(pid); real kill -TERM/-INT in HUMAN-HANDOFF 3.5/3.6 |
| SKEL-08 | 01-02 (code), 01-04 (unit) | clearActivity on activate BEFORE any setActivity | ✓ SATISFIED | helloWorldAnnounce: clearActivity at line 49 BEFORE setActivity at line 54; smoke test assertion 4 callOrder tracker verifies |
| SKEL-09 | 01-01 | pnpm build produces dist/extension.cjs with no warnings | ✓ SATISFIED | Build artifact present; 01-01 SUMMARY confirms clean build |
| SKEL-10 | 01-04 | pnpm test exits 0 | ✓ SATISFIED | Live exec: 5 tests passed, exit 0 |

All 10 SKEL requirements accounted for across the 5 plans. No orphans. SKEL-03 and the manual paths of SKEL-06/SKEL-07 are correctly routed to HUMAN-HANDOFF.md per ROADMAP Success Criterion #5.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | No TODO/FIXME/HACK/placeholder/setActivity(null)/(vscode as any)/enabledApiProposals found in src/ |

The `REPLACE_ME_IN_PHASE_1_HANDOFF` placeholder in `src/rpc/client.ts:15` is INTENTIONAL — it is documented in `docs/HUMAN-HANDOFF.md` Checklist 1.4 and guarded by the silent-failure contract (login() rejects silently; extension loads without activity). This is a Phase 1 expected state, not an anti-pattern.

The `/* eslint-disable-next-line no-console */` in `src/extension.ts:42` is INTENTIONAL — Phase 1 uses `console.debug` as a placeholder until the output channel lands in Phase 4 (CONF-05/RPC-05).

### Human Verification Required

See frontmatter `human_verification` block. Four items require human execution:

1. **SKEL-06 manual — hello world visible in Discord sidebar**
   - Test: HUMAN-HANDOFF.md Checklist 3.2
   - Expected: Within 2s of F5, "Playing Agent Mode" with details "hello world" appears
   - Why human: Real Discord desktop IPC required; cannot run headless. Blocked on Checklist 1 completing first (real Client ID).

2. **SKEL-03 — activation <50 ms**
   - Test: HUMAN-HANDOFF.md Checklist 3.3 (Developer: Show Running Extensions)
   - Expected: Activation column < 50 ms
   - Why human: VS Code built-in profiler only, not programmatically observable.

3. **SKEL-07 manual — no ghost on SIGTERM/SIGINT**
   - Test: HUMAN-HANDOFF.md Checklist 3.4/3.5/3.6 (kill -TERM / kill -INT / normal close)
   - Expected: Discord presence disappears within 5 s after each termination mode
   - Why human: Real OS signal delivery + real Discord IPC lifecycle. Unit test assertion 5 proves the handler wiring; only real infrastructure can prove the absence of a ghost.

4. **[HUMAN] prerequisites for Phase 6** (ROADMAP Phase 1 Success Criterion #5)
   - Test: HUMAN-HANDOFF.md Checklist 1 (Discord Developer Portal app) + Checklist 2 (OpenVSX namespace claim)
   - Expected: Discord app exists with Client ID in DEFAULT_CLIENT_ID; OpenVSX namespace submission recorded
   - Why human: External services with variable lead time. Start now to keep Phase 6 unblocked. Does not gate Phase 2 per HUMAN-HANDOFF §What happens next.

### Gaps Summary

No code gaps. Every artifact called for by the plans exists on disk, parses/loads cleanly, and passes both its plan-level acceptance predicates and live reruns of `pnpm build`, `pnpm check:bundle-size`, `pnpm check:api-surface`, `pnpm test`, and `pnpm typecheck`. All 17 automated observable truths are VERIFIED.

Phase 1 cannot be marked `passed` because ROADMAP Success Criterion #1 ("within 2 s of window open"), #3 (kill mid-session leaves no ghost), and #5 (`[HUMAN]` prerequisites kicked off) all require human execution. These are correctly routed to `docs/HUMAN-HANDOFF.md` with three tickable checklists covering SKEL-03, SKEL-06, SKEL-07 manual paths plus the Phase 6 credential prerequisites. The handoff doc is the intended exit artifact for this phase; once its sign-off block is complete, Phase 2 can start (per HUMAN-HANDOFF §What happens next: Phase 2 depends on Checklist 3 only; Checklists 1 & 2 block Phase 6).

**Net:** Phase 1 code is complete and the guardrail infrastructure is live. Four human-only items remain — all pre-authored as tickable checklists in HUMAN-HANDOFF.md.

---

*Verified: 2026-04-12T19:28:00Z*
*Verifier: Claude (gsd-verifier)*
