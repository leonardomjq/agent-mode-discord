/**
 * Phase-4 Wave-1 tests for the render-time templater.
 *
 * Requirements covered: PERS-06
 * Decisions covered:   D-13 (elapsed reset — caller's concern; templater just substitutes)
 *
 * Plan 04-03 flips these from it.todo → passing, wiring `src/presence/templater`.
 */
import { describe, expect, it } from "vitest";
import { isBlank, renderTemplate, type TemplateTokens } from "../src/presence/templater";

describe("templater", () => {
  describe("renderTemplate — token substitution", () => {
    it("substitutes {workspace}, {filename}, {language}, {branch}, {agent}, {elapsed} at render time (PERS-06)", () => {
      const tokens: TemplateTokens = {
        workspace: "my-repo",
        filename: "app.ts",
        language: "typescript",
        branch: "main",
        agent: "claude",
        elapsed: "20m",
      };
      expect(
        renderTemplate("{workspace}/{filename} ({language}) on {branch} — {agent} {elapsed}", tokens),
      ).toBe("my-repo/app.ts (typescript) on main — claude 20m");
    });

    it("message with no tokens passes through unchanged", () => {
      expect(renderTemplate("building", {})).toBe("building");
    });

    it("filled token substitutes its string value", () => {
      expect(renderTemplate("editing {filename}", { filename: "app.ts" })).toBe("editing app.ts");
    });

    it("empty-string token substitutes as empty (caller uses isBlank to decide skip)", () => {
      expect(renderTemplate("editing {filename}", { filename: "" })).toBe("editing ");
    });

    it("missing token renders as empty string (never leaks literal {token})", () => {
      expect(renderTemplate("editing {filename}", {})).toBe("editing ");
    });

    it("unknown token renders as empty string, never as the literal {foo}", () => {
      expect(renderTemplate("{foo}", {})).toBe("");
      expect(renderTemplate("prefix {foo} suffix", {})).toBe("prefix  suffix");
    });

    it("multiple tokens with separator render intact", () => {
      expect(renderTemplate("{workspace} · {branch}", { workspace: "repo", branch: "main" })).toBe(
        "repo · main",
      );
    });

    it("all-empty-token message still renders the literal separator (isBlank returns false for ' · ')", () => {
      const rendered = renderTemplate("{workspace} · {branch}", { workspace: "", branch: "" });
      expect(rendered).toBe(" · ");
      expect(isBlank(rendered)).toBe(false);
    });

    it("deterministic — 1000 calls with same args produce identical output", () => {
      const first = renderTemplate("editing {filename}", { filename: "app.ts" });
      for (let i = 0; i < 1000; i += 1) {
        expect(renderTemplate("editing {filename}", { filename: "app.ts" })).toBe(first);
      }
    });

    it("oversized {filename} (> 128 chars) rendered unmodified — Discord truncates, templater does not (Pitfall 9)", () => {
      const long = "a".repeat(200);
      expect(renderTemplate("file: {filename}", { filename: long })).toBe(`file: ${long}`);
    });

    it("templater is passed the message intact; frame cycling is the animator's job, not the templater's", () => {
      // Templater operates on a single string. Callers (animator) apply it per-frame.
      // Verify per-frame independence: same tokens produce per-frame identical output for static frames,
      // and different per-frame output when a frame string differs.
      const frames = ["cooking.", "cooking..", "cooking..."];
      const tokens: TemplateTokens = {};
      const out = frames.map((f) => renderTemplate(f, tokens));
      expect(out).toEqual(["cooking.", "cooking..", "cooking..."]);
    });

    it("{elapsed} passes through the caller-formatted short-duration string (Discord-style)", () => {
      // Formatting of elapsed from ms → "20m" / "2h 15m" is the caller's concern (D-13,
      // Claude's Discretion). Templater just substitutes the string.
      expect(renderTemplate("cooking for {elapsed}", { elapsed: "20m" })).toBe("cooking for 20m");
      expect(renderTemplate("cooking for {elapsed}", { elapsed: "2h 15m" })).toBe("cooking for 2h 15m");
    });
  });

  describe("isBlank", () => {
    it("returns true for empty string", () => {
      expect(isBlank("")).toBe(true);
    });

    it("returns true for whitespace-only strings", () => {
      expect(isBlank("   ")).toBe(true);
      expect(isBlank("\t\n")).toBe(true);
      expect(isBlank(" \t  \n\r ")).toBe(true);
    });

    it("returns false for strings with any non-whitespace character", () => {
      expect(isBlank("x")).toBe(false);
      expect(isBlank(" x ")).toBe(false);
    });

    it("returns false for a bullet-separator ' · ' (intentional — separators are visible copy)", () => {
      expect(isBlank(" · ")).toBe(false);
    });

    it("blank-after-substitution signal — message with only empty tokens returns blank", () => {
      // PERS-06 skip-blank: "editing {filename}" with filename="" renders "editing " (non-blank),
      // but "{filename}" alone with filename="" renders "" (blank → caller skips).
      expect(isBlank(renderTemplate("{filename}", { filename: "" }))).toBe(true);
      expect(isBlank(renderTemplate("editing {filename}", { filename: "" }))).toBe(false);
    });
  });
});
