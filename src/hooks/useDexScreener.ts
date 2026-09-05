import { useQuery } from "@tanstack/react-query";
import type { AdToken, BoostToken } from "@/components/marco/shared/types";
import { DEXSCREENER_SOURCE, fetchAds, fetchTokenBoosts } from "@/lib/providers/dexscreener";
import { type DataEnvelope, type ProviderStatus, resolveEnvelope } from "@/lib/providers/envelope";

/** Retained for backward compatibility with existing imports. */
export type TokenBoost = BoostToken;

/** Provider status as the UI sees it, including the initial load. */
export type FeedStatus = "loading" | ProviderStatus;

const DEFAULT_QUERY_OPTIONS = {
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
  refetchOnMount: true,
  retry: 2,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  // Surface provider failures as errors instead of letting react-query pause
  // them as an "offline" condition — a paused query would keep showing the last
  // payload with a LIVE label and no way to know the feed is down.
  networkMode: "always",
} as const;

function useFeedStatus<T>(query: {
  data: DataEnvelope<T> | undefined;
  isError: boolean;
  error: unknown;
  isPending: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
  failureCount: number;
  failureReason: unknown;
}) {
  const envelope = resolveEnvelope({
    source: DEXSCREENER_SOURCE,
    previous: query.data,
    isError: query.isError,
    error: query.error,
    fetchStatus: query.fetchStatus,
    fetchFailureCount: query.failureCount,
    fetchFailureReason: query.failureReason,
  });
  const providerStatus: FeedStatus =
    query.isPending && !envelope ? "loading" : (envelope?.status ?? "offline");
  return { envelope, providerStatus };
}

/**
 * Latest token boosts from DexScreener.
 *
 * The endpoint returns a bare JSON array whose items carry only
 * `chainId` + `tokenAddress` identity — symbol, price and volume are enriched
 * from the token-pairs endpoint. A provider failure throws, so an empty list
 * means the provider genuinely reported zero boosts; it never stands in for a
 * failed read, and there is no mock fallback.
 */
export function useTokenBoosts() {
  const query = useQuery<DataEnvelope<BoostToken[]>>({
    queryKey: ["dexscreener-token-boosts"],
    queryFn: () => fetchTokenBoosts("latest"),
    refetchInterval: 60_000,
    staleTime: 30_000,
    gcTime: 300_000,
    ...DEFAULT_QUERY_OPTIONS,
  });

  const { envelope, providerStatus } = useFeedStatus(query);

  return {
    ...query,
    data: envelope?.data as BoostToken[] | undefined,
    envelope,
    providerStatus,
  };
}

/**
 * Latest paid placements from DexScreener. Same contract and failure semantics
 * as {@link useTokenBoosts}.
 */
export function useAds() {
  const query = useQuery<DataEnvelope<AdToken[]>>({
    queryKey: ["dexscreener-ads"],
    queryFn: () => fetchAds(),
    refetchInterval: 120_000,
    staleTime: 60_000,
    gcTime: 300_000,
    ...DEFAULT_QUERY_OPTIONS,
  });

  const { envelope, providerStatus } = useFeedStatus(query);

  return {
    ...query,
    data: envelope?.data as AdToken[] | undefined,
    envelope,
    providerStatus,
  };
}
