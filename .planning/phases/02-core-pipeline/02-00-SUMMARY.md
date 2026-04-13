---
phase: "02"
plan: "00"
subsystem: "test-scaffolding"
tags: [infra, test-scaffolding, check-api-surface, nyquist, wave-0]
dependency_graph:
  requires: []
  provides:
    - "test/state.machine.test.ts — 9 it.todo stubs for STATE-01..05 + buildContext (D-06)"
    - "test/rpc.throttle.test.ts — 5 it.todo stubs for RPC-02 / STATE-06"
    - "test/rpc.client.backoff.test.ts — 9 it.todo stubs for RPC-01/03/04/05 + backoff ladder"
    - "test/privacy.test.ts — 4 it.todo stubs for show/hide/hash/unknown-mode"
    - "test/detectors.editor.test.ts — 5 it.todo stubs with vi.mock(vscode) hoisted"
    - "test/detectors.git.test.ts — 5 it.todo stubs with vi.mock(vscode) + git extension stub"
    - "scripts/check-api-surface.mjs — extended with path-scoped vscode-import ban (D-16)"
    - ".planning/phases/02-core-pipeline/02-HUMAN-UAT.md — SC-1/SC-3/SC-4 dev-host checklist"
  affects:
    - "02-01 through 02-07 — all downstream plans reference test files created here"
    - "CI — check-api-surface now enforces pure-core boundary for all future src/state/**, src/rpc/throttle.ts, src/privacy.ts"
tech_stack:
  added: []
  patterns:
    - "vi.mock('vscode', ...) hoisted at top level in detector test files"
    - "it.todo() stubs for pre-written test contracts (Nyquist rule)"
    - "path-scoped regex guard in check-api-surface.mjs for pure-core boundary (D-16)"
key_files:
  created:
    - test/state.machine.test.ts
    - test/rpc.throttle.test.ts
    - test/rpc.client.backoff.test.ts
    - test/privacy.test.ts
    - test/detectors.editor.test.ts
    - test/detectors.git.test.ts
    - .planning/phases/02-core-pipeline/02-HUMAN-UAT.md
  modified:
    - scripts/check-api-surface.mjs
decisions:
  - "All six test files use it.todo() so pnpm test stays green before src modules land (Nyquist rule)"
  - "check-api-surface.mjs bans ALL runtime vscode imports (not just type-only) in pure-core paths — enforces D-16 strictly before any src/state/** or src/rpc/throttle.ts file is written"
  - "BAD_CAST broadened to catch 'vscode as unknown as any' double-cast pattern (01-REVIEW IN-03)"
  - "walk() hardened against node_modules/dist/build-shims/dotfile descent (01-REVIEW IN-04)"
  - "Poison-test proves guard fires: src/state/_poison.ts with 'import * as vscode from vscode' caused exit 1, deleted before commit"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-13"
  tasks_completed: 3
  tasks_total: 3
  files_created: 7
  files_modified: 1
---

# Phase 02 Plan 00: Wave-0 Test Scaffolding + Pure-Core Guard Summary

**One-liner:** Six vitest stub files (37 it.todo placeholders) + path-scoped vscode-import ban in check-api-surface.mjs + SC-1/SC-3/SC-4 dev-host UAT checklist — Nyquist contract locked before any src module lands.

---

## What Was Built

### Task 1 — Six vitest test stub files (commit `da9dc52`)

All six test files created with `describe` blocks and `it.todo` placeholders. `pnpm test` reports 37 todo + 5 existing smoke tests passing (exit 0). No `src/` imports — stubs compile cleanly.

| File | describe name | it.todo count |
|------|--------------|---------------|
| `test/state.machine.test.ts` | `"state machine reducer"` | 9 |
| `test/rpc.throttle.test.ts` | `"rpc throttle — leading + trailing + last-wins"` | 5 |
| `test/rpc.client.backoff.test.ts` | `"connection manager backoff"` | 9 |
| `test/privacy.test.ts` | `"privacy.redact"` | 4 |
| `test/detectors.editor.test.ts` | `"editor detector"` | 5 |
| `test/detectors.git.test.ts` | `"git detector"` | 5 |
| **Total** | | **37** |

Both detector test files include top-level `vi.mock("vscode", ...)` hoisted before any imports, matching the vscode interception pattern from Phase 1 smoke tests.

