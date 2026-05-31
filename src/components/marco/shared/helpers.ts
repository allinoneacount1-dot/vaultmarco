import type { BoostTier, AdType } from './types';

export const CHAIN_MAP: Record<string, string> = {
  sol: "solana",
  eth: "ethereum",
  base: "base",
  bnb: "bsc"
};

export const getTierColor = (tier: BoostTier) => {
  switch (tier) {
    case "Whale Boost":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "High Boost":
      return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "Mid Boost":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "Low Boost":
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
};

export const getAdTypeIcon = (type: AdType) => {
  switch (type) {
    case "Profile":
      return "🪪";
    case "Ad":
      return "📣";
    case "Trending":
      return "📊";
    case "Takeover":
    default:
      return "❓";
  }
};

export const formatTimestamp = (timestamp: number) => {
  const diff = Math.max(0, Date.now() - timestamp);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

export const formatNumber = (num: number) => {
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
  return `$${num.toFixed(0)}`;
};

export const formatPrice2 = (price: number) => {
  if (price < 0.0001) return `$${price.toFixed(8)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(2)}`;
};
