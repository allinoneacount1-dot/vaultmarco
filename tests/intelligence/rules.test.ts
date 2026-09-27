import { describe, expect, it } from "vitest";
import * as R from "@/lib/intelligence/rules";
import * as T from "@/lib/signals/thresholds";
import { realtimeQueryOptions } from "@/hooks/usePairUniverse";

describe("intelligence rules", () => {
  it("is versioned", () => {
    expect(R.INTELLIGENCE_RULES_VERSION).toBe("intel-2");
  });

  it("reuses the radar's thresholds instead of copying them", () => {
    expect(R.VOLUME_ACCELERATION_MIN).toBe(T.VA_MIN);
    expect(R.TXN_ACCELERATION_MIN).toBe(T.TA_MIN);
    expect(R.IMBALANCE_MIN_RATIO).toBe(T.BP_MIN);
    expect(R.IMBALANCE_MIN_SAMPLE_TXNS).toBe(T.BP_MIN_SAMPLE_TXNS);
    expect(R.LIQUIDITY_CHANGE_MIN_REL).toBe(T.LIQUIDITY_STABLE_MAX_DRAWDOWN);
    expect(R.LIQUIDITY_CHANGE_MIN_ABS_USD).toBe(T.LIQUIDITY_EVENT_MIN_ABS_USD);
    expect(R.LIQUIDITY_CHANGE_MIN_PREVIOUS_USD).toBe(T.LIQUIDITY_EVENT_MIN_PREVIOUS_USD);
    expect(R.LIQUIDITY_CHANGE_LOOKBACK_MINUTES).toBe(T.LIQUIDITY_EVENT_LOOKBACK_MINUTES);
    expect(R.SESSION_MAX_AGE_MS).toBe(T.HISTORY_MAX_AGE_MINUTES * 60_000);
  });

  it("lane cadences match the existing queries (no drift, no new loop)", () => {
    expect(R.LANE_CADENCE_MS.realtime).toBe(realtimeQueryOptions.refetchInterval);
    expect(R.LANE_CADENCE_MS.universe).toBe(60_000);
    // Aligned with the landing windows: 30 s lane LIVE ≤ 45 s, 60 s lane LIVE ≤ 90 s.
    expect(R.staleAfterMs("realtime")).toBe(45_000);
    expect(R.staleAfterMs("universe")).toBe(90_000);
  });

  it("every rule carries exportable metadata (value, unit, horizon, source) matching the constants", () => {
    const ids = R.INTELLIGENCE_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of R.INTELLIGENCE_RULES) {
      expect(r.horizon.length).toBeGreaterThan(0);
      expect(["RADAR_IMPORTED", "PRODUCT_DEFINED", "QUERY_MIRROR"]).toContain(r.source);
      const constant = (R as unknown as Record<string, unknown>)[r.id];
      if (typeof constant === "number") expect(r.value).toBe(constant);
      expect(r.note).not.toMatch(/filters? .*noise|calibrated to|predicts?\b/i);
    }
    expect(R.ruleMeta("PRICE_EXPANSION_M5_PCT")).toMatchObject({
      value: 3,
      unit: "PCT",
      source: "PRODUCT_DEFINED",
    });
    expect(R.ruleMeta("PRICE_EXPANSION_M5_PCT")!.note).toMatch(/not statistically calibrated/);
    expect(R.ruleMeta("VOLUME_ACCELERATION_MIN")!.source).toBe("RADAR_IMPORTED");
  });

  it("divergence predicates are defined centrally with fields, horizons and neutral labels", () => {
    expect(R.DIVERGENCE_RULES.map((d) => d.id)).toEqual([
      "PRICE_VS_VOLUME",
      "PRICE_VS_TXNS",
      "VOLUME_VS_LIQUIDITY",
      "BALANCE_VS_PRICE",
      "BOOST_VS_ACTIVITY",
      "PRICE_EXPANSION_WITHOUT_VOLUME",
    ]);
    for (const d of R.DIVERGENCE_RULES) {
      expect(d.label).toMatch(/ · DIVERGED$/);
      expect(d.label).not.toMatch(/BULL|BEAR|ACCUMULAT|DISTRIBUT|BUYING|SELLING/i);
      expect(d.requiredFields.length).toBeGreaterThan(0);
      expect(d.metrics.every((m) => m.horizon.length > 0)).toBe(true);
    }
  });
});
