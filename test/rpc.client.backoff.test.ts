import { describe, it } from "vitest";

describe("connection manager backoff", () => {
  it.todo("login rejection schedules retry at 5s (attempt 0, ladder head)");
  it.todo("second rejection waits 10s, third 20s, fourth 40s, fifth+ capped at 60s (ladder progression RPC-03)");
  it.todo("cooldown floor: forced retry at 1s after last attempt waits full 5s, not the ladder value (5s floor)");
  it.todo("ready event resets attempt counter back to 5s on next disconnect (ladder resets on success)");
  it.todo("ready event triggers onReady callback for reconnect replay (RPC-04 / D-12)");
  it.todo("pid is forwarded into setActivity / clearActivity on every call (RPC-01)");
  it.todo("stop() clears pending retry timeout and prevents late-resolve orphan clients (Phase 1 WR-01 carry-forward)");
  it.todo("SIGINT handler registered by ConnectionManager unregisters on stop() (Phase 1 WR-04 carry-forward)");
  it.todo("all connect/setActivity/clearActivity errors swallowed — only console.debug, never console.error (RPC-05)");
});
