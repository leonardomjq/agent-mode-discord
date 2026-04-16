# Phase 5: Companion Plugin + OSS Hygiene + Assets + README - Research

**Researched:** 2026-04-15
**Domain:** Claude Code plugin system, Node.js fs.watchFile, GitHub Actions CI matrix, OSS repo hygiene, VS Code extension README
**Confidence:** HIGH

## Summary

Phase 5 has three parallel sub-deliverables with minimal code overlap. The companion plugin (`companion/claude-code-plugin/`) uses Claude Code's hooks system to write/remove a lockfile on `SessionStart`/`SessionEnd`; the VS Code extension watches that lockfile via `fs.watchFile` (stat polling) as a tier-1 detector. OSS hygiene is standard boilerplate (LICENSE, COC, SECURITY, CONTRIBUTING, templates, Dependabot, CI matrix). The README follows DIST-09's exact section order with shields.io badges and a `[HUMAN]` demo GIF.

The Claude Code plugin system is well-documented with a clear schema. `plugin.json` is optional (auto-discovery works), but including it provides clean metadata. Hooks live in `hooks/hooks.json` at the plugin root and use `${CLAUDE_PLUGIN_ROOT}` for script references. `fs.watchFile` is the correct choice for watching a single file that may not exist yet -- its callback receives `(curr, prev)` stat objects where `prev.mtimeMs === 0` signals ENOENT-to-exist transition.

