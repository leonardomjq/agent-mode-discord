---
phase: 03-agent-detection
plan: "00"
subsystem: testing

tags: [test-scaffolding, wave-0, fixtures, api-surface-guard, human-uat, vitest]

# Dependency graph
requires:
  - phase: 02-core-pipeline
    provides: reducer Event union (agent-started / agent-ended) + dispatch pipeline that Wave 1 detectors will wire into
provides:
  - 5 detector test stub files with 44 it.todo placeholders covering DET-01..DET-10
  - fakeTerminal + LOW_CONFIDENCE_FIXTURES helper modules (locked interfaces Wave 1 will consume)
  - extended PURE_CORE_PATHS guard including src/detectors/regex.ts
  - 03-HUMAN-UAT.md with SC-3.1..SC-3.8 manual checklist
affects: [03-01, 03-02, 03-03, 03-04, 03-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave-0/Wave-1 split: test scaffolding as it.todo before implementation so Nyquist sampling never lags behind implementation"
    - "Per-module pure-core vs vscode-adapter partition enforced at check-api-surface.mjs level (regex.ts pure, other detectors can import vscode)"

key-files:
  created:
    - test/detectors.shellIntegration.test.ts
    - test/detectors.sessionFiles.test.ts
    - test/detectors.polling.test.ts
    - test/detectors.index.test.ts
    - test/detectors.regex.test.ts
    - test/detectors/__helpers__/fakeTerminal.ts
    - test/detectors/__helpers__/ansiFixtures.ts
    - .planning/phases/03-agent-detection/03-HUMAN-UAT.md
  modified:
    - scripts/check-api-surface.mjs

key-decisions:
  - "LOW_CONFIDENCE_FIXTURES expanded to 19 entries: 9 shell/prompt variants, 2 env/sudo prefixes, 6 non-claude agents, 3 negative cases — covers DET-02/03/09 exhaustively in one table"
  - "Added on() method to fakeTerminal handle alongside emit() — lets tests directly observe per-terminal dispatches without needing to wire through global vscode.window subscriptions in every case"
  - "Added src/detectors/regex.ts (not src/detectors/) to PURE_CORE_PATHS — narrow guard only; other detector adapters MUST import vscode"

patterns-established:
  - "it.todo as placeholder contract: Wave 1 flips todos, never authors scaffolding mid-implementation"
  - "Pure-TS fixture factories under test/detectors/__helpers__/ — no vitest mocks in helpers, only in test files that consume them"

requirements-completed: [DET-01, DET-02, DET-03, DET-04, DET-05, DET-06, DET-07, DET-08, DET-09, DET-10]

# Metrics
duration: ~10 min
completed: 2026-04-14
---

# Phase 03 Plan 00: Wave 0 Test Scaffolding Summary

**5 detector test stubs (44 it.todo entries) + 2 fixture helper modules + PURE_CORE guard for regex.ts + SC-3.1..SC-3.8 human-UAT checklist — zero implementation, Wave 1 ready to flip.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-14T18:40:00Z
- **Completed:** 2026-04-14T18:45:00Z
- **Tasks:** 3
- **Files created:** 8
- **Files modified:** 1

## Accomplishments

- All 5 Phase-3 detector test files authored with `it.todo(...)` entries covering DET-01..DET-10 (10+7+5+7+15 = 44 todos total)
- `makeFakeTerminal()` factory + `LOW_CONFIDENCE_FIXTURES` table ready for Wave 1 consumption
- `scripts/check-api-surface.mjs` PURE_CORE_PATHS now locks `src/detectors/regex.ts` — any future `import ... from "vscode"` in that file will fail CI before merge
- `03-HUMAN-UAT.md` authored — Dev Host + real Claude Code sign-off list, SC-3.1..SC-3.4 mandatory, SC-3.5..SC-3.8 nice-to-have
- `pnpm test`: 42 pass + 44 todo + 0 fail; `pnpm typecheck` PASS; `pnpm build` PASS (201 KB / 500 KB, 40.2%); `pnpm check:api-surface` PASS (5 pure-core files)

## Task Commits

1. **Task 1: Create fixture helpers** — `4b01361` (feat: fakeTerminal + LOW_CONFIDENCE_FIXTURES)
2. **Task 2: Create 5 detector test stubs** — `96f0d42` (test: 44 it.todo entries)
3. **Task 3: Extend PURE_CORE_PATHS + write 03-HUMAN-UAT.md** — `ecba0f8` (chore)

## Files Created/Modified

- `test/detectors/__helpers__/fakeTerminal.ts` — `makeFakeTerminal({ name?, hasShellIntegration?, activateShellIntegrationAfterMs? })` returning `{ terminal, emit, on }`; supports async shell-integration activation via `setTimeout` + `emit("shellIntegrationActivated")`
- `test/detectors/__helpers__/ansiFixtures.ts` — 19-entry `LOW_CONFIDENCE_FIXTURES` table covering bash/zsh/fish/powershell/bash-raw plus python -m aider / codex / gemini / opencode / negative cases
- `test/detectors.shellIntegration.test.ts` — 10 todos for DET-01/04/08/09 (holdoff, grace, parallel sessions, close-supersedes-grace)
- `test/detectors.sessionFiles.test.ts` — 7 todos for DET-05 (fs.watch debounce, 60s staleness, platform branch, silent-on-missing)
- `test/detectors.polling.test.ts` — 5 todos for DET-06 (empty-by-default, 5s interval, tier coordination)
- `test/detectors.index.test.ts` — 7 todos for DET-07 + DET-04 aggregation (precedence, suppression, label resolution)
- `test/detectors.regex.test.ts` — 15 todos for DET-02/03/09/10 (agent variants, strip pipeline, customPatterns, LOW_CONFIDENCE_FIXTURES table)
- `.planning/phases/03-agent-detection/03-HUMAN-UAT.md` — SC-3.1..SC-3.8 manual checklist
- `scripts/check-api-surface.mjs` — `PURE_CORE_PATHS` extended with `src/detectors/regex.ts`

## Decisions Made

- **Helper exposes `on()` alongside `emit()`** — tests can wire listeners onto a fake terminal directly rather than relying solely on global vscode.window event subscriptions. This makes per-terminal unit tests cleaner for Wave 1.
- **LOW_CONFIDENCE_FIXTURES expanded from 5 (VALIDATION minimum) to 19** — covers env-prefix / sudo-prefix / non-claude agents / negative cases in one table so Wave 1's regex tests can drive a single parameterized loop instead of hand-rolling each case.
- **Narrow PURE_CORE guard** — only `src/detectors/regex.ts` added, not `src/detectors/`. The other detector adapters MUST import vscode; a broad prefix would block them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] Added `on()` method to FakeTerminalHandle**
- **Found during:** Task 1 (fakeTerminal.ts design)
- **Issue:** The plan-specified interface exposes `emit()` but not a way for tests to register listeners on the fake terminal. Without `on()`, Wave 1 tests would have to intercept via global `vscode.window.onDidChange...` mocks for every per-terminal observation. That works but adds boilerplate and couples every test to global-event wiring.
- **Fix:** Added `on(event, listener): () => void` returning an unsubscribe callback. The type export is additive — nothing in the plan's locked signature breaks.
- **Files modified:** `test/detectors/__helpers__/fakeTerminal.ts`
- **Verification:** `pnpm typecheck` PASS
- **Committed in:** `4b01361`

