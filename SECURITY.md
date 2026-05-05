# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

**Preferred method:** Use GitHub's private vulnerability reporting on this repository.
Navigate to the repository's **Security** tab → **Report a vulnerability**, or visit
[Settings → Security → Private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability).

**Alternative:** Email the repository owner. For non-sensitive issues that do not
involve disclosure of an exploit, you may also open a regular GitHub issue.

**Response time:** Best effort — this is a solo passion project, not a commercial
product. Critical issues will be triaged as quickly as possible, but no SLA is
offered or implied.

**What to include in your report:**

- VS Code or Cursor version
- Operating system and version
- Extension version (`goblin-mode` from the marketplace, or commit SHA if from source)
- Steps to reproduce the issue
- Impact assessment — what an attacker could do with this vulnerability
- Optional: a proposed fix or mitigation

## Scope

This policy covers:

- The VS Code extension code in `src/`
- The companion Claude Code plugin in `companion/claude-code-plugin/`

Out of scope:

- Third-party dependencies — these are tracked via Dependabot. Report dependency
  vulnerabilities to the upstream maintainer first.
- Discord client behavior — report to Discord via their HackerOne program.
- VS Code or Cursor host bugs — report to the respective vendor.

## Threat Model Notes

Activity data flows through three distinct stages. Each has a different trust boundary, and conflating them creates a misleading picture of what this extension does and does not do.

**Stage 1 — Extension code.** The extension makes **zero outbound HTTP requests**. There is no telemetry SDK, no analytics endpoint, no remote code execution path. This is verified in CI by `scripts/check-no-network.mjs`, which greps the built bundle for `http.request`, `https.request`, `fetch`, `undici`, `node-fetch`, and `XMLHttpRequest` references. A PR that introduces any of these patterns fails CI before merge.

**Stage 2 — Extension to local Discord client (IPC).** All extension-to-Discord communication uses Discord's local IPC — a Unix domain socket on macOS/Linux (`/tmp/discord-ipc-N`), a named pipe on Windows (`\\?\pipe\discord-ipc-N`). The socket / pipe is local to the user account; it does not traverse a network interface. The activity payload (workspace name, filename, branch, status copy, computed per the user's `agentMode.privacy.*` and `agentMode.ignore.*` settings) is the only thing the extension writes to the IPC channel.

**Stage 3 — Local Discord client to Discord's servers.** Once the local Discord client receives the activity payload, it forwards it to Discord's servers as part of normal Rich Presence operation — that's how your friends see your status. This stage is controlled entirely by the Discord desktop client, not by this extension, and is governed by [Discord's privacy policy](https://discord.com/privacy). If you do not want any activity payload reaching Discord's servers, the only options are (a) configure `agentMode.ignore.workspaces` to silence the extension entirely for sensitive workspaces, (b) close Discord, or (c) uninstall this extension.

Lockfiles observed by the companion detector live in `~/.claude/` and are
treated as signals only — the detector reads modification time via
`fs.watchFile` and never opens or parses the file contents. A stale-mtime
threshold (default 5 minutes) guards against orphaned lockfiles from crashed
Claude Code sessions.
