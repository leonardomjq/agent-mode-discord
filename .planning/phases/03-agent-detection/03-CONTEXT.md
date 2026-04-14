# Phase 3: Agent Detection — Context

**Gathered:** 2026-04-14
**Status:** Ready for planning
**Source:** Claude-opinionated defaults (user delegated gray areas with "apply your opinion for a good modern open-source Discord extension")

<domain>
## Phase Boundary

Upgrade CODING → AGENT_ACTIVE via tiered detectors that identify when an AI coding CLI (`claude`, `aider`, `codex`, `gemini`, `opencode`) is running in the VS Code integrated terminal.

**In scope:**
- `detectors/shellIntegration.ts` — Shell Integration API (onDidStart/End/ChangeTerminalShellExecution + onDidChangeTerminalShellIntegration); ANSI + prompt-prefix stripping; per-terminal session map; async-activation holdoff (2 s) before declaring "no integration"
- `detectors/sessionFiles.ts` — `fs.watch` on `~/.claude/projects/*.jsonl`; mtime + existence only; never parse JSONL content
- `detectors/polling.ts` — 5 s interval against `vscode.window.terminals`; matches user's `detect.polling.terminalNamePatterns`; empty-by-default
- `detectors/index.ts` — deterministic precedence orchestrator: `companion > shellIntegration > sessionFiles > polling`; lower tiers log at debug only when a higher tier has signal
- Regex module — built-in patterns for 5 CLIs + `detect.customPatterns` extension slot

**Out of scope (deferred to later phases):**
- Companion-plugin tier (Phase 5)
- Per-agent copy / icons (Phase 4)
- OpenCode companion plugin (v0.2)
- Cline / Roo Code via `getExtension().isActive` (v0.2)
- JSONL content parsing — never; undocumented internal format

</domain>

<decisions>
## Implementation Decisions

### Session-end heuristics — "when does cooking stop?"

Layered, additive:

1. **Primary (highest fidelity):** Shell Integration's `onDidEndTerminalShellExecution` for the matched `claude`/`aider`/etc. command. REPL CLIs (`claude` without `-p`) don't fire end until the REPL exits, which is exactly the signal we want.
2. **Secondary (fallback):** For the JSONL tier, `mtime within last 60 s` = active. Outside that window → signal off.
3. **Terminal disposal:** `onDidCloseTerminal` marks that terminal's session as ended unconditionally.
4. **Flicker guard:** after any "end" signal, hold AGENT_ACTIVE for a **grace period of 30 s** before downgrading. Prevents Discord flicker during one-shot `claude --print` invocations chained in quick succession.

**Rationale:** Users want "cooking" to linger slightly past the literal end of the command, not blink off the instant a prompt returns. 30 s is generous enough to absorb tool-call round trips but short enough that Discord reflects "actually idle" within a rotation clock.

### Regex strictness — false-positive tolerance

Strict policy: **false positives worse than false negatives** for a public-installed extension.

Built-in patterns match as the **first word of the command** (after optional `sudo ` / `doas ` / env assignments), word-boundary on both sides, case-sensitive. So:

- ✅ `claude`
- ✅ `claude chat`
- ✅ `claude --print "hi"`
- ✅ `npx @anthropic-ai/claude-code`
- ✅ `bunx @anthropic-ai/claude-code`
- ✅ `pnpm dlx @anthropic-ai/claude-code`
- ✅ `AGENT_MODE_CLIENT_ID=x claude`
- ❌ `git commit -m "fix claude"` (claude is argument, not command)
- ❌ `echo claude` (same)
- ❌ `./claude-history.sh` (hyphen breaks word boundary)

**Admin subcommands still count as AGENT_ACTIVE:**
- `claude --help`, `claude --version`, `claude mcp list` — all still set AGENT_ACTIVE. The cost of distinguishing REPL vs admin invocations is high regex/state complexity, and the UX of "admin ran for 2 s, Discord blinked, not worth it" is acceptable. If a user is literally typing `claude anything`, they're working with Claude.

**Custom patterns (DET-10):** `detect.customPatterns` is a plain array of regex strings. Same anchoring rule is applied automatically (first-word anchor is prepended by the matcher, not the user). Prevents footgun where a user writes `\bclaude\b` and gets noise.

