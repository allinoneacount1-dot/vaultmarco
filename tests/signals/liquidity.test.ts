import { describe, expect, it } from "vitest";
import { liquidityChange, liquidityEvent } from "@/lib/signals/liquidity";
import {
  LIQUIDITY_EVENT_LOOKBACK_MINUTES,
  LIQUIDITY_EVENT_MIN_ABS_USD,
  LIQUIDITY_EVENT_MIN_PREVIOUS_USD,
} from "@/lib/signals/thresholds";
import { T0, snapshot } from "./fixtures";

const MIN = 60_000;
const at = (minutesAgo: number, liquidityUsd: number | null, over = {}) =>
  snapshot({ observedAt: T0 - minutesAgo * MIN, liquidityUsd, ...over });

describe("liquidity change (LV)", () => {
  it("compares the latest snapshot with the newest one at least the lookback old", () => {
    const history = [at(12, 500_000), at(6, 480_000), at(3, 470_000), at(0, 300_000)];
    const c = liquidityChange(history, 5);
    expect(c).toMatchObject({ previousUsd: 480_000, currentUsd: 300_000, deltaUsd: -180_000 });
    expect(c?.deltaRel).toBeCloseTo(-0.375, 6);
    expect(c?.spanMinutes).toBe(6);
  });

  it("returns null until history reaches back far enough", () => {
    expect(liquidityChange([at(0, 100_000)], 5)).toBeNull();
    expect(liquidityChange([at(2, 100_000), at(0, 50_000)], 5)).toBeNull();
  });

  it("returns null when either side has no liquidity figure", () => {
    expect(liquidityChange([at(10, null), at(0, 50_000)], 5)).toBeNull();
    expect(liquidityChange([at(10, 50_000), at(0, null)], 5)).toBeNull();
  });
});

describe("LIQUIDITY EVENT rule", () => {
  const L = LIQUIDITY_EVENT_LOOKBACK_MINUTES + 1;

  it("flags a large removal as HIGH with both relative and absolute deltas", () => {
    const e = liquidityEvent([at(L, 500_000), at(0, 150_000)]);
    expect(e).toMatchObject({ direction: "REMOVED", severity: "HIGH" });
    expect(e?.change.deltaRel).toBeCloseTo(-0.7, 6);
    expect(e?.change.deltaUsd).toBe(-350_000);
  });

  it("flags a large add as ADDED", () => {
    expect(liquidityEvent([at(L, 100_000), at(0, 140_000)])).toMatchObject({
      direction: "ADDED",
      severity: "MEDIUM",
    });
  });

  it("ignores the same percentage move on a tiny pool", () => {
    // −30% on $500 is $150: below the absolute floor and the previous-size floor.
    expect(liquidityEvent([at(L, 500), at(0, 350)])).toBeNull();
    // −30% on $20K is $6K: above the previous-size floor? no — $20K < $25K.
    expect(liquidityEvent([at(L, LIQUIDITY_EVENT_MIN_PREVIOUS_USD - 1), at(0, 10_000)])).toBeNull();
  });

  it("needs the absolute move as well as the relative one", () => {
    // −26% on $30K is $7.8K: relative passes, absolute does not.
    expect(liquidityEvent([at(L, 30_000), at(0, 22_200)])).toBeNull();
    // −26% on $50K is $13K: both pass → MEDIUM.
    expect(liquidityEvent([at(L, 50_000), at(0, 37_000)])).toMatchObject({ severity: "MEDIUM" });
    expect(LIQUIDITY_EVENT_MIN_ABS_USD).toBe(10_000);
  });

  it("ignores small drift on a large pool", () => {
    expect(liquidityEvent([at(L, 1_000_000), at(0, 900_000)])).toBeNull(); // −10%
  });
});
