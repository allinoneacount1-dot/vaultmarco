import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/marco/Panel";
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Activity, Loader2 } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  useMarketPrices,
  formatPrice,
  formatVolume,
  type MarketCoin,
} from "@/hooks/useMarketPrices";
import { useTrending } from "@/hooks/useDexScreener";

const SYM_TO_CHAIN: Record<string, string> = {
  BTC: "BTC",
  ETH: "ETH",
  SOL: "SOL",
  HYPE: "SOL",
  BONK: "SOL",
  PEPE: "ETH",
  SUI: "SUI",
  TON: "TON",
  BNB: "BNB",
  AVAX: "AVAX",
  ARB: "ETH",
  OP: "ETH",
  POL: "ETH",
  LINK: "ETH",
  DOGE: "DOGE",
  SHIB: "ETH",
};

const chains = ["ALL", "SOL", "ETH", "BNB", "BASE", "AVAX", "SUI"];

export const Route = createFileRoute("/dashboard/live-market")({
  component: LiveMarketPage,
});

function LiveMarketPage() {
  const [selectedChain, setSelectedChain] = useState<string>("ALL");
  const { data: marketData, isLoading: isLoadingMarket } = useMarketPrices();
  const { data: trendingTokens, isLoading: isLoadingTrending } = useTrending();

  const filteredMarketData = selectedChain === "ALL"
    ? (marketData || [])
    : (marketData || []).filter((coin) => SYM_TO_CHAIN[coin.sym] === selectedChain);

  // Calculate stats from real data
  const totalVolume = (marketData || []).reduce((sum, coin) => sum + (coin.volume || 0), 0);
  const sortedByChange = [...(marketData || [])].sort((a, b) => b.ch - a.ch);
  const topGainer = sortedByChange[0];
  const topLoser = sortedByChange[sortedByChange.length - 1];

  const formatMarketCap = (n: number) => {
    if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    return formatVolume(n);
  };

  const isLoading = isLoadingMarket || isLoadingTrending;

  return (
    <div className="space-y-6">
      <motion.div 
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-3xl font-bold text-gradient mb-2">Live Market</h1>
        <p className="text-muted-foreground">Real-time cryptocurrency market data</p>
      </motion.div>

      {/* Chain Filter */}
      <motion.div 
        className="flex gap-2 flex-wrap"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        {chains.map((chain) => (
          <motion.button
            key={chain}
            onClick={() => setSelectedChain(chain)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-4 py-2 rounded-full text-[12px] font-mono transition-all border ${
              selectedChain === chain
                ? "bg-primary/20 text-primary border-primary/30"
                : "border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20"
            }`}
          >
            {chain}
          </motion.button>
        ))}
      </motion.div>

      {/* Market Stats Cards */}
      <motion.div 
        className="grid md:grid-cols-4 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <Panel title="Total Volume" icon={DollarSign} className="h-full">
          <div className="text-2xl font-mono text-foreground">{formatVolume(totalVolume)}</div>
          <div className="text-accent text-xs font-mono mt-1">From top 20 coins</div>
        </Panel>
        <Panel title="Top Gainer" icon={TrendingUp} className="h-full">
          {topGainer ? (
            <>
              <div className="text-2xl font-mono text-foreground">{topGainer.sym}</div>
              <div className="text-accent text-xs font-mono mt-1">+{topGainer.ch.toFixed(1)}%</div>
            </>
          ) : (
            <div className="text-muted-foreground">—</div>
          )}
        </Panel>
        <Panel title="Top Loser" icon={TrendingDown} className="h-full">
          {topLoser ? (
            <>
              <div className="text-2xl font-mono text-foreground">{topLoser.sym}</div>
              <div className="text-red-400 text-xs font-mono mt-1">{topLoser.ch.toFixed(1)}%</div>
            </>
          ) : (
            <div className="text-muted-foreground">—</div>
          )}
        </Panel>
        <Panel title="Active Chains" icon={Activity} className="h-full">
          <div className="text-2xl font-mono text-foreground">{chains.length - 1}</div>
          <div className="text-muted-foreground text-xs font-mono mt-1">Live now</div>
        </Panel>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Market Table */}
        <motion.div 
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Panel title="Market Overview" icon={BarChart3}>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMarketData.map((coin, index) => (
                  <motion.div
                    key={coin.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.01, x: 5 }}
                    className="flex items-center justify-between rounded-xl border border-white/10 p-4 hover:bg-white/5 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground text-xs font-mono w-4">{index + 1}</span>
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                        {coin.image ? (
                          <img src={coin.image} alt={coin.sym} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-primary font-bold text-sm">{coin.sym[0]}</span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-medium">{coin.sym}</span>
                          <span className="text-muted-foreground text-xs bg-white/10 px-2 py-0.5 rounded-full">
                            {SYM_TO_CHAIN[coin.sym] || "—"}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-xs">{coin.name}</p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-foreground font-mono text-sm">
                        {formatPrice(coin.px)}
                      </div>
                      <div className={`text-xs font-mono ${coin.ch >= 0 ? 'text-accent' : 'text-red-400'}`}>
                        {coin.ch >= 0 ? '+' : ''}{coin.ch.toFixed(1)}%
                      </div>
                      <div className="text-muted-foreground text-[10px]">Vol: {formatVolume(coin.volume)}</div>
                      <div className="text-muted-foreground text-[10px]">MCap: {formatMarketCap(coin.mc)}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Panel>
        </motion.div>

        {/* Trending Tokens Sidebar */}
        <motion.div 
          className="space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Panel title="Trending Now" icon={TrendingUp}>
            {isLoadingTrending ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                {(trendingTokens || []).slice(0, 4).map((token, index) => (
                  <motion.div
                    key={token.id || index}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.02, x: 5 }}
                    className="flex items-center justify-between rounded-xl border border-white/10 p-3 hover:bg-white/5 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden">
                        {token.icon ? (
                          <img src={token.icon} alt={token.symbol} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-accent font-bold text-xs">{token.symbol[0]}</span>
                        )}
                      </div>
                      <div>
                        <span className="text-foreground font-medium text-sm">{token.symbol}</span>
                        <p className="text-muted-foreground text-[10px]">{token.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-mono ${(token.change24h || 0) >= 0 ? 'text-accent' : 'text-red-400'}`}>
                        {(token.change24h || 0) >= 0 ? '+' : ''}{(token.change24h || 0).toFixed(1)}%
                      </div>
                      <div className="text-muted-foreground text-[10px]">
                        {formatPrice(token.price)}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Panel>

          {/* Quick Actions */}
          <Panel title="Quick Actions" icon={Activity}>
            <div className="space-y-2">
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full px-4 py-3 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all text-sm font-medium"
              >
                View Market Heatmap
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full px-4 py-3 rounded-xl bg-white/5 text-foreground hover:bg-white/10 transition-all text-sm font-medium"
              >
                Recent Swaps
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full px-4 py-3 rounded-xl bg-white/5 text-foreground hover:bg-white/10 transition-all text-sm font-medium"
              >
                Top Liquidity Pools
              </motion.button>
            </div>
          </Panel>
        </motion.div>
      </div>
    </div>
  );
}
