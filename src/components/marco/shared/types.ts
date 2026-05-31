export type Chain = "all" | "sol" | "eth" | "base" | "bnb";

export type BoostTier = "Low Boost" | "Mid Boost" | "High Boost" | "Whale Boost";

export type BoostToken = {
  id?: string;
  icon?: string;
  symbol: string;
  name: string;
  chain: string;
  dex: string;
  price: number;
  change24h: number;
  volume24h: number;
  boostAmount: number;
  boostTier: BoostTier;
  tokenAddress: string;
};

export type AdType = "Profile" | "Ad" | "Trending" | "Takeover";

export type AdToken = {
  id?: string;
  type: AdType;
  icon?: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume: number;
  liquidity: number;
  timestamp: number;
  chain: string;
  tokenAddress: string;
};
