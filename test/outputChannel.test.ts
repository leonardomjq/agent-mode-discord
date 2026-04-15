/**
 * Phase-4 Wave-0 test stubs for the debug-verbose-gated output channel.
 *
 * Requirements covered: CONF-05
 *
 * Wave 1+ plans flip these it.todo entries and wire in `src/outputChannel`.
 */
import { describe, it } from "vitest";

describe("outputChannel", () => {
  it.todo("debug.verbose=false suppresses appendLine calls (CONF-05)");
  it.todo("debug.verbose=true forwards appendLine to the underlying channel (CONF-05)");
  it.todo("channel name is 'Agent Mode (Discord)' per Claude's Discretion");
  it.todo("log() is a no-op when channel not yet created (defensive — activate() race)");
});
