import { describe, it, vi } from "vitest";

vi.mock("vscode", () => ({
  window: {
    activeTextEditor: undefined,
    onDidChangeActiveTextEditor: vi.fn(),
  },
  Disposable: {
    from: vi.fn((...d: Array<{ dispose?: () => void }>) => ({
      dispose: () => d.forEach((x) => x.dispose?.()),
    })),
  },
}));

describe("editor detector", () => {
  it.todo("dispatches editor-changed on construction when activeTextEditor is set");
  it.todo("dispatches editor-closed on construction when activeTextEditor is undefined");
  it.todo("dispatches editor-changed with filename + languageId when onDidChangeActiveTextEditor fires");
  it.todo("dispatches editor-closed when onDidChangeActiveTextEditor fires with undefined");
  it.todo("returned Disposable removes all subscriptions when dispose() is called");
});
