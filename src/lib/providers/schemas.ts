import { z } from "zod";
import { ProviderError } from "./envelope";

/**
 * Schemas describing the ACTUAL response shapes returned by the providers,
 * verified against live responses on 2026-09-06. See tests/fixtures/* for
 * sanitized captures of each payload.
 *
 * The critical correction over the previous implementation: the DexScreener
 * boost and ads endpoints return a BARE JSON ARRAY at the root. They do not
 * return `{ boosts: [...] }` / `{ ads: [...] }`, and their items carry no
 * nested `token` object — only `chainId` + `tokenAddress` identity. Symbol,
 * name, price and volume must be enriched from the token-pairs endpoint.
 */

/* ------------------------------------------------------------------ *
 * DexScreener — GET /token-boosts/latest/v1  and  /token-boosts/top/v1
 * Root: array. Verified keys:
 *   url, chainId, tokenAddress, description?, icon?, header?,
 *   openGraph?, links?, totalAmount, amount
 * ------------------------------------------------------------------ */
export const DexBoostItemSchema = z.object({
  url: z.string().url(),
  chainId: z.string().min(1),
  tokenAddress: z.string().min(1),
  amount: z.number().finite().nonnegative(),
  totalAmount: z.number().finite().nonnegative(),
  description: z.string().optional(),
  icon: z.string().optional(),
  header: z.string().optional(),
  openGraph: z.string().optional(),
  links: z
    .array(z.object({ type: z.string().optional(), label: z.string().optional(), url: z.string() }))
    .optional(),
});
export type DexBoostItem = z.infer<typeof DexBoostItemSchema>;

export const DexBoostResponseSchema = z.array(z.unknown());

/* ------------------------------------------------------------------ *
 * DexScreener — GET /ads/latest/v1
 * Root: array. Verified keys:
 *   url, chainId, tokenAddress, date, type, impressions, durationHours?
 * Observed `type` values: "tokenAd", "trendingBarAd"
 * ------------------------------------------------------------------ */
export const DexAdItemSchema = z.object({
  url: z.string().url(),
  chainId: z.string().min(1),
  tokenAddress: z.string().min(1),
  date: z.string().min(1),
  type: z.string().min(1),
  impressions: z.number().finite().nonnegative().optional(),
  durationHours: z.number().finite().nonnegative().optional(),
});
export type DexAdItem = z.infer<typeof DexAdItemSchema>;

export const DexAdsResponseSchema = z.array(z.unknown());

/* ------------------------------------------------------------------ *
 * DexScreener — GET /tokens/v1/{chainId}/{addresses}
 * Root: array of pair objects. Used to enrich boosts/ads with real
 * symbol, name, price, volume, liquidity and image.
 * ------------------------------------------------------------------ */
export const DexPairSchema = z.object({
  chainId: z.string().min(1),
  dexId: z.string().optional(),
  url: z.string().optional(),
  pairAddress: z.string().optional(),
  baseToken: z.object({
    address: z.string().min(1),
    name: z.string().optional(),
    symbol: z.string().optional(),
  }),
  quoteToken: z
    .object({ address: z.string().optional(), symbol: z.string().optional() })
    .optional(),
  priceUsd: z.string().optional(),
  volume: z.object({ h24: z.number().finite().optional() }).partial().optional(),
  priceChange: z.object({ h24: z.number().finite().optional() }).partial().optional(),
  liquidity: z.object({ usd: z.number().finite().optional() }).partial().optional(),
  marketCap: z.number().finite().optional(),
  info: z.object({ imageUrl: z.string().optional() }).partial().optional(),
});
export type DexPair = z.infer<typeof DexPairSchema>;

export const DexTokensResponseSchema = z.array(z.unknown());

/* ------------------------------------------------------------------ *
 * CoinGecko — GET /api/v3/coins/markets
 * ------------------------------------------------------------------ */
export const CoinGeckoMarketSchema = z.object({
  id: z.string().min(1),
  symbol: z.string().min(1),
  name: z.string().min(1),
  current_price: z.number().finite(),
  price_change_percentage_24h: z.number().finite().nullable().optional(),
  total_volume: z.number().finite().nullable().optional(),
  market_cap: z.number().finite().nullable().optional(),
  image: z.string().optional(),
});
export type CoinGeckoMarket = z.infer<typeof CoinGeckoMarketSchema>;

export const CoinGeckoMarketsResponseSchema = z.array(z.unknown());

/**
 * Validate a root array, then validate each item individually so a single
 * malformed record cannot discard an otherwise good response. Returns the
 * valid items plus a count of what was rejected — the caller reports a
 * non-zero `dropped` as `degraded`, never as a clean success.
 */
export function parseItems<T>(
  source: string,
  raw: unknown,
  itemSchema: z.ZodType<T>,
): { items: T[]; dropped: number } {
  const root = z.array(z.unknown()).safeParse(raw);
  if (!root.success) {
    throw new ProviderError(
      source,
      "SCHEMA_MISMATCH",
      "expected a JSON array at the response root",
    );
  }
  const items: T[] = [];
  let dropped = 0;
  for (const entry of root.data) {
    const parsed = itemSchema.safeParse(entry);
    if (parsed.success) items.push(parsed.data);
    else dropped += 1;
  }
  return { items, dropped };
}
