import * as vscode from "vscode";
import type { SetActivity } from "@xhayper/discord-rpc";
import {
  DEFAULT_CLIENT_ID,
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
const IDLE_MS = 300_000;
const THROTTLE_MS = 2_000;

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

/** Extract host segment from a normalized git URL ("github.com/owner/repo" -> "github.com"). */
function extractHost(url: string): string | undefined {
  const norm = normalizeGitUrl(url);
  const host = norm.split("/")[0];
  return host || undefined;
}

/** Extract owner segment from a normalized git URL ("github.com/owner/repo" -> "owner"). */
function extractOwner(url: string): string | undefined {
  const norm = normalizeGitUrl(url);
  const owner = norm.split("/")[1];
  return owner || undefined;
}

function createDriver(_context: vscode.ExtensionContext): Driver {
  let shuttingDown = false;
  let state: State = initialState();
  let idleTimer: NodeJS.Timeout | null = null;
  let unregisterSignals: (() => void) | undefined;

  // ME-03: prime the debug.verbose cache so log() avoids a config read per line.
  try { setVerboseCache(readConfig().debug.verbose); } catch { /* silent */ }

  const mgr: ConnectionManager = createConnectionManager(DEFAULT_CLIENT_ID, process.pid, realBackoffDeps);

  // Phase-2 throttle still wraps the RPC setActivity call (2 s leading+trailing).
  const throttledSet = createThrottle<SetActivity>(
    (payload) => { void mgr.setActivity(payload); },
    THROTTLE_MS,
  );
  const onSet = (payload: SetActivity): void => throttledSet(payload);
  const onClear = (): void => {
    const live = mgr.getLiveClient();
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

  const activityBuilder = createActivityBuilder({
    getState: () => state,
    getConfig: () => readConfig(),
    getPack,
    onSet,
    onClear,
    // State.gitRemoteUrl is not populated yet (Phase-2 git detector tracks
    // branch only); until a future plan threads the remote URL through, the
    // repositories/organizations/gitHosts ignore branches won't fire.
    getIgnoreContext: () => {
      const anyState = state as State & { gitRemoteUrl?: string };
      const remote = anyState.gitRemoteUrl;
      return {
        workspaceAbsPath: state.workspace,
        gitRemoteUrl: remote,
        gitHost: remote ? extractHost(remote) : undefined,
        gitOwner: remote ? extractOwner(remote) : undefined,
      };
    },
    log: (msg) => log(msg, { verboseOnly: true }),
  });

  const scheduleIdle = (): void => {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    if (state.kind === "CODING") {
      idleTimer = setTimeout(() => {
        if (shuttingDown) return;
        dispatch({ type: "idle-tick" });
      }, IDLE_MS);
    }
  };

  const dispatch = (event: Event): void => {
    if (shuttingDown) return;
    try {
      const prev = state;
      state = reduce(state, event);
      scheduleIdle();
      if (state.kind !== prev.kind) {
        // State-kind transition: render immediately with the current branch,
        // then async-refresh via vscode.git and re-render. Worst-case branch
        // is one-tick stale on the transition boundary (PRIV-06 accepts this).
        // ME-01: capture the kind we resolved the branch for; if a concurrent
        // dispatch() flipped state.kind while getCurrentBranch() was in-flight,
        // skip the merge so we don't clobber the fresher reducer output with
        // a stale branch snapshot.
        const transitionKind = state.kind;
        void getCurrentBranch((msg) => log(msg, { verboseOnly: true })).then((branch) => {
          if (shuttingDown) return;
          if (state.kind !== transitionKind) return;
          state = { ...state, branch } as State;
          activityBuilder.forceTick();
        });
        activityBuilder.forceTick();
      }
    } catch {
      /* silent per D-18 */
    }
  };

  // Reconnect replay (RPC-04 / D-12) — replays current state through the
  // activityBuilder pipeline (replaces Phase-2 hardcoded payload).
  mgr.onReady(() => {
    if (shuttingDown) return;
    if (!unregisterSignals) {
      const live = mgr.getLiveClient();
      if (live) unregisterSignals = registerSignalHandlers(live, process.pid);
    }
    activityBuilder.forceTick();
  });

  // Config-change listener (CONF-03 / D-24). No-op beyond a debug log + an
  // optional forceTick — readConfig() is lazy on every rotation tick, so
  // there's no cache to invalidate.
  const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
    if (!e.affectsConfiguration("agentMode")) return;
    // ME-03: refresh the verbose cache on every agentMode.* change so the
    // gate stays aligned with user settings without a per-log config read.
    try { setVerboseCache(readConfig().debug.verbose); } catch { /* silent */ }
    log(`[config] change detected at ${new Date().toISOString()}`, { verboseOnly: true });
    activityBuilder.forceTick();
  });
  _context.subscriptions.push(configListener);

  // Detectors
  const editorDisposable = createEditorDetector(dispatch);
  const gitDisposable = createGitDetector(dispatch);
  const detectorsDisposable = createDetectorsOrchestrator(dispatch);

  mgr.start();
  activityBuilder.start();

  return {
    dispose: async () => {
      shuttingDown = true;
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
      try { activityBuilder.stop(); } catch { /* silent */ }
      try { configListener.dispose(); } catch { /* silent */ }
      try { editorDisposable.dispose(); } catch { /* silent */ }
      try { gitDisposable.dispose(); } catch { /* silent */ }
      try { detectorsDisposable.dispose(); } catch { /* silent */ }
      if (unregisterSignals) {
        try { unregisterSignals(); } catch { /* silent */ }
        unregisterSignals = undefined;
      }
      await mgr.stop();
    },
  };
}
