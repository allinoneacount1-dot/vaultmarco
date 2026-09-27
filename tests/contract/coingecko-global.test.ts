import { describe, expect, it } from "vitest";
import {
  fetchFearGreed,
  fetchGlobalMarket,
  parseGlobal,
  settleEnvelope,
} from "@/lib/providers/coingeckoGlobal";
import { ProviderError, type DataEnvelope } from "@/lib/providers/envelope";
import { globalStatsRound, type GlobalStats } from "@/hooks/useGlobalStats";
import { quickStatsState } from "@/lib/deskState";

/*
 * SCHEMA-SHAPED TEST DATA — NOT A CAPTURED PROVIDER RESPONSE.
 *
 * No live CoinGecko `/global` or alternative.me `/fng` response could be
 * captured from the development sandbox (egress blocked). The bodies below are
 * hand-written; the numbers are arbitrary round test values. The field paths
 * (total_volume.usd, total_market_cap.usd, market_cap_change_percentage_24h_usd,
 * market_cap_percentage.btc, updated_at) were independently checked against the
 * live `/global` API during owner review; the values here are not from it.
 */
const GLOBAL_TEST_BODY = {
  data: {
    total_market_cap: { usd: 3_000_000_000_000, eur: 1 },
    total_volume: { usd: 100_000_000_000, eur: 1 },
    market_cap_percentage: { btc: 50, eth: 10 },
    market_cap_change_percentage_24h_usd: -1.5,
    updated_at: 1_700_000_000,
  },
};
const FNG_TEST_BODY = { data: [{ value: "40", value_classification: "Fear" }] };

const T = 1_700_000_100_000;
const deps = (body: unknown) => ({ now: () => T, fetchJson: async () => body });
const failing = (code: "TIMEOUT" | "RATE_LIMITED" | "HTTP_ERROR") => ({
  now: () => T,
  fetchJson: async (source: string) => {
    throw new ProviderError(source, code, code);
  },
});

