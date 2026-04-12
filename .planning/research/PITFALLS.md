# Pitfalls Research

**Domain:** VS Code / Cursor extension + Discord Rich Presence + terminal-based AI agent detection
**Researched:** 2026-04-12
**Confidence:** HIGH for VS Code API + Discord RPC pitfalls (well-documented across vscord, Codex-Discord, cc-discord-presence, and @xhayper/discord-rpc issue trackers); MEDIUM for Cursor-on-Windows and Flatpak edge cases (observational, platform-specific); MEDIUM for fs.watch platform quirks (well-known in Node.js lore but rarely fatal at our signal cadence).

This document builds on `discord-agent-presence-prd.md` §14 (Risks) and §18 (Guardrails). Those cover the "known-known" pitfalls already in scope. Below I verify completeness, surface additional pitfalls that the PRD does not explicitly call out, and map every pitfall to the milestone that should defend against it.

---

## Critical Pitfalls

### Pitfall 1: Shell-integration async activation race (first command lost)

**What goes wrong:**
The user opens a fresh terminal and types `claude` immediately. `onDidStartTerminalShellExecution` never fires for that first command because shell integration hadn't finished injecting when the command ran. Presence stays stuck on CODING/IDLE while `claude` is plainly active. User files an issue titled "doesn't work for me" within 24h of launch.

**Why it happens:**
Shell Integration is injected asynchronously after the terminal process starts — it's not available synchronously when the Terminal is created. Developers test with long-lived terminals where integration has already landed and never hit the race. The stable API exposes `onDidChangeTerminalShellIntegration` precisely to paper over this, but the event is easy to forget because it's not in the "happy path" of the API docs.

**How to avoid:**
- Always subscribe to `onDidChangeTerminalShellIntegration` and treat it as a second entry point for attaching the detector to a terminal.
- When shell integration becomes available for an existing terminal, re-check `terminal.state` / any cached last-command hint and fire a synthetic detection pass. For the first command, there is no backfill — accept the miss and lean on tier-3 fs-watch.
- Do NOT treat the absence of `shellIntegration` on `window.createTerminal` as a permanent no-integration signal. Wait at least 2s before downgrading to fs-watch tier for that terminal.

**Warning signs:**
- Integration tests that pass locally but flake in CI with fresh shell sessions.
- Users reporting "works after I run a dummy command first."
- Telemetry (debug log) shows the first command in every new terminal session being classified as "no shell integration."

**Phase to address:** M1 (Detection core) — add `onDidChangeTerminalShellIntegration` listener alongside start/end listeners; cover in regex.test.ts with a mock delayed-activation scenario.

**Confidence:** HIGH — documented in vscode.d.ts and every Shell Integration API user hits this eventually.

---

### Pitfall 2: `commandLine.confidence === Low` producing garbled regex input

**What goes wrong:**
`execution.commandLine.value` can be `Low` confidence when VS Code reconstructs the command from terminal output rather than shell integration hinting. The string contains ANSI escape sequences, prompt prefixes (`user@host ~/proj $ `), window-title writes, OSC 133 markers, and sometimes multi-line continuations. A naive `value.startsWith('claude')` misses the match even though the user ran `claude`.

**Why it happens:**
Low confidence is VS Code saying "I guessed." Developers test with zsh + VS Code's injected `.zsh-integration.zsh` where confidence is High, and never see the Low path. Cursor on Windows, fish without the integration plugin, and Command Prompt are where Low dominates.

**How to avoid:**
- Always strip ANSI (CSI sequences, OSC sequences) before regex: `value.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '')`.
- Strip leading prompt junk up to the last `$`, `>`, `#`, or `%` followed by whitespace: `/^.*?[\$%#>]\s+/`.
- Anchor the regex with `^\s*` and accept the first bare token.
- When `confidence === Low`, log a debug warning and still attempt the match; do not silently skip.
- Write regex tests that include realistic Low-confidence payloads captured from Cursor-on-Windows.

**Warning signs:**
- Detection works on macOS zsh but silently fails on Windows/fish.
- Debug logs show `commandLine.value` containing `\x1b[` byte sequences.
- Users report "I'm literally typing `claude` and nothing happens."

**Phase to address:** M1 (Detection core) — ANSI strip in `shellIntegration.ts`, fixtures in `regex.test.ts` covering Low-confidence payloads from all supported shells.

**Confidence:** HIGH — explicitly called out in PRD §FR-1.2 and vscode.d.ts.

---

### Pitfall 3: Shells without shell-integration plugin silently disable detection

**What goes wrong:**
Users on Command Prompt, fish without plugin, nu, or PowerShell with integration disabled see zero detection. Because the extension doesn't surface the failure (by design — no toasts), users conclude the extension is broken and uninstall.

**Why it happens:**
Shell Integration only injects automatically for bash, zsh, pwsh, and git-bash. Everyone else is on their own unless they run the shell's integration script manually. The extension should notice this and fall back, but a tier-3 fs-watch fallback requires the user to have run `claude` at least once (so the JSONL file exists) — on a fresh install both are empty.

