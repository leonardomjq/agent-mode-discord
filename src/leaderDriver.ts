/**
 * Phase 05.2 Plan 02 — Leader bootstrap helper extracted from extension.ts
 * to keep extension.ts under 220 lines per PROJECT.md file-size guideline.
 *
 * `bootstrapLeader` contains the full Discord presence driver setup that was
 * previously the inline body of createDriver(). It is invoked only when this
 * VS Code window acquires (or takes over) leadership (D-05, D-10).
 */

import * as vscode from "vscode";
import type { SetActivity } from "@xhayper/discord-rpc";
import {
  createConnectionManager,
  realBackoffDeps,
  registerSignalHandlers,
  clearActivity as rpcClearActivity,
  type ConnectionManager,
} from "./rpc/client";
import { createThrottle } from "./rpc/throttle";
import { initialState, reduce } from "./state/machine";
import type { Event, State } from "./state/types";
import { createEditorDetector } from "./detectors/editor";
import { createGitDetector } from "./detectors/git";
import { createDetectorsOrchestrator } from "./detectors";
import type { Pack } from "./presence/types";
import { loadPack, realPackLoaderDeps, BUILTIN_GOBLIN_PACK } from "./presence/packLoader";
import { createActivityBuilder } from "./presence/activityBuilder";
import { readConfig } from "./config";
import { log, setVerboseCache } from "./outputChannel";
import { getCurrentBranch } from "./gitBranch";
import { normalizeGitUrl } from "./privacy";

/** Phase 2 hardcodes idleMs (per D-05 + Pitfall 8); Phase 4 wires config read. */
export const IDLE_MS = 300_000;
export const THROTTLE_MS = 2_000;

/** Extract host segment from a normalized git URL ("github.com/owner/repo" -> "github.com"). */
export function extractHost(url: string): string | undefined {
  const norm = normalizeGitUrl(url);
  const host = norm.split("/")[0];
  return host || undefined;
}

/** Extract owner segment from a normalized git URL ("github.com/owner/repo" -> "owner"). */
export function extractOwner(url: string): string | undefined {
  const norm = normalizeGitUrl(url);
  const owner = norm.split("/")[1];
  return owner || undefined;
}

/**
 * Mutable context shared between createDriver() and bootstrapLeader().
 * All fields are undefined until bootstrapLeader() sets them (follower windows
 * never set them — their dispose path guards each with optional chaining).
 */
export interface DriverCtx {
  shuttingDown: boolean;
  bootstrapped: boolean;
  mgr: ConnectionManager | undefined;
  activityBuilder: { start: () => void; stop: () => void; forceTick: () => void } | undefined;
  configListener: vscode.Disposable | undefined;
  editorDisposable: vscode.Disposable | undefined;
  gitDisposable: vscode.Disposable | undefined;
  detectorsDisposable: vscode.Disposable | undefined;
  unregisterSignals: (() => void) | undefined;
  idleTimer: NodeJS.Timeout | null;
  state: State;
}

/** Create an empty driver context with default values. */
export function createDriverCtx(): DriverCtx {
  return {
    shuttingDown: false,
    bootstrapped: false,
    mgr: undefined,
    activityBuilder: undefined,
    configListener: undefined,
    editorDisposable: undefined,
    gitDisposable: undefined,
    detectorsDisposable: undefined,
    unregisterSignals: undefined,
    idleTimer: null,
    state: initialState(),
  };
}

/**
 * Bootstrap the full Discord presence driver for the leader window.
 * Idempotent via ctx.bootstrapped flag (T-05.2-05).
 * Starts from IDLE state — D-06 (no state replay from a prior leader process).
 */
