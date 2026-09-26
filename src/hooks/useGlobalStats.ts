import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DataEnvelope } from "@/lib/providers/envelope";
import {
  COINGECKO_GLOBAL_SOURCE,
  FEAR_GREED_SOURCE,
  type FearGreed,
  type GlobalMarket,
  fetchFearGreed,
  fetchGlobalMarket,
  settleEnvelope,
} from "@/lib/providers/coingeckoGlobal";

/** Global market stats from free, keyless, CORS-open APIs:
 *  - CoinGecko /global — BTC dominance, total market cap, 24h Δ, total 24h volume
 *  - alternative.me /fng — Fear & Greed index
 *  One query loop (key `["globalStats"]`, every 60 s) reads both, in parallel,
 *  each independently (Promise.allSettled). */

export const GLOBAL_STATS_KEY = ["globalStats"] as const;

export type GlobalStats = {
  /*
   * THIS ROUND's figures — the dashboard Quick Stats contract, unchanged: a
   * provider that failed this round contributes `null` ("—"), never a cached
   * or default value.
   */
  btcDominance: number | null;
  totalMcap: number | null;
  mcapChange24h: number | null;
  fearGreed: number | null;
  fearGreedLabel: string | null;
  /*
   * Per-provider envelopes with real timestamps. On a failed round the last
   * real payload is carried as `stale` (lastSuccessfulAt unchanged), or the
   * envelope is `offline` with no data if there was never a success.
   */
  coingecko: DataEnvelope<GlobalMarket | null>;
  fearGreedFeed: DataEnvelope<FearGreed | null>;
};

/** Build one round from the two settled reads and the previous round. */
export function globalStatsRound(
  gecko: PromiseSettledResult<DataEnvelope<GlobalMarket>>,
  fng: PromiseSettledResult<DataEnvelope<FearGreed>>,
  previous: GlobalStats | undefined,
): GlobalStats {
  const g = gecko.status === "fulfilled" ? gecko.value.data : null;
  const f = fng.status === "fulfilled" ? fng.value.data : null;
  return {
    btcDominance: g?.btcDominancePct ?? null,
    totalMcap: g?.totalMcapUsd ?? null,
    mcapChange24h: g?.mcapChange24hPct ?? null,
    fearGreed: f?.value ?? null,
    fearGreedLabel: f?.label ?? null,
    coingecko: settleEnvelope<GlobalMarket>(
      COINGECKO_GLOBAL_SOURCE,
      gecko,
      previous?.coingecko as DataEnvelope<GlobalMarket> | undefined,
    ),
    fearGreedFeed: settleEnvelope<FearGreed>(
      FEAR_GREED_SOURCE,
      fng,
      previous?.fearGreedFeed as DataEnvelope<FearGreed> | undefined,
    ),
  };
}

export function useGlobalStats() {
  const queryClient = useQueryClient();
  return useQuery<GlobalStats>({
    queryKey: GLOBAL_STATS_KEY,
    queryFn: async () => {
      // Each read goes through fetchJson: 10 s timeout, typed errors (a 429 is
      // RATE_LIMITED). Neither is retried inside the round; the next attempt is
      // the next 60 s tick.
      const [gecko, fng] = await Promise.allSettled([fetchGlobalMarket(), fetchFearGreed()]);
      return globalStatsRound(gecko, fng, queryClient.getQueryData<GlobalStats>(GLOBAL_STATS_KEY));
    },
    refetchInterval: 60_000,
    staleTime: 55_000,
  });
}
