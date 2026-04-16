---
phase: 05-companion-plugin-oss-hygiene-assets-readme
reviewed: 2026-04-16T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - .github/dependabot.yml
  - .github/ISSUE_TEMPLATE/bug_report.md
  - .github/ISSUE_TEMPLATE/feature_request.md
  - .github/PULL_REQUEST_TEMPLATE.md
  - .github/workflows/ci.yml
  - .vscodeignore
  - assets/CAPTURE-INSTRUCTIONS.md
  - CODE_OF_CONDUCT.md
  - companion/claude-code-plugin/.claude-plugin/plugin.json
  - companion/claude-code-plugin/hooks/hooks.json
  - companion/claude-code-plugin/README.md
  - companion/claude-code-plugin/scripts/start.sh
  - companion/claude-code-plugin/scripts/stop.sh
  - CONTRIBUTING.md
  - LICENSE
  - package.json
  - README.md
  - SECURITY.md
  - src/detectors/companion.ts
  - src/detectors/index.ts
  - test/detectors.companion.test.ts
findings:
  critical: 0
  warning: 6
  info: 7
  total: 13
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-04-16
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Phase 5 delivers the tier-1 companion lockfile detector, a Claude Code companion
plugin, OSS hygiene files, GitHub templates, CI workflow, and README. The core
code (companion detector + orchestrator wiring) is sound — the detector
correctly uses `fs.watchFile`, disposes its watcher on cleanup, handles
orphaned lockfile staleness, and the orchestrator iterates `[1, 2, 3, 4]` so
tier-1 wins precedence as designed. Tests cover the main state transitions.

The shell scripts are minimal and safe (hardcoded `$HOME/.claude/` path, quoted
variables, no user input interpolation), so no injection or TOCTOU bugs were
found.

The issues found are concentrated in **documentation accuracy and consistency**:

- SECURITY.md's threat-model note misdescribes the companion detector as
  parsing lockfile contents (it only reads mtime/existence).
- README.md overstates the configuration-key count (claims 20, actually 14).
- Install commands disagree across README.md / companion/README.md /
  CAPTURE-INSTRUCTIONS.md (`claude plugin install` vs `claude /plugin install`).
- CAPTURE-INSTRUCTIONS.md references a non-existent `pnpm vscode:package` script.
- CODE_OF_CONDUCT.md has a grammar slip ("at via").
- The new `companionStalenessMs` orchestrator option is never passed from
  `extension.ts` (unreachable knob).
- Shell scripts lack `set -euo pipefail` / error handling.
- CI actions are tag-pinned (`@v4`) rather than SHA-pinned.

No critical (security- or crash-class) issues were found.

## Warnings

### WR-01: SECURITY.md threat model falsely claims companion detector parses lockfile contents

**File:** `SECURITY.md:53`

**Issue:** The threat-model note reads:

> Lockfiles read by the companion detector live in `~/.claude/` and are
> size-capped (≤ 4 KB) and JSON-validated before parsing.

This contradicts the actual implementation. `src/detectors/companion.ts` only
inspects `mtimeMs` (existence + staleness); it never opens the file to read or
parse contents. The companion plugin README explicitly states: *"The file is
empty — only its presence and modification time are used as signals. Contents
are never parsed."* (`companion/claude-code-plugin/README.md:42`).

This is a factual error in a security-facing document. A reviewer relying on
SECURITY.md would assume the extension has a content-parsing attack surface
that does not exist; conversely, if v0.2 later adds parsing, this note becomes
a false assurance about size caps and JSON validation that may no longer hold.

**Fix:** Rewrite the note to match reality, e.g.:

```markdown
Lockfiles observed by the companion detector live in `~/.claude/` and are
treated as signals only — the detector reads modification time via
`fs.watchFile` and never opens or parses the file contents. A stale-mtime
threshold (default 5 minutes) guards against orphaned lockfiles from crashed
Claude Code sessions.
```

### WR-02: README.md overstates configuration-key count (claims 20, actually 14)

**File:** `README.md:97`, `README.md:144`

**Issue:**

Line 97: *"Agent Mode exposes 20 settings under `agentMode.*`."*
Line 144 (competitive table): `| Configuration keys | 20 | 160+ | ~30 | ~15 |`

Counting the keys actually declared under `contributes.configuration.properties`
in `package.json`: clientId, idleBehavior, debug.verbose, animations.enabled,
messages.customPackPath, privacy.filename, privacy.gitBranch,
privacy.workspaceName, ignore.gitHosts, ignore.organizations,
ignore.repositories, ignore.workspaces, detect.customPatterns,
detect.sessionFileStalenessSeconds — **14 keys**, not 20.

