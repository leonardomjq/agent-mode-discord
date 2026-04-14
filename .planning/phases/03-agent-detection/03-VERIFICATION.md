---
phase: 03-agent-detection
verified: 2026-04-14T19:30:00Z
status: human_needed
score: 5/5 must-haves verified (automated); SC-3.1..SC-3.8 human UAT outstanding
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "SC-3.1 — Run `claude` in Dev Host integrated terminal (zsh/macOS)"
    expected: "Discord profile flips to AGENT_ACTIVE within 500 ms; agent=claude"
    why_human: "Requires running unpacked extension in Dev Host + real Claude Code install + real Discord; cannot verify in vitest"
  - test: "SC-3.2 — Multi-prompt session stability"
    expected: "Discord stays AGENT_ACTIVE across 3-5 prompts — no flicker to CODING during tool calls"
    why_human: "Requires live Claude Code REPL + visual inspection of Discord profile"
  - test: "SC-3.3 — 30 s grace period on Ctrl+C"
    expected: "Discord HOLDS AGENT_ACTIVE for 30 s after Ctrl+C, then downgrades"
    why_human: "Real-time behavior with real Discord profile observation"
  - test: "SC-3.4 — Close-terminal supersedes grace"
    expected: "Immediate AGENT_ACTIVE → CODING/IDLE on terminal tab close (no 30 s grace)"
    why_human: "Requires Dev Host terminal close event with live Discord"
  - test: "SC-3.5 — Two parallel `claude` sessions (DET-04)"
    expected: "Both tracked; ending one keeps AGENT_ACTIVE; ending second triggers grace"
    why_human: "Live two-terminal scenario — unit tests cover mapping, but end-to-end behavior requires Dev Host"
  - test: "SC-3.6 — JSONL fs-watch fallback (DET-05)"
    expected: "With shell integration disabled, `claude` still flips AGENT_ACTIVE within ~5 s via JSONL mtime tier"
    why_human: "Requires disabling shell integration in real shell + real Claude Code writing to ~/.claude/projects"
  - test: "SC-3.7 — Linux polling-stat fallback (best-effort)"
    expected: "Linux Dev Host picks up session via 5 s poll loop"
    why_human: "Platform-specific; requires Linux Dev Host"
  - test: "SC-3.8 — aider detection (DET-03)"
    expected: "Running `python -m aider` flips Discord to AGENT_ACTIVE with agent=aider"
    why_human: "Requires aider install + Dev Host; unit tests verify regex match but end-to-end is manual"
review_findings_advisory:
  - id: WR-01
    file: src/detectors/sessionFiles.ts:131-134
    issue: "Future-mtime (clock skew / touch -t) never expires — negative age always < thresholdMs"
    severity: warning
    blocking: false
  - id: WR-02 (implied)
    file: src/detectors/sessionFiles.ts:213
    issue: "dirPollTimer uses global setInterval rather than opts.setInterval injection — minor test-seam gap"
    severity: warning
    blocking: false
---

# Phase 3: Agent Detection Verification Report

