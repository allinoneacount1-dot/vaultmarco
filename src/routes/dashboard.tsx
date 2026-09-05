import { createFileRoute, Outlet } from "@tanstack/react-router";
// `memo` MUST come from React. framer-motion also exports a `memo`, but it is a
// one-shot value cache (`if (result === undefined) result = callback()`), which
// freezes this component on its first render and makes every feed below stick
// on its loading placeholder forever.
import { memo } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/marco/DashboardLayout";
import { KPICards } from "@/components/marco/KPICards";
import { Panel } from "@/components/marco/Panel";
import { Activity, TrendingUp, Zap, Eye } from "lucide-react";
import { DexRealtimeTab } from "@/components/marco/DexRealtimeTab";
import { useTokenBoosts, useAds, type FeedStatus } from "@/hooks/useDexScreener";
import { useGlobalStats } from "@/hooks/useGlobalStats";
import { getTierColor, getAdTypeIcon, formatNumber, formatPrice2 } from "@/components/marco/shared/helpers";
import type { BoostToken, AdToken } from "@/components/marco/shared/types";

function DashboardComponent() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}

export const Route = createFileRoute("/dashboard")({
  component: DashboardComponent,
});

/** Renders an unknown numeric as an em dash rather than a fabricated zero. */
const money = (n: number | null | undefined) => (n == null ? "—" : formatNumber(n));
const price = (n: number | null | undefined) => (n == null ? "—" : formatPrice2(n));
const pct = (n: number | null | undefined) =>
  n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

/** One line explaining why a feed panel is empty. Never shown while loading. */
function FeedNotice({ status }: { status: FeedStatus }) {
  const message =
    status === "offline"
      ? "Feed unavailable — DexScreener could not be reached."
      : status === "stale"
        ? "Showing last known data — DexScreener is not responding."
        : "No records reported.";
  return <div className="text-[11px] lg:text-[12px] text-muted-foreground">{message}</div>;
}

