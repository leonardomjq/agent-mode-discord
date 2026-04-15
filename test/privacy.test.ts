import { describe, it, expect } from "vitest";
import {
  redact,
  hashWorkspace,
  normalizeForHash,
  type RedactMode,
} from "../src/privacy";

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

  it("mode=hash on workspace returns 6-hex SHA-1 prefix (PRIV-01, D-15)", () => {
    const h = redact("workspace", "/Users/leo/my-repo", "hash");
    expect(h).toMatch(/^[0-9a-f]{6}$/);
  });

  it("mode=hash on filename or branch throws (PRIV-02/PRIV-03: only workspace hashes)", () => {
    expect(() => redact("filename", "a.ts", "hash")).toThrow(/only supported for workspace/);
    expect(() => redact("branch", "main", "hash")).toThrow(/only supported for workspace/);
  });

  it("unknown mode treated as show (default-safe)", () => {
    const unknown = redact("filename", "a.ts", "invalid" as unknown as RedactMode);
    expect(unknown).toBe("a.ts");
  });
});

describe("privacy.hashWorkspace / normalizeForHash (D-15)", () => {
  it("hashWorkspace returns 6 lowercase hex chars", () => {
    const h = hashWorkspace("/Users/leo/my-repo", "darwin");
    expect(h).toMatch(/^[0-9a-f]{6}$/);
    expect(h.length).toBe(6);
  });

  it("deterministic: same path → same 6-hex SHA-1 prefix across 1000 calls", () => {
    const first = hashWorkspace("/Users/leo/my-repo", "darwin");
    for (let i = 0; i < 1000; i++) {
      expect(hashWorkspace("/Users/leo/my-repo", "darwin")).toBe(first);
    }
  });

  it("different paths hash differently", () => {
    const a = hashWorkspace("/Users/leo/my-repo", "darwin");
    const b = hashWorkspace("/Users/leo/other-repo", "darwin");
    expect(a).not.toBe(b);
  });

  it("normalizeForHash: path.resolve canonicalizes .. segments (darwin)", () => {
    expect(hashWorkspace("/a/b/../c", "darwin")).toBe(hashWorkspace("/a/c", "darwin"));
  });

  it("normalizeForHash: win32 lowercases drive letter and uses forward slashes", () => {
    const out = normalizeForHash("C:\\Users\\leo\\project", "win32");
    expect(out.startsWith("c:/")).toBe(true);
    expect(out.includes("\\")).toBe(false);
  });

  it("normalizeForHash: win32 leaves non-drive-letter casing alone (D-15)", () => {
    const out = normalizeForHash("c:\\Users\\Leo\\Project", "win32");
    expect(out).toContain("Users");
    expect(out).toContain("Leo");
    expect(out).toContain("Project");
  });

  it("normalizeForHash: darwin does NOT touch casing", () => {
    const out = normalizeForHash("/Users/Leo/Project", "darwin");
    expect(out).toBe("/Users/Leo/Project");
  });

  it("hashWorkspace does not resolve symlinks — path differs, hash differs (T-04-08 accept)", () => {
    const real = hashWorkspace("/Users/leo/project", "darwin");
    const link = hashWorkspace("/Users/leo/symlink-to-project", "darwin");
    expect(real).not.toBe(link);
  });

  it("redact('workspace', '', 'hash') does not throw — hash of normalized empty still deterministic", () => {
    const first = redact("workspace", "", "hash");
    const second = redact("workspace", "", "hash");
    expect(first).toMatch(/^[0-9a-f]{6}$/);
    expect(first).toBe(second);
  });
});
