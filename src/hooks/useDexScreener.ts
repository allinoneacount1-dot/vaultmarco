import type { AdToken, BoostToken } from "@/components/marco/shared/types";
import { useUniverseSlice } from "./usePairUniverse";

/** Retained for backward compatibility with existing imports. */
export type TokenBoost = BoostToken;
export type { FeedStatus } from "./usePairUniverse";

/**
 * Latest token boosts from DexScreener.
 *
 * The endpoint returns a bare JSON array whose items carry only
 * `chainId` + `tokenAddress` identity — symbol, price and volume are enriched
 * from the token-pairs endpoint. A provider failure surfaces as `stale` /
 * `offline`; an empty list means the provider genuinely reported zero boosts.
 * It never stands in for a failed read, and there is no mock fallback.
 *
 * Data comes from the shared pair-universe poll (see usePairUniverse), so this
 * hook adds no request loop of its own.
 */
export function useTokenBoosts() {
  return useUniverseSlice<BoostToken[]>((u) => u.boosts);
}

/**
 * Latest paid placements from DexScreener. Same contract and failure semantics
 * as {@link useTokenBoosts}.
 */
export function useAds() {
  return useUniverseSlice<AdToken[]>((u) => u.ads);
}
