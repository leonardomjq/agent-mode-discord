import { describe, it, expect } from "vitest";
import { redact, type RedactMode } from "../src/privacy";

describe("privacy.redact", () => {
  it("mode=show returns input unchanged for workspace / filename / branch fields", () => {
    expect(redact("workspace", "my-repo", "show")).toBe("my-repo");
    expect(redact("filename", "a.ts", "show")).toBe("a.ts");
    expect(redact("branch", "main", "show")).toBe("main");
    expect(redact("filename", "", "show")).toBe(""); // empty passes through
  });

  it("mode=hide returns empty string regardless of field", () => {
    expect(redact("workspace", "my-repo", "hide")).toBe("");
    expect(redact("filename", "a.ts", "hide")).toBe("");
    expect(redact("branch", "feature/x", "hide")).toBe("");
    expect(redact("filename", "", "hide")).toBe("");
  });

  it("mode=hash throws Error with message \"not implemented until Phase 4\"", () => {
    expect(() => redact("workspace", "my-repo", "hash")).toThrow("not implemented until Phase 4");
    expect(() => redact("filename", "a.ts", "hash")).toThrow(Error);
    expect(() => redact("branch", "main", "hash")).toThrow(/not implemented until Phase 4/);
  });

  it("unknown mode treated as show (default-safe)", () => {
    // Cast to simulate a runtime-supplied mode (e.g. stale config) that TS would reject.
    const unknown = redact("filename", "a.ts", "invalid" as unknown as RedactMode);
    expect(unknown).toBe("a.ts");
  });
});
