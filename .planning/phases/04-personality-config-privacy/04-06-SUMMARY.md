---
phase: "04"
plan: "06"
subsystem: config-outputchannel-manifest
tags: [config, package-json, output-channel, live-reload, manifest, wave-1]
dependency_graph:
  requires:
    - test/config.test.ts (04-00 stub)
    - test/outputChannel.test.ts (04-00 stub)
    - scripts/check-config-keys.mjs (04-00 skeleton)
    - src/rpc/client.ts DEFAULT_CLIENT_ID (01-XX)
  provides:
    - package.json contributes.configuration (14 keys, CONF-01)
    - src/config.ts AgentModeConfig + readConfig()
    - src/outputChannel.ts getOutputChannel() + log()
    - scripts/check-config-keys.mjs enumDescriptions length parity
  affects:
    - 04-02 animator (imports AgentModeConfig for rotation-tick re-read)
    - 04-04 activityBuilder (reads privacy/ignore/animations branches)
    - 04-07 privacy (consumes ignore.* and privacy.* branches)
    - 04-08 extension wiring (registers onDidChangeConfiguration no-op + owns output channel lifecycle)
tech_stack:
  added: []
  patterns:
    - lazy getConfiguration per tick (no caching, D-24) for CONF-03 live reload
    - singleton OutputChannel with debug-verbose-gated log + try/catch swallow (D-28)
    - re-export DEFAULT_CLIENT_ID from adapter so consumers import from one place
    - Wave-0 skeleton tightened in-place (length-parity assertion) rather than rewritten
key_files:
  created:
    - src/config.ts
    - src/outputChannel.ts
  modified:
    - package.json (contributes.configuration: 14 keys)
    - test/config.test.ts (7 assertions, flipped from 5 it.todo)
    - test/outputChannel.test.ts (6 assertions, flipped from 4 it.todo)
    - scripts/check-config-keys.mjs (enumDescriptions length parity)
decisions:
  - Added description field to every key (including privacy.filename, privacy.gitBranch, ignore.organizations, ignore.gitHosts, detect.sessionFileStalenessSeconds) even though the RESEARCH.md sketch omitted some — the check-config-keys script requires description on every key (CONF-01 invariant), and the Wave-0 skeleton would have SKIP'd until now; keeping description mandatory catches drift in future edits
  - Whitespace-only clientId also resolves to DEFAULT_CLIENT_ID (not just literal empty string) — users copy-pasting a value with trailing whitespace shouldn't silently produce a broken connection; CONF-02 "blank" semantically includes whitespace-only
  - Re-exported DEFAULT_CLIENT_ID from src/config.ts so Wave-2 consumers (activityBuilder, extension.ts) can `import { readConfig, DEFAULT_CLIENT_ID } from "./config"` instead of reaching into the rpc/ subtree directly
  - Kept Wave-0 SKIP-on-empty-properties branch in check-config-keys.mjs as defensive dead code; removing it would regress if someone temporarily blanks the manifest (e.g. during a refactor)
  - Test mocks preserve flat-key shape (`debug.verbose` as a single string key) to match how VS Code's workspaceConfig.get() actually returns nested paths, rather than building a nested object fake
metrics:
  duration: ~7min
  completed: 2026-04-15
  tasks: 3
  commits: 4
---

# Phase 4 Plan 06: Config + OutputChannel + 14-key Manifest Summary

Ships the three config-adjacent artifacts every Wave-2 plan (04-02 animator, 04-04 activityBuilder, 04-07 privacy, 04-08 extension wiring) depends on: the 14-key `contributes.configuration` manifest in `package.json`, a lazy `readConfig()` adapter, and a debug-verbose-gated `"Agent Mode (Discord)"` output channel. Also tightens the Wave-0 config-keys guardrail so `enumDescriptions.length === enum.length` is enforced at CI.

## What Shipped