**Phase Goal (ROADMAP.md):** Upgrade CODING to AGENT_ACTIVE via tiered detectors. Shell Integration tier with ANSI strip + async-activation race mitigation, session-file fs-watch tier (mtime only), polling tier, orchestrator with deterministic precedence.
**Verified:** 2026-04-14T19:30:00Z
**Status:** human_needed — all 5 automated Success Criteria verified; SC-3.1..SC-3.8 manual UAT remains (intentionally out of automated scope per PLAN).
**Re-verification:** No — initial verification.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Running `claude` in dev-host terminal flips presence to AGENT_ACTIVE within 500 ms; `npx/bunx/pnpm dlx @anthropic-ai/claude-code` produce same result | VERIFIED (automated) + needs human | `BUILT_IN_PATTERNS.claude` in `src/detectors/regex.ts:35` includes `^claude` + `^(npx|bunx|pnpm dlx) @anthropic-ai/claude-code`; shellIntegration dispatches synchronously in `onDidStartTerminalShellExecution` handler (tier 2); 156/156 tests pass. End-to-end timing requires human SC-3.1 |
| 2 | Running `aider` / `codex` / `npx @openai/codex` / `gemini` / `opencode` flips to AGENT_ACTIVE with correct label | VERIFIED | `BUILT_IN_PATTERNS` covers all 5 agents including `python3?\s+-m\s+aider`, `(npx\|bunx) @openai/codex`, gemini, opencode. 53 regex tests pass; `test/detectors.regex.test.ts` asserts each agent variant |
| 3 | Two parallel `claude` sessions in two terminals hold AGENT_ACTIVE until both end (per-terminal session map, vitest-verified) | VERIFIED | `src/detectors/shellIntegration.ts` uses `Map<vscode.Terminal, TerminalSession>`; test "two parallel claude sessions in two terminals each tracked independently (DET-04)" passes (shellIntegration.test.ts); orchestrator tier-aggregation test in `detectors.index.test.ts` confirms cross-tier DET-04 |
| 4 | Disabling Shell Integration and running `claude` still flips AGENT_ACTIVE via `~/.claude/projects/*.jsonl` fs-watch tier (mtime + existence only — no JSONL parsing) | VERIFIED (automated) + needs human | `src/detectors/sessionFiles.ts` implements `fs.watch({ recursive: true })` on macOS/Windows + 5 s polling on Linux; `grep readFileSync.*jsonl` returns 0 matches (PRD §FR-1.8); 11 sessionFiles tests pass. End-to-end disabled-SI scenario requires human SC-3.6/3.7 |
| 5 | Regex tests against Low-confidence `commandLine.value` fixtures produce zero false negatives; `detect.customPatterns` extends detection and flows to `{agent}` templating | VERIFIED | `LOW_CONFIDENCE_FIXTURES` table (19 entries) drives table test in `detectors.regex.test.ts` — all pass; `buildMatcher({customPatterns})` with auto-anchor + silent-drop verified; invalid regex silently dropped (D-18) |

