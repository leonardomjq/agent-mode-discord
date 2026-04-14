---
phase: 03
slug: agent-detection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from 03-RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.x |
| **Config file** | `vitest.config.ts` (existing from Phase 1) |
| **Quick run command** | `pnpm test <path/to/test>` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~1 second (current: 0.6 s for 42 tests) |

---

## Sampling Rate

- **After every task commit:** Run the targeted test file for the task
- **After every plan wave:** Run `pnpm test` full suite
- **Before `/gsd-verify-work`:** Full suite must be green + `pnpm typecheck` + `pnpm check:api-surface` + `pnpm build` + `pnpm check:bundle-size` all exit 0
- **Max feedback latency:** 2 seconds

---

## Per-Requirement Verification Map

| Requirement | Plan | Test Type | Test File | Notes |
|-------------|------|-----------|-----------|-------|
| DET-01 (claude in terminal → AGENT_ACTIVE within 500 ms) | 03-01, 03-04 | unit + HUMAN-UAT | `test/detectors.shellIntegration.test.ts`, `test/detectors.index.test.ts` | Unit verifies dispatch within fake-timer tick; HUMAN-UAT verifies real ≤500 ms |
| DET-02 (npx/bunx/pnpm dlx variants) | 03-05 | unit | `test/detectors.regex.test.ts` | Table test: each variant → expected agent name |
| DET-03 (5 CLIs including python -m aider) | 03-05 | unit | `test/detectors.regex.test.ts` | Table test covering all supported invocation forms |
| DET-04 (2 parallel claude sessions hold AGENT_ACTIVE until both end) | 03-01, 03-04 | unit | `test/detectors.shellIntegration.test.ts`, `test/detectors.index.test.ts` | Per-terminal session map behavior; aggregation rule |
| DET-05 (Shell Integration unavailable → JSONL fs-watch fallback) | 03-02, 03-04 | unit | `test/detectors.sessionFiles.test.ts` | Mock fs.watch events; verify 60s staleness threshold |
| DET-06 (polling tier, 5s interval, empty-by-default) | 03-03 | unit | `test/detectors.polling.test.ts` | Fake timers; no false positives with default config |
| DET-07 (deterministic precedence, lower tiers log debug only) | 03-04 | unit | `test/detectors.index.test.ts` | Multi-tier concurrent signals; assert tier 1 wins |
| DET-08 (onDidChangeTerminalShellIntegration subscription for async activation) | 03-01 | unit | `test/detectors.shellIntegration.test.ts` | Fake terminal that fires integration after 1500 ms |
| DET-09 (ANSI + prompt-prefix strip on commandLine.confidence: Low) | 03-01, 03-05 | unit | `test/detectors.shellIntegration.test.ts`, `test/detectors.regex.test.ts` | Fixture set of ANSI-wrapped commands per shell |
| DET-10 (customPatterns extends built-ins, auto-anchored) | 03-05 | unit | `test/detectors.regex.test.ts` | User pattern `claude-next` auto-prefixed with `^` |

---

## Fixture Strategy

### Fake `vscode.Terminal` + `TerminalShellIntegration`

Minimal shape (lives in `test/detectors/__helpers__/fakeTerminal.ts`):
```ts
export function makeFakeTerminal(opts?: {
  name?: string;
  hasShellIntegration?: boolean;
  activateShellIntegrationAfterMs?: number;
}): { terminal: vscode.Terminal; emit: (event: string, payload: unknown) => void }
```

- `emit('shellIntegrationActivated')` — fires the `onDidChangeTerminalShellIntegration` observer
- `emit('executionStart', { commandLine: { value, confidence } })` — fires `onDidStartTerminalShellExecution`
- `emit('executionEnd', { exitCode })` — fires `onDidEndTerminalShellExecution`
- `emit('close')` — fires `onDidCloseTerminal`

### ANSI `commandLine.confidence: Low` fixtures

