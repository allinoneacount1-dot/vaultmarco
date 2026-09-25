import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fetchRealtimePairs } from "@/lib/providers/dexPairs";
import { type PairUniverse, fetchPairUniverse } from "@/lib/providers/universe";
import { SnapshotHistory } from "@/lib/signals/history";
import {
  dexScreenerUrl,
  explorerUrl,
  refFromAd,
  refFromBoost,
  refFromRealtime,
  refFromSnapshot,
  resolveDrawerModel,
} from "@/lib/tokenDrawer";

const fixture = (name: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8"));

const BOOSTS = fixture("dexscreener.boosts.latest.json");
const ADS = fixture("dexscreener.ads.latest.json") as Array<Record<string, unknown>>;
const TOKENS = fixture("dexscreener.tokens.solana.json");
const PAIRS = fixture("dexscreener.pairs.canonical.json") as Record<string, unknown>;

/** Recorded Solana address with mixed case — the case must survive every path. */
const HONSE = "46vV3ZpFNLZn1CDRYnAvqPsdW5ejEYn9GK9kPcZFpump";
const WSOL = "So11111111111111111111111111111111111111112";

const now = () => 1_700_000_000_000;
function deps(fail: { tokens?: boolean } = {}, clock = now) {
  return {
    now: clock,
    fetchJson: async (_s: string, url: string) => {
      if (url.includes("/token-boosts/")) return BOOSTS;
      if (url.includes("/ads/")) return ADS;
      if (url.includes("/tokens/v1/")) {
        if (fail.tokens) throw new Error("tokens down");
        return url.includes("/solana/") ? TOKENS : [];
      }
      if (url.includes("/latest/dex/pairs/")) {
        const chain = url.split("/latest/dex/pairs/")[1].split("/")[0];
        return PAIRS[chain] ?? { pairs: [] };
      }
      throw new Error(`unexpected ${url}`);
    },
  };
}

async function round(
  history: SnapshotHistory,
  fail: { tokens?: boolean } = {},
  previous?: PairUniverse,
  clock = now,
) {
  const rt = await fetchRealtimePairs(deps({}, clock));
  return fetchPairUniverse(
    previous,
    history,
    { ok: true, rows: rt.data, observedAt: rt.fetchedAt ?? clock() },
    deps(fail, clock),
  );
}

describe("stable identity from all four entry points", () => {
  it("Radar, Boost, Ads and DEX Realtime resolve the same token to the same key", async () => {
    const u = await round(new SnapshotHistory());
    const honseSnap = u.snapshots.find((s) => s.baseAddress === HONSE)!;
    const boost = u.boosts!.data.find((b) => b.tokenAddress === HONSE)!;
    const fromRadar = refFromSnapshot(honseSnap);
    const fromBoost = refFromBoost(boost);
    expect(fromBoost.key).toBe(fromRadar.key);

    // An ad for the same token (the recorded ads are for other tokens, so re-point one).
    const ad = { ...u.ads!.data[0], chainId: "solana", tokenAddress: HONSE };
    expect(refFromAd(ad).key).toBe(fromRadar.key);

    // DEX Realtime: canonical SOL/USDC ↔ its radar snapshot.
    const solRow = (await fetchRealtimePairs(deps())).data.find((r) => r.key === "SOL/USDC")!;
    const solSnap = u.snapshots.find((s) => s.baseAddress === WSOL)!;
    expect(refFromRealtime(solRow).key).toBe(refFromSnapshot(solSnap).key);
  });

  it("uses the lowercase key only for lookup; every ref keeps the provider's original address", async () => {
    const u = await round(new SnapshotHistory());
    const snap = u.snapshots.find((s) => s.baseAddress === HONSE)!;
    const boost = u.boosts!.data.find((b) => b.tokenAddress === HONSE)!;
    for (const ref of [refFromSnapshot(snap), refFromBoost(boost)]) {
      expect(ref.key).toBe(ref.key.toLowerCase());
      expect(ref.address).toBe(HONSE); // mixed case preserved
      expect(ref.address).not.toBe(ref.key.split(":")[1]);
    }
    const solRow = (await fetchRealtimePairs(deps())).data.find((r) => r.key === "SOL/USDC")!;
    expect(refFromRealtime(solRow).address).toBe(WSOL);
  });

  it("a DEX Realtime row keeps its canonical identity even when it did not resolve", async () => {
    const rows = (await fetchRealtimePairs(deps())).data;
    const unresolved = { ...rows[0], resolved: false, pair: undefined, url: null };
    expect(refFromRealtime(unresolved).address).toBe(WSOL);
  });
});

describe("drawer model — current / retained / identity", () => {
  it("CURRENT while the pair is in the universe, carrying the radar's aggregate status", async () => {
    const h = new SnapshotHistory();
    const u = await round(h);
    const ref = refFromSnapshot(u.snapshots.find((s) => s.baseAddress === HONSE)!);
    const live = resolveDrawerModel(ref, u, u.radarInputs.status, h);
    expect(live).toMatchObject({ kind: "current", status: "live" });
    // A stale round must never read LIVE.
    expect(resolveDrawerModel(ref, u, "stale", h)).toMatchObject({
      kind: "current",
      status: "stale",
    });
    if (live.kind !== "current") return;
    expect(live.intel).toBe(u.intelligence[ref.key]);
    expect(live.sources.map((s) => s.source)).toContain("boost-latest");
    const boostDetail = live.sources.find((s) => s.source === "boost-latest")?.detail;
    expect(boostDetail).toMatch(/^\+\d+ · total \d+$/);
  });

  it("RETAINED after the pair leaves the universe, from real history, with no current signal", async () => {
    const h = new SnapshotHistory();
    const first = await round(h);
    const ref = refFromSnapshot(first.snapshots.find((s) => s.baseAddress === HONSE)!);
    // Next round: token lookup fails, so HONSE is not in the current universe.
    const later = () => now() + 60_000;
    const second = await round(h, { tokens: true }, first, later);
    expect(second.intelligence[ref.key]).toBeUndefined();
    const m = resolveDrawerModel(ref, second, second.radarInputs.status, h);
    expect(m.kind).toBe("retained");
    if (m.kind !== "retained") return;
    expect(m.intel.snapshot.observedAt).toBe(now());
    expect(m.intel.momentum).toBeNull();
    expect(m.intel.risk).toBeNull();
  });

  it("IDENTITY-only once retained history has expired — no market field is invented", async () => {
    const h = new SnapshotHistory(60);
    const first = await round(h);
    const ref = refFromSnapshot(first.snapshots.find((s) => s.baseAddress === HONSE)!);
    // 61 minutes later, with the lookup still failing, the retained snapshot is pruned.
    const much = () => now() + 61 * 60_000;
    const later = await round(h, { tokens: true }, first, much);
    const m = resolveDrawerModel(ref, later, later.radarInputs.status, h);
    expect(m).toEqual({ kind: "identity", ref });
  });

  it("IDENTITY-only for a feed row whose token was never observed", () => {
    const h = new SnapshotHistory();
    const ref = refFromBoost({
      id: "x",
      chainId: "solana",
      tokenAddress: "AbCdEf123",
      chain: "sol",
      symbol: "AbCdE…f123",
      name: "",
      enriched: false,
      dex: "",
      price: null,
      change24h: null,
      volume24h: null,
      boostAmount: 10,
      boostTotal: 10,
      boostTier: "Low Boost",
      url: "https://dexscreener.com/solana/AbCdEf123",
    });
    expect(ref.symbol).toBeNull(); // an address truncation is not a symbol
    expect(resolveDrawerModel(ref, undefined, "offline", h)).toEqual({ kind: "identity", ref });
  });
});

describe("links — built from original values only", () => {
  it("explorer per known chain, none for unknown chains", () => {
    expect(explorerUrl("solana", HONSE)).toBe(`https://solscan.io/token/${HONSE}`);
    expect(explorerUrl("ethereum", "0xAbC")).toBe("https://etherscan.io/token/0xAbC");
    expect(explorerUrl("base", "0xAbC")).toBe("https://basescan.org/token/0xAbC");
    expect(explorerUrl("bsc", "0xAbC")).toBe("https://bscscan.com/token/0xAbC");
    expect(explorerUrl("robinhood", "0xAbC")).toBeNull();
    expect(explorerUrl("hyperliquid", "0xAbC")).toBeNull();
  });

  it("DexScreener: snapshot's provider URL, else the row's provider URL, else built from original case", async () => {
    const u = await round(new SnapshotHistory());
    const snap = u.snapshots.find((s) => s.baseAddress === HONSE)!;
    const ref = refFromSnapshot(snap);
    expect(dexScreenerUrl(ref, snap)).toBe(snap.url);
    const bare = { ...ref, url: null };
    expect(dexScreenerUrl(bare, null)).toBe(`https://dexscreener.com/solana/${HONSE}`);
    expect(dexScreenerUrl({ ...ref, url: "https://evil.example/x" }, null)).toBe(
      `https://dexscreener.com/solana/${HONSE}`,
    );
  });
});

describe("universe carries intelligence", () => {
  it("has one intelligence entry per snapshot; a stale round keeps the previous entries", async () => {
    const h = new SnapshotHistory();
    const u = await round(h);
    expect(Object.keys(u.intelligence).sort()).toEqual(u.snapshots.map((s) => s.key).sort());
    const stale = await fetchPairUniverse(
      u,
      h,
      { ok: false, error: new Error("down") },
      deps({ tokens: true }),
    );
    expect(stale.radarInputs.status).toBe("stale");
    expect(stale.intelligence).toBe(u.intelligence);
  });
});