**Score:** 5/5 truths verified via automated tests; end-to-end behavioral validation deferred to HUMAN-UAT.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/detectors/regex.ts` | Pure-core BUILT_IN_PATTERNS + normalizeCommandLine + buildMatcher | VERIFIED | 199 lines; zero vscode imports (grep confirms); exports BUILT_IN_PATTERNS, ANSI_CSI_RE, stripAndNormalize, normalizeCommandLine, matchAgentCommand, buildMatcher |
| `src/detectors/shellIntegration.ts` | Tier-2 detector with 4 global subscriptions + per-terminal Map + 2 s holdoff + 30 s grace | VERIFIED | 262 lines; 6 hits on onDidStart/End/Change/CloseTerminal subscriptions; imports `normalizeCommandLine, buildMatcher` from `./regex` |
| `src/detectors/sessionFiles.ts` | Tier-3 detector; fs.watch recursive on mac/Win + Linux poll + 100 ms debounce + staleness clamp | VERIFIED | 255 lines; `fs.watch(projectsDir, { recursive: true }, onWatchEvent)` on line 177; Linux poll at line 174; 0 matches for `readFileSync.*jsonl` |
| `src/detectors/polling.ts` | Tier-4 detector; empty-by-default short-circuit; 5 s interval | VERIFIED | 136 lines; short-circuit verified in tests (no setInterval when patterns empty) |
| `src/detectors/index.ts` | Orchestrator composing tier-2/3/4 detectors; highest-tier-wins aggregation | VERIFIED | 157 lines; imports all 3 child factories; per-tier Map with deterministic precedence |
| `src/extension.ts` | Phase 2 placeholder replaced with createDetectorsOrchestrator(dispatch) | VERIFIED | Import at line 17; construction at line 108; dispose at line 118 (+3 lines total) |
| `test/detectors.*.test.ts` (5 files) | All it.todo flipped to passing | VERIFIED | 156/156 tests pass; 0 it.todo remaining in phase-3 detector tests; 1 `it.todo` match in polling test is just the comment/import line (not an actual todo) |
| `test/detectors/__helpers__/*` (2 files) | fakeTerminal + LOW_CONFIDENCE_FIXTURES (19 entries) | VERIFIED | Both files exist; LOW_CONFIDENCE_FIXTURES used in regex + shellIntegration table tests |
| `scripts/check-api-surface.mjs` | PURE_CORE_PATHS includes src/detectors/regex.ts | VERIFIED | check:api-surface reports "6 pure-core files"; passing |
| `.planning/phases/03-agent-detection/03-HUMAN-UAT.md` | SC-3.1..SC-3.8 checklist | VERIFIED | All 8 items present |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `src/extension.ts` | `src/detectors/index.ts` | `import { createDetectorsOrchestrator }` | WIRED | Line 17 import, line 108 call, line 118 dispose |
| `src/detectors/index.ts` | `src/detectors/shellIntegration.ts` | `createShellIntegrationDetector` factory | WIRED | Imported + instantiated with tier-dispatch wrapper |
| `src/detectors/index.ts` | `src/detectors/sessionFiles.ts` | `createSessionFilesDetector` factory | WIRED | Same pattern |
| `src/detectors/index.ts` | `src/detectors/polling.ts` | `createPollingDetector` factory | WIRED | Same pattern |
| `src/detectors/shellIntegration.ts` | `src/detectors/regex.ts` | `import { buildMatcher, normalizeCommandLine }` | WIRED | Pure helper reused; no duplicated ANSI strip (grep for `u001B` returns 0 in shellIntegration) |
| shell-integration detector | `vscode.window.onDidChangeTerminalShellIntegration` | Global subscription (DET-08) | WIRED | 6 hits across Start/End/Change/Close events |
| sessionFiles detector | `node:fs` fs.watch + statSync | recursive watch + mtime | WIRED | fs.watch called with `{ recursive: true }` on mac/Win; Linux polling branch |
| polling detector | `vscode.window.terminals` | Injected `getTerminals()` default | WIRED | 5 s setInterval when patterns non-empty; zero-allocation short-circuit for empty |

### Data-Flow Trace (Level 4)

End-to-end data flow (per 03-04-SUMMARY): `claude` terminal command → `onDidStartTerminalShellExecution` fires → shellIntegration captures commandLine via `normalizeCommandLine` (from regex.ts) → `buildMatcher` matches `^claude(?![-\w])` → tier-2 dispatch → orchestrator `recomputeAndDispatch` picks highest-tier-active → parent dispatch `{ type: "agent-started", agent: "claude" }` → Phase 2 reducer transitions to AGENT_ACTIVE → throttle → RPC setActivity.

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `shellIntegration.ts` | sessions Map | `vscode.window.onDidStartTerminalShellExecution` event payload | Yes — real VS Code API | FLOWING |
| `sessionFiles.ts` | activeFiles set | `fs.statSync().mtimeMs` on `~/.claude/projects/**/*.jsonl` | Yes — real filesystem | FLOWING |
| `index.ts` | tierStates Map | Child detector dispatches | Yes — composition of 3 real detectors | FLOWING |
| `extension.ts` | Event dispatch | orchestrator → reducer → throttle → RPC | Yes — wired to Phase 2 pipeline | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite green | `pnpm test` | 12 files, 156 passed, 0 failed | PASS |
| TypeScript compiles | `pnpm typecheck` | Exit 0 | PASS |
| API surface guard | `pnpm check:api-surface` | PASS — 6 pure-core files, no violations | PASS |
| Build produces bundle | `pnpm build` | `dist/extension.cjs` 212447 bytes | PASS |
| Bundle size under cap | `pnpm check:bundle-size` | 41.5% of 500 KB | PASS |
| regex.ts pure-core (no vscode imports) | `grep import.*vscode src/detectors/regex.ts` | 0 matches | PASS |
| sessionFiles does not read JSONL content | `grep readFileSync.*jsonl src/detectors/sessionFiles.ts` | 0 matches (PRD §FR-1.8) | PASS |
| Orchestrator wired in extension.ts | `grep createDetectorsOrchestrator src/extension.ts` | 3 matches (import + construct + dispose) | PASS |
| No stale it.todo in phase-3 tests | full suite reports `156 passed (156)` with no `todo` count | PASS | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| DET-01 | 03-00, 03-01, 03-04 | `claude` in terminal → AGENT_ACTIVE within 500 ms | SATISFIED (auto) + needs human SC-3.1 | Synchronous dispatch on `onDidStartTerminalShellExecution`; shellIntegration tests assert <500 ms |
| DET-02 | 03-00, 03-05 | npx/bunx/pnpm dlx @anthropic-ai/claude-code detected as `claude` | SATISFIED | BUILT_IN_PATTERNS.claude includes the full tuple; regex tests cover all 3 |
| DET-03 | 03-00, 03-05 | aider / codex / gemini / opencode detected | SATISFIED | BUILT_IN_PATTERNS has all 4 (+python -m aider); regex tests assert each |
| DET-04 | 03-00, 03-01, 03-04 | Two parallel claude sessions per-terminal | SATISFIED (unit) + needs human SC-3.5 | Per-terminal Map in shellIntegration; orchestrator cross-tier aggregation test |
| DET-05 | 03-00, 03-02, 03-04 | JSONL fs-watch fallback when shell integration unavailable | SATISFIED (auto) + needs human SC-3.6/3.7 | sessionFiles.ts with platform-branched watch/poll; mtime-only; no JSONL read |
| DET-06 | 03-00, 03-03, 03-04 | Polling tier empty-by-default zero-false-positive | SATISFIED | Empty-patterns short-circuit test proves no setInterval registered |
| DET-07 | 03-00, 03-04 | Deterministic tier precedence | SATISFIED | Orchestrator linear scan [2,3,4] break-on-first-active; tests assert highest-tier wins |
| DET-08 | 03-00, 03-01, 03-04 | onDidChangeTerminalShellIntegration subscription + 2 s holdoff | SATISFIED | Global subscription asserted; 2 s holdoff test with cancellation |
| DET-09 | 03-00, 03-01, 03-05 | Low-confidence ANSI + prompt strip | SATISFIED | normalizeCommandLine gated on confidence === 0; LOW_CONFIDENCE_FIXTURES table drives 19 scenarios |
| DET-10 | 03-00, 03-04, 03-05 | detect.customPatterns extension + {agent} flow-through | SATISFIED (pattern layer) | buildMatcher auto-anchors + silently drops invalid; custom agent labels flow. NOTE: live reload from VS Code config is deferred to Phase 4 per plan 03-04 `<behavior>` ("Phase 4 wires detect.customPatterns") — not in Phase 3 scope |

**No orphaned requirements.** All 10 DET-IDs claimed in ROADMAP.md for Phase 3 are addressed by one or more plans. REQUIREMENTS.md marks all 10 as [x] complete.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/detectors/sessionFiles.ts` | 131-134 | Future-mtime (negative `nowMs - mtimeMs`) classified fresh forever | Warning (advisory) | Clock skew / NFS / restored backup could produce sticky AGENT_ACTIVE. Flagged in 03-REVIEW WR-01; user scope decision: non-blocking for Phase 3 |
| `src/detectors/sessionFiles.ts` | 213 | `dirPollTimer = setInterval(...)` uses global setInterval, not opts-injected | Warning (advisory) | Test seam gap; doesn't affect runtime correctness. Flagged in 03-REVIEW; non-blocking |

