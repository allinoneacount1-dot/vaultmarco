import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/marco/Panel";
import { Zap, TrendingUp, Copy, ExternalLink, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getPadreUrl } from "@/components/marco/shared/padreUrl";
import { getTokenIcon } from "@/components/marco/shared/tokenIcon";
import { getTierColor, formatNumber, formatPrice2, formatTimestamp } from "@/components/marco/shared/helpers";
import type { BoostTier, BoostToken } from "@/components/marco/shared/types";
import { useTopTokenBoosts } from "@/hooks/useDexScreener";

export const Route = createFileRoute("/dashboard/boost-feed")({
  component: BoostFeedPage,
});

function BoostFeedPage() {
  const [toast, setToast] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | "ALL">("ALL");

  const tiers: ("ALL" | BoostTier)[] = ["ALL", "Whale Boost", "High Boost", "Mid Boost", "Low Boost"];

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast("CA copied to clipboard!");
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const { data: boosts, isLoading } = useTopTokenBoosts();
  const filteredBoosts = (boosts || []).filter((boost) =>
    selectedTier === "ALL" || boost.boostTier === selectedTier
  );

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
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
        <h1 className="mb-2 font-display text-[22px] font-semibold uppercase tracking-[0.04em] text-(--bone)">Boost Feed</h1>
        <p className="text-muted-foreground">Real-time token boosts and promotions</p>
      </motion.div>

      {/* Filter Tabs */}
      <motion.div 
        className="flex gap-2 flex-wrap"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        {tiers.map((tier, index) => (
          <motion.button
            key={tier}
            onClick={() => setSelectedTier(tier)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
            className={`px-4 py-2 rounded-full text-[12px] font-mono transition-all border ${
              selectedTier === tier
                ? "border border-(--hairline-strong) text-(--gold) border-(--hairline-strong)"
                : "border-(--hairline) text-muted-foreground hover:text-foreground hover:border-white/20"
            }`}
          >
            {tier}
          </motion.button>
        ))}
      </motion.div>

      {/* Stats Cards */}
      <motion.div 
        className="grid md:grid-cols-4 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <Panel title="Active Boosts" icon={Zap} className="h-full">
          <div className="text-2xl font-mono text-foreground">{(boosts || []).length}</div>
          <div className="text-(--up) text-xs font-mono mt-1">Live now</div>
        </Panel>
        <Panel title="Total Boost Amount" icon={TrendingUp} className="h-full">
          <div className="text-2xl font-mono text-foreground">{formatNumber((boosts || []).reduce((sum, b) => sum + (b.boostAmount || 0), 0))}</div>
          <div className="text-(--up) text-xs font-mono mt-1">Total</div>
        </Panel>
        <Panel title="Top Boost Tier" icon={Zap} className="h-full">
          <div className="text-2xl font-mono text-foreground">{(boosts || []).length > 0 ? (boosts || []).sort((a, b) => (b.boostAmount || 0) - (a.boostAmount || 0))[0].boostTier : "-"}</div>
          <div className="text-(--champagne) text-xs font-mono mt-1">Best boost</div>
        </Panel>
        <Panel title="Avg Boost Price" icon={TrendingUp} className="h-full">
          <div className="text-2xl font-mono text-foreground">{(boosts || []).length > 0 ? formatNumber((boosts || []).reduce((sum, b) => sum + (b.boostAmount || 0), 0) / (boosts || []).length) : "-"}</div>
          <div className="text-muted-foreground text-xs font-mono mt-1">Per boost</div>
        </Panel>
      </motion.div>

      {/* Boost List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <Panel title="Live Boost Feed" icon={Zap}>
          <div className="space-y-4">
            {filteredBoosts.map((boost, index) => {
              const padreUrl = getPadreUrl(boost);
              return (
              <motion.div
                key={boost.id || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.08 }}
                className="rounded-md border border-(--hairline) p-5 hover:bg-(--panel-2) transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-full bg-(--panel-2) flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                          <img
                            src={getTokenIcon(boost)}
                            alt={boost.symbol}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const img = e.target as HTMLImageElement;
                              img.style.display = 'none';
                            }}
                          />
                          <span className="text-(--gold) font-bold">{boost.symbol[0]}</span>
                        </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${getTierColor(boost.boostTier)}`}>
                          {boost.boostTier}
                        </span>
                        <span className="px-2 py-0.5 rounded-full border border-(--hairline-strong) text-(--gold) text-[10px] font-mono">
                          {boost.chain}
                        </span>
                        <span className="text-foreground font-medium">{boost.symbol}</span>
                        <span className="text-muted-foreground text-sm">• {boost.name}</span>
                      </div>

                      <div className="text-xs text-muted-foreground mb-3 flex items-center gap-4 flex-wrap">
                        <span>DEX: {boost.dex}</span>
                        <span className="bg-(--panel-2) px-2 py-1 rounded-full font-mono truncate max-w-[200px]">
                          CA: {boost.tokenAddress.slice(0, 8)}...{boost.tokenAddress.slice(-6)}
                        </span>
                      </div>

                      <div className="flex gap-6 text-sm">
                        <div>
                          <span className="text-muted-foreground text-xs">Price</span>
                          <div className="text-foreground font-mono">
                            {formatPrice2(boost.price)}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">24h Change</span>
                          <div className={`font-mono ${boost.change24h >= 0 ? 'text-(--up)' : 'text-(--down)'}`}>
                            {boost.change24h >= 0 ? '+' : ''}{boost.change24h.toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">Volume</span>
                          <div className="text-foreground font-mono">{formatNumber(boost.volume24h)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">Boost Amount</span>
                          <div className="text-(--gold) font-mono font-bold">{formatNumber(boost.boostAmount)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <motion.button
                      onClick={() => copyToClipboard(boost.tokenAddress)}
                      className="p-2 rounded-lg hover:bg-(--panel-2) text-muted-foreground hover:text-(--gold) transition-all"
                      title="Copy CA"
                    >
                      <Copy className="size-4" />
                    </motion.button>
                    <motion.a
                      href={padreUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-(--panel-2) text-muted-foreground hover:text-(--up) transition-all"
                      title="Trade on Padre"
                    >
                      <ExternalLink className="size-4" />
                    </motion.a>
                    <motion.a
                      href={`https://dexscreener.com/${boost.chain.toLowerCase()}/${boost.tokenAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-(--panel-2) text-muted-foreground hover:text-(--gold) transition-all"
                      title="View on DexScreener"
                    >
                      <ArrowUpRight className="size-4" />
                    </motion.a>
                  </div>
                </div>
              </motion.div>
            )})}
          </div>
        </Panel>
      </motion.div>
    </div>
  );
}
