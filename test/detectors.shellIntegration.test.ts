/**
 * Phase 3 Wave 0 stub — shellIntegration detector (tier 2).
 *
 * Covers DET-01 (claude → AGENT_ACTIVE <500ms), DET-04 (parallel sessions),
 * DET-08 (onDidChangeTerminalShellIntegration + 2000ms holdoff), DET-09
 * (ANSI + prompt-prefix strip on Low confidence).
 *
 * Wave 1 (plan 03-01) will flip each `it.todo(...)` into a full vitest case
 * that wires the fakeTerminal helper, mocks vscode globals, and asserts the
 * described behavior. This file MUST NOT import source modules yet — the
 * adapter (src/detectors/shellIntegration.ts) does not exist at Wave 0.
 */
import { describe, it } from "vitest";
// Intentionally unused at Wave 0 — Wave 1 will consume these helpers.
import { makeFakeTerminal } from "./detectors/__helpers__/fakeTerminal";

void makeFakeTerminal; // silence "imported but unused" until Wave 1 flips todos

describe("shellIntegration detector", () => {
  it.todo("dispatches agent-started within 500ms when claude command starts (DET-01)");
  it.todo("normalizes Low-confidence commandLine via ANSI strip + prompt-prefix strip (DET-09)");
  it.todo("subscribes onDidChangeTerminalShellIntegration globally for async activation (DET-08)");
  it.todo("seeds existing terminals with active shell integration at start (Pitfall 1)");
  it.todo("starts 2000 ms holdoff for terminals without shell integration at construction (DET-08)");
  it.todo("cancels holdoff timer when shell integration activates within window (DET-08)");
  it.todo("starts 30s grace on agent-end and dispatches agent-ended only when grace expires");
  it.todo("cancels pending grace timer when same-terminal agent-started fires inside grace (Pitfall 2)");
  it.todo("two parallel claude sessions in two terminals each tracked independently (DET-04)");
  it.todo("onDidCloseTerminal deletes session immediately, no grace (Pitfall 3)");
});
