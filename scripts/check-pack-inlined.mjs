#!/usr/bin/env node
/**
 * Asserts that src/presence/goblin.json was inlined by esbuild into
 * dist/extension.cjs. Addresses 04-RESEARCH.md Pitfall 8 (silent JSON-loader
 * misconfig would ship an empty pack).
 *
 * Named script (reviewer R1) so the check is greppable + reproducible;
 * replaces ad-hoc `grep -q` in plan acceptance criteria.
 */
import { readFileSync, existsSync } from "node:fs";

const BUNDLE = "dist/extension.cjs";
if (!existsSync(BUNDLE)) {
  console.error(`FAIL: ${BUNDLE} not found — run \`pnpm build\` first.`);
  process.exit(1);
}

const src = readFileSync(BUNDLE, "utf8");

// Canonical strings that prove goblin.json was inlined by esbuild.
// Pick two distinct strings from D-05 so a partial embed would still fail.
const CANONICAL = ["letting it cook", "the agent is cooking"];
const missing = CANONICAL.filter((needle) => !src.includes(needle));
if (missing.length > 0) {
  console.error(`FAIL: goblin pack not inlined. Missing strings in ${BUNDLE}: ${missing.join(", ")}`);
  console.error("Verify esbuild JSON loader is enabled; see 04-RESEARCH.md Pitfall 8.");
  process.exit(1);
}

console.log(
  `PASS: goblin pack inlined (${CANONICAL.length}/${CANONICAL.length} canonical strings found in ${src.length} bytes).`,
);
