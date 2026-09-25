import type { DexPair } from "@/lib/providers/schemas";

/** Which DexScreener source(s) put this pair into the universe. */
export type UniverseSource = "boost-latest" | "boost-top" | "ad" | "realtime";

/** Fixed display/storage order so `sources` is deterministic. */
export const UNIVERSE_SOURCES: readonly UniverseSource[] = [
  "boost-latest",
  "boost-top",
  "ad",
  "realtime",
];

export type TxnWindow = { buys: number; sells: number };

/**
 * One observation of one pair, normalized from a provider response.
 *
 * Every field is either the provider's own value or `null` for "not reported".
 * Nothing is derived here; derivation lives in the signal functions so each
 * computed value can be traced back to the raw fields on this object.
 */
export type PairSnapshot = {
  /** `chainId:baseTokenAddress` (lowercase) — the same identity the feeds use. */
  key: string;
  chainId: string;
  dexId: string | null;
  pairAddress: string | null;
  url: string | null;
  baseSymbol: string | null;
  baseName: string | null;
  baseAddress: string;
  quoteSymbol: string | null;
  /** Every source that referenced this pair this round, in UNIVERSE_SOURCES order. */
  sources: UniverseSource[];

  /** Epoch ms when this response was received. */
  observedAt: number;
  /** Epoch ms of pool creation, as reported. */
  pairCreatedAt: number | null;

  priceUsd: number | null;
  liquidityUsd: number | null;
  fdv: number | null;
  marketCap: number | null;
  boostsActive: number | null;

  volume: { m5: number | null; h1: number | null; h6: number | null; h24: number | null };
  txns: {
    m5: TxnWindow | null;
    h1: TxnWindow | null;
    h6: TxnWindow | null;
    h24: TxnWindow | null;
  };
  priceChange: { m5: number | null; h1: number | null; h6: number | null; h24: number | null };
};

const num = (v: number | undefined | null): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const txn = (w: { buys?: number; sells?: number } | undefined): TxnWindow | null =>
  w && typeof w.buys === "number" && typeof w.sells === "number"
    ? { buys: w.buys, sells: w.sells }
    : null;

export function snapshotKey(chainId: string, baseAddress: string): string {
  return `${chainId.toLowerCase()}:${baseAddress.toLowerCase()}`;
}

export function toPairSnapshot(
  pair: DexPair,
  observedAt: number,
  sources: readonly UniverseSource[],
): PairSnapshot {
  const price = pair.priceUsd != null ? Number(pair.priceUsd) : NaN;
  return {
    key: snapshotKey(pair.chainId, pair.baseToken.address),
    chainId: pair.chainId,
    dexId: pair.dexId ?? null,
    pairAddress: pair.pairAddress ?? null,
    url: pair.url ?? null,
    baseSymbol: pair.baseToken.symbol ?? null,
    baseName: pair.baseToken.name ?? null,
    baseAddress: pair.baseToken.address,
    quoteSymbol: pair.quoteToken?.symbol ?? null,
    sources: UNIVERSE_SOURCES.filter((src) => sources.includes(src)),
    observedAt,
    pairCreatedAt: num(pair.pairCreatedAt),
    priceUsd: Number.isFinite(price) ? price : null,
    liquidityUsd: num(pair.liquidity?.usd),
    fdv: num(pair.fdv),
    marketCap: num(pair.marketCap),
    boostsActive: num(pair.boosts?.active),
    volume: {
      m5: num(pair.volume?.m5),
      h1: num(pair.volume?.h1),
      h6: num(pair.volume?.h6),
      h24: num(pair.volume?.h24),
    },
    txns: {
      m5: txn(pair.txns?.m5),
      h1: txn(pair.txns?.h1),
      h6: txn(pair.txns?.h6),
      h24: txn(pair.txns?.h24),
    },
    priceChange: {
      m5: num(pair.priceChange?.m5),
      h1: num(pair.priceChange?.h1),
      h6: num(pair.priceChange?.h6),
      h24: num(pair.priceChange?.h24),
    },
  };
}

/** Pair age in minutes at observation time, or null when the provider gave no creation time. */
export function pairAgeMinutes(
  s: Pick<PairSnapshot, "observedAt" | "pairCreatedAt">,
): number | null {
  if (s.pairCreatedAt == null) return null;
  return Math.max(0, (s.observedAt - s.pairCreatedAt) / 60_000);
}
