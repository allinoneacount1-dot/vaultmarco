import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/marco/Panel";
import { Users, ExternalLink, Copy, ArrowUpRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getPadreUrl } from "@/components/marco/shared/padreUrl";
import { getTokenIcon } from "@/components/marco/shared/tokenIcon";
import { useCommunityTakeovers } from "@/hooks/useDexScreener";

export const Route = createFileRoute("/dashboard/community-takeovers")({
  component: CommunityTakeoversPage,
});

function CommunityTakeoversPage() {
  const [toast, setToast] = useState<string | null>(null);
  const { data: takeovers, isLoading } = useCommunityTakeovers();

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
        <h1 className="mb-2 font-display text-[22px] font-semibold uppercase tracking-[0.04em] text-(--bone)">Community Takeovers</h1>
        <p className="text-muted-foreground">Live community takeovers from DexScreener</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <Panel title="COMMUNITY TAKEOVERS" icon={Users}>
          <div className="flex flex-col gap-4">
            <motion.a
              href="https://dexscreener.com/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-(--gold) hover:text-(--gold)/80 text-sm font-medium"
            >
              <ExternalLink className="size-4" />
              Open DexScreener in new tab
            </motion.a>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-(--gold)" />
              </div>
            ) : (takeovers || []).length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No community takeovers available
              </div>
            ) : (
              <div className="space-y-3">
                {(takeovers || []).map((token, index) => {
                  const dexScreenerUrl = `https://dexscreener.com/${token.chain}/${token.tokenAddress}`;
                  const padreUrl = getPadreUrl(token as any);
                  return (
                    <motion.div
                      key={token.id || index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="rounded-md border border-(--hairline) p-4 hover:bg-(--panel-2) hover:border-(--hairline-strong) transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center overflow-hidden relative">
                            {getTokenIcon(token) ? (
                              <img
                                src={getTokenIcon(token)}
                                alt={token.symbol}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-(--champagne) font-bold">{token.symbol[0]}</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <a
                                href={dexScreenerUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-foreground font-medium hover:text-(--champagne) transition-colors"
                              >
                                {token.symbol}
                              </a>
                              <span className="text-muted-foreground text-xs bg-transparent px-2 py-0.5 rounded-full">{token.chain}</span>
                            </div>
                            <p className="text-muted-foreground text-xs">{token.name}</p>
                            <p className="text-[10px] bg-(--panel-2) px-2 py-1 rounded-full font-mono truncate max-w-[200px] mt-1">
                              CA: {token.tokenAddress.slice(0, 8)}...{token.tokenAddress.slice(-6)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-foreground font-mono">
                              ${token.price.toFixed(token.price < 0.0001 ? 8 : 4)}
                            </p>
                            <p className={`text-xs font-mono ${(token.change24h || 0) >= 0 ? 'text-(--up)' : 'text-(--down)'}`}>
                              {(token.change24h || 0) >= 0 ? '+' : ''}{(token.change24h || 0).toFixed(1)}%
                            </p>
                            <p className="text-muted-foreground text-xs mt-1">
                              Vol: {formatVolume(token.volume)}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <motion.button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                copyToClipboard(token.tokenAddress);
                              }}
                              className="p-1.5 rounded-lg hover:bg-(--panel-2) text-muted-foreground hover:text-(--champagne) transition-all"
                              title="Copy CA"
                            >
                              <Copy className="size-3.5" />
                            </motion.button>
                            <motion.a
                              href={padreUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg hover:bg-(--panel-2) text-muted-foreground hover:text-(--up) transition-all"
                              title="Trade on Padre"
                            >
                              <ExternalLink className="size-3.5" />
                            </motion.a>
                            <motion.a
                              href={dexScreenerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg hover:bg-(--panel-2) text-muted-foreground hover:text-(--champagne) transition-all"
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
    </div>
  );
}
