import * as esbuild from "esbuild";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

// Shim websocket-transport modules that @xhayper/discord-rpc pulls in but we
// never use (IPC-only at runtime). Without this, the bundle carries ~500 KB of
// undici + ws + @discordjs/rest code for code paths we never execute, blowing
// the 500 KB SKEL-02 guardrail. RESEARCH.md §1 calls out this exact mitigation.
const shimDir = resolve(__dirname, "build-shims");
mkdirSync(shimDir, { recursive: true });
const shimPath = resolve(shimDir, "empty.cjs");
writeFileSync(
  shimPath,
  "// Auto-generated esbuild shim. Phase 1 IPC-only transport never calls these modules.\n" +
    "module.exports = new Proxy({}, { get() { throw new Error('[agent-mode-discord] websocket transport not bundled — IPC only'); } });\n",
);

const ctx = await esbuild.context({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  outfile: "dist/extension.cjs",
  external: ["vscode"],
  alias: {
    // Shim unused websocket-transport deps. If the IPC code path ever reaches
    // one of these, the Proxy throws — failure is silent per PRD §8 (swallowed
    // by try/catch wrappers in src/rpc/client.ts).
    undici: shimPath,
    ws: shimPath,
    "@discordjs/rest": shimPath,
  },
  minify: production,
  sourcemap: !production,
  treeShaking: true,
  metafile: true,
  logLevel: "info",
});

if (watch) {
  await ctx.watch();
} else {
  const result = await ctx.rebuild();
  writeFileSync("dist/metafile.json", JSON.stringify(result.metafile, null, 2));
  await ctx.dispose();
}