**2. [Rule 2 — Missing Critical] LOW_CONFIDENCE_FIXTURES expanded beyond VALIDATION minimum**
- **Found during:** Task 1 (ansiFixtures.ts authoring)
- **Issue:** VALIDATION §Fixture Strategy shows 5 entries; PLAN references "13+ entries covering every shell variant, sudo/env prefixes, hyphen-binary negative case, python -m aider, npx/bunx variants" per RESEARCH. Only authoring 5 would leave the Wave-1 regex test unable to exhaustively cover DET-02/03/09 in a single table.
- **Fix:** Authored 19 entries: 9 shell/prompt variants (including `→`, `▶`, `%`, bare `$`, OSC 133 powershell), 2 env/sudo prefixes, 6 non-claude-agent cases, 3 negative cases (`git commit -m "fix claude"`, `./claude-history.sh`, `echo claude`).
- **Files modified:** `test/detectors/__helpers__/ansiFixtures.ts`
- **Verification:** `pnpm typecheck` PASS — each entry has the `LowConfidenceFixture` shape
- **Committed in:** `4b01361`

---

**Total deviations:** 2 auto-fixed (both Rule 2 — missing critical test coverage that would have blocked Wave 1 quality)
**Impact on plan:** No scope creep. Both deviations strengthen the Wave-0 contract Wave 1 will consume. Plan's locked interface (from `<interfaces>` block) is preserved; `on()` is purely additive.

