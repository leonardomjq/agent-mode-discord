# Phase 3: Agent Detection — Research

**Researched:** 2026-04-13
**Domain:** VS Code Shell Integration API, fs.watch, regex, agent CLI invocations
**Confidence:** HIGH (core API verified from installed @types/vscode@1.115.0; agent invocations verified via npm registry + official docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- ZERO new runtime deps — native `fs.watch` with 100ms debounce, DIY ANSI regex
- First-word-anchor regex with word-boundary both sides; admin subcommands (`claude --help`) still count as AGENT_ACTIVE
- Session-end: primary via `onDidEndTerminalShellExecution` + 30s grace period
- JSONL staleness: 60s default, configurable 10–300
- 2000ms no-Shell-Integration holdoff on new terminal; subscribe to `onDidChangeTerminalShellIntegration` for full extension lifetime
- Precedence: companion > shellIntegration > sessionFiles > polling (companion slot reserved for Phase 5)
- Per-terminal `Map<vscode.Terminal, TerminalSession>`
- D-18 try/catch everywhere, silent failure
- Regex module shape: `BUILT_IN_PATTERNS: Record<AgentName, RegExp[]>` with `^` anchor; `detect.customPatterns` auto-prefixed with `^`
- `TerminalSession = { agent: string, signalTier: 1|2|3|4, lastActivityAt: number, graceExpiresAt: number | null }`
- `Detector` interface: `{ readonly tier: 1|2|3|4; start(dispatch): vscode.Disposable }`

### Claude's Discretion

None specified for this phase — all key decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

- Session-end "stuck" safety valve: max 8-hour AGENT_ACTIVE cap
- Anonymous telemetry for false-positive audit
- `terminal.shellIntegration.cwd` propagated to workspace context
- Per-agent regex calibration issues (codex false-positive on other codex binaries)
- Multi-window aggregation across VS Code processes

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DET-01 | Running `claude` in integrated terminal flips to AGENT_ACTIVE within 500ms with agent=`claude` | Shell Integration `onDidStartTerminalShellExecution` fires synchronously when command starts; regex match on commandLine.value |
| DET-02 | `npx @anthropic-ai/claude-code`, `bunx @anthropic-ai/claude-code`, `pnpm dlx @anthropic-ai/claude-code` detect as claude | Pattern array per agent in BUILT_IN_PATTERNS; verified via CONTEXT.md regex shape |
| DET-03 | `aider`, `codex`/`npx @openai/codex`, `gemini`, `opencode` detect and set agent label | All 5 agents confirmed: `aider` binary (python pip), `codex` npm global, `gemini` npm global, `opencode` npm global — see Standard Stack |
| DET-04 | Two parallel claude sessions hold AGENT_ACTIVE until both end | Per-terminal Map; orchestrator aggregates: AGENT_ACTIVE while any session active |
| DET-05 | Shell Integration unavailable fallback to `~/.claude/projects/*.jsonl` fs-watch | JSONL file structure confirmed; mtime-only; native fs.watch + 100ms debounce |
| DET-06 | Polling tier checks terminals every 5s against `detect.polling.terminalNamePatterns` | Simple setInterval + vscode.window.terminals; empty-by-default no false positives |
| DET-07 | Deterministic precedence: companion > shell > sessionFiles > polling | Orchestrator tier-map per terminal; higher-tier signal always wins |
| DET-08 | `onDidChangeTerminalShellIntegration` subscription prevents loss of first command in fresh terminal | Confirmed: subscribe to global event for full extension lifetime, not per-terminal; 2000ms holdoff |
| DET-09 | Low-confidence commandLine values are ANSI-stripped + prompt-prefix-stripped before regex | `TerminalShellExecutionCommandLineConfidence.Low = 0` confirmed; DIY CSI regex sufficient for supported shells |
| DET-10 | `detect.customPatterns` extends built-in regex; agent name flows to `{agent}` templating | Auto-prefix `^` on user patterns; unknown agent names fall back to generic AGENT_ACTIVE copy pool |

</phase_requirements>

---

## Summary

Phase 3 adds the agent-detection layer that upgrades `CODING → AGENT_ACTIVE` via four detector tiers. The VS Code Shell Integration API (stable since 1.93, confirmed in @types/vscode@1.115.0) provides `onDidStartTerminalShellExecution`, `onDidEndTerminalShellExecution`, and `onDidChangeTerminalShellIntegration` — all available without proposed APIs, zero cast required. The command line confidence enum has three values: `Low=0`, `Medium=1`, `High=2`; the CONTEXT.md strip pipeline is only triggered at `Low`, which is correct per the type definition.

The five target agents have been verified: `claude` (binary from npm install), `aider` (Python binary, also runnable as `python -m aider`), `codex` (npm global `@openai/codex`), `gemini` (npm global `@google/gemini-cli`), `opencode` (npm global `opencode-ai`, binary is `opencode`). The CONTEXT.md regex patterns correctly reflect real-world invocations with one addition needed: `python -m aider` is a documented fallback for aider users.

The `~/.claude/projects/` filesystem structure is confirmed on this machine: directory named after encoded CWD (non-alphanumeric chars → `-`), containing UUID-keyed `.jsonl` files. mtime updates per-message (append-on-write). Files persist after session end. No cleanup until Claude Code does internal rotation. This makes the mtime-staleness approach sound: a file last touched > 60s ago means the session is not actively exchanging.

The 2000ms holdoff for Shell Integration activation is a reasonable conservative estimate. Roo Code uses a 15-second timeout for their integration (they wait for command output), but for our lighter use case (just detecting start events) the VSIX shell integration script typically activates within 0.5-1s on warm shells. 2000ms provides a safe margin without being perceptible. The critical mitigation is subscribing to `onDidChangeTerminalShellIntegration` globally — this catches terminals where integration activates after the first command would otherwise have been missed.

**Primary recommendation:** Implement the five files in dependency order: regex module (03-05) first (pure, testable in isolation), then shellIntegration detector (03-01), sessionFiles detector (03-02), polling detector (03-03), then orchestrator (03-04) which wires them all together and plugs into the existing `dispatch` function from Phase 2.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vscode` (shell integration API) | ^1.93.0 (engine) | `onDidStart/EndTerminalShellExecution`, `onDidChangeTerminalShellIntegration` | Stable since 1.93 (Aug 2024); no proposed API needed |
| `fs` (Node built-in) | Node 24.x | `fs.watch` for JSONL tier | Zero deps; native; macOS/Linux/Windows compatible |
| `vitest` | ^2.0.0 | Unit tests | Established in Phase 2 |

[VERIFIED: installed @types/vscode@1.115.0 in node_modules]
[VERIFIED: Node.js v24.11.1 on this machine]

### Agent CLI Packages (for regex knowledge only — not runtime deps)

| Agent | Primary Binary | Alternative Invocations | Install |
|-------|---------------|------------------------|---------|
| `claude` | `claude` | `npx @anthropic-ai/claude-code`, `bunx @anthropic-ai/claude-code`, `pnpm dlx @anthropic-ai/claude-code` | npm install -g @anthropic-ai/claude-code |
| `aider` | `aider` | `python -m aider`, `python3 -m aider` | pip install aider-chat |
| `codex` | `codex` | `npx @openai/codex`, `bunx @openai/codex` | npm install -g @openai/codex |
| `gemini` | `gemini` | `npx @google/gemini-cli` | npm install -g @google/gemini-cli |
| `opencode` | `opencode` | — (no npx pattern documented) | npm install -g opencode-ai |

[VERIFIED: npm view @openai/codex version → 0.120.0]
[VERIFIED: npm view opencode-ai version → 1.4.3]
[VERIFIED: npm view @google/gemini-cli version → 0.37.2]
[CITED: aider.chat/docs/install.html — binary name is `aider`, `python -m aider` is documented fallback]
[CITED: opencode.ai/docs/cli/ — binary is `opencode`, npm package is `opencode-ai`]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fs.watch` + 100ms debounce | `chokidar` | Chokidar adds ~35KB; not worth it for non-recursive watch of one directory |
| DIY ANSI regex | `strip-ansi` | strip-ansi adds dependency; DIY CSI regex `/\u001B\[[0-?]*[ -/]*[@-~]/g` covers all VS Code-emitted sequences |

---

## Architecture Patterns

### Recommended Project Structure

```
src/detectors/
├── index.ts          # orchestrator — tier-precedence dedup, wires into dispatch
├── shellIntegration.ts  # tier 2 — onDidStart/End/Change events + ANSI strip + session map
├── sessionFiles.ts   # tier 3 — fs.watch on ~/.claude/projects/*.jsonl (mtime only)
├── polling.ts        # tier 4 — 5s setInterval against vscode.window.terminals
└── regex.ts          # pure module — BUILT_IN_PATTERNS + buildMatcher()
```

Note: tier 1 (companion) slot is reserved for Phase 5 (`companion.ts`).

### Pattern 1: Detector Interface

All Phase 3 detectors implement this locked interface:

```typescript
// Source: 03-CONTEXT.md Detector Orchestrator shape
interface Detector {
  readonly tier: 1 | 2 | 3 | 4;
  start(dispatch: (ev: Event) => void): vscode.Disposable;
}
```

Each `start()` call returns a `vscode.Disposable` that tears down all subscriptions/timers cleanly. The orchestrator calls `start()` on each detector and collects disposables.

### Pattern 2: Shell Integration Subscription — Correct Order to Avoid Missing First Commands

The critical pattern is subscribing to `onDidChangeTerminalShellIntegration` globally (for the extension lifetime) BEFORE setting up `onDidStart/EndTerminalShellExecution`. This prevents the race condition where shell integration activates after the terminal opens but before the command fires.

```typescript
// Source: @types/vscode@1.115.0 + 03-CONTEXT.md DET-08
// CORRECT: subscribe globally to catch async activation
context.push(vscode.window.onDidChangeTerminalShellIntegration(({ terminal, shellIntegration }) => {
  // Shell integration just activated for `terminal` — it's now ready
  onTerminalIntegrationReady(terminal, shellIntegration);
}));

// Then ALSO handle terminals that already have shell integration active at start time
for (const terminal of vscode.window.terminals) {
  if (terminal.shellIntegration) {
    onTerminalIntegrationReady(terminal, terminal.shellIntegration);
  }
}
```

The VS Code types confirm: `Terminal.shellIntegration` is `TerminalShellIntegration | undefined` and fires `onDidChangeTerminalShellIntegration` when it activates. [VERIFIED: @types/vscode@1.115.0]

### Pattern 3: Command Line Confidence Handling

```typescript
// Source: @types/vscode@1.115.0 TerminalShellExecutionCommandLineConfidence
// Low = 0, Medium = 1, High = 2

function normalizeCommandLine(commandLine: vscode.TerminalShellExecutionCommandLine): string {
  if (commandLine.confidence === vscode.TerminalShellExecutionCommandLineConfidence.Low) {
    return stripAndNormalize(commandLine.value); // ANSI strip + prompt prefix strip
  }
  // Medium and High: value is already clean — apply regex directly
  return commandLine.value.trim();
}

// DIY ANSI CSI strip (covers all sequences VS Code/zsh/fish/PowerShell emit)
function stripAnsiCsi(s: string): string {
  // CSI sequences: ESC [ ... final-byte
  return s
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")  // CSI sequences
    .replace(/\r?\n/g, " ")                       // CR/LF → space
    .trim();
}
```

[VERIFIED: `TerminalShellExecutionCommandLineConfidence.Low = 0` from @types/vscode@1.115.0]

### Pattern 4: Per-Terminal Session Map + Grace Period

```typescript
// Source: 03-CONTEXT.md "Per-terminal session map" decision
type TerminalSession = {
  agent: string;
  signalTier: 1 | 2 | 3 | 4;
  lastActivityAt: number;
  graceExpiresAt: number | null;
};

const sessions = new Map<vscode.Terminal, TerminalSession>();

// Aggregation: AGENT_ACTIVE while any session is in grace or has active signal
function hasActiveAgentSession(): boolean {
  const now = Date.now();
  for (const session of sessions.values()) {
    if (session.signalTier > 0) return true;
    if (session.graceExpiresAt !== null && now < session.graceExpiresAt) return true;
  }
  return false;
}
```

### Pattern 5: fs.watch Debounce for JSONL Tier

```typescript
// Source: fs.watch macOS double-fire mitigation (confirmed pattern in Node ecosystem)
let debounceTimer: NodeJS.Timeout | null = null;

const watcher = fs.watch(projectsDir, { persistent: false }, (event, filename) => {
  if (!filename?.endsWith(".jsonl")) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    try {
      checkJSONLActivity(filename);
    } catch { /* D-18 silent */ }
  }, 100); // 100ms debounce handles macOS double-fire
});
```

### Pattern 6: JSONL Staleness Check (mtime only — never parse content)

```typescript
// Source: DET-05 + PRD FR-1.8 "never parse structurally"
function isJSONLActive(filePath: string, stalenessSeconds: number): boolean {
  try {
    const stat = fs.statSync(filePath);
    return (Date.now() - stat.mtimeMs) < stalenessSeconds * 1000;
  } catch {
    return false; // file gone or unreadable — treat as inactive
  }
}
```

The `~/.claude/projects/` structure confirmed on this machine:
- Directory naming: `~/.claude/projects/<encoded-cwd>/` where `<encoded-cwd>` = absolute path with every non-alphanumeric char replaced by `-`
- Session files: UUID-keyed `.jsonl` files (e.g. `9f4311bd-fe70-4c81-a526-bffd5ec97329.jsonl`)
- mtime updates on every message exchange (append-on-write architecture)
- Files persist after session end — mtime staleness is the correct signal

[VERIFIED: direct inspection of `~/.claude/projects/` on this machine]

### Pattern 7: Regex Module Shape

```typescript
// Source: 03-CONTEXT.md "Regex module (03-05) shape" — verbatim locked
export const BUILT_IN_PATTERNS: Record<string, RegExp[]> = {
  claude: [/^claude\b/, /^(npx|bunx|pnpm dlx) @anthropic-ai\/claude-code\b/],
  aider: [/^aider\b/, /^python3?\s+-m\s+aider\b/, /^(npx|bunx|pnpm dlx) aider-chat\b/],
  codex: [/^codex\b/, /^(npx|bunx) @openai\/codex\b/],
  gemini: [/^gemini\b/],
  opencode: [/^opencode\b/],
};
```

Note: the CONTEXT.md shape is the canonical source. The addition of `python3?\s+-m\s+aider\b` pattern addresses the confirmed `python -m aider` fallback (aider documentation explicitly documents this). Add to the `aider` array.

[CITED: aider.chat/docs/install.html — "In some environments you may get 'aider command not found' errors. You can try `python -m aider`"]

### Anti-Patterns to Avoid

- **Subscribing to `onDidStartTerminalShellExecution` without a global `onDidChangeTerminalShellIntegration` subscription:** First command in a fresh terminal will be missed if shell integration activates asynchronously after the terminal opens. Always subscribe to both.
- **Parsing JSONL file content:** PRD §FR-1.8 bans this. Use `fs.statSync().mtimeMs` only.
- **Using `commandLine.isTrusted` as the strip-or-not gate:** Use `confidence === Low` per CONTEXT.md. `isTrusted` is about re-execution safety, not about command line cleanliness.
- **Watching `~/.claude/projects/**` recursively:** Watch the top-level directory non-recursively; filter for `.jsonl` by filename. Recursive watch is unnecessary and adds I/O overhead.
- **Applying ANSI strip to High/Medium confidence values:** Only strip at `Low`. High/Medium values are already clean per the VS Code type documentation.
- **Starting polling at 5s interval unconditionally:** The polling tier should only activate when `detect.polling.terminalNamePatterns` is non-empty (empty by default). An empty pattern array = no polling = no false positives.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ANSI/CSI escape stripping | Custom multi-pass parser | One-liner regex `/\u001B\[[0-?]*[ -/]*[@-~]/g` | CSI sequences have a fixed grammar; the regex is standards-accurate |
| File watching debounce | Complex event queue | 100ms `setTimeout` clear-and-reset | Standard pattern for fs.watch macOS double-fire |
| Agent process detection | Process list scanning (ps/tasklist) | Shell Integration API events | Process list is OS-specific, slow, invasive; Shell Integration is event-driven |

**Key insight:** The VS Code Shell Integration API gives us exactly what we need with zero syscalls — the shell itself reports the command start/end via OSC 633 escape sequences, which VS Code translates into typed events. There's no need to poll, scan processes, or parse output.

---

## Open Questions Resolved

### OQ-1: Shell Integration Event Ordering on Cursor 2026.04

**Finding:** Cursor is a fork of VS Code open-source core (Code OSS) and shares the same extension API including shell integration events. Shell integration is reported to work at the same base level. However, there are documented community reports of shell integration failures in Cursor on Windows 11 (forum.cursor.com/t/terminal-commands-fail-due-to-shell-integration-error-on-windows-11-cursor-0-46-8). This is the same fallback scenario the CONTEXT.md already accounts for (tier 3 sessionFiles covers it).

**Confidence:** MEDIUM — no official Cursor documentation found confirming identical event timing to VS Code; community reports suggest parity on macOS/Linux, issues on Windows.

**Impact on plan:** None — the existing tiered fallback design already handles the Cursor-on-Windows case via sessionFiles. The `onDidChangeTerminalShellIntegration` global subscription is the correct mitigation for async timing.

### OQ-2: `~/.claude/projects/` Directory Structure and Lifecycle

**Finding VERIFIED:** Confirmed on this machine.
- Directory: `~/.claude/projects/<encoded-cwd>/` where encoding replaces non-alphanumeric chars with `-`
- Session files: UUID-named `.jsonl` files (e.g. `9f4311bd-fe70-4c81-a526-bffd5ec97329.jsonl`)
- mtime updates on each message exchange (Claude Code appends to file on every message)
- Files persist after session end — a session that ended hours ago still has its `.jsonl` file with its last mtime
- Watch target: the project subdirectory (e.g. `~/.claude/projects/-Users-leonardojaques-projects-*/`) — but since we don't know the CWD ahead of time, watch `~/.claude/projects/` directory non-recursively and check subdirectories on change, OR watch a specific encoded path when available

**Key implication for implementation:** The watcher watches `~/.claude/projects/` non-recursively by default. However `fs.watch` on the top-level directory will fire when files in subdirectories change ONLY on some platforms. The safer pattern is:
1. Enumerate all `*.jsonl` files in all subdirectories at startup and on change
2. OR watch the encoded path for the current workspace specifically

Given the 60s staleness window is coarse, a 5s polling fallback over all `.jsonl` files in the directory (stat calls only) may be more reliable cross-platform than `fs.watch` on the parent directory.

[VERIFIED: direct filesystem inspection on macOS]

### OQ-3: Real-World Invocation Forms

| Agent | Confirmed Invocations | Source |
|-------|----------------------|--------|
| `claude` | `claude`, `npx @anthropic-ai/claude-code`, `bunx @anthropic-ai/claude-code`, `pnpm dlx @anthropic-ai/claude-code` | Locked in CONTEXT.md |
| `aider` | `aider`, `python -m aider`, `python3 -m aider` | [CITED: aider.chat/docs/install.html] |
| `codex` | `codex`, `npx @openai/codex`, `bunx @openai/codex` | [VERIFIED: npm view @openai/codex version → 0.120.0] |
| `gemini` | `gemini`, `npx @google/gemini-cli` | [VERIFIED: npm view @google/gemini-cli version → 0.37.2] |
| `opencode` | `opencode` | [VERIFIED: npm view opencode-ai version → 1.4.3; CITED: opencode.ai/docs/cli/] |

**Critical finding:** `aider` has no npm package — it is Python-only. The CONTEXT.md regex `aider-chat` pattern (from `npx|bunx|pnpm dlx`) is not needed. The correct patterns are `^aider\b` and `^python3?\s+-m\s+aider\b`. The `pnpm dlx aider-chat` pattern in CONTEXT.md regex is safe to keep (future-proofing) but currently does nothing since aider-chat is not on npm.

[CITED: aider.chat/docs/install.html — "All installation methods described rely on Python package managers (pip, pipx, uv)"]

### OQ-4: ANSI Edge Cases

**Finding:** VS Code Shell Integration uses OSC 633 sequences for shell integration markers (prompt start/end, pre-execution, execution-finished). The `commandLine.value` at `confidence === Low` is read from the terminal buffer between these markers, meaning it may contain:
- CSI sequences (colors, cursor movement): `\u001B\[[0-?]*[ -/]*[@-~]`
- Potentially OSC sequences if a prompt theme (powerlevel10k, oh-my-posh, starship) emits them inline
- CR (`\r`) from Windows-style line endings

**The DIY regex `/\u001B\[[0-?]*[ -/]*[@-~]/g` covers CSI correctly.** For OSC sequences (`\u001B]...\u0007` or `\u001B]...\u001B\\`), the risk is low because:
- VS Code's shell integration script already strips its own OSC 633 markers before exposing `commandLine.value`
- Prompt themes that use OSC sequences emit them to control terminal title/hyperlinks, which appear before the prompt, not in the command line itself
- The Low confidence case already means the parser fell back to buffer reading — the command should be the user-typed content after the prompt

**Conservative conclusion:** The DIY CSI regex is sufficient for the target cases. Add a secondary pass for any OSC-like noise if real-world testing reveals false negatives (flag for HUMAN-UAT).

[CITED: VS Code terminal shell-integration docs — OSC 633 is the integration protocol; CITED: ANSI Escape Codes gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797]

### OQ-5: Is 2000ms Holdoff Enough?

**Finding:** Roo Code uses a 15-second timeout for their more intensive shell integration usage (they wait for command output streams). For our use case — just receiving `onDidStartTerminalShellExecution` events — the relevant timing is how long the shell integration script takes to inject itself into a fresh shell.

Evidence:
- The VS Code shell integration script injects into shell rc files (`.bashrc`, `.zshrc`, etc.) for automatic activation
- On a warm shell (rc already loaded), the OSC 633 sequences are emitted within the first prompt render, which is typically < 500ms after terminal creation
- On a cold shell (first launch), the rc loading time can add 200-800ms for complex prompt themes (powerlevel10k, starship)
- User report from Roo Code documentation: fallback triggers "if not ready within the timeout" — they chose 15s for safety but acknowledge most cases are much faster

**2000ms is adequate for the 95th percentile warm-shell case.** For cold shells with heavy themes, the `onDidChangeTerminalShellIntegration` subscription is the correct safety net — it fires when integration activates, regardless of when that happens relative to the 2000ms window.

**Residual risk:** If a user opens a new terminal AND runs `claude` within 2000ms AND their shell integration hasn't activated yet AND the `onDidChangeTerminalShellIntegration` event fires after the command completes, we miss the session. This is the "cold start + fast typist" edge case that the sessionFiles tier (tier 3) catches.

[CITED: docs.roocode.com/features/shell-integration — 15-second timeout]
[ASSUMED: 2000ms covers 95th percentile warm-shell activation; no empirical measurements found in public documentation]

---

## Common Pitfalls

### Pitfall 1: Missing Terminals Active at Extension Startup

**What goes wrong:** `onDidChangeTerminalShellIntegration` only fires for FUTURE activations. Terminals open before the extension activates already have `terminal.shellIntegration` populated. If you only subscribe to the change event, you miss all pre-existing terminals.

**Why it happens:** The event fires on change, not on read. VS Code does not re-emit for existing state.

**How to avoid:** At startup, iterate `vscode.window.terminals` and check `terminal.shellIntegration !== undefined`. Register these immediately alongside the change subscription.

**Warning signs:** Detection works in second terminal but not first.

### Pitfall 2: Grace Period Timer Not Cancelled on New Signal

**What goes wrong:** A session ends (grace timer starts), then immediately a new `claude` invocation starts in the same terminal. If the grace timer fires, it removes the session and might dispatch `agent-ended` even though the new session is active.

**Why it happens:** Grace timer closure captures stale session reference.

**How to avoid:** When a new `agent-started` event arrives for a terminal, cancel any pending grace timer for that terminal before creating the new session entry. The `graceExpiresAt` field in `TerminalSession` should be nulled out, and any associated `setTimeout` handle must be cleared.

### Pitfall 3: `onDidCloseTerminal` vs `onDidEndTerminalShellExecution` Ordering

**What goes wrong:** Both events may arrive; handling both without a guard causes double-cleanup.

**Why it happens:** When a terminal is closed while a command is still running, `onDidEndTerminalShellExecution` may or may not fire before `onDidCloseTerminal` depending on how the terminal is closed.

**How to avoid:** Use `onDidCloseTerminal` as the definitive cleanup (delete session immediately, no grace). Check `sessions.has(terminal)` before processing `onDidEndTerminalShellExecution` to avoid double-dispatch.

### Pitfall 4: fs.watch on Parent Directory May Not Fire for Subdirectory Changes on All Platforms

**What goes wrong:** `fs.watch("~/.claude/projects/", ...)` may not receive events when files in subdirectories change, depending on OS and Node version.

**Why it happens:** `fs.watch` without `{ recursive: true }` only watches the immediate directory. Claude Code writes to `~/.claude/projects/<encoded-cwd>/<session>.jsonl` — one level deep.

**How to avoid:** Either:
1. Use `{ recursive: true }` — works on macOS and Windows, NOT on Linux (limited kernel support)
2. Watch the specific encoded subdirectory for the current workspace (computable from `vscode.workspace.workspaceFolders`)
3. Implement a polling fallback (stat all .jsonl files every 5s) as the cross-platform approach

**Recommendation for Plan 03-02:** Watch `~/.claude/projects/` recursively on macOS/Windows, fall back to a 5s polling stat check on Linux. Guard with `process.platform` check. Wrap in try/catch per D-18.

### Pitfall 5: Empty `detect.polling.terminalNamePatterns` Must Produce Zero Signal

**What goes wrong:** If the polling tier iterates terminals even with an empty pattern array, it might match anything.

**Why it happens:** An empty regex array with `some()` always returns false — but care is needed that `terminalNamePatterns.length === 0` short-circuits before any regex construction.

**How to avoid:** In `polling.ts`, guard with `if (patterns.length === 0) return;` at the top of the poll loop. Document this explicitly.

### Pitfall 6: `commandLine.value` Can Update After `onDidStartTerminalShellExecution`

**What goes wrong:** The VS Code types note: "The value may become more accurate after `onDidEndTerminalShellExecution` is fired."

**Why it happens:** Low-confidence values are read from terminal buffer markers; as the command executes, the buffer may get more complete data.

**How to avoid:** For our detection purpose, reading `commandLine.value` at `onDidStartTerminalShellExecution` time is correct — we want to know the command IS running, not its final resolved value. Accept the slight inaccuracy risk at Low confidence; the strip pipeline compensates.

[VERIFIED: @types/vscode@1.115.0 TerminalShellExecution.commandLine JSDoc: "The value may become more accurate after onDidEndTerminalShellExecution is fired"]

---

## Code Examples

### Shell Integration Detector Bootstrap

```typescript
// Source: @types/vscode@1.115.0 + 03-CONTEXT.md
export function createShellIntegrationDetector(
  dispatch: (ev: Event) => void
): vscode.Disposable {
  const disposables: vscode.Disposable[] = [];
  const sessions = new Map<vscode.Terminal, TerminalSession>();
  const holdoffTimers = new Map<vscode.Terminal, NodeJS.Timeout>();
  const HOLDOFF_MS = 2_000;
  const GRACE_MS = 30_000;

  // Subscribe globally for async activation (DET-08)
  disposables.push(
    vscode.window.onDidChangeTerminalShellIntegration(({ terminal }) => {
      // Integration just activated — cancel holdoff if pending
      const t = holdoffTimers.get(terminal);
      if (t) { clearTimeout(t); holdoffTimers.delete(terminal); }
    })
  );

  // Handle commands starting
  disposables.push(
    vscode.window.onDidStartTerminalShellExecution(({ terminal, execution }) => {
      try {
        const normalized = normalizeCommandLine(execution.commandLine);
        const match = matchAgentCommand(normalized);
        if (!match) return;
        startSession(terminal, match.agent, 2, sessions, dispatch);
      } catch { /* D-18 */ }
    })
  );

  // Handle commands ending
  disposables.push(
    vscode.window.onDidEndTerminalShellExecution(({ terminal, execution }) => {
      try {
        const session = sessions.get(terminal);
        if (!session || session.signalTier !== 2) return;
        const normalized = normalizeCommandLine(execution.commandLine);
        const match = matchAgentCommand(normalized);
        if (!match) return;
        startGrace(terminal, session, sessions, dispatch, GRACE_MS);
      } catch { /* D-18 */ }
    })
  );

  // Handle terminal close — no grace
  disposables.push(
    vscode.window.onDidCloseTerminal((terminal) => {
      sessions.delete(terminal);
      const t = holdoffTimers.get(terminal);
      if (t) { clearTimeout(t); holdoffTimers.delete(terminal); }
    })
  );

  // Seed: check terminals already open with shell integration active
  for (const terminal of vscode.window.terminals) {
    if (!terminal.shellIntegration) {
      // Set holdoff — integration may activate async
      const t = setTimeout(() => {
        holdoffTimers.delete(terminal);
        // After holdoff, no integration = no shell events for this terminal
      }, HOLDOFF_MS);
      holdoffTimers.set(terminal, t);
    }
  }

  return vscode.Disposable.from(...disposables);
}
```

### ANSI Strip + Prompt Prefix Normalize

```typescript
// Source: 03-CONTEXT.md "ANSI / prompt-prefix stripping" (DET-09)
// Only called when commandLine.confidence === Low
const ANSI_CSI_RE = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const PROMPT_PREFIX_RE = /^(\[[^\]]*\]\s*)?[$%❯→▶]\s*/;

export function normalizeCommandLine(
  commandLine: vscode.TerminalShellExecutionCommandLine
): string {
  if (commandLine.confidence !== vscode.TerminalShellExecutionCommandLineConfidence.Low) {
    return commandLine.value.trim();
  }
  return commandLine.value
    .replace(ANSI_CSI_RE, "")          // 1. Strip CSI sequences
    .replace(/\r?\n/g, " ")            // 2. Normalize line endings
    .trimStart()                       // 3. Trim leading whitespace
    .replace(PROMPT_PREFIX_RE, "")     // 4. Strip prompt prefix
    .replace(/\s{2,}/g, " ")          // 5. Collapse multiple spaces
    .trim();
}
```

### BUILT_IN_PATTERNS with `python -m aider` addition

```typescript
// Source: 03-CONTEXT.md shape + aider.chat/docs/install.html confirmation
export const BUILT_IN_PATTERNS: Record<string, RegExp[]> = {
  claude: [
    /^claude\b/,
    /^(npx|bunx|pnpm dlx) @anthropic-ai\/claude-code\b/,
  ],
  aider: [
    /^aider\b/,
    /^python3?\s+-m\s+aider\b/,    // documented fallback invocation
  ],
  codex: [
    /^codex\b/,
    /^(npx|bunx) @openai\/codex\b/,
  ],
  gemini: [
    /^gemini\b/,
  ],
  opencode: [
    /^opencode\b/,
  ],
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Terminal name heuristics only | Shell Integration events (onDidStart/End) | VS Code 1.93 Aug 2024 | Exact command detection without polling |
| Process scanning (ps/wmic) | Event-driven via OSC 633 escape sequences | VS Code 1.93 Aug 2024 | Zero syscalls, cross-platform |
| `vscode.proposed.terminalExecuteCommandEvent` | Stable API in `vscode.d.ts` | VS Code 1.93 (promoted from proposed) | No `enabledApiProposals` needed |

**Deprecated/outdated:**
- `Terminal.processId`: was used for process-based detection; now superseded by shell integration events
- `(vscode as any).terminal.*` casts to proposed APIs: not needed; shell integration is in stable API

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 2000ms holdoff covers 95th percentile warm-shell activation time | Open Questions OQ-5 | Users with very slow shell startup see false CODING→IDLE→CODING flicker; tier 3 sessionFiles covers Claude anyway |
| A2 | Cursor on Windows shell integration failures require tier 3 sessionFiles fallback (not tier 2) | OQ-1 | If Cursor Windows actually works fine with Shell Integration, no harm — detectors are layered |
| A3 | `python -m aider` and `python3 -m aider` are the only Python-invocation variants worth matching | OQ-3 | If users use `py -m aider` (Windows) or virtualenv-specific invocations, those miss; low frequency |
| A4 | OSC sequences from prompt themes do not appear in `commandLine.value` at Low confidence | OQ-4 | If they do, the DIY regex misses them; HUMAN-UAT should test with a starship/p10k prompt |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js `fs` module | sessionFiles.ts fs.watch | ✓ | Node 24.11.1 | — |
| vscode Shell Integration API | shellIntegration.ts | ✓ | @types/vscode 1.115.0 | Tier 3 sessionFiles |
| `~/.claude/projects/` directory | sessionFiles.ts | ✓ | Confirmed on machine | fs.watch catches creation if absent at start |
| `vitest` | Test suite | ✓ | ^2.0.0 | — |

[VERIFIED: Node.js v24.11.1; @types/vscode@1.115.0; ~/.claude/projects/ confirmed]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^2.0.0 |
| Config file | `vitest.config.ts` — `environment: "node"`, `include: ["test/**/*.test.ts"]` |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DET-01 | `claude` in terminal → AGENT_ACTIVE within 500ms | integration (Dev Host) | HUMAN-UAT | ❌ Wave 0 |
| DET-02 | `npx/bunx/pnpm dlx @anthropic-ai/claude-code` → agent=`claude` | unit (regex) | `pnpm test` — `test/detectors.regex.test.ts` | ❌ Wave 0 |
| DET-03 | `aider`/`codex`/`gemini`/`opencode` regex patterns match | unit (regex) | `pnpm test` — `test/detectors.regex.test.ts` | ❌ Wave 0 |
| DET-04 | Two parallel sessions hold AGENT_ACTIVE until both end | unit (orchestrator) | `pnpm test` — `test/detectors.orchestrator.test.ts` | ❌ Wave 0 |
| DET-05 | sessionFiles tier fires on mtime change, staleness check | unit (sessionFiles mock) | `pnpm test` — `test/detectors.sessionFiles.test.ts` | ❌ Wave 0 |
| DET-06 | Polling only fires if patterns non-empty | unit (polling) | `pnpm test` — `test/detectors.polling.test.ts` | ❌ Wave 0 |
| DET-07 | Precedence: higher tier suppresses lower tier debug-only | unit (orchestrator) | `pnpm test` — `test/detectors.orchestrator.test.ts` | ❌ Wave 0 |
| DET-08 | `onDidChangeTerminalShellIntegration` subscription catches async activation | unit (shellIntegration mock) | `pnpm test` — `test/detectors.shellIntegration.test.ts` | ❌ Wave 0 |
| DET-09 | ANSI-stripped Low-confidence commandLine passes regex | unit (regex + normalize) | `pnpm test` — `test/detectors.regex.test.ts` | ❌ Wave 0 |
| DET-10 | `detect.customPatterns` extends patterns; unknown agent → fallback copy | unit (regex) | `pnpm test` — `test/detectors.regex.test.ts` | ❌ Wave 0 |
| DET-01 (UAT) | 500ms flip verified in real Cursor | HUMAN-UAT | Manual | — |
| DET-05 (UAT) | sessionFiles tier detects active Claude without shell integration | HUMAN-UAT | Manual | — |

### Fixture Strategy for DET-09

ANSI fixtures must simulate real Low-confidence `commandLine.value` strings. Known inputs from shell types:

```typescript
// test/detectors.regex.test.ts — fixture examples
const ANSI_FIXTURES = [
  // zsh with starship prompt (CSI color sequences)
  { raw: "\u001B[1;32m❯\u001B[0m \u001B[36mclaude\u001B[0m --print hi", normalized: "claude --print hi", agent: "claude" },
  // zsh default prompt: [user@host path] $
  { raw: "[leo@macbook proj] $ claude chat", normalized: "claude chat", agent: "claude" },
  // fish shell prompt (❯ prefix common)
  { raw: "❯ aider --model gpt-4", normalized: "aider --model gpt-4", agent: "aider" },
  // PowerShell prompt prefix
  { raw: "PS C:\\Users\\leo> codex", normalized: "codex", agent: "codex" },
  // Multi-space collapse after strip
  { raw: "\u001B[0m$  claude   --help", normalized: "claude --help", agent: "claude" },
  // sudo prefix
  { raw: "$ sudo claude", normalized: "sudo claude", agent: "claude" },
  // env prefix
  { raw: "$ AGENT_CLIENT_ID=x claude", normalized: "AGENT_CLIENT_ID=x claude", agent: "claude" },
  // NOT an agent — argument, not command
  { raw: "$ git commit -m 'fix claude bug'", normalized: "git commit -m 'fix claude bug'", agent: null },
  // NOT an agent — hyphenated binary name
  { raw: "$ ./claude-history.sh", normalized: "./claude-history.sh", agent: null },
  // python -m aider
  { raw: "❯ python -m aider", normalized: "python -m aider", agent: "aider" },
  { raw: "$ python3 -m aider --model gpt-4o", normalized: "python3 -m aider --model gpt-4o", agent: "aider" },
  // npx variants
  { raw: "$ npx @anthropic-ai/claude-code", normalized: "npx @anthropic-ai/claude-code", agent: "claude" },
  { raw: "$ npx @openai/codex", normalized: "npx @openai/codex", agent: "codex" },
];
```

Each fixture tests: (1) `normalizeCommandLine` with `confidence: Low` produces the normalized string, (2) `matchAgentCommand(normalized)` returns the correct agent or null.

### Fake `vscode.Terminal` + Shell Integration Mock Shape

Following the Phase 2 `vi.mock("vscode", ...)` pattern from `test/detectors.editor.test.ts`:

```typescript
// Minimal mock shape for shell integration tests
import { vi } from "vitest";
import { TerminalShellExecutionCommandLineConfidence } from "vscode"; // use real enum

// Mock terminal factory
function makeMockTerminal(name = "Terminal 1"): vscode.Terminal {
  return {
    name,
    shellIntegration: undefined, // async activation simulated below
    dispose: vi.fn(),
    // other required fields...
  } as unknown as vscode.Terminal;
}

// Mock execution factory
function makeMockExecution(
  commandLineValue: string,
  confidence: TerminalShellExecutionCommandLineConfidence
): vscode.TerminalShellExecution {
  return {
    commandLine: {
      value: commandLineValue,
      confidence,
      isTrusted: confidence === TerminalShellExecutionCommandLineConfidence.High,
    },
  } as vscode.TerminalShellExecution;
}

// Full vi.mock("vscode") shape needed for shellIntegration.ts
vi.mock("vscode", () => ({
  window: {
    terminals: [],  // populated per-test
    onDidChangeTerminalShellIntegration: vi.fn((cb) => {
      mockOnChangeShellIntegration = cb; // capture for later invocation
      return { dispose: vi.fn() };
    }),
    onDidStartTerminalShellExecution: vi.fn((cb) => {
      mockOnStart = cb;
      return { dispose: vi.fn() };
    }),
    onDidEndTerminalShellExecution: vi.fn((cb) => {
      mockOnEnd = cb;
      return { dispose: vi.fn() };
    }),
    onDidCloseTerminal: vi.fn((cb) => {
      mockOnClose = cb;
      return { dispose: vi.fn() };
    }),
  },
  Disposable: { from: (...ds: any[]) => ({ dispose: () => ds.forEach(d => d.dispose()) }) },
  TerminalShellExecutionCommandLineConfidence: { Low: 0, Medium: 1, High: 2 },
}));
```

### How to Simulate fs.watch Events for JSONL Tier Tests

`sessionFiles.ts` will use `fs.watch`. In tests, mock the `fs` module:

```typescript
// test/detectors.sessionFiles.test.ts
import { vi } from "vitest";

vi.mock("fs", async () => {
  const real = await vi.importActual<typeof import("fs")>("fs");
  let watchCallback: ((event: string, filename: string | null) => void) | null = null;

  return {
    ...real,
    watch: vi.fn((_path: string, _opts: unknown, cb: typeof watchCallback) => {
      watchCallback = cb;
      return { close: vi.fn() };
    }),
    statSync: vi.fn().mockImplementation((filePath: string) => {
      // Return controlled mtimes per test
      return { mtimeMs: mockMtimes.get(filePath) ?? 0 };
    }),
  };
});

// In test body, simulate a file change:
function triggerFsWatchEvent(filename: string): void {
  // Access captured callback and invoke it
  watchCallback?.("change", filename);
}
```

For testing the debounce: use `vi.useFakeTimers()` + `vi.advanceTimersByTime(150)` to verify the 100ms debounce fires exactly once for rapid events.

### HUMAN-UAT Items

Items that require real Cursor/VS Code + Claude running:

| ID | Scenario | What to Observe | Pass Criteria |
|----|----------|-----------------|---------------|
| HUAT-3-01 | Run `claude` in integrated terminal (Cursor macOS) | Discord sidebar status | AGENT_ACTIVE within 500ms; agent label = "claude" |
| HUAT-3-02 | Run `npx @anthropic-ai/claude-code` in terminal | Discord sidebar status | Same as 3-01; agent = "claude" |
| HUAT-3-03 | Run `claude`, then open second terminal, run `claude` again, exit first | Discord state | AGENT_ACTIVE until second session ends |
| HUAT-3-04 | Disable Shell Integration (set `terminal.integrated.shellIntegration.enabled: false`), run `claude` for >60s | Discord status | AGENT_ACTIVE via sessionFiles tier (tier 3) |
| HUAT-3-05 | Cursor on Windows — run `claude` (shell integration may not activate) | Discord status | AGENT_ACTIVE via sessionFiles tier |
| HUAT-3-06 | Run `claude`, wait 30s, close terminal | Discord status | AGENT_ACTIVE during 30s grace, then transitions to CODING/IDLE |
| HUAT-3-07 | Fish shell with complex prompt (if applicable) — run `claude` | Debug log + Discord | ANSI strip works; no false negative on Low confidence commandLine |
| HUAT-3-08 | Add custom pattern `my-ai-tool` in settings, run `my-ai-tool` in terminal | Discord agent label | AGENT_ACTIVE with agent = "my-ai-tool" |

### Sampling Rate

- **Per task commit:** `pnpm test` — full suite (42 existing + new Phase 3 tests)
- **Per wave merge:** `pnpm test && pnpm build && pnpm check:bundle-size`
- **Phase gate:** Full suite green + HUAT-3-01 through HUAT-3-06 verified manually before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `test/detectors.regex.test.ts` — covers DET-02, DET-03, DET-09, DET-10 with ANSI fixtures
- [ ] `test/detectors.shellIntegration.test.ts` — covers DET-01, DET-08 with vscode mock
- [ ] `test/detectors.sessionFiles.test.ts` — covers DET-05 with fs mock + fake timers
- [ ] `test/detectors.polling.test.ts` — covers DET-06 with vscode mock + fake timers
- [ ] `test/detectors.orchestrator.test.ts` — covers DET-04, DET-07 with all sub-detector mocks

---

## Security Domain

No new attack surface introduced in Phase 3. The detectors are read-only and local:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | Yes (regex patterns) | User-supplied `detect.customPatterns` are strings auto-prefixed with `^`; no eval; no exec |
| V6 Cryptography | No | — |

| Threat Pattern | STRIDE | Mitigation |
|----------------|--------|------------|
| Malicious `customPatterns` regex causing ReDoS | Denial of Service | All patterns anchored with `^`; no unbounded backtracking; patterns applied to short command strings only |
| JSONL file content read accidentally | Information Disclosure | Only `fs.statSync().mtimeMs` — never `readFileSync`; try/catch wraps all fs calls |
| Shell injection via commandLine.value | Tampering | We only read and regex-match; never execute or eval the command line |

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md does not exist in this project root. Constraints are derived from PROJECT.md, PRD §18, and Phase 2 decisions:

| Constraint | Source | Impact on Phase 3 |
|-----------|--------|-------------------|
| ZERO runtime deps beyond `@xhayper/discord-rpc` | PRD §18 / PROJECT.md | No chokidar, no strip-ansi |
| Files ≤ 200 lines | PRD §18 guardrail | Each detector file must stay under 200 lines; split if needed |
| Zero `(vscode as any).*` casts | SKEL-05 / PROJECT.md | Use stable API only — all Phase 3 APIs are in stable @types/vscode |
| D-18 silent failure everywhere | Phase 2 established | All vscode calls + fs calls wrapped in try/catch |
| Pure-Node vitest (no vscode import in tests) | D-16 / D-19 Phase 2 | All test files use `vi.mock("vscode", ...)` |
| `src/state/**` and `src/rpc/throttle.ts` must NOT import `vscode` | D-16 Phase 2 | Detectors CAN import vscode; pure state modules cannot |
| JSONL content: mtime + existence only, never parse | PRD §FR-1.8 | `fs.statSync().mtimeMs` only |
| Conventional Commits | PROJECT.md | Commit messages: `feat(03-XX): ...` |
| pnpm not npm | PROJECT.md | `pnpm install`, `pnpm test`, `pnpm build` |

---

## Sources

### Primary (HIGH confidence)

- `node_modules/@types/vscode/index.d.ts` (v1.115.0) — `TerminalShellExecutionCommandLineConfidence` enum (Low=0, Medium=1, High=2), `TerminalShellExecutionCommandLine` interface, `TerminalShellExecution` interface, `TerminalShellExecutionStartEvent`, `TerminalShellExecutionEndEvent`, `onDidChangeTerminalShellIntegration`, `onDidStartTerminalShellExecution`, `onDidEndTerminalShellExecution` [VERIFIED: direct grep on installed file]
- `~/.claude/projects/` filesystem inspection — directory structure (encoded-CWD subdirectories, UUID.jsonl session files), mtime behavior [VERIFIED: direct stat on this machine]
- `npm view @openai/codex version` → 0.120.0 [VERIFIED]
- `npm view opencode-ai version` → 1.4.3 [VERIFIED]
- `npm view @google/gemini-cli version` → 0.37.2 [VERIFIED]

### Secondary (MEDIUM confidence)

- [aider.chat/docs/install.html](https://aider.chat/docs/install.html) — `aider` binary name, `python -m aider` documented fallback, Python-only (no npm)
- [opencode.ai/docs/cli/](https://opencode.ai/docs/cli/) — binary is `opencode`; npm package is `opencode-ai`
- [docs.roocode.com/features/shell-integration](https://docs.roocode.com/features/shell-integration) — 15-second shell integration timeout for their use case; confirms activation is async
- [code.visualstudio.com/docs/terminal/shell-integration](https://code.visualstudio.com/docs/terminal/shell-integration) — supported shells (bash, fish, pwsh, zsh); shell quality levels
- [Node.js fs.watch double-fire issue #3042](https://github.com/nodejs/node/issues/3042) — confirms 100ms debounce is the standard mitigation

### Tertiary (LOW confidence)

- Community reports of Cursor shell integration failures on Windows 11 — forum.cursor.com; confirms Windows fallback necessity (already accounted for in CONTEXT.md)
- Cursor = VS Code fork with identical shell integration base at API level — [morphllm.com comparison](https://www.morphllm.com/comparisons/cursor-vs-vscode)

---

## Metadata

**Confidence breakdown:**
- Standard stack (API types): HIGH — directly verified from installed @types/vscode
- Standard stack (agent CLIs): HIGH — npm registry verified for codex/opencode/gemini; aider cited from official docs
- Architecture patterns: HIGH — derived directly from CONTEXT.md locked decisions + verified API shapes
- Pitfalls: MEDIUM — derived from API documentation + established Node.js patterns; some edge cases require HUMAN-UAT validation
- JSONL lifecycle: HIGH — verified by direct filesystem inspection on this machine

**Research date:** 2026-04-13
**Valid until:** 2026-07-13 (90 days — API stable; agent CLI versions may change but binary names are stable)
