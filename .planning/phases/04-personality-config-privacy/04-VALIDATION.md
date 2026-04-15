---
phase: 4
slug: personality-config-privacy
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-14
updated: 2026-04-15
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from `## Validation Architecture` in 04-RESEARCH.md.
> Planner completed per-task verification map 2026-04-15 alongside plans 04-00..04-09.
> Revised 2026-04-14 from cursor review (R1/R2/R4/R5): 04-05-T2 now invokes `check:pack-inlined` script; 04-09 fixture added for negative-test.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (already installed via Phase 3) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm test --run` (or `bun run test -- --run`) |
| **Full suite command** | `pnpm test --run && pnpm typecheck && pnpm check:api-surface && pnpm build && pnpm check:bundle-size && pnpm check:config-keys && pnpm check:no-network` |
| **Estimated runtime** | ~10 seconds (pure-core only; no VS Code launch) |

---

## Sampling Rate

- **After every task commit:** `pnpm test --run` (filter to changed file's spec where possible)
- **After every plan wave:** `pnpm test --run` (full vitest suite) + `pnpm typecheck`
- **Before `/gsd-verify-work`:** Full suite + all guardrail scripts must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-00-T1 | 04-00 | 0 | all PERS/PRIV/CONF | T-04-01..04 | test scaffolding + fixtures | helper | `pnpm typecheck` | ✅ authored | ⬜ pending |
| 04-00-T2 | 04-00 | 0 | all PERS/PRIV/CONF | — | it.todo stubs for all 7 test files | unit | `pnpm test --run` | ✅ authored | ⬜ pending |
| 04-00-T3 | 04-00 | 0 | PRIV-07, CONF-01 | T-04-09 | PURE_CORE extended + HUMAN-UAT | guardrail | `pnpm check:api-surface` | ✅ authored | ⬜ pending |
| 04-01-T1 | 04-01 | 1 | PERS-01, PERS-07, PERS-08 | T-04-01, T-04-02 | schema validation + 100KB cap + proto-pollution safe | unit | `pnpm test --run test/presence.packLoader.test.ts` | ✅ planned | ⬜ pending |
| 04-01-T2 | 04-01 | 1 | — | — | PURE_CORE guard for types.ts + packLoader.ts | guardrail | `pnpm check:api-surface` | ✅ planned | ⬜ pending |
| 04-02-T1 | 04-02 | 2 | PERS-02, PERS-03 | — | weighted pool + FY no-repeat + time-of-day helpers | unit | `pnpm test --run test/presence.animator.test.ts -t "timeOfDayBucket\|pickWeighted\|pickFromPool"` | ✅ planned | ⬜ pending |
| 04-02-T2 | 04-02 | 2 | PERS-02..05, CONF-03, PRIV-06 | T-04-05, T-04-06 | two-clock animator + blank-skip cap + live reread | unit (fake timers) | `pnpm test --run test/presence.animator.test.ts` | ✅ planned | ⬜ pending |
| 04-02-T3 | 04-02 | 2 | — | — | PURE_CORE guard for animator.ts | guardrail | `pnpm check:api-surface` | ✅ planned | ⬜ pending |
| 04-03-T1 | 04-03 | 1 | PERS-06 | T-04-03 | renderTemplate + isBlank (bounded regex) | unit | `pnpm test --run test/presence.templater.test.ts` | ✅ planned | ⬜ pending |
| 04-03-T2 | 04-03 | 1 | — | — | PURE_CORE guard for templater.ts | guardrail | `pnpm check:api-surface` | ✅ planned | ⬜ pending |
| 04-04-T1 | 04-04 | 3 | PERS-06 | T-04-11 | formatElapsed + buildTokens + buildPayload | unit | `pnpm test --run test/presence.activityBuilder.test.ts -t "formatElapsed\|buildTokens\|buildPayload"` | ✅ planned | ⬜ pending |
| 04-04-T2 | 04-04 | 3 | PRIV-05, CONF-04 | T-04-10 | clear-once ignore + clear-once idle; never setActivity(null); never destroy RPC | unit (fake timers) | `pnpm test --run test/presence.activityBuilder.test.ts` | ✅ planned | ⬜ pending |
| 04-04-T3 | 04-04 | 3 | — | — | PURE_CORE guard for activityBuilder.ts | guardrail | `pnpm check:api-surface` | ✅ planned | ⬜ pending |
| 04-05-T1 | 04-05 | 1 | PERS-01 | T-04-04 | goblin.json verbatim from D-05; ≤50 char audit | static | `node -e` length audit; JSON parse | ✅ planned | ⬜ pending |
| 04-05-T2 | 04-05 | 1 | PERS-01 | — | esbuild inlines goblin.json into bundle | static | `node scripts/check-pack-inlined.mjs` | ✅ planned | ⬜ pending |
| 04-06-T1 | 04-06 | 1 | CONF-01, PERS-05/07, PRIV-01/02/03/05 | — | 14-key manifest with title/description/default/enumDescriptions | static | `node scripts/check-config-keys.mjs` | ✅ planned | ⬜ pending |
| 04-06-T2 | 04-06 | 1 | CONF-02, CONF-03, CONF-05 | — | readConfig() lazy; blank clientId→DEFAULT; log verbose-gated | unit | `pnpm test --run test/config.test.ts test/outputChannel.test.ts` | ✅ planned | ⬜ pending |
| 04-06-T3 | 04-06 | 1 | CONF-01 | — | CI guardrail script for ≤20 keys | guardrail | `node scripts/check-config-keys.mjs` | ✅ planned | ⬜ pending |
| 04-07-T1 | 04-07 | 2 | PRIV-01 | T-04-07, T-04-08 | SHA-1 6-hex hash deterministic; redact hash branch; normalizeForHash cross-platform | unit | `pnpm test --run test/privacy.test.ts` | ✅ planned | ⬜ pending |
| 04-07-T2 | 04-07 | 2 | PRIV-05 | T-04-03 | glob + git URL normalizer + ReDoS-safe regex + evaluateIgnore | unit | `pnpm test --run test/privacy.test.ts` | ✅ planned | ⬜ pending |
| 04-07-T3 | 04-07 | 2 | PRIV-03, PRIV-04 | — | getCurrentBranch with async activation + silent degrade | unit (mocked vscode) | `pnpm test --run test/privacy.gitBranch.test.ts` | ✅ planned | ⬜ pending |
| 04-08-T1 | 04-08 | 4 | CONF-03, PERS-07, PRIV-03/04/06 | T-04-12 | extension.ts wires activityBuilder + config listener + state-transition forceTick + poll-on-tick packLoader | integration | `pnpm test --run && pnpm build && pnpm check:bundle-size` | ✅ planned | ⬜ pending |
| 04-09-T1 | 04-09 | 5 | PRIV-07 | T-04-09 | static grep of dist/extension.cjs for forbidden HTTP imports | static | `node scripts/check-no-network.mjs` | ✅ planned | ⬜ pending |
| 04-09-T2 | 04-09 | 5 | PRIV-07, CONF-01 | T-04-09 | CI wires check:no-network + check:config-keys | static | `grep -c "check:no-network" .github/workflows/ci.yml` | ✅ planned | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Test scaffolding created in plan 04-00 (already authored — see 04-00-PLAN.md).

- [ ] `test/presence.packLoader.test.ts` — schema validation, fallback to built-in (04-01 flips it.todo)
- [ ] `test/presence.animator.test.ts` — Fisher-Yates no-repeat, 2s/20s clocks (04-02 flips)
- [ ] `test/presence.templater.test.ts` — placeholder substitution, blank-skip (04-03 flips)
- [ ] `test/presence.activityBuilder.test.ts` — payload assembly invariants + clear-once (04-04 flips)
- [ ] `test/privacy.gitBranch.test.ts` — show|hide|hash; SHA-1 6-hex determinism; ignore-list silence (04-07-T3 flips)
- [ ] `test/config.test.ts` — CONF-02 blank→DEFAULT; lazy reread (04-06-T2 flips)
- [ ] `test/outputChannel.test.ts` — CONF-05 debug.verbose gating (04-06-T2 flips)
- [ ] `test/privacy.test.ts` — extended with SHA-1 + ignore-list (04-07-T1/T2 extend existing)
- [ ] `scripts/check-no-network.mjs` — static grep of `dist/extension.cjs` (04-09-T1 creates)
- [ ] `scripts/check-config-keys.mjs` — ≤20 keys + metadata audit (04-06-T3 creates)
- [ ] `scripts/check-pack-inlined.mjs` — canonical goblin strings present in dist/extension.cjs (04-05-T2 creates; reviewer R1 named-script replacement)
- [ ] `scripts/__fixtures__/forbidden-fixture.cjs` — negative-test bundle that MUST fail check-no-network (04-09-T1 creates; reviewer R2 proof fixture)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `contributes.configuration` UI rendering in VS Code Settings | CONF-01..05 | VS Code Settings UI is not introspectable from headless tests | Launch Extension Dev Host, open Settings, search "Agent Mode", verify ≤20 keys, all have `title` + `description`, enums render as dropdowns |
| Live-reload of privacy flip end-to-end | PRIV-06 | Requires real VS Code + real Discord desktop | Toggle `agentMode.privacy.workspaceName` show→hash in Settings; within 20s observe Discord activity change workspace to 6-hex hash |
| Custom pack load end-to-end | PERS-07 | Requires filesystem + real Dev Host | Author a tiny custom pack JSON, set `agentMode.messages.customPackPath` to it; within 20s observe Discord activity pulling from the new pool |
| Ignore-match full silence | PRIV-05 | Requires real Discord desktop observation | Set `agentMode.ignore.workspaces` to match current workspace; within 20s observe Discord activity clear; remove rule; within 20s observe activity resume |
| `idleBehavior: clear` | CONF-04 | Requires real Discord | Set `idleBehavior` to `clear`; let editor focus drop for > idleTimeoutSeconds; observe Discord activity clear but RPC connection persists (bring state back to CODING, activity resumes) |
| 10-minute zero-HTTP runtime sustained test | PRIV-07 | Runtime intercept requires `@vscode/test-electron` harness (deferred to v0.2 per plan 04-09 pitfalls) | v0.2: `pnpm test:network:long` — runs Extension Host for 600s with `http`/`https` intercepts |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (plans 04-01..04-09 flip it.todo into real assertions)
- [x] No watch-mode flags (`--run` enforced everywhere)
- [x] Feedback latency < 30s
- [x] nyquist_compliant: true set in frontmatter

**Approval:** planner-approved 2026-04-15 (pending execution-time re-validation)
