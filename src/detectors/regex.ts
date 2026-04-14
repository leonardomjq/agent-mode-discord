/**
 * Pure-core agent-matching module for Phase 3 detectors (DET-02, DET-03, DET-09, DET-10).
 *
 * PURE-CORE boundary (D-16): zero `vscode` runtime imports. This module is consumed
 * by src/detectors/shellIntegration.ts (Wave 1, plan 03-01) which passes a vscode
 * TerminalShellExecutionCommandLine-shaped object via duck typing.
 *
 * Confidence enum (per @types/vscode 1.115): Low=0, Medium=1, High=2. This module
 * accepts a bare `number` so no vscode-type coupling leaks in.
 */

/** Known v0.1 agents. Custom patterns may produce arbitrary string labels (DET-10). */
export type BuiltInAgent = "claude" | "aider" | "codex" | "gemini" | "opencode";

/** Agent label — either a built-in or a user-supplied string from detect.customPatterns. */
export type AgentName = BuiltInAgent | string;

/** Match result — emitted by matchAgentCommand / buildMatcher. */
export interface AgentMatch {
  agent: AgentName;
}

/**
 * Non-hyphen, non-word terminator — stricter than `\b` which matches at `-`.
 * Ensures `^claude` matches `claude --help` but NOT `claude-next` or `claude-history`.
 * First-word anchoring + this terminator together enforce the CONTEXT strictness rule.
 */
const END = "(?![-\\w])";

/**
 * Built-in agent → regex patterns. Each pattern is first-word-anchored with `^`
 * and terminated with `(?![-\w])` to reject argument-position AND hyphenated-binary
 * matches like `git commit -m "fix claude"` and `./claude-history.sh` (DET-02/03).
 */
export const BUILT_IN_PATTERNS: Record<BuiltInAgent, RegExp[]> = {
  claude: [
    new RegExp(`^claude${END}`),
    new RegExp(`^(?:npx|bunx|pnpm dlx) @anthropic-ai\\/claude-code${END}`),
  ],
  aider: [
    new RegExp(`^aider${END}`),
    new RegExp(`^python3?\\s+-m\\s+aider${END}`),
  ],
  codex: [
    new RegExp(`^codex${END}`),
    new RegExp(`^(?:npx|bunx) @openai\\/codex${END}`),
  ],
  gemini: [
    new RegExp(`^gemini${END}`),
    new RegExp(`^(?:npx|bunx) @google\\/gemini-cli${END}`),
  ],
  opencode: [
    new RegExp(`^opencode${END}`),
  ],
};

/** ANSI CSI regex — exported so shellIntegration.ts reuses the same pure helper (DET-09). */
export const ANSI_CSI_RE = /\u001B\[[0-?]*[ -/]*[@-~]/g;

/**
 * ANSI OSC (Operating System Command) sequences — e.g. OSC 133 shell-integration markers
 * (`\x1B]133;A\x07`). Terminator is BEL (0x07) or ST (`\x1B\\`). PowerShell + VS Code
 * shell integration emit these at Low confidence.
 */
const ANSI_OSC_RE = /\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g;

/**
 * Matches a prompt prefix at the start of the line. Covers:
 *  - Bracketed `[user@host ~]$ ` / `[anything]$ `
 *  - POSIX terminators `$` `%` `❯` `→` `▶` — greedy up to the LAST such terminator on the
 *    line so `user@host:~/proj$ claude` strips to `claude`.
 *  - Fish `user@host ~/proj> ` (greedy `>` terminator).
 *  - PowerShell `PS C:\path> `.
 *
 * The two alternations use different strategies:
 *  - `^[^\s]*[$%❯→▶]\s+` — greedy first-word prompt with POSIX terminator + whitespace.
 *    Matches `[user@host ~]$ `, `user@host:~/proj$ `, `$ `, `% `, `❯ `, etc.
 *  - `^[^>\n]*>\s+` — anything ending in `> ` (fish / powershell). Safe because any
 *    real command starting with something-then-`>` would be a redirect, which requires
 *    a command before it anyway.
 */
const PROMPT_PREFIX_RE = /^(?:\[[^\]\n]*\]|[^\s]*)[$%❯→▶]\s+|^[^>\n]*>\s+/;

/**
 * Pure ANSI + prompt-prefix strip pipeline (DET-09). Returns the input unchanged when
 * there is nothing to strip. Exported so shellIntegration.ts can reuse.
 */
