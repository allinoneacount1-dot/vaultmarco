import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type RealtimeInput, fetchPairUniverse } from "@/lib/providers/universe";
import { fetchAds, fetchTokenBoosts } from "@/lib/providers/dexscreener";
import { fetchRealtimePairs } from "@/lib/providers/dexPairs";
import { SnapshotHistory } from "@/lib/signals/history";

const fixture = (name: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8"));

const BOOSTS = fixture("dexscreener.boosts.latest.json") as Array<Record<string, unknown>>;
const ADS = fixture("dexscreener.ads.latest.json");
const TOKENS = fixture("dexscreener.tokens.solana.json");
const PAIRS = fixture("dexscreener.pairs.canonical.json") as Record<string, unknown>;

/**
 * TOP boosts: a distinct list so the test can tell the two boost sources apart.
 * First two recorded solana entries (both tokens exist in TOKENS), in reverse.
 */
const BOOSTS_TOP = BOOSTS.filter((b) => b.chainId === "solana")
  .slice(0, 2)
  .reverse();

const now = () => 1_700_000_000_000;

type Fail = {
  latest?: boolean;
  top?: boolean;
  ads?: boolean;
  realtime?: boolean;
  tokens?: boolean;
};

/** Counting fetch stub: routes each DexScreener endpoint to a fixture and records every URL. */
function deps(fail: Fail = {}) {
  const urls: string[] = [];
  return {
    urls,
    deps: {
      now,
      fetchJson: async (_source: string, url: string) => {
        urls.push(url);
        if (url.includes("/token-boosts/latest/")) {
          if (fail.latest) throw new Error("boosts latest down");
          return BOOSTS;
        }
        if (url.includes("/token-boosts/top/")) {
          if (fail.top) throw new Error("boosts top down");
          return BOOSTS_TOP;
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

/** The fast lane's payload, fetched once — exactly what the query cache hands the slow lane. */
async function realtimeFromFastLane(fail: Fail = {}): Promise<RealtimeInput> {
  try {
    const env = await fetchRealtimePairs(deps(fail).deps);
    return { ok: true, rows: env.data, observedAt: env.fetchedAt ?? 0 };
  } catch (error) {
    return { ok: false, error };
  }
}

const SOL = "solana:so11111111111111111111111111111111111111112";

describe("pair universe — composition", () => {
  it("is Boost LATEST ∪ Boost TOP ∪ Ads ∪ resolved canonical DEX Realtime, deduplicated", async () => {
    const rt = await realtimeFromFastLane();
    const u = await fetchPairUniverse(undefined, new SnapshotHistory(), rt, deps().deps);
    const keys = u.snapshots.map((s) => s.key);

    // No duplicates by stable identity.
    expect(new Set(keys).size).toBe(keys.length);

    // Every resolved canonical pair is in the universe, tagged `realtime`.
    const resolved = rt.ok ? rt.rows.filter((r) => r.resolved) : [];
    expect(resolved.length).toBeGreaterThan(0);
    for (const row of resolved) {
      const snap = u.snapshots.find(
        (s) => s.pairAddress?.toLowerCase() === row.pairAddress.toLowerCase(),
      );
      expect(snap?.sources).toContain("realtime");
    }
    expect(u.snapshots.find((s) => s.key === SOL)?.sources).toEqual(["realtime"]);

    // A token in both boost lists carries both sources, in fixed order.
    const topKeys = BOOSTS_TOP.map((b) =>
      `${String(b.chainId)}:${String(b.tokenAddress)}`.toLowerCase(),
    );
    const honse = u.snapshots.find((s) => s.baseSymbol === "honse");
    expect(topKeys).toContain(honse?.key);
    expect(honse?.sources.slice(0, 2)).toEqual(["boost-latest", "boost-top"]);

    expect(u.radar.universeSize).toBe(u.snapshots.length);
    expect(u.radarInputs.status).toBe("live");
  });

  it("snapshots DEX Realtime pairs from the fast-lane payload without re-requesting them", async () => {
    const rt = await realtimeFromFastLane();
    const slow = deps();
    const u = await fetchPairUniverse(undefined, new SnapshotHistory(), rt, slow.deps);
    expect(count(slow.urls, "/latest/dex/pairs/")).toBe(0);
    const sol = u.snapshots.find((s) => s.key === SOL);
    expect(sol).toMatchObject({
      chainId: "solana",
      pairAddress: "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE",
      observedAt: rt.ok ? rt.observedAt : -1,
      txns: { m5: { buys: 120, sells: 68 } },
      volume: { m5: 287415.85, h1: 1686315.7 },
    });
  });

  it("requests each distinct token once even when several lists reference it", async () => {
    const slow = deps();
    await fetchPairUniverse(
      undefined,
      new SnapshotHistory(),
      await realtimeFromFastLane(),
      slow.deps,
    );
    const requested = slow.urls
      .filter((u) => u.includes("/tokens/v1/"))
      .flatMap((u) => u.split("/tokens/v1/")[1].split("/")[1].split(","))
      .map((a) => a.toLowerCase());
    expect(new Set(requested).size).toBe(requested.length);
  });

  it("keeps the Boost Feed on LATEST only; TOP widens the radar, not the feed", async () => {
    const u = await fetchPairUniverse(
      undefined,
      new SnapshotHistory(),
      await realtimeFromFastLane(),
      deps().deps,
    );
    const standalone = await fetchTokenBoosts("latest", deps().deps);
    expect(u.boosts?.data).toEqual(standalone.data);
    expect(u.ads?.data).toEqual((await fetchAds(deps().deps)).data);
  });
});

describe("pair universe — request count", () => {
  it("per 60 s round: slow lane + one fast-lane fetch ≤ the three standalone feeds", async () => {
    const separate = deps();
    await fetchTokenBoosts("latest", separate.deps);
    await fetchAds(separate.deps);
    await fetchRealtimePairs(separate.deps);

    const fast = deps();
    const env = await fetchRealtimePairs(fast.deps);
    const slow = deps();
    await fetchPairUniverse(
      undefined,
      new SnapshotHistory(),
      { ok: true, rows: env.data, observedAt: env.fetchedAt ?? 0 },
      slow.deps,
    );

    const shared = [...fast.urls, ...slow.urls];
    expect(count(shared, "/latest/dex/pairs/")).toBe(count(separate.urls, "/latest/dex/pairs/"));
    expect(count(shared, "/token-boosts/")).toBe(2); // latest + top
    expect(count(shared, "/tokens/v1/")).toBeLessThan(count(separate.urls, "/tokens/v1/"));
    expect(shared.length).toBeLessThanOrEqual(separate.urls.length);
  });
});

describe("pair universe — radar status", () => {
  it("LIVE when every source and enrichment batch succeeded", async () => {
    const u = await fetchPairUniverse(
      undefined,
      new SnapshotHistory(),
      await realtimeFromFastLane(),
      deps().deps,
    );
    expect(u.radarInputs).toMatchObject({
      status: "live",
      sources: { boostLatest: "ok", boostTop: "ok", ads: "ok", realtime: "ok" },
      issues: [],
    });
  });

  it("DEGRADED — not offline — when the boost list fails but other inputs produced snapshots", async () => {
    const u = await fetchPairUniverse(
      undefined,
      new SnapshotHistory(),
      await realtimeFromFastLane(),
      deps({ latest: true }).deps,
    );
    expect(u.boosts).toBeNull(); // the Boost Feed itself is offline…
    expect(u.snapshots.length).toBeGreaterThan(0); // …but the radar still has input
    expect(u.radarInputs.status).toBe("degraded");
    expect(u.radarInputs.issues).toEqual(["BOOSTS LATEST unavailable"]);
  });

  it("total enrichment failure with realtime still up is DEGRADED and names the lookup failure", async () => {
    const u = await fetchPairUniverse(
      undefined,
      new SnapshotHistory(),
      await realtimeFromFastLane(),
      deps({ tokens: true }).deps,
    );
    expect(u.snapshots.every((s) => s.sources.includes("realtime"))).toBe(true);
    expect(u.radarInputs.status).toBe("degraded");
    expect(u.radarInputs.enrichment.failedBatches).toBe(u.radarInputs.enrichment.batches);
    expect(u.radarInputs.issues).toContain(
      `Token lookup failed for all ${u.radarInputs.enrichment.requested} listed tokens`,
    );
  });

  it("total enrichment failure with no other input is OFFLINE, never an empty universe", async () => {
    const u = await fetchPairUniverse(
      undefined,
      new SnapshotHistory(),
      { ok: false, error: new Error("pairs down") },
      deps({ tokens: true }).deps,
    );
    expect(u.snapshots).toEqual([]);
    expect(u.radarInputs.status).toBe("offline");
    expect(u.radarInputs.enrichment.requested).toBeGreaterThan(0);
    expect(u.radarInputs.issues).toEqual([
      "DEX REALTIME unavailable",
      `Token lookup failed for all ${u.radarInputs.enrichment.requested} listed tokens`,
    ]);
  });

  it("STALE with the previous radar when a later round has no usable input", async () => {
    const history = new SnapshotHistory();
    const first = await fetchPairUniverse(
      undefined,
      history,
      await realtimeFromFastLane(),
      deps().deps,
    );
    const second = await fetchPairUniverse(
      first,
      history,
      { ok: false, error: new Error("pairs down") },
      deps({ tokens: true }).deps,
    );
    expect(second.radarInputs.status).toBe("stale");
    expect(second.snapshots).toEqual(first.snapshots);
    expect(second.radar).toEqual(first.radar);
  });

  it("an empty universe is only reported when every input succeeded", async () => {
    const empty = {
      now,
      fetchJson: async (_s: string, url: string) =>
        url.includes("/latest/dex/pairs/") ? { pairs: [] } : [],
    };
    const u = await fetchPairUniverse(
      undefined,
      new SnapshotHistory(),
      { ok: true, rows: [], observedAt: now() },
      empty,
    );
    expect(u.snapshots).toEqual([]);
    expect(u.radarInputs.status).toBe("live");
  });
});

describe("pair universe — feed semantics", () => {
  it("keeps a failing list stale from its last real payload while the others stay live", async () => {
    const history = new SnapshotHistory();
    const rt = await realtimeFromFastLane();
    const first = await fetchPairUniverse(undefined, history, rt, deps().deps);
    const second = await fetchPairUniverse(first, history, rt, deps({ ads: true }).deps);
    expect(second.boosts?.status).toBe("live");
    expect(second.ads?.status).toBe("stale");
    expect(second.ads?.data).toEqual(first.ads?.data);
  });

  it("throws only when every input failed, so the previous round is kept", async () => {
    await expect(
      fetchPairUniverse(
        undefined,
        new SnapshotHistory(),
        { ok: false, error: new Error("pairs down") },
        deps({ latest: true, top: true, ads: true }).deps,
      ),
    ).rejects.toThrow(/every DexScreener source failed/);
  });

  it("records each round into history so the next round can see change", async () => {
    const history = new SnapshotHistory();
    const rt = await realtimeFromFastLane();
    await fetchPairUniverse(undefined, history, rt, deps().deps);
    await fetchPairUniverse(undefined, history, rt, { ...deps().deps, now: () => now() + 60_000 });
    const key = "solana:46vv3zpfnlzn1cdrynavqpsdw5ejeyn9gk9kpczfpump";
    expect(history.get(key).map((s) => s.observedAt)).toEqual([now(), now() + 60_000]);
  });
});
