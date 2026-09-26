import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fetchRealtimePairs } from "@/lib/providers/dexPairs";
import { type RealtimeInput, fetchPairUniverse } from "@/lib/providers/universe";
import type { DexPair } from "@/lib/providers/schemas";
import { SnapshotHistory } from "@/lib/signals/history";
import { type PairSnapshot, toPairSnapshot } from "@/lib/signals/pairSnapshot";
import type { AssetObservation, IngestBatch } from "@/lib/intelligence/facts";
import { observationFromSnapshot } from "@/lib/intelligence/ingest";
import type { Lane } from "@/lib/intelligence/rules";

/**
 * Test inputs built ONLY from the real captured provider responses in
 * tests/fixtures (the shapes the providers actually return). Variations
 * override individual provider fields on top of a real payload.
 */
const fixture = (name: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8"));

export const PAIRS = fixture("dexscreener.pairs.canonical.json") as Record<
  string,
  { pairs: DexPair[] }
>;
export const TOKENS = fixture("dexscreener.tokens.solana.json") as DexPair[];
export const BOOSTS = fixture("dexscreener.boosts.latest.json") as Array<Record<string, unknown>>;
export const ADS = fixture("dexscreener.ads.latest.json") as unknown[];

/** Real canonical pair payloads. */
export const SOL_PAIR = PAIRS.solana.pairs[0];
export const WETH_PAIR = PAIRS.ethereum.pairs[0];
export const HYPE_PAIR = PAIRS.hyperliquid.pairs[0];
export const AERO_PAIR = PAIRS.base.pairs[0];
/** Real enriched /tokens/v1 payloads (carry boosts.active). */
export const TOKEN_A = TOKENS[0];
export const TOKEN_B = TOKENS[1];

export const SOL_KEY = "solana:So11111111111111111111111111111111111111112";
export const WETH_KEY = "ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

/** Session start used by the tests; observations are after it. */
export const START = 1_788_000_000_000;
export const T0 = START + 60_000;
export const SEC = 1_000;
export const MIN = 60_000;

type Over = Partial<Omit<PairSnapshot, "volume" | "txns" | "priceChange">> & {
  volume?: Partial<PairSnapshot["volume"]>;
  txns?: Partial<PairSnapshot["txns"]>;
  priceChange?: Partial<PairSnapshot["priceChange"]>;
};

/** One observation of a real pair payload at `at`, with provider-field overrides. */
export function obs(
  pair: DexPair,
  at: number,
  over: Over = {},
  lane: Lane = "realtime",
  status: AssetObservation["providerStatus"] = "live",
): AssetObservation {
  const base = toPairSnapshot(pair, at, lane === "realtime" ? ["realtime"] : ["boost-latest"]);
  const snap: PairSnapshot = {
    ...base,
    ...over,
    observedAt: at,
    volume: { ...base.volume, ...over.volume },
    txns: { ...base.txns, ...over.txns },
    priceChange: { ...base.priceChange, ...over.priceChange },
  };
  return observationFromSnapshot(snap, lane, status);
}

export function batch(
  lane: Lane,
  at: number,
  observations: AssetObservation[],
  extra: Partial<IngestBatch> = {},
): IngestBatch {
  return { lane, at, state: "ok", issues: [], observations, ...extra };
}

/** Fixture-backed fetch stub for the provider modules. */
export function deps(at: number, fail: { realtime?: string[]; all?: boolean } = {}) {
  const urls: string[] = [];
  return {
    urls,
    deps: {
      now: () => at,
      fetchJson: async (_s: string, url: string) => {
        urls.push(url);
        if (fail.all) throw new Error("down");
        if (url.includes("/token-boosts/")) return BOOSTS;
        if (url.includes("/ads/")) return ADS;
        if (url.includes("/tokens/v1/")) return url.includes("/solana/") ? TOKENS : [];
        if (url.includes("/latest/dex/pairs/")) {
          const chain = url.split("/latest/dex/pairs/")[1].split("/")[0];
          if (fail.realtime?.includes(chain)) throw new Error(`${chain} down`);
          return PAIRS[chain] ?? { pairs: [] };
        }
        throw new Error(`unexpected ${url}`);
      },
    },
  };
}

export async function realEnvelope(at: number, failChains: string[] = []) {
  return fetchRealtimePairs(deps(at, { realtime: failChains }).deps);
}

export async function realUniverse(at: number, rtAt: number, history = new SnapshotHistory()) {
  const env = await realEnvelope(rtAt);
  const rt: RealtimeInput = { ok: true, rows: env.data, observedAt: env.fetchedAt ?? 0 };
  return fetchPairUniverse(undefined, history, rt, deps(at).deps);
}