```ts
// test/detectors/__helpers__/ansiFixtures.ts
export const LOW_CONFIDENCE_FIXTURES = [
  { shell: "bash",       raw: "\x1b[32muser@host\x1b[0m:\x1b[34m~/proj\x1b[0m$ claude", expected: "claude" },
  { shell: "zsh",        raw: "\x1b[1m❯\x1b[0m claude --print 'hi'", expected: "claude --print 'hi'" },
  { shell: "fish",       raw: "user@host ~/proj> claude", expected: "claude" },
  { shell: "powershell", raw: "\x1b]133;A\x07PS C:\\proj> claude", expected: "claude" },
  { shell: "bash-raw",   raw: "[user@host ~]$ npx @anthropic-ai/claude-code", expected: "npx @anthropic-ai/claude-code" },
];
```

### fs.watch simulation

Use `vitest`'s `vi.mock('node:fs', ...)` to intercept `fs.watch` and expose a controllable event emitter:
```ts
const { triggerFsEvent } = mockFsWatch();
triggerFsEvent('change', '~/.claude/projects/proj-a/uuid.jsonl');
```

Assert dispatch was called with `agent-started` event within debounce window (100 ms).

---

## Wave 0 Requirements

- [ ] `test/detectors.shellIntegration.test.ts` — stubs for DET-01, DET-04, DET-08, DET-09
- [ ] `test/detectors.sessionFiles.test.ts` — stubs for DET-05
- [ ] `test/detectors.polling.test.ts` — stubs for DET-06
- [ ] `test/detectors.index.test.ts` — stubs for DET-07 (precedence orchestrator)
- [ ] `test/detectors.regex.test.ts` — stubs for DET-02, DET-03, DET-09, DET-10
- [ ] `test/detectors/__helpers__/fakeTerminal.ts` — fake vscode.Terminal + shellIntegration factory
- [ ] `test/detectors/__helpers__/ansiFixtures.ts` — LOW_CONFIDENCE_FIXTURES array
- [ ] Extend `scripts/check-api-surface.mjs` PURE_CORE denylist with `src/detectors/index.ts` regex module → but NOT the detectors themselves (they MUST import vscode).
      Actually: the regex module (`src/detectors/regex.ts`) goes in pure-core (no vscode imports). Other detector files are vscode-dependent.

---

## Human UAT Items (Deferred to 03-HUMAN-UAT.md)

Manual verification items requiring real Cursor + real Claude Code session:

- [ ] **SC-3.1** — Launch Dev Host, open integrated terminal, run `claude`. Verify Discord flips to AGENT_ACTIVE within 500 ms (wall-clock measurement via Discord profile timer).
- [ ] **SC-3.2** — While `claude` REPL is active, verify Discord stays AGENT_ACTIVE across multiple user prompts (no flicker to CODING during tool calls / responses).
- [ ] **SC-3.3** — Ctrl+C `claude` REPL. Verify Discord holds AGENT_ACTIVE for 30 s grace period, then downgrades.
- [ ] **SC-3.4** — Close the terminal tab. Verify immediate AGENT_ACTIVE → CODING/IDLE (no grace).
- [ ] **SC-3.5** — Open a second terminal, run `claude` in parallel. Verify both sessions tracked; AGENT_ACTIVE holds until BOTH end (DET-04).
- [ ] **SC-3.6** — Disable shell-integration (run `unsetopt PROMPT_SUBST` or similar). Verify tier-3 JSONL fs-watch picks up the session via mtime on `~/.claude/projects/*.jsonl`.
- [ ] **SC-3.7** — On Linux (if accessible), verify `fs.watch` fallback strategy works — likely polling-stat loop since recursive watch is not supported.
- [ ] **SC-3.8** — Test `python -m aider` invocation — verify regex matches (requires real aider install).

---

## Sign-off Criteria

Phase 03 is complete when:

- All 10 DET requirements have passing automated tests
- `pnpm test` green, `pnpm typecheck` green, `pnpm check:api-surface` green, `pnpm build` green, `pnpm check:bundle-size` PASS
- `src/detectors/regex.ts` contains zero `import "vscode"` (pure-core guard)
- HUMAN-UAT checklist above has at least SC-3.1, SC-3.2, SC-3.3, SC-3.4 signed off
- No regressions in Phase 2 test suite (42 tests still passing)

