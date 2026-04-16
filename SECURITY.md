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
- Extension version (`agent-mode-discord` from the marketplace, or commit SHA if from source)
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

The extension makes **zero outbound HTTP requests**. All Discord communication
uses local IPC (Unix socket on macOS/Linux, named pipe on Windows). There is no
telemetry, no analytics, and no remote code execution path.

Lockfiles observed by the companion detector live in `~/.claude/` and are
treated as signals only — the detector reads modification time via
`fs.watchFile` and never opens or parses the file contents. A stale-mtime
threshold (default 5 minutes) guards against orphaned lockfiles from crashed
Claude Code sessions.
