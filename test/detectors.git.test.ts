import { describe, it, vi } from "vitest";

vi.mock("vscode", () => ({
  extensions: {
    getExtension: vi.fn(),
  },
  Disposable: {
    from: vi.fn(() => ({ dispose: vi.fn() })),
  },
}));

describe("git detector", () => {
  it.todo("dispatches branch-changed with Repository.state.HEAD.name on repository.state.onDidChange");
  it.todo("silent when getExtension('vscode.git') returns undefined (no crash, no toast, no dispatch)");
  it.todo("activates vscode.git extension when isActive=false and then reads getAPI(1)");
  it.todo("multi-repo workspace: picks repository matching activeTextEditor.document.uri.fsPath, falls back to repositories[0]");
  it.todo("wraps all reads in try/catch; read failure produces no dispatch (silent swallow, D-18)");
});
