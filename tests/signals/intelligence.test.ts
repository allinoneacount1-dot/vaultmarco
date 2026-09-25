import { describe, expect, it } from "vitest";
import { SnapshotHistory } from "@/lib/signals/history";
import { buildIntelligence, pairIntelligence } from "@/lib/signals/intelligence";
import { liquidityChangeSince } from "@/lib/signals/liquidity";
import { boostChange, buyPressure, evaluateEvidence } from "@/lib/signals/momentum";
import { transactionAcceleration, volumeAcceleration } from "@/lib/signals/pace";
import { computeRadar } from "@/lib/signals/radar";
import {
  EVIDENCE_LOOKBACK_MINUTES,
  MIN_LIQUIDITY_USD,
  MIN_PAIR_AGE_MINUTES,
} from "@/lib/signals/thresholds";
import { T0, acceleratingPair, snapshot } from "./fixtures";

const MIN = 60_000;

describe("pairIntelligence — assembled only from existing signal functions", () => {
  it("equals the outputs of the functions the radar uses, for the same inputs", () => {
    const earlier = { ...acceleratingPair(T0 - 30 * MIN), boostsActive: 12, liquidityUsd: 400_000 };
    const now = acceleratingPair(T0);
    const history = [earlier, now];
    const intel = pairIntelligence(now, history, null);

    expect(intel.va).toEqual(volumeAcceleration(now));
    expect(intel.ta).toEqual(transactionAcceleration(now));
    expect(intel.bp).toEqual(buyPressure(now));
    expect(intel.evidence).toEqual(evaluateEvidence(now, history));
    expect(intel.liquidityChange).toEqual(liquidityChangeSince(history, EVIDENCE_LOOKBACK_MINUTES));
    expect(intel.boostDelta).toEqual(boostChange(history, EVIDENCE_LOOKBACK_MINUTES));
    expect(intel.ageMinutes).toBe(47);
  });

  it("attaches the radar's own momentum and risk objects for the same round (no recomputation)", () => {
    const h = new SnapshotHistory();
    const fast = acceleratingPair();
    h.record([fast]);
    const radar = computeRadar([fast], h, T0);
    const intel = pairIntelligence(fast, h.get(fast.key), radar);
    expect(intel.momentum).toBe(radar.momentum[0]);
    expect(intel.risk).toBeNull();
  });

  it("carries no current signal for a retained snapshot (radar = null)", () => {
    const intel = pairIntelligence(acceleratingPair(), [acceleratingPair()], null);
    expect(intel.momentum).toBeNull();
    expect(intel.risk).toBeNull();
  });

  it("reports the EARLY MOMENTUM gates with their named thresholds", () => {
    const thin = snapshot({
      liquidityUsd: MIN_LIQUIDITY_USD - 1,
      ageMinutes: MIN_PAIR_AGE_MINUTES - 1,
    });
    const g = pairIntelligence(thin, [thin], null).gates;
    expect(g.liquidity).toEqual({
      value: MIN_LIQUIDITY_USD - 1,
      min: MIN_LIQUIDITY_USD,
      passed: false,
    });
    expect(g.age).toMatchObject({ min: MIN_PAIR_AGE_MINUTES, passed: false });
    const unknown = snapshot({ liquidityUsd: null, pairCreatedAt: null });
    expect(pairIntelligence(unknown, [unknown], null).gates).toMatchObject({
      liquidity: { value: null, passed: false },
      age: { value: null, passed: false },
    });
  });

  it("builds one entry per snapshot, keyed by the snapshot key", () => {
    const h = new SnapshotHistory();
    const a = snapshot({ key: "solana:a" });
    const b = snapshot({ key: "base:b", chainId: "base" });
    h.record([a, b]);
    const out = buildIntelligence([a, b], h, computeRadar([a, b], h, T0));
    expect(Object.keys(out).sort()).toEqual(["base:b", "solana:a"]);
    expect(out["base:b"].snapshot).toBe(b);
  });
});
