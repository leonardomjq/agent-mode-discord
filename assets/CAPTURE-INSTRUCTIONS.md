# Demo GIF Capture Instructions

This document describes how to capture `assets/demo.gif` for the README.
The GIF must show the Discord sidebar flipping from "Idling" to AGENT_ACTIVE
when `claude` starts in the VS Code integrated terminal.

## Why this is a manual step

The capture requires three live components running simultaneously:

1. The VS Code extension loaded (F5 debug session or installed VSIX)
2. The Discord desktop client signed in and online
3. A terminal session running `claude` with the companion plugin installed

These cannot be reliably automated in CI, so this remains a human task.

## Capture Setup

1. **Launch VS Code** with the extension active.
   - Either press `F5` from this repo (debug session), or install the VSIX
     locally:
     ```bash
     pnpm build
     npx @vscode/vsce package --no-dependencies
     code --install-extension agent-mode-discord-*.vsix
     ```
     (`@vscode/vsce` is downloaded on demand via `npx`; no project-level
     dependency is required for capture work. Phase 6 will add a
     `pnpm vscode:package` script wrapping this.)
2. **Open Discord** desktop and confirm you appear as Online.
   - Make sure the user-status row in the bottom-left of the Discord window
     is visible — that is the row the GIF must capture.
3. **Install the companion plugin** (one of these paths):
   - Permanent (shell): `claude plugin install ./companion/claude-code-plugin`
   - Permanent (from a Claude Code session): `/plugin install ./companion/claude-code-plugin`
   - One-shot for the recording: launch claude with
     `claude --plugin-dir ./companion/claude-code-plugin`
4. **Set up the screen recorder** so its frame contains:
   - The Discord sidebar (left side of Discord window) — required
   - The VS Code integrated terminal — required
   - VS Code title bar is helpful for context but optional

## Capture Sequence (15–30 seconds total)

| Time | Action |
|------|--------|
| 0–3s | Show Discord sidebar with current status ("Idling" or whatever the extension shows when no agent is running) |
| 3–5s | Switch focus to VS Code, open the integrated terminal |
| 5–10s | Type `claude` and press Enter |
| 10–15s | Cut to Discord sidebar — it should flip to AGENT_ACTIVE with the goblin / cooking copy |
| 15–20s | Let it sit through one or two rotation ticks so viewers see the copy change |
| 20–25s | Back to terminal, exit claude (`Ctrl+C` or `/exit`) |
| 25–30s | Show Discord sidebar returning to the previous state |

## Post-Processing

The recorder almost certainly outputs MP4 or MOV. Convert to an optimized GIF:

```bash
# 1. Convert to GIF at 720p / 10fps (lanczos scaling for sharper text)
ffmpeg -i demo.mp4 -vf "fps=10,scale=720:-1:flags=lanczos" -c:v gif assets/demo-raw.gif

# 2. Optimize aggressively to fit GitHub's 8 MB image embed limit
gifsicle --optimize=3 --lossy=80 assets/demo-raw.gif -o assets/demo.gif

# 3. Verify size (must be < 8 MB)
ls -lh assets/demo.gif
```

If the optimized GIF is still over 8 MB:

- Trim the duration toward the lower bound (15s rather than 30s)
- Drop fps to 8: `fps=8,scale=720:-1:flags=lanczos`
- Increase lossy to 120: `gifsicle --optimize=3 --lossy=120 ...`
- Crop to a tighter frame (Discord sidebar only) before the GIF conversion

## Verification Checklist

- [ ] `assets/demo.gif` exists
- [ ] File is under 8 MB (`stat -f%z assets/demo.gif` on macOS)
- [ ] GIF is between 15 and 30 seconds
- [ ] Discord sidebar transitions Idling → AGENT_ACTIVE → previous state are visible
- [ ] Goblin / cooking copy is readable in at least one frame
- [ ] GIF renders correctly in GitHub's markdown preview (test by drag-and-dropping into a draft issue)

## Cleanup

Remove the intermediate raw GIF and any local recordings before committing:

```bash
rm -f assets/demo-raw.gif demo.mp4
git add assets/demo.gif
```

Only `assets/demo.gif` should be committed; the raw recording stays local.
