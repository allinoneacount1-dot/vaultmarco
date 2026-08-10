import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/marco/Panel";
import { DollarSign, ExternalLink, Copy, ArrowUpRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getPadreUrl } from "@/components/marco/shared/padreUrl";
import { getTokenIcon } from "@/components/marco/shared/tokenIcon";
import { useTokenBoosts, useAds, useCommunityTakeovers } from "@/hooks/useDexScreener";

export const Route = createFileRoute("/dashboard/paid-trending")({
  component: PaidTrendingPage,
});

function PaidTrendingPage() {
  const [toast, setToast] = useState<string | null>(null);
  const { data: tokenBoosts, isLoading: isLoadingBoosts } = useTokenBoosts();
  const { data: ads, isLoading: isLoadingAds } = useAds();
  const { data: takeovers, isLoading: isLoadingTakeovers } = useCommunityTakeovers();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast("CA copied to clipboard!");
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const formatVolume = (vol: number | undefined): string => {
    if (!vol) return "0";
    if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
    if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
    return vol.toFixed(0);
  };

  const dexScreenerPaid = [...(tokenBoosts || []), ...(ads || []), ...(takeovers || [])];
  const isLoading = isLoadingBoosts || isLoadingAds || isLoadingTakeovers;

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
        <h1 className="mb-2 font-display text-[22px] font-semibold uppercase tracking-[0.04em] text-(--bone)">Paid Trending</h1>
        <p className="text-muted-foreground">DexScreener & DexTools paid trending and boosts</p>
      </motion.div>

      {/* DexScreener Paid Trending */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <Panel title="DEXSCREENER PAID TRENDING" icon={DollarSign}>
          <div className="flex flex-col gap-4">
            <motion.a
              href="https://dexscreener.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-(--gold) hover:text-(--gold)/80 text-sm font-medium"
            >
              <ExternalLink className="size-4" />
              Open DexScreener in new tab
            </motion.a>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-(--gold)" />
              </div>
            ) : dexScreenerPaid.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No paid trending tokens available
              </div>
            ) : (
              <div className="space-y-3">
                {dexScreenerPaid.slice(0, 10).map((token, index) => {
                  const tokenData = {
                    ...token,
                    volume24h: token.volume24h || token.volume || 0,
                  };
                  const dexScreenerUrl = `https://dexscreener.com/${tokenData.chain}/${tokenData.tokenAddress}`;
                  const padreUrl = getPadreUrl(tokenData as any);
                  return (
                    <motion.div
                      key={tokenData.id || index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="rounded-md border border-(--hairline) p-4 hover:bg-(--panel-2) hover:border-(--hairline-strong) transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 rounded-full bg-(--panel-2) flex items-center justify-center overflow-hidden relative">
                            {tokenData.icon && (
                              <img
                                src={tokenData.icon}
                                alt={tokenData.symbol}
                                className="w-full h-full object-cover"
                              />
                            )}
                            {!tokenData.icon && (
                              <span className="text-(--gold) font-bold">{tokenData.symbol[0]}</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <a
                                href={dexScreenerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-foreground font-medium hover:text-(--gold) transition-colors"
                              >
                                {tokenData.symbol}
                              </a>
                              <span className="text-muted-foreground text-xs bg-(--panel-2) px-2 py-0.5 rounded-full">{tokenData.chain}</span>
                            </div>
                            <p className="text-muted-foreground text-xs">{tokenData.name}</p>
                            <p className="text-[10px] bg-(--panel-2) px-2 py-1 rounded-full font-mono truncate max-w-[200px] mt-1">
                              CA: {tokenData.tokenAddress.slice(0, 8)}...{tokenData.tokenAddress.slice(-6)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-foreground font-mono">
                              ${tokenData.price.toFixed(tokenData.price < 0.0001 ? 8 : 4)}
                            </p>
                            <p className={`text-xs font-mono ${(tokenData.change24h || 0) >= 0 ? 'text-(--up)' : 'text-(--down)'}`}>
                              {(tokenData.change24h || 0) >= 0 ? '+' : ''}{(tokenData.change24h || 0).toFixed(1)}%
                            </p>
                            <p className="text-muted-foreground text-xs mt-1">
                              Vol: {formatVolume(tokenData.volume24h as number)}
                            </p>
                            {(tokenData.boostAmount || tokenData.boostTier) && (
                              <p className="text-(--gold) text-xs font-bold mt-1">
                                {tokenData.boostAmount ? `Boost: ${tokenData.boostAmount}` : tokenData.boostTier}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <motion.button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                copyToClipboard(tokenData.tokenAddress);
                              }}
                              className="p-1.5 rounded-lg hover:bg-(--panel-2) text-muted-foreground hover:text-(--gold) transition-all"
                              title="Copy CA"
                            >
                              <Copy className="size-3.5" />
                            </motion.button>
                            <motion.a
                              href={padreUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg hover:bg-(--panel-2) text-muted-foreground hover:text-(--up) transition-all"
                              title="Trade on Padre"
                            >
                              <ExternalLink className="size-3.5" />
                            </motion.a>
                            <motion.a
                              href={dexScreenerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg hover:bg-(--panel-2) text-muted-foreground hover:text-(--gold) transition-all"
                              title="View on DexScreener"
                            >
                              <ArrowUpRight className="size-3.5" />
                            </motion.a>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>
      </motion.div>

      {/* DexTools Paid Trending */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <Panel title="DEXTOOLS PAID TRENDING" icon={DollarSign}>
          <div className="flex flex-col gap-4">
            <motion.a
              href="https://www.dextools.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-(--gold) hover:text-(--gold)/80 text-sm font-medium"
            >
              <ExternalLink className="size-4" />
              Open DexTools in new tab
            </motion.a>
            <div className="text-center text-muted-foreground py-8">
              DexTools API integration coming soon
            </div>
          </div>
        </Panel>
      </motion.div>
    </div>
  );
}
