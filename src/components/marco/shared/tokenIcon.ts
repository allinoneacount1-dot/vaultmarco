import type { BoostToken, AdToken } from "./types";
import { CHAIN_MAP } from "./helpers";

/**
 * Get token icon URL using DexScreener's API
 * Falls back to initial-based icon if unavailable
 */
export function getTokenIcon(token: Pick<BoostToken | AdToken, "symbol" | "chain" | "tokenAddress">): string {
  // Try DexScreener's icon API first
  const normalizedChain = CHAIN_MAP[token.chain.toLowerCase()] || token.chain.toLowerCase();
  
  // Use DexScreener's icon endpoint (format: https://dd.dexscreener.com/ds-data/tokens/{chain}/{address}.png)
  // Fallback to placeholder if no address
  if (token.tokenAddress) {
    return `https://dd.dexscreener.com/ds-data/tokens/${normalizedChain}/${token.tokenAddress}.png`;
  }
  
  // Fallback: use initials-based placeholder
  const initial = (token.symbol || "?")[0].toUpperCase();
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <rect width="40" height="40" fill="%231e293b" rx="20"/>
      <text x="20" y="26" text-anchor="middle" font-size="18" font-weight="bold" fill="%2338bdf8">${initial}</text>
    </svg>
  `)}`;
}
