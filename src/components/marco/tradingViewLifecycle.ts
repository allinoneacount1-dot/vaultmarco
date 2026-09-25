/**
 * Load lifecycle for one TradingView embed instance.
 *
 * Settles EXACTLY ONCE — to "ready" (iframe loaded) or "error" (script error,
 * iframe error, or timeout) — and owns the single load timeout:
 *
 *   ready / fail  → first call wins, clears the timeout; later calls are no-ops
 *   timeout       → same as fail, and can never fire after ready
 *   dispose       → clears the timeout; no settle is reported afterwards
 *
 * So a chart that loaded stays READY after the timeout would have elapsed, and
 * a late iframe load cannot turn an ERROR back into READY.
 */
export type LoadOutcome = "ready" | "error";

type Timers = {
  set: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clear: (id: ReturnType<typeof setTimeout>) => void;
};

const defaultTimers: Timers = {
  set: (fn, ms) => globalThis.setTimeout(fn, ms),
  clear: (id) => globalThis.clearTimeout(id),
};

export function createLoadLifecycle(opts: {
  timeoutMs: number;
  onSettle: (outcome: LoadOutcome) => void;
  timers?: Timers;
}) {
  const timers = opts.timers ?? defaultTimers;
  let settled = false;
  let disposed = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const clearLoadTimeout = () => {
    if (timeoutId !== undefined) {
      timers.clear(timeoutId);
      timeoutId = undefined;
    }
  };

  const settle = (outcome: LoadOutcome) => {
    if (disposed || settled) return;
    settled = true;
    clearLoadTimeout();
    opts.onSettle(outcome);
  };

  timeoutId = timers.set(() => settle("error"), opts.timeoutMs);

  return {
    ready: () => settle("ready"),
    fail: () => settle("error"),
    dispose: () => {
      disposed = true;
      clearLoadTimeout();
    },
    /** For tests/diagnostics: whether a timeout is still pending. */
    get pending() {
      return timeoutId !== undefined;
    },
  };
}
