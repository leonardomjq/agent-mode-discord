/**
 * Phase-4 activityBuilder tests (plan 04-04).
 *
 * Covers:
 *   - formatElapsed (Discord short form: "45s" / "20m" / "2h 15m")
 *   - buildTokens (State + AgentModeConfig → TemplateTokens, applies redact)
 *   - buildPayload (renderedText + State → SetActivity)
 *   - createActivityBuilder (ignore clear-once D-14, idleBehavior D-20, animator wiring)
 *
 * Uses fakeClocks + vitest to stay deterministic; no monkey-patching globals.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SetActivity } from "@xhayper/discord-rpc";
import { makeFakeClocks } from "./presence/__helpers__/fakeClocks";
import {
  buildPayload,
  buildTokens,
  createActivityBuilder,
  formatElapsed,
} from "../src/presence/activityBuilder";
import type { State } from "../src/state/types";
import type { AgentModeConfig } from "../src/config";
import { BUILTIN_GOBLIN_PACK } from "../src/presence/packLoader";
import type { Pack } from "../src/presence/types";
import { __resetRegexCacheForTest } from "../src/privacy";

// --- config helpers ----------------------------------------------------------

function defaultConfig(overrides: Partial<AgentModeConfig> = {}): AgentModeConfig {
  const base: AgentModeConfig = {
    clientId: "TEST",
    activityType: "playing",
    idleBehavior: "show",
    debug: { verbose: false },
    animations: { enabled: true },
    messages: { customPackPath: "" },
    privacy: {
      workspaceName: "show",
      filename: "show",
      gitBranch: "show",
    },
    ignore: {
      workspaces: [],
      repositories: [],
      organizations: [],
      gitHosts: [],
    },
    detect: {
      customPatterns: {},
      sessionFileStalenessSeconds: 60,
    },
  };
  return {
    ...base,
    ...overrides,
    privacy: { ...base.privacy, ...(overrides.privacy ?? {}) },
    ignore: { ...base.ignore, ...(overrides.ignore ?? {}) },
    animations: { ...base.animations, ...(overrides.animations ?? {}) },
    debug: { ...base.debug, ...(overrides.debug ?? {}) },
    messages: { ...base.messages, ...(overrides.messages ?? {}) },
    detect: { ...base.detect, ...(overrides.detect ?? {}) },
  };
}

// A state that will reliably resolve to a non-blank rendered text via the
// primary pool (uses simple static strings like "shipping", "building").
function agentActiveState(overrides: Partial<State & { kind: "AGENT_ACTIVE" }> = {}): State {
  return {
    kind: "AGENT_ACTIVE",
    agent: "claude",
    startTimestamp: 1700000000000,
    workspace: "/Users/leo/my-repo",
    filename: "app.ts",
    language: "typescript",
    branch: "main",
    ...overrides,
  } as State;
}

function idleState(overrides: Partial<State & { kind: "IDLE" }> = {}): State {
  return {
    kind: "IDLE",
    startTimestamp: 1700000000000,
    workspace: "/Users/leo/my-repo",
    branch: "main",
    ...overrides,
  } as State;
}

// Use the built-in goblin pack so rendered text is never blank (robust to
// blank-skip loop interaction).
const realPack: Pack = BUILTIN_GOBLIN_PACK;

afterEach(() => {
  __resetRegexCacheForTest();
  vi.restoreAllMocks();
});

// ============================================================================
// formatElapsed
// ============================================================================

describe("formatElapsed", () => {
  it("0 → '0s'", () => expect(formatElapsed(0)).toBe("0s"));
  it("45 000 → '45s'", () => expect(formatElapsed(45_000)).toBe("45s"));
  it("60 000 → '1m'", () => expect(formatElapsed(60_000)).toBe("1m"));
  it("20 × 60_000 → '20m'", () => expect(formatElapsed(20 * 60_000)).toBe("20m"));
  it("1h 0m", () => expect(formatElapsed(60 * 60_000)).toBe("1h 0m"));
  it("2h 15m", () =>
    expect(formatElapsed(2 * 60 * 60_000 + 15 * 60_000)).toBe("2h 15m"));
  it("NaN → '0s'", () => expect(formatElapsed(NaN)).toBe("0s"));
  it("undefined → '0s'", () =>
    expect(formatElapsed(undefined as unknown as number)).toBe("0s"));
  it("negative → '0s'", () => expect(formatElapsed(-1000)).toBe("0s"));
  it("Infinity → '0s'", () =>
    expect(formatElapsed(Number.POSITIVE_INFINITY)).toBe("0s"));
});

// ============================================================================
// buildTokens
// ============================================================================

describe("buildTokens", () => {
  it("AGENT_ACTIVE all-show: tokens resolve to state values with workspace basename", () => {
    const state = agentActiveState({
      startTimestamp: new Date("2026-04-15T12:00:00.000Z").getTime() - 20 * 60_000,
    });
    const cfg = defaultConfig();
    const now = new Date("2026-04-15T12:00:00.000Z");
    const tokens = buildTokens(state, cfg, now);
    expect(tokens.workspace).toBe("my-repo");
    expect(tokens.filename).toBe("app.ts");
    expect(tokens.language).toBe("typescript");
    expect(tokens.branch).toBe("main");
    expect(tokens.agent).toBe("claude");
    expect(tokens.elapsed).toBe("20m");
  });

  it("privacy.filename='hide' → filename is empty string", () => {
    const state = agentActiveState();
    const cfg = defaultConfig({
      privacy: { filename: "hide", gitBranch: "show", workspaceName: "show" },
    });
    const tokens = buildTokens(state, cfg, new Date());
    expect(tokens.filename).toBe("");
  });

  it("privacy.workspaceName='hash' → workspace is 6-hex SHA-1 prefix", () => {
    const state = agentActiveState({ workspace: "/Users/leo/my-repo" });
    const cfg = defaultConfig({
      privacy: { filename: "show", gitBranch: "show", workspaceName: "hash" },
    });
    const tokens = buildTokens(state, cfg, new Date());
    expect(tokens.workspace).toMatch(/^[0-9a-f]{6}$/);
  });

  it("privacy.gitBranch='hide' → branch is empty string", () => {
    const state = agentActiveState();
    const cfg = defaultConfig({
      privacy: { filename: "show", gitBranch: "hide", workspaceName: "show" },
    });
    const tokens = buildTokens(state, cfg, new Date());
    expect(tokens.branch).toBe("");
  });

  it("IDLE state → agent token is empty string", () => {
    const state = idleState();
    const cfg = defaultConfig();
    const tokens = buildTokens(state, cfg, new Date());
    expect(tokens.agent).toBe("");
  });

  it("no workspace on state → workspace is empty string (no basename throw)", () => {
    // IDLE with no workspace field at all.
    const state: State = {
      kind: "IDLE",
      startTimestamp: 0,
    };
    const tokens = buildTokens(state, defaultConfig(), new Date());
    expect(tokens.workspace).toBe("");
  });

  it("missing startTimestamp-derived elapsed falls back to 0s (past-time guard)", () => {
    const state = agentActiveState({ startTimestamp: 0 });
    const now = new Date("1970-01-01T00:00:00.000Z"); // before startTimestamp==0
    const tokens = buildTokens(state, defaultConfig(), now);
    expect(tokens.elapsed).toBe("0s");
  });

  it("hash mode: different workspace paths → different hashes (determinism)", () => {
    const cfg = defaultConfig({
      privacy: { filename: "show", gitBranch: "show", workspaceName: "hash" },
    });
    const t1 = buildTokens(
      agentActiveState({ workspace: "/a/project-one" }),
      cfg,
      new Date(),
    );
    const t2 = buildTokens(
      agentActiveState({ workspace: "/a/project-two" }),
      cfg,
      new Date(),
    );
    expect(t1.workspace).not.toBe(t2.workspace);
    expect(t1.workspace).toMatch(/^[0-9a-f]{6}$/);
  });
});

// ============================================================================
// buildPayload
// ============================================================================

describe("buildPayload", () => {
  it("non-empty rendered text → details = text, startTimestamp passthrough (STATE-05)", () => {
    const state = agentActiveState({ startTimestamp: 1717171717000 });
    const p: SetActivity = buildPayload("cooking...", state);
    expect(p.details).toBe("cooking...");
    expect(p.startTimestamp).toBe(1717171717000);
    expect(p.state).toBeUndefined();
  });

  it("empty rendered text → details falls back to 'building, afk' (Discord non-empty details rule)", () => {
    const p = buildPayload("", agentActiveState());
    expect(p.details).toBe("building, afk");
  });

  // SEED-002 — per-agent Discord large-image keys.
  describe("largeImageKey resolution", () => {
    it.each([
      ["claude", "claude-icon"],
      ["codex", "codex-icon"],
      ["gemini", "gemini-icon"],
      ["opencode", "opencode-icon"],
    ])("agent %s → largeImageKey %s", (agent, expectedKey) => {
      const p = buildPayload("hi", agentActiveState({ agent }));
      expect(p.largeImageKey).toBe(expectedKey);
      expect(p.largeImageText).toBe(`${agent} agent active`);
    });

    it("AGENT_ACTIVE with custom (non-built-in) agent → falls back to agent-mode-large", () => {
      const p = buildPayload("hi", agentActiveState({ agent: "my-custom-bot" }));
      expect(p.largeImageKey).toBe("agent-mode-large");
      expect(p.largeImageText).toBe("my-custom-bot agent active");
    });

    it("IDLE state → largeImageKey is generic fallback", () => {
      const p = buildPayload("morning build", idleState());
      expect(p.largeImageKey).toBe("agent-mode-large");
      expect(p.largeImageText).toBe("Agent Mode");
    });

    it("agent string is case-insensitive (CLAUDE / Claude → claude-icon)", () => {
      expect(buildPayload("hi", agentActiveState({ agent: "CLAUDE" })).largeImageKey).toBe("claude-icon");
      expect(buildPayload("hi", agentActiveState({ agent: "Claude" })).largeImageKey).toBe("claude-icon");
    });
  });
});

// ============================================================================
// createActivityBuilder — ignore clear-once / idleBehavior / animator wiring
// ============================================================================

describe("createActivityBuilder", () => {
  it("ignore-rule match fires onClear exactly once across 5 ticks (PRIV-05 / D-14)", () => {
    const clocks = makeFakeClocks({ randSeq: [0.1] });
    let state: State = agentActiveState();
    let cfg = defaultConfig({
      ignore: { workspaces: ["**/secret-*"], repositories: [], organizations: [], gitHosts: [] },
    });
    const onSet = vi.fn();
    const onClear = vi.fn();
    const builder = createActivityBuilder(
      {
        getState: () => state,
        getConfig: () => cfg,
        getPack: () => realPack,
        onSet,
        onClear,
        getIgnoreContext: () => ({ workspaceAbsPath: "/Users/leo/secret-project" }),
      },
      clocks,
    );
    builder.start(); // immediate tick
    // Advance 5 rotations (20s each)
    for (let i = 0; i < 4; i++) clocks.advance(20_000);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onSet).not.toHaveBeenCalled();
    builder.stop();
  });

  it("first non-ignored tick after ignored run resumes setActivity pipeline", () => {
    const clocks = makeFakeClocks({ randSeq: [0.1] });
    const state: State = agentActiveState();
    let cfg = defaultConfig({
      ignore: { workspaces: ["**/secret-*"], repositories: [], organizations: [], gitHosts: [] },
    });
    let ignoreCtx = { workspaceAbsPath: "/Users/leo/secret-project" };
    const onSet = vi.fn();
    const onClear = vi.fn();
    const builder = createActivityBuilder(
      {
        getState: () => state,
        getConfig: () => cfg,
        getPack: () => realPack,
        onSet,
        onClear,
        getIgnoreContext: () => ignoreCtx,
      },
      clocks,
    );
    builder.start();
    clocks.advance(20_000);
    clocks.advance(20_000);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onSet).toHaveBeenCalledTimes(0);
    // Flip out of ignored state
    ignoreCtx = { workspaceAbsPath: "/Users/leo/my-repo" };
    clocks.advance(20_000);
    expect(onSet).toHaveBeenCalledTimes(1);
    // Another tick within non-ignore should call onSet again (no clear-once sticky)
    clocks.advance(20_000);
    expect(onSet).toHaveBeenCalledTimes(2);
    expect(onClear).toHaveBeenCalledTimes(1);
    builder.stop();
  });

  it("idleBehavior='clear' on IDLE state fires onClear exactly once across 3 ticks (CONF-04 / D-20)", () => {
    const clocks = makeFakeClocks({ randSeq: [0.1] });
    const state: State = idleState();
    const cfg = defaultConfig({ idleBehavior: "clear" });
    const onSet = vi.fn();
    const onClear = vi.fn();
    const builder = createActivityBuilder(
      {
        getState: () => state,
        getConfig: () => cfg,
        getPack: () => realPack,
        onSet,
        onClear,
        getIgnoreContext: () => ({}),
      },
      clocks,
    );
    builder.start();
    clocks.advance(20_000);
    clocks.advance(20_000);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onSet).not.toHaveBeenCalled();
    builder.stop();
  });

  it("idleBehavior='show' on IDLE state renders IDLE pool via onSet (D-19)", () => {
    const clocks = makeFakeClocks({ randSeq: [0.5] });
    const state: State = idleState();
    const cfg = defaultConfig({ idleBehavior: "show" });
    const onSet = vi.fn();
    const onClear = vi.fn();
    const builder = createActivityBuilder(
      {
        getState: () => state,
        getConfig: () => cfg,
        getPack: () => realPack,
        onSet,
        onClear,
        getIgnoreContext: () => ({}),
      },
      clocks,
    );
    builder.start();
    expect(onSet).toHaveBeenCalledTimes(1);
    expect(onClear).not.toHaveBeenCalled();
    const payload = onSet.mock.calls[0][0] as SetActivity;
    expect(typeof payload.details).toBe("string");
    expect((payload.details as string).length).toBeGreaterThan(0);
    builder.stop();
  });

  it("idleBehavior=clear never disconnects RPC (onClear arity = 0, no destroy signal)", () => {
    const clocks = makeFakeClocks({ randSeq: [0.1] });
    const cfg = defaultConfig({ idleBehavior: "clear" });
    const state: State = idleState();
    const onSet = vi.fn();
    const onClear = vi.fn();
    const builder = createActivityBuilder(
      {
        getState: () => state,
        getConfig: () => cfg,
        getPack: () => realPack,
        onSet,
        onClear,
        getIgnoreContext: () => ({}),
      },
      clocks,
    );
    builder.start();
    // onClear is called with zero args — it's a signal, not a destroy payload
    expect(onClear).toHaveBeenCalledWith();
    builder.stop();
  });

  it("onSet receives startTimestamp unchanged from state (STATE-05 carry-through)", () => {
    const clocks = makeFakeClocks({ randSeq: [0.5] });
    const state: State = agentActiveState({ startTimestamp: 1717171717000 });
    const onSet = vi.fn();
    const onClear = vi.fn();
    const builder = createActivityBuilder(
      {
        getState: () => state,
        getConfig: () => defaultConfig(),
        getPack: () => realPack,
        onSet,
        onClear,
        getIgnoreContext: () => ({}),
      },
      clocks,
    );
    builder.start();
    const payload = onSet.mock.calls[0][0] as SetActivity;
    expect(payload.startTimestamp).toBe(1717171717000);
    builder.stop();
  });

  it("stop() halts further onSet/onClear fires", () => {
    const clocks = makeFakeClocks({ randSeq: [0.5] });
    const state: State = agentActiveState();
    const onSet = vi.fn();
    const onClear = vi.fn();
    const builder = createActivityBuilder(
      {
        getState: () => state,
        getConfig: () => defaultConfig(),
        getPack: () => realPack,
        onSet,
        onClear,
        getIgnoreContext: () => ({}),
      },
      clocks,
    );
    builder.start();
    const setCount = onSet.mock.calls.length;
    builder.stop();
    clocks.advance(60_000);
    expect(onSet.mock.calls.length).toBe(setCount);
    expect(onClear).not.toHaveBeenCalled();
  });

  it("forceTick runs synchronously and emits a fresh onSet", () => {
    const clocks = makeFakeClocks({ randSeq: [0.5] });
    const state: State = agentActiveState();
    const onSet = vi.fn();
    const onClear = vi.fn();
    const builder = createActivityBuilder(
      {
        getState: () => state,
        getConfig: () => defaultConfig(),
        getPack: () => realPack,
        onSet,
        onClear,
        getIgnoreContext: () => ({}),
      },
      clocks,
    );
    builder.start();
    const before = onSet.mock.calls.length;
    builder.forceTick();
    expect(onSet.mock.calls.length).toBeGreaterThan(before);
    builder.stop();
  });

  it("config flip idleBehavior 'show' → 'clear' applies on next rotation tick", () => {
    const clocks = makeFakeClocks({ randSeq: [0.5] });
    const state: State = idleState();
    let cfg = defaultConfig({ idleBehavior: "show" });
    const onSet = vi.fn();
    const onClear = vi.fn();
    const builder = createActivityBuilder(
      {
        getState: () => state,
        getConfig: () => cfg,
        getPack: () => realPack,
        onSet,
        onClear,
        getIgnoreContext: () => ({}),
      },
      clocks,
    );
    builder.start(); // tick 0 renders IDLE pool
    expect(onSet).toHaveBeenCalledTimes(1);
    expect(onClear).not.toHaveBeenCalled();
    cfg = defaultConfig({ idleBehavior: "clear" });
    clocks.advance(20_000);
    expect(onClear).toHaveBeenCalledTimes(1);
    builder.stop();
  });

  it("never calls onSet with null or undefined payload (CONF-04 anti-pattern)", () => {
    const clocks = makeFakeClocks({ randSeq: [0.5] });
    const state: State = agentActiveState();
    const onSet = vi.fn();
    const onClear = vi.fn();
    const builder = createActivityBuilder(
      {
        getState: () => state,
        getConfig: () => defaultConfig(),
        getPack: () => realPack,
        onSet,
        onClear,
        getIgnoreContext: () => ({}),
      },
      clocks,
    );
    builder.start();
    for (let i = 0; i < 3; i++) clocks.advance(20_000);
    for (const call of onSet.mock.calls) {
      expect(call[0]).not.toBeNull();
      expect(call[0]).not.toBeUndefined();
      expect(typeof (call[0] as SetActivity).details).toBe("string");
      expect(((call[0] as SetActivity).details as string).length).toBeGreaterThan(0);
    }
    builder.stop();
  });
});
