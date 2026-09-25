import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DEXSCREENER_SOURCE } from "@/lib/providers/dexscreener";
import { type DataEnvelope, type ProviderStatus, resolveEnvelope } from "@/lib/providers/envelope";
import { type PairUniverse, fetchPairUniverse } from "@/lib/providers/universe";
import { SnapshotHistory } from "@/lib/signals/history";

/** Provider status as the UI sees it, including the initial load. */
export type FeedStatus = "loading" | ProviderStatus;

export const PAIR_UNIVERSE_KEY = ["dexscreener-pair-universe"] as const;

/**
 * Session-scoped snapshot history. Module-level on purpose: it must outlive
 * component mounts (the radar's liquidity/attention evidence needs earlier
 * polls) but it has no React dependency and is created fresh per page load.
 */
export const radarHistory = new SnapshotHistory();

export const DEFAULT_QUERY_OPTIONS = {
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

/** The one DexScreener poll. Every consumer reads this query's cache. */
export function usePairUniverseQuery() {
  const queryClient = useQueryClient();
  return useQuery<PairUniverse>({
    queryKey: PAIR_UNIVERSE_KEY,
    queryFn: () =>
      fetchPairUniverse(queryClient.getQueryData<PairUniverse>(PAIR_UNIVERSE_KEY), radarHistory),
    refetchInterval: 60_000,
    staleTime: 30_000,
    gcTime: 300_000,
    ...DEFAULT_QUERY_OPTIONS,
  });
}

/**
 * Read one source's envelope out of the universe with the same
 * loading / live / degraded / stale / offline semantics the feeds had when
 * they polled on their own.
 */
export function useUniverseSlice<T>(pick: (u: PairUniverse) => DataEnvelope<T> | null) {
  const query = usePairUniverseQuery();
  const slice = query.data ? pick(query.data) : undefined;
  const envelope = resolveEnvelope<T>({
    source: DEXSCREENER_SOURCE,
    previous: slice ?? undefined,
    isError: query.isError,
    error: query.error,
    fetchStatus: query.fetchStatus,
    fetchFailureCount: query.failureCount,
    fetchFailureReason: query.failureReason,
  });
  const providerStatus: FeedStatus =
    query.isPending && !envelope ? "loading" : (envelope?.status ?? "offline");

  return {
    ...query,
    data: envelope?.data as T | undefined,
    envelope,
    providerStatus,
  };
}
