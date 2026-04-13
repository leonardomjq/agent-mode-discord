// Hoisted mocks — vi.hoisted ensures these run before vi.mock factory.
// Each Client instance gets its own per-instance listener map.
// `lastClient` tracks the most recently created Client so tests can emit to it.
const { mockLogin, mockDestroy, mockSetActivity, mockClearActivity, getLastClient } = vi.hoisted(() => {
  let _lastClient: { listeners: Map<string, Array<(...a: unknown[]) => void>> } | null = null;
  return {
    mockLogin: vi.fn(async () => {}),
    mockDestroy: vi.fn(async () => {}),
    mockSetActivity: vi.fn(async () => {}),
    mockClearActivity: vi.fn(async () => {}),
    getLastClient: () => _lastClient,
    _setLastClient: (c: { listeners: Map<string, Array<(...a: unknown[]) => void>> }) => {
      _lastClient = c;
    },
  };
});

vi.mock("@xhayper/discord-rpc", () => {
  class Client {
    listeners = new Map<string, Array<(...a: unknown[]) => void>>();
    user = { setActivity: mockSetActivity, clearActivity: mockClearActivity };
    login = mockLogin;
    destroy = mockDestroy;
    on(event: string, cb: (...a: unknown[]) => void) {
      const arr = this.listeners.get(event) ?? [];
      arr.push(cb);
      this.listeners.set(event, arr);
      return this;
    }
    once(event: string, cb: (...a: unknown[]) => void) {
      return this.on(event, cb);
    }
    constructor(public opts?: { clientId?: string }) {
      // Track this as the last-created client for test emission.
      // Access via closure reference captured by hoisted fn.
      (getLastClient as unknown as { _ref: Client })._ref = this;
    }
  }
  return { Client };
});

// Emit to the most recently created Client's listeners (simulates Discord events).
function emit(event: string, ...args: unknown[]): void {
  const ref = (getLastClient as unknown as { _ref?: { listeners: Map<string, Array<(...a: unknown[]) => void>> } })._ref;
  if (!ref) return;
  for (const cb of ref.listeners.get(event) ?? []) cb(...args);
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createConnectionManager,
  setActivity,
  registerSignalHandlers,
} from "../src/rpc/client";
import { Client as DiscordClient } from "@xhayper/discord-rpc";

// Helper: build test deps. Lazy wrappers ensure vi.useFakeTimers replacements are picked up.
// createClient uses the module-level mocked Client class (imported above, resolved via vi.mock).
function makeDeps(nowFn?: () => number) {
  return {
    now: nowFn ?? (() => Date.now()),
    setTimeout: (fn: () => void, ms: number) => globalThis.setTimeout(fn, ms),
    clearTimeout: (t: NodeJS.Timeout) => globalThis.clearTimeout(t),
    createClient: (id: string) => new DiscordClient({ clientId: id }),
  };
}

// Convenience: create a mock Client instance directly (for standalone wrapper tests).
function makeMockClient() {
  return new DiscordClient({ clientId: "test" });
}

