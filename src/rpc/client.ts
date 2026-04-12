import { Client } from "@xhayper/discord-rpc";

/**
 * Bundled default Discord Client ID.
 *
 * Phase 1 ships a placeholder. The `[HUMAN]` handoff (plan 01-05, docs/HUMAN-HANDOFF.md)
 * tells the maintainer to create the Agent Mode app in the Discord Developer Portal
 * and replace this value. Until then, `client.login()` will reject — the extension
 * loads fine but no activity appears. All RPC failures are swallowed silently per
 * PRD §8 "Failure mode".
 *
 * Override at runtime via the AGENT_MODE_CLIENT_ID env var (useful for CI / smoke tests).
 */
export const DEFAULT_CLIENT_ID: string =
  process.env.AGENT_MODE_CLIENT_ID ?? "REPLACE_ME_IN_PHASE_1_HANDOFF";

export interface RpcDeps {
  createClient: (clientId: string) => Client;
  pid: number;
}

export const defaultDeps: RpcDeps = {
  createClient: (clientId) => new Client({ clientId }),
  pid: process.pid,
};

/**
 * Create a Client and call login(). Phase 1 does not await the "ready" event
 * separately — @xhayper/discord-rpc's login() resolves after ready. Caller is
 * responsible for catching rejection (connect failures are non-fatal).
 */
export async function connect(
  clientId: string = DEFAULT_CLIENT_ID,
  deps: RpcDeps = defaultDeps,
): Promise<Client> {
  const client = deps.createClient(clientId);
  await client.login();
  return client;
}

/**
 * Belt-and-braces: clearActivity BEFORE setActivity. Satisfies SKEL-08 — if a
 * prior extension host crashed without cleanup, this clears the ghost before
 * publishing the new payload. Both calls are wrapped in try/catch; all errors
 * are silent.
 */
export async function helloWorldAnnounce(client: Client, pid: number): Promise<void> {
  try {
    await client.user?.clearActivity(pid);
  } catch {
    /* belt-and-braces: a missing prior ghost is expected */
  }
  try {
    await client.user?.setActivity({
      details: "hello world",
      startTimestamp: Date.now(),
    });
  } catch {
    /* silent per PRD §8 */
  }
}

/**
 * Clear pid-scoped activity. NEVER calls setActivity with a null payload —
 * that leaves ghost presences on some Discord client versions (PRD §18 hard rule).
 */
export async function clearActivity(client: Client, pid: number): Promise<void> {
  try {
    await client.user?.clearActivity(pid);
  } catch {
    /* silent — socket may already be closed */
  }
}

export async function destroy(client: Client): Promise<void> {
  try {
    await client.destroy();
  } catch {
    /* silent */
  }
}

/**
 * Register SIGINT + SIGTERM handlers that clearActivity(pid) then destroy.
 * Returns an unregister fn that deactivate() MUST call to prevent handler
 * leaks across F5 reload cycles.
 */
export function registerSignalHandlers(client: Client, pid: number): () => void {
  const handler = async () => {
    await clearActivity(client, pid);
    await destroy(client);
  };
  process.once("SIGINT", handler);
  process.once("SIGTERM", handler);
  return () => {
    process.off("SIGINT", handler);
    process.off("SIGTERM", handler);
  };
}
