import type { BoostToken, AdToken } from "./types";

// Fallback data
export const FALLBACK_BOOSTS: BoostToken[] = [
  {
    id: "1",
    symbol: "PEPE",
    name: "Pepe",
    chain: "eth",
    dex: "Uniswap",
    price: 0.00001234,
    change24h: 24.5,
    volume24h: 45000000,
    boostAmount: 5000,
    boostTier: "Whale Boost",
    tokenAddress: "0x6982508145b4608a3d2a1f2c41a23b2a12c9a8a9"
  },
  {
    id: "2",
    symbol: "BONK",
    name: "Bonk",
    chain: "sol",
    dex: "Raydium",
    price: 0.00002567,
    change24h: 18.2,
    volume24h: 32000000,
    boostAmount: 2500,
    boostTier: "High Boost",
    tokenAddress: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
  },
  {
    id: "3",
    symbol: "DOGS",
    name: "Dogs",
    chain: "sol",
    dex: "Jupiter",
    price: 0.00089,
    change24h: -5.3,
    volume24h: 18000000,
    boostAmount: 1000,
    boostTier: "Mid Boost",
    tokenAddress: "HpikemZuprZ8T375oU9pY7GvQb4gW5cX6dV8eA9fB0"
  },
  {
    id: "4",
    symbol: "DEGEN",
    name: "Degen",
    chain: "base",
    dex: "BaseSwap",
    price: 0.0245,
    change24h: 12.8,
    volume24h: 8500000,
    boostAmount: 300,
    boostTier: "Low Boost",
    tokenAddress: "0x4ed4e862860bed51a9570b13dd7a620b5f4d1961"
  },
  {
    id: "5",
    symbol: "WIF",
    name: "Dogwifhat",
    chain: "sol",
    dex: "Raydium",
    price: 2.34,
    change24h: 35.2,
    volume24h: 78000000,
    boostAmount: 4200,
    boostTier: "Whale Boost",
    tokenAddress: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"
  }
];

export const FALLBACK_ADS: AdToken[] = [
  {
    id: "ad1",
    type: "Trending",
    symbol: "WIF",
    name: "Dogwifhat",
    chain: "sol",
    price: 2.34,
    change24h: 35.2,
    volume: 78000000,
    liquidity: 25000000,
    timestamp: Date.now() - 120000,
    tokenAddress: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"
  },
  {
    id: "ad2",
    type: "Ad",
    symbol: "BRETT",
    name: "Brett",
    chain: "base",
    price: 0.89,
    change24h: 15.7,
    volume: 22000000,
    liquidity: 8500000,
    timestamp: Date.now() - 2700000,
    tokenAddress: "0x532f27101df2d132f34587e35904c51959a1e11e"
  },
  {
    id: "ad3",
    type: "Profile",
    symbol: "NEIRO",
    name: "Neiro",
    chain: "eth",
    price: 0.00056,
    change24h: 8.4,
    volume: 15000000,
    liquidity: 5000000,
    timestamp: Date.now() - 45000,
    tokenAddress: "0x1234567890abcdef1234567890abcdef12345678"
  }
];