- **`package.json contributes.configuration` (14 keys)** — full manifest under `agentMode.*` nested namespace (D-21) grouped by namespace, alphabetical within group. 6 spare slots remain under the 20-key cap (CONF-01 / D-22). Keys: `clientId`, `idleBehavior`, `debug.verbose`, `animations.enabled`, `messages.customPackPath`, `privacy.{filename,gitBranch,workspaceName}`, `ignore.{gitHosts,organizations,repositories,workspaces}`, `detect.{customPatterns,sessionFileStalenessSeconds}`. Every key carries `title` + `description` + `default`. The 4 enum keys (`idleBehavior`, `privacy.filename`, `privacy.gitBranch`, `privacy.workspaceName`) carry matching `enumDescriptions`. `detect.sessionFileStalenessSeconds` enforces `minimum: 10 / maximum: 300`.
- **`src/config.ts` (70 lines)** — exports `AgentModeConfig` interface, `readConfig()` function, and re-exports `DEFAULT_CLIENT_ID` for consumer convenience. `readConfig()` calls `vscode.workspace.getConfiguration("agentMode")` on every invocation (no caching, D-24); the animator's rotation tick is what drives CONF-03 live-reload latency (worst-case 20 s). Blank or whitespace-only `clientId` resolves to `DEFAULT_CLIENT_ID` (CONF-02).
- **`src/outputChannel.ts` (38 lines)** — exports `getOutputChannel()` (singleton `"Agent Mode (Discord)"` channel via `vscode.window.createOutputChannel`), `log(line, { verboseOnly? })` (default `verboseOnly=true` gates on `debug.verbose`; `verboseOnly=false` force-logs for critical paths), and a test-only `__resetForTest()` helper. `appendLine` is wrapped in `try/catch` so a disposed channel mid-log stays silent (D-28: no toasts, never crash).
- **`scripts/check-config-keys.mjs`** — tightened so `Array.isArray(v.enumDescriptions) && v.enumDescriptions.length === v.enum.length` (Task 3 action spec). Error message reports both lengths. Wave-0 SKIP-on-empty branch retained as defensive dead code.
- **13 passing tests** across `test/config.test.ts` (7) and `test/outputChannel.test.ts` (6), flipped from 9 `it.todo` stubs:
  - `config.test.ts`: blank → DEFAULT, whitespace → DEFAULT, non-empty override, missing key → DEFAULT, all-key default round-trip (CONF-01/CONF-02), all-key user-override round-trip, lazy re-read across changing backing config (D-24).
  - `outputChannel.test.ts`: channel-name check, singleton identity, `debug.verbose=false` suppresses `appendLine`, `debug.verbose=true` forwards with timestamp, `verboseOnly:false` forces log, `appendLine` throw is swallowed (D-28).

## Verification

| Gate | Result |
|------|--------|
| `pnpm test --run test/config.test.ts test/outputChannel.test.ts` | PASS (13 passed) |
| `pnpm test` (full suite) | PASS (204 passed / 30 todo across 19 files) |
| `pnpm typecheck` | PASS |
| `pnpm build` | PASS |
| `pnpm check:bundle-size` | PASS (207.5 KB / 41.5% of 500 KB — no delta, config.ts not yet in bundle graph) |
| `pnpm check:api-surface` | PASS (9 pure-core files, zero violations — config.ts + outputChannel.ts correctly excluded) |
| `pnpm check:config-keys` | PASS (14/20 keys, every key has title/description/default + enum→enumDescriptions matched lengths) |
| Spot-check (remove title) | FAIL as expected (exit 1, "agentMode.clientId missing title") |
| Spot-check (shorten enumDescriptions) | FAIL as expected (exit 1, "enumDescriptions length 1 ≠ enum length 2") |
| `wc -l src/config.ts` | 70 (< 150 target) |
| `wc -l src/outputChannel.ts` | 38 (< 80 target) |
| `grep -c "export function readConfig" src/config.ts` | 1 |
| `grep -c "export function getOutputChannel" src/outputChannel.ts` | 1 |
| `grep -c "export function log" src/outputChannel.ts` | 1 |
| `grep -c "DEFAULT_CLIENT_ID" src/config.ts` | 3 (import + resolve + re-export) |
| `grep -c '"agentMode\\.clientId"' package.json` | 1 |
| `grep -c '"agentMode\\.ignore\\.workspaces"' package.json` | 1 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing node_modules**
- **Found during:** Task 2 RED verification (`pnpm test` failed with `vitest: command not found`; lockfile present, node_modules absent — standard worktree state).
- **Fix:** Ran `pnpm install` (758 ms from lockfile, no version changes).
- **Scope:** dependency install only.
- **Commit:** n/a (no source changes).

