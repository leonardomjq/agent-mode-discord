---
phase: 03-agent-detection
plan: "05"
subsystem: detectors

tags: [regex, pure-core, ansi-strip, custom-patterns, agent-matching, wave-1]

# Dependency graph
requires:
  - phase: 03-agent-detection
    provides: plan 03-00 scaffolding — `test/detectors.regex.test.ts` it.todo stubs, `LOW_CONFIDENCE_FIXTURES` 19-entry table, PURE_CORE guard for `src/detectors/regex.ts`
provides:
  - BUILT_IN_PATTERNS for 5 v0.1 agents (claude/aider/codex/gemini/opencode) with first-word anchoring + hyphen-safe terminator
  - stripAndNormalize: ANSI CSI + OSC strip + prompt-prefix strip + space collapse (DET-09 pipeline, exported for shellIntegration.ts reuse)
  - normalizeCommandLine({ value, confidence }): Low → strip, Medium/High → trim-only
  - matchAgentCommand: internal prePeel for sudo/doas + zero-or-more KEY=value env assignments
  - buildMatcher: user customPatterns auto-anchored with ^ + invalid regex silent-drop (DET-10, D-18)
  - 53 passing assertions replacing 15 it.todo entries
affects: [03-01, 03-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-core regex module with bare `number` confidence parameter — keeps vscode-import boundary even while accepting a vscode-shaped value via duck typing"
    - "Hyphen-safe terminator `(?![-\\w])` instead of `\\b` to reject hyphenated-binary false positives (claude-next, claude-history)"
    - "Dual-stage ANSI stripping: OSC sequences (\\x1B]...BEL) stripped before CSI so PowerShell shell-integration markers are absorbed"
    - "Internal prePeel helper inside matchAgentCommand (not in normalizeCommandLine) — env/sudo are valid command syntax, not display noise"

key-files:
  created:
    - src/detectors/regex.ts
  modified:
    - test/detectors.regex.test.ts

key-decisions:
  - "Replaced `\\b` with `(?![-\\w])` terminator on built-in patterns — `\\b` considered `-` a word boundary, so `^claude\\b` matched `claude-next` before the custom pattern could fire. Strict hyphen-rejection matches CONTEXT intent (`./claude-history.sh` must NOT match)."
  - "Broadened PROMPT_PREFIX_RE with three alternations — bracketed `[user@host ~]$`, greedy POSIX-terminator `user@host:~/proj$`, and `>` terminator for fish/PowerShell. Single-line prompts only; multi-line prompt history is out of scope for Low-confidence commandLine.value."
  - "Added ANSI_OSC_RE as a separate strip pass before CSI. OSC 133;A shell-integration markers on PowerShell terminate with BEL or `\\x1B\\`; the existing CSI regex wouldn't absorb them."
  - "Kept prePeel (sudo/doas + env assignments) INSIDE matchAgentCommand rather than in normalizeCommandLine. Rationale: env/sudo are semantically part of the command, not prompt noise — a consumer wanting the raw normalized form shouldn't have those stripped silently."

patterns-established:
  - "Pure-core regex boundary compatible with vscode-shaped input via structural typing — no vscode types leak across module edge"
  - "Silent-drop (D-18) for user regex — invalid sources are filtered at buildMatcher time; runtime match never throws"
  - "Deterministic iteration order — BUILT_IN_PATTERNS declaration order then insertion-ordered custom matchers (Object.entries preserves both)"

requirements-completed: [DET-02, DET-03, DET-09, DET-10]

# Metrics
duration: ~15 min
completed: 2026-04-14
---

# Phase 03 Plan 05: Pure-Core Regex Agent Matcher Summary

**Pure-core regex module matching 5 v0.1 agents (+python -m aider variant) with ANSI/OSC strip + prompt-prefix strip + customPatterns extension slot; 53 tests flipped from 15 it.todo entries; check:api-surface confirms zero vscode imports.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-14T22:48:00Z
- **Completed:** 2026-04-14T23:02:00Z
- **Tasks:** 2
- **Files created:** 1 (`src/detectors/regex.ts`, 179 lines — under D-17 200-line cap)
- **Files modified:** 1 (`test/detectors.regex.test.ts` — flipped stubs, 248 lines)

## Accomplishments

- `src/detectors/regex.ts` authored: BUILT_IN_PATTERNS for claude/aider/codex/gemini/opencode, stripAndNormalize, normalizeCommandLine (confidence-gated), matchAgentCommand (internal prePeel), buildMatcher (auto-anchor + silent invalid-regex drop)
- 53 passing assertions covering DET-02/03/09/10: all 15 `it.todo` entries from plan 03-00 now flipped, plus 6 bonus assertions for env/sudo peel, invalid-regex behavior, and built-in pattern shape invariants
- Table test over all 19 entries in `LOW_CONFIDENCE_FIXTURES` — verifies strip pipeline and agent-match resolution in one parameterized loop
- `pnpm typecheck` PASS, `pnpm test` PASS (95 pass + 29 todo from plans 03-01..03-04), `pnpm check:api-surface` PASS (6 pure-core files now scanned, regex.ts included), `pnpm build` PASS (201.0 KB / 40.2% of 500 KB threshold)
- No vscode runtime import in `src/detectors/regex.ts` — pure-core boundary enforced by PURE_CORE_PATHS

## Task Commits

1. **Task 1 (feat): Implement pure-core regex agent matcher** — `f15592c`
2. **Task 2 (test): Flip regex it.todo to 53 passing assertions (+ bug fixes in regex.ts)** — `5747ff0`

## Files Created/Modified

- `src/detectors/regex.ts` — new pure-core module (179 lines)
  - `BUILT_IN_PATTERNS: Record<BuiltInAgent, RegExp[]>` — 5 agents, 9 patterns total, all `^`-anchored with `(?![-\w])` terminator
  - `ANSI_CSI_RE` (exported), `ANSI_OSC_RE` (internal), `PROMPT_PREFIX_RE` (internal)
  - `stripAndNormalize(raw)` — 6-step pipeline; exported for shellIntegration reuse
  - `normalizeCommandLine({ value, confidence })` — confidence 0 → strip, 1|2 → trim-only
  - `matchAgentCommand(normalized, customMatchers?)` — runs internal `prePeel` (sudo/doas + env) then iterates built-ins, then custom
  - `buildMatcher(customPatterns?)` — auto-prefixes `^`, try/catch silent-drop on invalid regex, returns closure over captured matchers
- `test/detectors.regex.test.ts` — modified (248 lines)
  - 15 describe blocks: BUILT_IN_PATTERNS shape, per-agent matchers (claude/aider/codex/gemini/opencode), admin subcommands, negative cases, env/sudo peel, confidence gating, LOW_CONFIDENCE_FIXTURES table test, buildMatcher (custom patterns, auto-anchor, silent-drop, mixed valid/invalid)

## Decisions Made

- **Terminator `(?![-\w])` over `\b` for built-in patterns** — `\b` treats `-` as a boundary, so `^claude\b` matched `claude-next`. The stricter terminator rejects all hyphenated followups, matching CONTEXT's "claude-history.sh must NOT match" rule AND letting `buildMatcher({ "claude-next": [...] })` work as documented in the plan's `<behavior>` block.
- **Two-stage ANSI stripping (OSC then CSI)** — PowerShell's OSC 133 shell-integration marker (`\x1B]133;A\x07`) doesn't match the CSI regex (`\x1B[`) but would otherwise leak through to the prompt-prefix step and break normalization. Adding a separate OSC pass costs 1 line and covers all supported shells.
- **Broadened PROMPT_PREFIX_RE to three alternations**:
  1. `^(?:\[[^\]\n]*\]|[^\s]*)[$%❯→▶]\s+` — bracketed OR single-word prefix + POSIX terminator
  2. `^[^>\n]*>\s+` — fish / PowerShell `>` terminator (greedy up to last `>`)
  3. (implicit) no-match → no strip

  Trade-off: the greedy `>` could over-strip in pathological cases (`echo hello > file`), but that's never a prompt-prefixed Low-confidence line — it's a command being echoed in a terminal, which VS Code would send at High confidence.
- **prePeel lives in matchAgentCommand, not normalizeCommandLine** — sudo/env are valid command syntax; consumers of `normalizeCommandLine` (telemetry, logging) may want to see them preserved. Only the matcher needs to peel them for pattern comparison.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Built-in patterns used `\b` which matched hyphenated followups**
- **Found during:** Task 2 (running flipped tests)
- **Issue:** Plan's `<interfaces>` block locked `BUILT_IN_PATTERNS` as `/^claude\b/` etc. But `\b` is a zero-width assertion between a word char and a non-word char — and `-` is a non-word char. So `^claude\b` matched `claude-next` (boundary between `e` and `-`), which broke DET-10's custom-pattern extension point (user's `claude-next` matched as `claude` before the custom matcher could fire). Also conflicts with CONTEXT's strictness rule that `./claude-history.sh` must NOT match (the `./` prefix masked this originally, but `claude-history` bare would also have false-matched).
- **Fix:** Replaced `\b` with `(?![-\w])` on all 9 built-in patterns. The negative lookahead rejects both word chars AND hyphens as continuation.
- **Files modified:** `src/detectors/regex.ts` (BUILT_IN_PATTERNS block)
- **Verification:** `pnpm test test/detectors.regex.test.ts` — 53 pass (including the `./claude-history.sh` negative case AND the `claude-next chat` custom-pattern case)
- **Committed in:** `5747ff0`

**2. [Rule 1 — Bug] Missing OSC sequence stripping + overly narrow prompt-prefix regex**
- **Found during:** Task 2 (LOW_CONFIDENCE_FIXTURES table test failures on bash/fish/powershell rows)
- **Issue:** The plan's `<interfaces>` block locked `PROMPT_PREFIX_RE = /^(\[[^\]]*\]\s*)?[$%❯→▶]\s*|^PS\s+[A-Za-z]:\\[^>]*>\s*/` which didn't handle:
  - `user@host:~/proj$ claude` (colon-containing prompt body — `$` not at line start)
  - `user@host ~/proj> claude` (fish `>` terminator, not PowerShell-shaped)
  - `\x1B]133;A\x07PS C:\proj> claude` (OSC 133 shell-integration marker not a CSI, so not stripped)

  Three fixture rows failed the strip pipeline assertion; fixing this is DET-09 correctness.
- **Fix:**
  - Added `ANSI_OSC_RE = /\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g` as a separate strip pass BEFORE CSI strip
  - Broadened `PROMPT_PREFIX_RE` to `/^(?:\[[^\]\n]*\]|[^\s]*)[$%❯→▶]\s+|^[^>\n]*>\s+/` — bracketed OR single-word prefix + POSIX terminator, OR greedy `>`-terminator for fish/PowerShell
- **Files modified:** `src/detectors/regex.ts` (added ANSI_OSC_RE, rewrote PROMPT_PREFIX_RE, stripAndNormalize pipeline now has 6 steps instead of 5 due to OSC pass)
- **Verification:** All 19 LOW_CONFIDENCE_FIXTURES entries now normalize and resolve correctly (53 tests pass)
- **Committed in:** `5747ff0`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — correctness bugs that would have blocked DET-02/03/09/10 if shipped as-is)
**Impact on plan:** No scope creep. Module signature (`<interfaces>` exports) preserved; only internal regex bodies changed to fix correctness. Plan's `<behavior>` tests all pass.

## Issues Encountered

None beyond the two auto-fixed deviations above. No fix-attempt cycling; both bugs were diagnosed and resolved on first iteration after test-failure observation.

## User Setup Required

None — pure code change. Plans 03-01..03-04 will consume this module; their test stubs remain as todo.

## Next Phase Readiness

- **Plan 03-01 (shellIntegration.ts) unblocked** — can import `normalizeCommandLine`, `stripAndNormalize`, `matchAgentCommand`, and `ANSI_CSI_RE` from `src/detectors/regex.ts` without any vscode coupling concern.
- **Plan 03-04 (orchestrator) unblocked for customPatterns wiring** — `buildMatcher(config.detect.customPatterns)` returns the closure the orchestrator injects into shellIntegration / polling detectors.
- **All five guardrails green:** `pnpm test` (95 pass + 29 todo), `pnpm typecheck`, `pnpm check:api-surface` (6 pure-core files), `pnpm build` + `pnpm check:bundle-size` (40.2% of 500 KB).
- **No `import vscode`** in src/detectors/regex.ts — verified by check-api-surface and by grep confirming zero matches.

## Self-Check

- `src/detectors/regex.ts` — FOUND (179 lines; `new RegExp(...)` construction for BUILT_IN_PATTERNS so the hyphen-safe terminator is composed via template string)
- `test/detectors.regex.test.ts` — FOUND (248 lines; 53 tests; 0 it.todo remaining)
- Commit `f15592c` — FOUND (feat: regex agent matcher)
- Commit `5747ff0` — FOUND (test: flip todos + bug fixes)
- `grep 'import.*vscode' src/detectors/regex.ts` — 0 matches (pure-core verified)
- `pnpm check:api-surface` — PASS with 6 pure-core files
- `pnpm test` — 95 pass + 29 todo (plans 03-01..03-04 remain)
- `pnpm build` — 201.0 KB (40.2% of 500 KB)

## Self-Check: PASSED

---
*Phase: 03-agent-detection*
*Completed: 2026-04-14*
