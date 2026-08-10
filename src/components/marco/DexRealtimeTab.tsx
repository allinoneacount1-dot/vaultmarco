import { useState } from "react";
import { Activity, ArrowUpRight } from "lucide-react";
import { Panel } from "./Panel";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "./SectionHeader";

type PairData = {
  chainId?: string;
  baseToken?: { symbol?: string };
  quoteToken?: { symbol?: string };
  priceUsd?: string;
  volume?: { h24?: number | string };
  liquidity?: { usd?: number | string };
  priceChange?: { h24?: number };
  url?: string;
};

// Fallback pairs if API fails
const FALLBACK_PAIRS: PairData[] = [
  { chainId: "solana", baseToken: { symbol: "SOL" }, quoteToken: { symbol: "USDC" }, priceUsd: "178.5", volume: { h24: 125000000 }, liquidity: { usd: 45000000 }, priceChange: { h24: 4.2 } },
  { chainId: "ethereum", baseToken: { symbol: "WETH" }, quoteToken: { symbol: "USDT" }, priceUsd: "3620", volume: { h24: 890000000 }, liquidity: { usd: 120000000 }, priceChange: { h24: 1.9 } },
  { chainId: "base", baseToken: { symbol: "DEGEN" }, quoteToken: { symbol: "WETH" }, priceUsd: "0.0245", volume: { h24: 21000000 }, liquidity: { usd: 8500000 }, priceChange: { h24: 8.7 } },
  { chainId: "hyperliquid", baseToken: { symbol: "HYPE" }, quoteToken: { symbol: "USDC" }, priceUsd: "12.5", volume: { h24: 56000000 }, liquidity: { usd: 18000000 }, priceChange: { h24: -2.4 } },
];

// Helper function to generate DexTools URL
const generateDexToolsUrl = (chainId: string, baseSymbol: string, quoteSymbol: string) => {
  const chainMap: Record<string, string> = {
    solana: "solana",
    ethereum: "ether",
    base: "base",
    hyperliquid: "hyperliquid",
  };
  const chain = chainMap[chainId.toLowerCase()] || chainId;
  return `https://www.dextools.io/app/${chain}/pair-explorer`;
};

export function DexRealtimeTab() {
  const [dexSource, setDexSource] = useState("screener"); // screener or dextools

  const { data, isLoading } = useQuery({
    queryKey: ["dexRealtime", dexSource],
    queryFn: async () => {
      if (dexSource === "screener") {
        // Real-time pairs from DexScreener's free public search endpoint:
        // top pair (by liquidity) for each flagship market.
        try {
          const QUERIES = ["SOL/USDC", "WETH/USDT", "HYPE/USDC", "AERO/USDC"] as const;
          const results = await Promise.allSettled(
            QUERIES.map(async (q) => {
              const res = await fetch(
                `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
              );
              if (!res.ok) throw new Error(`search ${q} ${res.status}`);
              const json = (await res.json()) as { pairs?: (PairData & { url?: string })[] };
              const best = (json.pairs ?? [])
                .filter((pr) => pr.baseToken?.symbol && pr.priceUsd)
                .sort((a, b) => Number(b.liquidity?.usd ?? 0) - Number(a.liquidity?.usd ?? 0))[0];
              if (!best) throw new Error(`no pair for ${q}`);
              return best;
            }),
          );
          const pairs = results
            .filter((r): r is PromiseFulfilledResult<PairData & { url?: string }> => r.status === "fulfilled")
            .map((r) => r.value);
          if (pairs.length === 0) throw new Error("all searches failed");
          return pairs;
        } catch (err) {
          console.warn("DexScreener API failed, using fallback:", err);
          return FALLBACK_PAIRS.map(p => ({
            ...p,
            url: `https://dexscreener.com/${p.chainId}/${p.baseToken?.symbol?.toLowerCase()}-${p.quoteToken?.symbol?.toLowerCase()}`
          }));
        }
      } else {
        // For DexTools, we don't have a public API, so use fallback with DexTools URLs
        return FALLBACK_PAIRS.map(p => ({
          ...p,
          url: generateDexToolsUrl(p.chainId || "", p.baseToken?.symbol || "", p.quoteToken?.symbol || "")
        }));
      }
    },
    refetchInterval: 30000, // 30 seconds
  });

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <button
          onClick={() => setDexSource("screener")}
          className={`px-4 py-2 rounded-full text-[11px] font-mono transition-all ${
            dexSource === "screener" ? "chrome-fill" : "hairline text-muted-foreground hover:text-foreground"
          }`}
        >
          DEXSCREENER
        </button>
        <button
          onClick={() => setDexSource("dextools")}
          className={`px-4 py-2 rounded-full text-[11px] font-mono transition-all ${
            dexSource === "dextools" ? "chrome-fill" : "hairline text-muted-foreground hover:text-foreground"
          }`}
        >
          DEXTOOLS
        </button>
      </div>

      <Panel title={`DEX REALTIME · ${dexSource.toUpperCase()}`} icon={Activity}>
        <div className="space-y-3">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-md border border-(--hairline) p-3"
                >
                  <div className="h-4 w-24 bg-(--panel-2) rounded animate-pulse mb-2" />
                  <div className="h-3 w-48 bg-(--panel-2) rounded animate-pulse" />
                </motion.div>
              ))
            : (
              <motion.div
                variants={staggerContainer}
                initial="initial"
                whileInView="whileInView"
                viewport={{ once: true, margin: "-100px" }}
                className="space-y-3"
              >
                {(data || []).map((pair: unknown, i: number) => {
                  const p = pair as PairData;
                  return (
                    <motion.a
                      key={i}
                      variants={fadeUp}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-md border border-(--hairline) p-3 hover:bg-(--panel-2) hover:border-(--hairline-strong) transition-all group"
                      >
                      <div>
                        <div className="flex items-center gap-2 text-[12px] font-mono text-foreground">
                          <span className="px-2 py-0.5 rounded-full border border-(--hairline-strong) text-(--gold)">
                            {p.chainId?.toUpperCase()}
                          </span>
                          {p.baseToken?.symbol}/{p.quoteToken?.symbol}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          Vol:{" "}
                          {Number(p.volume?.h24)
                            ? `$${(Number(p.volume?.h24) / 1000000).toFixed(1)}M`
                            : "N/A"}
                          • Liq:{" "}
                          {p.liquidity?.usd
                            ? `$${(Number(p.liquidity.usd) / 1000).toFixed(0)}K`
                            : "N/A"}
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div>
                          <div className="text-[12px] font-mono text-foreground">
                            $
                            {p.priceUsd
                              ? Number(p.priceUsd) < 0.001
                                ? Number(p.priceUsd).toFixed(8)
                                : Number(p.priceUsd).toFixed(4)
                              : "N/A"}
                          </div>
                          <div
                            className={`text-[11px] font-mono mt-1 ${
                              p.priceChange?.h24 && p.priceChange.h24 > 0 ? "text-(--up)" : "text-(--down)"
                            }`}
                          >
                            {p.priceChange?.h24 && p.priceChange.h24 >= 0 ? "+" : ""}
                            {p.priceChange?.h24?.toFixed(1) || "0.0"}%
                          </div>
                        </div>
                        <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-(--gold) transition-all opacity-0 group-hover:opacity-100" />
                      </div>
                    </motion.a>
                  );
                })}
              </motion.div>
            )}
        </div>
      </Panel>
    </div>
  );
}
