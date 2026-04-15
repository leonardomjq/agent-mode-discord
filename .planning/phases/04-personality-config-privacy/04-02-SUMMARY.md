---
phase: "04"
plan: "02"
subsystem: presence-animator
tags: [presence, animator, two-clock, fisher-yates, time-of-day, pure-core, wave-2]
dependency_graph:
  requires:
    - src/presence/types.ts (Pack, Message — 04-01)
    - src/presence/templater.ts (renderTemplate, isBlank — 04-03)
    - src/config.ts (AgentModeConfig — 04-06)
    - test/presence.animator.test.ts (04-00 stub — 17 it.todo flipped)
    - test/presence/__helpers__/packFixtures.ts (MINIMAL_GOBLIN_FIXTURE, makeValidPack)
    - test/presence/__helpers__/fakeClocks.ts (makeFakeClocks virtual-time runner)
  provides:
    - src/presence/animator.ts (createAnimator, pickWeightedPool, pickFromPool, timeOfDayBucket, realAnimatorDeps)
    - AnimatorContext / AnimatorDeps / AnimatorOpts / PoolEntry / PresenceKind types
  affects:
    - 04-04 activityBuilder (imports createAnimator + drives it from driver/state transitions)
    - 04-08 extension.ts wiring (animator lifecycle via activityBuilder)
tech_stack:
  added: []
  patterns:
    - options-bag injection (now / rand / setInterval / clearInterval) — mirrors src/detectors/sessionFiles.ts
    - two independent setIntervals (D-12) — clean semantics for PERS-02 + PERS-04 separation
    - filtered-survivors weighted picker — equivalent to D-08 redistribution without explicit re-weighting
    - per-pool lastPicked Map keyed by pool id (Pitfall 1 fix)
    - bounded blank-skip loop (MAX_BLANK_ATTEMPTS=10) → hard fallback "building, afk" (T-04-05)
    - lazy getPack() / getConfig() / getContext() per rotation tick (D-24 no-cache)
key_files:
  created:
    - src/presence/animator.ts
  modified:
    - test/presence.animator.test.ts (17 it.todo → 38 passing assertions)
decisions:
  - Two separate setIntervals over setTimeout-reschedule chain — the fakeClocks virtual-time runner already models setInterval cleanly; no drift concern at 20 s / 2 s cadences
  - Per-pool lastPicked stored as Map<string, Message> keyed by canonical pool id ("AGENT_ACTIVE:_primary", "AGENT_ACTIVE:claude", "timeOfDay:morning", etc.) — directly implements Pitfall 1 fix without cross-pool false-positives
  - Blank-skip loop does NOT update lastPicked on blank retries — prevents a degenerate "we tried X, it was blank; so lastPicked=X; now we skip X on the next attempt and find the same remaining elements also blank" recording pattern. Only commits lastPicked on a non-blank result.
  - Filtered-survivors weighted picker (filter by pool && pool.length > 0, then sum remaining weights) gives the exact same distribution as D-08's explicit redistribution rule, with one less allocation per tick
  - pickFromPool singleton short-circuit (pool.length === 1) returns the only member even when lastPicked matches — singleton cannot satisfy no-repeat and throwing would leak DoS surface; R5 reviewer case
  - Task 3 (PURE_CORE_PATHS extension) was already satisfied by 04-00's Wave-0 pre-seed; verified grep count = 1 and pnpm check:api-surface PASSES with 10 pure-core files — no additional commit needed, mirrors 04-03's Task 2 handling
  - realAnimatorDeps.setInterval/clearInterval signatures typed as `(fn, ms) => unknown` / `(t: unknown) => void` in the interface so fake-clock tokens (plain numbers) type-check against the production NodeJS.Timeout interface — the impl cast happens only once at the realAnimatorDeps boundary
  - start() is idempotent (clearTimers() first) so an accidental double-start does not leak timers — T-04-06 defense-in-depth beyond what stop() guarantees
