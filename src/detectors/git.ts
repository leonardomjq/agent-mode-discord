import * as vscode from "vscode";
import type { Event } from "../state/types";

// Minimal subset of vscode.git's API v1 we rely on.
interface GitBranch { name?: string; }
interface GitRepositoryState {
  readonly HEAD: GitBranch | undefined;
  readonly onDidChange: vscode.Event<void>;
}
interface GitRepository {
  readonly rootUri: vscode.Uri;
  readonly state: GitRepositoryState;
}
interface GitAPI {
  readonly repositories: GitRepository[];
  readonly onDidOpenRepository: vscode.Event<GitRepository>;
  readonly onDidCloseRepository: vscode.Event<GitRepository>;
}
interface GitExtensionExports {
  getAPI(version: 1): GitAPI;
}

/**
 * Phase 2 git detector.
 *
 * Subscribes to vscode.git Extension API v1. Dispatches branch-changed
 * events on repository.state.onDidChange. Handles multi-repo workspaces
 * by picking the repository matching window.activeTextEditor's path,
 * falling back to repositories[0] (Pitfall 4).
 *
 * Pitfall 3: activates the git extension if isActive=false.
 * D-18: try/catch everywhere, silent swallow.
 *
 * If vscode.git is not installed (very rare), detector is a no-op — it
 * returns an empty Disposable and never dispatches.
 */
export function createGitDetector(dispatch: (event: Event) => void): vscode.Disposable {
  const disposables: vscode.Disposable[] = [];
  const perRepoDisposables = new Map<GitRepository, vscode.Disposable>();

  const pickRepository = (api: GitAPI): GitRepository | undefined => {
    try {
      const activePath = vscode.window.activeTextEditor?.document.uri.fsPath;
      if (activePath) {
        const match = api.repositories.find((r) => activePath.startsWith(r.rootUri.fsPath));
        if (match) return match;
      }
    } catch { /* silent */ }
    return api.repositories[0];
  };

  const dispatchBranch = (api: GitAPI): void => {
    try {
      const repo = pickRepository(api);
      const branch = repo?.state.HEAD?.name;
      dispatch({ type: "branch-changed", branch });
    } catch { /* silent per D-18 */ }
  };

  const attach = (api: GitAPI, repo: GitRepository): void => {
    if (perRepoDisposables.has(repo)) return;
    try {
      const sub = repo.state.onDidChange(() => dispatchBranch(api));
      perRepoDisposables.set(repo, sub);
    } catch { /* silent */ }
  };

  const detachAll = (): void => {
    for (const [, sub] of perRepoDisposables) {
      try { sub.dispose(); } catch { /* silent */ }
    }
    perRepoDisposables.clear();
  };

  void (async () => {
    try {
      const ext = vscode.extensions.getExtension<GitExtensionExports>("vscode.git");
      if (!ext) return;  // git extension not installed — silent no-op
      const exports = ext.isActive ? ext.exports : await ext.activate();
      const api = exports.getAPI(1);

      // Subscribe to current repositories
      for (const repo of api.repositories) attach(api, repo);
      // Dispatch initial branch once
      dispatchBranch(api);

      // Track repo lifecycle
      disposables.push(api.onDidOpenRepository((repo) => {
        attach(api, repo);
        dispatchBranch(api);
      }));
      disposables.push(api.onDidCloseRepository((repo) => {
        const sub = perRepoDisposables.get(repo);
        if (sub) { try { sub.dispose(); } catch { /* silent */ } perRepoDisposables.delete(repo); }
        dispatchBranch(api);
      }));
    } catch {
      /* silent per D-18: if git extension throws during activate or getAPI, detector is a no-op */
    }
  })();

  return new vscode.Disposable(() => {
    detachAll();
    for (const d of disposables) { try { d.dispose(); } catch { /* silent */ } }
  });
}
