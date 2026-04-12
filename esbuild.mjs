import * as esbuild from "esbuild";
import { writeFileSync } from "node:fs";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const ctx = await esbuild.context({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  outfile: "dist/extension.cjs",
  external: ["vscode"],
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
