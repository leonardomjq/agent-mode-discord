/**
 * Phase-4 Wave-0 test stubs for the config reader.
 *
 * Requirements covered: CONF-02 (+ D-24 lazy re-read)
 *
 * Wave 1+ plans flip these it.todo entries and wire in `src/config` readConfig.
 */
import { describe, it } from "vitest";

describe("config reader", () => {
  it.todo("agentMode.clientId blank string → readConfig returns DEFAULT_CLIENT_ID (CONF-02)");
  it.todo("agentMode.clientId non-empty string → readConfig returns the user value (CONF-02)");
  it.todo("missing agentMode.clientId → readConfig returns DEFAULT_CLIENT_ID (CONF-02)");
  it.todo("all 14+ config keys round-trip through readConfig with schema defaults matching package.json");
  it.todo("readConfig is called fresh per tick (no module-level caching) — D-24");
});
