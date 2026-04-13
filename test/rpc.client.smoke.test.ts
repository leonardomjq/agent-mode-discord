import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Shared mock state — reset in beforeEach.
const mockClearActivity = vi.fn(async (_pid: number) => {});
const mockSetActivity = vi.fn(async (_payload: unknown) => {});
const mockLogin = vi.fn(async () => {});
const mockDestroy = vi.fn(async () => {});

// Invocation tracker for order-sensitive assertions (clearActivity BEFORE setActivity).
const callOrder: string[] = [];

vi.mock("@xhayper/discord-rpc", () => {
  class Client {
    user = {
      clearActivity: (...args: unknown[]) => {
        callOrder.push("clearActivity");
        return mockClearActivity(args[0] as number);
      },
      setActivity: (...args: unknown[]) => {
        callOrder.push("setActivity");
        return mockSetActivity(args[0]);
      },
    };
    login = mockLogin;
    destroy = mockDestroy;
    on() {
      return this;
    }
    once() {
      return this;
    }
    constructor(public opts: { clientId: string }) {}
  }
  return { Client };
});

// Import AFTER vi.mock so the mocked module is picked up.
import {
  clearActivity,
  connect,
  helloWorldAnnounce,
  registerSignalHandlers,
} from "../src/rpc/client";

describe("rpc client smoke — 5 required behaviors", () => {
  beforeEach(() => {
    mockClearActivity.mockClear();
    mockClearActivity.mockImplementation(async (_pid: number) => {});
    mockSetActivity.mockClear();
    mockLogin.mockClear();
    mockDestroy.mockClear();
    callOrder.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Assertion 1 — SKEL-10 baseline + connect wiring
  it("connect() calls client.login() exactly once", async () => {
    await connect("fake-client-id");
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  // Assertion 2 — SKEL-07 pid forwarding
  it("clearActivity forwards the pid to client.user.clearActivity", async () => {
    const client = await connect("fake-client-id");
    await clearActivity(client, 12345);
    expect(mockClearActivity).toHaveBeenCalledWith(12345);
  });

  // Assertion 3 — PRD §8 silent failure mode
  it("clearActivity swallows rejection errors silently", async () => {
    mockClearActivity.mockRejectedValueOnce(new Error("socket closed"));
    const client = await connect("fake-client-id");
    await expect(clearActivity(client, 99)).resolves.toBeUndefined();
  });

  // Assertion 4 — SKEL-08 belt-and-braces order (clearActivity BEFORE setActivity)
  it("helloWorldAnnounce calls clearActivity BEFORE setActivity", async () => {
    const client = await connect("fake-client-id");
    await helloWorldAnnounce(client, 42);
    const firstClear = callOrder.indexOf("clearActivity");
    const firstSet = callOrder.indexOf("setActivity");
    expect(firstClear).toBeGreaterThanOrEqual(0);
    expect(firstSet).toBeGreaterThanOrEqual(0);
    expect(firstClear).toBeLessThan(firstSet);
    expect(mockClearActivity).toHaveBeenCalledWith(42);
  });

  // Assertion 5 — SKEL-07 SIGINT/SIGTERM handler wiring
  it("registerSignalHandlers handler invokes clearActivity(pid) when fired", async () => {
    const client = await connect("fake-client-id");
    const capturedHandlers: Array<{ signal: string; handler: (...a: unknown[]) => unknown }> = [];
    const onceSpy = vi
      .spyOn(process, "once")
      .mockImplementation((sig: string | symbol, h: (...a: unknown[]) => unknown) => {
        capturedHandlers.push({ signal: String(sig), handler: h });
        return process;
      });

    const unregister = registerSignalHandlers(client, 777);

    // Both SIGINT and SIGTERM should have been subscribed.
    const signals = capturedHandlers.map((c) => c.signal);
    expect(signals).toContain("SIGINT");
    expect(signals).toContain("SIGTERM");

    // Invoke the SIGINT handler directly and confirm clearActivity(pid=777) is called.
    // WR-04: handler calls process.exit after cleanup — mock it to prevent runner termination.
    // The bound wrapper is synchronous (`() => void handler(...)`) so we must await a tick
    // after calling it for the async handler to reach the process.exit call.
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    const sigint = capturedHandlers.find((c) => c.signal === "SIGINT");
    expect(sigint).toBeDefined();
    // Call the bound wrapper (sync) then drain microtasks so handler's async body completes.
    (sigint!.handler as () => void)();
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(mockClearActivity).toHaveBeenCalledWith(777);
    expect(exitSpy).toHaveBeenCalledWith(130);

    // Cleanup — unregister must be callable without throwing even with the spy in place.
    onceSpy.mockRestore();
    exitSpy.mockRestore();
    // Re-spy process.off so unregister doesn't explode because we stole .once earlier.
    const offSpy = vi.spyOn(process, "off").mockImplementation(() => process);
    expect(() => unregister()).not.toThrow();
    offSpy.mockRestore();
  });
});
