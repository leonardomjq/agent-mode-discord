---
phase: "02"
plan: "06"
subsystem: "detectors"
tags: [detector, editor, vscode-api, vi-mock, dispatch, STATE-01, STATE-02]
dependency_graph:
  requires:
    - "02-00 — test/detectors.editor.test.ts stub + vi.mock skeleton"
    - "02-01 — src/state/types.ts Event union (editor-changed, editor-closed)"
  provides:
    - "src/detectors/editor.ts — createEditorDetector(dispatch): vscode.Disposable"
    - "test/detectors.editor.test.ts — 5 passing vi.mock(vscode) assertions (STATE-01 / STATE-02 entry points)"
  affects:
    - "02-07 — driver calls createEditorDetector(driver.dispatch) at activation time"
tech_stack:
  added: []
  patterns:
    - "vi.mock('vscode') with activeTextEditor getter (module-level mutable variable) for construction-seed test"
    - "Captured onDidChangeActiveTextEditor callback pattern for programmatic test invocation"
    - "vscode.Disposable.from(...disposables[]) pattern for subscription cleanup"
    - "D-18 silent try/catch in vscode event callback"
key_files:
  created:
    - src/detectors/editor.ts
  modified:
    - test/detectors.editor.test.ts
decisions:
  - "Used factory function createEditorDetector(dispatch) per D-07 — no class, inject dispatch at construction"
  - "Construction-time seed reads vscode.window.activeTextEditor once — event does not re-fire initial state on startup"
  - "vi.mock factory uses JS getter for activeTextEditor so module-level mockActiveTextEditor variable is read lazily per test"
  - "D-18 try/catch wraps entire pushFromEditor — silent swallow, no console.debug even (callback fires hundreds/session)"
metrics:
  duration_minutes: 10
  completed_date: "2026-04-13"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 02 Plan 06: Editor Detector Summary

**One-liner:** createEditorDetector(dispatch) adapter that seeds from activeTextEditor on construction then subscribes to onDidChangeActiveTextEditor, dispatching editor-changed/editor-closed Events into the reducer pipeline, proven by 5 vi.mock(vscode) vitest assertions.

---

## What Was Built

### Task 1 — src/detectors/editor.ts (commit `0744d86`)

Editor detector factory function (~50 lines) connecting VS Code's `window.onDidChangeActiveTextEditor` to the pure reducer's `Event` union.

**Detector contract:**

- `createEditorDetector(dispatch: (event: Event) => void): vscode.Disposable`
- On construction: reads `vscode.window.activeTextEditor` once (construction-time seed — the event does NOT re-fire initial state per VS Code API design)
- On event with TextEditor: dispatches `{ type: "editor-changed", filename: basename(fsPath), language: document.languageId }`
- On event with undefined: dispatches `{ type: "editor-closed" }` (focus left text surface — terminal, search, Output panel)
- Returns `vscode.Disposable.from(...disposables)` to clean up subscription on driver shutdown

**Key implementation details:**

| Aspect | Implementation |
|--------|---------------|
| Basename extraction | `document.uri.fsPath.split(/[\\/]/).pop() ?? ""` — handles POSIX (`/`) and Windows (`\`) separators |
| Pitfall 1 (undefined) | `if (!editor)` → dispatches `editor-closed`; reducer treats as no-op; driver's idle timer (02-07) owns CODING→IDLE |
| D-18 error handling | `try/catch` wraps entire `pushFromEditor` body; catch is silent (no console.debug) |
| File size | 50 lines (under 60-line target) |
| Module boundary | `src/detectors/` is NOT in `PURE_CORE_PATHS` — `import * as vscode from "vscode"` allowed; `check:api-surface` exits 0 |

### Task 2 — test/detectors.editor.test.ts (commit `f54abb8`)

All 5 `it.todo` stubs from Wave 0 (02-00) flipped to passing assertions. The Wave 0 `vi.mock("vscode", ...)` skeleton was replaced with a richer factory that:

- Exposes `activeTextEditor` as a JS getter reading `mockActiveTextEditor` variable (so `beforeEach` mutations take effect)
- Captures the `onDidChangeActiveTextEditor` callback in `mockOnDidChangeCallback` for programmatic test invocation
- Uses `mockOnDidChangeDisposable = { dispose: vi.fn() }` to assert subscription teardown

**Test results:**

| Test | Description | Result |
|------|-------------|--------|
| 1 | dispatches editor-changed on construction when activeTextEditor is set | PASS |
| 2 | dispatches editor-closed on construction when activeTextEditor is undefined | PASS |
| 3 | dispatches editor-changed with filename + languageId when onDidChangeActiveTextEditor fires | PASS |
| 4 | dispatches editor-closed when onDidChangeActiveTextEditor fires with undefined | PASS |
| 5 | returned Disposable removes all subscriptions when dispose() is called | PASS |

Test 3 specifically uses a Windows path (`C:\\Users\\leo\\proj\\index.js`) to prove both path separator variants reduce to basename `index.js`.

---

## Full Guardrail Suite Result

All six commands exit 0 after both task commits:

```
pnpm vitest run test/detectors.editor.test.ts  — 5 passed, 0 todo (exit 0)
pnpm test                                       — 37 passed, 5 todo, 0 failed (exit 0)
pnpm typecheck                                  — exit 0
pnpm build                                      — exit 0 (dist/extension.cjs: 196.6 KB)
pnpm check:bundle-size                          — PASS (201350 bytes, 39.3% of 500 KB threshold)
pnpm check:api-surface                          — PASS (8 .ts files, 5 pure-core, 0 violations)
```

Bundle-size delta from adding editor detector: +95 bytes (196.5 KB → 196.6 KB).

---

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| STATE-01: focus text doc → CODING with file context | Entry point proved | Test 1+3: editor-changed dispatched with filename + language; driver (02-07) feeds into reducer |
| STATE-02: no editor + idle timeout → IDLE | Entry point proved | Test 2+4: editor-closed dispatched on undefined; driver's idle timer (02-07) owns transition |

Full STATE-01 / STATE-02 integration (including reducer + driver + idle timer) is proven in 02-07.

---

## Deviations from Plan

None — plan executed exactly as written. The `<interfaces>` shape in the plan was implemented verbatim.

---

## Known Stubs

None — `createEditorDetector` is fully implemented. The detector is a thin adapter; no data is stubbed or hardcoded.

---

## Threat Flags

No new network endpoints, auth paths, or schema changes. The T-DET-ED-01 mitigation (basename-only extraction) is implemented and proved by Test 3 (Windows path reduces to `index.js`). T-DET-ED-02 mitigation (Disposable teardown) proved by Test 5.

---

## Self-Check

### Created files exist:
- `test -f src/detectors/editor.ts` — FOUND
- `test -f test/detectors.editor.test.ts` — FOUND (modified)

### Commits exist:
- `0744d86` — feat(02-06): create src/detectors/editor.ts — onDidChangeActiveTextEditor adapter
- `f54abb8` — feat(02-06): fill test/detectors.editor.test.ts — 5 passing vi.mock(vscode) assertions

## Self-Check: PASSED