### JSONL staleness threshold (DET-05)

**60 seconds.** Matches rotation-clock cadence. 30 s is too tight (claude often "thinks" silently for 20–40 s), 120 s is too loose (lingers after session close, user sees "cooking" for 2 min after shutting the terminal).

Configurable via `detect.sessionFileStalenessSeconds` (bounded 10 ≤ N ≤ 300) for users with long-running tool calls.

### Deps — no new runtime dependencies

Both `strip-ansi` and `chokidar` are **NOT adopted**. DIY wins on:

- **ANSI strip:** inline regex `/\u001B\[[0-?]*[ -/]*[@-~]/g` + CR/LF normalization. Standards-accurate enough for what we need; <10 lines; 0 deps.
- **fs.watch:** native `fs.watch` with a 100 ms debounce (handles macOS double-fire). We're not doing recursive deep watches — the JSONL tier watches `~/.claude/projects/` directory non-recursively and filters for `.jsonl` extension + mtime threshold. Windows symlink issues don't apply (claude doesn't symlink its session files).

Rationale: bundle is currently 431 KB / 500 KB. Adding `chokidar` (+35 KB) would chew a meaningful chunk of the remaining budget that Phase 4 (personality pack) will want. And every added dep is supply-chain surface for a tool that runs in every AI session. Keep it zero.

### Per-terminal session map (DET-04)

`Map<vscode.Terminal, TerminalSession>` where `TerminalSession = { agent: string, signalTier: 1|2|3|4, lastActivityAt: number, graceExpiresAt: number | null }`.

Aggregation rule: extension's `AGENT_ACTIVE` state reflects `sessions.size > 0 && some session has (inGrace || signalTier > 0)`. Agent label = agent from highest-tier active session (tie → most recent by lastActivityAt).

On `onDidCloseTerminal`: delete entry immediately, no grace period (terminal is gone, nothing to preserve).

### ANSI / prompt-prefix stripping (DET-09)

Applied in this order on every `commandLine.value`:
1. Strip ANSI CSI sequences
2. Trim leading whitespace
3. Strip known prompt prefixes: `[user@host path] $`, `%`, `❯`, `→`, `$`, `▶` (regex at start of line)
4. Collapse multiple spaces to one
5. Apply regex match against normalized string

Only applied when `commandLine.confidence === "low"` (high-confidence values are already clean per VS Code docs).

### "No Shell Integration" holdoff (DET-08)

On new terminal creation, wait **2 000 ms** before marking "no shell integration". This covers async activation of the Shell Integration plugin on a fresh terminal. Hardcoded — configurable doesn't buy enough to justify a setting.

Subscribe to `onDidChangeTerminalShellIntegration` for the whole extension lifetime, NOT just for a specific terminal. Missing this subscription loses the first command's event on terminals where integration activates asynchronously.

### Detector orchestrator (03-04) interface

```ts
interface Detector {
  readonly tier: 1 | 2 | 3 | 4;  // 1=companion (Phase 5 slot), 2=shell, 3=sessionFiles, 4=polling
  start(dispatch: (ev: Event) => void): vscode.Disposable;
}
```

`detectors/index.ts` starts all detectors in tier order, dispatches a pre-tagged `agent-started` / `agent-ended` event that includes tier + terminal ref. The reducer is unchanged — the orchestrator handles deduplication by maintaining a tier-labeled signal map per terminal and only propagating state changes when the highest-tier signal changes.

### Error handling

D-18 pattern (per Phase 2 SUMMARYs): every detector wraps top-level in try/catch, silent-failure to debug log. A throwing detector must not crash the extension host or prevent other detectors from firing.

### Regex module (03-05) shape

```ts
export const BUILT_IN_PATTERNS: Record<AgentName, RegExp[]> = {
  claude: [/^claude\b/, /^(npx|bunx|pnpm dlx) @anthropic-ai\/claude-code\b/],
  aider: [/^aider\b/, /^(npx|bunx|pnpm dlx) aider-chat\b/],
  codex: [/^codex\b/, /^(npx|bunx) @openai\/codex\b/],
  gemini: [/^gemini\b/],
  opencode: [/^opencode\b/],
};
```

First-word anchor (`^`) enforces strictness. User's `detect.customPatterns` array is auto-prefixed with `^` (non-escaping) so users just write `claude-next` to add a fork without having to understand anchoring.

</decisions>

<canonical_refs>
## Canonical References

MUST be read by researcher and planner:

- `.planning/PROJECT.md` — core value, pain framing, evolution rules
- `.planning/REQUIREMENTS.md` — DET-01..10 binding requirements
- `.planning/ROADMAP.md` — Phase 3 goal, 5-plan breakdown
- `.planning/phases/02-core-pipeline/02-CONTEXT.md` — Phase 2 decisions this phase extends (reducer, state machine, driver)
- `.planning/phases/02-core-pipeline/02-01-SUMMARY.md` — reducer interface (Event union: agent-started / agent-ended / ...)
- `.planning/phases/02-core-pipeline/02-07-SUMMARY.md` — driver integration pattern; how detectors wire into the dispatch pipeline
- `discord-agent-presence-prd.md` — PRD §FR-1.8 (JSONL parsing prohibition), §18 (runtime-dep ask rule)
- VS Code Shell Integration API docs — `onDidStart/End/ChangeTerminalShellExecution`, `onDidChangeTerminalShellIntegration`, `TerminalShellIntegration`, `TerminalShellExecutionCommandLineConfidence`

If new ADRs or research notes are created during Phase 3, add their paths here.

</canonical_refs>

<deferred>
## Deferred Ideas

Not acted on in Phase 3. Captured so they aren't lost.

- **Session-end "stuck" safety valve:** max 8-hour AGENT_ACTIVE cap, force-downgrade to CODING/IDLE. Hedge against detector bugs leaving Discord permanently "cooking". Consider for Phase 4 when animator is introduced.
- **Anonymous telemetry for false-positive audit:** reserved for v0.2 DET-V2. Even a single opt-in debug channel ("here's what I matched, was that right?") would be valuable.
- **Richer session metadata from shell integration:** `terminal.shellIntegration.cwd` could propagate workspace/repo info back to the reducer — currently the driver reads workspace from `vscode.workspace.workspaceFolders`. Don't wire in Phase 3; revisit if Phase 4 personality wants per-repo copy pools.
- **Per-agent regex calibration issues** (e.g., `codex` false-positive on unrelated `codex` binaries in user's PATH) — leave as-is for v0.1; v0.2 community feedback informs a stricter alternative pattern.
- **Multi-window aggregation across VS Code processes:** DET-04 covers two terminals in one window. Two separate VS Code windows each running `claude` — each has its own pid-scoped Discord activity (Phase 2 PRP-01) so no aggregation needed.

</deferred>

<open_questions>
## Open Questions (For Researcher)

Things the researcher should investigate before planner commits:

1. **Shell Integration event ordering on Cursor 2026.04:** Cursor is a VS Code fork and may fire Shell Integration events with different timing. Research Cursor-specific quirks that affect DET-08 (async activation holdoff). Compare to VS Code Insiders documented behavior.
2. **`~/.claude/projects/` directory structure and lifecycle:** confirm (don't assume) that Claude Code writes one `.jsonl` per session, mtime updates on each exchange, file persists after session end. Check whether hooks/plugins change this.
3. **`aider`, `codex`, `gemini`, `opencode` invocation realities:** what do these CLIs actually look like in practice? Aider might run as a Python shell (`python -m aider`). Codex has both `codex` binary and `@openai/codex` npm. Capture real-world variants for the regex module.
4. **ANSI escape sequence edge cases:** do any supported shells (zsh, fish, PowerShell) emit non-CSI ANSI that slips past the DIY regex? If so, is it worth a second pass or is `commandLine.confidence: "high"` reliably clean?
5. **2000 ms holdoff validation:** is 2 s actually enough on cold start? Research existing shell-integration timing studies / user reports.

</open_questions>

*Phase: 03-agent-detection*
*Context gathered: 2026-04-14 via Claude-opinionated defaults (user delegated)*