Neither advisory warning blocks goal achievement. The orchestrator + shellIntegration tier are the primary DET-01 path; sessionFiles is a fallback.

### Human Verification Required

See `human_verification` in frontmatter. The 8-item HUMAN-UAT checklist (SC-3.1..SC-3.8) in `.planning/phases/03-agent-detection/03-HUMAN-UAT.md` is the sign-off gate for Phase 3 — unit tests cannot observe real Discord RPC flips or 30 s grace timing end-to-end.

Mandatory items: SC-3.1, SC-3.2, SC-3.3, SC-3.4.
Nice-to-have: SC-3.5..SC-3.8.

### Gaps Summary

**No automated gaps.** The Phase-3 goal (ship end-to-end agent-detection pipeline replacing Phase-2 placeholder) is achieved in code:

- All 5 ROADMAP Success Criteria have substantiating implementation + passing tests.
- All 10 DET requirement IDs have artifacts + tests.
- The orchestrator is wired into `src/extension.ts` replacing the Phase-2 placeholder.
- All 156 tests pass; typecheck/api-surface/build/bundle-size all green.
- Pure-core boundary enforced mechanically for `src/detectors/regex.ts`.
- PRD §FR-1.8 (no JSONL content reads) structurally enforced.

**Advisory items (non-blocking, from 03-REVIEW):**
1. `sessionFiles.ts` future-mtime clamp (WR-01) — consider fixing in a follow-up hardening pass or Phase 4 config work.
2. `sessionFiles.ts` `dirPollTimer` uses global `setInterval` (WR-02) — minor test-seam gap.

**Outstanding human verification:** SC-3.1..SC-3.8 end-to-end UAT in a real Dev Host + real Discord + real Claude Code. This was intentionally scoped out of automated verification per the phase plan and is normal for Phase 3 sign-off.

---

_Verified: 2026-04-14T19:30:00Z_
_Verifier: Claude (gsd-verifier)_
