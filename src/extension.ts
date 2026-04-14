import * as vscode from "vscode";
import type { SetActivity } from "@xhayper/discord-rpc";
import {
  DEFAULT_CLIENT_ID,
  createConnectionManager,
  realBackoffDeps,
  registerSignalHandlers,
  type ConnectionManager,
} from "./rpc/client";
import { createThrottle } from "./rpc/throttle";
import { initialState, reduce } from "./state/machine";
import { buildContext } from "./state/context";
import type { Event, State } from "./state/types";
import { redact } from "./privacy";
import { createEditorDetector } from "./detectors/editor";
import { createGitDetector } from "./detectors/git";
import { createDetectorsOrchestrator } from "./detectors";

/** Phase 2 hardcodes idleMs (per D-05 + Pitfall 8); Phase 4 wires config read. */
const IDLE_MS = 300_000;
const THROTTLE_MS = 2_000;

interface Driver {
  dispose: () => Promise<void>;
}

let driver: Driver | undefined;

export function activate(_context: vscode.ExtensionContext): void {
  driver = createDriver();
  _context.subscriptions.push({ dispose: async () => { await driver?.dispose(); } });
}

export async function deactivate(): Promise<void> {
  await driver?.dispose();
  driver = undefined;
}

function createDriver(): Driver {
  let shuttingDown = false;
  let state: State = initialState();
  let idleTimer: NodeJS.Timeout | null = null;
  let unregisterSignals: (() => void) | undefined;

  const mgr: ConnectionManager = createConnectionManager(DEFAULT_CLIENT_ID, process.pid, realBackoffDeps);

  // Activity payload builder (Phase 2 minimal — Phase 4 replaces with personality/template).
  const buildPayload = (): SetActivity => {
    const ctx = buildContext(state, { /* workspace/branch fresh-overrides come in Phase 4 */ });
    const filename = redact("filename", ctx.filename ?? "", "show");
    const branch = redact("branch", ctx.branch ?? "", "show");
    const workspace = redact("workspace", ctx.workspace ?? "", "show");
    const details = ctx.kind === "AGENT_ACTIVE"
      ? `Agent: ${ctx.agent ?? ""}`
      : ctx.kind === "CODING"
        ? (filename || "Editing")
        : "Idle";
    const stateStr = ctx.kind === "CODING"
      ? [branch, workspace].filter(Boolean).join(" · ")
      : "";
    return {
      details,
      state: stateStr || undefined,
      startTimestamp: ctx.startTimestamp,
    };
  };

  const throttled = createThrottle<SetActivity>(
    (payload) => { void mgr.setActivity(payload); },
    THROTTLE_MS,
  );

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
      state = reduce(state, event);
      scheduleIdle();
      throttled(buildPayload());
    } catch {
      /* silent per D-18 */
    }
  };

  // Reconnect replay (RPC-04 / D-12)
  mgr.onReady(() => {
    if (shuttingDown) return;
    // Capture the signal handler unregister fn once — ready may fire multiple times across reconnects.
    if (!unregisterSignals) {
      const live = mgr.getLiveClient();
      if (live) unregisterSignals = registerSignalHandlers(live, process.pid);
    }
    throttled(buildPayload());
  });

  // Detectors
  const editorDisposable = createEditorDetector(dispatch);
  const gitDisposable = createGitDetector(dispatch);
  const detectorsDisposable = createDetectorsOrchestrator(dispatch);

  mgr.start();

  return {
    dispose: async () => {
      shuttingDown = true;
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
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
