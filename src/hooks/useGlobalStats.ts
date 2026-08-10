import { useQuery } from "@tanstack/react-query";

/** Global market stats from free, keyless, CORS-open APIs:
 *  - CoinGecko /global — BTC dominance, total market cap, 24h Δ
 *  - alternative.me /fng — Fear & Greed index
 *  Both refresh every 60s with graceful fallbacks. */

export type GlobalStats = {
  btcDominance: number | null;
  totalMcap: number | null;
  mcapChange24h: number | null;
  fearGreed: number | null;
  fearGreedLabel: string | null;
};

async function fetchGlobal(): Promise<Pick<GlobalStats, "btcDominance" | "totalMcap" | "mcapChange24h">> {
  const res = await fetch("https://api.coingecko.com/api/v3/global");
  if (!res.ok) throw new Error(`CoinGecko global ${res.status}`);
  const json = (await res.json()) as {
    data?: {
      market_cap_percentage?: { btc?: number };
      total_market_cap?: { usd?: number };
      market_cap_change_percentage_24h_usd?: number;
    };
  };
  return {
    btcDominance: json.data?.market_cap_percentage?.btc ?? null,
    totalMcap: json.data?.total_market_cap?.usd ?? null,
    mcapChange24h: json.data?.market_cap_change_percentage_24h_usd ?? null,
  };
}

async function fetchFearGreed(): Promise<Pick<GlobalStats, "fearGreed" | "fearGreedLabel">> {
  const res = await fetch("https://api.alternative.me/fng/?limit=1");
  if (!res.ok) throw new Error(`FnG ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ value?: string; value_classification?: string }> };
  const row = json.data?.[0];
  return {
    fearGreed: row?.value ? Number(row.value) : null,
    fearGreedLabel: row?.value_classification ?? null,
  };
}

export function useGlobalStats() {
  return useQuery<GlobalStats>({
    queryKey: ["globalStats"],
    queryFn: async () => {
      const [global, fng] = await Promise.allSettled([fetchGlobal(), fetchFearGreed()]);
      return {
        btcDominance: global.status === "fulfilled" ? global.value.btcDominance : null,
        totalMcap: global.status === "fulfilled" ? global.value.totalMcap : null,
        mcapChange24h: global.status === "fulfilled" ? global.value.mcapChange24h : null,
        fearGreed: fng.status === "fulfilled" ? fng.value.fearGreed : null,
        fearGreedLabel: fng.status === "fulfilled" ? fng.value.fearGreedLabel : null,
      };
    },
    refetchInterval: 60_000,
    staleTime: 55_000,
  });
}
