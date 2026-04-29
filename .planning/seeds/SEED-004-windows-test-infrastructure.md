---
id: SEED-004
status: dormant
planted: 2026-04-29
planted_during: v0.1.0 / Phase 06 (publish prep — first Windows CI run)
trigger_when: v0.1.1 patch cycle OR first Windows user bug report referencing fs-watch
scope: Small
target_milestone: v0.1.1
---

# SEED-004: Cross-platform test infrastructure for sessionFiles detector

## Why This Matters

`test/detectors.sessionFiles.test.ts` was written with forward-slash literal
paths in its fake-fs (`/fake/home/.claude/projects/...`). The detector source
uses `path.join`, which on Windows returns backslash-separated paths. Result:
the fake-fs `Map<string>` lookup misses on Windows, all 7 sessionFiles tests
fail with "expected [agent-started] to deeply equal []".

This is a test infrastructure bug, NOT a production bug:
- Real fs on Windows handles backslash paths natively via Node's `path` module
- The detector code itself is correct for both platforms
- v0.1.0 ships with the file `describe.skipIf(process.platform === 'win32')`'d
  so CI goes green on Windows runners

But "skip on Windows" is debt. It hides genuine cross-platform regressions
that future fs-watch changes might introduce. v0.1.1 should restore Windows
test coverage.

## When to Surface

- v0.1.1 patch cycle starts
- First Windows user files an issue mentioning fs-watch / session-file
  detection misbehaving (would force investigation anyway)
- Backlog 999.1 (Cursor-on-Windows reproduction harness) gets promoted —
  the harness work and this fix share enough infrastructure to bundle

## What Surfacing Looks Like

Two-step fix in `test/detectors.sessionFiles.test.ts`:

1. Replace path constants with `path.join`-built paths so they work on either
   separator:
   ```ts
   import path from "node:path";
   const PROJECTS_DIR = path.join("/fake", "home", ".claude", "projects");
   const SUBDIR = path.join(PROJECTS_DIR, "encoded-cwd");
   const FILE_A = path.join(SUBDIR, "session-a.jsonl");
   ```

2. Replace forward-slash hard-codes inside `makeFakeFs` with `path.sep`:
   - `p.lastIndexOf("/")` → `p.lastIndexOf(path.sep)`
   - `parent.startsWith(\`${dir}/\`)` → `parent.startsWith(\`${dir}${path.sep}\`)`
   - `rel.split("/")[0]` → `rel.split(path.sep)[0]`

3. Remove the `describe.skipIf(process.platform === 'win32')` guard.
4. Verify all 7 tests pass on Windows CI matrix.

Estimated effort: 30 min including local Windows-runner verification.

## Why Defer Now

v0.1.0 is gated on Marketplace publish + asset uploads, not test purity.
Windows users gain nothing by us shipping later — the production code path
is correct already. Real Windows behavior verification happens via local
VSIX install testing (HANDOFF.md), not these unit tests.