export function stripAndNormalize(raw: string): string {
  return raw
    .replace(ANSI_OSC_RE, "")       // 1a. strip OSC sequences (shell-integration markers)
    .replace(ANSI_CSI_RE, "")       // 1b. strip CSI sequences
    .replace(/\r?\n/g, " ")         // 2. line endings → space
    .trimStart()                    // 3. trim leading whitespace
    .replace(PROMPT_PREFIX_RE, "")  // 4. strip one prompt prefix
    .replace(/\s{2,}/g, " ")        // 5. collapse multiple spaces
    .trim();                        // 6. final trim
}

/**
 * Normalize a vscode.TerminalShellExecutionCommandLine-shaped object (DET-09).
 *
 * - confidence === 0 (Low):    full strip pipeline (ANSI + prompt prefix + collapse).
 * - confidence === 1 | 2:      trim only — values already clean per VS Code docs.
 *
 * Accepts a structural shape (not `vscode.TerminalShellExecutionCommandLine`) to keep
 * this module pure-core. The adapter passes vscode's value in via duck typing.
 */
export function normalizeCommandLine(commandLine: { value: string; confidence: number }): string {
  if (commandLine.confidence === 0) {
    return stripAndNormalize(commandLine.value);
  }
  return commandLine.value.trim();
}

/**
 * Internal: peel `sudo `/`doas ` + zero-or-more `KEY=value ` env assignments from
 * the front of a normalized command line. Both are valid command syntax rather than
 * noise — they live here (inside the matcher) rather than in stripAndNormalize.
 *
 * Returns the peeled command portion. Used by matchAgentCommand before pattern matching.
 */
function prePeel(s: string): string {
  let out = s;
  // Optional leading `sudo ` / `doas ` (single occurrence; chained sudoers are rare enough to skip).
  const sudoMatch = /^(?:sudo|doas)\s+/.exec(out);
  if (sudoMatch) {
    out = out.slice(sudoMatch[0].length);
  }
  // Zero or more leading env assignments: `KEY=value ` where KEY is [A-Z_][A-Z0-9_]*.
  // Env values are \S+ (no spaces — `KEY="with spaces" cmd` is uncommon in terminal history).
  while (true) {
    const envMatch = /^[A-Z_][A-Z0-9_]*=\S+\s+/.exec(out);
    if (!envMatch) break;
    out = out.slice(envMatch[0].length);
  }
  return out;
}

/**
 * Match a normalized command line against built-in patterns + optional custom matchers (DET-02/03/10).
 *
 * Iteration order is deterministic: BUILT_IN_PATTERNS declaration order, then customMatchers
 * in the order they were supplied (Object.entries is insertion-ordered for string keys, so
 * buildMatcher preserves user's key order).
 */
export function matchAgentCommand(
  normalized: string,
  customMatchers?: Array<{ agent: AgentName; pattern: RegExp }>,
): AgentMatch | null {
  const peeled = prePeel(normalized);
  for (const [agent, patterns] of Object.entries(BUILT_IN_PATTERNS) as Array<[BuiltInAgent, RegExp[]]>) {
    for (const pattern of patterns) {
      if (pattern.test(peeled)) {
        return { agent };
      }
    }
  }
  if (customMatchers) {
    for (const { agent, pattern } of customMatchers) {
      if (pattern.test(peeled)) {
        return { agent };
      }
    }
  }
  return null;
}

/**
 * Compose built-ins with user-supplied detect.customPatterns (DET-10).
 *
 * Each user pattern source string is auto-prefixed with `^` (first-word anchoring is
 * applied by the matcher, not the user — prevents footguns where a user writes
 * `\bclaude\b` and picks up argument-position matches). Double-anchor (`^^foo`) is
 * a no-op in ECMAScript regex.
 *
 * Invalid regex sources are silently dropped (D-18) — the caller cannot distinguish
 * "no match" from "invalid pattern dropped". The rest of the matcher keeps working.
 *
 * customPatterns shape: `Record<agentName, string[]>` — keys become the agent label
 * that flows to `{agent}` templating; values are raw regex source strings.
 */
export function buildMatcher(
  customPatterns?: Record<string, string[]>,
): (normalized: string) => AgentMatch | null {
  const customMatchers: Array<{ agent: AgentName; pattern: RegExp }> = [];
  if (customPatterns) {
    for (const [agent, sources] of Object.entries(customPatterns)) {
      for (const source of sources) {
        try {
          const anchored = source.startsWith("^") ? source : `^${source}`;
          customMatchers.push({ agent, pattern: new RegExp(anchored) });
        } catch {
          // D-18: silent failure — invalid user regex is dropped, not thrown.
        }
      }
    }
  }
  return (normalized: string) => matchAgentCommand(normalized, customMatchers);
}
