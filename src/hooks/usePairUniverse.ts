import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEXSCREENER_SOURCE } from "@/lib/providers/dexscreener";
import { fetchRealtimePairs, type RealtimeRow } from "@/lib/providers/dexPairs";
import { type DataEnvelope, type ProviderStatus, resolveEnvelope } from "@/lib/providers/envelope";
import {
  type PairUniverse,
  type RadarInputs,
  type RadarStatus,
  type RealtimeInput,
  fetchPairUniverse,
} from "@/lib/providers/universe";
import { SnapshotHistory } from "@/lib/signals/history";

/** Provider status as the UI sees it, including the initial load. */
export type FeedStatus = "loading" | ProviderStatus;

/**
 * DexScreener data layer — two lanes, one cache.
 *
 *   FAST lane (30 s) — canonical DEX Realtime pairs. Same query key, cadence
 *                      and retry the DEX Realtime panel always had.
 *   SLOW lane (60 s) — boosts latest + top, ads, one enrichment pass, snapshot
 *                      history and Alpha Radar. It reads the fast lane's
 *                      payload through the query cache (`ensureQueryData`),
 *                      which returns cached data or joins the fast lane's
 *                      in-flight request — it never issues its own request
 *                      for those pairs.
 */
export const REALTIME_QUERY_KEY = ["dexRealtime", "screener"] as const;
export const PAIR_UNIVERSE_KEY = ["dexscreener-pair-universe"] as const;

export const realtimeQueryOptions = {
  queryKey: REALTIME_QUERY_KEY,
  queryFn: () => fetchRealtimePairs(),
  refetchInterval: 30_000,
  staleTime: 15_000,
  retry: 1,
  // Surface provider failure as an error rather than a paused query, so a
  // stale payload can never keep a live label.
  networkMode: "always",
} as const;

/**
 * Session-scoped snapshot history. Module-level on purpose: it must outlive
 * component mounts (the radar's liquidity/attention evidence needs earlier
 * polls) but it has no React dependency and is created fresh per page load.
 */
export const radarHistory = new SnapshotHistory();

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

/** Hand the fast lane's current payload to the slow lane, without a new request of its own. */
async function realtimeInput(queryClient: QueryClient): Promise<RealtimeInput> {
  const state = queryClient.getQueryState<DataEnvelope<RealtimeRow[]>>(REALTIME_QUERY_KEY);
  // The fast lane's latest fetch failed: report that, and never start a fetch
  // of our own — retrying is the fast lane's job. (Old data kept in the cache
  // after a failure is not passed off as current either.)
  if (state?.status === "error") return { ok: false, error: state.error };
  try {
    // Cached payload, or — before the fast lane's first success — its
    // in-flight request (joined, not duplicated).
    const env = state?.data ?? (await queryClient.ensureQueryData(realtimeQueryOptions));
    if (!env) return { ok: false, error: new Error("DEX Realtime returned no payload") };
    return { ok: true, rows: env.data, observedAt: env.fetchedAt ?? env.lastSuccessfulAt ?? 0 };
  } catch (error) {
    return { ok: false, error };
  }
}

/** The slow-lane poll. Boost Feed, Ads Feed and Alpha Radar read this query's cache. */
export function usePairUniverseQuery() {
  const queryClient = useQueryClient();
  return useQuery<PairUniverse>({
    queryKey: PAIR_UNIVERSE_KEY,
    queryFn: async () =>
      fetchPairUniverse(
        queryClient.getQueryData<PairUniverse>(PAIR_UNIVERSE_KEY),
        radarHistory,
        await realtimeInput(queryClient),
      ),
    refetchInterval: 60_000,
    staleTime: 30_000,
    gcTime: 300_000,
    ...DEFAULT_QUERY_OPTIONS,
  });
}

/**
 * Read one feed's envelope out of the universe with the same
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

/** Fast-lane read for the DEX Realtime panel. */
export function useRealtimeQuery() {
  return useQuery<DataEnvelope<RealtimeRow[]>>(realtimeQueryOptions);
}

/** The parts of the universe query's state the radar status depends on. */
export type UniverseQueryState = {
  data: PairUniverse | undefined;
  isPending: boolean;
  isError: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
  failureCount: number;
};

/**
 * Radar status from the universe query — the single temporal-truth rule shared
 * by Alpha Radar, the Token Drawer and Global Search. When the whole slow-lane
 * round fails, react-query keeps the previous round: that is `stale`, or
 * `offline` if there was none. Otherwise the round's own status
 * (live / degraded / stale fallback / offline).
 */
export function resolveRadarStatus(q: UniverseQueryState): RadarStatus | "loading" {
  const failing = q.isError || (q.fetchStatus === "paused" && q.failureCount > 0);
  if (q.isPending && !q.data) return "loading";
  if (!q.data) return "offline";
  if (failing) return q.data.snapshots.length > 0 ? "stale" : "offline";
  return q.data.radarInputs.status;
}

/** Alpha Radar with its own aggregate status (see resolveRadarStatus). */
export function useRadar(): {
  status: RadarStatus | "loading";
  universe: PairUniverse | undefined;
  inputs: RadarInputs | undefined;
} {
  const query = usePairUniverseQuery();
  const status = resolveRadarStatus({
    data: query.data,
    isPending: query.isPending,
    isError: query.isError,
    fetchStatus: query.fetchStatus,
    failureCount: query.failureCount ?? 0,
  });
  return {
    status,
    universe: query.data,
    inputs: query.data?.radarInputs,
  };
}