metrics:
  duration: ~8min
  completed: 2026-04-15
  tasks: 3
  commits: 2
---

# Phase 4 Plan 02: Two-Clock Animator Summary

Ships the pure-core two-clock animator at `src/presence/animator.ts` (281 lines / 94% of 300 hard limit) — a `createAnimator({ getPack, getConfig, getContext, onRender }, depsOverride?)` factory that owns the 20 s rotation + 2 s frame timing, the weighted pool pick with D-08 missing-pool redistribution, Fisher-Yates no-repeat with per-pool `lastPicked` memory, time-of-day bucketing (D-11), blank-skip with 10-attempt cap + `"building, afk"` hard fallback (T-04-05), and `animations.enabled=false` freeze-on-frame-0 (D-10). Config and pack are pulled lazily per rotation tick (D-24) — no caching. Plan 04-04 can now wire `createAnimator` into the Phase-2 driver, replacing the hardcoded `buildPayload`.

## What Shipped

- **`src/presence/animator.ts` (281 lines, pure-core)** — nine exports:
  - `createAnimator(opts, depsOverride?) → { start(), stop(), forceTick() }` — the factory. `start()` immediately renders (rotation tick 0), then registers both setIntervals. Idempotent (clearTimers() before re-register) so an accidental double-start does not leak handles. `stop()` clears both timers (T-04-06). `forceTick()` runs `rotationTick()` synchronously without rescheduling — used by activityBuilder (04-04) to flush on state transitions.
  - `pickWeightedPool(entries, rand) → PoolEntry | null` — filters undefined/empty pools and performs cumulative-weight selection on the survivors. Equivalent to D-08's explicit redistribution rule with one less allocation.
  - `pickFromPool(pool, lastPicked, rand) → Message` — Fisher-Yates no-repeat single-pick. Singleton pools short-circuit; rand()===1 guarded; `pool[idx] === lastPicked` skip via `(idx + 1) % len`.
  - `timeOfDayBucket(d: Date)` — four if-branches over `d.getHours()`; local-time, DST-transparent.
  - `realAnimatorDeps: AnimatorDeps` — production bindings for now / rand / setInterval / clearInterval.
  - Types: `PresenceKind`, `AnimatorContext`, `AnimatorDeps`, `AnimatorOpts`, `PoolEntry`.
- **38 passing tests in `test/presence.animator.test.ts`** (up from 17 `it.todo` stubs):
  - **`timeOfDayBucket`** (8 tests): the four representative hours + all four boundary transitions (00/06/12/18).
  - **`pickWeightedPool`** (8 tests): AGENT_ACTIVE 70/20/10 splits at rand=0/0.75/0.95; claude-missing → 90/10 with boundary check at r=0.87/0.89; tod-missing → 87.5/12.5; both-missing → 100% primary; empty-pool treated as missing; no-valid-pools → null.
  - **`pickFromPool`** (6 tests): singleton short-circuit; 2-element skip; 3-element skip; lastPicked=null no-skip; rand()===1 no out-of-bounds; 100 consecutive picks over a 3-element pool with pseudo-seeded Mulberry32-style generator — zero adjacent duplicates (PERS-03).
  - **`createAnimator`** integration (16 tests): immediate render on start; 5 × 20 s rotations fire; 2 s frame clock cycles `[a., a.., a...]` with wrap at 3; singleton messages ignore frame clock; `animations.enabled=false` freeze (9 frame ticks, zero renders); AGENT_ACTIVE + aider-no-subpool redistributes; CODING 85/15; IDLE 90/10; blank-skip caps at 10 → `"building, afk"`; `stop()` halts all renders; `forceTick()` runs synchronously; config live-reread (enabled→disabled mid-run freezes next frame); privacy.filename flip applies next rotation (PRIV-06); per-pool `lastPicked` survives AGENT_ACTIVE→IDLE→AGENT_ACTIVE trip (D-04, R5); singleton pool doesn't throw across 3 rotations (R5); mid-run pool growth from ["a"] to ["a","b","c"] no-crashes + holds no-repeat (R5).
