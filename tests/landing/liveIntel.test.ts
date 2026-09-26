import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { BoostToken } from "@/components/marco/shared/types";
import type { DeskState } from "@/lib/deskState";
import { CANONICAL_PAIRS, fetchRealtimePairs, type RealtimeRow } from "@/lib/providers/dexPairs";
import type { DataEnvelope } from "@/lib/providers/envelope";
import {
  LIVE_MAX_AGE_MS,
  SECTION_TEXT,
  TICKER_HORIZON,
  ageLabel,
  agedState,
  compactUsd,
  idleModel,
  latestBoostCount,
  oldestSuccess,
  previewModel,
  sectionState,
  tickerRows,
  type PreviewInput,
} from "@/lib/landing/liveIntel";

/**
 * LANDING · VAULT://INTELLIGENCE — truth rules (pure).
 * The numbered comments map to the 15 required cases.
 */

const PAIRS = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../fixtures/dexscreener.pairs.canonical.json", import.meta.url)),
    "utf8",
  ),
) as Record<string, unknown>;

const NOW = 1_700_000_100_000;

function env<T>(data: T, at: number, status: DataEnvelope<T>["status"] = "live"): DataEnvelope<T> {
  return {
    data,
    status,
    source: "test",
    fetchedAt: status === "stale" ? null : at,
    lastSuccessfulAt: at,
  };
}

/** Realtime rows from the recorded canonical-pairs fixture, via the real resolver. */
async function realtimeRows(drop: string[] = []): Promise<RealtimeRow[]> {
  const e = await fetchRealtimePairs({
    now: () => NOW,
    fetchJson: async (_s: string, url: string) => {
      const chain = url.split("/latest/dex/pairs/")[1].split("/")[0];
      if (drop.includes(chain)) return { pairs: [] };
      return PAIRS[chain] ?? { pairs: [] };
    },
  });
  return e.data;
}

const boost = (over: Partial<BoostToken> = {}): BoostToken => ({
  id: "solana:A",
  chainId: "solana",
  tokenAddress: "A",
  chain: "sol",
  symbol: "A",
  name: "",
  enriched: false,
  dex: "",
  price: null,
  change24h: null,
  volume24h: null,
  boostAmount: 10,
  boostTotal: 10,
  boostTier: "Low Boost",
  url: "https://dexscreener.com/solana/a",
  ...over,
});

const GLOBAL = { totalMcapUsd: 3e12, totalVolumeUsd: 1e11, mcapChange24hPct: -1.5 };

async function allLive(at = NOW - 5_000): Promise<PreviewInput> {
  return {
    now: NOW,
    realtime: { status: "live", envelope: env(await realtimeRows(), at) },
    boosts: {
      status: "live",
      envelope: env([boost(), boost({ id: "solana:B", tokenAddress: "B" })], at),
    },
    ads: { status: "live", envelope: env([], at) },
    global: { status: "live", envelope: env(GLOBAL, at) },
  };
}