describe("CoinGecko /global — strict parse (schema-shaped test data)", () => {
  it("reads global volume and market cap from total_volume.usd / total_market_cap.usd", async () => {
    const env = await fetchGlobalMarket(deps(GLOBAL_TEST_BODY));
    expect(env.status).toBe("live");
    expect(env.fetchedAt).toBe(T);
    expect(env.lastSuccessfulAt).toBe(T);
    expect(env.data).toEqual({
      totalMcapUsd: 3_000_000_000_000,
      totalVolumeUsd: 100_000_000_000,
      mcapChange24hPct: -1.5,
      btcDominancePct: 50,
      providerUpdatedAt: 1_700_000_000_000,
    });
  });

  it("a missing or invalid field is null (never 0, never another metric) and the response is degraded", async () => {
    const body = {
      data: {
        ...GLOBAL_TEST_BODY.data,
        total_volume: { usd: "100000000000" }, // string: invalid
        market_cap_change_percentage_24h_usd: null,
      },
    };
    const env = await fetchGlobalMarket(deps(body));
    expect(env.status).toBe("degraded");
    expect(env.droppedItems).toBe(2);
    expect(env.data.totalVolumeUsd).toBeNull();
    expect(env.data.mcapChange24hPct).toBeNull();
    // Market cap is still read; volume is NOT substituted by it.
    expect(env.data.totalMcapUsd).toBe(3_000_000_000_000);
  });

  it("a genuine zero stays zero", () => {
    const { data, missing } = parseGlobal({
      data: {
        ...GLOBAL_TEST_BODY.data,
        total_volume: { usd: 0 },
        market_cap_change_percentage_24h_usd: 0,
      },
    });
    expect(data.totalVolumeUsd).toBe(0);
    expect(data.mcapChange24hPct).toBe(0);
    expect(missing).toBe(0);
  });

  it("rejects negative / non-finite money values", () => {
    const { data } = parseGlobal({
      data: {
        ...GLOBAL_TEST_BODY.data,
        total_volume: { usd: -5 },
        total_market_cap: { usd: Infinity },
      },
    });
    expect(data.totalVolumeUsd).toBeNull();
    expect(data.totalMcapUsd).toBeNull();
  });

  it("an unusable root throws SCHEMA_MISMATCH instead of returning an empty success", async () => {
    await expect(fetchGlobalMarket(deps({ nope: 1 }))).rejects.toMatchObject({
      code: "SCHEMA_MISMATCH",
    });
    await expect(fetchGlobalMarket(deps({ data: {} }))).rejects.toMatchObject({
      code: "SCHEMA_MISMATCH",
    });
  });

  it("timeout and 429 surface as typed errors (no retry inside the fetcher)", async () => {
    let calls = 0;
    const d = {
      now: () => T,
      fetchJson: async (source: string) => {
        calls++;
        throw new ProviderError(source, "RATE_LIMITED", "429");
      },
    };
    await expect(fetchGlobalMarket(d)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(calls).toBe(1);
    await expect(fetchGlobalMarket(failing("TIMEOUT"))).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("Fear & Greed parses the numeric string; a non-numeric value is null (degraded)", async () => {
    expect((await fetchFearGreed(deps(FNG_TEST_BODY))).data).toEqual({ value: 40, label: "Fear" });
    const zero = await fetchFearGreed(deps({ data: [{ value: "0", value_classification: "x" }] }));
    expect(zero.data.value).toBe(0);
    const bad = await fetchFearGreed(deps({ data: [{ value: "n/a" }] }));
    expect(bad.data.value).toBeNull();
    expect(bad.status).toBe("degraded");
  });
});

describe("Fear & Greed range — the index is defined on 0–100", () => {
  const read = (value: unknown) =>
    fetchFearGreed(deps({ data: [{ value, value_classification: "x" }] }));
  it("0 and 100 are valid", async () => {
    for (const v of ["0", "100", 62]) {
      const e = await read(v);
      expect(e.data.value).toBe(Number(v));
      expect(e.status).toBe("live");
    }
  });
  it("-1, 101, 999 and non-numeric input → null + degraded, never clamped", async () => {
    for (const v of ["-1", "101", "999", "abc", "", -1, 101, null]) {
      const e = await read(v);
      expect(e.data.value).toBeNull();
      expect(e.status).toBe("degraded");
    }
  });
});

describe("settleEnvelope — carry the last REAL payload, never re-stamp it", () => {
  const prev: DataEnvelope<{ v: number }> = {
    data: { v: 1 },
    status: "live",
    source: "coingecko",
    fetchedAt: 1000,
    lastSuccessfulAt: 1000,
  };
  const err = new ProviderError("coingecko", "RATE_LIMITED", "429");

  it("failure with a previous real payload → stale, lastSuccessfulAt unchanged, fetchedAt null", () => {
    const e = settleEnvelope("coingecko", { status: "rejected", reason: err }, prev);
    expect(e).toMatchObject({
      status: "stale",
      lastSuccessfulAt: 1000,
      fetchedAt: null,
      data: { v: 1 },
    });
    expect(e.error?.code).toBe("RATE_LIMITED");
  });

  it("failure with no previous payload → offline, no data", () => {
    const e = settleEnvelope("coingecko", { status: "rejected", reason: err }, undefined);
    expect(e).toMatchObject({ status: "offline", data: null, lastSuccessfulAt: null });
  });

  it("success → the fresh envelope as-is", () => {
    const fresh = { ...prev, fetchedAt: 2000, lastSuccessfulAt: 2000 };
    expect(settleEnvelope("coingecko", { status: "fulfilled", value: fresh }, prev)).toBe(fresh);
  });
});

describe("useGlobalStats round — dashboard Quick Stats semantics unchanged", () => {
  const ok = async () => ({
    gecko: await Promise.allSettled([fetchGlobalMarket(deps(GLOBAL_TEST_BODY))]).then((r) => r[0]),
    fng: await Promise.allSettled([fetchFearGreed(deps(FNG_TEST_BODY))]).then((r) => r[0]),
  });
  const rejected = {
    status: "rejected",
    reason: new ProviderError("x", "HTTP_ERROR", "503"),
  } as const;

  it("both answer → flat figures present, Quick Stats LIVE", async () => {
    const { gecko, fng } = await ok();
    const r = globalStatsRound(gecko, fng, undefined);
    expect(r).toMatchObject({
      btcDominance: 50,
      totalMcap: 3_000_000_000_000,
      mcapChange24h: -1.5,
      fearGreed: 40,
      fearGreedLabel: "Fear",
    });
    expect(quickStatsState(r, false).state).toBe("live");
  });

  it("CoinGecko fails on a later round → flat CoinGecko figures null (PARTIAL), envelope carries last real payload as stale", async () => {
    const { gecko, fng } = await ok();
    const first: GlobalStats = globalStatsRound(gecko, fng, undefined);
    const second = globalStatsRound(rejected, fng, first);
    expect(second.totalMcap).toBeNull();
    expect(second.btcDominance).toBeNull();
    expect(second.mcapChange24h).toBeNull();
    expect(quickStatsState(second, false)).toEqual({ state: "partial", missing: ["CoinGecko"] });
    expect(second.coingecko.status).toBe("stale");
    expect(second.coingecko.lastSuccessfulAt).toBe(T);
    expect(second.coingecko.data?.totalMcapUsd).toBe(3_000_000_000_000);
  });

  it("both fail on the first round → OFFLINE, envelopes offline", () => {
    const r = globalStatsRound(rejected, rejected, undefined);
    expect(quickStatsState(r, false).state).toBe("offline");
    expect(r.coingecko.status).toBe("offline");
    expect(r.fearGreedFeed.status).toBe("offline");
  });
});