The competitive-positioning table is a factual claim comparing against other
extensions, so overstating the number is particularly misleading. The CI job
in `.github/workflows/ci.yml:44` even caps the number at ≤20 as a
configuration-surface budget (CONF-01) — so "20" is the budget ceiling, not
the actual count.

**Fix:** Either (a) lower the number to match reality:

```markdown
Agent Mode exposes 14 settings under `agentMode.*`. All changes apply on the
next rotation tick — no reload required.
```

and update the competitive table row:

```markdown
| Configuration keys | 14 | 160+ | ~30 | ~15 |
```

or (b) if you plan to add more keys before v0.1.0 ships, synchronize the
claim with the count at release time and keep the CI cap check as the source
of truth.

### WR-03: Install commands disagree across README.md, companion/README.md, and CAPTURE-INSTRUCTIONS.md

**Files:** `README.md:73`, `companion/claude-code-plugin/README.md:9`,
`assets/CAPTURE-INSTRUCTIONS.md:27`

**Issue:** Three different install invocations for the same plugin:

- `README.md:73` — `claude plugin install ./companion/claude-code-plugin`
- `companion/claude-code-plugin/README.md:9` — `claude plugin install ./companion/claude-code-plugin`
- `assets/CAPTURE-INSTRUCTIONS.md:27` — `claude /plugin install ./companion/claude-code-plugin` (slash-command form)

One of these is wrong. Claude Code exposes plugin install as a slash command
(`/plugin install`) from within a running session, and as a subcommand
(`claude plugin install …`) from a shell. Mixing the forms without
disambiguation will cause users to hit a "command not found" / "unknown slash
command" failure.

Additionally, `./companion/claude-code-plugin` is a relative path from the
repository root, so it only works for users who have cloned the repo — a
marketplace user reading the README will not have this directory.

**Fix:** Pick one canonical invocation per context and link to it:

```markdown
### Companion Plugin (optional, recommended)

Clone or download this repository, then from the repo root:

```bash
claude plugin install ./companion/claude-code-plugin
```

Or, from an already-running Claude Code session, use the slash command:

```
/plugin install ./companion/claude-code-plugin
```

See [companion/claude-code-plugin/README.md](companion/claude-code-plugin/README.md)
for troubleshooting.
```

Update `CAPTURE-INSTRUCTIONS.md:27` to use the same form so the three docs
agree.

### WR-04: CAPTURE-INSTRUCTIONS.md references non-existent `pnpm vscode:package` script

**File:** `assets/CAPTURE-INSTRUCTIONS.md:21`

**Issue:** The instructions say:

> Either press `F5` from this repo (debug session), or install the VSIX
> locally: `pnpm vscode:package && code --install-extension *.vsix`

There is no `vscode:package` script in `package.json`. The `scripts` block
defines `build`, `build:dev`, `watch`, `check:*`, `test`, `test:watch`,
`typecheck`, `lint` — no packager. A user following the capture instructions
verbatim will hit:

```
ERR_PNPM_NO_SCRIPT  Missing script: "vscode:package"
```

**Fix:** Either add the script to `package.json`:

```json
"scripts": {
  ...,
  "vscode:package": "vsce package --no-dependencies"
}
```

(and add `@vscode/vsce` as a devDependency), or update the instructions to
match the current build flow:

```bash
pnpm build
npx @vscode/vsce package --no-dependencies
code --install-extension *.vsix
```

Given that Phase 6 will handle marketplace publish, adding the script here is
probably the right call — Phase 6 will need it anyway.

### WR-05: `companionStalenessMs` orchestrator option is never wired from `extension.ts`

**File:** `src/detectors/index.ts:54`, `src/extension.ts:183-186`

**Issue:** `DetectorsOrchestratorOptions.companionStalenessMs` is declared and
plumbed to `createCompanionDetector`:

```ts
const companion = (factories.companion ?? createCompanionDetector)({
  stalenessMs: opts.companionStalenessMs,
});
```

But `extension.ts` only passes `customPatterns` and
`sessionFileStalenessSeconds`:

```ts
const detectorsDisposable = createDetectorsOrchestrator(dispatch, {
  customPatterns: bootCfg.detect.customPatterns,
  sessionFileStalenessSeconds: bootCfg.detect.sessionFileStalenessSeconds,
});
```

So the orchestrator option is dead code from the production entry point — it
is only reachable from tests. This is not a crash bug (the detector falls
back to its internal default of 5 minutes), but:

1. The option exists in the public surface, suggesting it is configurable.
2. There is no corresponding `agentMode.detect.companionStalenessMs` config key
   in `package.json` — so even if `extension.ts` wanted to pipe it through,
   there's nothing to read from.

Decide: either drop the option (and let the detector own its constant), or
add a config key and wire it. The current state is the worst of both — a
configurable-looking API that isn't actually configurable.

**Fix:** If the 5-minute default is intentional and fixed, remove the option:

```ts
// src/detectors/index.ts — delete companionStalenessMs from
// DetectorsOrchestratorOptions and drop the `{ stalenessMs: ... }` pass-through.
const companion = (factories.companion ?? createCompanionDetector)();
```

If it should be user-configurable, add to `package.json`:

```json
"agentMode.detect.companionStalenessMinutes": {
  "type": "number",
  "default": 5,
  "minimum": 1,
  "maximum": 60,
  "title": "Companion lockfile staleness (minutes)",
  "description": "Minutes after which a ~/.claude/agent-mode-discord.lock file is treated as orphaned."
}
```

and thread it through `config.ts` → `extension.ts` → orchestrator.

### WR-06: Companion shell scripts have no error handling or `set -euo pipefail`

**Files:** `companion/claude-code-plugin/scripts/start.sh`,
`companion/claude-code-plugin/scripts/stop.sh`

**Issue:** Both scripts run without `set -e`, `set -u`, or `set -o pipefail`:

```bash
#!/bin/bash
LOCKFILE="$HOME/.claude/agent-mode-discord.lock"
mkdir -p "$(dirname "$LOCKFILE")"
touch "$LOCKFILE"
```

If `$HOME` is somehow unset (exotic environments, container init), `mkdir -p
"$(dirname "")"` silently expands to `mkdir -p /` → no-op, then `touch ""` →
error, but the hook still exits 0 because no `set -e`. The `SessionStart`
hook silently fails and the extension never detects the lockfile. Because
hook errors are surfaced in Claude Code's debug log but never block the
session, users will see zero signal and zero error — hardest possible class
of bug to diagnose.

The impact is bounded (worst case: tier-1 silently degrades to tier-2/3), so
this is not Critical, but for a script that's the whole reason the companion
plugin exists, the defensive version is two lines.

**Fix:**

```bash
#!/bin/bash
# Agent Mode Discord — companion plugin start hook
# Writes lockfile to signal active Claude Code session to the VS Code extension.
set -euo pipefail

LOCKFILE="${HOME:?HOME is not set}/.claude/agent-mode-discord.lock"
mkdir -p "$(dirname "$LOCKFILE")"
touch "$LOCKFILE"
```

Same pattern for `stop.sh`. The `${HOME:?…}` form makes the failure loud
and the hook timeout (5s) in `hooks.json` will surface it in Claude Code's
debug output.

## Info

### IN-01: CODE_OF_CONDUCT.md contains "at via" grammar slip

**File:** `CODE_OF_CONDUCT.md:39`

**Issue:** *"Instances of abusive, harassing, or otherwise unacceptable
behavior may be reported to the community leaders responsible for enforcement
at via [GitHub Issues](…)."* — **"at via"** is a duplicated preposition.

**Fix:** Drop `at`:

```markdown
Instances of abusive, harassing, or otherwise unacceptable behavior may be
reported to the community leaders responsible for enforcement via
[GitHub Issues](https://github.com/leonardojaques/agent-mode-discord/issues).
```

### IN-02: CI workflow uses mutable `@v4` action tags instead of SHA pins

**File:** `.github/workflows/ci.yml:16,19,24`

**Issue:** Steps reference `actions/checkout@v4`, `pnpm/action-setup@v4`,
`actions/setup-node@v4`. Tag refs are mutable — a malicious force-push by a
compromised action maintainer could alter the behavior of already-merged
workflows. For a solo passion project with no secrets in the workflow, the
risk is very low, but SHA pinning (plus `# v4.1.1` comment) is a
zero-cost hardening.

**Fix:** Pin by SHA and let Dependabot keep them fresh (Dependabot is already
configured for `github-actions` in `dependabot.yml`, which will open PRs to
bump SHAs weekly):

```yaml
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
- uses: pnpm/action-setup@fe02b34f77f8bc703788d5817da081398fad5dd2  # v4.0.0
- uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af  # v4.1.0
```

Optional — Dependabot works with tag refs too, so skip if you prefer the
simpler `@v4` form.

### IN-03: README.md references v0.1.0 VSIX but package.json is at 0.0.1

