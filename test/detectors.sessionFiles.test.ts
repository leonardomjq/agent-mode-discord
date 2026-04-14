/**
 * Phase 3 Wave 0 stub — sessionFiles detector (tier 3).
 *
 * Covers DET-05: `~/.claude/projects/*.jsonl` fs.watch + 60s staleness +
 * platform branch (macOS/Windows recursive watch vs Linux polling-stat).
 *
 * Wave 1 (plan 03-02) flips each todo into a test that mocks node:fs,
 * drives fs.watch events via a test harness, and asserts dispatch is called
 * with `agent-started` within the debounce window. Per PRD §FR-1.8, the
 * detector MUST NEVER read JSONL content — only fs.statSync().mtimeMs.
 */
import { describe, it } from "vitest";

describe("sessionFiles detector", () => {
  it.todo("dispatches agent-started when ~/.claude/projects/<cwd>/<uuid>.jsonl mtime updates (DET-05)");
  it.todo("ignores files older than sessionFileStalenessSeconds (default 60s)");
  it.todo("debounces fs.watch double-fire within 100ms (Pitfall 4 macOS)");
  it.todo("falls back to 5s polling-stat loop on Linux (Pitfall 4 platform branch)");
  it.todo("uses recursive: true on macOS and Windows (process.platform check)");
  it.todo("never reads JSONL content — only fs.statSync().mtimeMs (PRD §FR-1.8)");
  it.todo("silent on missing ~/.claude/projects/ directory at startup (D-18)");
});
