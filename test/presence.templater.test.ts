/**
 * Phase-4 Wave-0 test stubs for the render-time templater.
 *
 * Requirements covered: PERS-06
 * Decisions covered:   D-13 (elapsed reset) + Claude's Discretion (elapsed formatting)
 *
 * Wave 1+ plans flip these it.todo entries and wire in `src/presence/templater`.
 */
import { describe, it } from "vitest";

describe("templater", () => {
  it.todo("substitutes {workspace}, {filename}, {language}, {branch}, {agent}, {elapsed} at render time (PERS-06)");
  it.todo("missing context value renders as empty string, not the literal {token}");
  it.todo("message with only template tokens renders blank when all tokens empty → skip-blank signal (PERS-06)");
  it.todo("message with static text + empty-token prefix/suffix still renders (non-blank after trim)");
  it.todo("templater is passed the full message array intact; frame cycling is the animator's job, not the templater's");
  it.todo("{elapsed} formatted as Discord-style short duration (e.g. '20m', '2h 15m') from ms input (D-13, Claude's Discretion)");
  it.todo("oversized {filename} (> 128 chars) rendered unmodified — Discord truncates, templater does not (Pitfall 9)");
});
