import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLoadLifecycle } from "@/components/marco/tradingViewLifecycle";

const TIMEOUT = 20_000;

describe("TradingView load lifecycle — settles exactly once", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = () => {
    const onSettle = vi.fn();
    const lc = createLoadLifecycle({ timeoutMs: TIMEOUT, onSettle });
    return { lc, onSettle };
  };

  it("iframe load → READY once, and stays READY well past the 20 s timeout", () => {
    const { lc, onSettle } = make();
    vi.advanceTimersByTime(1_500);
    lc.ready();
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenLastCalledWith("ready");
    expect(lc.pending).toBe(false); // the timeout was cleared on load
    vi.advanceTimersByTime(TIMEOUT * 3); // 60 s
    expect(onSettle).toHaveBeenCalledTimes(1); // the old timeout never fires
    expect(vi.getTimerCount()).toBe(0);
  });

  it("no iframe → ERROR exactly at the timeout, once", () => {
    const { lc, onSettle } = make();
    vi.advanceTimersByTime(TIMEOUT - 1);
    expect(onSettle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenLastCalledWith("error");
    vi.advanceTimersByTime(TIMEOUT);
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(lc.pending).toBe(false);
  });

  it("script error before iframe load → ERROR once; timeout cleared", () => {
    const { lc, onSettle } = make();
    lc.fail();
    expect(onSettle).toHaveBeenCalledWith("error");
    expect(lc.pending).toBe(false);
    vi.advanceTimersByTime(TIMEOUT * 2);
    expect(onSettle).toHaveBeenCalledTimes(1);
  });

  it("iframe error → ERROR once, even if reported twice", () => {
    const { lc, onSettle } = make();
    lc.fail();
    lc.fail();
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenLastCalledWith("error");
  });

  it("successful load cannot later be overwritten by the timeout or an error", () => {
    const { lc, onSettle } = make();
    lc.ready();
    vi.advanceTimersByTime(TIMEOUT + 1);
    lc.fail();
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenLastCalledWith("ready");
  });

  it("late iframe load after failure cannot overwrite ERROR", () => {
    const { lc, onSettle } = make();
    vi.advanceTimersByTime(TIMEOUT); // timed out
    lc.ready(); // the iframe finally loads
    expect(onSettle).toHaveBeenCalledTimes(1);
    expect(onSettle).toHaveBeenLastCalledWith("error");
  });

  it("unmount (dispose) clears the pending timeout; nothing settles afterwards", () => {
    const { lc, onSettle } = make();
    expect(vi.getTimerCount()).toBe(1);
    lc.dispose();
    expect(lc.pending).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(TIMEOUT * 2);
    lc.ready();
    lc.fail();
    expect(onSettle).not.toHaveBeenCalled();
  });

  it("symbol switch: each remount starts clean — no previous timer survives", () => {
    const settled: string[] = [];
    // BTC mounts, loads, then is replaced by ETH before 20 s; ETH loads; then SOL, BNB, BTC.
    let current = createLoadLifecycle({
      timeoutMs: TIMEOUT,
      onSettle: (o) => settled.push(`BTC:${o}`),
    });
    vi.advanceTimersByTime(800);
    current.ready();
    for (const sym of ["ETH", "SOL", "BNB", "BTC"]) {
      vi.advanceTimersByTime(5_000);
      current.dispose(); // cleanup of the previous chart
      current = createLoadLifecycle({
        timeoutMs: TIMEOUT,
        onSettle: (o) => settled.push(`${sym}:${o}`),
      });
      expect(vi.getTimerCount()).toBe(1); // exactly one timer: the new chart's
      vi.advanceTimersByTime(700);
      current.ready();
      expect(vi.getTimerCount()).toBe(0);
    }
    vi.advanceTimersByTime(TIMEOUT * 3);
    expect(settled).toEqual(["BTC:ready", "ETH:ready", "SOL:ready", "BNB:ready", "BTC:ready"]);
  });

  it("a chart disposed while still loading never reports its timeout", () => {
    const settled: string[] = [];
    const btc = createLoadLifecycle({
      timeoutMs: TIMEOUT,
      onSettle: (o) => settled.push(`BTC:${o}`),
    });
    vi.advanceTimersByTime(10_000); // BTC never loaded
    btc.dispose(); // user switched to ETH
    const eth = createLoadLifecycle({
      timeoutMs: TIMEOUT,
      onSettle: (o) => settled.push(`ETH:${o}`),
    });
    eth.ready();
    vi.advanceTimersByTime(TIMEOUT * 2); // BTC's original deadline passes
    expect(settled).toEqual(["ETH:ready"]);
  });
});
