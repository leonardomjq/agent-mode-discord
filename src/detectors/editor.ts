import * as vscode from "vscode";
import type { Event } from "../state/types";

/**
 * Phase 2 editor detector.
 *
 * Subscribes to vscode.window.onDidChangeActiveTextEditor and dispatches
 * editor-changed / editor-closed events into the driver's reducer pipeline.
 * Fires once on construction from `activeTextEditor` — the event itself
 * does NOT re-fire the initial state (VERIFIED: VS Code API docs,
 * RESEARCH Example 6).
 *
 * Pitfall 1 (RESEARCH): onDidChangeActiveTextEditor fires with `undefined`
 * when focus moves to non-editor surfaces (terminal, search, Output panel).
 * We dispatch `editor-closed`; the reducer treats it as a no-op. Only the
 * driver's idle timer (02-07) transitions CODING → IDLE after idleTimeoutSeconds.
 *
 * D-18: try/catch everything, silent-swallow on failure.
 * STATE-01 / STATE-02 entry points.
 */
export function createEditorDetector(dispatch: (event: Event) => void): vscode.Disposable {
  const disposables: vscode.Disposable[] = [];

  const pushFromEditor = (editor: vscode.TextEditor | undefined): void => {
    try {
      if (!editor) {
        dispatch({ type: "editor-closed" });
        return;
      }
      const { document } = editor;
      const fileName = document.uri.fsPath.split(/[\\/]/).pop() ?? "";
      dispatch({
        type: "editor-changed",
        filename: fileName,
        language: document.languageId,
      });
    } catch {
      /* silent per PRD §8 / D-18 */
    }
  };

  // Seed: read current state once — the event won't re-fire it on startup.
  pushFromEditor(vscode.window.activeTextEditor);

  disposables.push(
    vscode.window.onDidChangeActiveTextEditor(pushFromEditor),
  );

  return vscode.Disposable.from(...disposables);
}
