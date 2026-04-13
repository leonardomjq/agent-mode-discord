import { describe, it, expect, vi, beforeEach } from "vitest";

let mockActiveTextEditor: { document: { uri: { fsPath: string }; languageId: string } } | undefined = undefined;
const mockOnDidChangeDisposable = { dispose: vi.fn() };
let mockOnDidChangeCallback: ((editor: unknown) => void) | null = null;

vi.mock("vscode", () => ({
  window: {
    get activeTextEditor() { return mockActiveTextEditor; },
    onDidChangeActiveTextEditor: (cb: (editor: unknown) => void) => {
      mockOnDidChangeCallback = cb;
      return mockOnDidChangeDisposable;
    },
  },
  Disposable: {
    from: (...disposables: Array<{ dispose: () => void }>) => ({
      dispose: () => disposables.forEach((d) => d.dispose?.()),
    }),
  },
}));

import { createEditorDetector } from "../src/detectors/editor";

describe("editor detector", () => {
  beforeEach(() => {
    mockActiveTextEditor = undefined;
    mockOnDidChangeCallback = null;
    mockOnDidChangeDisposable.dispose.mockClear();
  });

  it("dispatches editor-changed on construction when activeTextEditor is set", () => {
    mockActiveTextEditor = {
      document: { uri: { fsPath: "/home/leo/proj/src/a.ts" }, languageId: "typescript" },
    };
    const dispatch = vi.fn();
    createEditorDetector(dispatch);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "editor-changed",
      filename: "a.ts",
      language: "typescript",
    });
  });

  it("dispatches editor-closed on construction when activeTextEditor is undefined", () => {
    mockActiveTextEditor = undefined;
    const dispatch = vi.fn();
    createEditorDetector(dispatch);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: "editor-closed" });
  });

  it("dispatches editor-changed with filename + languageId when onDidChangeActiveTextEditor fires", () => {
    const dispatch = vi.fn();
    createEditorDetector(dispatch);
    dispatch.mockClear(); // clear the construction-time seed call
    expect(mockOnDidChangeCallback).not.toBeNull();
    mockOnDidChangeCallback!({
      document: { uri: { fsPath: "C:\\Users\\leo\\proj\\index.js" }, languageId: "javascript" },
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "editor-changed",
      filename: "index.js", // Windows path separator handled
      language: "javascript",
    });
  });

  it("dispatches editor-closed when onDidChangeActiveTextEditor fires with undefined", () => {
    mockActiveTextEditor = {
      document: { uri: { fsPath: "/a.ts" }, languageId: "typescript" },
    };
    const dispatch = vi.fn();
    createEditorDetector(dispatch);
    dispatch.mockClear();
    mockOnDidChangeCallback!(undefined);
    expect(dispatch).toHaveBeenCalledWith({ type: "editor-closed" });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("returned Disposable removes all subscriptions when dispose() is called", () => {
    const dispatch = vi.fn();
    const detector = createEditorDetector(dispatch);
    detector.dispose();
    expect(mockOnDidChangeDisposable.dispose).toHaveBeenCalledTimes(1);
  });
});
