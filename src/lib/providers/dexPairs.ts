import { z } from "zod";
import { type DataEnvelope, ProviderError, liveEnvelope } from "./envelope";
import { fetchJson } from "./http";
import { DexPairSchema, type DexPair } from "./schemas";

export const DEXSCREENER_SOURCE = "dexscreener";
const API_BASE = "https://api.dexscreener.com";

/**
 * Canonical identity for the pairs the DEX Realtime panel shows.
 *
 * A crypto asset is identified by `chainId` + token ADDRESS. Symbols are
 * presentation metadata only: anyone can mint a token called "SOL" or "AERO".
 *
 * The previous implementation searched by symbol and kept the candidate with the
 * highest liquidity. Measured against the live provider, that resolved:
 *   - "SOL/USDC"  -> CkH8iAKJ… a spoofed SOL on Solana, $2.16B "liquidity" and
 *                   $15 of 24h volume, instead of real wrapped SOL.
 *   - "AERO/USDC" -> SPX/USDC on Solana. A different asset entirely.
 *   - "HYPE/USDC" -> a Solana pool. The real Hyperliquid market reports
 *                   liquidity of $0 because it is an orderbook, not an AMM, so
 *                   sorting by liquidity could never select it.
 *
 * Every address below was read back from the provider during discovery and is
 * re-validated on every single response.
 */
export type CanonicalPair = {
  /** Stable slot key. Also the label the UI renders. */
  key: string;
  chainId: string;
  pairAddress: string;
  baseAddress: string;
  quoteAddress: string;
  baseSymbol: string;
  quoteSymbol: string;
};

export const CANONICAL_PAIRS: readonly CanonicalPair[] = [
  {
    key: "SOL/USDC",
    chainId: "solana",
    pairAddress: "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE",
    baseAddress: "So11111111111111111111111111111111111111112",
    quoteAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    baseSymbol: "SOL",
    quoteSymbol: "USDC",
  },
  {
    key: "WETH/USDT",
    chainId: "ethereum",
    pairAddress: "0x11b815efB8f581194ae79006d24E0d814B7697F6",
    baseAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    quoteAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    baseSymbol: "WETH",
    quoteSymbol: "USDT",
  },
  {
    key: "HYPE/USDC",
    chainId: "hyperliquid",
    pairAddress: "0x13ba5fea7078ab3798fbce53b4d0721c",
    baseAddress: "0x0d01dc56dcaaca66ad901c959b4011ec",
    quoteAddress: "0x6d1e7cde53ba9467b783cb7c530ce054",
    baseSymbol: "HYPE",
    quoteSymbol: "USDC",
  },
  {
    key: "AERO/USDC",
    chainId: "base",
    pairAddress: "0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d",
    baseAddress: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    quoteAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    baseSymbol: "AERO",
    quoteSymbol: "USDC",
  },
] as const;

/** Per-slot resolution outcome. A row is only ever `resolved` on an identity match. */
export type RealtimeRow = {
  key: string;
  chainId: string;
  pairAddress: string;
  baseSymbol: string;
  quoteSymbol: string;
  /** True only when the provider returned this exact pair on this exact chain. */
  resolved: boolean;
  /** Why a row is unresolved — surfaced for observability, never as a value. */
  reason?: "provider_error" | "not_found" | "identity_mismatch" | "schema_mismatch";
  priceUsd: number | null;
  change24h: number | null;
  volume24h: number | null;
  liquidityUsd: number | null;
  /** Provider's own link for this pair. */
  url: string | null;
};

export type Deps = { fetchJson: typeof fetchJson; now: () => number };
const defaultDeps: Deps = { fetchJson, now: () => Date.now() };

const eq = (a: string | undefined, b: string) => (a ?? "").toLowerCase() === b.toLowerCase();

/**
 * `/latest/dex/pairs/{chainId}/{pairAddress}` wraps its result, unlike the
 * boosts/ads endpoints. Verified against the live API.
 */
const PairsEnvelopeSchema = z.object({ pairs: z.array(z.unknown()).nullable().optional() });

const num = (v: number | undefined | null): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * INVARIANT — NO_SILENT_PAIR_SUBSTITUTION
 *
 * A candidate is accepted only when chain, base address and quote address all
 * match the canonical entry. A mismatch is reported as unresolved; it is never
 * swapped for a different asset, no matter how much liquidity it carries.
 */
