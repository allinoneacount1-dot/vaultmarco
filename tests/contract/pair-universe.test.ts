import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fetchPairUniverse } from "@/lib/providers/universe";
import { fetchAds, fetchTokenBoosts } from "@/lib/providers/dexscreener";
import { fetchRealtimePairs } from "@/lib/providers/dexPairs";
import { SnapshotHistory } from "@/lib/signals/history";

const fixture = (name: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8"));

const BOOSTS = fixture("dexscreener.boosts.latest.json");
const ADS = fixture("dexscreener.ads.latest.json");
const TOKENS = fixture("dexscreener.tokens.solana.json");
const PAIRS = fixture("dexscreener.pairs.canonical.json") as Record<string, unknown>;

const now = () => 1_700_000_000_000;

/** Counting fetch stub: routes each DexScreener endpoint to a fixture and records every URL. */
function deps(
  fail: { boosts?: boolean; ads?: boolean; realtime?: boolean; tokens?: boolean } = {},
) {
  const urls: string[] = [];
  return {
    urls,
    deps: {
      now,
      fetchJson: async (_source: string, url: string) => {
        urls.push(url);
        if (url.includes("/token-boosts/")) {
          if (fail.boosts) throw new Error("boosts down");
          return BOOSTS;
        }
        if (url.includes("/ads/")) {
          if (fail.ads) throw new Error("ads down");
          return ADS;
        }
        if (url.includes("/tokens/v1/")) {
          if (fail.tokens) throw new Error("tokens down");
          return url.includes("/solana/") ? TOKENS : [];
        }
        if (url.includes("/latest/dex/pairs/")) {
          if (fail.realtime) throw new Error("pairs down");
          const chain = url.split("/latest/dex/pairs/")[1].split("/")[0];
          return PAIRS[chain] ?? { pairs: [] };
        }
        throw new Error(`unexpected url ${url}`);
      },
    },
  };
}

const count = (urls: string[], part: string) => urls.filter((u) => u.includes(part)).length;

describe("pair universe — one poll for every DexScreener consumer", () => {
  it("makes strictly fewer requests than the three feeds polling separately", async () => {
    const separate = deps();
    await fetchTokenBoosts("latest", separate.deps);
    await fetchAds(separate.deps);
    await fetchRealtimePairs(separate.deps);

    const shared = deps();
    await fetchPairUniverse(undefined, new SnapshotHistory(), shared.deps);

    // Same list + realtime reads…
    expect(count(shared.urls, "/token-boosts/")).toBe(1);
    expect(count(shared.urls, "/ads/")).toBe(1);
    expect(count(shared.urls, "/latest/dex/pairs/")).toBe(
      count(separate.urls, "/latest/dex/pairs/"),
    );
    // …but the boost and ad references share one enrichment pass.
    expect(count(shared.urls, "/tokens/v1/")).toBeLessThan(count(separate.urls, "/tokens/v1/"));
    expect(shared.urls.length).toBeLessThan(separate.urls.length);
  });

  it("produces the same feed records the standalone fetchers produce", async () => {
    const a = deps();
    const boosts = await fetchTokenBoosts("latest", a.deps);
    const ads = await fetchAds(a.deps);
    const u = await fetchPairUniverse(undefined, new SnapshotHistory(), deps().deps);
    expect(u.boosts?.data).toEqual(boosts.data);
    expect(u.ads?.data).toEqual(ads.data);
    expect(u.boosts?.status).toBe("live");
    expect(u.realtime?.data.some((r) => r.resolved)).toBe(true);
  });

  it("normalizes every enriched pair into a snapshot with the raw windows", async () => {
    const u = await fetchPairUniverse(undefined, new SnapshotHistory(), deps().deps);
    expect(u.snapshots.length).toBeGreaterThan(0);
    const honse = u.snapshots.find((s) => s.baseSymbol === "honse");
    expect(honse).toMatchObject({
      chainId: "solana",
      observedAt: now(),
      pairCreatedAt: 1786653774000,
      liquidityUsd: 25532.33,
      boostsActive: 10,
      volume: { m5: 3357.32, h1: 4763.71, h6: 5829.83, h24: 11814.75 },
      txns: { m5: { buys: 20, sells: 20 }, h1: { buys: 37, sells: 23 } },
    });
    expect(u.radar.universeSize).toBe(u.snapshots.length);
  });

  it("keeps a failing source stale from its last real payload while the others stay live", async () => {
    const history = new SnapshotHistory();
    const first = await fetchPairUniverse(undefined, history, deps().deps);
    const second = await fetchPairUniverse(first, history, deps({ ads: true }).deps);
    expect(second.boosts?.status).toBe("live");
    expect(second.ads?.status).toBe("stale");
    expect(second.ads?.data).toEqual(first.ads?.data);
    expect(second.ads?.error?.code).toBe("NETWORK_ERROR");
  });

  it("reports a source that never succeeded as absent (offline), never as an empty success", async () => {
    const u = await fetchPairUniverse(undefined, new SnapshotHistory(), deps({ ads: true }).deps);
    expect(u.ads).toBeNull();
    expect(u.boosts?.status).toBe("live");
  });

  it("throws only when every source failed, so the previous round is kept", async () => {
    await expect(
      fetchPairUniverse(
        undefined,
        new SnapshotHistory(),
        deps({ boosts: true, ads: true, realtime: true }).deps,
      ),
    ).rejects.toThrow(/every DexScreener source failed/);
  });

  it("records each poll into history so the next round can see change", async () => {
    const history = new SnapshotHistory();
    await fetchPairUniverse(undefined, history, deps().deps);
    const later = { ...deps().deps, now: () => now() + 60_000 };
    await fetchPairUniverse(undefined, history, later);
    const key = "solana:46vv3zpfnlzn1cdrynavqpsdw5ejeyn9gk9kpczfpump";
    expect(history.get(key).map((s) => s.observedAt)).toEqual([now(), now() + 60_000]);
  });
});
