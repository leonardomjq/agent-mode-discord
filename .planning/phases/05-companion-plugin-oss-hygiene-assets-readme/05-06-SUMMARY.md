---
phase: 05-companion-plugin-oss-hygiene-assets-readme
plan: 06
type: execute
status: partial
requirements:
  - DIST-10
key-files:
  created:
    - assets/CAPTURE-INSTRUCTIONS.md
  modified:
    - .vscodeignore
  pending:
    - assets/demo.gif
---

## Summary

Plan 05-06 is **partial**. Task 1 (auto: capture instructions + VSIX exclusion)
is complete and committed. Task 2 (`checkpoint:human-verify`: record the
actual demo GIF) is **deferred** — it requires the human to run a live capture
session against Discord + VS Code + the companion plugin and cannot be
automated.

## What was built

| File | Status | Notes |
|------|--------|-------|
| `assets/CAPTURE-INSTRUCTIONS.md` | ✓ created | Full capture sequence (15–30s), ffmpeg + gifsicle pipeline targeting <8 MB / 720p / 10fps, verification checklist |
| `.vscodeignore` | ✓ updated | Added `assets/**` so the demo GIF ships from the GitHub repo URL, not the VSIX |
| `assets/demo.gif` | ⏳ deferred | Awaiting human capture session — see CAPTURE-INSTRUCTIONS.md |

## Commits

- `947b87d` — feat(05-06): add demo GIF capture instructions and exclude assets from VSIX

## Verification

| Check | Result |
|-------|--------|
| `test -d assets` | ✓ |
| `test -f assets/CAPTURE-INSTRUCTIONS.md` | ✓ |
| `grep "assets/" .vscodeignore` | ✓ |
| `test -f assets/demo.gif` | ✗ deferred |
| `stat -f%z assets/demo.gif < 8388608` | ✗ deferred (file does not exist yet) |

## Deferral Rationale

The user chose "Defer GIF, continue to 05-07 README" when presented with the
human-verify checkpoint. Rationale:

1. The README (05-07) embeds `assets/demo.gif` as a relative link. The link
   target does not need to exist for the README to be authored — it will
   resolve once the GIF is dropped into place.
2. Phase verification (`gsd-verifier`) will flag the missing `assets/demo.gif`
   as a must-have gap. This keeps the GIF on the open-items list rather than
   silently dropping it.
3. Recording requires a live Discord client + VS Code + companion plugin,
   which is a foreground human task disruptive to mid-phase execution.

## Follow-up

To complete this plan, the human runs the capture session per
`assets/CAPTURE-INSTRUCTIONS.md`, places the optimized GIF at `assets/demo.gif`
(<8 MB), then runs:

```bash
git add assets/demo.gif
git commit -m "feat(05-06): add demo GIF showing Idling → AGENT_ACTIVE flip"
```

After that commit, re-run `/gsd-verify-work 5` to clear the DIST-10 gap, or
the gap will appear in `/gsd-progress` and the phase HUMAN-UAT until resolved.

## Threat Model

| Threat ID | Status |
|-----------|--------|
| T-05-03 (GIF size denial) | Mitigation **documented** in CAPTURE-INSTRUCTIONS.md (720p / 10fps / gifsicle --lossy=80, fallback to 8fps and lossy=120). Verified once the actual GIF is produced. |

## Self-Check

- [x] Task 1 fully complete and committed
- [x] Task 2 explicitly deferred with user consent (via AskUserQuestion checkpoint)
- [x] Deferred work surfaced as `pending` in frontmatter `key-files.pending`
- [x] Phase-level verification will flag the gap

## Self-Check: PARTIAL (Task 2 deferred per user)