### Task 2 — Extended check-api-surface.mjs (commit `67fbfc3`)

**New constants added:**

```javascript
const VSCODE_RUNTIME_IMPORT = /^\s*import\s+(?!type\b)(?:\*\s+as\s+\w+\s+|\{[^}]*\}\s+|\w+\s+)?from\s+["']vscode["']/m;
const PURE_CORE_PATHS = ["src/state/", "src/rpc/throttle.ts", "src/privacy.ts"];
```

**New enforcement path:** After BAD_CAST/BAD_ANY checks in the file loop:
```javascript
if (isPureCore(file) && VSCODE_RUNTIME_IMPORT.test(content)) {
  console.error(`[api-surface] FAIL — ${file} imports vscode at runtime; pure-core boundary violated (D-16)`);
  failed = true;
}
```

**Additional hardening:**
- `BAD_CAST` broadened from `\(\s*vscode\s+as\s+any\s*\)` to `/\bvscode\s+as\s+(?:unknown\s+as\s+)?any\b/` (catches double-cast pattern, per 01-REVIEW IN-03)
- `walk()` now skips `node_modules`, `dist`, `build-shims`, dotfiles (per 01-REVIEW IN-04)
- PASS message updated to report pure-core file count

**Poison-test result:**
- Created `src/state/_poison.ts` containing `import * as vscode from "vscode";`
- `pnpm check:api-surface` exited 1 with: `[api-surface] FAIL — src/state/_poison.ts imports vscode at runtime; pure-core boundary violated (D-16)`
- Poison file deleted; final `pnpm check:api-surface` exits 0: `PASS — scanned 2 .ts files (0 pure-core), no proposed-API / (vscode as any) / pure-core vscode-import violations`

### Task 3 — 02-HUMAN-UAT.md (commit `8b6687f`)

Three manual-only dev-host verification checklists authored:

| Checklist | Requirement | Scenario |
|-----------|-------------|----------|
| 1 — IDLE transition on timer | STATE-02 / SC-1 | Open file → wait 5 min 10 s → verify IDLE in Discord sidebar |
| 2 — Discord kill/restart replay | RPC-03 + RPC-04 / SC-3 | `killall Discord` → observe backoff ladder in Output → relaunch → verify replay |
| 3 — Two-window pid isolation | RPC-01 / SC-4 | Two Dev Host windows, two files, two independent Discord activities; close one, other persists |

Sign-off matrix included with Discord version, OS/VS Code version, and observer fields.

---

## Full Guardrail Suite Result

All five commands pass after all three task commits:

```
pnpm test        — 5 passed, 37 todo (exit 0)
pnpm typecheck   — exit 0
pnpm build       — exit 0 (dist/extension.cjs: 196.5 KB, 39.3% of 500 KB threshold)
pnpm check:bundle-size — PASS (201255 bytes)
pnpm check:api-surface — PASS (2 .ts files, 0 pure-core)
```

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

All test files are intentional stubs (`it.todo`) — they will be wired to real implementations in plans 02-01 through 02-07 respectively. These stubs satisfy the Nyquist rule: every downstream plan's `<automated>` targets a test file that already exists before the src module is written.

---

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. The check-api-surface.mjs hardening reduces attack surface (D-16 enforcement).

---

## Self-Check

### Created files exist:
- `test -f test/state.machine.test.ts` — FOUND
- `test -f test/rpc.throttle.test.ts` — FOUND
- `test -f test/rpc.client.backoff.test.ts` — FOUND
- `test -f test/privacy.test.ts` — FOUND
- `test -f test/detectors.editor.test.ts` — FOUND
- `test -f test/detectors.git.test.ts` — FOUND
- `test -f .planning/phases/02-core-pipeline/02-HUMAN-UAT.md` — FOUND

### Modified files exist:
- `test -f scripts/check-api-surface.mjs` — FOUND (modified with PURE_CORE_PATHS, VSCODE_RUNTIME_IMPORT, isPureCore, node_modules guard)

### Commits exist:
- `da9dc52` — feat(02-00): create six vitest test stub files
- `67fbfc3` — feat(02-00): extend check-api-surface.mjs with path-scoped vscode-import ban (D-16)
- `8b6687f` — chore(02-00): author 02-HUMAN-UAT.md with three manual dev-host verification checklists

## Self-Check: PASSED
