import { Activity, Loader2, Zap } from "lucide-react";
import { Panel } from "./Panel";
import { useQuery } from "@tanstack/react-query";

type PairData = {
  chainId?: string;
  baseToken?: { symbol?: string };
  quoteToken?: { symbol?: string };
  priceUsd?: string;
  volume?: { h24?: number | string };
  liquidity?: { usd?: number | string };
  priceChange?: { h24?: number };
};

export function DexRealtimeTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["dexScreener"],
    queryFn: async () => {
      const res = await fetch("/api/dex/screener");
      const json = await res.json();
      if (json.error) {
        // Fallback to mock
        return json.mock.pairs as PairData[];
      }
      return (json.pairs || []).slice(0, 4) as PairData[];
    },
    refetchInterval: 30000, // 30 seconds
  });

  return (
    <Panel title="DEX REALTIME · DEXSCREENER" icon={Activity}>
      <div className="space-y-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/10 p-3">
                <div className="h-4 w-24 bg-white/10 rounded animate-pulse mb-2" />
                <div className="h-3 w-48 bg-white/5 rounded animate-pulse" />
              </div>
            ))
          : data?.map((pair: unknown, i: number) => {
              const p = pair as PairData;
              return (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl border border-white/10 p-3 hover:bg-white/5 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 text-[12px] font-mono text-foreground">
                      <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                        {p.chainId}
                      </span>
                      {p.baseToken?.symbol}/{p.quoteToken?.symbol}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Vol:{" "}
                      {Number(p.volume?.h24)
                        ? `$${(Number(p.volume.h24) / 1000000).toFixed(1)}M`
                        : "N/A"}
                      • Liq:{" "}
                      {p.liquidity?.usd
                        ? `$${(Number(p.liquidity.usd) / 1000).toFixed(0)}K`
                        : "N/A"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] font-mono text-foreground">
                      $
                      {p.priceUsd
                        ? Number(p.priceUsd) < 0.001
                          ? Number(p.priceUsd).toFixed(8)
                          : Number(p.priceUsd).toFixed(2)
                        : "N/A"}
                    </div>
                    <div
                      className={`text-[11px] font-mono mt-1 ${
                        p.priceChange?.h24 && p.priceChange.h24 > 0 ? "text-accent" : "text-red-400"
                      }`}
                    >
                      {p.priceChange?.h24 && p.priceChange.h24 >= 0 ? "+" : ""}
                      {p.priceChange?.h24?.toFixed(1) || "0.0"}%
                    </div>
                  </div>
                </div>
              );
            })}
      </div>
    </Panel>
  );
}
