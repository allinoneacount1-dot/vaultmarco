import { describe, expect, it } from "vitest";
import {
  QUICK_STATS_WORD,
  STATE_TEXT,
  UNIVERSE_HELP,
  feedState,
  known,
  providerLine,
  quickStatsState,
  universeLabel,
  type DeskState,
} from "@/lib/deskState";

const ALL: DeskState[] = ["loading", "live", "degraded", "stale", "offline"];

describe("desk status vocabulary — truth semantics", () => {
  it("topbar status is scoped to the pair universe, never a whole-desk LIVE", () => {
    expect(universeLabel("live")).toBe("UNIVERSE LIVE");
    expect(universeLabel("offline")).toBe("UNIVERSE OFFLINE");
    expect(universeLabel("loading")).toBe("UNIVERSE CONNECTING");
    for (const s of ALL) {
      expect(universeLabel(s)).toMatch(/^UNIVERSE /);
      expect(UNIVERSE_HELP[s]).toMatch(/^Pair universe \(DexScreener\)/);
    }
    // LIVE explicitly says other panels report their own state.
    expect(UNIVERSE_HELP.live).toMatch(/CoinGecko, Fear & Greed/);
  });

  it("every state maps explicitly; only `live` produces LIVE", () => {
    for (const s of ALL) {
      const live = s === "live";
      expect(feedState(s) === "LIVE").toBe(live);
      expect(providerLine(s, "COINGECKO").text.startsWith("LIVE ·")).toBe(live);
      expect(universeLabel(s) === "UNIVERSE LIVE").toBe(live);
    }
    expect(providerLine("stale", "COINGECKO")).toEqual({
      text: "LAST KNOWN · COINGECKO",
      tone: "warn",
    });
    expect(providerLine("offline", "COINGECKO")).toEqual({
      text: "UNAVAILABLE · COINGECKO",
      tone: "down",
    });
    expect(providerLine("loading", "COINGECKO").text).toBe("CONNECTING · COINGECKO");
  });

  it("an unexpected runtime status can never fall through to LIVE", () => {
    for (const bogus of ["", "ok", "LIVE", "ready", undefined, null, 42]) {
      const b = bogus as unknown as DeskState;
      expect(known(b)).toBeNull();
      expect(feedState(b)).toBe("UNKNOWN");
      expect(universeLabel(b)).toBe("UNIVERSE UNKNOWN");
      expect(providerLine(b, "X")).toEqual({ text: "UNKNOWN · X", tone: "warn" });
    }
    expect(Object.keys(STATE_TEXT).sort()).toEqual([...ALL].sort());
  });
});

describe("Quick Stats — two independent providers", () => {
  const gecko = { btcDominance: 57.1, totalMcap: 3.2e12, mcapChange24h: -0.4 };
  const noGecko = { btcDominance: null, totalMcap: null, mcapChange24h: null };

  it("all figures real → LIVE", () => {
    expect(quickStatsState({ ...gecko, fearGreed: 62 }, false)).toEqual({
      state: "live",
      missing: [],
    });
    expect(QUICK_STATS_WORD.live).toBe("LIVE");
  });

  it("CoinGecko fails, Fear & Greed answers → PARTIAL, CoinGecko named", () => {
    expect(quickStatsState({ ...noGecko, fearGreed: 62 }, false)).toEqual({
      state: "partial",
      missing: ["CoinGecko"],
    });
    expect(QUICK_STATS_WORD.partial).toBe("PARTIAL");
  });

  it("CoinGecko answers, Fear & Greed fails → PARTIAL, alternative.me named", () => {
    expect(quickStatsState({ ...gecko, fearGreed: null }, false)).toEqual({
      state: "partial",
      missing: ["alternative.me"],
    });
  });

  it("both unavailable → OFFLINE", () => {
    expect(quickStatsState({ ...noGecko, fearGreed: null }, false)).toEqual({
      state: "offline",
      missing: ["CoinGecko", "alternative.me"],
    });
    expect(quickStatsState(null, false).state).toBe("offline");
    expect(QUICK_STATS_WORD.offline).toBe("OFFLINE");
  });

  it("first request in flight → loading (no state word); a real 0 counts as a figure", () => {
    expect(quickStatsState(null, true)).toEqual({ state: "loading", missing: [] });
    expect(QUICK_STATS_WORD.loading).toBeNull();
    // Fear & Greed 0 and a 0.0% change are real values, not missing.
    expect(quickStatsState({ ...gecko, mcapChange24h: 0, fearGreed: 0 }, false).state).toBe("live");
  });
});
