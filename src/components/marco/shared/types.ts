export type Chain = "all" | "sol" | "eth" | "base" | "bnb";

export type BoostTier = "Low Boost" | "Mid Boost" | "High Boost" | "Whale Boost";

/**
 * Normalized boost record.
 *
 * Identity is `chainId` + `tokenAddress` — never symbol. Numeric market fields
 * are nullable on purpose: the boosts endpoint carries no price data, so a
 * value stays `null` until enriched from a real pair response. `null` means
 * "not known" and must render as such — never as 0.
 */
export type BoostToken = {
  id: string;
  chainId: string;
  tokenAddress: string;
  /** Short chain alias used by the existing UI (sol / eth / base / bnb / …). */
  chain: string;
  /** Real ticker when enriched; otherwise a truncation of the real address. */
  symbol: string;
  name: string;
  /** True when symbol/price came from a provider pair response. */
  enriched: boolean;
  dex: string;
  price: number | null;
  change24h: number | null;
  volume24h: number | null;
  /** Boost units applied in this event. */
  boostAmount: number;
  /** Cumulative boost units for the token. */
  boostTotal: number;
  boostTier: BoostTier;
  icon?: string;
  url: string;
};

export type AdType = "Profile" | "Ad" | "Trending" | "Takeover";

/** Normalized ad record. Same nullability contract as `BoostToken`. */
export type AdToken = {
  id: string;
  chainId: string;
  tokenAddress: string;
  chain: string;
  /** Display category used by the existing UI. */
  type: AdType;
  /** Raw provider value, e.g. "tokenAd" / "trendingBarAd". */
  providerType: string;
  symbol: string;
  name: string;
  enriched: boolean;
  price: number | null;
  change24h: number | null;
  volume: number | null;
  liquidity: number | null;
  impressions: number | null;
  timestamp: number | null;
  icon?: string;
  url: string;
};
