/**
 * Low-confidence commandLine fixtures for Phase 3 regex + shellIntegration tests.
 *
 * Each entry represents a `vscode.TerminalShellExecutionCommandLine.value` at
 * `confidence === Low`, as captured from supported shells. The `expected` field
 * is the normalized string after the full strip pipeline:
 *   1. stripAnsiCsi    — /\u001B\[[0-?]*[ -/]*[@-~]/g
 *   2. strip prompt prefixes: `[user@host path] $`, `%`, `❯`, `→`, `$`, `▶`
 *   3. collapse multiple spaces to one
 *   4. trim
 *
 * For negative cases (no agent match expected), `expected` is still the
 * normalized string — tests assert `matchAgentCommand(expected) === null`.
 *
 * See 03-VALIDATION.md §Fixture Strategy and 03-RESEARCH.md §Validation
 * Architecture for the source tables.
 */

export interface LowConfidenceFixture {
  shell: "bash" | "zsh" | "fish" | "powershell" | "bash-raw";
  raw: string;
  /** Normalized command line after strip pipeline. */
  expected: string;
  /** Optional notes explaining the fixture's purpose. */
  notes?: string;
}

export const LOW_CONFIDENCE_FIXTURES: LowConfidenceFixture[] = [
  // --- Core shell variants (VALIDATION §Fixture Strategy verbatim) ---
  {
    shell: "bash",
    raw: "\x1b[32muser@host\x1b[0m:\x1b[34m~/proj\x1b[0m$ claude",
    expected: "claude",
    notes: "bash with green user@host + blue cwd CSI colors",
  },
  {
    shell: "zsh",
    raw: "\x1b[1m❯\x1b[0m claude --print 'hi'",
    expected: "claude --print 'hi'",
    notes: "zsh bold powerlevel10k-style ❯ prompt",
  },
  {
    shell: "fish",
    raw: "user@host ~/proj> claude",
    expected: "claude",
    notes: "fish default prompt with > terminator",
  },
  {
    shell: "powershell",
    raw: "\x1b]133;A\x07PS C:\\proj> claude",
    expected: "claude",
    notes: "powershell with OSC 133;A shell-integration marker prefix",
  },
  {
    shell: "bash-raw",
    raw: "[user@host ~]$ npx @anthropic-ai/claude-code",
    expected: "npx @anthropic-ai/claude-code",
    notes: "bash raw [user@host ~]$ prompt (no ANSI)",
  },

  // --- Additional shell/prompt variants (RESEARCH §Validation Architecture) ---
  {
    shell: "zsh",
    raw: "% claude --version",
    expected: "claude --version",
    notes: "zsh default % prompt",
  },
  {
    shell: "bash",
    raw: "$ claude mcp list",
    expected: "claude mcp list",
    notes: "bare $ prompt",
  },
  {
    shell: "zsh",
    raw: "→ bunx @anthropic-ai/claude-code",
    expected: "bunx @anthropic-ai/claude-code",
    notes: "starship → prompt glyph",
  },
  {
    shell: "zsh",
    raw: "▶ pnpm dlx @anthropic-ai/claude-code",
    expected: "pnpm dlx @anthropic-ai/claude-code",
    notes: "custom ▶ prompt glyph",
  },

  // --- Env / prefix variants (admin subcommands still match per CONTEXT) ---
  {
    shell: "bash",
    raw: "$ AGENT_MODE_CLIENT_ID=abc claude",
    expected: "AGENT_MODE_CLIENT_ID=abc claude",
    notes: "env var prefix — regex must accept env-prefixed claude (matcher handles this, not fixture)",
  },
  {
    shell: "bash",
    raw: "$ sudo claude",
    expected: "sudo claude",
    notes: "sudo prefix — matcher should strip sudo/doas/env before anchor check",
  },

  // --- Non-claude agents ---
  {
    shell: "bash",
    raw: "[user@host ~]$ python -m aider",
    expected: "python -m aider",
    notes: "aider via python -m (documented fallback)",
  },
  {
    shell: "zsh",
    raw: "\x1b[1m❯\x1b[0m python3 -m aider --model claude-3-5-sonnet",
    expected: "python3 -m aider --model claude-3-5-sonnet",
    notes: "python3 -m aider variant with flags",
  },
  {
    shell: "bash",
    raw: "$ npx @openai/codex",
    expected: "npx @openai/codex",
    notes: "codex via npx",
  },
  {
    shell: "zsh",
    raw: "% bunx @openai/codex",
    expected: "bunx @openai/codex",
    notes: "codex via bunx",
  },
  {
    shell: "bash",
    raw: "$ gemini",
    expected: "gemini",
    notes: "bare gemini binary",
  },
  {
    shell: "bash",
    raw: "$ opencode",
    expected: "opencode",
    notes: "bare opencode binary",
  },

  // --- Negative cases: regex MUST NOT match after normalization ---
  {
    shell: "bash",
    raw: "$ git commit -m \"fix claude\"",
    expected: "git commit -m \"fix claude\"",
    notes: "NEGATIVE: claude is argument, not command",
  },
  {
    shell: "bash",
    raw: "$ ./claude-history.sh",
    expected: "./claude-history.sh",
    notes: "NEGATIVE: hyphenated binary breaks word boundary",
  },
  {
    shell: "bash",
    raw: "$ echo claude",
    expected: "echo claude",
    notes: "NEGATIVE: claude is argument to echo",
  },
];
