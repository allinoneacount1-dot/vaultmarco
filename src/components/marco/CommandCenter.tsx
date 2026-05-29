import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, Eye, Radar, Cpu, Brain, LineChart, ShieldAlert, Star } from "lucide-react";
import {
  useMarketPrices,
  formatPrice,
  useChainHeatmap,
  useVolumeData,
  useMarketAlerts,
  formatVolume,
  MarketCoin,
} from "@/hooks/useMarketPrices";
import { usePriceAlerts } from "@/hooks/usePriceAlerts";
import { Skeleton, SkeletonRow } from "./Skeleton";
import { useWatchlist } from "@/hooks/useWatchlist";
import { PriceAlertsPanel } from "./PriceAlertsPanel";
import { Panel, Row } from "./Panel";
import { RugScannerModal } from "./RugScannerModal";
import { DexRealtimeTab } from "./DexRealtimeTab";
import { PriceChart } from "./PriceChart";
import { SectionHeader, fadeUp } from "./SectionHeader";

export function CommandCenter() {
  const { data, isLoading, isError } = useMarketPrices();
  const { checkAlerts } = usePriceAlerts();
  const heatmap = useChainHeatmap(data);
  const volumeData = useVolumeData(data);
  const [activeTab, setActiveTab] = useState("default");

  // Check alerts whenever market data updates
  useEffect(() => {
    if (data) {
      checkAlerts(data);
    }
  }, [data, checkAlerts]);

  const tabs = [
    { id: "default", label: "All Panels" },
    { id: "dex", label: "DEX Realtime" },
    { id: "chart", label: "Price Chart" },
  ];

  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div {...fadeUp}>
          <SectionHeader
            kicker="04 / COMMAND CENTER"
            title="Inside The Vault."
            sub="A cinematic surface that fuses live market data, charts, scanners, alerts and AI signals into one professional crypto command center. All panels stream real-time data from CoinGecko."
          />
        </motion.div>

        <motion.div {...fadeUp} className="mt-10 mb-6 flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-[11px] font-mono transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground glow-cyan"
                  : "glass text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </motion.div>

        <motion.div {...fadeUp} className="grid lg:grid-cols-3 gap-5">
          {activeTab === "default" && (
            <>
              <LiveMarketPanel data={data} isLoading={isLoading} isError={isError} />

              <Panel title="WALLET TRACKING · LIVE" icon={Eye}>
                {[
                  ["0x4f...d21a", "ETH", "+$182k"],
                  ["7Gp...J9xQ", "SOL", "+$58k"],
                  ["0x91...77ee", "BASE", "-$11k"],
                  ["8Aq...kZv2", "HYPE", "+$94k"],
                ].map(([a, c, p]) => (
                  <Row key={a} label={a} mid={c} value={p} ok={!p.startsWith("-")} />
                ))}
              </Panel>

              <Panel title="TOKEN SCANNER · LIVE" icon={Radar}>
                {(data ?? []).slice(0, 4).map((c) => (
                  <Row
                    key={c.id}
                    label={c.sym}
                    mid={c.name.slice(0, 8)}
                    value={`${c.ch >= 0 ? "+" : ""}${c.ch.toFixed(1)}%`}
                    ok={c.ch >= 0}
                  />
                ))}
              </Panel>

              <Panel title="CHAIN HEATMAP · LIVE" icon={Cpu}>
                <div className="grid grid-cols-4 gap-1.5 mt-1">
                  {!data
                    ? Array.from({ length: 12 }).map((_, i) => (
                        <Skeleton key={i} className="aspect-square" />
                      ))
                    : heatmap.map((c) => (
                        <motion.div
                          key={c.sym}
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.3 }}
                          className="aspect-square rounded grid place-items-center text-[9px] font-mono cursor-pointer hover:scale-110 transition-transform"
                          style={{
                            background:
                              c.ch >= 0
                                ? `linear-gradient(135deg, oklch(0.88 0.2 165 / ${0.3 + c.heat / 200}), oklch(0.6 0.18 165 / ${0.2 + c.heat / 300}))`
                                : `linear-gradient(135deg, oklch(0.6 0.24 27 / ${0.3 + c.heat / 200}), oklch(0.4 0.2 27 / ${0.2 + c.heat / 300}))`,
                            color: c.heat > 60 ? "#050505" : "white",
                            boxShadow:
                              c.heat > 50
                                ? `0 0 ${c.heat / 2}px ${c.ch >= 0 ? "oklch(0.88 0.2 165 / 0.5)" : "oklch(0.6 0.24 27 / 0.5)"}`
                                : "none",
                          }}
                          title={`${c.sym}: ${c.ch >= 0 ? "+" : ""}${c.ch.toFixed(1)}%`}
                        >
                          {c.sym}
                        </motion.div>
                      ))}
                </div>
              </Panel>

              <Panel title="AI SIGNAL FEED · LIVE" icon={Brain}>
                {[
                  "Narrative shift: AI-agents +18%",
                  "Whale rotation SOL → HYPE",
                  "Volume surge on BASE memes",
                  "MEV alert: backrun detected",
                  "New listing on major exchange",
                ].map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className="text-[11px] font-mono text-muted-foreground flex gap-2"
                  >
                    <span className="text-violet-300">›</span>
                    <span>{s}</span>
                  </motion.div>
                ))}
              </Panel>

              <PriceAlertsPanel marketData={data} />

              <Panel title="VOLUME INDICATORS · LIVE" icon={LineChart}>
                <div className="space-y-2 mt-1">
                  {!data
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="h-3 w-12" />
                          <Skeleton className="flex-1 h-3" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      ))
                    : volumeData.map((v, i) => (
                        <motion.div
                          key={v.sym}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ duration: 0.4, delay: i * 0.05 }}
                          className="flex items-center gap-3"
                        >
                          <span className="text-[11px] font-mono w-12 text-foreground">
                            {v.sym}
                          </span>
                          <div className="flex-1 h-3 bg-white/5 rounded-sm overflow-hidden">
                            <motion.div
                              className="h-full rounded-sm"
                              style={{ background: v.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, (v.volume / 1e10) * 100)}%` }}
                              transition={{ duration: 0.8, delay: i * 0.05 }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground w-20 text-right">
                            {formatVolume(v.volume)}
                          </span>
                        </motion.div>
                      ))}
                </div>
              </Panel>
            </>
          )}

          {activeTab === "dex" && (
            <div className="lg:col-span-3">
              <DexRealtimeTab />
            </div>
          )}
          {activeTab === "chart" && (
            <div className="lg:col-span-3">
              <Panel title="PRICE CHART · LIVE" icon={Activity}>
                <PriceChart />
              </Panel>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

function LiveMarketPanel({
  data,
  isLoading,
  isError,
}: {
  data?: MarketCoin[];
  isLoading?: boolean;
  isError?: boolean;
}) {
  const { addToWatchlist, isInWatchlist } = useWatchlist();
  const [scanningToken, setScanningToken] = useState<{ sym: string; name: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const coins = (data ?? []).slice(0, 8);

  // Mock AI scoring function
  const getAIScore = (sym: string) => {
    const scores: Record<string, number> = {
      BTC: 95,
      ETH: 92,
      SOL: 88,
      HYPE: 75,
      BONK: 65,
      PEPE: 55,
      SUI: 78,
      TON: 82,
      BNB: 85,
      AVAX: 79,
      ARB: 80,
      OP: 77,
      POL: 74,
      LINK: 86,
      DOGE: 60,
      SHIB: 50,
    };
    return scores[sym] ?? Math.floor(Math.random() * 60) + 40;
  };

  return (
    <>
      <div className="glass-strong border-glow rounded-2xl p-5 scanline lg:col-span-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
            <span className="text-[10px] font-mono tracking-[0.3em] text-accent flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-accent animate-pulse-glow" />
              LIVE MARKET · COINGECKO
            </span>
            <Activity className="size-3.5 text-accent" />
          </div>
          <div className="space-y-2">
            {isError && (
              <div className="text-[11px] font-mono text-red-400">
                Market feed offline — retrying…
              </div>
            )}
            {isLoading && !data && <SkeletonRow />}
            {coins.map((c, i) => {
              const aiScore = getAIScore(c.sym);
              return (
                <motion.div
                  key={c.sym}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="flex items-center justify-between text-[11px] font-mono hover:bg-white/5 rounded-lg px-2 py-1 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-foreground w-12">{c.sym}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono ${
                        aiScore > 80
                          ? "bg-accent/20 text-accent"
                          : aiScore > 60
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {aiScore}
                    </span>
                  </div>
                  <span className="text-muted-foreground tabular-nums flex-1 text-right px-2">
                    {formatPrice(c.px)}
                  </span>
                  <span
                    className={`tabular-nums w-16 text-right ${c.ch < 0 ? "text-red-400" : "text-accent"}`}
                  >
                    {c.ch >= 0 ? "+" : ""}
                    {c.ch.toFixed(2)}%
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setScanningToken({ sym: c.sym, name: c.name });
                        setIsModalOpen(true);
                      }}
                      className="p-1 rounded-full text-muted-foreground hover:text-accent hover:bg-white/5 transition-all"
                      aria-label={`Scan ${c.sym} for rug`}
                      title="Scan Rug"
                    >
                      <ShieldAlert className="size-3.5" />
                    </button>
                    <button
                      onClick={() => addToWatchlist({ id: c.id, sym: c.sym, name: c.name })}
                      className={`p-1 rounded-full transition-colors ${
                        isInWatchlist(c.id)
                          ? "text-accent bg-accent/10"
                          : "text-muted-foreground hover:text-accent"
                      }`}
                      aria-label={`Add ${c.sym} to watchlist`}
                      title="Add to watchlist"
                    >
                      <Star
                        className="size-3.5"
                        fill={isInWatchlist(c.id) ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
      <RugScannerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        token={scanningToken}
      />
    </>
  );
}
