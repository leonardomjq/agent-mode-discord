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
 * Built-in agent → regex patterns. Each pattern is first-word-anchored with `^`
 * and word-boundary-terminated to reject argument-position matches like
 * `git commit -m "fix claude"` (DET-02/03).
 */
export const BUILT_IN_PATTERNS: Record<BuiltInAgent, RegExp[]> = {
  claude: [
    /^claude\b/,
    /^(npx|bunx|pnpm dlx) @anthropic-ai\/claude-code\b/,
  ],
  aider: [
    /^aider\b/,
    /^python3?\s+-m\s+aider\b/,
  ],
  codex: [
    /^codex\b/,
    /^(npx|bunx) @openai\/codex\b/,
  ],
  gemini: [
    /^gemini\b/,
    /^(npx|bunx) @google\/gemini-cli\b/,
  ],
  opencode: [
    /^opencode\b/,
  ],
};

/** ANSI CSI regex — exported so shellIntegration.ts reuses the same pure helper (DET-09). */
export const ANSI_CSI_RE = /\u001B\[[0-?]*[ -/]*[@-~]/g;

/**
 * Matches a single prompt-prefix at the start of the (post-ANSI-strip, post-trimStart) line.
 * Covers:
 *  - POSIX-ish `[user@host ~]$ ` / `$ ` / `% ` / `❯ ` / `→ ` / `▶ `
 *  - PowerShell `PS C:\path> ` (including paths with spaces up to the `>`).
 */
const PROMPT_PREFIX_RE = /^(?:\[[^\]]*\]\s*)?[$%❯→▶]\s*|^PS\s+[A-Za-z]:\\[^>]*>\s*/;

/**
 * Pure ANSI + prompt-prefix strip pipeline (DET-09). Returns the input unchanged when
 * there is nothing to strip. Exported so shellIntegration.ts can reuse.
 */
export function stripAndNormalize(raw: string): string {
  return raw
    .replace(ANSI_CSI_RE, "")       // 1. strip CSI sequences
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
