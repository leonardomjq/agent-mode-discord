import { Client } from "@xhayper/discord-rpc";
import type { SetActivity } from "@xhayper/discord-rpc";

/**
 * Bundled default Discord Client ID. Phase 1 ships a placeholder — replace via
 * Discord Developer Portal (see docs/HUMAN-HANDOFF.md). Override at runtime via
 * AGENT_MODE_CLIENT_ID env var (useful for CI / smoke tests).
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

/** Create a Client and call login(). Caller is responsible for catching rejection. */
export async function connect(
  clientId: string = DEFAULT_CLIENT_ID,
  deps: RpcDeps = defaultDeps,
): Promise<Client> {
  const client = deps.createClient(clientId);
  await client.login();
  return client;
}

/** Belt-and-braces clearActivity BEFORE setActivity (SKEL-08). Both calls silent. */
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

/** Clear pid-scoped activity. NEVER passes null to setActivity (PRD §18 hard rule). */
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
 * Register SIGINT/SIGTERM handlers: clearActivity + destroy + exit(130|143).
 * WR-04: exit prevents process-hang when VS Code host skips deactivate().
 * Returns unregister fn — deactivate() MUST call to prevent handler leaks.
 */
export function registerSignalHandlers(client: Client, pid: number): () => void {
  const handler = async (signal: NodeJS.Signals) => {
    try {
      await clearActivity(client, pid);
      await destroy(client);
    } finally {
      process.exit(signal === "SIGINT" ? 130 : 143); // WR-04: prevent process-hang
    }
  };
  const sigintBound = () => void handler("SIGINT");
  const sigtermBound = () => void handler("SIGTERM");
  process.once("SIGINT", sigintBound);
  process.once("SIGTERM", sigtermBound);
  return () => {
    process.off("SIGINT", sigintBound);
    process.off("SIGTERM", sigtermBound);
  };
}

// Phase 2: Pid-aware setActivity wrapper (RPC-01 / D-13)
/** Pid-scoped setActivity — clearActivity first (belt-and-braces). Silent per RPC-05. */
export async function setActivity(
  client: Client,
  pid: number,
  payload: SetActivity,
): Promise<void> {
  try {
    await client.user?.clearActivity(pid);
  } catch {
    /* silent — no prior activity is expected */
  }
  try {
    await client.user?.setActivity(payload, pid);
  } catch {
    /* silent per PRD §8 */
  }
}

// Phase 2: Backoff constants and types (RPC-03)
export const BACKOFF_LADDER_MS = [5_000, 10_000, 20_000, 40_000, 60_000] as const;
export const COOLDOWN_FLOOR_MS = 5_000 as const;

export interface BackoffDeps {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => NodeJS.Timeout;
  clearTimeout: (t: NodeJS.Timeout) => void;
  createClient: (clientId: string) => Client;
}

export const realBackoffDeps: BackoffDeps = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (t) => clearTimeout(t),
  createClient: (clientId) => new Client({ clientId }),
};

export interface ConnectionManager {
  start(): void;
  stop(): Promise<void>;
  onReady(cb: () => void): void;
  setActivity(payload: SetActivity): Promise<void>;
  getLiveClient(): Client | null;
}

// Phase 2: Connection manager — exponential backoff + cooldown floor (RPC-03)

export function createConnectionManager(
  clientId: string,
  pid: number,
  deps: BackoffDeps = realBackoffDeps,
): ConnectionManager {
  let attempt = 0;
  let lastAttemptAt = -Infinity;
  let pendingRetry: NodeJS.Timeout | null = null;
  let liveClient: Client | null = null;
  let shuttingDown = false;
  let stopPromise: Promise<void> | null = null;
  const readyCallbacks: Array<() => void> = [];

  const nextDelay = (): number => {
    const ladderMs = BACKOFF_LADDER_MS[Math.min(attempt, BACKOFF_LADDER_MS.length - 1)];
    const sinceLast = deps.now() - lastAttemptAt;
    const cooldownRemaining = Math.max(0, COOLDOWN_FLOOR_MS - sinceLast);
    return Math.max(ladderMs, cooldownRemaining);
  };

  const scheduleRetry = (): void => {
    if (shuttingDown) return;
    if (pendingRetry) return; // already scheduled
    attempt += 1;
    const delay = nextDelay();
    pendingRetry = deps.setTimeout(() => {
      pendingRetry = null;
      void attemptConnect();
    }, delay);
  };

  const attemptConnect = async (): Promise<void> => {
    if (shuttingDown) return;
    lastAttemptAt = deps.now();
    const client = deps.createClient(clientId);
    client.on("ready", () => {
      if (shuttingDown) {
        // WR-01: tear down orphan — do NOT store as liveClient.
        void clearActivity(client, pid).then(() => destroy(client));
        return;
      }
      attempt = 0;
      liveClient = client;
      for (const cb of readyCallbacks) {
        try {
          cb();
        } catch {
          /* silent per RPC-05 */
        }
      }
    });
    client.on("disconnected", () => {
      if (liveClient === client) liveClient = null;
      scheduleRetry();
    });
    try {
      await client.login();
    } catch (err) {
      console.debug("[agent-mode-discord] RPC login rejected:", err); // RPC-05: debug only
      scheduleRetry();
    }
  };

  return {
    start: () => {
      void attemptConnect();
    },
    stop: () => {
      if (stopPromise) return stopPromise; // idempotent
      shuttingDown = true;
      stopPromise = (async () => {
        if (pendingRetry) {
          deps.clearTimeout(pendingRetry);
          pendingRetry = null;
        }
        const c = liveClient;
        liveClient = null;
        if (c) {
          await clearActivity(c, pid);
          await destroy(c);
        }
      })();
      return stopPromise;
    },
    onReady: (cb) => {
      readyCallbacks.push(cb);
    },
    setActivity: async (payload) => {
      if (!liveClient) return; // silent — no live connection yet
      await setActivity(liveClient, pid, payload);
    },
    getLiveClient: () => liveClient,
  };
}
