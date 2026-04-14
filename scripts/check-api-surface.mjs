#!/usr/bin/env node
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const SRC_DIR = "src";
const PKG = "package.json";
// Broadened per 01-REVIEW IN-03: catches `vscode as unknown as any` double-cast pattern too.
const BAD_CAST = /\bvscode\s+as\s+(?:unknown\s+as\s+)?any\b/;
const BAD_ANY = /\(\s*vscode\s*:\s*any\s*\)/;
const PROPOSED_API = "enabledApiProposals";

// Path-scoped vscode-import ban (D-16). Pure-core modules MUST NOT import vscode at runtime.
// Type-only imports (`import type ...`) are erased by the TS compiler and are allowed, but
// for Phase 2 strictness we ban ALL forms under these paths — pure-core should not even
// need vscode types (State / Event are defined in src/state/types.ts with zero vscode refs).
const VSCODE_RUNTIME_IMPORT = /^\s*import\s+(?!type\b)(?:\*\s+as\s+\w+\s+|\{[^}]*\}\s+|\w+\s+)?from\s+["']vscode["']/m;
const PURE_CORE_PATHS = ["src/state/", "src/rpc/throttle.ts", "src/privacy.ts", "src/detectors/regex.ts"];

function isPureCore(file) {
  // Normalize path separators for cross-platform matching.
  const norm = file.split("\\").join("/");
  return PURE_CORE_PATHS.some((p) => norm === p || norm.startsWith(p));
}

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === "build-shims" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".ts")) out.push(full);
  }
  return out;
}

let failed = false;

// 1. package.json must not contain a non-empty enabledApiProposals
try {
  const pkg = JSON.parse(readFileSync(PKG, "utf8"));
  if (PROPOSED_API in pkg && Array.isArray(pkg[PROPOSED_API]) && pkg[PROPOSED_API].length > 0) {
    console.error(`[api-surface] FAIL — package.json has non-empty ${PROPOSED_API}`);
    failed = true;
  }
} catch (e) {
  console.error(`[api-surface] FAIL — could not read package.json: ${e.message}`);
  process.exit(1);
}

// 2. No (vscode as any) or (vscode: any) casts in src/**/*.ts
// 3. No vscode runtime imports in pure-core modules (D-16)
const files = walk(SRC_DIR);
for (const file of files) {
  const content = readFileSync(file, "utf8");
  if (BAD_CAST.test(content)) {
    console.error(`[api-surface] FAIL — ${file} contains (vscode as any) cast`);
    failed = true;
  }
  if (BAD_ANY.test(content)) {
    console.error(`[api-surface] FAIL — ${file} contains (vscode: any) cast`);
    failed = true;
  }
  if (isPureCore(file) && VSCODE_RUNTIME_IMPORT.test(content)) {
    console.error(`[api-surface] FAIL — ${file} imports vscode at runtime; pure-core boundary violated (D-16)`);
    failed = true;
  }
}

if (failed) {
  console.error("[api-surface] FAIL — see errors above");
  process.exit(1);
}
console.log(`[api-surface] PASS — scanned ${files.length} .ts files (${files.filter(isPureCore).length} pure-core), no proposed-API / (vscode as any) / pure-core vscode-import violations`);