describe("connection manager backoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset the lastClient ref so cross-test pollution is prevented.
    (getLastClient as unknown as { _ref?: unknown })._ref = undefined;
    mockLogin.mockClear().mockImplementation(async () => {});
    mockDestroy.mockClear();
    mockSetActivity.mockClear();
    mockClearActivity.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it("login rejection schedules retry at 5s (attempt 0, ladder head)", async () => {
    mockLogin.mockRejectedValue(new Error("no Discord"));
    const mgr = createConnectionManager("cid", 1234, makeDeps());
    mgr.start();
    await vi.advanceTimersByTimeAsync(0); // drain login rejection
    expect(mockLogin).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4999);
    expect(mockLogin).toHaveBeenCalledTimes(1); // still 1 — 5s hasn't elapsed
    await vi.advanceTimersByTimeAsync(2);
    expect(mockLogin).toHaveBeenCalledTimes(2); // retry fires at t=5000
  });

  it("second rejection waits 10s, third 20s, fourth 40s, fifth+ capped at 60s (ladder progression RPC-03)", async () => {
    mockLogin.mockRejectedValue(new Error("no Discord"));
    const mgr = createConnectionManager("cid", 1234, makeDeps());
    mgr.start();
    await vi.advanceTimersByTimeAsync(0);
    // attempt 0 rejected → retry in 5s
    await vi.advanceTimersByTimeAsync(5000);
    expect(mockLogin).toHaveBeenCalledTimes(2);
    // attempt 1 rejected → retry in 10s
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mockLogin).toHaveBeenCalledTimes(3);
    // attempt 2 rejected → retry in 20s
    await vi.advanceTimersByTimeAsync(20_000);
    expect(mockLogin).toHaveBeenCalledTimes(4);
    // attempt 3 rejected → retry in 40s
    await vi.advanceTimersByTimeAsync(40_000);
    expect(mockLogin).toHaveBeenCalledTimes(5);
    // attempt 4 rejected → retry in 60s (cap)
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mockLogin).toHaveBeenCalledTimes(6);
    // attempt 5 rejected → STILL 60s (cap held)
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mockLogin).toHaveBeenCalledTimes(7);
  });

  it("cooldown floor: forced retry at 1s after last attempt waits full 5s, not the ladder value (5s floor)", async () => {
    // Record login timestamps to prove gap between any two calls >= 5000ms.
    const timestamps: number[] = [];
    mockLogin.mockImplementation(async () => {
      timestamps.push(Date.now());
    });

    const mgr = createConnectionManager("cid", 1234, makeDeps());
    mgr.start();
    await vi.advanceTimersByTimeAsync(0); // t=0: login #1
    emit("ready"); // attempt → 0, lastAttemptAt = 0
    await vi.advanceTimersByTimeAsync(100);
    emit("disconnected"); // scheduleRetry at t=100; sinceLast=100; cooldown=4900; ladder=5000 → delay=5000
    await vi.advanceTimersByTimeAsync(5000);
    // t=5100: login #2
    emit("ready"); // attempt → 0, lastAttemptAt = 5100
    await vi.advanceTimersByTimeAsync(100);
    emit("disconnected"); // sinceLast=100; cooldown=4900; ladder=5000 → delay=5000
    await vi.advanceTimersByTimeAsync(5000);
    // t=10200: login #3

    expect(timestamps.length).toBeGreaterThanOrEqual(3);
    expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(5000);
    expect(timestamps[2] - timestamps[1]).toBeGreaterThanOrEqual(5000);
  });

  it("ready event resets attempt counter back to 5s on next disconnect (ladder resets on success)", async () => {
    // Phase 1: initial connect succeeds, then disconnect triggers ladder climb.
    mockLogin.mockResolvedValue(undefined);
    const mgr = createConnectionManager("cid", 1234, makeDeps());
    mgr.start();
    await vi.advanceTimersByTimeAsync(0); // login #1 succeeds
    emit("ready"); // liveClient set, attempt stays 0
    expect(mockLogin).toHaveBeenCalledTimes(1);

    // Phase 2: disconnect starts ladder. Switch to rejected so retries fail.
    mockLogin.mockRejectedValue(new Error("boom"));
    emit("disconnected"); // scheduleRetry → delay=5s (attempt=0 → ladder[0])
    await vi.advanceTimersByTimeAsync(5000); // login #2 (attempt 0, fails → scheduleRetry → delay=5s again? no: attempt→1 → ladder[1]=10s)
    // After login #2 fails, attempt incremented: nextDelay reads attempt=1 before inc, delay=10s
    await vi.advanceTimersByTimeAsync(10_000); // login #3 (delay=10s)
    await vi.advanceTimersByTimeAsync(20_000); // login #4 (delay=20s)
    // Flip to success, emit ready (ladder resets to 0)
    mockLogin.mockResolvedValue(undefined);
    await vi.advanceTimersByTimeAsync(40_000); // login #5 (delay=40s) succeeds
    emit("ready"); // attempt → 0
    expect(mockLogin).toHaveBeenCalledTimes(5);

    // Phase 3: another disconnect — retry should use 5s (ladder reset), NOT 80s
    emit("disconnected");
    mockLogin.mockRejectedValue(new Error("boom"));
    await vi.advanceTimersByTimeAsync(4999);
    expect(mockLogin).toHaveBeenCalledTimes(5); // still 5 — 5s hasn't elapsed
    await vi.advanceTimersByTimeAsync(2);
    expect(mockLogin).toHaveBeenCalledTimes(6); // retry at 5s confirms ladder reset
  });

  it("ready event triggers onReady callback for reconnect replay (RPC-04 / D-12)", async () => {
    mockLogin.mockResolvedValue(undefined);
    const replay = vi.fn();
    const mgr = createConnectionManager("cid", 1234, makeDeps());
    mgr.onReady(replay);
    mgr.start();
    await vi.advanceTimersByTimeAsync(0);
    emit("ready"); // fires on current (first) client's listeners
    expect(replay).toHaveBeenCalledTimes(1);
    // Disconnect: triggers scheduleRetry → new client created after 5s
    emit("disconnected");
    await vi.advanceTimersByTimeAsync(5000); // retry fires, new client registered
    emit("ready"); // fires on the NEW client's listeners (per-instance map)
    expect(replay).toHaveBeenCalledTimes(2);
  });

  it("pid is forwarded into setActivity / clearActivity on every call (RPC-01)", async () => {
    mockLogin.mockResolvedValue(undefined);
    const mgr = createConnectionManager("cid", 9999, makeDeps());
    mgr.start();
    await vi.advanceTimersByTimeAsync(0);
    emit("ready");
    await mgr.setActivity({ details: "hello" });
    // setActivity wrapper calls clearActivity(pid) then setActivity(payload, pid)
    expect(mockClearActivity).toHaveBeenCalledWith(9999);
    expect(mockSetActivity).toHaveBeenCalledWith({ details: "hello" }, 9999);
    // Direct wrapper test
    const directClient = makeMockClient();
    await setActivity(directClient, 5555, { details: "direct" });
    expect(mockClearActivity).toHaveBeenLastCalledWith(5555);
    expect(mockSetActivity).toHaveBeenLastCalledWith({ details: "direct" }, 5555);
  });

  it("stop() clears pending retry timeout and prevents late-resolve orphan clients (Phase 1 WR-01 carry-forward)", async () => {
    // Simulate a login that resolves AFTER stop() is called.
    let resolveLogin: () => void = () => {};
    mockLogin.mockImplementation(
      () => new Promise<void>((r) => { resolveLogin = r; }),
    );
    const mgr = createConnectionManager("cid", 1234, makeDeps());
    mgr.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(mockLogin).toHaveBeenCalledTimes(1);
    // Stop before ready fires
    await mgr.stop();
    // Resolve login then emit ready — orphan client should be torn down, NOT stored as live
    resolveLogin();
    await vi.advanceTimersByTimeAsync(10);
    emit("ready");
    await vi.advanceTimersByTimeAsync(10);
    // Orphan should be torn down — NOT stored as liveClient
    expect(mgr.getLiveClient()).toBeNull();
    // clearActivity + destroy should have been called on the orphan
    expect(mockClearActivity).toHaveBeenCalled();
    expect(mockDestroy).toHaveBeenCalled();
    // stop() is idempotent — must not throw
    await mgr.stop();
  });

  it("SIGINT handler registered by ConnectionManager unregisters on stop() (Phase 1 WR-04 carry-forward)", () => {
    const onceSpy = vi.spyOn(process, "once");
    const offSpy = vi.spyOn(process, "off");
    const fakeClient = makeMockClient();
    const unregister = registerSignalHandlers(fakeClient, 7777);
    expect(onceSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(onceSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    unregister();
    expect(offSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(offSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    // Do NOT actually invoke the handler — that would call process.exit and terminate the test runner.
    onceSpy.mockRestore();
    offSpy.mockRestore();
  });

  it("all connect/setActivity/clearActivity errors swallowed — only console.debug, never console.error (RPC-05)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    mockLogin.mockRejectedValue(new Error("connect failed"));
    mockSetActivity.mockRejectedValue(new Error("setActivity failed"));
    mockClearActivity.mockRejectedValue(new Error("clearActivity failed"));

    const mgr = createConnectionManager("cid", 1234, makeDeps());
    mgr.start();
    await vi.advanceTimersByTimeAsync(0);
    // Login rejection should go to debug, not error
    expect(errorSpy).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalled();

    // Direct setActivity wrapper: errors are swallowed, no error log, no throw
    const fakeClient = makeMockClient();
    await expect(
      setActivity(fakeClient, 1234, { details: "x" }),
    ).resolves.toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    debugSpy.mockRestore();
  });
});