export function validateCandidate(want: CanonicalPair, got: DexPair): boolean {
  return (
    eq(got.chainId, want.chainId) &&
    eq(got.baseToken?.address, want.baseAddress) &&
    eq(got.quoteToken?.address, want.quoteAddress)
  );
}

function unresolved(want: CanonicalPair, reason: NonNullable<RealtimeRow["reason"]>): RealtimeRow {
  return {
    key: want.key,
    chainId: want.chainId,
    pairAddress: want.pairAddress,
    baseSymbol: want.baseSymbol,
    quoteSymbol: want.quoteSymbol,
    resolved: false,
    reason,
    priceUsd: null,
    change24h: null,
    volume24h: null,
    liquidityUsd: null,
    url: null,
  };
}

async function resolveOne(want: CanonicalPair, deps: Deps): Promise<RealtimeRow> {
  let raw: unknown;
  try {
    raw = await deps.fetchJson(
      DEXSCREENER_SOURCE,
      `${API_BASE}/latest/dex/pairs/${encodeURIComponent(want.chainId)}/${encodeURIComponent(want.pairAddress)}`,
    );
  } catch {
    return unresolved(want, "provider_error");
  }

  const env = PairsEnvelopeSchema.safeParse(raw);
  if (!env.success) return unresolved(want, "schema_mismatch");

  const candidates = env.data.pairs ?? [];
  for (const entry of candidates) {
    const parsed = DexPairSchema.safeParse(entry);
    if (!parsed.success) continue;
    const pair = parsed.data;
    if (!validateCandidate(want, pair)) continue;

    return {
      key: want.key,
      chainId: want.chainId,
      pairAddress: want.pairAddress,
      // Symbols come from the provider once identity is proven, so the row
      // shows what the chain actually calls the asset.
      baseSymbol: pair.baseToken?.symbol ?? want.baseSymbol,
      quoteSymbol: pair.quoteToken?.symbol ?? want.quoteSymbol,
      resolved: true,
      priceUsd:
        pair.priceUsd != null && Number.isFinite(Number(pair.priceUsd))
          ? Number(pair.priceUsd)
          : null,
      change24h: num(pair.priceChange?.h24),
      volume24h: num(pair.volume?.h24),
      liquidityUsd: num(pair.liquidity?.usd),
      url: pair.url ?? null,
    };
  }

  // The provider answered, but nothing it returned IS this pair.
  return unresolved(want, candidates.length === 0 ? "not_found" : "identity_mismatch");
}

/**
 * Resolve every canonical pair. Slots are independent: one failing pair never
 * removes a row and never borrows another pair's numbers.
 *
 * Envelope status: `live` when every slot resolved, `degraded` when some did,
 * and a thrown ProviderError when none did — so react-query can fall back to the
 * last real response and label it `stale`.
 */
export async function fetchRealtimePairs(
  deps: Deps = defaultDeps,
): Promise<DataEnvelope<RealtimeRow[]>> {
  const rows = await Promise.all(CANONICAL_PAIRS.map((p) => resolveOne(p, deps)));
  const resolved = rows.filter((r) => r.resolved).length;

  if (resolved === 0) {
    throw new ProviderError(
      DEXSCREENER_SOURCE,
      "HTTP_ERROR",
      "no canonical pair could be resolved",
    );
  }

  return liveEnvelope(DEXSCREENER_SOURCE, rows, deps.now(), rows.length - resolved);
}

/**
 * DexTools explorer URL for a canonical pair. DexTools publishes no free market
 * API, so this is a link only — the panel never renders market values sourced
 * from it.
 */
const DEXTOOLS_CHAIN: Record<string, string> = {
  solana: "solana",
  ethereum: "ether",
  base: "base",
  hyperliquid: "hyperliquid",
};

export function dexToolsUrl(p: Pick<CanonicalPair, "chainId" | "pairAddress">): string {
  const chain = DEXTOOLS_CHAIN[p.chainId] ?? p.chainId;
  return `https://www.dextools.io/app/en/${chain}/pair-explorer/${p.pairAddress}`;
}
