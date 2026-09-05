import type { BoostTier, AdType } from "./types";

export const CHAIN_MAP: Record<string, string> = {
  sol: "solana",
  eth: "ethereum",
  base: "base",
  bnb: "bsc",
};

export const getTierColor = (tier: BoostTier) => {
  switch (tier) {
    case "Whale Boost":
      return "border-(--gold) text-(--gold)";
    case "High Boost":
      return "border-(--hairline-strong) text-(--champagne)";
    case "Mid Boost":
      return "border-(--hairline-strong) text-(--muted-2)";
    case "Low Boost":
    default:
      return "border-(--hairline) text-(--faint)";
  }
};

export const getAdTypeIcon = (type: AdType) => {
  switch (type) {
    case "Profile":
      return "◈";
    case "Ad":
      return "▲";
    case "Trending":
      return "◉";
    case "Takeover":
    default:
      return "■";
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

const TIERS = [
  { limit: 1e12, suffix: "T", digits: 2 },
  { limit: 1e9, suffix: "B", digits: 2 },
  { limit: 1e6, suffix: "M", digits: 1 },
  { limit: 1e3, suffix: "K", digits: 1 },
] as const;

/**
 * Compact USD amount across K / M / B / T.
 *
 * The previous version stopped at M and hard-coded the K branch, so a $2.16B
 * pool printed as "$2159225K". Every magnitude now picks its own tier, and
 * negatives and non-finite inputs are handled rather than reaching the DOM.
 */
export const formatNumber = (num: number): string => {
  if (!Number.isFinite(num)) return "—";
  const sign = num < 0 ? "-" : "";
  const n = Math.abs(num);

  for (let i = 0; i < TIERS.length; i++) {
    const t = TIERS[i];
    if (n < t.limit) continue;

    const shown = Number((n / t.limit).toFixed(t.digits));
    // Rounding can push a value into the next tier: 999_999 would otherwise
    // render as "$1000K" instead of "$1M". Promote instead of printing that.
    if (shown >= 1000 && i > 0) {
      const up = TIERS[i - 1];
      return `${sign}$${Number((n / up.limit).toFixed(up.digits))}${up.suffix}`;
    }
    return `${sign}$${shown}${t.suffix}`;
  }

  return `${sign}$${Math.round(n)}`;
};

export const formatPrice2 = (price: number) => {
  if (price < 0.0001) return `$${price.toFixed(8)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(2)}`;
};
