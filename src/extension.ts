import * as vscode from "vscode";
import { readConfig } from "./config";
import { log, setVerboseCache } from "./outputChannel";
import { createLeadership } from "./state/leadership";
import { bootstrapLeader, createDriverCtx } from "./leaderDriver";

interface Driver {
  dispose: () => Promise<void>;
}

let driver: Driver | undefined;

export function activate(_context: vscode.ExtensionContext): void {
  driver = createDriver(_context);
  _context.subscriptions.push({ dispose: async () => { await driver?.dispose(); } });
}

export async function deactivate(): Promise<void> {
  await driver?.dispose();
  driver = undefined;
}

function createDriver(_context: vscode.ExtensionContext): Driver {
  const ctx = createDriverCtx();
  const bootCfg = readConfig();

  // ME-03: prime the debug.verbose cache so log() avoids a config read per line.
  try { setVerboseCache(bootCfg.debug.verbose); } catch { /* silent */ }

  // D-13: leadership instance with verbose log sink.
  const leadership = createLeadership({ log: (m) => log(m, { verboseOnly: true }) });

  // Idempotent gate: guards against double-fire if acquire() and onTakeover race (T-05.2-05).
  function bootstrapAsLeader(): void {
    bootstrapLeader(ctx, bootCfg, _context);
  }

  // ── Leadership acquire — fire-and-forget (D-10, T-05.2-05) ───────────────────
  // activate() must NOT become async; acquire() promise handled via .then().
  void leadership.acquire().then((isLeader) => {
    if (ctx.shuttingDown) return;
    if (isLeader) {
      log("[leadership] acquired — bootstrapping as leader", { verboseOnly: true });
      bootstrapAsLeader();
    } else {
      log("[leadership] held by another window — this window is a follower", { verboseOnly: true });
      // D-05: lazy bootstrap fires only on stale-leader takeover.
      leadership.onTakeover(() => {
        if (ctx.shuttingDown) return;
        log("[leadership] taken over from stale leader — bootstrapping", { verboseOnly: true });
        bootstrapAsLeader();
      });
    }
  }).catch(() => { /* silent per D-18 */ });

  return {
    dispose: async () => {
      ctx.shuttingDown = true;
      if (ctx.idleTimer) { clearTimeout(ctx.idleTimer); ctx.idleTimer = null; }
      // Release leadership first (safe no-op if this window was a follower — D-07).
      await leadership.release();
      // Teardown only runs if bootstrapped (followers have no RPC resources to clean up).
      if (ctx.bootstrapped) {
        try { ctx.activityBuilder?.stop(); } catch { /* silent */ }
        try { ctx.configListener?.dispose(); } catch { /* silent */ }
        try { ctx.editorDisposable?.dispose(); } catch { /* silent */ }
        try { ctx.gitDisposable?.dispose(); } catch { /* silent */ }
        try { ctx.detectorsDisposable?.dispose(); } catch { /* silent */ }
        if (ctx.unregisterSignals) {
          try { ctx.unregisterSignals(); } catch { /* silent */ }
          ctx.unregisterSignals = undefined;
        }
        await ctx.mgr?.stop();
      }
    },
  };
}
