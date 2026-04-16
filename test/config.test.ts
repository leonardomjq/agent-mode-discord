/**
 * Phase 4 / plan 04-06 — config reader tests.
 *
 * Requirements covered: CONF-02 (clientId blank → DEFAULT) + D-24 (lazy re-read, no caching)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type ConfigMap = Record<string, unknown>;
let currentConfig: ConfigMap = {};

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
}));

import { readConfig } from "../src/config";
import { DEFAULT_CLIENT_ID } from "../src/rpc/client";

describe("config reader", () => {
  beforeEach(() => {
    currentConfig = {};
  });

  it("agentMode.clientId blank string → readConfig returns DEFAULT_CLIENT_ID (CONF-02)", () => {
    currentConfig = { clientId: "" };
    expect(readConfig().clientId).toBe(DEFAULT_CLIENT_ID);
  });

  it("agentMode.clientId non-empty string → readConfig returns the user value (CONF-02)", () => {
    currentConfig = { clientId: "abc123" };
    expect(readConfig().clientId).toBe("abc123");
  });

  it("missing agentMode.clientId → readConfig returns DEFAULT_CLIENT_ID (CONF-02)", () => {
    currentConfig = {};
    expect(readConfig().clientId).toBe(DEFAULT_CLIENT_ID);
  });

  it("whitespace-only clientId falls back to DEFAULT_CLIENT_ID (CONF-02)", () => {
    currentConfig = { clientId: "   " };
    expect(readConfig().clientId).toBe(DEFAULT_CLIENT_ID);
  });

  it("all 14 config keys round-trip through readConfig with schema defaults matching package.json", () => {
    currentConfig = {};
    const cfg = readConfig();
    expect(cfg.clientId).toBe(DEFAULT_CLIENT_ID); // blank → DEFAULT
    expect(cfg.idleBehavior).toBe("show");
    expect(cfg.debug.verbose).toBe(false);
    expect(cfg.animations.enabled).toBe(true);
    expect(cfg.messages.customPackPath).toBe("");
    expect(cfg.privacy.workspaceName).toBe("show");
    expect(cfg.privacy.filename).toBe("show");
    expect(cfg.privacy.gitBranch).toBe("show");
    expect(cfg.ignore.workspaces).toEqual([]);
    expect(cfg.ignore.repositories).toEqual([]);
    expect(cfg.ignore.organizations).toEqual([]);
    expect(cfg.ignore.gitHosts).toEqual([]);
    expect(cfg.detect.customPatterns).toEqual({});
    expect(cfg.detect.sessionFileStalenessSeconds).toBe(60);
  });

  it("returns user overrides across all namespaces", () => {
    currentConfig = {
      clientId: "user-id",
      idleBehavior: "clear",
      "debug.verbose": true,
      "animations.enabled": false,
      "messages.customPackPath": "/tmp/pack.json",
      "privacy.workspaceName": "hash",
      "privacy.filename": "hide",
      "privacy.gitBranch": "hide",
      "ignore.workspaces": ["*/secret"],
      "ignore.repositories": ["^github\\.com/.*/private$"],
      "ignore.organizations": ["^acme$"],
      "ignore.gitHosts": ["gitlab.internal"],
      "detect.customPatterns": { aider: ["\\baider\\b"] },
      "detect.sessionFileStalenessSeconds": 120,
    };
    const cfg = readConfig();
    expect(cfg.clientId).toBe("user-id");
    expect(cfg.idleBehavior).toBe("clear");
    expect(cfg.debug.verbose).toBe(true);
    expect(cfg.animations.enabled).toBe(false);
    expect(cfg.messages.customPackPath).toBe("/tmp/pack.json");
    expect(cfg.privacy.workspaceName).toBe("hash");
    expect(cfg.privacy.filename).toBe("hide");
    expect(cfg.privacy.gitBranch).toBe("hide");
    expect(cfg.ignore.workspaces).toEqual(["*/secret"]);
    expect(cfg.ignore.repositories).toEqual(["^github\\.com/.*/private$"]);
    expect(cfg.ignore.organizations).toEqual(["^acme$"]);
    expect(cfg.ignore.gitHosts).toEqual(["gitlab.internal"]);
    expect(cfg.detect.customPatterns).toEqual({ aider: ["\\baider\\b"] });
    expect(cfg.detect.sessionFileStalenessSeconds).toBe(120);
  });

  it("readConfig is called fresh per tick (no module-level caching) — D-24", () => {
    currentConfig = { clientId: "first" };
    expect(readConfig().clientId).toBe("first");
    currentConfig = { clientId: "second" };
    expect(readConfig().clientId).toBe("second");
  });
});
