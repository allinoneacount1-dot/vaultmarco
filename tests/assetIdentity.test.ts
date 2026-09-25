import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  assetKey,
  canonicalAddressForKey,
  isEvmHexAddress,
  sameAddress,
} from "@/lib/assetIdentity";
import { enrichTokensDetailed, tokenKey } from "@/lib/providers/dexscreener";
import { CANONICAL_PAIRS, fetchRealtimePairs, validateCandidate } from "@/lib/providers/dexPairs";
import { DexPairSchema } from "@/lib/providers/schemas";
import { fetchPairUniverse } from "@/lib/providers/universe";
import { SnapshotHistory } from "@/lib/signals/history";
import { snapshotKey, toPairSnapshot } from "@/lib/signals/pairSnapshot";
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
const ADS = fixture("dexscreener.ads.latest.json");
const TOKENS = fixture("dexscreener.tokens.solana.json");
const PAIRS = fixture("dexscreener.pairs.canonical.json") as Record<string, unknown>;

/** Recorded Solana (Base58) address and a case-flipped sibling: two different addresses. */
const HONSE = "46vV3ZpFNLZn1CDRYnAvqPsdW5ejEYn9GK9kPcZFpump";
const HONSE_FLIPPED = "46Vv3zPfnlzN1cdrYNaVQpSDw5EJeyN9gk9KpCzfPUMP";
const EVM_CHECKSUM = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const EVM_LOWER = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

const now = () => 1_700_000_000_000;

describe("canonical asset identity", () => {
  it("1. Solana/Base58 addresses that differ only by case produce DIFFERENT keys", () => {
    expect(HONSE.toLowerCase()).toBe(HONSE_FLIPPED.toLowerCase()); // the old rule collapsed them
    expect(assetKey("solana", HONSE)).not.toBe(assetKey("solana", HONSE_FLIPPED));
    expect(assetKey("solana", HONSE)).toBe(`solana:${HONSE}`); // exact bytes
    expect(canonicalAddressForKey(HONSE)).toBe(HONSE);
    expect(sameAddress(HONSE, HONSE_FLIPPED)).toBe(false);
    expect(isEvmHexAddress(HONSE)).toBe(false);
  });

  it("2. EVM hex addresses that differ only by case produce the SAME key", () => {
    expect(assetKey("ethereum", EVM_CHECKSUM)).toBe(assetKey("ethereum", EVM_LOWER));
    expect(assetKey("ethereum", EVM_CHECKSUM)).toBe(`ethereum:${EVM_LOWER}`);
    expect(sameAddress(EVM_CHECKSUM, EVM_LOWER)).toBe(true);
    // Syntax, not chain name, decides: a hex address is case-insensitive on any chain
    // (e.g. the Hyperliquid canonical ids), a non-hex address is exact on any chain.
    expect(assetKey("hyperliquid", "0x0D01DC56DCAACA66AD901C959B4011EC")).toBe(
      "hyperliquid:0x0d01dc56dcaaca66ad901c959b4011ec",
    );
    expect(assetKey("base", HONSE)).toBe(`base:${HONSE}`);
  });

  it("chain slugs are case-insensitive", () => {
    expect(assetKey("Solana", HONSE)).toBe(assetKey("solana", HONSE));
  });

  it("every legacy helper delegates to assetKey — one rule, no second normalisation", () => {
    for (const [chain, addr] of [
      ["solana", HONSE],
      ["solana", HONSE_FLIPPED],
      ["ethereum", EVM_CHECKSUM],
      ["base", EVM_LOWER],
    ] as const) {
      expect(tokenKey(chain, addr)).toBe(assetKey(chain, addr));
      expect(snapshotKey(chain, addr)).toBe(assetKey(chain, addr));
    }
  });
});

describe("5. enrichment dedupe follows the identity rule", () => {
  function counting() {
    const urls: string[] = [];
    return {
      urls,
      deps: {
        now,
        fetchJson: async (_s: string, url: string) => {
          urls.push(url);
          return [];
        },
      },
    };
  }
  const requested = (urls: string[]) =>
    urls.flatMap((u) => u.split("/tokens/v1/")[1].split("/")[1].split(","));

  it("keeps case-distinct Solana addresses as two requested identities", async () => {
    const c = counting();
    const r = await enrichTokensDetailed(
      [
        { chainId: "solana", tokenAddress: HONSE },
        { chainId: "solana", tokenAddress: HONSE_FLIPPED },
      ],
      c.deps,
    );
    expect(r.requested).toBe(2);
    expect(requested(c.urls).sort()).toEqual([HONSE, HONSE_FLIPPED].sort());
  });

  it("collapses EVM case variants into one requested identity, and exact duplicates too", async () => {
    const c = counting();
    const r = await enrichTokensDetailed(
      [
        { chainId: "ethereum", tokenAddress: EVM_CHECKSUM },
        { chainId: "ethereum", tokenAddress: EVM_LOWER },
        { chainId: "solana", tokenAddress: HONSE },
        { chainId: "solana", tokenAddress: HONSE },
      ],
      c.deps,
    );
    expect(r.requested).toBe(2);
    expect(c.urls).toHaveLength(2); // one batch per chain — no extra requests
    expect(requested(c.urls)).toEqual([EVM_CHECKSUM, HONSE]); // first-seen original kept
  });
});