export function bootstrapLeader(
  ctx: DriverCtx,
  bootCfg: ReturnType<typeof readConfig>,
  _context: vscode.ExtensionContext,
): void {
  if (ctx.bootstrapped) return;
  ctx.bootstrapped = true;

  // Fresh state for this leader epoch (D-06 — no state replay from a prior leader).
  ctx.state = initialState();
  ctx.idleTimer = null;

  ctx.mgr = createConnectionManager(bootCfg.clientId, process.pid, realBackoffDeps);

  // Phase-2 throttle still wraps the RPC setActivity call (2 s leading+trailing).
  const throttledSet = createThrottle<SetActivity>(
    (payload) => { void ctx.mgr!.setActivity(payload); },
    THROTTLE_MS,
  );
  const onSet = (payload: SetActivity): void => throttledSet(payload);
  const onClear = (): void => {
    const live = ctx.mgr!.getLiveClient();
    if (live) void rpcClearActivity(live, process.pid);
  };

  // Pack resolver: poll custom pack on every rotation tick (D-25, PERS-07).
  // packLoader falls back to BUILTIN_GOBLIN_PACK on any fs/validation error.
  const getPack = (): Pack => {
    const cfg = readConfig();
    return loadPack(
      { customPackPath: cfg.messages.customPackPath, builtin: BUILTIN_GOBLIN_PACK },
      {
        ...realPackLoaderDeps,
        log: (line) => log(line, { verboseOnly: true }),
      },
    );
  };

  ctx.activityBuilder = createActivityBuilder({
    getState: () => ctx.state,
    getConfig: () => readConfig(),
    getPack,
    onSet,
    onClear,
    // State.gitRemoteUrl is not populated yet (Phase-2 git detector tracks
    // branch only); until a future plan threads the remote URL through, the
    // repositories/organizations/gitHosts ignore branches won't fire.
    getIgnoreContext: () => {
      const anyState = ctx.state as State & { gitRemoteUrl?: string };
      const remote = anyState.gitRemoteUrl;
      return {
        workspaceAbsPath: ctx.state.workspace,
        gitRemoteUrl: remote,
        gitHost: remote ? extractHost(remote) : undefined,
        gitOwner: remote ? extractOwner(remote) : undefined,
      };
    },
    log: (msg) => log(msg, { verboseOnly: true }),
  });

  const scheduleIdle = (): void => {
    if (ctx.idleTimer) { clearTimeout(ctx.idleTimer); ctx.idleTimer = null; }
    if (ctx.state.kind === "CODING") {
      ctx.idleTimer = setTimeout(() => {
        if (ctx.shuttingDown) return;
        dispatch({ type: "idle-tick" });
      }, IDLE_MS);
    }
  };

  const dispatch = (event: Event): void => {
    if (ctx.shuttingDown) return;
    try {
      const prev = ctx.state;
      ctx.state = reduce(ctx.state, event);
      scheduleIdle();
      if (ctx.state.kind !== prev.kind) {
        // State-kind transition: render immediately with the current branch,
        // then async-refresh via vscode.git and re-render. Worst-case branch
        // is one-tick stale on the transition boundary (PRIV-06 accepts this).
        // ME-01: capture the kind we resolved the branch for; if a concurrent
        // dispatch() flipped state.kind while getCurrentBranch() was in-flight,
        // skip the merge so we don't clobber the fresher reducer output with
        // a stale branch snapshot.
        const transitionKind = ctx.state.kind;
        void getCurrentBranch((msg) => log(msg, { verboseOnly: true })).then((branch) => {
          if (ctx.shuttingDown) return;
          if (ctx.state.kind !== transitionKind) return;
          ctx.state = { ...ctx.state, branch } as State;
          ctx.activityBuilder!.forceTick();
        });
        ctx.activityBuilder!.forceTick();
      }
    } catch {
      /* silent per D-18 */
    }
  };

  // Reconnect replay (RPC-04 / D-12) — replays current state through the
  // activityBuilder pipeline (replaces Phase-2 hardcoded payload).
  ctx.mgr.onReady(() => {
    if (ctx.shuttingDown) return;
    if (!ctx.unregisterSignals) {
      const live = ctx.mgr!.getLiveClient();
      if (live) ctx.unregisterSignals = registerSignalHandlers(live, process.pid);
    }
    ctx.activityBuilder!.forceTick();
  });

  // Config-change listener (CONF-03 / D-24). No-op beyond a debug log + an
  // optional forceTick — readConfig() is lazy on every rotation tick, so
  // there's no cache to invalidate.
  ctx.configListener = vscode.workspace.onDidChangeConfiguration((e) => {
    if (!e.affectsConfiguration("agentMode")) return;
    // ME-03: refresh the verbose cache on every agentMode.* change so the
    // gate stays aligned with user settings without a per-log config read.
    try { setVerboseCache(readConfig().debug.verbose); } catch { /* silent */ }
    log(`[config] change detected at ${new Date().toISOString()}`, { verboseOnly: true });
    ctx.activityBuilder!.forceTick();
  });
  _context.subscriptions.push(ctx.configListener);

  // Detectors
  ctx.editorDisposable = createEditorDetector(dispatch);
  ctx.gitDisposable = createGitDetector(dispatch);
  ctx.detectorsDisposable = createDetectorsOrchestrator(dispatch, {
    customPatterns: bootCfg.detect.customPatterns,
    sessionFileStalenessSeconds: bootCfg.detect.sessionFileStalenessSeconds,
  });

  ctx.mgr.start();
  ctx.activityBuilder.start();
}