describe("landing intelligence — required cases", () => {
  it("1 · all live and fresh → LIVE, every value from the providers", async () => {
    const m = previewModel(await allLive());
    expect(m.state).toBe("live");
    expect(SECTION_TEXT[m.state]).toBe("LIVE");
    expect(Object.values(m.feeds).every((s) => s === "live")).toBe(true);
    expect(m.metrics.map((c) => [c.key, c.value])).toEqual([
      ["vol", 1e11],
      ["boosts", 2],
      ["mcap", 3e12],
    ]);
    expect(m.metrics[2].change).toBe(-1.5);
    expect(m.rows.every((r) => r.resolved && r.priceUsd != null)).toBe(true);
  });

  it("2 · loading → CONNECTING, no values, no timestamp", () => {
    const m = idleModel();
    expect(m.state).toBe("loading");
    expect(SECTION_TEXT[m.state]).toBe("CONNECTING");
    expect(m.updatedAt).toBeNull();
    expect(m.metrics.every((c) => c.value == null)).toBe(true);
    expect(m.rows.every((r) => r.priceUsd == null && r.change24h == null && !r.resolved)).toBe(
      true,
    );
    // Identity only, in canonical order.
    expect(m.rows.map((r) => r.pairAddress)).toEqual(CANONICAL_PAIRS.map((p) => p.pairAddress));
  });

  it("3 · one provider down (CoinGecko offline) → PARTIAL, its cells —, others live", async () => {
    const i = await allLive();
    i.global = {
      status: "offline",
      envelope: {
        data: null,
        status: "offline",
        source: "coingecko",
        fetchedAt: null,
        lastSuccessfulAt: null,
      },
    };
    const m = previewModel(i);
    expect(m.state).toBe("degraded");
    expect(SECTION_TEXT[m.state]).toBe("PARTIAL");
    expect(m.metrics.find((c) => c.key === "vol")!.value).toBeNull();
    expect(m.metrics.find((c) => c.key === "mcap")!.value).toBeNull();
    expect(m.metrics.find((c) => c.key === "boosts")!.value).toBe(2);
  });

  it("4 · partial ticker (one pair unresolved) → that row —, section PARTIAL, others priced", async () => {
    const i = await allLive();
    i.realtime = {
      status: "degraded",
      envelope: env(await realtimeRows(["base"]), NOW - 5_000, "degraded"),
    };
    const m = previewModel(i);
    expect(m.state).toBe("degraded");
    const base = m.rows.find((r) => r.chainId === "base")!;
    expect(base.resolved).toBe(false);
    expect(base.priceUsd).toBeNull();
    expect(base.change24h).toBeNull();
    expect(m.rows.filter((r) => r.resolved)).toHaveLength(3);
  });

  it("5 · a genuine zero stays zero (count, % and money)", async () => {
    const i = await allLive();
    i.boosts = { status: "live", envelope: env([], NOW - 5_000) };
    i.global = {
      status: "live",
      envelope: env({ ...GLOBAL, mcapChange24hPct: 0, totalVolumeUsd: 0 }, NOW - 5_000),
    };
    const m = previewModel(i);
    expect(m.metrics.find((c) => c.key === "boosts")!.value).toBe(0);
    expect(m.metrics.find((c) => c.key === "vol")!.value).toBe(0);
    expect(m.metrics.find((c) => c.key === "mcap")!.change).toBe(0);
    expect(compactUsd(0)).toBe("$0");
    expect(m.state).toBe("live");
  });

  it("6 · null stays unknown (—), never 0, and makes a LIVE provider's section PARTIAL", async () => {
    const i = await allLive();
    i.global = {
      status: "degraded",
      envelope: env({ ...GLOBAL, totalVolumeUsd: null }, NOW - 5_000, "degraded"),
    };
    const m = previewModel(i);
    expect(m.metrics.find((c) => c.key === "vol")!.value).toBeNull();
    expect(compactUsd(null)).toBe("—");
    expect(m.state).toBe("degraded");
    // Even a "live" envelope with a null figure cannot yield a LIVE section.
    i.global = {
      status: "live",
      envelope: env({ ...GLOBAL, mcapChange24hPct: null }, NOW - 5_000),
    };
    expect(previewModel(i).state).toBe("degraded");
  });

  it("7 · timeout on first load → OFFLINE (no data); after a success → STALE with last real data", async () => {
    const i = await allLive();
    const off = (source: string) => ({
      status: "offline" as const,
      envelope: {
        data: null,
        status: "offline" as const,
        source,
        fetchedAt: null,
        lastSuccessfulAt: null,
        error: { code: "TIMEOUT" as const, message: "t" },
      },
    });
    const allOff = previewModel({
      now: NOW,
      realtime: off("dexscreener") as never,
      boosts: off("dexscreener") as never,
      ads: off("dexscreener"),
      global: off("coingecko"),
    });
    expect(allOff.state).toBe("offline");
    expect(allOff.metrics.every((c) => c.value == null)).toBe(true);
    expect(allOff.updatedAt).toBeNull();

    const at = NOW - 20_000;
    const staleAll = previewModel({
      now: NOW,
      realtime: { status: "stale", envelope: env(await realtimeRows(), at, "stale") },
      boosts: { status: "stale", envelope: env([boost()], at, "stale") },
      ads: { status: "stale", envelope: env([], at, "stale") },
      global: { status: "stale", envelope: env(GLOBAL, at, "stale") },
    });
    expect(staleAll.state).toBe("stale");
    expect(staleAll.metrics.find((c) => c.key === "mcap")!.value).toBe(3e12);
    expect(staleAll.updatedAt).toBe(at);
    void i;
  });

  it("8 · 429 on one provider (carried as stale) → section never LIVE", async () => {
    const i = await allLive();
    i.global = {
      status: "stale",
      envelope: {
        ...env(GLOBAL, NOW - 70_000, "stale"),
        error: { code: "RATE_LIMITED", message: "429" },
      },
    };
    const m = previewModel(i);
    expect(m.feeds.globalStats).toBe("stale");
    expect(m.state).toBe("degraded");
  });

  it("9 · stale cache: a LIVE envelope older than its window reads STALE", async () => {
    expect(agedState("live", NOW - 45_000, NOW, LIVE_MAX_AGE_MS.dexRealtime)).toBe("live");
    expect(agedState("live", NOW - 45_001, NOW, LIVE_MAX_AGE_MS.dexRealtime)).toBe("stale");
    expect(agedState("live", NOW - 90_000, NOW, LIVE_MAX_AGE_MS.globalStats)).toBe("live");
    expect(agedState("live", NOW - 90_001, NOW, LIVE_MAX_AGE_MS.globalStats)).toBe("stale");
    expect(agedState("degraded", NOW - 91_000, NOW, LIVE_MAX_AGE_MS.boostFeed)).toBe("stale");
    // A background tab returning with old cached data: nothing reads LIVE.
    const m = previewModel({ ...(await allLive(NOW - 120_000)) });
    expect(Object.values(m.feeds).every((s) => s === "stale")).toBe(true);
    expect(m.state).toBe("stale");
    expect(LIVE_MAX_AGE_MS).toEqual({
      dexRealtime: 45_000,
      boostFeed: 90_000,
      adsFeed: 90_000,
      globalStats: 90_000,
    });
  });

  it("10 · stale → live recovery: a new success restores LIVE and the age restarts from it", async () => {
    const old = previewModel(await allLive(NOW - 120_000));
    expect(old.state).toBe("stale");
    const fresh = previewModel(await allLive(NOW - 1_000));
    expect(fresh.state).toBe("live");
    expect(fresh.updatedAt).toBe(NOW - 1_000);
    expect(ageLabel(fresh.updatedAt, NOW)).toBe("1S AGO");
  });

  it("12 · pair identity is chain + base + quote + pairAddress; a symbol spoof is rejected", async () => {
    const rows = await realtimeRows();
    const sol = CANONICAL_PAIRS.find((p) => p.chainId === "solana")!;
    // A row claiming "SOL/USDC" but for another pair address is never shown as SOL/USDC.
    const spoof: RealtimeRow = {
      ...rows[0],
      pairAddress: "CkH8iAKJspoofspoofspoofspoofspoofspoofspoof",
      priceUsd: 999,
    };
    const t = tickerRows([spoof, ...rows.slice(1)]);
    const solRow = t.find((r) => r.chainId === "solana")!;
    expect(solRow.resolved).toBe(false);
    expect(solRow.priceUsd).toBeNull();
    expect(solRow).toMatchObject({
      pairAddress: sol.pairAddress,
      baseAddress: sol.baseAddress,
      quoteAddress: sol.quoteAddress,
    });
    // The provider resolver itself rejects a same-symbol pair with a different base address.
    const spoofed = JSON.parse(JSON.stringify(PAIRS.solana)) as {
      pairs: Array<{ baseToken: { address: string } }>;
    };
    spoofed.pairs[0].baseToken.address = "CkH8iAKJspoofspoofspoofspoofspoofspoofspoof";
    const e = await fetchRealtimePairs({
      now: () => NOW,
      fetchJson: async (_s: string, url: string) => {
        const chain = url.split("/latest/dex/pairs/")[1].split("/")[0];
        return chain === "solana" ? spoofed : PAIRS[chain];
      },
    });
    const row = tickerRows(e.data).find((r) => r.chainId === "solana")!;
    expect(row.resolved).toBe(false);
    // Keys are chain:address, never a symbol; EVM case variants collapse.
    expect(tickerRows(rows).map((r) => r.key)).toEqual(
      CANONICAL_PAIRS.map(
        (p) =>
          `${p.chainId}:${/^0x/i.test(p.pairAddress) ? p.pairAddress.toLowerCase() : p.pairAddress}`,
      ),
    );
    // No JUP row, no substitution: exactly the canonical four.
    expect(
      tickerRows(rows)
        .map((r) => r.pairLabel)
        .join(" "),
    ).not.toMatch(/JUP/);
    expect(tickerRows(rows)).toHaveLength(CANONICAL_PAIRS.length);
  });

  it("13 · % horizon: ticker % is priceChange.h24 only; h24 missing → —, never another window", async () => {
    const rows = await realtimeRows();
    const solFixture = (PAIRS.solana as { pairs: Array<{ priceChange: Record<string, number> }> })
      .pairs[0];
    const sol = tickerRows(rows).find((r) => r.chainId === "solana")!;
    expect(sol.change24h).toBe(solFixture.priceChange.h24);
    expect(sol.change24h).not.toBe(solFixture.priceChange.h1);
    const noH24 = rows.map((r) => (r.chainId === "solana" ? { ...r, change24h: null } : r));
    expect(tickerRows(noH24).find((r) => r.chainId === "solana")!.change24h).toBeNull();
    expect(TICKER_HORIZON).toBe("24H");
  });

  it("14 · timestamps: UPDATED age comes from the OLDEST real success; reads never refresh it", async () => {
    const i = await allLive();
    i.global = { status: "live", envelope: env(GLOBAL, NOW - 40_000) };
    const m = previewModel(i);
    expect(m.updatedAt).toBe(NOW - 40_000);
    expect(ageLabel(m.updatedAt, NOW)).toBe("40S AGO");
    // Re-computing later with the same envelopes only ages the label.
    const later = previewModel({ ...i, now: NOW + 30_000 });
    expect(later.updatedAt).toBe(NOW - 40_000);
    expect(ageLabel(later.updatedAt, NOW + 30_000)).toBe("1M AGO");
    expect(ageLabel(null, NOW)).toBeNull();
    expect(ageLabel(NOW - 7_200_000, NOW)).toBe("2H AGO");
    expect(oldestSuccess([null, 5, 3, undefined])).toBe(3);
    // An offline envelope contributes no timestamp.
    expect(oldestSuccess([])).toBeNull();
  });
});

