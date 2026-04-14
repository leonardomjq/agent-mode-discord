/**
 * Phase 3 Wave 0 stub — regex matcher module (src/detectors/regex.ts, pure-core).
 *
 * Covers DET-02 (npx/bunx/pnpm dlx variants), DET-03 (5 CLIs including
 * python -m aider), DET-09 (ANSI + prompt-prefix strip only at Low confidence),
 * DET-10 (customPatterns auto-anchored).
 *
 * The regex module is pure-core (no vscode import) — enforced by
 * scripts/check-api-surface.mjs PURE_CORE_PATHS. Wave 1 (plan 03-05) flips
 * these todos and consumes LOW_CONFIDENCE_FIXTURES as a table test.
 */
import { describe, it } from "vitest";
// Intentionally unused at Wave 0 — Wave 1 will table-test each fixture.
import { LOW_CONFIDENCE_FIXTURES } from "./detectors/__helpers__/ansiFixtures";

void LOW_CONFIDENCE_FIXTURES; // silence "imported but unused" until Wave 1 flips todos

describe("regex matcher", () => {
  it.todo("matches `claude` and `claude --print hi` to agent=claude (DET-01/02)");
  it.todo("matches npx/bunx/pnpm dlx @anthropic-ai/claude-code variants (DET-02)");
  it.todo("matches aider, python -m aider, python3 -m aider (DET-03)");
  it.todo("matches codex, npx @openai/codex, bunx @openai/codex (DET-03)");
  it.todo("matches gemini and opencode (DET-03)");
  it.todo("admin subcommands (claude --help, claude mcp list, claude --version) still match (CONTEXT)");
  it.todo("does NOT match `git commit -m \"fix claude\"` (claude is argument)");
  it.todo("does NOT match `./claude-history.sh` (hyphen breaks word boundary)");
  it.todo("strips ANSI CSI sequences from Low-confidence commandLine (DET-09)");
  it.todo("strips prompt prefixes [user@host path] $, %, ❯, →, $, ▶ (DET-09)");
  it.todo("collapses multiple spaces and trims (DET-09)");
  it.todo("does NOT strip Medium/High confidence values (DET-09)");
  it.todo("detect.customPatterns extends built-ins; user pattern claude-next auto-prefixed with ^ (DET-10)");
  it.todo("custom pattern unknown agent name flows through to agent label (DET-10)");
  it.todo("LOW_CONFIDENCE_FIXTURES table — every fixture normalizes and matches its expected agent");
});
