---
phase: "02"
plan: "05"
subsystem: "privacy"
tags: [privacy, pure-core, redaction-stub, phase-4-contract]
dependency_graph:
  requires:
    - "02-00: test/privacy.test.ts Wave-0 stubs + PURE_CORE_PATHS guard in check-api-surface.mjs"
  provides:
    - "src/privacy.ts — redact(field, value, mode): string with D-15-locked signature"
    - "test/privacy.test.ts — 4 passing assertions (show/hide/hash/unknown-mode)"
  affects:
    - "02-07 driver — calls redact(field, value, 'show') on workspace/filename/branch before activity builder"
    - "Phase 4 — replaces hash branch with SHA-1 6-char prefix + ignore-list wiring; callsite unchanged"
tech_stack:
  added: []
  patterns:
    - "Pure switch-case redaction stub — hash throws, unknown falls through to show (default-safe)"
    - "TDD: Wave-0 stubs existed; Task 1 wrote impl (GREEN); Task 2 flipped it.todo to passing it()"
key_files:
  created:
    - src/privacy.ts
  modified:
    - test/privacy.test.ts
decisions:
  - "hash mode throws Error('not implemented until Phase 4') — T-PRIV-01: impossible to silently leak un-hashed value"
  - "default case returns value unchanged — T-PRIV-02: default-safe pass-through for stale config casts"
  - "Signature locked per D-15: redact(field: RedactField, value: string, mode: RedactMode): string — Phase 4 changes hash branch only"
metrics:
  duration_minutes: 3
  completed_date: "2026-04-13"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 02 Plan 05: Privacy Redaction Stub Summary

**One-liner:** Phase 2 privacy stub shipping `redact(field, value, mode)` with D-15-locked signature — show pass-through, hide returns empty string, hash throws, unknown mode default-safe — FR-6 surface locked for Phase 4's SHA-1 implementation with zero callsite drift.

---

## What Was Built

### Task 1 — `src/privacy.ts` (commit `586f0d7`)

Created `src/privacy.ts` verbatim from the D-15 interface spec in `02-CONTEXT.md`. The file:

- Exports `RedactField = "workspace" | "filename" | "branch"`
- Exports `RedactMode = "show" | "hide" | "hash"`
- Exports `redact(field: RedactField, value: string, mode: RedactMode): string`

Switch-case semantics:
| Mode | Behavior | Rationale |
|------|----------|-----------|
| `show` | Returns `value` unchanged | Default pass-through for Phase 2 callers |
| `hide` | Returns `""` | Canonical "no content" marker; Phase 4 activity builder drops empty-string fields |
| `hash` | Throws `Error("not implemented until Phase 4")` | T-PRIV-01: fails loudly; cannot silently leak un-hashed string as "hashed" |
| `default` | Returns `value` unchanged | T-PRIV-02: default-safe for runtime casts of stale/invalid config values |

File is 31 lines (≤40 per D-17). Zero vscode imports. `pnpm check:api-surface` reports 1 pure-core file scanned, 0 violations.

### Task 2 — `test/privacy.test.ts` (commit `e0c421b`)

Flipped all 4 `it.todo` stubs to passing `it()` blocks:

| Test | Assertions | Covers |
|------|-----------|--------|
| `mode=show returns input unchanged for workspace / filename / branch fields` | 4 (three fields + empty string) | T-PRIV-03 negative, D-15 show branch |
| `mode=hide returns empty string regardless of field` | 4 (three fields + empty input) | T-PRIV-03 positive, hide branch |
| `mode=hash throws Error with message "not implemented until Phase 4"` | 3 (exact message, Error instance, regex) | T-PRIV-01 mitigation proof |
| `unknown mode treated as show (default-safe)` | 1 (cast to simulate stale config) | T-PRIV-02 mitigation proof |

---

## Full Guardrail Suite Result

All six commands exit 0 after both task commits:

```
pnpm vitest run test/privacy.test.ts — 4 passed, 0 todo
pnpm test                            — 9 passed, 33 todo (exit 0)
pnpm typecheck                       — exit 0
pnpm check:api-surface               — PASS (3 .ts files, 1 pure-core, 0 violations)
pnpm build                           — exit 0 (dist/extension.cjs: 196.5 KB, 39.3% of threshold)
pnpm check:bundle-size               — PASS (201255 bytes, 39.3% of 500 KB)
```

Bundle-size delta near-zero (stub + type exports only).

---

## Phase 4 Refactor Surface

Phase 4 changes exactly two things in `src/privacy.ts`:

1. Replace `case "hash": throw new Error("not implemented until Phase 4");` with SHA-1 6-char prefix implementation
2. Accept an optional `ignore: Set<string>` parameter for workspace/repo ignore lists

The callsite in the 02-07 driver (`redact(field, value, "show")`) stays identical. No test rewrites needed — Test 3 will pass once Phase 4 replaces the throw with a real hash.

---

## Deviations from Plan

None — plan executed exactly as written. `src/privacy.ts` matches the D-15 interface spec verbatim.

---

## Known Stubs

- `case "hash"` throws intentionally — this IS the Phase 2 contract, not a stub to resolve before shipping Phase 2. Phase 4 owns the implementation.
- All Phase 2 callers (02-07 driver) pass `mode: "show"` — hash branch is unreachable at runtime in Phase 2.

---

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes. `src/privacy.ts` is a pure-core module with zero external dependencies.

---

## Self-Check

### Created files exist:
- `test -f src/privacy.ts` — FOUND
- `test -f test/privacy.test.ts` (modified) — FOUND

### Commits exist:
- `586f0d7` — feat(02-05): implement src/privacy.ts redact stub with D-15-locked signature
- `e0c421b` — feat(02-05): fill test/privacy.test.ts — 4 passing assertions for show/hide/hash/unknown

## Self-Check: PASSED
