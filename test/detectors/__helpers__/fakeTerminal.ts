/**
 * Fake `vscode.Terminal` + `TerminalShellIntegration` factory for Phase 3 detector tests.
 *
 * This is a pure TS factory consumed BY tests — it contains no vitest mocks itself.
 * The returned `terminal` is typed `as unknown as vscode.Terminal` because the real
 * type has dozens of fields we don't need to stub; tests access only the properties
 * the detector under test touches (name, shellIntegration).
 *
 * Event emission is simulated via `emit(event, payload)`. Listeners are registered
 * via the `on(event, listener)` helper mounted on the returned `terminal` under a
 * private symbol-free name `__on` so detector code that wires through
 * `vscode.window.onDidChange...` global subscriptions can still observe per-terminal
 * dispatches in unit tests.
 */
import type * as vscode from "vscode";

type FakeEvent =
  | "shellIntegrationActivated"
  | "executionStart"
  | "executionEnd"
  | "close";

export interface FakeTerminalHandle {
  terminal: vscode.Terminal;
  /** Fire a simulated event into observers registered on this fake terminal. */
  emit(event: FakeEvent, payload?: unknown): void;
  /** Register a listener for a simulated event (used by tests to mount observers). */
  on(event: FakeEvent, listener: (payload?: unknown) => void): () => void;
}

export interface MakeFakeTerminalOpts {
  name?: string;
  hasShellIntegration?: boolean;
  /**
   * If > 0, schedule a setTimeout that flips `terminal.shellIntegration` to the
   * stub object and emits `"shellIntegrationActivated"` after the delay.
   * Note: tests using this MUST use vi.useFakeTimers() and vi.advanceTimersByTime().
   */
  activateShellIntegrationAfterMs?: number;
}

/**
 * Build a minimal stub of `vscode.TerminalShellIntegration`. Real type has an
 * `executeCommand` method, `cwd` prop, etc. — tests only need to observe that
 * the object is defined, so we return a structurally empty placeholder.
 */
function makeShellIntegrationStub(): vscode.TerminalShellIntegration {
  return {} as unknown as vscode.TerminalShellIntegration;
}

export function makeFakeTerminal(
  opts: MakeFakeTerminalOpts = {},
): FakeTerminalHandle {
  const {
    name = "fake-terminal",
    hasShellIntegration = false,
    activateShellIntegrationAfterMs = 0,
  } = opts;

  const listeners = new Map<FakeEvent, Set<(payload?: unknown) => void>>();

  const on: FakeTerminalHandle["on"] = (event, listener) => {
    let bucket = listeners.get(event);
    if (!bucket) {
      bucket = new Set();
      listeners.set(event, bucket);
    }
    bucket.add(listener);
    return () => {
      bucket?.delete(listener);
    };
  };

  const emit: FakeTerminalHandle["emit"] = (event, payload) => {
    const bucket = listeners.get(event);
    if (!bucket) return;
    for (const listener of bucket) {
      try {
        listener(payload);
      } catch {
        /* test-only swallow — real detectors wrap in D-18 try/catch */
      }
    }
  };

  // Terminal stub — cast through unknown because the full vscode.Terminal shape
  // is intentionally not stubbed. Tests only read `.name` and `.shellIntegration`.
  const terminal = {
    name,
    shellIntegration: hasShellIntegration
      ? makeShellIntegrationStub()
      : undefined,
  } as unknown as vscode.Terminal;

  if (activateShellIntegrationAfterMs > 0 && !hasShellIntegration) {
    setTimeout(() => {
      // Mutate the stub to simulate async activation. Cast through unknown so
      // we can write to the otherwise-readonly `shellIntegration` field.
      (terminal as unknown as { shellIntegration: vscode.TerminalShellIntegration }).shellIntegration =
        makeShellIntegrationStub();
      emit("shellIntegrationActivated");
    }, activateShellIntegrationAfterMs);
  }

  return { terminal, emit, on };
}
