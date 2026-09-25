import { describe, expect, it } from "vitest";
import { buyPressure, earlyMomentum, evaluateEvidence } from "@/lib/signals/momentum";
import {
  BOOST_DELTA_MIN,
  BP_MIN,
  BP_MIN_SAMPLE_TXNS,
  MIN_LIQUIDITY_USD,
  MIN_PAIR_AGE_MINUTES,
  TA_MIN,
  VA_MIN,
} from "@/lib/signals/thresholds";
import { T0, acceleratingPair, snapshot } from "./fixtures";

const MIN = 60_000;

describe("buy pressure (BP)", () => {
  it("is m5 buys / m5 sells", () => {
    const bp = buyPressure(
      snapshot({ txns: { m5: { buys: 28, sells: 10 }, h1: null, h6: null, h24: null } }),
    );
    expect(bp).toMatchObject({ ok: true, ratio: 2.8, sample: 38 });
  });

  it("is not evidence at all below the sample guard", () => {
    const bp = buyPressure(
      snapshot({
        txns: { m5: { buys: BP_MIN_SAMPLE_TXNS - 1, sells: 0 }, h1: null, h6: null, h24: null },
      }),
    );
    expect(bp).toEqual({
      ok: false,
      reason: "INSUFFICIENT_SAMPLE",
      sample: BP_MIN_SAMPLE_TXNS - 1,
    });
  });

  it("divides by at least one so an all-buy window is finite", () => {
    const bp = buyPressure(
      snapshot({ txns: { m5: { buys: 9, sells: 0 }, h1: null, h6: null, h24: null } }),
    );
    expect(bp).toMatchObject({ ok: true, ratio: 9 });
  });
});

describe("EARLY MOMENTUM rule", () => {
  it("fires on the worked example and lists exactly the evidence that passed", () => {
    const m = earlyMomentum(acceleratingPair(), [acceleratingPair()]);
    expect(m).not.toBeNull();
    if (!m) return;
    expect(m.label).toBe("EARLY MOMENTUM");
    // Volume, transactions, buyers pass; liquidity and attention have no history yet.
    expect(m.evidence).toEqual({ passed: 3, total: 5 });
    expect(m.reasons).toEqual(["Volume 3.4× previous pace", "Transactions 2.1×", "Buyers 2.7:1"]);
    expect(m.dimensions.find((d) => d.dimension === "liquidity")).toMatchObject({
      available: false,
      unavailable: "INSUFFICIENT_HISTORY",
    });
    expect(m.gates).toEqual({ liquidityUsd: 410_000, ageMinutes: 47 });
  });

  it("adds liquidity-stable and boost evidence once history covers them", () => {
    const earlier = acceleratingPair(T0 - 30 * MIN);
    earlier.boostsActive = 12;
    earlier.liquidityUsd = 400_000;
    const now = acceleratingPair(T0); // boosts 38, liquidity 410,000
    const m = earlyMomentum(now, [earlier, now]);
    expect(m?.evidence).toEqual({ passed: 5, total: 5 });
    expect(m?.reasons).toEqual([
      "Volume 3.4× previous pace",
      "Transactions 2.1×",
      "Buyers 2.7:1",
      "Liquidity stable",
      `Boost +${38 - 12}`,
    ]);
  });

  it("never mentions a dimension that did not pass", () => {
    const earlier = acceleratingPair(T0 - 30 * MIN);
    earlier.boostsActive = 38 - BOOST_DELTA_MIN + 1; // delta below the minimum
    const m = earlyMomentum(acceleratingPair(), [earlier, acceleratingPair()]);
    expect(m?.reasons.some((r) => r.startsWith("Boost"))).toBe(false);
    expect(m?.evidence.passed).toBe(4);
  });

  it("does not fire when any required dimension fails its threshold", () => {
    const base = acceleratingPair();
    const weakVolume = { ...base, volume: { ...base.volume, m5: 2_000 } }; // VA ≈ 1
    expect(earlyMomentum(weakVolume, [weakVolume])).toBeNull();

    const weakTx = { ...base, txns: { ...base.txns, m5: { buys: 12, sells: 8 } } }; // TA < 2
    expect(earlyMomentum(weakTx, [weakTx])).toBeNull();

    const sellers = { ...base, txns: { ...base.txns, m5: { buys: 20, sells: 32 } } }; // BP < 1.5
    expect(earlyMomentum(sellers, [sellers])).toBeNull();
  });

  it("does not use buy pressure below the sample guard even if the ratio would pass", () => {
    const base = acceleratingPair();
    const tiny = {
      ...base,
      txns: { ...base.txns, m5: { buys: 5, sells: 1 }, h1: { buys: 150, sells: 112 } },
    };
    const ev = evaluateEvidence(tiny, [tiny]).find((d) => d.dimension === "buyers");
    expect(ev).toMatchObject({ available: false, unavailable: "INSUFFICIENT_SAMPLE" });
    expect(earlyMomentum(tiny, [tiny])).toBeNull();
  });

  it("is gated by liquidity and pair age", () => {
    const thin = { ...acceleratingPair(), liquidityUsd: MIN_LIQUIDITY_USD - 1 };
    expect(earlyMomentum(thin, [thin])).toBeNull();

    const young = {
      ...acceleratingPair(),
      pairCreatedAt: T0 - (MIN_PAIR_AGE_MINUTES - 1) * MIN,
    };
    expect(earlyMomentum(young, [young])).toBeNull();

    const unknownAge = { ...acceleratingPair(), pairCreatedAt: null };
    expect(earlyMomentum(unknownAge, [unknownAge])).toBeNull();
  });

  it("does not fire when liquidity fell more than the stable drawdown over the lookback", () => {
    const earlier = acceleratingPair(T0 - 20 * MIN);
    earlier.liquidityUsd = 600_000;
    const now = acceleratingPair(T0); // 410,000 → −31.7%
    expect(earlyMomentum(now, [earlier, now])).toBeNull();
  });

  it("records the thresholds each dimension was judged against", () => {
    const dims = evaluateEvidence(acceleratingPair(), []);
    expect(dims.map((d) => [d.dimension, d.threshold])).toEqual([
      ["volume", VA_MIN],
      ["transactions", TA_MIN],
      ["buyers", BP_MIN],
      ["liquidity", -0.1],
      ["attention", BOOST_DELTA_MIN],
    ]);
  });
});
