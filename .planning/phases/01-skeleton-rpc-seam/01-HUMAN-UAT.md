---
status: partial
phase: 01-skeleton-rpc-seam
source: [01-VERIFICATION.md]
started: 2026-04-12T23:30:39Z
updated: 2026-04-12T23:30:39Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Dev Host F5 shows 'Playing Agent Mode' with details 'hello world' in Discord friends sidebar within 2s
expected: Within 2s of pressing F5, Discord friends sidebar shows 'Playing Agent Mode' activity with the hardcoded 'hello world' details line
requirement: SKEL-06
result: [pending]

### 2. Dev Host activation completes in <50 ms
expected: VS Code 'Developer: Show Running Extensions' reports agent-mode-discord activation time < 50 ms
requirement: SKEL-03
result: [pending]

### 3. Kill Dev Host with SIGTERM leaves no ghost presence
expected: After kill -TERM <pid>, 'Playing Agent Mode' disappears from Discord within 5s — no ghost
requirement: SKEL-07
result: [pending]

### 4. Kill Dev Host with SIGINT leaves no ghost presence
expected: After kill -INT <pid> (or Ctrl+C), 'Playing Agent Mode' disappears from Discord within 5s — no ghost
requirement: SKEL-07
result: [pending]

### 5. Discord Developer Portal app created; DEFAULT_CLIENT_ID replaced with real Application ID
expected: grep 'REPLACE_ME_IN_PHASE_1_HANDOFF' src/ returns nothing; Discord app 'Agent Mode' exists with placeholder PNG assets
requirement: SKEL-06 (manual path) / PUB-01 (Phase 6 prerequisite)
result: [pending]

### 6. OpenVSX namespace claim submitted
expected: Eclipse Foundation account + ECA signed; namespace claim submitted at open-vsx.org; submission date recorded in HUMAN-HANDOFF.md
requirement: PUB-02 (Phase 6 prerequisite, started here per ROADMAP success criterion #5)
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
