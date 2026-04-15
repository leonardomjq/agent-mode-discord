#!/usr/bin/env node
/**
 * CONF-01 / D-22 — ≤20-key contributes.configuration guardrail.
 *
 * Wave-0 skeleton: counts properties under package.json
 * `contributes.configuration.properties` and asserts each has `title`,
 * `description`, `default`, and (where applicable) matching
 * `enumDescriptions` per D-23. Exits 0 when properties object is empty
 * (Wave-0 pre-manifest state).
 *
 * Plan 04-06 owns the full 20-key manifest edit; this script becomes a
 * required CI step then.
 */
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const props = pkg?.contributes?.configuration?.properties ?? {};
const keys = Object.keys(props);

if (keys.length === 0) {
  console.log("[config-keys] SKIP — contributes.configuration.properties empty (Wave 0)");
  process.exit(0);
}

if (keys.length > 20) {
  console.error(`[config-keys] FAIL — ${keys.length} keys > 20 cap (CONF-01 / D-22)`);
  process.exit(1);
}

let failed = false;
for (const k of keys) {
  const v = props[k];
  if (typeof v.title !== "string" || !v.title) {
    console.error(`[config-keys] FAIL — ${k} missing title`);
    failed = true;
  }
  if (typeof v.description !== "string") {
    console.error(`[config-keys] FAIL — ${k} missing description`);
    failed = true;
  }
  if (!("default" in v)) {
    console.error(`[config-keys] FAIL — ${k} missing default`);
    failed = true;
  }
  if (Array.isArray(v.enum)) {
    if (!Array.isArray(v.enumDescriptions)) {
      console.error(`[config-keys] FAIL — ${k} has enum but no enumDescriptions (D-23)`);
      failed = true;
    } else if (v.enumDescriptions.length !== v.enum.length) {
      console.error(
        `[config-keys] FAIL — ${k} enumDescriptions length ${v.enumDescriptions.length} ≠ enum length ${v.enum.length} (D-23)`,
      );
      failed = true;
    }
  }
}

if (failed) {
  console.error("[config-keys] FAIL — see errors above");
  process.exit(1);
}

console.log(
  `[config-keys] PASS — ${keys.length}/20 keys, all have title/description/default + enum→enumDescriptions`,
);
