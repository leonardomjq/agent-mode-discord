/**
 * Phase 4 / plan 04-06 — outputChannel tests.
 *
 * Requirements covered: CONF-05 (debug-verbose gated), D-28 (no toasts, silent on error)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type ConfigMap = Record<string, unknown>;
let currentConfig: ConfigMap = {};

const appendLineMock = vi.fn();
const disposeMock = vi.fn();
const createOutputChannelMock = vi.fn((name: string) => ({
  name,
  appendLine: appendLineMock,
  dispose: disposeMock,
}));

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: (section: string) => {
      if (section !== "agentMode") return { get: () => undefined };
      return {
        get<T>(key: string, defaultValue?: T): T | undefined {
          if (key in currentConfig) return currentConfig[key] as T;
          return defaultValue;
        },
      };
    },
  },
  window: {
    createOutputChannel: (name: string) => createOutputChannelMock(name),
  },
}));

import { getOutputChannel, log, __resetForTest } from "../src/outputChannel";

describe("outputChannel", () => {
  beforeEach(() => {
    currentConfig = {};
    appendLineMock.mockClear();
    disposeMock.mockClear();
    createOutputChannelMock.mockClear();
    __resetForTest();
  });

  it("channel name is 'Agent Mode (Discord)' per Claude's Discretion", () => {
    const ch = getOutputChannel();
    expect(createOutputChannelMock).toHaveBeenCalledTimes(1);
    expect(createOutputChannelMock).toHaveBeenCalledWith("Agent Mode (Discord)");
    expect(ch.name).toBe("Agent Mode (Discord)");
  });

  it("getOutputChannel is a singleton — subsequent calls reuse the same instance", () => {
    const a = getOutputChannel();
    const b = getOutputChannel();
    expect(a).toBe(b);
    expect(createOutputChannelMock).toHaveBeenCalledTimes(1);
  });

  it("debug.verbose=false suppresses appendLine calls (CONF-05)", () => {
    currentConfig = { "debug.verbose": false };
    log("hello");
    expect(appendLineMock).not.toHaveBeenCalled();
  });

  it("debug.verbose=true forwards appendLine to the underlying channel (CONF-05)", () => {
    currentConfig = { "debug.verbose": true };
    log("hello");
    expect(appendLineMock).toHaveBeenCalledTimes(1);
    expect(appendLineMock.mock.calls[0][0]).toMatch(/hello/);
  });

  it("log({ verboseOnly: false }) always appendLines regardless of debug.verbose", () => {
    currentConfig = { "debug.verbose": false };
    log("critical", { verboseOnly: false });
    expect(appendLineMock).toHaveBeenCalledTimes(1);
    expect(appendLineMock.mock.calls[0][0]).toMatch(/critical/);
  });

  it("log() never throws even if appendLine blows up (D-28)", () => {
    currentConfig = { "debug.verbose": true };
    appendLineMock.mockImplementationOnce(() => {
      throw new Error("channel disposed");
    });
    expect(() => log("boom")).not.toThrow();
  });
});