**File:** `README.md:67`, `package.json:5`

**Issue:** README's "Manual VSIX" install shows:

```bash
code --install-extension agent-mode-discord-0.1.0.vsix
```

but `package.json`'s `"version": "0.0.1"` means running `pnpm build` +
`vsce package` today produces `agent-mode-discord-0.0.1.vsix`. A user who
copy-pastes the README command will get "file not found".

The README is evidently written for the v0.1.0 release (Phase 6), which is
fine for a forward-looking document — but for users reading between now and
Phase 6, this will fail. Either bump the package.json version to 0.1.0 now
(risk: version already consumed), or use a glob in the README so it works
for any version:

**Fix:**

```bash
# Download the latest .vsix from GitHub Releases, then:
code --install-extension agent-mode-discord-*.vsix
```

### IN-04: README.md uses `pnpm run typecheck` while CONTRIBUTING.md uses `pnpm typecheck`

**File:** `README.md:183`, `CONTRIBUTING.md:12`

**Issue:** Both forms work with pnpm (the `run` is optional when the script
name doesn't collide with a built-in). But inconsistency signals
carelessness and invites a contributor to "fix" one of them in a drive-by PR.

**Fix:** Pick one form (prefer the shorter `pnpm typecheck` to match
`CONTRIBUTING.md`) and apply it everywhere.

### IN-05: Companion plugin.json missing `homepage` / `repository` metadata

**File:** `companion/claude-code-plugin/.claude-plugin/plugin.json`

**Issue:** The plugin manifest has `name`, `version`, `description`, `author`,
`license` — but no `homepage` or `repository` pointing back to the GitHub
project. Users who install the plugin via marketplace-style discovery
(if/when Claude Code adds one) will have no way to find the source or file
issues.

**Fix:**

```json
{
  "name": "agent-mode-discord-companion",
  "version": "0.1.0",
  "description": "Companion plugin for Agent Mode Discord Rich Presence — writes a lockfile so the VS Code extension detects Claude Code sessions with highest fidelity.",
  "author": { "name": "Leonardo Jaques" },
  "homepage": "https://github.com/leonardojaques/agent-mode-discord",
  "repository": {
    "type": "git",
    "url": "https://github.com/leonardojaques/agent-mode-discord.git",
    "directory": "companion/claude-code-plugin"
  },
  "license": "MIT"
}
```

### IN-06: README.md and competitive-positioning table reference the v0.1.0 Marketplace slug that is not yet published

**File:** `README.md:7-10,50,58`

**Issue:** The marketplace/OpenVSX badges are correctly commented out
("Uncomment after Phase 6 publish"), but the "Install" section at lines 50
and 58 still shows:

```
ext install agent-mode-dev.agent-mode-discord
```

as if the extension were already published. A user reading the README today
(pre-Phase 6) who runs this will get "extension not found".

**Fix:** Gate the Install sections with a "Coming in Phase 6 / v0.1.0" note
or move them into a `<details>` block until publish:

```markdown
## Install

> **Availability:** Marketplace and OpenVSX listings are published as part
> of v0.1.0. For now, build from source or grab a VSIX from
> [GitHub Releases](https://github.com/leonardojaques/agent-mode-discord/releases).

<details>
<summary>VS Code Marketplace (v0.1.0+)</summary>
…
</details>
```

### IN-07: `src/detectors/companion.ts` existence check relies on `mtimeMs > 0`, which is a correct-but-fragile proxy

**File:** `src/detectors/companion.ts:83`

**Issue:**

```ts
const fileExists = curr.mtimeMs > 0;
```

This is the right pattern for `fs.watchFile` (when the target doesn't exist,
all numeric fields are 0), but the invariant "mtime > 0 ⇔ file exists" is
undocumented in Node's public docs — it's a *de facto* behaviour. A future
Node release could change it, or a filesystem with epoch-0 mtimes (exotic
CI images, frozen-time containers) could break it.

The pragmatic version: add a comment calling out the invariant so the next
maintainer doesn't touch it.

**Fix:**

```ts
// fs.watchFile invariant: when the watched path does not exist, the stat
// callback delivers an all-zero Stats object. mtimeMs === 0 is therefore a
// reliable "file missing" proxy without a separate fs.existsSync round-trip.
// Ref: Node.js docs — https://nodejs.org/api/fs.html#fswatchfilefilename-options-listener
const fileExists = curr.mtimeMs > 0;
```

No behaviour change; just pins the reader's mental model.

---

_Reviewed: 2026-04-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
