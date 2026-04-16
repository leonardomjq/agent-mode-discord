/**
 * Config reader — VS Code settings adapter for `agentMode.*` (14 keys, CONF-01 / D-22).
 *
 * Reads are lazy: every animator rotation tick calls `readConfig()` directly
 * against `vscode.workspace.getConfiguration("agentMode")` — NO module-level
 * caching (D-24). The `onDidChangeConfiguration` listener wired in extension.ts
 * is a no-op; the next tick naturally picks up the new values (CONF-03 live
 * reload, worst-case latency = 20 s rotation interval).
 *
 * Pure-adapter: this file imports `vscode` and therefore is NOT pure-core.
 * Animator / templater / activityBuilder receive an `AgentModeConfig` value
 * and stay vscode-free.
 */
import * as vscode from "vscode";
import { DEFAULT_CLIENT_ID } from "./rpc/client";

export interface AgentModeConfig {
  clientId: string;
  idleBehavior: "show" | "clear";
  debug: { verbose: boolean };
  animations: { enabled: boolean };
  messages: { customPackPath: string };
  privacy: {
    workspaceName: "show" | "hide" | "hash";
    filename: "show" | "hide";
    gitBranch: "show" | "hide";
  };
  ignore: {
    workspaces: string[];
    repositories: string[];
    organizations: string[];
    gitHosts: string[];
  };
  detect: {
    customPatterns: Record<string, string[]>;
    sessionFileStalenessSeconds: number;
  };
}

export { DEFAULT_CLIENT_ID };

export function readConfig(): AgentModeConfig {
  const c = vscode.workspace.getConfiguration("agentMode");
  const clientIdRaw = c.get<string>("clientId", "") ?? "";
  return {
    clientId: clientIdRaw.trim() === "" ? DEFAULT_CLIENT_ID : clientIdRaw,
    idleBehavior: c.get<"show" | "clear">("idleBehavior", "show") ?? "show",
    debug: { verbose: c.get<boolean>("debug.verbose", false) ?? false },
    animations: { enabled: c.get<boolean>("animations.enabled", true) ?? true },
    messages: { customPackPath: c.get<string>("messages.customPackPath", "") ?? "" },
    privacy: {
      workspaceName:
        c.get<"show" | "hide" | "hash">("privacy.workspaceName", "show") ?? "show",
      filename: c.get<"show" | "hide">("privacy.filename", "show") ?? "show",
      gitBranch: c.get<"show" | "hide">("privacy.gitBranch", "show") ?? "show",
    },
    ignore: {
      workspaces: c.get<string[]>("ignore.workspaces", []) ?? [],
      repositories: c.get<string[]>("ignore.repositories", []) ?? [],
      organizations: c.get<string[]>("ignore.organizations", []) ?? [],
      gitHosts: c.get<string[]>("ignore.gitHosts", []) ?? [],
    },
    detect: {
      customPatterns:
        c.get<Record<string, string[]>>("detect.customPatterns", {}) ?? {},
      sessionFileStalenessSeconds:
        c.get<number>("detect.sessionFileStalenessSeconds", 60) ?? 60,
    },
  };
}
