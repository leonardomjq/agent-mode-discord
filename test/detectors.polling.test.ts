/**
 * Phase 3 Wave 0 stub — polling detector (tier 4).
 *
 * Covers DET-06: 5s interval, empty-by-default `detect.polling.terminalNamePatterns`.
 *
 * Wave 1 (plan 03-03) flips each todo into a vitest case using vi.useFakeTimers
 * to advance the 5s interval and assert dispatch semantics (no-op when
 * patterns empty, fires agent-started when pattern matches, tier-4 signal
 * suppressed by higher-tier signal for the same terminal).
 */
import { describe, it } from "vitest";

describe("polling detector", () => {
  it.todo("does not poll when detect.polling.terminalNamePatterns is empty (DET-06 default)");
  it.todo("polls vscode.window.terminals every 5s when patterns non-empty");
  it.todo("dispatches agent-started for terminals matching any configured pattern");
  it.todo("does not dispatch when higher tier already signals same terminal (no-op coordination)");
  it.todo("disposes interval cleanly on dispose");
});
