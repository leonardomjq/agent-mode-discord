import * as esbuild from "esbuild";
import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from "node:fs";
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

// Minimal stub for @discordjs/rest. @xhayper/discord-rpc's Client constructor
// unconditionally does `new REST({ version: "10" }).setToken("...")` even in
// IPC mode, but IPC never actually makes REST calls. This stub satisfies the
// constructor signature without pulling in ~60 KB of REST/undici code.
const restShimPath = resolve(shimDir, "rest-stub.cjs");
writeFileSync(
  restShimPath,
  "// Auto-generated esbuild shim. IPC-only transport never invokes REST,\n" +
    "// but @xhayper/discord-rpc's READY handler writes `this.rest.options.cdn = ...`,\n" +
    "// so `options` must exist as a plain object.\n" +
    "class REST { constructor() { this.options = {}; } setToken() { return this; } }\n" +
    "module.exports = { REST };\n",
);

// goblin.json inlined via esbuild's default JSON loader (no explicit
// loader override below). Plan 04-05 verifies this via
// `scripts/check-pack-inlined.mjs`; plan 04-04 wires the `import goblin from
// "./goblin.json"` in activityBuilder.ts that forces the file into the bundle
// graph. See 04-RESEARCH.md Pitfall 8.
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
    // @discordjs/rest needs a real REST class (not a throwing Proxy) because
    // @xhayper/discord-rpc's Client constructor unconditionally instantiates
    // REST before transport selection. IPC mode never invokes it, so a minimal
    // no-op stub is enough and keeps the bundle under the 500 KB budget.
    "@discordjs/rest": restShimPath,
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

  // D-02: Aggregate third-party licenses from every node_modules input
  // esbuild walked into the bundle. Output: dist/THIRD_PARTY_LICENSES.md.
  // No new runtime deps — Node built-ins only (CONTEXT.md <code_context>).
  // pnpm virtual store paths look like:
  //   ../../../node_modules/.pnpm/<store-entry>/node_modules/<actual-pkg>/file.js
  // We use the last "node_modules/" segment to identify the real package root.
  const inputs = Object.keys(result.metafile.inputs ?? {});
  const pkgPaths = new Set();
  for (const input of inputs) {
    if (!input.includes("node_modules/")) continue;
    const parts = input.split("/");
    // Find the last occurrence of "node_modules" in the path segments.
    let lastNmIdx = -1;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i] === "node_modules") { lastNmIdx = i; break; }
    }
    if (lastNmIdx === -1) continue;
    const pkgNamePart = parts[lastNmIdx + 1];
    if (!pkgNamePart || pkgNamePart === ".pnpm") continue; // skip .pnpm store-entry segment
    // Build a relative path from __dirname to the package root (handles pnpm store layout).
    const pkgRootSegments = parts.slice(0, lastNmIdx + 1 + (pkgNamePart.startsWith("@") ? 2 : 1));
    pkgPaths.add(pkgRootSegments.join("/"));
  }

  const sections = [];
  for (const pkgPath of [...pkgPaths].sort()) {
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(resolve(__dirname, pkgPath, "package.json"), "utf8"));
    } catch {
      continue; // package.json missing — skip silently
    }
    const name = manifest.name ?? pkgPath.replace(/^node_modules\//, "");
    const version = manifest.version ?? "unknown";
    const licenseField =
      typeof manifest.license === "string"
        ? manifest.license
        : manifest.license?.type ?? "UNKNOWN";

    // Prefer LICENSE / LICENSE.md / LICENSE.txt file body; fall back to SPDX identifier.
    let licenseText = "";
    const licenseCandidates = ["LICENSE", "LICENSE.md", "LICENSE.txt", "license", "license.md"];
    try {
      const entries = readdirSync(resolve(__dirname, pkgPath));
      const match = licenseCandidates.find((c) => entries.includes(c));
      if (match) {
        licenseText = readFileSync(resolve(__dirname, pkgPath, match), "utf8").trim();
      }
    } catch {
      /* ignore — fall through to SPDX */
    }

    sections.push(
      `## ${name}@${version}\n\n` +
        `**License:** ${licenseField}\n\n` +
        (licenseText
          ? "```\n" + licenseText + "\n```\n"
          : "_No LICENSE file found in package; license identifier above is from package.json._\n"),
    );
  }

  const header =
    `# Third-Party Licenses\n\n` +
    `This file lists licenses for every npm package bundled into ` +
    `\`dist/extension.cjs\` by esbuild. Generated automatically on every ` +
    `production build (\`pnpm build\`). Do not edit by hand.\n\n` +
    `**Total bundled packages:** ${sections.length}\n\n---\n\n`;

  writeFileSync("dist/THIRD_PARTY_LICENSES.md", header + sections.join("\n---\n\n"));
  console.log(`[esbuild] wrote dist/THIRD_PARTY_LICENSES.md (${sections.length} packages)`);

  await ctx.dispose();
}
