import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/marco/Panel";
import { Zap, TrendingUp, ArrowUpRight, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Import Shared Types & DexScreener hooks
import type { Chain, BoostToken, AdToken } from "@/components/marco/shared/types";
import { getTokenIcon } from "@/components/marco/shared/tokenIcon";
import { getPadreUrl } from "@/components/marco/shared/padreUrl";
import { CHAIN_MAP, getTierColor, getAdTypeIcon, formatTimestamp, formatNumber, formatPrice2 } from "@/components/marco/shared/helpers";
import { useTokenBoosts, useAds } from "@/hooks/useDexScreener";

export const Route = createFileRoute("/dashboard/dex-trending")({
  component: DexTrending,
});

function DexTrending() {
  const [selectedChain, setSelectedChain] = useState<Chain>("all");
  const [toast, setToast] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast("CA copied to clipboard!");
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Use DexScreener API
  const { data: boosts, isLoading: boostsLoading } = useTokenBoosts();
  const { data: ads, isLoading: adsLoading } = useAds();

  const filteredBoosts = (boosts || []).filter((token: BoostToken) =>
    selectedChain === "all" || token.chain === selectedChain
  ).sort((a: BoostToken, b: BoostToken) => {
    if (b.boostAmount !== a.boostAmount) return b.boostAmount - a.boostAmount;
    return b.volume24h - a.volume24h;
  });

  const filteredAds = (ads || []).filter((token: AdToken) =>
    selectedChain === "all" || token.chain === selectedChain
  ).sort((a: AdToken, b: AdToken) => {
    if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
    return b.liquidity - a.liquidity;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 bg-primary text-background px-4 py-2 rounded-lg shadow-lg z-50 font-mono text-sm"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-3xl font-bold text-gradient mb-2">DEX Trending</h1>
        <p className="text-muted-foreground">Real-time intelligence for trending tokens, boosted promotions, and ads</p>
      </motion.div>

      <motion.div 
        className="flex gap-2 flex-wrap mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        {(
          [
            { id: "all", label: "ALL" },
            { id: "sol", label: "SOL" },
            { id: "eth", label: "ETH" },
            { id: "base", label: "BASE" },
            { id: "bnb", label: "BNB" }
          ] as const
        ).map((chain, index) => (
          <motion.button
            key={chain.id}
            onClick={() => setSelectedChain(chain.id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
            className={`px-4 py-2 rounded-full text-[11px] font-mono transition-all border ${
                selectedChain === chain.id
                  ? "bg-primary/20 text-primary border-primary/30"
                  : "border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20"
              }`}
          >
            {chain.label}
          </motion.button>
        ))}
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Boost Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Panel title="BOOST FEED · LIVE" icon={Zap}>
            <div className="space-y-3">
              {boostsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.05 }}
                    className="rounded-xl border border-white/10 p-3"
                  >
                    <div className="h-4 w-24 bg-white/10 rounded animate-pulse mb-2" />
                    <div className="h-3 w-48 bg-white/5 rounded animate-pulse" />
                  </motion.div>
                ))
              ) : (
                filteredBoosts.map((token: BoostToken, i: number) => {
                  const chain = CHAIN_MAP[token.chain] || token.chain;
                  const url = `https://dexscreener.com/${chain}/${token.tokenAddress}`;
                  const padreUrl = getPadreUrl(token);
                  return (
                    <motion.div
                      key={token.id || i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.05 }}
                      whileHover={{ scale: 1.01, x: 5 }}
                      className="rounded-xl border border-white/10 p-3 hover:bg-white/5 hover:border-primary/30 transition-all group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1">
                          <img 
                            src={getTokenIcon(token)} 
                            alt={token.symbol}
                            className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0"
                            onError={(e) => {
                              // Fallback if image fails
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${getTierColor(token.boostTier)}`}>
                                {token.boostTier}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-mono">
                                {token.chain.toUpperCase()}
                              </span>
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[12px] font-mono text-foreground hover:text-primary transition-colors"
                              >
                                {token.symbol} · {token.name}
                              </a>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                              <span>DEX: {token.dex}</span>
                              <span>Vol: {formatNumber(token.volume24h)}</span>
                              <span>Boost: {formatNumber(token.boostAmount)}</span>
                              <span className="text-[10px] bg-white/5 px-2 py-1 rounded-full font-mono truncate max-w-[150px]">
                                CA: {token.tokenAddress.slice(0, 8)}...{token.tokenAddress.slice(-6)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right mr-2">
                            <div className="text-[12px] font-mono text-foreground">
                              {formatPrice2(token.price)}
                            </div>
                            <div className={`text-[11px] font-mono mt-1 ${
                                token.change24h > 0 ? "text-accent" : "text-red-400"
                              }`}
                            >
                              {token.change24h >= 0 ? "+" : ""}{token.change24h.toFixed(1)}%
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                copyToClipboard(token.tokenAddress);
                              }}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-primary transition-all"
                              title="Copy CA"
                            >
                              <Copy className="size-3.5" />
                            </motion.button>
                            <motion.a
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              href={padreUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-green-400 transition-all"
                              title="Trade on Padre"
                            >
                              <ExternalLink className="size-3.5" />
                            </motion.a>
                            <motion.a
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-primary transition-all"
                              title="View on DexScreener"
                            >
                              <ArrowUpRight className="size-3.5" />
                            </motion.a>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </Panel>
        </motion.div>

        {/* Ads Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Panel title="ADS FEED · LIVE" icon={TrendingUp}>
            <div className="space-y-3">
              {adsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    className="rounded-xl border border-white/10 p-3"
                  >
                    <div className="h-4 w-24 bg-white/10 rounded animate-pulse mb-2" />
                    <div className="h-3 w-48 bg-white/5 rounded animate-pulse" />
                  </motion.div>
                ))
              ) : (
                filteredAds.map((token: AdToken, i: number) => {
                  const chain = CHAIN_MAP[token.chain] || token.chain;
                  const url = `https://dexscreener.com/${chain}/${token.tokenAddress}`;
                  const padreUrl = getPadreUrl(token);
                  return (
                    <motion.div
                      key={token.id || i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      whileHover={{ scale: 1.01, x: 5 }}
                      className="rounded-xl border border-white/10 p-3 hover:bg-white/5 hover:border-violet-500/30 transition-all group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1">
                          <img 
                            src={getTokenIcon(token)} 
                            alt={token.symbol}
                            className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0"
                            onError={(e) => {
                              // Fallback if image fails
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[12px]">{getAdTypeIcon(token.type)}</span>
                              <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 text-[10px] font-mono border border-violet-500/30">
                                {token.type.toUpperCase()}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-mono">
                                {token.chain.toUpperCase()}
                              </span>
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[12px] font-mono text-foreground hover:text-violet-400 transition-colors"
                              >
                                {token.symbol} · {token.name}
                              </a>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                              <span>Liq: {formatNumber(token.liquidity)}</span>
                              <span>Vol: {formatNumber(token.volume)}</span>
                              <span>{formatTimestamp(token.timestamp)}</span>
                              <span className="text-[10px] bg-white/5 px-2 py-1 rounded-full font-mono truncate max-w-[150px]">
                                CA: {token.tokenAddress.slice(0, 8)}...{token.tokenAddress.slice(-6)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right mr-2">
                            <div className="text-[12px] font-mono text-foreground">
                              {formatPrice2(token.price)}
                            </div>
                            <div className={`text-[11px] font-mono mt-1 ${
                                token.change24h > 0 ? "text-accent" : "text-red-400"
                              }`}
                            >
                              {token.change24h >= 0 ? "+" : ""}{token.change24h.toFixed(1)}%
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                copyToClipboard(token.tokenAddress);
                              }}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-violet-400 transition-all"
                              title="Copy CA"
                            >
                              <Copy className="size-3.5" />
                            </motion.button>
                            <motion.a
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              href={padreUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-green-400 transition-all"
                              title="Trade on Padre"
                            >
                              <ExternalLink className="size-3.5" />
                            </motion.a>
                            <motion.a
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-violet-400 transition-all"
                              title="View on DexScreener"
                            >
                              <ArrowUpRight className="size-3.5" />
                            </motion.a>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </Panel>
        </motion.div>
      </div>
    </div>
  );
}