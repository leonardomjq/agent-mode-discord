#!/usr/bin/env node
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const SRC_DIR = "src";
const PKG = "package.json";
const BAD_CAST = /\(\s*vscode\s+as\s+any\s*\)/;
const BAD_ANY = /\(\s*vscode\s*:\s*any\s*\)/;
const PROPOSED_API = "enabledApiProposals";

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
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
}

if (failed) {
  console.error("[api-surface] FAIL — see errors above");
  process.exit(1);
}
console.log(`[api-surface] PASS — scanned ${files.length} .ts files, no proposed-API or (vscode as any) usage`);