- **`scripts/check-api-surface.mjs`** — already contains `src/presence/animator.ts` in `PURE_CORE_PATHS` (seeded by plan 04-00). Task 3's acceptance criteria were verified rather than applied: `grep -c "src/presence/animator.ts" scripts/check-api-surface.mjs` = 1 and `pnpm check:api-surface` passes with 10 pure-core files scanned.

## Verification

| Gate | Result |
|------|--------|
| `pnpm typecheck` | PASS |
| `pnpm vitest run test/presence.animator.test.ts` | PASS (38/38, zero todo) |
| `pnpm test` (full suite) | PASS (242 passed / 13 todo across 19 files) |
| `pnpm check:api-surface` | PASS (10 pure-core files, zero violations — animator.ts counted) |
| `pnpm build` | PASS |
| `pnpm check:bundle-size` | PASS (207.5 KB / 41.5% of 500 KB — no delta; animator is pure-core but not yet reachable from extension.ts root) |
| `wc -l src/presence/animator.ts` | 281 (< 300 hard limit; D-04 soft 200 exceeded by design given helper + factory + blank-skip + renderCurrent all in one module) |
| `grep -c "export function createAnimator" src/presence/animator.ts` | 1 |
| `grep -c "export function timeOfDayBucket" src/presence/animator.ts` | 1 |
| `grep -c "export function pickWeightedPool" src/presence/animator.ts` | 1 |
| `grep -c "export function pickFromPool" src/presence/animator.ts` | 1 |
| `grep -c 'import.*from "vscode"' src/presence/animator.ts` | 0 (pure-core holds — only imports from ./types, ./templater, ../config type) |
| `grep -c "src/presence/animator.ts" scripts/check-api-surface.mjs` | 1 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing node_modules**
- **Found during:** Task 1 RED verification (`pnpm vitest` failed with `vitest: command not found`; lockfile present, `node_modules/` absent — standard worktree state).
- **Fix:** Ran `pnpm install` (875 ms from lockfile, no version changes).
- **Scope:** dependency install only — did not modify package.json / pnpm-lock.yaml.
- **Commit:** n/a (no source changes).

**2. [Rule 1 - Bug] Fixed test-helper `undefined` override bug**
- **Found during:** Task 1 GREEN verification — two `pickWeightedPool` tests failed because `agentActiveEntries({ claude: undefined })` was falling through to the default via `opts?.claude ?? claude` (nullish coalescing treats `undefined` as "use default").
- **Fix:** Switched the helper to `"claude" in opts ? opts.claude : claude` checks so an explicit `undefined` override actually clears the pool. The three test assertions (boundary tests on redistributed weights) then passed without touching the implementation.
- **Files modified:** `test/presence.animator.test.ts` (test helper only).
- **Commit:** Folded into f723949 (GREEN) since the bug was in the RED test file; no separate commit needed.

**3. [Rule 1 - Bug] Fixed `animations.enabled=false` test loop bound**
- **Found during:** Task 1 GREEN verification — the test ran 10 × advance(2 000) which crosses the 20 000 ms rotation boundary, triggering an extra rotation render that the test wasn't expecting.
- **Fix:** Reduced to 9 × advance(2 000) = 18 000 ms (below the rotation boundary) so the test exercises only frame-clock behavior. The animator implementation is correct; the test was asking the wrong question.
- **Files modified:** `test/presence.animator.test.ts` (single loop bound).
- **Commit:** Folded into f723949 (GREEN).

### Non-deviating refinements

