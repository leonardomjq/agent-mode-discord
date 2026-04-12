---
phase: 1
slug: skeleton-rpc-seam
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^2 |
| **Config file** | `vitest.config.ts` (Wave 0 installs) |
| **Quick run command** | `pnpm test` |
| **Full suite command** | `pnpm build && pnpm check:bundle-size && pnpm check:api-surface && pnpm test` |
| **Estimated runtime** | ~15–30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test`
- **After every plan wave:** Run `pnpm build && pnpm check:bundle-size && pnpm check:api-surface && pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green AND manual Dev Host checklist completed
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-* | 01-01 | 0 | SKEL-01, SKEL-09 | — | Manifest declares `onStartupFinished` only; `pnpm build` produces `dist/extension.cjs` | static | `pnpm build && test -f dist/extension.cjs` | ❌ W0 | ⬜ pending |
| 01-02-* | 01-02 | 1 | SKEL-06, SKEL-07, SKEL-08, SKEL-10 | T-01-01 (ghost presence) | clearActivity(pid) called on activate, deactivate, SIGINT, SIGTERM; never setActivity(null) | unit | `pnpm test` | ❌ W0 | ⬜ pending |
| 01-03-* | 01-03 | 1 | SKEL-02, SKEL-04, SKEL-05 | T-01-02 (bundle bloat), T-01-03 (proposed API regression) | Bundle <500KB enforced; no proposed APIs; no `(vscode as any)` casts | static | `pnpm check:bundle-size && pnpm check:api-surface` | ❌ W0 | ⬜ pending |
| 01-04-* | 01-04 | 1 | SKEL-10 | — | vitest smoke asserts 5 RPC-adapter behaviors | unit | `pnpm test` | ❌ W0 | ⬜ pending |
| 01-05-* | 01-05 | 2 | — (supports SKEL-06 manual path + Phase 6 PUB-01/02) | — | Handoff doc exists with two checklists (Discord Developer Portal + OpenVSX namespace) | static | `test -f docs/HUMAN-HANDOFF.md && grep -q 'OpenVSX' docs/HUMAN-HANDOFF.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` — scripts registered for `build`, `check:bundle-size`, `check:api-surface`, `test`
- [ ] `vitest.config.ts` — `environment: "node"`, `include: ["test/**/*.test.ts"]`
- [ ] `tsconfig.json` — strict, `module: ESNext`, `moduleResolution: Bundler`
- [ ] `esbuild.mjs` — writes `dist/metafile.json`
- [ ] `scripts/check-bundle-size.mjs` — reads metafile, 500 KB threshold, exits non-zero on regression
- [ ] `scripts/check-api-surface.mjs` — scans src/**/*.ts for `(vscode as any)`, checks `package.json` for `enabledApiProposals`
- [ ] `test/rpc.client.smoke.test.ts` — 5 assertions covering SKEL-07, SKEL-08, SKEL-10
- [ ] `.github/workflows/ci.yml` — build → bundle-size → api-surface → test steps
- [ ] `pnpm install` seeds `@xhayper/discord-rpc@^1.3.1`, `vitest@^2`, `esbuild@^0.24`, `typescript@^5.4`, `@types/vscode@^1.93.0`, `@types/node@^22`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hello-world activity visible in Discord friends sidebar within 2s | SKEL-06 | Real Discord desktop connection required; cannot run in CI | 1. `pnpm build`; 2. Open repo in VS Code; 3. Press F5; 4. Open Discord desktop; 5. Observe friends sidebar — "Playing Agent Mode" with `details: "hello world"` appears ≤2s |
| Extension activation completes in <50 ms | SKEL-03 | Requires VS Code's built-in extension profiler | 1. Open Dev Host; 2. Cmd/Ctrl+Shift+P → "Developer: Show Running Extensions"; 3. Observe activation time column for `agent-mode-discord` |
| Killing Dev Host leaves no ghost presence | SKEL-07 | Requires real Discord IPC + real OS signals | 1. Dev Host running with activity visible in Discord; 2. Kill process via `kill -TERM <pid>` (or OS task manager); 3. Wait 5s; 4. Confirm Discord presence disappears |
| Restarting Dev Host does NOT duplicate activity | SKEL-08 | Requires real Discord IPC lifecycle | 1. After kill-ghost test above; 2. Restart Dev Host (F5 again); 3. Confirm exactly ONE "Playing Agent Mode" in Discord |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (no `vitest` without `run`; no `esbuild.mjs --watch` in CI)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (flip after planner + checker approve)

**Approval:** pending
