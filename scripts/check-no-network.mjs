#!/usr/bin/env node
/**
 * PRIV-07 / D-29 — zero-outbound-HTTP guardrail.
 *
 * Wave-0 skeleton: static grep of `dist/extension.cjs` for forbidden network
 * tokens. Exits 0 when bundle is absent (pre-build state — Wave 0 has no
 * src/presence yet). Plan 04-09 promotes this into a full runtime network-
 * traffic assertion (10-minute Extension Host window with null HTTP agent).
 *
 * Discord IPC (local Unix socket / Windows named pipe via `net.createConnection`
 * with a `path:` option) is not flagged here — it's not HTTP and is the
 * explicit allowed channel.
 */
import { readFileSync, existsSync } from "node:fs";

const BUNDLE = "dist/extension.cjs";

if (!existsSync(BUNDLE)) {
  console.log(`[no-network] SKIP — ${BUNDLE} missing (run pnpm build first)`);
  process.exit(0); // Wave 0 / pre-build safe exit
}

const src = readFileSync(BUNDLE, "utf8");

// Forbidden tokens — any outbound HTTP / fetch / transitive dep.
const FORBIDDEN = [
  /\bhttp\.request\b/,
  /\bhttps\.request\b/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\brequire\(["']undici["']\)/,
  /\bfrom\s+["']undici["']/,
  /\bfrom\s+["']node-fetch["']/,
  /\brequire\(["']node-fetch["']\)/,
  /\bnew URL\(["']https?:/,
];

let failed = false;
for (const re of FORBIDDEN) {
  const m = src.match(re);
  if (m) {
    console.error(`[no-network] FAIL — forbidden token matched: ${re}`);
    failed = true;
  }
}

if (failed) {
  console.error("[no-network] FAIL — zero-HTTP guarantee violated");
  process.exit(1);
}

console.log(
  `[no-network] PASS — scanned ${src.length} bytes of ${BUNDLE}; no outbound HTTP tokens found`,
);
