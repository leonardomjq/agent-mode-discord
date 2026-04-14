/**
 * Phase 3 Wave 1 (plan 03-05) — regex matcher tests.
 *
 * Covers DET-02 (npx/bunx/pnpm dlx variants), DET-03 (5 CLIs including
 * python -m aider), DET-09 (ANSI + prompt-prefix strip only at Low confidence),
 * DET-10 (customPatterns auto-anchored + invalid regex silent-drop).
 *
 * The regex module is pure-core (no vscode import) — enforced by
 * scripts/check-api-surface.mjs PURE_CORE_PATHS.
 */
import { describe, it, expect } from "vitest";
import {
  BUILT_IN_PATTERNS,
  matchAgentCommand,
  normalizeCommandLine,
  buildMatcher,
  ANSI_CSI_RE,
} from "../src/detectors/regex";
import {
  LOW_CONFIDENCE_FIXTURES,
  type LowConfidenceFixture,
} from "./detectors/__helpers__/ansiFixtures";

// Confidence enum literal values per @types/vscode 1.115 — Low=0, Medium=1, High=2.
const LOW = 0;
const MEDIUM = 1;
const HIGH = 2;

describe("regex matcher", () => {
  describe("BUILT_IN_PATTERNS shape", () => {
    it("exposes patterns for all 5 v0.1 agents", () => {
      expect(Object.keys(BUILT_IN_PATTERNS).sort()).toEqual(
        ["aider", "claude", "codex", "gemini", "opencode"],
      );
      for (const patterns of Object.values(BUILT_IN_PATTERNS)) {
        expect(patterns.length).toBeGreaterThan(0);
        for (const p of patterns) {
          expect(p).toBeInstanceOf(RegExp);
          // First-word anchoring: every built-in pattern MUST start with ^.
          expect(p.source.startsWith("^")).toBe(true);
        }
      }
    });

    it("exports ANSI_CSI_RE as a global regex", () => {
      expect(ANSI_CSI_RE).toBeInstanceOf(RegExp);
      expect(ANSI_CSI_RE.flags).toContain("g");
    });
  });

  describe("matchAgentCommand — claude (DET-01/02)", () => {
    it("matches bare `claude`", () => {
      expect(matchAgentCommand("claude")).toEqual({ agent: "claude" });
    });

    it("matches `claude --print 'hi'`", () => {
      expect(matchAgentCommand("claude --print 'hi'")).toEqual({ agent: "claude" });
    });

    it("matches `claude chat`", () => {
      expect(matchAgentCommand("claude chat")).toEqual({ agent: "claude" });
    });

    it("matches npx/bunx/pnpm dlx @anthropic-ai/claude-code variants", () => {
      expect(matchAgentCommand("npx @anthropic-ai/claude-code")).toEqual({ agent: "claude" });
      expect(matchAgentCommand("bunx @anthropic-ai/claude-code")).toEqual({ agent: "claude" });
      expect(matchAgentCommand("pnpm dlx @anthropic-ai/claude-code")).toEqual({ agent: "claude" });
    });
  });

  describe("matchAgentCommand — aider / codex / gemini / opencode (DET-03)", () => {
    it("matches aider, python -m aider, python3 -m aider", () => {
      expect(matchAgentCommand("aider")).toEqual({ agent: "aider" });
      expect(matchAgentCommand("python -m aider")).toEqual({ agent: "aider" });
      expect(matchAgentCommand("python3 -m aider")).toEqual({ agent: "aider" });
      expect(matchAgentCommand("python3 -m aider --model gpt-4o")).toEqual({ agent: "aider" });
    });

    it("matches codex and npx/bunx @openai/codex", () => {
      expect(matchAgentCommand("codex")).toEqual({ agent: "codex" });
      expect(matchAgentCommand("npx @openai/codex")).toEqual({ agent: "codex" });
      expect(matchAgentCommand("bunx @openai/codex")).toEqual({ agent: "codex" });
    });

    it("matches gemini and npx @google/gemini-cli", () => {
      expect(matchAgentCommand("gemini")).toEqual({ agent: "gemini" });
      expect(matchAgentCommand("npx @google/gemini-cli")).toEqual({ agent: "gemini" });
      expect(matchAgentCommand("bunx @google/gemini-cli")).toEqual({ agent: "gemini" });
    });

    it("matches opencode", () => {
      expect(matchAgentCommand("opencode")).toEqual({ agent: "opencode" });
    });
  });

  describe("matchAgentCommand — admin subcommands still match (CONTEXT)", () => {
    it("matches `claude --help`, `claude mcp list`, `claude --version`", () => {
      expect(matchAgentCommand("claude --help")).toEqual({ agent: "claude" });
      expect(matchAgentCommand("claude mcp list")).toEqual({ agent: "claude" });
      expect(matchAgentCommand("claude --version")).toEqual({ agent: "claude" });
    });
  });

  describe("matchAgentCommand — negative cases (strict false-positive rejection)", () => {
    it('does NOT match `git commit -m "fix claude"`', () => {
      expect(matchAgentCommand('git commit -m "fix claude"')).toBeNull();
    });

    it("does NOT match `./claude-history.sh` (hyphen breaks word boundary)", () => {
      expect(matchAgentCommand("./claude-history.sh")).toBeNull();
    });

    it("does NOT match `echo claude`", () => {
      expect(matchAgentCommand("echo claude")).toBeNull();
    });
  });

  describe("matchAgentCommand — env/sudo prefix peel", () => {
    it("matches `sudo claude` (sudo peel)", () => {
      expect(matchAgentCommand("sudo claude")).toEqual({ agent: "claude" });
    });

    it("matches `doas claude` (doas peel)", () => {
      expect(matchAgentCommand("doas claude")).toEqual({ agent: "claude" });
    });

    it("matches `AGENT_MODE_CLIENT_ID=abc claude` (single env peel)", () => {
      expect(matchAgentCommand("AGENT_MODE_CLIENT_ID=abc claude")).toEqual({ agent: "claude" });
    });

    it("matches `FOO=1 BAR=2 claude` (multi env peel)", () => {
      expect(matchAgentCommand("FOO=1 BAR=2 claude")).toEqual({ agent: "claude" });
    });

    it("matches `sudo AGENT_MODE_CLIENT_ID=x claude` (sudo + env peel)", () => {
      expect(matchAgentCommand("sudo AGENT_MODE_CLIENT_ID=x claude")).toEqual({ agent: "claude" });
    });
  });

  describe("normalizeCommandLine — confidence gating (DET-09)", () => {
    it("applies full strip pipeline at Low confidence", () => {
      const raw = "\u001B[1;32m❯\u001B[0m claude";
      expect(normalizeCommandLine({ value: raw, confidence: LOW })).toBe("claude");
    });

    it("strips prompt prefix `[user@host ~]$`", () => {
      expect(
        normalizeCommandLine({
          value: "[user@host ~]$ npx @anthropic-ai/claude-code",
          confidence: LOW,
        }),
      ).toBe("npx @anthropic-ai/claude-code");
    });

    it("does NOT strip escape codes at Medium confidence", () => {
      // VS Code docs say Medium/High are already clean — we trim only.
      const raw = "  \u001B[32mclaude\u001B[0m  ";
      expect(normalizeCommandLine({ value: raw, confidence: MEDIUM })).toBe(
        "\u001B[32mclaude\u001B[0m",
      );
    });

    it("does NOT strip escape codes at High confidence", () => {
      const raw = "  \u001B[32mclaude\u001B[0m  ";
      expect(normalizeCommandLine({ value: raw, confidence: HIGH })).toBe(
        "\u001B[32mclaude\u001B[0m",
      );
    });

    it("trims-only at High confidence with clean value", () => {
      expect(normalizeCommandLine({ value: "  claude --print  ", confidence: HIGH })).toBe(
        "claude --print",
      );
    });

    it("collapses multiple spaces in Low-confidence value", () => {
      expect(
        normalizeCommandLine({ value: "$  claude   --print    'hi'", confidence: LOW }),
      ).toBe("claude --print 'hi'");
    });
  });

  describe("LOW_CONFIDENCE_FIXTURES table", () => {
    it.each(LOW_CONFIDENCE_FIXTURES)(
      "normalizes $shell: $raw → $expected",
      (fixture: LowConfidenceFixture) => {
        expect(
          normalizeCommandLine({ value: fixture.raw, confidence: LOW }),
        ).toBe(fixture.expected);
      },
    );

    it("every fixture's normalized form resolves to the expected agent (positive cases)", () => {
      // Map each fixture's expected normalized command to the agent it should match.
      // Negative fixtures (`notes` starts with "NEGATIVE:") must return null.
      for (const fixture of LOW_CONFIDENCE_FIXTURES) {
        const normalized = normalizeCommandLine({
          value: fixture.raw,
          confidence: LOW,
        });
        const isNegative = fixture.notes?.startsWith("NEGATIVE:") ?? false;
        const result = matchAgentCommand(normalized);
        if (isNegative) {
          expect(result, `fixture "${fixture.raw}" should NOT match`).toBeNull();
        } else {
          expect(result, `fixture "${fixture.raw}" should match`).not.toBeNull();
        }
      }
    });
  });

  describe("buildMatcher — custom patterns (DET-10)", () => {
    it("returns a matcher equivalent to built-ins-only when customPatterns is undefined", () => {
      const match = buildMatcher();
      expect(match("claude")).toEqual({ agent: "claude" });
      expect(match("echo claude")).toBeNull();
    });

    it("custom pattern extends built-ins — `claude-next` flows to agent label", () => {
      const match = buildMatcher({ "claude-next": ["claude-next\\b"] });
      expect(match("claude-next chat")).toEqual({ agent: "claude-next" });
      // Built-ins still work.
      expect(match("claude")).toEqual({ agent: "claude" });
    });

    it("auto-anchors user patterns — `/foo\\b/` against `bar foo baz` returns null", () => {
      const match = buildMatcher({ foo: ["foo\\b"] });
      expect(match("bar foo baz")).toBeNull();
      // But matches when foo is the first word.
      expect(match("foo --run")).toEqual({ agent: "foo" });
    });

    it("user-supplied leading `^` is tolerated (double anchor is a no-op)", () => {
      const match = buildMatcher({ "my-agent": ["^my-agent\\b"] });
      expect(match("my-agent chat")).toEqual({ agent: "my-agent" });
    });

    it("invalid custom pattern is silently dropped — no throw (D-18)", () => {
      const build = () => buildMatcher({ bad: ["[invalid("] });
      expect(build).not.toThrow();
      const match = build();
      expect(match("anything")).toBeNull();
      // Built-ins still work even when a custom pattern is invalid.
      expect(match("claude")).toEqual({ agent: "claude" });
    });

    it("mixed invalid + valid custom patterns — invalid dropped, valid still active", () => {
      const match = buildMatcher({
        bad: ["[invalid("],
        "claude-next": ["claude-next\\b"],
      });
      expect(match("claude-next chat")).toEqual({ agent: "claude-next" });
    });

    it("multiple patterns per agent — any matches", () => {
      const match = buildMatcher({
        mycli: ["mycli\\b", "alt-mycli\\b"],
      });
      expect(match("mycli run")).toEqual({ agent: "mycli" });
      expect(match("alt-mycli run")).toEqual({ agent: "mycli" });
    });
  });
});
