---
phase: 02
slug: core-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Sourced from `02-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.1.9 (installed in Phase 1) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `pnpm test` |
| **Full suite command** | `pnpm test && pnpm typecheck && pnpm build && pnpm check:bundle-size && pnpm check:api-surface` |
| **Estimated runtime** | ~5 seconds (Phase 1 full suite: 431 ms; Phase 2 adds 6 files, still well under 10 s) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test`
- **After every plan wave:** Run `pnpm test && pnpm typecheck && pnpm build && pnpm check:bundle-size && pnpm check:api-surface`
- **Before `/gsd-verify-work`:** Full suite must be green + manual Dev Host UAT in `02-HUMAN-UAT.md` signed off
- **Max feedback latency:** ~5 seconds (quick); ~30 seconds (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-00-01 | 00 (Wave 0) | 0 | infra | — | N/A | static | `test -f test/state.machine.test.ts` | ❌ W0 | ⬜ pending |
| 02-00-02 | 00 (Wave 0) | 0 | infra | — | N/A | static | `test -f test/rpc.throttle.test.ts` | ❌ W0 | ⬜ pending |
| 02-00-03 | 00 (Wave 0) | 0 | infra | — | N/A | static | `test -f test/rpc.client.backoff.test.ts` | ❌ W0 | ⬜ pending |
| 02-00-04 | 00 (Wave 0) | 0 | infra | — | N/A | static | `test -f test/privacy.test.ts` | ❌ W0 | ⬜ pending |
| 02-00-05 | 00 (Wave 0) | 0 | D-16 | path-ban | no vscode under src/state/** | static | `pnpm check:api-surface` | ❌ W0 | ⬜ pending |
| 02-01-* | 01 state/machine.ts | 1 | STATE-01..05 | — | pure reducer, no side effects | unit | `pnpm vitest run test/state.machine.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-* | 02 state/context.ts | 2 | STATE-01..04 | — | immutable snapshot | unit | `pnpm vitest run test/state.machine.test.ts -t "context"` | ❌ W0 | ⬜ pending |
| 02-03-* | 03 rpc/throttle.ts | 1 | RPC-02, STATE-06 | — | last-wins, leading+trailing | unit | `pnpm vitest run test/rpc.throttle.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-* | 04 rpc/client.ts hardening | 2 | RPC-01, RPC-03..06 | T-RPC-01 (replay-after-deactivate), T-RPC-03 (late-resolve race) | silent swallow, pid-scope, cooldown floor | unit | `pnpm vitest run test/rpc.client.backoff.test.ts` | ❌ W0 | ⬜ pending |
| 02-05-* | 05 privacy.ts | 1 | FR-6 stub | — | show passes, hide empty, hash throws | unit | `pnpm vitest run test/privacy.test.ts` | ❌ W0 | ⬜ pending |
| 02-06-* | 06 detectors/editor.ts | 3 | STATE-01, STATE-02 | — | vi.mock("vscode") dispatch assertion | unit | `pnpm vitest run test/detectors.editor.test.ts` | ❌ W0 | ⬜ pending |
| 02-07-* | 07 detectors/git.ts + driver | 3 | all 12 | T-RPC-01 | driver wiring, idle timer, pid scope | unit + manual | `pnpm vitest run test/detectors.git.test.ts && pnpm test` + Dev Host UAT | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/state.machine.test.ts` — stubs for STATE-01 through STATE-05 (+ startTimestamp invariant)
- [ ] `test/rpc.throttle.test.ts` — stubs for RPC-02 + STATE-06
- [ ] `test/rpc.client.backoff.test.ts` — stubs for RPC-03, RPC-04, RPC-05, pid forwarding (RPC-01)
- [ ] `test/privacy.test.ts` — stubs for show/hide/hash
- [ ] `test/detectors.editor.test.ts` — vi.mock("vscode") skeleton
- [ ] `test/detectors.git.test.ts` — vi.mock("vscode") skeleton with git extension stub
- [ ] Extend `scripts/check-api-surface.mjs` — path-scoped `vscode`-import ban (src/state/**, src/rpc/throttle.ts, src/privacy.ts)
- [ ] `02-HUMAN-UAT.md` — Dev Host checklist covering SC 1, SC 3, SC 4 (manual-only)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-window pid isolation | RPC-01 / SC-4 | Needs two real VS Code Dev Host windows talking to Discord desktop; process-level isolation cannot be faked in vitest. | Launch F5 twice from different workspaces; open a file in each; verify two independent activities appear in Discord friends sidebar; close one — other remains. |
| Discord kill/restart replay | RPC-04 / SC-3 | Requires actual Discord desktop process lifecycle. | In Dev Host with extension active + a file open, `pkill Discord` (or OS equivalent); wait 20 s, observe console.debug backoff cadence in Output; relaunch Discord; verify activity reappears within one backoff tick (≤60 s) with no manual action. |
| Real-time IDLE transition | STATE-02 / SC-1 | `idleTimeoutSeconds` hardcoded to 300_000 ms in Phase 2; manual observation confirms timer fires in wall-clock time. | Dev Host: focus a file (CODING appears) → close all editors → wait 5 minutes → verify IDLE in Discord. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s (quick) / < 30s (full)
- [ ] `nyquist_compliant: true` set in frontmatter after planner populates tasks

**Approval:** pending
