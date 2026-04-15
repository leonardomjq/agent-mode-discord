/**
 * Phase-4 Wave-0 test stubs for the vscode.git-backed branch reader.
 *
 * Requirements covered: PRIV-03, PRIV-04
 * Decisions covered:   D-18 (silent degrade via try/catch)
 *
 * Wave 1+ plans flip these it.todo entries and wire in the branch reader module.
 */
import { describe, it } from "vitest";

describe("gitBranch reader", () => {
  it.todo("reads current branch via vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1) when extension is active (PRIV-03)");
  it.todo("awaits ext.activate() when extension is installed but not yet active (Pitfall 3)");
  it.todo("returns empty string when vscode.git extension is missing (PRIV-04)");
  it.todo("returns empty string + logs debug when getAPI throws (PRIV-04 / D-18)");
  it.todo("returns empty string when privacy.gitBranch=hide regardless of API availability");
  it.todo("no toast anywhere on failure path (PROJECT.md no-toasts constraint)");
});
