import { describe, it, expect, vi, beforeEach } from "vitest";

type RepoChangeCb = () => void;

const mockHeadName = { current: "main" as string | undefined };
void mockHeadName; // used in createMockRepo below via branch parameter
const repoChangeCallbacks: RepoChangeCb[] = [];
const repoChangeDisposable = { dispose: vi.fn() };

type MockRepo = {
  rootUri: { fsPath: string };
  state: {
    HEAD: { name: string | undefined } | undefined;
    onDidChange: (cb: RepoChangeCb) => { dispose: () => void };
  };
};

const createMockRepo = (rootPath: string, branch: string | undefined): MockRepo => ({
  rootUri: { fsPath: rootPath },
  state: {
    get HEAD() { return { name: branch }; },
    onDidChange: (cb: RepoChangeCb) => { repoChangeCallbacks.push(cb); return repoChangeDisposable; },
  },
});

const mockRepositories: MockRepo[] = [];
const mockGitApi = {
  get repositories() { return mockRepositories; },
  onDidOpenRepository: (_cb: unknown) => ({ dispose: vi.fn() }),
  onDidCloseRepository: (_cb: unknown) => ({ dispose: vi.fn() }),
};
const mockGitExports = { getAPI: (_v: 1) => mockGitApi };
let mockGitExtension: { isActive: boolean; exports: typeof mockGitExports; activate: () => Promise<typeof mockGitExports> } | undefined;

let mockActiveTextEditor: { document: { uri: { fsPath: string } } } | undefined;

vi.mock("vscode", () => ({
  window: {
    get activeTextEditor() { return mockActiveTextEditor; },
  },
  extensions: {
    getExtension: vi.fn(() => mockGitExtension),
  },
  Disposable: class {
    constructor(private fn: () => void) {}
    dispose() { this.fn(); }
    static from(...d: Array<{ dispose: () => void }>) {
      return { dispose: () => d.forEach((x) => x.dispose()) };
    }
  },
}));

import { createGitDetector } from "../src/detectors/git";

describe("git detector", () => {
  beforeEach(() => {
    mockRepositories.length = 0;
    repoChangeCallbacks.length = 0;
    repoChangeDisposable.dispose.mockClear();
    mockActiveTextEditor = undefined;
    mockGitExtension = {
      isActive: true,
      exports: mockGitExports,
      activate: vi.fn(async () => mockGitExports),
    };
  });

  it("dispatches branch-changed with Repository.state.HEAD.name on repository.state.onDidChange", async () => {
    mockRepositories.push(createMockRepo("/repo", "main"));
    const dispatch = vi.fn();
    createGitDetector(dispatch);
    await new Promise((r) => setTimeout(r, 0));  // let the async IIFE resolve
    // Initial dispatch fired once
    expect(dispatch).toHaveBeenCalledWith({ type: "branch-changed", branch: "main" });

    // Simulate a branch change
    mockRepositories[0] = createMockRepo("/repo", "feature/x");
    repoChangeCallbacks[0]();
    expect(dispatch).toHaveBeenLastCalledWith({ type: "branch-changed", branch: "feature/x" });
  });

  it("silent when getExtension('vscode.git') returns undefined (no crash, no toast, no dispatch)", async () => {
    mockGitExtension = undefined;
    const dispatch = vi.fn();
    const d = createGitDetector(dispatch);
    await new Promise((r) => setTimeout(r, 0));
    expect(dispatch).not.toHaveBeenCalled();
    // Dispose is a no-op (no subscriptions were attached)
    expect(() => d.dispose()).not.toThrow();
  });

  it("activates vscode.git extension when isActive=false and then reads getAPI(1)", async () => {
    mockGitExtension!.isActive = false;
    mockRepositories.push(createMockRepo("/repo", "develop"));
    const dispatch = vi.fn();
    createGitDetector(dispatch);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockGitExtension!.activate).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: "branch-changed", branch: "develop" });
  });

  it("multi-repo workspace: picks repository matching activeTextEditor.document.uri.fsPath, falls back to repositories[0]", async () => {
    mockRepositories.push(createMockRepo("/repoA", "mainA"));
    mockRepositories.push(createMockRepo("/repoB", "mainB"));
    mockActiveTextEditor = { document: { uri: { fsPath: "/repoB/src/index.ts" } } };
    const dispatch = vi.fn();
    createGitDetector(dispatch);
    await new Promise((r) => setTimeout(r, 0));
    expect(dispatch).toHaveBeenCalledWith({ type: "branch-changed", branch: "mainB" });

    // Now with no active editor — falls back to repositories[0]
    dispatch.mockClear();
    mockActiveTextEditor = undefined;
    // Trigger a change on repoA to force dispatchBranch path
    repoChangeCallbacks[0]();  // repoA's onDidChange callback
    expect(dispatch).toHaveBeenCalledWith({ type: "branch-changed", branch: "mainA" });
  });

  it("wraps all reads in try/catch; read failure produces no dispatch (silent swallow, D-18)", async () => {
    // Make onDidChange throw to simulate a reader failure (post-initial).
    const throwingRepo: MockRepo = {
      rootUri: { fsPath: "/broken" },
      state: {
        get HEAD(): { name: string | undefined } | undefined { throw new Error("boom"); },
        onDidChange: (cb: RepoChangeCb) => { repoChangeCallbacks.push(cb); return repoChangeDisposable; },
      },
    };
    mockRepositories.push(throwingRepo);
    const dispatch = vi.fn();
    // Should not throw during construction or initial dispatch
    expect(() => createGitDetector(dispatch)).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    // Initial dispatch attempted but HEAD read threw — silent no-op
    expect(dispatch).not.toHaveBeenCalled();
  });
});