- **Task 3 (PURE_CORE_PATHS extension) was already satisfied by Wave-0.** Plan 04-00's pre-seed added `src/presence/animator.ts` to `PURE_CORE_PATHS` in `scripts/check-api-surface.mjs`. Task 3's `<action>` block anticipated this pattern (appending only if not present). Verified rather than applied — matches 04-03's Task 2 handling.
- **Blank-skip retry does NOT update lastPicked** (plan spec silent on this). Rationale: updating lastPicked on a blank skip would record the attempted pick as "last", so a subsequent attempt with the same rand draw would skip it and converge on a different (still-blank) pick. Better to only commit lastPicked on a successful (non-blank) pick so the no-repeat invariant tracks what actually rendered. Documented in the code comment.
- **`start()` is idempotent** (plan spec silent). Defense-in-depth beyond T-04-06: if an upstream bug causes start() to fire twice, the first timer set is cleared before the second is registered — no handle leak. stop() remains the primary T-04-06 mitigation.

## Threat Mitigation

| Threat ID | Mitigation | Evidence |
|-----------|------------|----------|
| T-04-05 (DoS via blank-skip infinite loop) | `MAX_BLANK_ATTEMPTS = 10`; `pickNextMessage` loop returns `BLANK_FALLBACK` after 10 consecutive blank renders | Test "blank-after-substitution skip caps at 10 attempts → hard-fallback 'building, afk'" + named constant at top of src/presence/animator.ts |
| T-04-06 (Timer leak on config churn) | Both `rotationTimer` and `frameTimer` handles stored in the factory closure; `stop()` calls `deps.clearInterval` on both; `forceTick()` does not register new timers | Test "stop() clears both timers — no further renders after stop" + `clearTimers()` helper called from both `stop()` and `start()` (idempotent defense) |

## Known Stubs

None. Animator is feature-complete for PERS-02/03/04/05/07/08 and PRIV-06/CONF-03 as scoped by 04-02-PLAN. Downstream plans own the wiring:
- Plan 04-04 (activityBuilder) — passes `BUILTIN_GOBLIN_PACK` + `loadPack(customPackPath)` as `getPack`, `readConfig` as `getConfig`, and wires `onRender` into the Phase-2 driver/throttle/RPC pipeline.
- Plan 04-07 (privacy) — populates `AnimatorContext.tokens` after running redaction; the blank-skip loop already handles privacy-induced blanks correctly (PERS-06 semantics).
- Plan 04-08 (extension wiring) — owns the animator lifecycle (`start()` on activate, `stop()` on deactivate).

## Threat Flags

None — this plan introduces no new network endpoints, auth paths, file access patterns, or trust-boundary schema changes beyond the T-04-05 / T-04-06 register in the plan's `<threat_model>`. The animator consumes already-validated Pack (plan 04-01) and already-redacted tokens (plan 04-07 future), so no new trust boundary is crossed.

## Self-Check: PASSED

- FOUND: src/presence/animator.ts (281 lines)
- FOUND: test/presence.animator.test.ts (flipped from 17 it.todo stubs to 38 passing assertions)
- FOUND: scripts/check-api-surface.mjs (animator.ts in PURE_CORE_PATHS — seeded by 04-00, verified not re-applied)
- FOUND commit 79c85f2 (Task 1 RED: failing animator tests — import non-existent module)
- FOUND commit f723949 (Task 1+2 GREEN: animator impl + test fixups)
- Verified: `git log --oneline -3` shows both hashes
- Verified: `pnpm vitest run test/presence.animator.test.ts` → 38 passed, 0 todo
- Verified: `pnpm test` (full suite) → 242 passed / 13 todo across 19 files
- Verified: `pnpm typecheck` → PASS
- Verified: `pnpm check:api-surface` → PASS (10 pure-core files — animator.ts counted)
- Verified: `pnpm build` → PASS
- Verified: `pnpm check:bundle-size` → PASS (207.5 KB / 41.5% of 500 KB)
- Verified: `grep -c "src/presence/animator.ts" scripts/check-api-surface.mjs` = 1