describe("LATEST BOOSTS — count of genuine records", () => {
  it("counts records, not distinct tokens: the same token boosted twice with different amounts is two records", () => {
    expect(
      latestBoostCount([boost({ boostAmount: 10 }), boost({ boostAmount: 50, boostTotal: 60 })]),
    ).toBe(2);
  });
  it("true duplicates (same assetKey, amount, totalAmount, url) count once; EVM address case is not identity", () => {
    const a = boost({ chainId: "base", tokenAddress: "0xAbC" });
    const b = boost({ chainId: "base", tokenAddress: "0xabc" });
    expect(latestBoostCount([a, b])).toBe(1);
  });
  it("Solana addresses are case-sensitive: case variants are different records", () => {
    expect(latestBoostCount([boost({ tokenAddress: "abc" }), boost({ tokenAddress: "ABC" })])).toBe(
      2,
    );
  });
  it("no data → null (—), empty list → 0", () => {
    expect(latestBoostCount(undefined)).toBeNull();
    expect(latestBoostCount([])).toBe(0);
  });
});

describe("section status aggregate", () => {
  const S = (...s: DeskState[]) => sectionState(s);
  it("is never LIVE unless every provider is live", () => {
    const all: DeskState[] = ["loading", "live", "degraded", "stale", "offline"];
    for (const a of all)
      for (const b of all) expect(S(a, b) === "live").toBe(a === "live" && b === "live");
    expect(sectionState(["live", "live"], true)).toBe("degraded");
  });
  it("maps mixes truthfully", () => {
    expect(S("loading", "loading")).toBe("loading");
    expect(S("live", "loading")).toBe("loading");
    expect(S("offline", "offline")).toBe("offline");
    expect(S("stale", "offline")).toBe("stale");
    expect(S("live", "offline")).toBe("degraded");
    expect(S("loading", "offline")).toBe("degraded");
    expect(S("live", "stale")).toBe("degraded");
    expect(sectionState([])).toBe("offline");
  });
  it("an unknown runtime status can never read LIVE", () => {
    expect(agedState("LIVE", NOW, NOW, 1000)).toBe("offline");
    expect(agedState(undefined, NOW, NOW, 1000)).toBe("offline");
    expect(agedState("live", null, NOW, 1000)).toBe("stale");
  });
});
