import { describe, it } from "vitest";

describe("rpc throttle — leading + trailing + last-wins", () => {
  it.todo("fires leading edge immediately on first call");
  it.todo("20 calls across 1s produce exactly 2 underlying calls — leading with first payload, trailing with last (RPC-02 / STATE-06)");
  it.todo("trailing fire emits the most recent payload, not the one that scheduled the trailer (last-wins, D-10)");
  it.todo("no trailing fire when only one call lands in the window");
  it.todo("cancels pending trailer when a new leading edge fires after the window elapses");
});
