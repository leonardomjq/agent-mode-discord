---
phase: 4
slug: personality-config-privacy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from `## Validation Architecture` in 04-RESEARCH.md. The planner
> fills in the per-task verification map and Wave 0 stubs in step 8.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (already installed via Phase 3) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `bun run test -- --run` |
| **Full suite command** | `bun run test -- --run --coverage` |
| **Estimated runtime** | ~8 seconds (pure-core only; no VS Code launch) |

---

## Sampling Rate

- **After every task commit:** Run `bun run test -- --run` (filter to changed file's spec where possible)
- **After every plan wave:** Run `bun run test -- --run` (full vitest suite)
- **Before `/gsd-verify-work`:** Full suite + `bun run check:api-surface` + `bun run check:no-network` must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Planner fills this table during step 8 from PLAN.md task lists. Each task
> must map to either an automated command, a Wave 0 stub, or be flagged in
> Manual-Only Verifications below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD     | TBD  | TBD  | TBD         | TBD        | TBD             | TBD       | TBD               | TBD         | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Test scaffolding to be created in plan 04-00 (matches Phase 3 03-00 pattern).
> Confirm/expand based on planner's task breakdown.

- [ ] `tests/presence/packLoader.test.ts` — schema validation, fallback to built-in
- [ ] `tests/presence/animator.test.ts` — Fisher-Yates no-repeat, 2s/20s clocks (injected timers)
- [ ] `tests/presence/templater.test.ts` — placeholder substitution, blank-skip
- [ ] `tests/presence/activityBuilder.test.ts` — payload assembly invariants
- [ ] `tests/privacy/privacy.test.ts` — show|hide|hash; SHA-1 6-hex determinism; ignore-list silence
- [ ] `tests/config/liveReload.test.ts` — onDidChangeConfiguration applies on next tick
- [ ] `tests/fixtures/goblin-pack.json` — fixture pack for unit tests
- [ ] `scripts/check-no-network.mjs` — static grep of `dist/extension.cjs` for HTTP module references

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `contributes.configuration` UI rendering in VS Code Settings | CONF-01..05 | VS Code Settings UI is not introspectable from headless tests | Launch Extension Dev Host, open Settings, search "Discord Rich", verify ≤20 keys, all have `title` + `description`, enums render as dropdowns |
| 10-minute zero-HTTP runtime sustained test | PRIV-07 | CI runtime cost; nightly stretch only | `bun run test:network:long` (planner to add) — runs Extension Host for 600s with `http`/`https` intercepts |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`--run` enforced everywhere)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
