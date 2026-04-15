/**
 * vscode.git-backed branch reader (PRIV-03/PRIV-04).
 *
 * Adapter module — imports `vscode`, therefore NOT pure-core. The activity
 * builder (04-04) and extension wiring (04-08) call this on state-transition
 * to populate `ctx.tokens.branch`.
 *
 * D-18: every access wrapped in try/catch; silent degrade to empty-string
 * on any failure (missing extension, inactive extension, getAPI throw,
 * empty repositories). Debug-channel logging only — never throws, never
 * toasts.
 *
 * Pitfall 3: if the git extension is installed but not yet active, await
 * `ext.activate()` before calling `getAPI(1)`.
 */
import * as vscode from "vscode";

// Minimal subset of the vscode.git extension's API surface we consume.
interface GitAPI {
  repositories: Array<{
    state: { HEAD?: { name?: string } };
  }>;
}

export async function getCurrentBranch(
  logger?: (msg: string) => void,
): Promise<string> {
  try {
    const ext = vscode.extensions.getExtension("vscode.git");
    if (!ext) {
      logger?.("[git] vscode.git extension not installed");
      return "";
    }
    let api: GitAPI | undefined;
    if (ext.isActive) {
      api = ext.exports?.getAPI?.(1) as GitAPI | undefined;
    } else {
      await ext.activate();
      api = ext.exports?.getAPI?.(1) as GitAPI | undefined;
    }
    if (!api || !Array.isArray(api.repositories) || api.repositories.length === 0) {
      return "";
    }
    const head = api.repositories[0]?.state?.HEAD;
    return head?.name ?? "";
  } catch (err) {
    logger?.(`[git] API unavailable: ${String(err)}`);
    return "";
  }
}
