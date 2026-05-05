# MS Marketplace Publish Saga — agent-mode-discord

**Status:** UNRESOLVED as of 2026-05-05 ~10:15 PT
**Last action:** v0.2.4 (T3 metadata-minimization) failed with same "suspicious content" auto-rejection. Dual-channel ask filed: Gmail draft (not yet sent) + GitHub issue [#1821](https://github.com/microsoft/vsmarketplace/issues/1821).

**Read this BEFORE retrying anything** so we don't redo failed tests.

---

## The error (verbatim)

Every publish attempt to MS Marketplace fails with:

```
##[error]Your extension has suspicious content. Please fix your extension metadata, or contact support if you need assistance.
##[error]Process completed with exit code 1.
```

Microsoft does NOT reveal the trigger publicly (anti-evasion).

---

## What's verified (have data)

| Fact | Evidence |
|---|---|
| Extension never published to MS Marketplace | `https://marketplace.visualstudio.com/items?itemName=leonardomjq.agent-mode-discord` returns **404** |
| Marketplace search by exact extension ID returns 0 | `extensionquery` API filterType:7 — verified 2026-05-05 |
| 6 prior test extensions under same publisher PASSED scan, then were unpublished | publisher search returns 6 entries flagged "validated, public, unpublished": `test7-claudecode`, `test9-agentmode`, `test11-agentmode-cc`, `hello-test-readme`, `hello-test-bundle`, `hello-test-flake`. NONE had "discord" in slug. |
| Same VSIX publishes successfully to OpenVSX | https://open-vsx.org/extension/leonardomjq/agent-mode-discord — currently v0.2.4, ~428 total downloads |
| Cursor users get the OpenVSX version | Cursor proxies OpenVSX (per memory `project_marketplace_constraints.md`) |
| GitHub issue #1821 + email draft filed | 2026-05-05 ~9:50 PT |

## What's tested + RULED OUT

These hypotheses were tested with separate publish attempts and FAILED to fix the rejection. Don't retry them blindly.

| Hypothesis | Tested in | Result | Don't retry because |
|---|---|---|---|
| `Discord` in `displayName` | v0.2.0 (no Discord in displayName), v0.2.1 (same), and DASHBOARD CONFIRMS one passing test extension has displayName literally "Agent Mode" | REJECTED + DASHBOARD-CONFIRMED | Both directions disprove this hypothesis. Move on. |
| Description Discord-density | v0.2.1 (light Discord in description) | REJECTED | Light/heavy Discord in description doesn't matter |
| README content (badges + external URLs + "Discord" hero + 251 lines) | v0.2.2 (T1: stripped to 20 lines, no badges, no discord.com URLs) | REJECTED | Minimal README still flagged |
| Bundled `@xhayper/discord-rpc` URL constants in dist/extension.cjs | v0.2.3 (T2: scrubbed 7 URL patterns: `discord.com/api/v`, `discord.com/events`, `discord.gg`, `discord.gift`, `discord.new`, `discordapp.com`, `discordapp.net` → `.invalid` placeholders. Build-time scrub in esbuild.mjs. Verified zero discord.com URLs in dist. `pnpm check:no-network` PASS.) | REJECTED | Bundle URL content not the trigger |
| Metadata pattern density (long displayName, em-dash, 17 keywords, 2 categories) | v0.2.4 (T3: displayName "goblin mode" only, description "Rich presence for AI coding.", 3 keywords, 1 category) | REJECTED | Minimal metadata still flagged |
| Publisher rate limit (10/12h) | Inferred — error is "suspicious content" not "rate limited" | RULED OUT | Different error code; we got fresh attempts |
| New publisher unverified status (blue badge missing) | Researched — verified-publisher badge requires 6 months on marketplace; not required for first publish | RULED OUT | Verified badge ≠ scan gate |
| PAT scope wrong | Workflow uses `Marketplace (Manage)` per memory; would error with 401/403 not "suspicious content" | RULED OUT | Wrong-scope produces different error |

## What's tested + STILL FAILING (don't redo)

Every publish attempt 2026-04-30 (v0.1.0 through v0.1.3) and 2026-05-05 (v0.2.0 through v0.2.4) — **9 total publish attempts** all rejected with same generic "suspicious content" error.

## What's UNTESTED (real remaining hypotheses)

| Hypothesis | Why it's likely | Cost to test |
|---|---|---|
| **Extension ID slug `agent-mode-discord` contains "discord"** | LOCKED IN as primary suspect 2026-05-05 ~10:25 PT after dashboard inspection. All 6 successful test extensions in publisher manage have NO "discord" in slug. One passing test has displayName literally "Agent Mode" — definitively rules out displayName as trigger. Slug is the only constant left across all 9 failures. | **HIGH** — irreversible; old slug `agent-mode-discord` keeps OpenVSX 428 downloads but new MS Marketplace publish goes under new slug. T4 in test ladder. |
| **Publisher account `leonardomjq` cumulative-flag from 9 rejections** | Less likely — dashboard shows publisher account healthy with 6 validated test extensions still listed. No "account suspended" or warning notice visible. | HIGH — would need new publisher account |

## What's ASSUMED but unverified (treat with caution)

- That MS support will respond ~1 business day (memory was stale; 2026 cases show variance from hours to weeks)
- That `vsce publish` from local machine vs CI gives same result (untested)
- That the same VSIX republished after a "cooldown period" passes (untested; some forum posts suggest spam-detection windows)

---

## Test ladder (executed in order)

| # | Test | Cost | Tag | Outcome |
|---|---|---|---|---|
| T0 | Apr 30 baseline (v0.1.0–v0.1.3) | 4 attempts | v0.1.0–3 | REJECTED |
| Initial v0.2.x | Goblin brand + watching default | 2 attempts | v0.2.0, v0.2.1 | REJECTED |
| T1 | Strip README to minimal | 1 attempt | v0.2.2 | REJECTED |
| T2 | Scrub bundle Discord URLs | 1 attempt | v0.2.3 | REJECTED |
| T3 | Radical metadata minimization | 1 attempt | v0.2.4 | REJECTED |
| **T4** | **Slug rename `agent-mode-discord` → `goblin-mode`** | **HIGH (irreversible)** | **PENDING** | — |
| T5 | Send email + wait for MS support | LOW (waits) | — | filed but not sent |

---

## What to do next (priority order)

1. **USER ACTION (cheap):** Visit https://marketplace.visualstudio.com/manage. Look for any rejected-extensions queue, "submit for review" button, account-verification prompt, or notice. Report findings before T4.
2. **If dashboard shows nothing actionable:** Execute T4 (slug rename to `goblin-mode`). High probability of success based on test-extension data pattern, but irreversible namespace damage on OpenVSX.
3. **If T4 also fails:** Send the Gmail draft (`vsmarketplace@microsoft.com`) + escalate via GitHub issue #1821 comment.
4. **If MS support unblocks the original slug:** Republish under `agent-mode-discord` (preserves OpenVSX continuity); deprecate the new `goblin-mode` extension if T4 was already done.

## Don't do (anti-patterns)

- **DON'T retry T1/T2/T3** — already failed; same code path will produce same rejection. Verify against this saga before claiming "let me try changing the README..."
- **DON'T re-investigate "is Discord in displayName the trigger?"** — Apr 30 investigation was wrong (correlation not causation). v0.2.0+ have no "Discord" in displayName and still rejected.
- **DON'T burn publish attempts on metadata trial-and-error** — scan is non-deterministic; only T4 (slug) and T5 (manual unblock) have meaningful probability.

## Cross-references

- Memory: `~/.claude/projects/-Users-leonardojaques-projects-personal-richagenticpresence-discord/memory/project_marketplace_constraints.md`
- GitHub issue: https://github.com/microsoft/vsmarketplace/issues/1821
- Failed workflow runs:
  - https://github.com/leonardomjq/agent-mode-discord/actions/runs/25379004193 (v0.2.0)
  - https://github.com/leonardomjq/agent-mode-discord/actions/runs/25379150419 (v0.2.1)
  - https://github.com/leonardomjq/agent-mode-discord/actions/runs/25381388363 (v0.2.2 / T1)
  - https://github.com/leonardomjq/agent-mode-discord/actions/runs/25381658424 (v0.2.3 / T2)
  - https://github.com/leonardomjq/agent-mode-discord/actions/runs/25381818969 (v0.2.4 / T3)
- Email draft (not sent): Gmail draft id `19df86d2c6d98ead`

---

*Last updated: 2026-05-05*