const DashboardIndex = memo(function DashboardIndex() {
  const { data: boosts, providerStatus: boostsStatus } = useTokenBoosts();
  const { data: ads, providerStatus: adsStatus } = useAds();
  const { data: gs } = useGlobalStats();

  const boostsLoading = boostsStatus === "loading";
  const adsLoading = adsStatus === "loading";
  const boostRows = boostsLoading
    ? Array.from<BoostToken | undefined>({ length: 3 })
    : (boosts ?? []).slice(0, 3);
  const adRows = adsLoading
    ? Array.from<AdToken | undefined>({ length: 3 })
    : (ads ?? []).slice(0, 3);

  const fmtT = (n: number | null | undefined) =>
    n == null ? "…" : n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T` : `$${(n / 1e9).toFixed(0)}B`;
  const quickStats = [
    {
      label: "BTC Dominance",
      value: gs?.btcDominance != null ? `${gs.btcDominance.toFixed(1)}%` : "…",
      color: "text-(--bone)",
    },
    {
      label: "Total Market Cap",
      value: fmtT(gs?.totalMcap),
      color: "text-(--bone)",
    },
    {
      label: "Market Cap 24h",
      value: gs?.mcapChange24h != null ? `${gs.mcapChange24h >= 0 ? "+" : ""}${gs.mcapChange24h.toFixed(2)}%` : "…",
      color: (gs?.mcapChange24h ?? 0) >= 0 ? "text-(--up)" : "text-(--down)",
    },
    {
      label: "Fear & Greed",
      value: gs?.fearGreed != null ? `${gs.fearGreed} (${gs.fearGreedLabel ?? ""})` : "…",
      color: "text-(--gold)",
    },
  ];

  return (
    <div className="space-y-4 lg:space-y-6">
      <motion.div 
        className="mb-6 lg:mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="mb-2 font-display text-[22px] font-semibold uppercase tracking-[0.04em] text-(--bone)">Dashboard</h1>
        <p className="text-muted-foreground text-sm lg:text-base">Overview of your crypto intelligence platform</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <KPICards />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
        {/* Boost Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20,  }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Panel title="BOOST FEED · LIVE" icon={Zap}>
            <div className="space-y-2 lg:space-y-3">
              {!boostsLoading && boostRows.length === 0 && <FeedNotice status={boostsStatus} />}
              {boostRows.map((token, i) => (
                <motion.div 
                  key={token?.id || i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex items-center justify-between rounded-md border border-(--hairline) p-2 lg:p-3 hover:bg-(--panel-2) transition-all"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {token && (
                        <>
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] lg:text-[10px] font-mono border ${getTierColor(token.boostTier || "Low Boost")}`}>
                            {token.boostTier || "Low Boost"}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-full border border-(--hairline-strong) text-(--gold) text-[9px] lg:text-[10px] font-mono">
                            {(token.chain || "eth").toUpperCase()}
                          </span>
                        </>
                      )}
                      <span className="text-[11px] lg:text-[12px] font-mono text-foreground truncate">{token?.symbol || "Loading..."}</span>
                    </div>
                    {token && (
                      <div className="text-[10px] lg:text-[11px] text-muted-foreground mt-1">
                        Vol: {money(token.volume24h)} • Boost: {money(token.boostAmount)}
                      </div>
                    )}
                  </div>
                  {token && (
                    <div className="text-right flex-shrink-0">
                      <div className="text-[11px] lg:text-[12px] font-mono text-foreground">{price(token.price)}</div>
                      <div className={`text-[10px] lg:text-[11px] font-mono mt-1 ${(token.change24h ?? 0) >= 0 ? "text-(--up)" : "text-(--down)"}`}>
                        {pct(token.change24h)}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </Panel>
        </motion.div>

        {/* Ads Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20,  }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Panel title="ADS FEED · LIVE" icon={TrendingUp}>
            <div className="space-y-2 lg:space-y-3">
              {!adsLoading && adRows.length === 0 && <FeedNotice status={adsStatus} />}
              {adRows.map((token, i) => (
                <motion.div 
                  key={token?.id || i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex items-center justify-between rounded-md border border-(--hairline) p-2 lg:p-3 hover:bg-(--panel-2) transition-all"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {token && (
                        <>
                          <span className="text-[11px] lg:text-[12px]">{getAdTypeIcon(token.type || "Ad")}</span>
                          <span className="px-1.5 py-0.5 rounded-full bg-transparent text-(--champagne) text-[9px] lg:text-[10px] font-mono border border-(--hairline-strong)">
                            {(token.type || "Ad").toUpperCase()}
                          </span>
                        </>
                      )}
                      <span className="text-[11px] lg:text-[12px] font-mono text-foreground truncate">{token?.symbol || "Loading..."}</span>
                    </div>
                    {token && (
                      <div className="text-[10px] lg:text-[11px] text-muted-foreground mt-1">
                        Liq: {money(token.liquidity)} • Vol: {money(token.volume)}
                      </div>
                    )}
                  </div>
                  {token && (
                    <div className="text-right flex-shrink-0">
                      <div className="text-[11px] lg:text-[12px] font-mono text-foreground">{price(token.price)}</div>
                      <div className={`text-[10px] lg:text-[11px] font-mono mt-1 ${(token.change24h ?? 0) >= 0 ? "text-(--up)" : "text-(--down)"}`}>
                        {pct(token.change24h)}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </Panel>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20,  }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Panel title="QUICK STATS" icon={Activity}>
            <div className="space-y-2">
              {quickStats.map((stat, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
                  className="flex items-center justify-between py-1.5 lg:py-2 border-b border-(--hairline) last:border-0"
                >
                  <span className="text-[11px] lg:text-[12px] font-mono text-muted-foreground">{stat.label}</span>
                  <span className={`text-[11px] lg:text-[12px] font-mono ${stat.color}`}>{stat.value}</span>
                </motion.div>
              ))}
            </div>
          </Panel>
        </motion.div>

        {/* DEX Realtime (full width) */}
        <motion.div 
          className="xl:col-span-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <Panel title="DEX REALTIME · LIVE" icon={Eye}>
            <DexRealtimeTab />
          </Panel>
        </motion.div>
      </div>
    </div>
  );
});

export { DashboardIndex };