**2. [Rule 2 - Missing critical functionality] Descriptions added to every config key**
- **Found during:** Task 1 (authoring the manifest from the RESEARCH sketch).
- **Issue:** The RESEARCH.md sketch at lines 675-762 omits `description` on 5 of the 14 keys (privacy.filename, privacy.gitBranch, ignore.organizations, ignore.gitHosts, detect.sessionFileStalenessSeconds). The plan's acceptance criteria require every key to have `title + description + default`, and `scripts/check-config-keys.mjs` enforces it at CI.
- **Fix:** Authored descriptive one-sentence `description` strings for all 5 keys, matching the tone of the existing ones (e.g. "Regex patterns matched against the normalized host/owner segment of the current repository." for `ignore.organizations`).
- **Commit:** 7113a8b.

### Non-deviating refinements

- **Whitespace-only clientId → DEFAULT.** Plan interface text says "blank string → DEFAULT"; implementation uses `trim() === ""` so copy-paste with whitespace still resolves. Added explicit test `"whitespace-only clientId falls back to DEFAULT_CLIENT_ID (CONF-02)"`.
- **Re-exported `DEFAULT_CLIENT_ID` from `src/config.ts`.** Gives Wave-2 consumers one import surface (`./config`) rather than forcing them to reach into `./rpc/client`. Doc comment notes the re-export.
- **Tightened `check-config-keys.mjs` enum-length parity** per plan Task 3 action text. Wave-0 skeleton only verified presence of `enumDescriptions`; plan spec requires `.length === enum.length`. Adds one defensive branch (10 lines total).

## Threat Mitigation

| Threat ID | Disposition | Evidence |
|-----------|-------------|----------|
| T-04-03 (ReDoS via ignore.repositories/organizations) | transfer — pass-through only | `readConfig()` returns arrays verbatim; no regex compilation; regex compile with length-truncate + try/catch lives in plan 04-07 |
| T-04-02 (Tampering via detect.customPatterns) | transfer — Phase 3 consumer owns validation | `readConfig()` returns the object verbatim; Phase-3 `src/detectors/regex.ts buildMatcher()` owns the per-pattern compile safety (already shipped) |

## Known Stubs

None. This plan ships the final typed config surface; every `readConfig()` field maps to an `agentMode.*` key with a matching package.json default.

## Threat Flags

None — this plan introduces no new network endpoints, auth paths, file access patterns, or trust-boundary schema changes. The `agentMode.*` settings store is a pre-existing VS Code-user trust boundary already enumerated in the phase threat register (T-04-02 / T-04-03).

## Self-Check: PASSED

- FOUND: src/config.ts
- FOUND: src/outputChannel.ts
- FOUND: package.json (contributes.configuration populated, 14 keys)
- FOUND: test/config.test.ts (flipped from stubs, 7 passing)
- FOUND: test/outputChannel.test.ts (flipped from stubs, 6 passing)
- FOUND: scripts/check-config-keys.mjs (enum-length parity tightened)
- FOUND commit 7113a8b (Task 1: manifest)
- FOUND commit e21cde2 (Task 2 RED: test flip)
- FOUND commit 51faf6c (Task 2 GREEN: src/config.ts + src/outputChannel.ts)
- FOUND commit a93639e (Task 3: check-config-keys enum-length parity)
- Verified: `git log --oneline -5` shows all four hashes
- Verified: `pnpm test` → 204 passed / 30 todo
- Verified: `pnpm typecheck` → PASS
- Verified: `pnpm build` → PASS (207.5 KB, no delta)
- Verified: `pnpm check:api-surface` → PASS (9 pure-core)
- Verified: `pnpm check:config-keys` → PASS (14/20)
