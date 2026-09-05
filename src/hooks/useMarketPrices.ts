import { useQuery } from "@tanstack/react-query";
import {
  COINGECKO_SOURCE,
  fetchMarketPrices,
  type MarketCoin as ProviderMarketCoin,
} from "@/lib/providers/coingecko";
import { type DataEnvelope, type ProviderStatus, resolveEnvelope } from "@/lib/providers/envelope";

export type MarketCoin = ProviderMarketCoin;

export type ChainHeatmapItem = {
  name: string;
  sym: string;
  heat: number; // 0-100
  ch: number;
};

/** Provider status as the UI sees it, including the initial load. */
export type FeedStatus = "loading" | ProviderStatus;

const CHAINS = [
  "SOL",
  "ETH",
  "BASE",
  "HYPE",
  "BNB",
  "SUI",
  "TON",
  "AVAX",
  "ARB",
  "OP",
  "POL",
  "LINK",
];

/**
 * Live market prices.
 *
 * There is no hardcoded fallback. If CoinGecko fails, react-query retains the
 * last *real* successful response and this hook reports it as `stale`; if there
 * has never been a successful response it reports `offline` with no data. No
 * value returned from here is ever synthesized or randomized.
 */
export function useMarketPrices() {
  const query = useQuery<DataEnvelope<MarketCoin[]>>({
    queryKey: ["market-prices"],
    queryFn: () => fetchMarketPrices(),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
    // Surface provider failures as errors instead of letting react-query pause
    // them as an "offline" condition — a paused query would keep showing the
    // last payload with a LIVE label and no way to know the feed is down.
    networkMode: "always",
  });

  const envelope = resolveEnvelope({
    source: COINGECKO_SOURCE,
    previous: query.data,
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
    /** Unchanged consumer shape: the coin list, or undefined when unavailable. */
    data: envelope?.data as MarketCoin[] | undefined,
    envelope,
    providerStatus,
  };
}

export function useChainHeatmap(data?: MarketCoin[]): ChainHeatmapItem[] {
  return CHAINS.map((sym) => {
    const coin = data?.find((c) => c.sym === sym);
    const ch = coin?.ch ?? 0;
    const heat = Math.max(0, Math.min(100, Math.abs(ch) * 5));
    return { name: sym, sym, heat, ch };
  });
}

export function useVolumeData(data?: MarketCoin[]) {
  const baseData = data?.slice(0, 8) ?? [];
  return baseData.map((c, i) => ({
    sym: c.sym,
    volume: c.volume,
    color: i % 2 === 0 ? "oklch(0.88 0.2 165)" : "oklch(0.85 0.18 200)",
  }));
}

/**
 * Alerts derived from real price movement. Returns an empty list when there is
 * no market data — it must never invent alerts about assets it has no data for.
 */
export function useMarketAlerts(data?: MarketCoin[]) {
  if (!data) return [];

  return data.slice(0, 6).map((c) => {
    const ch = c.ch;
    let type = "UPDATE";
    let status: "ok" | "bad" = "ok";
    if (ch > 10) {
      type = "BREAKOUT";
      status = "ok";
    } else if (ch > 5) {
      type = "PUMP";
      status = "ok";
    } else if (ch < -10) {
      type = "CRASH";
      status = "bad";
    } else if (ch < -5) {
      type = "DUMP";
      status = "bad";
    }
    return { sym: c.sym, type, status };
  });
}

export function formatPrice(n: number) {
  if (n >= 1) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(3)}`;
}

export function formatVolume(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n}`;
}
