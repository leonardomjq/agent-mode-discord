#!/usr/bin/env node
/**
 * PRIV-07 / D-29 — zero-outbound-HTTP guardrail (Plan 04-09).
 *
 * Static grep of the built bundle (default: dist/extension.cjs) for the
 * FORBIDDEN list of outbound-HTTP surface references. Any match exits 1.
 * Accepts an optional path argument so a negative-test fixture can be fed
 * in to prove the guard fails when a violation is introduced — see
 * scripts/__fixtures__/forbidden-fixture.cjs.
 *
 * FORBIDDEN list (reviewer R2 — exact; no WARN path for HTTP surface):
 *   - http.request( / https.request(             : direct Node core HTTP calls
 *   - require('http') / require('node:http')     : loading the HTTP stdlib
 *   - require('https') / require('node:https')   : loading the HTTPS stdlib
 *   - import from 'http'/'https'/'node:http'/'node:https' : ESM HTTP stdlib
 *   - require/import of undici/got/axios/node-fetch : known HTTP libs
 *   - new XMLHttpRequest                          : web-style HTTP
 *   - globalThis.fetch                            : global fetch access
 *   - fetch(                                      : any fetch call site (R2: promoted WARN→FAIL)
 *
 * IPC exemption (documented, not whitelisted):
 *   @xhayper/discord-rpc uses `net.createConnection({ path: "/tmp/discord-ipc-N" })`
 *   on POSIX and `\\?\pipe\discord-ipc-N` on win32. That call is NOT in
 *   FORBIDDEN — it never opens a TCP/HTTP socket. The FAIL gate is strictly
 *   the FORBIDDEN list above; we additionally sweep for the TCP variant
 *   `net.createConnection/connect(...host: ...)` as a WARN — requires
 *   manual review (IPC path: form is fine; host: form is TCP and suspicious).
 *
 * Runtime cost: <100 ms for a 218 KB bundle. CI-portable, deterministic.
 *
 * The 10-minute runtime intercept (Option 1 full from 04-RESEARCH.md §Pattern 7)
 * is NOT implemented here — it requires @vscode/test-electron + a network-
 * blocking harness + extension-host lifecycle orchestration. Deferred to v0.2.
 */
import { readFileSync, existsSync } from "node:fs";

const target = process.argv[2] ?? "dist/extension.cjs";

if (!existsSync(target)) {
  console.error(`[no-network] FAIL — ${target} not found (run \`pnpm build\` first).`);
  process.exit(1);
}

const src = readFileSync(target, "utf8");

// FORBIDDEN list — every entry annotated with a reason per reviewer R2.
const FORBIDDEN = [
  { re: /\bhttp\.request\s*\(/g, reason: "http.request() call" },
  { re: /\bhttps\.request\s*\(/g, reason: "https.request() call" },
  { re: /\brequire\(["']http["']\)/g, reason: "require('http')" },
  { re: /\brequire\(["']https["']\)/g, reason: "require('https')" },
  { re: /\brequire\(["']node:http["']\)/g, reason: "require('node:http')" },
  { re: /\brequire\(["']node:https["']\)/g, reason: "require('node:https')" },
  { re: /\brequire\(["']undici["']\)/g, reason: "require('undici')" },
  { re: /\brequire\(["']got["']\)/g, reason: "require('got')" },
  { re: /\brequire\(["']axios["']\)/g, reason: "require('axios')" },
  { re: /\brequire\(["']node-fetch["']\)/g, reason: "require('node-fetch')" },
  { re: /\bfrom\s+["'](node:)?https?["']/g, reason: "import from 'http'/'https'/'node:http'/'node:https'" },
  { re: /\bfrom\s+["']undici["']/g, reason: "import from 'undici'" },
  { re: /\bfrom\s+["']axios["']/g, reason: "import from 'axios'" },
  { re: /\bfrom\s+["']got["']/g, reason: "import from 'got'" },
  { re: /\bfrom\s+["']node-fetch["']/g, reason: "import from 'node-fetch'" },
  { re: /\bnew\s+XMLHttpRequest\b/g, reason: "new XMLHttpRequest" },
  { re: /\bglobalThis\.fetch\b/g, reason: "globalThis.fetch access" },
  { re: /\bfetch\s*\(/g, reason: "fetch( call — reviewer R2 promoted WARN→FAIL" },
];

// IPC-vs-TCP heuristic: net.createConnection / net.connect with a nearby
// `host:` literal = TCP call = WARN (manual review). The `path:` form is IPC
// and is the allowed Discord channel — those calls never have `host:` nearby
// so they pass through silently.
const TCP_NET_HEURISTIC = /\bnet\.(createConnection|connect)\s*\([^)]{0,120}\bhost\s*:/g;

let failed = false;
for (const { re, reason } of FORBIDDEN) {
  const matches = src.match(re);
  if (matches && matches.length > 0) {
    // Surrounding-context sample for CI logs — first match, ±40 chars.
    const idx = src.search(re);
    const sample = src
      .slice(Math.max(0, idx - 20), Math.min(src.length, idx + 60))
      .replace(/\s+/g, " ");
    console.error(
      `[no-network] FAIL — ${matches.length}× ${reason} (${re}) in ${target}. Sample: ...${sample}...`,
    );
    failed = true;
  }
}

const tcpMatches = src.match(TCP_NET_HEURISTIC);
if (tcpMatches && tcpMatches.length > 0) {
  console.warn(
    `[no-network] WARN — ${tcpMatches.length}× net.createConnection/connect() co-located with host: literal. ` +
      "Verify this is NOT a TCP HTTP call. IPC (path: form) is the allowed Discord channel.",
  );
}

if (failed) {
  console.error(
    `\n[no-network] PRIV-07 violation: bundle contains forbidden HTTP surface. See matches above.`,
  );
  process.exit(1);
}
console.log(
  `[no-network] PASS — zero outbound HTTP patterns in ${target} (${src.length} bytes scanned)`,
);
