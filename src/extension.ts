import * as vscode from "vscode";
import type { Client } from "@xhayper/discord-rpc";
import {
  DEFAULT_CLIENT_ID,
  clearActivity,
  connect,
  destroy,
  helloWorldAnnounce,
  registerSignalHandlers,
} from "./rpc/client";

/**
 * Module-level state so deactivate() can reach the live client + handler
 * unregister fn even though activate() returns before connect resolves.
 */
let liveClient: Client | undefined;
let unregisterSignalHandlers: (() => void) | undefined;

export function activate(context: vscode.ExtensionContext): void {
  // Fire-and-forget connect — do NOT await. Activation must return fast (SKEL-03).
  void connectAndAnnounce();

  // Register disposable first so it's present even if connectAndAnnounce never resolves.
  context.subscriptions.push({
    dispose: async () => {
      await shutdown();
    },
  });
}

async function connectAndAnnounce(): Promise<void> {
  try {
    const client = await connect(DEFAULT_CLIENT_ID);
    liveClient = client;
    // Belt-and-braces clearActivity runs inside helloWorldAnnounce BEFORE setActivity (SKEL-08).
    await helloWorldAnnounce(client, process.pid);
    // Register SIGINT/SIGTERM only after successful connect — nothing to clean up otherwise.
    unregisterSignalHandlers = registerSignalHandlers(client, process.pid);
  } catch (err) {
    // Silent per PRD §8 "Failure mode" — no toasts, no blocking.
    // Phase 1 logs at debug level via console.debug; output channel lands in Phase 4.
    // eslint-disable-next-line no-console
    console.debug("[agent-mode-discord] RPC connect failed:", err);
  }
}

async function shutdown(): Promise<void> {
  // Remove signal handlers first so they can't race with the explicit cleanup path.
  if (unregisterSignalHandlers) {
    try {
      unregisterSignalHandlers();
    } catch {
      /* silent */
    }
    unregisterSignalHandlers = undefined;
  }
  const client = liveClient;
  liveClient = undefined;
  if (!client) return;
  await clearActivity(client, process.pid);
  await destroy(client);
}

export async function deactivate(): Promise<void> {
  await shutdown();
}
