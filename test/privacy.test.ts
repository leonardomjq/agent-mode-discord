import { describe, it } from "vitest";

describe("privacy.redact", () => {
  it.todo("mode=show returns input unchanged for workspace / filename / branch fields");
  it.todo("mode=hide returns empty string regardless of field");
  it.todo("mode=hash throws Error with message \"not implemented until Phase 4\"");
  it.todo("unknown mode treated as show (default-safe)");
});
