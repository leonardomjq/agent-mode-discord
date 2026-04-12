import * as vscode from "vscode";

/**
 * Entry point stub. Full activate/deactivate wiring lands in plan 01-02
 * when the RPC client adapter is introduced. This stub exists so esbuild
 * can produce dist/extension.cjs for the bundle-size guardrail.
 */
export function activate(_context: vscode.ExtensionContext): void {
  // Intentionally empty — see plan 01-02.
}

export function deactivate(): void {
  // Intentionally empty — see plan 01-02.
}
