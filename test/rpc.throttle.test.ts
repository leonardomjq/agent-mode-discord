import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createThrottle } from "../src/rpc/throttle";

describe("rpc throttle — leading + trailing + last-wins", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires leading edge immediately on first call", () => {
    const fn = vi.fn();
    const throttled = createThrottle(fn, 2000);
    throttled("a");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("a");
  });

  it("20 calls across 1s produce exactly 2 underlying calls — leading with first payload, trailing with last (RPC-02 / STATE-06)", async () => {
    const fn = vi.fn();
    const throttled = createThrottle(fn, 2000);
    for (let i = 0; i < 20; i++) {
      throttled(`payload-${i}`);
      await vi.advanceTimersByTimeAsync(50); // 50ms * 20 = 1000ms total, all inside 2s window
    }
    // Only leading fired so far
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenNthCalledWith(1, "payload-0");
    // Advance past the window — trailing fires with the LAST payload
    await vi.advanceTimersByTimeAsync(1500); // total elapsed ~2500ms > 2000ms window
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(2, "payload-19");
  });

  it("trailing fire emits the most recent payload, not the one that scheduled the trailer (last-wins, D-10)", async () => {
    const fn = vi.fn();
    const throttled = createThrottle(fn, 2000);
    throttled("first"); // leading fires with "first"
    throttled("second"); // scheduled trailer holds "second"
    throttled("third"); // overwrites to "third"
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(2, "third"); // last-wins, NOT "second"
  });

  it("no trailing fire when only one call lands in the window", async () => {
    const fn = vi.fn();
    const throttled = createThrottle(fn, 2000);
    throttled("only");
    await vi.advanceTimersByTimeAsync(2100);
    expect(fn).toHaveBeenCalledTimes(1); // no trailing fire
    expect(fn).toHaveBeenCalledWith("only");
  });

  it("cancels pending trailer when a new leading edge fires after the window elapses", async () => {
    const fn = vi.fn();
    const throttled = createThrottle(fn, 2000);
    throttled("a"); // leading #1 fires "a"
    await vi.advanceTimersByTimeAsync(500);
    throttled("b"); // held, trailer scheduled for t=2000
    await vi.advanceTimersByTimeAsync(2500); // trailer fires at t=2000 with "b"; now at t=3000
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, "a");
    expect(fn).toHaveBeenNthCalledWith(2, "b");
    throttled("c"); // leading #2 (window elapsed since t=2000)
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenNthCalledWith(3, "c");
  });
});
