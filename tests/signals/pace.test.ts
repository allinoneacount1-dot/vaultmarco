import { describe, expect, it } from "vitest";
import {
  previousWindowMinutes,
  transactionAcceleration,
  volumeAcceleration,
} from "@/lib/signals/pace";
import {
  MIN_PREVIOUS_TXNS,
  MIN_PREVIOUS_VOLUME_USD,
  MIN_SAFE_PREVIOUS_MINUTES,
  PREVIOUS_WINDOW_MINUTES_MATURE,
} from "@/lib/signals/thresholds";
import { acceleratingPair, snapshot } from "./fixtures";

describe("previous window", () => {
  it("is 55 minutes for pairs at least an hour old", () => {
    expect(previousWindowMinutes(60)).toBe(PREVIOUS_WINDOW_MINUTES_MATURE);
    expect(previousWindowMinutes(600)).toBe(PREVIOUS_WINDOW_MINUTES_MATURE);
  });

  it("is age − 5 for young pairs, floored at the safe minimum", () => {
    expect(previousWindowMinutes(47)).toBe(42);
    expect(previousWindowMinutes(20)).toBe(15);
    expect(previousWindowMinutes(12)).toBe(MIN_SAFE_PREVIOUS_MINUTES);
    expect(previousWindowMinutes(10)).toBe(MIN_SAFE_PREVIOUS_MINUTES);
  });
});

describe("volume acceleration (VA)", () => {
  it("compares the recent 5m pace against the pace of the rest of the hour, not h1/60", () => {
    const va = volumeAcceleration(acceleratingPair());
    expect(va.ok).toBe(true);
    if (!va.ok) return;
    expect(va.previous).toBe(23_600 - 6_800);
    expect(va.previousMinutes).toBe(42);
    expect(va.ratio).toBeCloseTo(3.4, 5);
  });

  it("is exactly 1 for flat activity on a mature pair", () => {
    const va = volumeAcceleration(snapshot());
    expect(va.ok && va.ratio).toBeCloseTo(1, 5);
  });

  it("does not manufacture acceleration for a 10-minute-old pair whose h1 is its whole life", () => {
    // 10 minutes old, $3,000 traded in total, $1,000 of it in the last 5 minutes.
    // h1/60 would give a baseline of $50/min and a fake 4× signal. The previous
    // window here is max(10 − 5, 10) = 10 minutes → $200/min → 1.0×.
    const s = snapshot({ ageMinutes: 10, volume: { m5: 1_000, h1: 3_000, h6: null, h24: null } });
    const va = volumeAcceleration(s);
    expect(va.ok && va.ratio).toBeCloseTo(1, 5);
  });

  it("returns INSUFFICIENT_HISTORY when the previous window carried too little volume", () => {
    const s = snapshot({
      volume: { m5: 5_000, h1: 5_000 + MIN_PREVIOUS_VOLUME_USD - 1, h6: null, h24: null },
    });
    expect(volumeAcceleration(s)).toEqual({ ok: false, reason: "INSUFFICIENT_HISTORY" });
  });

  it("reports missing inputs instead of guessing", () => {
    expect(volumeAcceleration(snapshot({ pairCreatedAt: null }))).toEqual({
      ok: false,
      reason: "NO_AGE",
    });
    expect(
      volumeAcceleration(snapshot({ volume: { m5: null, h1: 1, h6: null, h24: null } })),
    ).toEqual({
      ok: false,
      reason: "NO_RECENT_WINDOW",
    });
    expect(
      volumeAcceleration(snapshot({ volume: { m5: 1, h1: null, h6: null, h24: null } })),
    ).toEqual({
      ok: false,
      reason: "NO_PREVIOUS_WINDOW",
    });
  });
});

describe("transaction acceleration (TA)", () => {
  it("uses buys + sells of m5 against the rest of the hour", () => {
    const ta = transactionAcceleration(acceleratingPair());
    expect(ta.ok).toBe(true);
    if (!ta.ok) return;
    expect(ta.recent).toBe(52);
    expect(ta.previous).toBe(262 - 52);
    expect(ta.ratio).toBeCloseTo(52 / 5 / (210 / 42), 5);
  });

  it("returns INSUFFICIENT_HISTORY below the minimum previous transaction count", () => {
    const s = snapshot({
      txns: {
        m5: { buys: 10, sells: 10 },
        h1: { buys: 10 + MIN_PREVIOUS_TXNS - 1, sells: 10 },
        h6: null,
        h24: null,
      },
    });
    expect(transactionAcceleration(s)).toEqual({ ok: false, reason: "INSUFFICIENT_HISTORY" });
  });
});
