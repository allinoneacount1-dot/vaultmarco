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

  it("is exactly age − 5 for young pairs — the span h1 − m5 actually covers", () => {
    expect(previousWindowMinutes(47)).toBe(42);
    expect(previousWindowMinutes(20)).toBe(15);
    expect(previousWindowMinutes(15)).toBe(MIN_SAFE_PREVIOUS_MINUTES);
  });

  it("is unavailable (null) below the minimum instead of stretching the denominator", () => {
    expect(previousWindowMinutes(14)).toBeNull();
    expect(previousWindowMinutes(12)).toBeNull();
    expect(previousWindowMinutes(10)).toBeNull();
  });
});

describe("young-pair pace by age (m5 = $1,000; h1 covers the whole life up to 60m)", () => {
  // Activity is flat at $200/min across the pair's life, so h1 = 200 × min(age, 60).
  // A correct denominator gives exactly 1.0× at every qualifying age.
  const flatAt = (ageMinutes: number) =>
    snapshot({
      ageMinutes,
      volume: { m5: 1_000, h1: 200 * Math.min(ageMinutes, 60), h6: null, h24: null },
      txns: {
        m5: { buys: 10, sells: 10 },
        h1: { buys: 2 * Math.min(ageMinutes, 60), sells: 2 * Math.min(ageMinutes, 60) },
        h6: null,
        h24: null,
      },
    });

  it.each([10, 12, 14])("age %i m → INSUFFICIENT_HISTORY for VA and TA", (age) => {
    expect(volumeAcceleration(flatAt(age))).toEqual({ ok: false, reason: "INSUFFICIENT_HISTORY" });
    expect(transactionAcceleration(flatAt(age))).toEqual({
      ok: false,
      reason: "INSUFFICIENT_HISTORY",
    });
  });

  it.each([
    [15, 10],
    [20, 15],
    [60, 55],
  ])("age %i m → previous window %i m, flat activity = 1.0×", (age, window) => {
    const va = volumeAcceleration(flatAt(age));
    const ta = transactionAcceleration(flatAt(age));
    expect(va.ok && va.previousMinutes).toBe(window);
    expect(va.ok && va.ratio).toBeCloseTo(1, 10);
    expect(ta.ok && ta.previousMinutes).toBe(window);
    expect(ta.ok && ta.ratio).toBeCloseTo(1, 10);
  });

  it("uses the true 5-minute previous span: the reviewer's 10m example is 0.5×, not 1×", () => {
    // Age 15 so the gate passes; h1 − m5 = $2,000 over the actual 10 previous minutes.
    // (At age 10 the same numbers are INSUFFICIENT_HISTORY — see above.)
    const s = snapshot({ ageMinutes: 15, volume: { m5: 1_000, h1: 5_000, h6: null, h24: null } });
    const va = volumeAcceleration(s);
    // previous $4,000 / 10 min = $400/min; recent $1,000 / 5 min = $200/min.
    expect(va.ok && va.ratio).toBeCloseTo(0.5, 10);
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

  it("returns INSUFFICIENT_HISTORY for a 10-minute-old pair instead of inventing a baseline", () => {
    // 10 minutes old, $3,000 traded, $1,000 in the last 5 minutes. h1 − m5 covers
    // only 5 real minutes — below MIN_SAFE_PREVIOUS_MINUTES — so there is no
    // trustworthy baseline yet. (h1/60 would have claimed 4×; stretching the
    // previous window to 10 minutes would have claimed 1×; the truth is 0.5×.)
    const s = snapshot({ ageMinutes: 10, volume: { m5: 1_000, h1: 3_000, h6: null, h24: null } });
    expect(volumeAcceleration(s)).toEqual({ ok: false, reason: "INSUFFICIENT_HISTORY" });
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
