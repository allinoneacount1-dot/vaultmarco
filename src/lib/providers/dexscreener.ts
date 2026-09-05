import type { AdToken, AdType, BoostTier, BoostToken } from "@/components/marco/shared/types";
import { type DataEnvelope, ProviderError, liveEnvelope } from "./envelope";
import { fetchJson } from "./http";
import {
  DexAdItemSchema,
  DexBoostItemSchema,
  DexPairSchema,
  type DexPair,
  parseItems,
} from "./schemas";

export const DEXSCREENER_SOURCE = "dexscreener";
const API_BASE = "https://api.dexscreener.com";

/** DexScreener accepts at most 30 addresses per /tokens/v1 request. */
const ENRICH_BATCH_SIZE = 30;
/**
 * How many records we enrich with symbol/price data. The feeds render the top
 * few entries; enriching the highest-boosted slice keeps request count low
 * while guaranteeing every rendered row has real, provider-sourced identity.
 */
const ENRICH_LIMIT = 12;

export type Deps = { fetchJson: typeof fetchJson; now: () => number };

const defaultDeps: Deps = { fetchJson, now: () => Date.now() };

const CHAIN_ID_MAP: Record<string, string> = {
  solana: "sol",
  ethereum: "eth",
  base: "base",
  "binance-smart-chain": "bnb",
  bsc: "bnb",
};

export function normalizeChain(chain: string): string {
  return CHAIN_ID_MAP[chain.toLowerCase()] ?? chain.toLowerCase();
}

/** Stable identity for a crypto asset: chain + address, never symbol. */
export function tokenKey(chainId: string, tokenAddress: string): string {
  return `${chainId.toLowerCase()}:${tokenAddress.toLowerCase()}`;
}

/**
 * A boost tier is a presentation bucket computed from the provider's real
 * `totalAmount` field. It is a derivation of real data, not invented data —
 * the previous implementation read a `tier` field that does not exist.
 */
export function boostTierFor(totalAmount: number): BoostTier {
  if (totalAmount >= 1000) return "Whale Boost";
  if (totalAmount >= 500) return "High Boost";
  if (totalAmount >= 100) return "Mid Boost";
  return "Low Boost";
}

/** DexScreener ad `type` values, mapped onto the existing display categories. */
function adTypeFor(providerType: string): AdType {
  switch (providerType) {
    case "trendingBarAd":
      return "Trending";
    case "profileAd":
      return "Profile";
    case "communityTakeover":
      return "Takeover";
    default:
      return "Ad";
  }
}

/**
 * Short, honest label for a token we could not enrich. This is a truncation of
 * the real on-chain address — never a guessed or placeholder ticker.
 */
export function addressLabel(tokenAddress: string): string {
  if (tokenAddress.length <= 11) return tokenAddress;
  return `${tokenAddress.slice(0, 5)}…${tokenAddress.slice(-4)}`;
}

/**
 * Fetch pair data for the given (chainId, address) pairs and index it by
 * `tokenKey`. Enrichment is best-effort: a failing chain batch leaves those
 * records unenriched rather than failing the whole feed, and never substitutes
 * invented values.
 */
export async function enrichTokens(
  refs: Array<{ chainId: string; tokenAddress: string }>,
  deps: Deps = defaultDeps,
): Promise<Map<string, DexPair>> {
  const byChain = new Map<string, string[]>();
  for (const ref of refs) {
    const list = byChain.get(ref.chainId) ?? [];
    if (!list.includes(ref.tokenAddress)) list.push(ref.tokenAddress);
    byChain.set(ref.chainId, list);
  }

  const index = new Map<string, DexPair>();

  const batches: Array<{ chainId: string; addresses: string[] }> = [];
  for (const [chainId, addresses] of byChain) {
    for (let i = 0; i < addresses.length; i += ENRICH_BATCH_SIZE) {
      batches.push({ chainId, addresses: addresses.slice(i, i + ENRICH_BATCH_SIZE) });
    }
  }

  const results = await Promise.allSettled(
    batches.map(async ({ chainId, addresses }) => {
      const raw = await deps.fetchJson(
        DEXSCREENER_SOURCE,
        `${API_BASE}/tokens/v1/${encodeURIComponent(chainId)}/${addresses.map(encodeURIComponent).join(",")}`,
      );
      return parseItems(DEXSCREENER_SOURCE, raw, DexPairSchema).items;
    }),
  );

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const pair of result.value) {
      const key = tokenKey(pair.chainId, pair.baseToken.address);
      const existing = index.get(key);
      // Keep the deepest pool for a token, so price/volume come from the
      // venue that actually carries the market.
      const liq = pair.liquidity?.usd ?? 0;
      const existingLiq = existing?.liquidity?.usd ?? -1;
      if (!existing || liq > existingLiq) index.set(key, pair);
    }
  }

  return index;
}

