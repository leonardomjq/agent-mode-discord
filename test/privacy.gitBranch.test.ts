/**
 * Phase-4 tests for the vscode.git-backed branch reader (04-07).
 *
 * Requirements: PRIV-03, PRIV-04
 * Decisions:    D-18 (silent degrade via try/catch + async-activation handling)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Repo = { state: { HEAD?: { name?: string } } };
let mockApi: { repositories: Repo[] } | undefined;
let mockGetAPIThrows = false;
let mockExtension:
  | {
      isActive: boolean;
      exports: { getAPI: (v: 1) => unknown };
      activate: () => Promise<{ getAPI: (v: 1) => unknown }>;
    }
  | undefined;

vi.mock("vscode", () => ({
  extensions: {
    getExtension: vi.fn(() => mockExtension),
  },
}));

import { getCurrentBranch } from "../src/gitBranch";

const makeExports = () => ({
  getAPI: (_v: 1) => {
    if (mockGetAPIThrows) throw new Error("getAPI exploded");
    return mockApi;
  },
});

describe("gitBranch reader", () => {
  beforeEach(() => {
    mockGetAPIThrows = false;
    mockApi = { repositories: [{ state: { HEAD: { name: "main" } } }] };
    mockExtension = {
      isActive: true,
      exports: makeExports(),
      activate: vi.fn(async () => makeExports()),
    };
  });

  it("reads current branch via getAPI(1) when extension is active (PRIV-03)", async () => {
    const branch = await getCurrentBranch();
    expect(branch).toBe("main");
  });

  it("awaits ext.activate() when extension is installed but not yet active (Pitfall 3)", async () => {
    mockExtension!.isActive = false;
    // activate() must be called and resolved before getAPI
    mockExtension!.activate = vi.fn(async () => {
      mockExtension!.isActive = true;
      mockExtension!.exports = makeExports();
      return mockExtension!.exports;
    });
    const branch = await getCurrentBranch();
    expect(mockExtension!.activate).toHaveBeenCalledTimes(1);
    expect(branch).toBe("main");
  });

  it("returns empty string when vscode.git extension is missing (PRIV-04)", async () => {
    mockExtension = undefined;
    const logs: string[] = [];
    const branch = await getCurrentBranch((m) => logs.push(m));
    expect(branch).toBe("");
    expect(logs.some((l) => /not installed|extension/i.test(l))).toBe(true);
  });

  it("returns empty string + logs debug when getAPI throws (PRIV-04 / D-18)", async () => {
    mockGetAPIThrows = true;
    mockExtension!.exports = makeExports();
    const logs: string[] = [];
    const branch = await getCurrentBranch((m) => logs.push(m));
    expect(branch).toBe("");
    expect(logs.some((l) => /unavailable|error|API/i.test(l))).toBe(true);
  });

  it("returns empty string when api.repositories is empty", async () => {
    mockApi = { repositories: [] };
    const branch = await getCurrentBranch();
    expect(branch).toBe("");
  });

  it("returns empty string when api.repositories[0].state.HEAD is undefined", async () => {
    mockApi = { repositories: [{ state: {} }] };
    const branch = await getCurrentBranch();
    expect(branch).toBe("");
  });

  it("is idempotent under concurrent calls (3× concurrent resolve without crash)", async () => {
    const results = await Promise.all([
      getCurrentBranch(),
      getCurrentBranch(),
      getCurrentBranch(),
    ]);
    expect(results).toEqual(["main", "main", "main"]);
  });
});
