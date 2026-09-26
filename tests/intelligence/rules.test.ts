import { describe, expect, it } from "vitest";
import * as R from "@/lib/intelligence/rules";
import * as T from "@/lib/signals/thresholds";
import { realtimeQueryOptions } from "@/hooks/usePairUniverse";

describe("intelligence rules", () => {
  it("is versioned", () => {
    expect(R.INTELLIGENCE_RULES_VERSION).toBe("intel-1");
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
    expect(R.staleAfterMs("realtime")).toBe(90_000);
    expect(R.staleAfterMs("universe")).toBe(150_000);
  });
});