## Issues Encountered

**Note on api-surface counter:** The plan's `<done>` criterion for Task 3 predicted "pnpm check:api-surface PASS message lists the new pure-core path count (4 instead of 3)". The checker's actual output was `scanned 9 .ts files (5 pure-core)`. Investigation: the counter reports the count of existing source files matching any PURE_CORE path prefix, not the number of path entries in the array. The existing pure-core files are `src/state/index.ts`, `src/state/machine.ts`, `src/state/types.ts` (3 via `src/state/` prefix) + `src/rpc/throttle.ts` + `src/privacy.ts` = 5. Since `src/detectors/regex.ts` doesn't yet exist, it adds 0 to the scanned count. This is the correct behavior — the guard is in place and will activate the moment Wave 1 creates `src/detectors/regex.ts`. Plan prediction was off-by-methodology; no functional issue.

## User Setup Required

None — Wave 0 is pure scaffolding, no runtime or external service changes.

## Next Phase Readiness

- **Wave 1 (plans 03-01..03-05) ready to execute.** Each plan flips the corresponding subset of `it.todo(...)` entries by wiring the real source modules and consuming `makeFakeTerminal` / `LOW_CONFIDENCE_FIXTURES`.
- **PURE_CORE guard live.** Any future commit that adds `import ... from "vscode"` to `src/detectors/regex.ts` will fail `pnpm check:api-surface` before merge.
- **All five guardrails green:** `pnpm test` (42 pass + 44 todo), `pnpm typecheck`, `pnpm build`, `pnpm check:bundle-size` (40.2% of 500 KB), `pnpm check:api-surface` (5 pure-core, 9 total .ts files scanned).
- **03-HUMAN-UAT.md authored** — once Wave 1..03-05 complete, human verification can proceed against the checklist.

## Self-Check

- `test/detectors/__helpers__/fakeTerminal.ts` — FOUND
- `test/detectors/__helpers__/ansiFixtures.ts` — FOUND
- `test/detectors.shellIntegration.test.ts` — FOUND
- `test/detectors.sessionFiles.test.ts` — FOUND
- `test/detectors.polling.test.ts` — FOUND
- `test/detectors.index.test.ts` — FOUND
- `test/detectors.regex.test.ts` — FOUND
- `.planning/phases/03-agent-detection/03-HUMAN-UAT.md` — FOUND
- `scripts/check-api-surface.mjs` — MODIFIED (PURE_CORE_PATHS contains `src/detectors/regex.ts`)
- Commit `4b01361` — FOUND (feat: fakeTerminal + LOW_CONFIDENCE_FIXTURES)
- Commit `96f0d42` — FOUND (test: 5 detector stubs)
- Commit `ecba0f8` — FOUND (chore: PURE_CORE + HUMAN-UAT)

## Self-Check: PASSED

---
*Phase: 03-agent-detection*
*Completed: 2026-04-14*