describe("canonical DEX Realtime validation follows the identity rule", () => {
  const solPair = () =>
    DexPairSchema.parse(
      (PAIRS.solana as { pairs: unknown[] }).pairs.find(
        (p) => (p as { pairAddress: string }).pairAddress === CANONICAL_PAIRS[0].pairAddress,
      ),
    );

  it("rejects a case-altered Solana base address (a different asset)", () => {
    const want = CANONICAL_PAIRS[0];
    expect(validateCandidate(want, solPair())).toBe(true);
    const spoof = {
      ...solPair(),
      baseToken: { ...solPair().baseToken, address: want.baseAddress.toLowerCase() },
    };
    expect(validateCandidate(want, spoof)).toBe(false);
  });

  it("accepts an EVM canonical pair whatever case the provider returns", () => {
    const want = CANONICAL_PAIRS.find((p) => p.chainId === "ethereum")!;
    const pair = {
      chainId: "ethereum",
      baseToken: { address: want.baseAddress.toLowerCase() },
      quoteToken: { address: want.quoteAddress.toUpperCase().replace("0X", "0x") },
    };
    expect(validateCandidate(want, pair)).toBe(true);
  });
});

describe("3 + 4. cross-subsystem identity, original address everywhere", () => {
  // After the recorded pair's creation time, so the radar's age gate can pass.
  const later = () => 1_790_380_800_000;
  const deps = {
    now: later,
    fetchJson: async (_s: string, url: string) => {
      if (url.includes("/token-boosts/")) return BOOSTS;
      if (url.includes("/ads/")) return ADS;
      if (url.includes("/tokens/v1/")) return url.includes("/solana/") ? TOKENS : [];
      if (url.includes("/latest/dex/pairs/")) {
        const chain = url.split("/latest/dex/pairs/")[1].split("/")[0];
        return PAIRS[chain] ?? { pairs: [] };
      }
      throw new Error(url);
    },
  };

  it("Boost, Ads, PairSnapshot, Radar, history, intelligence and Drawer share ONE key for honse", async () => {
    const TOKENS_SIGNAL = JSON.parse(JSON.stringify(TOKENS));
    TOKENS_SIGNAL[0].txns.m5 = { buys: 30, sells: 10 }; // make the radar fire on honse
    const signalDeps = {
      ...deps,
      fetchJson: async (s: string, url: string) =>
        url.includes("/tokens/v1/solana/") ? TOKENS_SIGNAL : deps.fetchJson(s, url),
    };
    const rt = await fetchRealtimePairs(deps);
    const history = new SnapshotHistory();
    const u = await fetchPairUniverse(
      undefined,
      history,
      { ok: true, rows: rt.data, observedAt: later() },
      signalDeps,
    );
    const KEY = `solana:${HONSE}`;

    const boost = u.boosts!.data.find((b) => b.tokenAddress === HONSE)!;
    const ad = { ...u.ads!.data[0], chainId: "solana", tokenAddress: HONSE };
    const snap = u.snapshots.find((s) => s.baseAddress === HONSE)!;

    expect(boost.id).toBe(KEY); // Boost feed record
    expect(refFromBoost(boost).key).toBe(KEY); // Boost → Drawer
    expect(refFromAd(ad).key).toBe(KEY); // Ads → Drawer
    expect(snap.key).toBe(KEY); // PairSnapshot
    expect(u.radar.momentum.map((m) => m.key)).toContain(KEY); // Radar
    expect(history.get(KEY)).toHaveLength(1); // SnapshotHistory
    expect(u.intelligence[KEY]?.snapshot).toBe(snap); // PairIntelligence
    const model = resolveDrawerModel(refFromSnapshot(snap), u, "live", history); // Token Drawer
    expect(model.kind).toBe("current");

    // The lowercase form is a different identity now — it resolves to nothing.
    expect(u.intelligence[KEY.toLowerCase()]).toBeUndefined();
    expect(history.get(KEY.toLowerCase())).toHaveLength(0);

    // Original address for display / copy / links.
    const ref = refFromBoost(boost);
    expect(ref.address).toBe(HONSE);
    expect(explorerUrl(ref.chainId, ref.address)).toBe(`https://solscan.io/token/${HONSE}`);
    expect(dexScreenerUrl({ ...ref, url: null }, null)).toBe(
      `https://dexscreener.com/solana/${HONSE}`,
    );
  });

  it("DEX Realtime canonical SOL resolves to the same key as its PairSnapshot", async () => {
    const rt = await fetchRealtimePairs(deps);
    const row = rt.data.find((r) => r.key === "SOL/USDC")!;
    const snap = toPairSnapshot(row.pair!, now(), ["realtime"]);
    expect(refFromRealtime(row).key).toBe(snap.key);
    expect(snap.key).toBe("solana:So11111111111111111111111111111111111111112");
    expect(refFromRealtime(row).address).toBe("So11111111111111111111111111111111111111112");
  });
});