**How to avoid:**
- Detect missing shell integration after a 2s grace period per terminal (`terminal.shellIntegration === undefined` after `onDidOpenTerminal` + 2s). Log to debug, but also surface via a one-time VS Code information message (dismissable, gated by `debug.verbose` so it doesn't spam) pointing to the troubleshooting section of the README.
- Ensure tier-3 fs-watch watches the directory (not each file) with a recursive watcher so newly created JSONL files are picked up without needing existence at activation.
- README "Troubleshooting" section with copy-paste snippets to enable shell integration for fish/nu/Command Prompt.

**Warning signs:**
- Uninstall-within-1h spike after launch.
- Discord users on PowerShell/fish reporting "nothing happens ever."

**Phase to address:** M1 (fallback behavior) + M6b (README troubleshooting section).

**Confidence:** HIGH for shells lacking integration; MEDIUM on user-behavior assumption.

---

### Pitfall 4: Cursor-on-Windows shell-integration breakage (documented platform-specific failure)

**What goes wrong:**
Cursor on Windows has known shell-integration bugs (Cursor forum threads cited in PRD §19). Shell integration either never activates, activates but always returns `confidence === Low` with corrupted payloads, or loses events after a shell restart. Primary detection tier is functionally broken on what is probably 15–25% of the target user base (Windows Cursor users).

**Why it happens:**
Cursor forked VS Code but lags on some terminal internals. Their injected integration script conflicts with Windows terminal rendering. This is not fixable in the extension.

**How to avoid:**
- Tier-3 fs-watch is the documented mitigation path. Verify it triggers within 5s of a `claude` session writing to `~/.claude/projects/<workspace>/*.jsonl`.
- README clearly calls out "Cursor on Windows uses filesystem fallback — detection latency ~5s instead of ~500ms."
- Cursor-on-Windows test is explicit in M7 DoD (§15 cross-editor smoke, best-effort).
- The companion plugin (M5) is the durable workaround — lockfile detection is platform-agnostic.

**Warning signs:**
- Windows Cursor users filing bugs with "detection slow" or "presence shows CODING while claude is running."
- Debug logs on Windows Cursor consistently show no shell-integration events.

**Phase to address:** M1 (fallback), M5 (companion plugin as best workaround), M6b (README caveat).

**Confidence:** HIGH (well-documented in Cursor forums) but affects a specific platform slice.

---

### Pitfall 5: Ghost presence from `setActivity(null)` on deactivate

**What goes wrong:**
Calling `setActivity(null)` to clear presence leaves a ghost activity in some Discord client versions — the user's status stays on the last message forever until Discord is restarted. vscord hit this historically. User reports "it says I'm still coding even though I closed VS Code hours ago."

**Why it happens:**
Discord treats `null` activity as "no change in this field" in certain IPC payload shapes. The correct clear is `clearActivity(pid)`, which sends an explicit CLEAR op.

**How to avoid:**
- Always `client.user?.clearActivity(process.pid)` in `deactivate()`.
- Never pass `null` to `setActivity`.
- Also clear on `onDidCloseTerminal` for a terminal that held an AGENT_ACTIVE session, when the map becomes empty.
- Register a `process.on('exit')` hook as a last-resort clear — deactivate is not guaranteed to run on crash.

**Warning signs:**
- Users reporting "stuck on `cooking...`" hours after VS Code exit.
- Integration test: kill the extension-host process with SIGKILL, observe Discord — if presence persists > 30s, there is no cleanup path.

**Phase to address:** M2 (RPC hardening) — tests must cover crash/exit cleanup paths, not just graceful deactivate.

**Confidence:** HIGH — called out in PRD §FR-4.3 and §18.

---

### Pitfall 6: Reconnect thrashing after Discord restart

**What goes wrong:**
User quits Discord, the extension starts reconnect attempts at 5s intervals. User restarts Discord — the in-flight 5s cycle collides with Discord's socket-creation delay and the extension sees ECONNREFUSED → resets the backoff → immediate retry → thrash. CPU spikes, event log fills, and the reconnect never settles. Worst case: Discord's own RPC rate limiter permanently disconnects the client.

**Why it happens:**
Naive exponential backoff resets on connection events, not on wall-clock time. `@xhayper/discord-rpc` emits `ready` / `disconnected` rapidly during the restart window.

**How to avoid:**
- Cooldown guard: `lastAttemptAt` wall-clock check. Refuse to retry within 5s of the last attempt *regardless* of what event triggered the retry call. PRD §FR-4.2 already specifies this — verify the implementation actually gates by wall-clock, not just by backoff-level.
- Debounce `disconnected` → reconnect path by 1s.
- Cap total reconnect attempts per 5-min window (e.g., 10). After cap, pause for 60s before resuming.
- Log every reconnect with wall-clock timestamp so thrash is visible in debug output.

**Warning signs:**
- Debug log showing > 3 reconnect attempts in a 15s window.
- Discord IPC returning "rate limited" or outright closing the socket.
- CPU spike in the extension host during Discord restart.

**Phase to address:** M2 (RPC hardening) — backoff + cooldown test harness.

**Confidence:** HIGH — Codex-Discord-Rich-Presence `src/discord.rs:35-36, 276-282` is cited in PRD as the reference implementation precisely because they hit this.

---

### Pitfall 7: Multi-window presence collisions without pid-scoping

**What goes wrong:**
User has two VS Code windows open (typical for monorepo work), one running `claude` in each. Both extension instances call `setActivity` with the same user — they overwrite each other. Discord flickers between the two payloads every update cycle; presence appears "glitchy."

**Why it happens:**
Discord RPC IPC is per-process — both extension hosts connect to the same Discord, and whichever wrote last wins. Without `pid` scoping, Discord has no way to distinguish presences from different windows.

**How to avoid:**
- Pass `process.pid` to every `setActivity` and `clearActivity` call via the `@xhayper/discord-rpc` API.
- On deactivate, clear ONLY that pid (`clearActivity(process.pid)`) — do not clear the whole activity.
- Test: open two windows, `claude` in one only — verify the other window's CODING presence is unaffected.

**Warning signs:**
- Users reporting "presence flickers when I have multiple VS Code windows."
- Debug logs from two extension hosts racing each other's setActivity.

**Phase to address:** M2 (RPC hardening) — DoD explicitly includes two-window pid isolation test.

**Confidence:** HIGH — called out in PRD §FR-4.4.

---

### Pitfall 8: Discord web client and Flatpak Discord have no local IPC

**What goes wrong:**
User on Linux installs Discord via Flatpak (sandboxed, default on many distros). The extension silently retries connection forever because the IPC socket is not accessible from outside the sandbox. User sees "Discord is running" but presence never appears. Same failure for web-only Discord users.

**Why it happens:**
Discord RPC is a local IPC transport — Unix domain socket on Linux/macOS (`$XDG_RUNTIME_DIR/discord-ipc-0`), named pipe on Windows (`\\?\pipe\discord-ipc-0`). Flatpak sandboxes `$XDG_RUNTIME_DIR`; the socket isn't visible. Discord web has no IPC surface at all.

**How to avoid:**
- Document Flatpak workaround in README: `flatpak override --user --filesystem=xdg-run/app/com.discordapp.Discord com.discordapp.Discord` or the `discord-flatpak-rpc-bridge` tool.
- Document "web Discord is unsupported" prominently in README install section.
- Probe common socket paths on activation; if none exist after 30s, log a debug message pointing to the docs (do not toast, per §FR-4.5).
- Also probe the Discord Canary / PTB socket names (`discord-ipc-0` through `discord-ipc-9`) — `@xhayper/discord-rpc` already iterates these but confirm.

**Warning signs:**
- Linux users on issue tracker reporting "Discord is running but no presence."
- `discord-ipc-0` missing in `$XDG_RUNTIME_DIR` despite Discord being visible.

**Phase to address:** M6b (README) — Flatpak caveat + unsupported list (web, mobile). Optional: M2 probe-and-give-up logic.

**Confidence:** HIGH for Flatpak (documented by Discord community); HIGH for web (no IPC surface exists).

---

### Pitfall 9: Marketplace submission rejection on first upload

**What goes wrong:**
`vsce publish` rejects the first upload for any of: proposed API usage, missing `publisher` field, PAT with wrong scope, `engines.vscode` mismatch, or `repository` URL not resolving. Launch day slips because the publish pipeline was never exercised end-to-end before the tag push.

**Why it happens:**
`vsce package` locally succeeds with warnings that get ignored. The actual Marketplace validator runs server-side during `vsce publish` and is stricter. PATs in Azure DevOps need "Marketplace: Manage" scope specifically — "Code: Read" or "full access" with default scopes doesn't cut it. OpenVSX namespace must be pre-claimed via Eclipse Foundation signup.

**How to avoid:**
- Dry-run before tagging: `vsce publish --pre-release --dry-run` and `ovsx publish --dry-run` in M7 DoD (already present in PRD).
- Verify PAT scope: `vsce verify-pat <publisher>` succeeds.
- Use `--pre-release` flag for the first 2-3 releases so rollback is trivial.
- Run `vsce package` and inspect the VSIX tarball: `unzip -l extension.vsix` — confirm no `.env`, no `node_modules`, no `.planning/`.
- Verify `.vscodeignore` excludes test/, research/, CLAUDE.md, companion/, *.md except README/LICENSE/CHANGELOG.
- OpenVSX namespace claim takes manual approval (can take hours) — do this in week 1 of the 2-week window, not the day of launch.

**Warning signs:**
- `vsce package` output contains WARNING lines (badges, repo link, icon missing).
- `vsce verify-pat` fails.
- OpenVSX namespace shows "pending review."

**Phase to address:** M7 (Publish) — all dry-runs gate tagging; OpenVSX claim moves to M0 or M6a to avoid last-minute blocking.

**Confidence:** HIGH — vsce and ovsx error cases are well-documented; the "didn't realize PAT scope was wrong" is the most common launch-day delay.

---

### Pitfall 10: `fs.watch` platform quirks on lockfile + JSONL watchers

**What goes wrong:**
- **Linux:** `fs.watch` hits inotify watcher limits (`ENOSPC`) when `~/.claude/projects/` has many session files. Watcher silently stops firing events.
- **macOS:** FSEvents coalesces rapid events — a lockfile created and deleted within 50ms may emit only one `rename` event with no way to tell which direction.
- **Windows:** `ReadDirectoryChangesW` reports on 8.3 short paths sometimes; recursive watch has a buffer-overflow failure mode that kills the watcher without error.
- **All:** Non-recursive watchers miss files in subdirectories; default `recursive: true` works on macOS/Windows but is opt-in only on Linux (Node 20+) and may not work.

**Why it happens:**
`fs.watch` is the leakiest cross-platform API in Node.js. Each OS backend has different semantics.

**How to avoid:**
- Use `chokidar`-style polling fallback? No — PRD locks runtime deps to one (`@xhayper/discord-rpc`). Stick with `fs.watch` but:
- Wrap every `fs.watch` call in try/catch; on error, log and schedule a retry after 5s.
- For the lockfile, use `fs.watchFile` (polling-based, 5s interval) as a parallel mechanism — it's slower but immune to inotify limits. PRD requires mtime+existence signal only, so polling works fine here.
- For `~/.claude/projects/*.jsonl`, watch the directory, not each file. Coalesce events within a 1s window to avoid duplicate processing.
- Debounce lockfile events by 100ms — a `rename` followed immediately by a `change` is one logical event.
- On Linux, document inotify limit (`fs.file-max` / `/proc/sys/fs/inotify/max_user_watches`) in README troubleshooting.
- Never assume `recursive: true` works cross-platform; enumerate children manually if needed.

**Warning signs:**
- Lockfile watcher silently stops firing after some time.
- Linux users with many Claude sessions in `~/.claude/projects/` reporting detection stops working.
- Windows users reporting intermittent detection.

**Phase to address:** M1 (fs-watch tier) + M5 (companion lockfile watcher) — add try/catch + retry + `fs.watchFile` fallback for lockfile.

**Confidence:** HIGH for Linux inotify limits; MEDIUM-HIGH for macOS coalescing; MEDIUM for Windows recursive-watch quirks (rare but fatal when hit).

---

### Pitfall 11: Race conditions in parallel `claude` session map

**What goes wrong:**
Two `claude` sessions start in rapid succession (< 10ms apart). `onDidStartTerminalShellExecution` fires twice. Map adds two entries. Both end near-simultaneously. `onDidEndTerminalShellExecution` fires twice but may arrive out of order or be swallowed if the terminal closes abruptly. Session map ends up with stale entries, presence stuck on AGENT_ACTIVE forever.

**Why it happens:**
- VS Code events are not guaranteed strictly ordered under process pressure.
- `onDidCloseTerminal` does NOT always fire after `onDidEndTerminalShellExecution` in crash/SIGKILL cases.
- Map keyed by `vscode.Terminal` object identity (not by string ID) — if the reference is held after close, GC may interfere.

**How to avoid:**
- Key the session map by a stable synthetic ID (e.g., `terminal.processId` or a monotonic counter), not by the `Terminal` object itself.
- Subscribe to `onDidCloseTerminal` and sweep any session keyed to that terminal.
- On every tick, reconcile: for each entry in the map, verify `terminal.exitStatus === undefined` (still alive). If the terminal exited, remove the entry.
- Guard state transitions with a "last updated" timestamp — if AGENT_ACTIVE has held > 6h without any tick refresh, assume staleness and force transition.

**Warning signs:**
- Presence stuck on AGENT_ACTIVE after the user has clearly stopped everything.
- Debug log shows add without matching remove, or vice versa.

**Phase to address:** M1 (session map) + M2 (state transitions under rapid-fire conditions).

**Confidence:** MEDIUM — plausible based on VS Code API semantics; the reconciliation sweep is defensive.

---

### Pitfall 12: Regex detection gaps (aliases, env prefixes, tmux, renamed tabs)

**What goes wrong:**
User runs `NODE_OPTIONS=--max-old-space-size=4096 claude`, or `alias c=claude` then `c`, or pipes (`echo prompt | claude`), or runs inside `tmux new -s work 'claude'`, or renamed their terminal tab to "chat" — none match the regex anchored with `^\s*(claude|...)`.

**Why it happens:**
Regex is literal. Shell aliases resolve *before* the shell-integration hook fires (the expanded command is what we see), so aliases to `claude` do work — but env-prefixed invocations push the executable past the `^\s*` anchor. Power users invent inventive launch patterns.

**How to avoid:**
- Relax the regex anchor: `^(?:\s*[A-Z_]+=\S+\s+)*` prefix to consume zero or more `VAR=value` pairs before the executable token.
- Accept piped invocations by also matching `(^|[\|;&]\s*)(claude|...)`.
- For tmux/screen inside the integrated terminal: this is a fundamental limitation — the outer shell integration only sees `tmux new ...`, not the nested command. Document it. Tier-3 fs-watch covers this case because `claude` still writes to `~/.claude/projects/` regardless.
- `detect.customPatterns` escape hatch (already in PRD §FR-1.7) lets power users supply their own regex.
- Test fixtures in `regex.test.ts` cover env-prefixed, aliased, and piped invocations.

**Warning signs:**
- Power users reporting "doesn't detect my setup" with exotic invocation patterns in bug reports.
- Regex match rate below 90% across a corpus of realistic invocations.

**Phase to address:** M1 (regex hardening) — env-prefix + pipe variants in tests.

**Confidence:** HIGH for env-prefix / alias gaps; HIGH for tmux being fundamentally invisible to outer shell integration.

---

### Pitfall 13: `@xhayper/discord-rpc` reconnect state not reset after Discord restart

**What goes wrong:**
After Discord restarts, reconnecting succeeds, but `setActivity` calls silently no-op because the internal client state still thinks it's disconnected. User sees "Connected" in debug log but no presence update ever reaches Discord.

**Why it happens:**
`@xhayper/discord-rpc` (and its upstream Khaomi fork) has historically had reconnect edge cases where internal handshake state is not fully reset. Some versions require destroying and re-creating the client rather than calling `connect()` again.

**How to avoid:**
- On `disconnected` event, destroy the existing client entirely and instantiate a new one on the next reconnect attempt. Do NOT reuse the disconnected instance.
- Pin `@xhayper/discord-rpc` exactly (per PRD §18 guidance when bundle size demands it — also apply for reconnect-stability reasons if the library regresses).
- Verify post-reconnect by querying `client.user` — if undefined, reconnect failed even though `connect()` resolved.
- Integration test: restart Discord mid-session, ensure presence resumes within 10s.

**Warning signs:**
- Debug log shows reconnect success but no subsequent `setActivity` produces Discord-side updates.
- Users reporting "have to restart VS Code after Discord restart."

**Phase to address:** M2 (RPC hardening) — destroy-and-recreate on disconnect, explicit post-reconnect verification.

**Confidence:** MEDIUM — specific to library internals; mitigate defensively.

---

### Pitfall 14: `vscode.git` extension disabled returns undefined

**What goes wrong:**
`vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)` returns undefined if the user has disabled the built-in Git extension (enterprise environments do this routinely). Code assuming non-null `.getAPI(1)` result throws; git branch never populates and may crash the presence update cycle.

**Why it happens:**
Built-in extensions can be disabled per-workspace. Developers rarely test with them disabled.

**How to avoid:**
- Use optional chaining all the way: `vscode.extensions.getExtension('vscode.git')?.exports?.getAPI?.(1)`.
- Check `extension.isActive` — if false, await `extension.activate()` before calling `getAPI`.
- Wrap in try/catch with a fallback to "no branch info." Privacy settings already support hiding the branch, so absent-branch is a valid state.
- Test with `"git.enabled": false` in workspace settings.

**Warning signs:**
- Uncaught exceptions in extension host log mentioning `getAPI is not a function` or `Cannot read properties of undefined`.
- Enterprise users (likely to disable Git) reporting extension crashes.

**Phase to address:** M2 (git bridge) — defensive access + test with disabled Git.

**Confidence:** HIGH — standard VS Code API pitfall.

---

### Pitfall 15: JSONL structural parsing (forbidden by §18)

**What goes wrong:**
A well-meaning developer "improves" the fs-watch tier by parsing the JSONL file to extract model name, token count, or session metadata. Anthropic ships a format change in a minor update. Extension crashes on unparseable JSON, or silently misclassifies sessions.

**Why it happens:**
The JSONL format looks stable; parsing it unlocks richer telemetry. It's an obvious-seeming enhancement.

**How to avoid:**
- PRD §FR-1.8 and §18 are hard rules: mtime + existence only. Code review MUST reject any PR that reads JSONL contents.
- Add a CI check: grep for `JSON.parse` near any `~/.claude` path string in the codebase; fail if found.
- Add an explicit test that exercises the fs-watch tier with a malformed JSONL file (contents: `not json at all`) — detector must still fire on mtime change.

**Warning signs:**
- PR description mentioning "parse" or "extract" near `~/.claude/projects`.
- Test file reads JSONL contents.

**Phase to address:** M1 (sessionFiles.ts implementation) — enforcement in code review + CI grep check.

**Confidence:** HIGH — explicit guardrail violation risk, inevitable temptation.

---

### Pitfall 16: Companion plugin `~/.claude/` directory assumptions

**What goes wrong:**
`~/.claude/` doesn't exist for first-time Claude Code users. The companion plugin's `start.sh` tries to write the lockfile, fails silently on `ENOENT`, and detection degrades to tier-2. Or: the plugin holds the lockfile open with a write lock and Claude Code abnormally exits, leaving a stale lockfile forever; presence stuck on AGENT_ACTIVE.

**Why it happens:**
- Shell scripts often assume directories exist.
- `SessionEnd` hook does not always fire on crash / SIGKILL / OOM.
- No cleanup path covers "Claude Code crashed."

**How to avoid:**
- `start.sh`: `mkdir -p "$HOME/.claude"` before writing. Use atomic write (`touch` + `mv` or flock).
- Lockfile contents: include the Claude Code PID. Extension-side watcher, on activation sweep, reads the PID, checks `process.kill(pid, 0)` — if the process is gone, delete the stale lockfile.
- Lockfile max-age: if mtime > 24h, treat as stale regardless of PID.
- `stop.sh`: idempotent removal (`rm -f`).
- Add a sweep on extension activation that removes orphaned lockfiles.

**Warning signs:**
- Users reporting "status stuck on `cooking...` after I force-quit Claude."
- Lockfile present but no `claude` process running.

**Phase to address:** M5 (companion plugin) — atomic writes + PID-in-lockfile + sweep-on-activate.

**Confidence:** HIGH — classic lockfile pitfalls, universally applicable.

---

### Pitfall 17: Bundle size overrun from `@xhayper/discord-rpc` transitive deps

**What goes wrong:**
`@xhayper/discord-rpc` depends on `@discordjs/rest` + `undici`. esbuild's default tree-shaking pulls in parts of undici's HTTP stack that aren't needed for IPC-only usage. Bundle hits 600-800 KB, violates < 500 KB target, Marketplace listing size warning, activation cost creeps past 50ms.

**Why it happens:**
The library targets the full Discord bot API (REST + Gateway + IPC). For presence-only, RE ST+ undici are dead weight but tree-shaking can't prove it because of dynamic imports inside `@discordjs/rest`.

**How to avoid:**
- Measure early: add `ls -lh dist/extension.cjs` to the M0 DoD acceptance.
- Pin `@xhayper/discord-rpc` exactly (no `^`) — per PRD §18 — to prevent upstream minor bumps from regressing tree-shaking.
- esbuild with `--minify --tree-shaking=true --platform=node --external:vscode`.
- If still over budget, use esbuild `--alias:@discordjs/rest=./src/shims/empty.ts` to force-exclude unused paths. Test that IPC still works.
- Last resort: fork `@xhayper/discord-rpc` and strip the REST/gateway code. Document in README.
- CI check: fail if `dist/extension.cjs` exceeds 500 KB.

**Warning signs:**
- Bundle size crosses 400 KB during M1-M2 (trending toward 500).
- esbuild metafile analysis shows `undici` > 150 KB.

**Phase to address:** M0 (baseline measurement) + M7 (final gate) — CI size check from M0 onward.

**Confidence:** HIGH — `@discordjs/rest`+`undici` is known-heavy. vscord bundles a different library for this reason.

---

### Pitfall 18: Stale presence on VS Code/extension crash (no deactivate)

**What goes wrong:**
VS Code crashes or is killed with SIGKILL. `deactivate()` doesn't run. Discord presence persists forever (until Discord itself restarts). User has "cooking" status for days.

**Why it happens:**
VS Code's extension deactivation is best-effort — crash paths skip it.

**How to avoid:**
- Register `process.on('exit')`, `process.on('SIGINT')`, `process.on('SIGTERM')` to attempt a synchronous `clearActivity` call. Synchronous IPC write is allowed in exit handlers.
- Set a short Discord activity `startTimestamp` staleness: if the presence hasn't been refreshed in > 10 min, Discord itself doesn't auto-clear, but we can design copy that doesn't lie — elapsed time ticking up to "7h 42m" is self-outing as stale.
- Accept that crash-path ghosting is partially unavoidable; mitigate via the pid-scoped clear so a fresh VS Code launch clears the ghost.
- On extension activation, always `clearActivity(process.pid)` first thing before setting new activity — clears prior ghost from same pid (though new pid after restart).

**Warning signs:**
- Users reporting "status stuck for hours after my laptop slept."
- Discord presence elapsed timer showing > 8h.

**Phase to address:** M2 (RPC hardening) — exit handlers + activation-time clear.

**Confidence:** HIGH — crash-path cleanup is a universal desktop-IPC problem.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip `onDidChangeTerminalShellIntegration` listener | Simpler M1 code | First command in every terminal missed; "doesn't work" bug reports | Never — listener is 10 lines, bug is chronic |
| Parse JSONL for richer state | Unlocks model/cost telemetry | Format change breaks extension, §18 violation | Never for v0.1; v0.2 via stable surface only |
| Single watcher for entire `~/.claude/projects/` | Simple code | Inotify limit hit on Linux heavy users | MVP only; add per-workspace scoping in v0.2 |
| `setActivity(null)` instead of `clearActivity(pid)` | One line saved | Ghost presence on some Discord versions | Never |
| Skip pid-scoping on setActivity | One param saved | Multi-window collisions | Never — single-window is not a safe assumption |
| Hardcode regex without ANSI strip | Simpler detector | Low-confidence payloads fail silently | Never — ANSI strip is ~5 lines |
| Synchronous `fs.readFileSync` in presence hot path | Simple code | Blocks extension host on slow disks | Never for any file read; use async or cache |
| Accept generic `"*"` activation events | Quick fix if events miss | Activation cost blown; Marketplace rejection risk | Never — PRD locks `onStartupFinished` |
| Ship with warnings from `vsce package` | Faster first publish | Warnings compound; Marketplace listing quality degrades | Never for production tags; acceptable for `--pre-release` scaffolding |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Discord RPC (`@xhayper/discord-rpc`) | Reusing client instance after disconnect | Destroy and recreate on every reconnect |
| Discord RPC | Omitting `pid` from setActivity/clearActivity | Always pass `process.pid` |
| Discord RPC | Calling `setActivity(null)` | Use `client.user?.clearActivity(process.pid)` |
| VS Code Shell Integration | Only listening to start/end, not change | Subscribe to `onDidChangeTerminalShellIntegration` for async activation |
| VS Code Shell Integration | Regex directly on `commandLine.value` | Strip ANSI + prompt prefix first |
| VS Code git extension | `getExtension('vscode.git').exports.getAPI(1)` | Chain optional, await `isActive`, try/catch |
| Claude Code hooks | Assuming `SessionEnd` always fires | Add staleness sweep + PID liveness check on lockfile |
| Azure DevOps PAT | Default scopes | Must scope to `Marketplace: Manage` specifically |
| OpenVSX namespace | Claiming day of launch | Claim 5+ days early — manual Eclipse review |
| Flatpak Discord | Extension expects socket always present | Document override; accept graceful silent retry |
| `fs.watch` on Linux | Watching many files | Hit inotify limit; watch directory with coalescing |
| esbuild tree-shaking of undici | Default config | Measure metafile; alias-shim unused paths if needed |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unthrottled `setActivity` | Discord rate-limit disconnect | 2s leading+trailing throttle (PRD FR-7.1) | State flip storms > 2/sec |
| Watcher per-file in `~/.claude/projects/` | Extension activation slow on users with many sessions | Single directory watcher | Users with > 100 cached session files |
| Synchronous reads in presence hot path | Animator clock jitter, 100+ ms stalls | Cache context; read async | Slow disks, network-mounted homes |
| Regex re-compile per command | CPU spike on busy terminals | Compile once, module-scope constant | Heavy tmux / multi-terminal users |
| Pack JSON parse on every rotation tick | Animator latency | Parse once, validate on load | Custom-pack users with large JSON |
| Unthrottled `onDidChangeTextDocument` | State thrash CODING ↔ IDLE | Debounce 500ms+ | Large file edits, autosave bursts |
| No exit-handler cleanup | Discord ghosts on crash | Register SIGINT/SIGTERM/exit | Every crash scenario |
| Reconnect loops without cooldown | Discord IPC rate-limits and closes | Wall-clock cooldown guard (5s min) | Discord restart scenarios |

---

## Security / Privacy Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging workspace path at `info` level | Leaks project names to extension logs that users may share | Log only at `debug.verbose`; redact paths via privacy layer before logging |
| Sending filename/branch without respecting privacy settings | User's client-work project name leaks to public Discord | Privacy resolution runs *before* templating; substitution produces empty string for hidden fields |
| Storing custom-pack JSON with secrets (hypothetical: Discord tokens) | User commits `clientId` override with a token | Never accept tokens in config schema; validate clientId is numeric-only |
| Reading `~/.claude/projects/*.jsonl` contents | Leaks prompt content into extension memory; legal/compliance | mtime + existence only (§FR-1.8, §18) |
| Writing outside VS Code extension storage | Pollutes user home; violates PRD constraint | Never write; only companion plugin writes to `~/.claude/` |
| Transmitting any data outside Discord IPC | Violates "no network" constraint | No `fetch`, no `http`, no `https` imports allowed |
| Loading user custom packs without schema validation | Malformed pack could crash or produce XSS-like content in Discord | Validate against `schema/pack.schema.json` before use |
| Exposing shell commands via `{commandLine}` template variable | Leaks flags / args / file paths that may be sensitive | Do not add such a template variable (§18 forbids parsing commandLine beyond agent id) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Toasting on Discord disconnect | Noisy; users disable the extension | Silent retry forever, log at debug only (PRD §FR-4.5) |
| Requiring BYO Discord Client ID | Kills install rate (Codex-Discord-Rich-Presence pattern we reject) | Bundle a default Client ID; allow override (PRD §FR-4.1) |
| No way to turn off animations | Users on bandwidth-sensitive Discord accounts want static text | `animations.enabled: false` → show first frame statically (PRD §FR-5.6) |
| Requiring window reload on config change | Bad DX for a personality-driven feature | Live config reload via `onDidChangeConfiguration` (PRD §FR-6.5) |
| Detection false-positives on typos (`claudex`, `aide`) | User's random typo flips presence | Anchor regex with word boundary; test on common false-positives |
| Showing "editing " when filename is hidden (empty substitution) | Presence text looks broken | Skip messages that produce empty substitutions (PRD M3 DoD) |
| Presence elapsed timer resets on every rotation | User can't tell how long they've been in session | Reset only on state-machine transitions, not rotations (PRD §FR-5.7) |
| Generic "agent active" for all agents despite per-agent packs | v0.1 scope-creep escape; acceptable per PRD | Document explicitly in README that only Claude has bespoke copy in v0.1 |
| Ignore list matches silently take extension fully silent | User wonders "why doesn't it work on this repo?" | Log at debug when ignore list matches; document in README |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces. Use this during M2–M7 gate reviews.

- [ ] **Shell integration listener:** Often missing `onDidChangeTerminalShellIntegration` — verify first-command detection in a fresh terminal works, not just re-used ones.
- [ ] **Regex:** Often tested only with bare `claude` — verify env-prefixed, aliased, piped, and `npx`/`bunx` variants all match.
- [ ] **ANSI stripping:** Often tested with clean inputs — verify with real Low-confidence payload captures from Windows/fish.
- [ ] **Deactivate cleanup:** Often relies on `deactivate()` — verify SIGKILL, crash, and `process.exit()` paths all clear presence (exit handlers registered).
- [ ] **Reconnect:** Often tested with one disconnect cycle — verify rapid Discord restart (close + reopen within 5s) doesn't thrash or deadlock.
- [ ] **Multi-window pid scoping:** Often tested with one window — verify two windows with independent `claude` sessions show independent presences.
- [ ] **Session map:** Often tested with sequential start/end — verify 10 parallel start events then 10 out-of-order end events leaves map empty.
- [ ] **fs.watch resilience:** Often tested once — verify watcher survives target directory deletion + recreation, and retries on error.
- [ ] **Companion lockfile staleness:** Often tested with graceful stop — verify stale lockfile from crashed Claude gets cleaned on extension activate.
- [ ] **Bundle size:** Often measured at M0 and forgotten — verify CI enforces < 500 KB on every PR.
- [ ] **Publish dry-run:** Often skipped because "local package works" — verify `vsce publish --dry-run` and `ovsx publish --dry-run` both succeed before tagging.
- [ ] **VSIX contents:** Often has stray files — verify `unzip -l` shows no `.planning/`, no `test/`, no `.env`, no `CLAUDE.md`.
- [ ] **Privacy templating:** Often substitutes before hiding — verify `"editing {filename}"` with filename hidden produces skip, not `"editing "`.
- [ ] **Git extension:** Often assumed present — verify extension loads and functions with built-in Git disabled.
- [ ] **Cross-editor:** Often tested only on VS Code — verify install + functionality on Cursor (VSIX sideload is not enough; OpenVSX install flow must work).
- [ ] **Windows Cursor:** Often skipped because "best effort" — verify fs-watch tier actually fires on Windows Cursor (M7 DoD).
- [ ] **Flatpak / web Discord:** Often not documented — verify README calls out unsupported clients clearly.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Ghost presence post-crash | LOW | User restarts VS Code; activation clears via `clearActivity(pid)` first thing |
| Marketplace publish rejection | LOW | Fix warning, bump patch version (`0.1.1`), re-run `vsce publish` — pre-release tag limits blast radius |
| OpenVSX namespace pending | MEDIUM | Cannot publish until approved — contact Eclipse Foundation, email response in 24–72h |
| Discord rate-limit disconnect | LOW | Cooldown guard kicks in automatically; 60s pause → resume |
| Bundle size regression | MEDIUM | `esbuild --analyze` metafile; alias-shim the fattest dep; worst case pin `@xhayper/discord-rpc` |
| `fs.watch` ENOSPC on Linux | MEDIUM | Fallback to `fs.watchFile` polling; document `max_user_watches` bump in README |
| Detection broken after Claude CLI rename | MEDIUM | Ship `0.1.x` with updated regex within 48h; users can apply `detect.customPatterns` immediately as workaround |
| Companion plugin stale lockfile | LOW | Extension sweep on activate removes it; user restarts VS Code once |
| Riko pivots to terminal detection mid-launch | HIGH | Ship faster; lean on Marketplace compliance as differentiator; emphasize multi-agent moat in positioning |
| Discord deprecates or changes IPC | HIGH | v0.2 pivot; no workaround in v0.1 scope |

---

## Pitfall-to-Phase Mapping

How PRD §12 milestones defend against each pitfall. Verification columns are concrete acceptance checks to add to milestone DoDs.

| # | Pitfall | Prevention Phase | Verification |
|---|---------|------------------|--------------|
| 1 | Shell integration async activation | M1 | Test: fresh terminal + immediate `claude` detects within 1s; covered in regex.test.ts with mocked delayed activation |
| 2 | `commandLine.confidence === Low` parsing | M1 | Fixtures in regex.test.ts: ANSI + prompt-prefix + OSC 133 payloads from Windows Cursor |
| 3 | Shells without integration | M1 + M6b | fs-watch tier test + README troubleshooting section |
| 4 | Cursor-on-Windows breakage | M1 + M5 + M6b | M7 cross-editor smoke on Windows Cursor; companion plugin is the reliable workaround |
| 5 | Ghost presence from setActivity(null) | M2 | Test: deactivate clears; SIGKILL path verified with exit handler test |
| 6 | Reconnect thrashing | M2 | Test: simulate Discord restart cycle, assert ≥5s between reconnect attempts (wall-clock) |
| 7 | Multi-window collisions | M2 | DoD: two windows independent — already in M2 DoD |
| 8 | Web / Flatpak Discord unsupported | M6b | README calls out unsupported clients; probe logic logs at debug |
| 9 | Marketplace publish rejection | M0 + M7 | OpenVSX namespace claimed early (M0); dry-runs in M7 DoD |
| 10 | fs.watch platform quirks | M1 + M5 | try/catch + retry wrapper around every watcher; Linux + Windows + macOS test fixtures |
| 11 | Session map race conditions | M1 + M2 | Stress test: 10 parallel start + out-of-order end; reconciliation sweep verifies map empty |
| 12 | Regex detection gaps | M1 | Fixtures for env-prefixed, aliased, piped, tmux-wrapped invocations |
| 13 | `@xhayper/discord-rpc` reconnect state | M2 | Destroy-and-recreate pattern; post-reconnect `client.user` verification |
| 14 | Disabled Git extension | M2 | Test with `"git.enabled": false` — presence still updates, branch absent |
| 15 | JSONL structural parsing | M1 + CI | Code review + CI grep check for `JSON.parse` near `~/.claude` |
| 16 | Companion lockfile lifecycle | M5 | Atomic write + PID-in-lockfile + staleness sweep on activate |
| 17 | Bundle size overrun | M0 onwards | CI check: dist/extension.cjs < 500 KB gates every PR |
| 18 | Stale presence on crash | M2 | Exit handlers (SIGINT/SIGTERM/exit) + activation-time clearActivity |

---

## Additions NOT Already in PRD §14 Risks

The PRD's §14 risk table is strong but stops at the strategic / competitive level. The pitfalls it does not explicitly enumerate (that this document adds) are:

1. **Shell integration async-activation race** (Pitfall 1) — the most chronic single-user-perceived bug.
2. **`fs.watch` platform-specific failure modes** (Pitfall 10) — inotify limits + macOS coalescing + Windows buffer overflow.
3. **Session map race conditions under rapid-fire events** (Pitfall 11) — keyed-by-object-identity trap.
4. **Regex detection gaps beyond basic invocation** (Pitfall 12) — env prefixes, tmux nesting.
5. **`@xhayper/discord-rpc` reconnect state reuse bug** (Pitfall 13) — library internals.
6. **Disabled built-in Git extension** (Pitfall 14) — standard VS Code API trap.
7. **Companion lockfile staleness from crashed Claude Code** (Pitfall 16) — PID liveness check missing.
8. **Bundle size tree-shaking blown by `undici`/`@discordjs/rest`** (Pitfall 17) — PRD mentions pinning but not measuring-in-CI.
9. **Crash-path ghost presence** (Pitfall 18) — exit handlers beyond `deactivate()`.
10. **OpenVSX namespace claim being multi-day async** (Pitfall 9 subtext) — not on any critical-path in §12; should be M0.

Recommended PRD updates (feedback to requirements agent):
- §14 add row: "Shell integration async activation misses first command" / Likelihood High / Impact Medium / Mitigation `onDidChangeTerminalShellIntegration`.
- §12 M0: add "`[HUMAN]` Claim OpenVSX namespace" bullet — unblocks M7 critical path.
- §18 add: "Always register SIGINT/SIGTERM/exit handlers that call `clearActivity(pid)`."
- §18 add: "Never parse JSONL. CI grep check enforces this."
- §12 CI: add "bundle size < 500 KB" as a repo-level check, not just an M0 check.

---

## Sources

- **PRD:** `discord-agent-presence-prd.md` §14 Risks, §18 Guardrails, §FR-1, §FR-4, §FR-7, §19 Appendix (Cursor forum threads, vscord history).
- **`@xhayper/discord-rpc`:** upstream https://github.com/Khaomi/discord-rpc — reconnect edge cases tracked in issue history.
- **vscord:** https://github.com/LeonardSSH/vscord — reference for throttle (2000ms), `setActivity(null)` → `clearActivity` switch, `pid` scoping; issue #26 (SSH idling), #151 (settings count complaint).
- **RikoAppDev/ai-agent-activity:** uses `(vscode as any).chat` + edit heuristic — the anti-pattern we avoid.
- **tsanva/cc-discord-presence:** lockfile + fs-watch detection pattern (what the companion plugin tier replicates).
- **Codex-Discord-Rich-Presence:** `src/discord.rs:35-36, 276-282` — the reconnect cooldown-guard reference implementation cited in PRD §FR-4.2.
- **VS Code Shell Integration API:** `vscode.d.ts` L7711-8142, release notes for v1.93.
- **Cursor Windows shell-integration threads:** https://forum.cursor.com/t/terminal-commands-fail-due-to-shell-integration-error-on-windows-11-cursor-0-46-8/59440, https://forum.cursor.com/t/agent-terminal-no-longer-uses-interactive-shell-or-respects-vs-code-terminal-settings/134852
- **Flatpak Discord IPC:** Discord community forum + `discord-flatpak-rpc-bridge` project.
- **Node.js `fs.watch` platform behavior:** Node.js docs "Availability" section; well-known across Electron and Node-watcher libraries (chokidar, sane, nsfw).
- **Azure DevOps PAT scopes for `vsce`:** `@vscode/vsce` README + Marketplace publisher docs.
- **OpenVSX namespace claim flow:** https://open-vsx.org/namespace/ + Eclipse Foundation account signup.

---

*Pitfalls research for: VS Code / Cursor extension + Discord Rich Presence + terminal agent detection (v0.1)*
*Researched: 2026-04-12*
