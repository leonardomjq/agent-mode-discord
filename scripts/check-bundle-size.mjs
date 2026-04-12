#!/usr/bin/env node
import { readFileSync } from "node:fs";

const THRESHOLD_BYTES = 500 * 1024; // 500 KB
const METAFILE = "dist/metafile.json";

let meta;
try {
  meta = JSON.parse(readFileSync(METAFILE, "utf8"));
} catch (e) {
  console.error(`[bundle-size] FAIL — could not read ${METAFILE}: ${e.message}`);
  console.error("[bundle-size] Did you run `pnpm build` first?");
  process.exit(1);
}

const out = meta.outputs?.["dist/extension.cjs"];
if (!out) {
  console.error("[bundle-size] FAIL — no entry for dist/extension.cjs in metafile");
  process.exit(1);
}

const size = out.bytes;
const pct = ((size / THRESHOLD_BYTES) * 100).toFixed(1);
const status = size <= THRESHOLD_BYTES ? "PASS" : "FAIL";

console.log(`[bundle-size] ${status}`);
console.log(`[bundle-size] dist/extension.cjs: ${size} bytes (${(size / 1024).toFixed(1)} KB)`);
console.log(`[bundle-size] threshold: ${THRESHOLD_BYTES} bytes (500.0 KB)`);
console.log(`[bundle-size] usage: ${pct}% of threshold`);

if (size > THRESHOLD_BYTES) {
  console.error(`[bundle-size] FAIL — bundle is ${size - THRESHOLD_BYTES} bytes over threshold`);
  process.exit(1);
}