**Primary recommendation:** Build all three sub-deliverables in parallel. The only `src/` change is `detectors/companion.ts` + orchestrator wiring. Plugin structure follows Claude Code's documented conventions exactly. CI matrix expansion is a straightforward YAML change.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Companion tier is tier-1, not tier-0. Extend `TierNumber` to `1 | 2 | 3 | 4`. Update orchestrator iteration array from `[2, 3, 4]` to `[1, 2, 3, 4]`.
- **D-02:** Lockfile path is `~/.claude/agent-mode-discord.lock` (resolved via `os.homedir()` + `.claude/agent-mode-discord.lock`).
- **D-03:** Lockfile is empty file, mtime-as-signal. No content parsing. `start.sh` = `touch $LOCKFILE`; `stop.sh` = `rm -f $LOCKFILE`.
- **D-04:** Companion detector uses `fs.watchFile` (stat polling), not `fs.watch`. 1000ms interval.
- **D-05:** Companion detector agent label is always "claude" (hardcoded).
- **D-06:** `companion/claude-code-plugin/` structure with `.claude-plugin/plugin.json`, `scripts/{start,stop}.sh`, `README.md`.
- **D-07:** VSIX exclusion via `.vscodeignore` (`companion/**`).
- **D-08:** CI matrix expands existing `.github/workflows/ci.yml` (don't create new workflow). Matrix: ubuntu-latest, macos-latest, windows-latest. Add `pnpm lint` step.
- **D-09:** Lint = `tsc --noEmit` (no new linter dep). `pnpm lint` = `tsc --noEmit` aliased in package.json.
- **D-10:** Branch protection is documented in CONTRIBUTING.md, not automated.
- **D-11:** Demo GIF is a `[HUMAN]` checkpoint (autonomous: false).
- **D-12:** README structure follows DIST-09 exactly (13 sections in order).
- **D-13:** Maintainer-posture tone: "Solo project, maintained on my own schedule..."
- **D-14:** Repository URL = `leonardojaques/agent-mode-discord`. Update `package.json` repository field.

### Deferred Ideas (OUT OF SCOPE)
- Real linter (ESLint/Biome) -- v0.2 DX improvement.
- Windows `start.cmd` / `stop.cmd` for companion plugin -- Claude Code hooks currently support `.sh` only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMP-01 | `companion/claude-code-plugin/` contains valid Claude Code plugin with `.claude-plugin/plugin.json` and `scripts/{start,stop}.sh` | Plugin schema documented; hooks.json format verified from official docs |
| COMP-02 | `claude plugin install ./companion/claude-code-plugin` installs successfully | CLI reference confirms local path install; `--plugin-dir` for dev testing |
| COMP-03 | SessionStart hook writes `~/.claude/agent-mode-discord.lock` within 200ms | SessionStart hook fires on `startup`; shell script `touch` is <1ms |
| COMP-04 | SessionEnd hook removes lockfile within 200ms | SessionEnd hook fires on termination; `rm -f` is <1ms |
| COMP-05 | Extension watches lockfile via `fs.watchFile` and promotes to tier-1 | fs.watchFile API documented; 1000ms poll interval matches D-04 |
| COMP-06 | Tier-1 suppresses lower tiers (debug-log only) | Orchestrator's linear-scan `[1, 2, 3, 4]` with break-on-first-active handles this |
| COMP-07 | `companion/` excluded from VSIX via `.vscodeignore` | `companion/**` pattern in .vscodeignore; verified by `vsce ls` |
| DIST-01 | LICENSE contains MIT text with current year and owner | Standard MIT template; year=2026, owner=Leonardo Jaques |
| DIST-02 | CODE_OF_CONDUCT.md (Contributor Covenant 2.1), SECURITY.md, CONTRIBUTING.md | CC 2.1 canonical text has one placeholder `[INSERT CONTACT METHOD]` |
| DIST-03 | Bug report template with structured fields | GitHub issue template YAML/MD format documented |
| DIST-04 | Feature request template with structured fields | GitHub issue template YAML/MD format documented |
| DIST-05 | PR template with checklist | `.github/PULL_REQUEST_TEMPLATE.md` standard pattern |
| DIST-06 | CI matrix: ubuntu + macos + windows; pnpm install, lint, test, build, bundle-size | GitHub Actions matrix strategy + pnpm/action-setup@v4 documented |
| DIST-07 | Branch protection requiring PR + green CI | Documented in CONTRIBUTING.md per D-10 (manual setup by repo owner) |
| DIST-08 | Dependabot enabled via `.github/dependabot.yml` | Standard YAML config |
| DIST-09 | README with all 13 sections per D-12 | Section order locked; badges from shields.io trusted by VS Code |
| DIST-10 | Demo GIF under 8MB, 15-30s loop | `[HUMAN]` checkpoint; research provides capture tooling recommendations |
</phase_requirements>

## Standard Stack

### Core (no new runtime dependencies)

This phase adds zero runtime dependencies. All work is either plugin files (shell scripts + JSON), repo hygiene files (markdown + YAML), or a single new TypeScript module (`detectors/companion.ts`) using only Node.js built-ins.

| Library/API | Version | Purpose | Why Standard |
|-------------|---------|---------|--------------|
| `fs.watchFile` | Node.js 20 built-in | Stat-poll lockfile for companion detector | D-04 locked; reliable for single-file watch on all platforms [VERIFIED: Node.js docs] |
| `fs.unwatchFile` | Node.js 20 built-in | Clean up watcher on dispose | Paired API for fs.watchFile [VERIFIED: Node.js docs] |
| `os.homedir()` | Node.js 20 built-in | Resolve `~/.claude/` cross-platform | Standard for home dir resolution [VERIFIED: codebase pattern in sessionFiles.ts] |

### Dev Dependencies (existing, no additions)

| Library | Version | Purpose |
|---------|---------|---------|
| `@vscode/vsce` | latest (3.9.0) | Package/list VSIX contents | [VERIFIED: npm registry] |
| `vitest` | ^2.0.0 (latest 4.1.4) | Test companion detector | [VERIFIED: npm registry] |
| `typescript` | ^5.4.0 (latest 6.0.2) | `tsc --noEmit` for lint step | [VERIFIED: npm registry] |

**No new packages to install.** All work uses existing project dependencies.

## Architecture Patterns

### Companion Plugin Structure

```
companion/claude-code-plugin/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest (name, version, description)
├── hooks/
│   └── hooks.json           # SessionStart + SessionEnd hook config
├── scripts/
│   ├── start.sh             # touch ~/.claude/agent-mode-discord.lock
│   └── stop.sh              # rm -f ~/.claude/agent-mode-discord.lock
└── README.md                # Install instructions
```

**Key architectural note:** Per the official Claude Code plugin reference, hooks go in `hooks/hooks.json` at the plugin root (NOT inside `.claude-plugin/`). The `plugin.json` is the only file inside `.claude-plugin/`. Scripts are referenced via `${CLAUDE_PLUGIN_ROOT}/scripts/start.sh`. [VERIFIED: code.claude.com/docs/en/plugins-reference]

**D-06 correction:** The CONTEXT.md shows scripts directly under the plugin root. The official plugin system requires hooks in `hooks/hooks.json` with script references using `${CLAUDE_PLUGIN_ROOT}`. The `scripts/` directory placement is correct, but the hook wiring must be in `hooks/hooks.json`, not in `plugin.json` directly (though inline in `plugin.json` is also supported per the reference).

### Companion Detector Pattern (`src/detectors/companion.ts`)

```typescript
// Source: Node.js docs + codebase sessionFiles.ts pattern
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const LOCKFILE = path.join(os.homedir(), ".claude", "agent-mode-discord.lock");
const POLL_INTERVAL_MS = 1000; // D-04: 1s stat polling
const STALENESS_MS = 5 * 60 * 1000; // T-05-01: 5 min orphan threshold

export interface CompanionDetectorOptions {
  lockfilePath?: string;     // override for tests
  pollIntervalMs?: number;   // override for tests
  stalenessMs?: number;      // override for tests
  now?: () => number;        // clock injection for tests
}

// fs.watchFile callback receives (curr: fs.Stats, prev: fs.Stats)
// When file doesn't exist: curr.mtimeMs === 0 (all stats zero)
// When file appears: curr.mtimeMs > 0, prev.mtimeMs === 0
// When file disappears: curr.mtimeMs === 0, prev.mtimeMs > 0
```

### Orchestrator Wiring Changes

The orchestrator in `src/detectors/index.ts` needs minimal changes:

1. Extend `TierNumber` union: `type TierNumber = 1 | 2 | 3 | 4;`
2. Update iteration array: `for (const tier of [1, 2, 3, 4] as const)`
3. Import and wire `createCompanionDetector` as tier-1
4. Add `companionStalenessMs` option to `DetectorsOrchestratorOptions`

The linear-scan pattern already supports this -- Phase 3 explicitly prepared for it (comment on line 15: "tier 1 -- companion (RESERVED for Phase 5)").

### CI Matrix Pattern

```yaml
# Source: pnpm.io/continuous-integration + GitHub Actions docs
jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
      fail-fast: false  # Don't cancel others if one OS fails
    steps:
      - uses: actions/checkout@v4
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - name: Install
        run: pnpm install --frozen-lockfile
      - name: Lint
        run: pnpm lint
      # ... remaining steps
```

[VERIFIED: pnpm.io docs + GitHub Actions docs]

### Anti-Patterns to Avoid

- **Do NOT put hooks inside `.claude-plugin/`:** Only `plugin.json` belongs there. Hooks go in `hooks/hooks.json` at the plugin root. [VERIFIED: code.claude.com/docs/en/plugins-reference]
- **Do NOT use `fs.watch` for the companion lockfile:** D-04 explicitly locks to `fs.watchFile`. `fs.watch` on a single file that may not exist is unreliable cross-platform.
- **Do NOT parse lockfile contents:** D-03 says mtime + existence only. The lockfile is empty.
- **Do NOT create a new CI workflow file:** D-08 says expand the existing `ci.yml`.
- **Do NOT add ESLint/Biome:** D-09 locks lint to `tsc --noEmit`. Deferred to v0.2.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lockfile watching | Custom inotify/kqueue wrapper | `fs.watchFile` with `{ interval: 1000 }` | Node.js handles platform differences; stat polling is simple and reliable [VERIFIED: Node.js docs] |
| Contributor Covenant | Custom code of conduct | Contributor Covenant 2.1 canonical text | Industry standard; only one placeholder to fill (`[INSERT CONTACT METHOD]`) [VERIFIED: contributor-covenant.org] |
| CI pnpm caching | Manual `actions/cache` + pnpm store path | `actions/setup-node@v4` with `cache: pnpm` | Built-in pnpm caching in setup-node eliminates manual cache key management [VERIFIED: pnpm.io/continuous-integration] |
| Badges | Custom SVG generation | shields.io badges | VS Code Marketplace only allows badges from trusted services including shields.io [VERIFIED: VS Code extension docs] |
| Dependabot config | Custom dependency update bot | `.github/dependabot.yml` standard format | GitHub native feature; simple YAML config [ASSUMED] |

## Claude Code Plugin System -- Detailed Findings

### plugin.json Schema (Minimal Required)

```json
{
  "name": "agent-mode-discord-companion",
  "version": "0.1.0",
  "description": "Companion plugin for Agent Mode Discord Rich Presence — writes a lockfile so the VS Code extension detects Claude Code sessions with highest fidelity.",
  "author": {
    "name": "Leonardo Jaques"
  },
  "license": "MIT"
}
```

Only `name` is required if a manifest is present. The manifest itself is optional (auto-discovery works), but including it provides clean metadata for `claude plugin list`. [VERIFIED: code.claude.com/docs/en/plugins-reference]

### hooks/hooks.json Format

```json
{
  "description": "Write/remove lockfile for Agent Mode Discord Rich Presence detection",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/start.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/stop.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

[VERIFIED: code.claude.com/docs/en/hooks + code.claude.com/docs/en/plugins-reference]

**Critical details:**
- `SessionStart` matcher `"startup"` fires on new sessions. Consider also matching `"resume"` to re-touch the lockfile on session resume (ensures mtime stays fresh). [ASSUMED -- needs validation whether resume should re-touch]
- `SessionEnd` matcher `"*"` fires on all end reasons (clear, logout, prompt_input_exit, etc.). This ensures cleanup regardless of how the session ends. [VERIFIED: code.claude.com/docs/en/hooks]
- `${CLAUDE_PLUGIN_ROOT}` is the absolute path to the plugin installation directory. It changes on plugin updates but is stable within a session. [VERIFIED: code.claude.com/docs/en/plugins-reference]
- Scripts MUST be executable (`chmod +x`). Common debugging issue per official docs. [VERIFIED: code.claude.com/docs/en/plugins-reference]

### SessionStart Matcher Values

| Value | When It Fires |
|-------|--------------|
| `startup` | New session |
| `resume` | `--resume`, `--continue`, or `/resume` |
| `clear` | `/clear` command |
| `compact` | After compaction |
| `*` | All of the above |

[VERIFIED: code.claude.com/docs/en/hooks]

**Recommendation:** Use matcher `"startup|resume"` to cover both new sessions and resumed sessions. `clear` and `compact` don't need the lockfile touched (session is still running). [ASSUMED]

### Plugin Installation

Users install via:
```bash
# For permanent installation
claude plugin install ./companion/claude-code-plugin

# For dev/testing
claude --plugin-dir ./companion/claude-code-plugin
```

The `claude plugin install` command copies the plugin to `~/.claude/plugins/cache/`. The `--plugin-dir` flag loads it directly without caching (session-scoped). [VERIFIED: code.claude.com/docs/en/plugins-reference]

**Important:** There is a known issue (#12457) where `claude plugin install` for local directory marketplaces may not persist correctly. The `--plugin-dir` flag works reliably for local plugins. The companion README should document both methods. [CITED: github.com/anthropics/claude-code/issues/12457]

## fs.watchFile Behavior -- Detailed Findings

### API Signature

```typescript
fs.watchFile(filename: string, options: { persistent?: boolean; interval?: number }, listener: (curr: fs.Stats, prev: fs.Stats) => void): fs.StatWatcher;
```

[VERIFIED: nodejs.org/docs/latest/api/fs.html]

### Key Behaviors

| Scenario | `curr` Stats | `prev` Stats | How to Detect |
|----------|-------------|-------------|---------------|
| File doesn't exist initially | All zeros (mtimeMs=0) | All zeros | Both mtimeMs === 0 |
| File created (ENOENT -> exists) | Real stats (mtimeMs > 0) | All zeros (mtimeMs=0) | `curr.mtimeMs > 0 && prev.mtimeMs === 0` |
| File deleted (exists -> ENOENT) | All zeros (mtimeMs=0) | Real stats | `curr.mtimeMs === 0 && prev.mtimeMs > 0` |
| File mtime updated (touch) | New mtime | Old mtime | `curr.mtimeMs !== prev.mtimeMs` |

[VERIFIED: nodejs.org/docs/latest/api/fs.html]

### Default Polling Interval

The default interval is **5007ms** (not 5000ms -- slightly over 5 seconds to avoid sync with other timers). D-04 specifies 1000ms, which must be set explicitly:

```typescript
fs.watchFile(lockfilePath, { persistent: false, interval: 1000 }, (curr, prev) => {
  // ...
});
```

[VERIFIED: nodejs.org/docs/latest/api/fs.html]

**`persistent: false`** is critical for VS Code extensions -- without it, the Node.js process won't exit when the extension host shuts down because the stat poller keeps the event loop alive. [ASSUMED -- standard practice for extension fs watchers]

### Cleanup

```typescript
fs.unwatchFile(lockfilePath);
// Or with specific listener:
fs.unwatchFile(lockfilePath, listener);
```

Must be called on dispose to stop polling. If no listener is passed, ALL listeners on that filename are removed. [VERIFIED: nodejs.org/docs/latest/api/fs.html]

### Orphan Detection (T-05-01)

When Claude Code crashes without running `stop.sh`, the lockfile persists. The detector must check:

```typescript
const isOrphan = (curr: fs.Stats, nowMs: number, stalenessMs: number): boolean => {
  if (curr.mtimeMs === 0) return false; // file doesn't exist
  const age = nowMs - curr.mtimeMs;
  return age > stalenessMs; // D-04: >5min = orphaned
};
```

The `start.sh` script should periodically `touch` the lockfile (e.g., via a SessionStart hook with `"compact"` matcher re-touching), or the detector should treat any file older than 5 minutes as orphaned and dispatch `agent-ended`. The 1000ms poll interval means the detector rechecks mtime every second, so it will detect staleness within ~1 second of the threshold.

**Recommended approach:** The detector itself handles orphan detection. On each `fs.watchFile` callback, if `curr.mtimeMs > 0` and `(now - curr.mtimeMs) > stalenessMs`, dispatch `agent-ended`. This is simpler than adding a heartbeat to the plugin. [ASSUMED -- D-04 context says >5min = orphaned but doesn't specify mechanism]

## CI Matrix -- Detailed Findings

### Current CI (`.github/workflows/ci.yml`)

Single `ubuntu-latest` runner, no matrix. Steps: checkout, pnpm setup, node setup with cache, install, build, bundle-size, api-surface, config-keys, no-network, test.

### Required Changes (D-08)

1. Add `strategy.matrix.os: [ubuntu-latest, macos-latest, windows-latest]`
2. Change `runs-on: ubuntu-latest` to `runs-on: ${{ matrix.os }}`
3. Add `fail-fast: false` (T-05-02: don't cancel all jobs if Windows flakes)
4. Add `pnpm lint` step (D-09: `tsc --noEmit`)
5. Add `pnpm typecheck` step (already exists as script but not in CI)
6. Keep all existing steps

### pnpm Caching Across OS

`actions/setup-node@v4` with `cache: pnpm` handles cross-platform caching automatically. The cache key includes the runner OS, so ubuntu/macos/windows each get their own cache. No manual `actions/cache` needed. [VERIFIED: pnpm.io/continuous-integration]

### Windows-Specific Concerns (T-05-02)

1. **Shell scripts in CI checks:** `scripts/check-*.mjs` are Node.js scripts (`.mjs`), so they run on Windows via Node without shell issues. [VERIFIED: codebase inspection]
2. **fs.watchFile tests:** The companion detector tests use `fs.watchFile` which is platform-consistent (stat polling). This is inherently more testable on Windows than `fs.watch`. [VERIFIED: Node.js docs]
3. **Path separators:** The lockfile path uses `path.join(os.homedir(), '.claude', 'agent-mode-discord.lock')` which handles Windows backslashes. [VERIFIED: codebase pattern]
4. **vitest on Windows:** Known to be slower on GitHub Actions free-tier (2 vCPU). No known fs.watchFile-specific flakiness. Use `--reporter=verbose` on CI for better diagnostics. [CITED: github.com/vitest-dev/vitest/discussions/6223]

### lint Script Addition (D-09)

Add to `package.json`:
```json
"lint": "tsc --noEmit"
```

This is equivalent to the existing `typecheck` script. D-09 explicitly chose this to avoid adding a linter dependency.

## VSIX Exclusion -- Detailed Findings

### Current `.vscodeignore`

Already excludes: `.planning/**`, `.github/**`, `src/**`, `test/**`, `scripts/**`, `docs/**`, `build-shims/**`, config files, `node_modules/**` (with `@xhayper` exception).

### Required Addition

```
companion/**
```

This excludes the entire companion plugin directory from the VSIX. [VERIFIED: codebase .vscodeignore inspection]

### Verification

```bash
# List files that will be in the VSIX
npx @vscode/vsce ls

# Verify companion is NOT listed
npx @vscode/vsce ls | grep companion
# Should return empty (exit 1)
```

[VERIFIED: vscode.dev publishing docs + vsce CLI reference]

## OSS Hygiene Files -- Detailed Findings

### LICENSE (MIT)

Standard MIT template. Fields to fill:
- Year: 2026
- Copyright holder: Leonardo Jaques

[ASSUMED -- standard MIT format]

### CODE_OF_CONDUCT.md (Contributor Covenant 2.1)

Canonical text from https://www.contributor-covenant.org/version/2/1/code_of_conduct/. One placeholder to fill:
- `[INSERT CONTACT METHOD]`: Use the repo owner's email or "via GitHub Issues" (for a solo project, Issues is reasonable).

Sections: Our Pledge, Our Standards, Enforcement Responsibilities, Scope, Enforcement, Enforcement Guidelines (4-tier: Correction, Warning, Temporary Ban, Permanent Ban), Attribution. [VERIFIED: contributor-covenant.org/version/2/1/code_of_conduct/]

### SECURITY.md

Standard vulnerability reporting document. For a solo project:
- Preferred reporting method: email or GitHub's private vulnerability reporting
- Response time expectation: "best effort" (matches D-13 maintainer posture)
- Supported versions: current release only

[ASSUMED -- no standard template, but GitHub recommends SECURITY.md]

### CONTRIBUTING.md

Must include (per DIST-02 + D-10 + D-13):
- Dev loop (`pnpm install`, `pnpm build`, `pnpm test`)
- Conventional Commits requirement
- "File issue before large PRs" rule
- Maintainer-pace expectations (D-13 tone)
- Branch protection documentation (D-10)
- Code of Conduct reference

[ASSUMED -- standard CONTRIBUTING structure]

### GitHub Issue Templates

DIST-03 (bug_report.md) requires structured fields:
- VS Code version, Cursor version, Discord version, OS
- Agent CLI used, shell
- Steps to reproduce
- `debug.verbose: true` log capture

DIST-04 (feature_request.md) requires structured fields:
- Problem description
- Proposed solution
- Persona (Marcus / Steph / other)

These go in `.github/ISSUE_TEMPLATE/` directory. [ASSUMED -- standard GitHub template location]

### PR Template

DIST-05 requires checklist:
- Tests pass
- No new runtime deps
- Follows PRD guardrails

Goes in `.github/PULL_REQUEST_TEMPLATE.md`. [ASSUMED -- standard GitHub PR template location]

### Dependabot Configuration

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

[ASSUMED -- standard Dependabot config]

## README Best Practices -- Detailed Findings

### Shields.io Badges

VS Code Marketplace only allows badges from trusted services. Recommended badges:

```markdown
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/agent-mode-dev.agent-mode-discord)](https://marketplace.visualstudio.com/items?itemName=agent-mode-dev.agent-mode-discord)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/agent-mode-dev.agent-mode-discord)](https://marketplace.visualstudio.com/items?itemName=agent-mode-dev.agent-mode-discord)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
```

[VERIFIED: shields.io + VS Code extension docs]

**Note:** The publisher name in badges must match the `publisher` field in `package.json` (currently `"agent-mode-dev"`). Badge URLs won't resolve until the extension is published (Phase 6). Use placeholder badges that link to the repo until then.

### Demo GIF (DIST-10, D-11)

Requirements: under 8MB, 15-30s loop, shows Discord sidebar flipping Idling -> AGENT_ACTIVE.

Recommended capture tools:
- **VHS** (charmbracelet/vhs): Terminal recording + GIF generation. Good for terminal-focused demos. [ASSUMED]
- **ScreenToGif** (Windows): GUI screen recorder with GIF export. [ASSUMED]
- **OBS + ffmpeg**: Record screen, convert to GIF with optimization. [ASSUMED]

Optimization (T-05-03):
```bash
# Convert MP4 to optimized GIF
ffmpeg -i demo.mp4 -vf "fps=10,scale=720:-1:flags=lanczos" -c:v gif demo.gif
# Further optimize
gifsicle --optimize=3 --lossy=80 demo.gif -o demo-opt.gif
```

This is a `[HUMAN]` step -- requires running Discord + Claude Code + screen capture simultaneously.

### package.json Repository URL (D-14)

Current: `"url": "https://github.com/TODO/agent-mode-discord.git"`
Update to: `"url": "https://github.com/leonardojaques/agent-mode-discord.git"`

## Common Pitfalls

### Pitfall 1: Hooks directory placement
**What goes wrong:** Placing `hooks.json` inside `.claude-plugin/` directory instead of at the plugin root.
**Why it happens:** The `.claude-plugin/` directory feels like it should contain all plugin config, but only `plugin.json` goes there.
**How to avoid:** Follow the standard layout: `hooks/hooks.json` at plugin root, `plugin.json` inside `.claude-plugin/`.
**Warning signs:** `claude --debug` shows "hooks not firing" or plugin loads without hooks.
[VERIFIED: code.claude.com/docs/en/plugins-reference -- "Only plugin.json belongs in .claude-plugin/"]

### Pitfall 2: fs.watchFile persistent flag
**What goes wrong:** Using `persistent: true` (the default) keeps the Node.js event loop alive even after the extension host should shut down.
**Why it happens:** Default is `persistent: true` per Node.js docs.
**How to avoid:** Always set `{ persistent: false, interval: 1000 }` in the options.
**Warning signs:** Extension host process lingers after VS Code closes.
[VERIFIED: nodejs.org/docs/latest/api/fs.html -- default is true]

### Pitfall 3: Lockfile orphan after crash
**What goes wrong:** Claude Code crashes, `stop.sh` never runs, lockfile persists -> extension permanently shows AGENT_ACTIVE.
**Why it happens:** Shell process killed without cleanup.
**How to avoid:** Companion detector checks `curr.mtimeMs` age on every poll. If `(now - mtime) > 5min`, treat as orphaned and dispatch `agent-ended`. Threshold per T-05-01.
**Warning signs:** Discord shows "cooking" hours after Claude Code closed.

### Pitfall 4: SessionStart matcher too narrow
**What goes wrong:** Only matching `"startup"` means resumed sessions don't re-touch the lockfile.
**Why it happens:** Not considering `--resume` / `--continue` / `/resume` session lifecycle.
**How to avoid:** Match `"startup|resume"` to cover both new and resumed sessions.
**Warning signs:** Lockfile mtime goes stale during long resumed sessions, triggering orphan detection.

### Pitfall 5: CI matrix path separator issues
**What goes wrong:** Tests that hardcode `/` in paths fail on Windows.
**Why it happens:** Windows uses `\` as path separator.
**How to avoid:** Always use `path.join()` or `path.resolve()` instead of string concatenation. The existing codebase already follows this pattern.
**Warning signs:** Tests pass on ubuntu/macos but fail on windows with "ENOENT" errors.

### Pitfall 6: Missing `chmod +x` on shell scripts
**What goes wrong:** Plugin hooks fail silently because scripts aren't executable.
**Why it happens:** Git doesn't always preserve execute permissions on clone.
**How to avoid:** Ensure git tracks the execute bit: `git update-index --chmod=+x scripts/start.sh scripts/stop.sh`. Also add `#!/bin/bash` shebang.
**Warning signs:** `claude --debug` shows hook script not executing. Official docs list this as common issue.
[VERIFIED: code.claude.com/docs/en/plugins-reference -- "Hook script not executing: Check the script is executable"]

### Pitfall 7: Badges not rendering on Marketplace pre-publish
**What goes wrong:** Shields.io Marketplace badges return "not found" before the extension is published.
**Why it happens:** The Marketplace API doesn't have data for unpublished extensions.
**How to avoid:** Use generic badges (License, CI status) that work pre-publish. Add Marketplace-specific badges (installs, version) during Phase 6 publish.
**Warning signs:** Broken badge images in README preview.

### Pitfall 8: `vsce ls` not installed
**What goes wrong:** Can't verify VSIX exclusion without `@vscode/vsce`.
**Why it happens:** `@vscode/vsce` is listed as a dev dependency in ROADMAP but may not be in current `devDependencies`.
**How to avoid:** Add `@vscode/vsce` to devDependencies if not present, or use `npx @vscode/vsce ls`.
**Warning signs:** `vsce: command not found`.
[VERIFIED: codebase package.json -- @vscode/vsce is NOT in devDependencies currently]

## Code Examples

### Companion Detector (src/detectors/companion.ts)

```typescript
// Source: Node.js fs.watchFile docs + codebase sessionFiles.ts pattern
import * as vscode from "vscode";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Event } from "../state/types";

const DEFAULT_LOCKFILE = path.join(os.homedir(), ".claude", "agent-mode-discord.lock");
const DEFAULT_POLL_MS = 1000;
const DEFAULT_STALENESS_MS = 5 * 60 * 1000; // 5 minutes (T-05-01)

export interface CompanionDetectorOptions {
  lockfilePath?: string;
  pollIntervalMs?: number;
  stalenessMs?: number;
  now?: () => number;
}

export interface CompanionDetector {
  readonly tier: 1;
  start(dispatch: (event: Event) => void): vscode.Disposable;
}

export function createCompanionDetector(
  opts: CompanionDetectorOptions = {},
): CompanionDetector {
  const lockfilePath = opts.lockfilePath ?? DEFAULT_LOCKFILE;
  const pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_MS;
  const stalenessMs = opts.stalenessMs ?? DEFAULT_STALENESS_MS;
  const now = opts.now ?? Date.now;

  return {
    tier: 1,
    start(dispatch: (event: Event) => void): vscode.Disposable {
      let active = false;

      const listener = (curr: fs.Stats, _prev: fs.Stats): void => {
        try {
          const fileExists = curr.mtimeMs > 0;
          const isStale = fileExists && (now() - curr.mtimeMs) > stalenessMs;

          if (fileExists && !isStale && !active) {
            active = true;
            dispatch({ type: "agent-started", agent: "claude" }); // D-05
          } else if ((!fileExists || isStale) && active) {
            active = false;
            dispatch({ type: "agent-ended", agent: "claude" });
          }
        } catch { /* silent per D-18 */ }
      };

      try {
        fs.watchFile(lockfilePath, { persistent: false, interval: pollIntervalMs }, listener);
      } catch { /* silent */ }

      return new vscode.Disposable(() => {
        try { fs.unwatchFile(lockfilePath, listener); } catch { /* silent */ }
      });
    },
  };
}
```

### Plugin start.sh

```bash
#!/bin/bash
# Agent Mode Discord — companion plugin start hook
# Writes lockfile to signal active Claude Code session to the VS Code extension.
LOCKFILE="$HOME/.claude/agent-mode-discord.lock"
mkdir -p "$(dirname "$LOCKFILE")"
touch "$LOCKFILE"
```

### Plugin stop.sh

```bash
#!/bin/bash
# Agent Mode Discord — companion plugin stop hook
# Removes lockfile to signal Claude Code session ended.
LOCKFILE="$HOME/.claude/agent-mode-discord.lock"
rm -f "$LOCKFILE"
```

### Plugin hooks/hooks.json

```json
{
  "description": "Agent Mode Discord Rich Presence — lockfile signal for highest-fidelity agent detection",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/start.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/stop.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

### CI Matrix Expansion

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
      fail-fast: false
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Build
        run: pnpm build

      - name: Bundle size check
        run: pnpm check:bundle-size

      - name: API surface check
        run: pnpm check:api-surface

      - name: Check config keys (CONF-01)
        run: pnpm check:config-keys

      - name: Check no outbound HTTP (PRIV-07)
        run: pnpm check:no-network

      - name: Test
        run: pnpm test
```

### Dependabot Configuration

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hooks in `.claude-plugin/hooks.json` | Hooks in `hooks/hooks.json` at plugin root | Claude Code plugin system v0.30+ | Plugin structure follows standard layout |
| `fs.watch` for single-file monitoring | `fs.watchFile` for known-path single files | Always (Node.js best practice) | D-04 aligns with standard; `fs.watch` is for directories |
| Manual CI caching for pnpm | `actions/setup-node@v4` with `cache: pnpm` | 2024 (setup-node v4) | Eliminates manual cache key management |
| GitHub Dependabot v1 config | Dependabot v2 YAML format | 2021 | `version: 2` is the only supported format |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `persistent: false` is needed for extension host clean shutdown | Pitfall 2 | Extension host may linger; verify with manual testing |
| A2 | SessionStart matcher should include `resume` to keep lockfile fresh | Pitfall 4 / hooks.json | Stale lockfile on resumed sessions triggers false orphan detection |
| A3 | `mkdir -p` in start.sh handles first-run (no `~/.claude/` dir) | start.sh | Script fails if `~/.claude/` doesn't exist; but Claude Code creates it on install |
| A4 | Dependabot YAML format is standard and doesn't need verification | Dependabot section | Config rejected by GitHub if syntax wrong; low risk |
| A5 | Demo GIF capture tools (VHS, ScreenToGif, OBS) are suitable | README section | Only affects `[HUMAN]` step; user chooses their own tool |
| A6 | `@vscode/vsce` not in devDependencies | Pitfall 8 | Need to add it or use `npx` for VSIX verification |

## Open Questions

1. **SessionStart resume matcher**
   - What we know: `"startup"` fires on new sessions; `"resume"` fires on `--resume`/`--continue`/`/resume`.
   - What's unclear: Does a resumed session need the lockfile re-touched? The 5-min staleness check would trigger false orphan if the file isn't re-touched and the original session was long.
   - Recommendation: Match `"startup|resume"` to be safe. Re-touching is cheap (touch is <1ms).

2. **`@vscode/vsce` devDependency**
   - What we know: It's not in the current `package.json` devDependencies.
   - What's unclear: Is it installed globally or will it be added in a later phase?
   - Recommendation: Either add to devDependencies or use `npx @vscode/vsce ls` for verification. Phase 6 definitely needs it for publishing.

3. **Competitive positioning accuracy (T-05-04)**
   - What we know: README needs a comparison table vs vscord / discord-vscode / RikoAppDev.
   - What's unclear: Feature claims about competitors must be current as of writing.
   - Recommendation: Link to each extension's Marketplace page; prefix claims with "as of v0.1.0, April 2026".

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All build/test | Yes | 20+ | -- |
| pnpm | Package management | Yes | 9.x | -- |
| `@vscode/vsce` | VSIX verification (COMP-07) | No (not in devDeps) | -- | `npx @vscode/vsce ls` |
| Git | Version control | Yes | -- | -- |
| bash | Plugin scripts | Yes (macOS) | -- | Windows: deferred (D-deferred) |
| ffmpeg | Demo GIF optimization | Needs check | -- | Manual optimization by human |
| gifsicle | Demo GIF optimization | Needs check | -- | Manual optimization by human |

**Missing dependencies with no fallback:**
- None (all blockers have alternatives)

**Missing dependencies with fallback:**
- `@vscode/vsce`: Use `npx` invocation or add to devDependencies
- `ffmpeg`/`gifsicle`: Only for `[HUMAN]` demo GIF step; user installs as needed

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^2.0.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMP-01 | Plugin structure valid | manual | `claude plugin validate ./companion/claude-code-plugin` | N/A (human) |
| COMP-02 | Plugin installs cleanly | manual | `claude --plugin-dir ./companion/claude-code-plugin` | N/A (human) |
| COMP-03 | start.sh writes lockfile | unit | `pnpm test -- test/detectors.companion.test.ts` | Wave 0 |
| COMP-04 | stop.sh removes lockfile | unit | `pnpm test -- test/detectors.companion.test.ts` | Wave 0 |
| COMP-05 | fs.watchFile detects lockfile | unit | `pnpm test -- test/detectors.companion.test.ts` | Wave 0 |
| COMP-06 | Tier-1 suppresses lower tiers | unit | `pnpm test -- test/detectors.index.test.ts` | Extend existing |
| COMP-07 | companion/ excluded from VSIX | smoke | `npx @vscode/vsce ls \| grep -c companion` | Script check |
| DIST-06 | CI matrix passes all OS | integration | GitHub Actions (manual trigger) | N/A (CI) |
| DIST-08 | Dependabot config valid | manual | GitHub validates on push | N/A |

### Wave 0 Gaps

- [ ] `test/detectors.companion.test.ts` -- covers COMP-03, COMP-04, COMP-05 (lockfile appear/disappear/orphan)
- [ ] Extend `test/detectors.index.test.ts` -- covers COMP-06 (tier-1 integration with orchestrator)
- [ ] `pnpm lint` script in `package.json` -- needed before CI matrix step

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A (local-only, no auth) |
| V3 Session Management | No | N/A (no web sessions) |
| V4 Access Control | No | N/A (single-user local tool) |
| V5 Input Validation | Yes (lockfile path) | Path constructed via `path.join(os.homedir(), ...)` -- no user input in path |
| V6 Cryptography | No | N/A (no crypto in this phase) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Lockfile symlink attack | Tampering | `fs.watchFile` stats the actual file (follows symlinks by default); lockfile path is hardcoded, not user-controlled |
| Lockfile race condition (TOCTOU) | Tampering | Stat-polling inherently has a 1s window; acceptable for presence detection (not security-critical) |
| Plugin script injection | Elevation | Scripts use hardcoded paths only; no user input in commands |

## Sources

### Primary (HIGH confidence)
- [Node.js fs.watchFile API](https://nodejs.org/docs/latest/api/fs.html) -- fs.watchFile parameters, callback behavior, ENOENT handling, default interval
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- SessionStart/SessionEnd hook events, matcher values, input/output schemas
- [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference) -- plugin.json schema, directory structure, CLI commands, environment variables
- [pnpm CI Documentation](https://pnpm.io/continuous-integration) -- GitHub Actions setup with pnpm/action-setup@v4
- [Contributor Covenant 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) -- canonical text, placeholder field

### Secondary (MEDIUM confidence)
- [Shields.io VS Code Marketplace badges](https://shields.io/badges/visual-studio-marketplace-installs) -- badge URL format
- [VS Code Publishing Extension docs](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) -- vsce ls, .vscodeignore, trusted badge services
- [GitHub Dependabot docs](https://docs.github.com/en/code-security/dependabot) -- dependabot.yml v2 format

### Tertiary (LOW confidence)
- [GitHub issue #12457](https://github.com/anthropics/claude-code/issues/12457) -- local plugin install persistence issue (may be fixed)
- [vitest CI performance discussion](https://github.com/vitest-dev/vitest/discussions/6223) -- Windows runner slowness

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new deps; all Node.js built-ins verified against docs
- Architecture: HIGH -- plugin system fully documented; detector pattern matches existing codebase
- CI matrix: HIGH -- pnpm + GitHub Actions well-documented; existing CI is a clean starting point
- OSS hygiene: HIGH -- standard boilerplate with documented templates
- Pitfalls: HIGH -- verified against official docs and codebase patterns
- Plugin system: HIGH -- official reference docs are comprehensive and current

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (30 days -- stable domain, no fast-moving APIs)