function numberOrNull(value: number | undefined | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function priceOrNull(priceUsd: string | undefined): number | null {
  if (typeof priceUsd !== "string") return null;
  const n = Number(priceUsd);
  return Number.isFinite(n) ? n : null;
}

/* ------------------------------------------------------------------ *
 * Token boosts
 * ------------------------------------------------------------------ */
export async function fetchTokenBoosts(
  endpoint: "latest" | "top" = "latest",
  deps: Deps = defaultDeps,
): Promise<DataEnvelope<BoostToken[]>> {
  const url = `${API_BASE}/token-boosts/${endpoint}/v1`;
  const raw = await deps.fetchJson(DEXSCREENER_SOURCE, url);
  const { items, dropped } = parseItems(DEXSCREENER_SOURCE, raw, DexBoostItemSchema);

  const ranked = [...items].sort((a, b) => b.totalAmount - a.totalAmount);
  const toEnrich = ranked.slice(0, ENRICH_LIMIT);
  const index = await enrichTokens(
    toEnrich.map((b) => ({ chainId: b.chainId, tokenAddress: b.tokenAddress })),
    deps,
  );

  const data: BoostToken[] = ranked.map((item) => {
    const pair = index.get(tokenKey(item.chainId, item.tokenAddress));
    return {
      id: tokenKey(item.chainId, item.tokenAddress),
      chainId: item.chainId,
      tokenAddress: item.tokenAddress,
      chain: normalizeChain(item.chainId),
      symbol: pair?.baseToken.symbol ?? addressLabel(item.tokenAddress),
      name: pair?.baseToken.name ?? "",
      enriched: Boolean(pair),
      dex: pair?.dexId ?? "",
      price: priceOrNull(pair?.priceUsd),
      change24h: numberOrNull(pair?.priceChange?.h24),
      volume24h: numberOrNull(pair?.volume?.h24),
      boostAmount: item.amount,
      boostTotal: item.totalAmount,
      boostTier: boostTierFor(item.totalAmount),
      icon: pair?.info?.imageUrl,
      url: item.url,
    };
  });

  return liveEnvelope(DEXSCREENER_SOURCE, data, deps.now(), dropped);
}

/* ------------------------------------------------------------------ *
 * Ads
 * ------------------------------------------------------------------ */
export async function fetchAds(deps: Deps = defaultDeps): Promise<DataEnvelope<AdToken[]>> {
  const url = `${API_BASE}/ads/latest/v1`;
  const raw = await deps.fetchJson(DEXSCREENER_SOURCE, url);
  const { items, dropped } = parseItems(DEXSCREENER_SOURCE, raw, DexAdItemSchema);

  const ranked = [...items].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const toEnrich = ranked.slice(0, ENRICH_LIMIT);
  const index = await enrichTokens(
    toEnrich.map((a) => ({ chainId: a.chainId, tokenAddress: a.tokenAddress })),
    deps,
  );

  const data: AdToken[] = ranked.map((item) => {
    const pair = index.get(tokenKey(item.chainId, item.tokenAddress));
    const ts = Date.parse(item.date);
    return {
      id: `${tokenKey(item.chainId, item.tokenAddress)}:${item.date}`,
      chainId: item.chainId,
      tokenAddress: item.tokenAddress,
      chain: normalizeChain(item.chainId),
      type: adTypeFor(item.type),
      providerType: item.type,
      symbol: pair?.baseToken.symbol ?? addressLabel(item.tokenAddress),
      name: pair?.baseToken.name ?? "",
      enriched: Boolean(pair),
      price: priceOrNull(pair?.priceUsd),
      change24h: numberOrNull(pair?.priceChange?.h24),
      volume: numberOrNull(pair?.volume?.h24),
      liquidity: numberOrNull(pair?.liquidity?.usd),
      impressions: item.impressions ?? null,
      timestamp: Number.isFinite(ts) ? ts : null,
      icon: pair?.info?.imageUrl,
      url: item.url,
    };
  });

  return liveEnvelope(DEXSCREENER_SOURCE, data, deps.now(), dropped);
}

export { ProviderError };
