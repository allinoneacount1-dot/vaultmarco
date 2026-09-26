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
import { Activity, TrendingUp, Zap } from "lucide-react";
import { DexRealtimeTab } from "@/components/marco/DexRealtimeTab";
import { MarketChartPanel } from "@/components/marco/MarketChartPanel";
import { AlphaRadarPanel } from "@/components/marco/AlphaRadarPanel";
import { TokenDrawer } from "@/components/marco/TokenDrawer";
import { TokenDrawerProvider } from "@/components/marco/TokenDrawerProvider";
import { useTokenDrawerActions } from "@/hooks/useTokenDrawer";
import { refFromAd, refFromBoost } from "@/lib/tokenDrawer";
import { useTokenBoosts, useAds, type FeedStatus } from "@/hooks/useDexScreener";
import { useGlobalStats } from "@/hooks/useGlobalStats";
import { getTierColor, formatNumber } from "@/components/marco/shared/helpers";
import { TapeSkeleton } from "@/components/marco/Skeleton";
import { Pct, Price, StateDot, Tick, Zone } from "@/components/marco/desk";
import { useRadar } from "@/hooks/usePairUniverse";
import { useArrivals } from "@/hooks/useArrivals";
import { STATE_TEXT, feedState, type DeskState } from "@/lib/deskState";
import type { TokenRef } from "@/lib/tokenDrawer";
import { enterGroup } from "@/lib/motion";

function DashboardComponent() {
  // The Token Intelligence Drawer is mounted once here, with the dashboard,
  // so opening it never mounts a new data observer.
  return (
    <TokenDrawerProvider>
      <DashboardLayout>
        <Outlet />
      </DashboardLayout>
      <TokenDrawer />
    </TokenDrawerProvider>
  );
}

export const Route = createFileRoute("/dashboard")({
  component: DashboardComponent,
});

/** Renders an unknown numeric as an em dash rather than a fabricated zero. */
const money = (n: number | null | undefined) => (n == null ? "—" : formatNumber(n));
const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

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

type TapeItem = {
  key: string;
  ref: TokenRef;
  symbol: string;
  chips: React.ReactNode;
  detail: string;
  price: number | null | undefined;
  change: number | null | undefined;
};

/**
 * Market-tape rows (Boost / Ads feeds): hairline-separated lines, not cards in
 * a card. A row that arrives after first paint gets a brief tint; a price that
 * actually changes flashes its direction — nothing else moves.
 */
function Tape({ items, status, label }: { items: TapeItem[]; status: FeedStatus; label: string }) {
  const { open: openToken } = useTokenDrawerActions();
  const fresh = useArrivals(
    items.map((i) => i.key),
    status !== "loading",
  );
  if (status === "loading") return <TapeSkeleton rows={3} label={`Loading ${label}`} />;
  if (items.length === 0) return <FeedNotice status={status} />;
  return (
    <div className="mv-tape -mx-2">
      {items.map((t) => (
        <button
          type="button"
          key={t.key}
          onClick={(e) => openToken(t.ref, e.currentTarget)}
          className={`mv-row flex w-full cursor-pointer items-center justify-between gap-3 rounded-sm px-2 py-2.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--gold) ${
            fresh.has(t.key) ? "mv-row-new" : ""
          }`}
        >
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-mono text-[12px] text-(--bone)">{t.symbol}</span>
              {t.chips}
            </div>
            <div className="mono-data mt-1 truncate text-[10px] text-muted-foreground lg:text-[11px]">
              {t.detail}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <Price value={t.price} className="block text-[12px] text-(--bone)" />
            <Pct value={t.change} className="mt-1 block text-[10px] lg:text-[11px]" />
          </div>
        </button>
      ))}
    </div>
  );
}

/**
 * The desk's first read: is intelligence live, since when, over what, and
 * where to look. Every figure comes from the current universe round.
 */
function DeskSummary() {
  const { status, universe } = useRadar();
  const state: DeskState = status;
  const radar = universe?.radar;
  const signals = radar ? radar.momentum.length + radar.risk.length : null;
  const facts: { k: string; v: React.ReactNode }[] = [
    {
      k: "ROUND",
      v: universe ? (
        <span className="flex items-center gap-2">
          <StateDot
            state={state}
            className={state === "live" ? "text-(--gold)" : "text-(--champagne)"}
          />
          {clock(universe.observedAt)} · {STATE_TEXT[state]}
        </span>
      ) : state === "loading" ? (
        "WAITING FOR FIRST ROUND"
      ) : (
        "NO CURRENT ROUND"
      ),
    },
    { k: "UNIVERSE", v: radar ? `${radar.universeSize} PAIRS` : "—" },
    {
      k: "SIGNALS",
      v:
        radar && signals != null ? (
          <a
            href="#signal"
            className="-my-2 inline-block py-2 underline-offset-4 transition-colors duration-(--dur-micro) hover:text-(--gold) hover:underline"
          >
            {radar.momentum.length} MOMENTUM · {radar.risk.length} RISK
          </a>
        ) : (
          "—"
        ),
    },
  ];
  return (
    <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="font-display text-[20px] font-semibold uppercase tracking-[0.04em] text-(--bone) lg:text-[24px]">
          Intelligence Desk
        </h1>
        <p className="mono-label mt-2 text-[9px]!">On-chain / market intelligence</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:gap-x-10">
        {facts.map((f) => (
          <div key={f.k} className={`min-w-0 ${f.k === "ROUND" ? "col-span-2 sm:col-span-1" : ""}`}>
            <dt className="mono-label text-[9px]!">{f.k}</dt>
            <dd className="mono-data mt-1.5 truncate text-[11px] tracking-[0.04em] text-(--bone)">
              {f.v}
            </dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

const DashboardIndex = memo(function DashboardIndex() {
  const { data: boosts, providerStatus: boostsStatus } = useTokenBoosts();
  const { data: ads, providerStatus: adsStatus } = useAds();
  const { data: gs, isPending: gsPending } = useGlobalStats();

  const boostItems: TapeItem[] = (boosts ?? []).slice(0, 3).map((t) => ({
    key: t.id,
    ref: refFromBoost(t),
    symbol: t.symbol,
    chips: (
      <>
        <span className={`mv-chip ${getTierColor(t.boostTier || "Low Boost")}`}>
          {(t.boostTier || "Low Boost").toUpperCase()}
        </span>
        <span className="mv-chip text-(--gold)">{(t.chain || "eth").toUpperCase()}</span>
      </>
    ),
    detail: `VOL ${money(t.volume24h)} · BOOST ${money(t.boostAmount)}`,
    price: t.price,
    change: t.change24h,
  }));
  const adItems: TapeItem[] = (ads ?? []).slice(0, 3).map((t) => ({
    key: t.id,
    ref: refFromAd(t),
    symbol: t.symbol,
    chips: <span className="mv-chip text-(--champagne)">{(t.type || "Ad").toUpperCase()}</span>,
    detail: `LIQ ${money(t.liquidity)} · VOL ${money(t.volume)}`,
    price: t.price,
    change: t.change24h,
  }));

  // Quick stats: "…" only while the first request is in flight; afterwards an
  // unknown value is "—" and named UNAVAILABLE — never implied to be zero.
  const unknown = gsPending ? "…" : "—";
  const fmtT = (n: number | null | undefined) =>
    n == null ? unknown : n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T` : `$${(n / 1e9).toFixed(0)}B`;
  const quickStats: { label: string; raw: number | null | undefined; node: React.ReactNode }[] = [
    {
      label: "BTC Dominance",
      raw: gs?.btcDominance,
      node: gs?.btcDominance != null ? `${gs.btcDominance.toFixed(1)}%` : unknown,
    },
    { label: "Total Market Cap", raw: gs?.totalMcap, node: fmtT(gs?.totalMcap) },
    {
      label: "Market Cap 24h",
      raw: gs?.mcapChange24h,
      node: gs?.mcapChange24h != null ? <Pct value={gs.mcapChange24h} digits={2} /> : unknown,
    },
    {
      label: "Fear & Greed",
      raw: gs?.fearGreed,
      node:
        gs?.fearGreed != null ? (
          <span className="text-(--gold)">
            {gs.fearGreed}
            <span className="text-(--muted-2)"> · {gs.fearGreedLabel ?? ""}</span>
          </span>
        ) : (
          unknown
        ),
    },
  ];
  const statsUnavailable = !gsPending && quickStats.every((q) => q.raw == null);

  return (
    <div className="space-y-8 lg:space-y-10">
      {/* Group 1 — the desk's first read + market context */}
      <motion.div {...enterGroup(0)} className="space-y-8 lg:space-y-10">
        <DeskSummary />
        <Zone index="01" label="MARKET CONTEXT" meta="COINGECKO · DEXSCREENER">
          <KPICards />
        </Zone>
      </motion.div>

      {/* Group 2 — what is changing */}
      <motion.div {...enterGroup(1)}>
        <Zone index="02" label="FLOW" meta="BOOSTS · ADS · GLOBAL">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6 xl:grid-cols-3">
            <Panel title={`BOOST FEED · ${feedState(boostsStatus as DeskState)}`} icon={Zap}>
              <Tape items={boostItems} status={boostsStatus} label="boost feed" />
            </Panel>
            <Panel title={`ADS FEED · ${feedState(adsStatus as DeskState)}`} icon={TrendingUp}>
              <Tape items={adItems} status={adsStatus} label="ads feed" />
            </Panel>
            <div className="md:col-span-2 xl:col-span-1">
              <Panel
                title={statsUnavailable ? "QUICK STATS · OFFLINE" : "QUICK STATS"}
                icon={Activity}
              >
                <div className="mv-tape">
                  {quickStats.map((stat) => (
                    <div key={stat.label} className="flex items-center justify-between py-2">
                      <span className="text-[12px] text-muted-foreground">{stat.label}</span>
                      <Tick
                        value={typeof stat.raw === "number" ? stat.raw : null}
                        className={`mono-data text-[12px] ${stat.raw == null ? "text-(--faint)" : "text-(--bone)"}`}
                      >
                        {stat.node}
                      </Tick>
                    </div>
                  ))}
                </div>
                {statsUnavailable && (
                  <p className="pt-1 text-[11px] text-muted-foreground">
                    CoinGecko / alternative.me did not answer — no global figures are shown.
                  </p>
                )}
              </Panel>
            </div>
          </div>
        </Zone>
      </motion.div>

      {/* Group 3 — signal, then the market it comes from */}
      <motion.div {...enterGroup(2)} className="space-y-8 lg:space-y-10">
        <Zone index="03" label="SIGNAL" meta="DETERMINISTIC RULES · NO SCORES" id="signal">
          <AlphaRadarPanel />
        </Zone>
        <Zone index="04" label="MARKET" meta="DEXSCREENER · TRADINGVIEW">
          <div className="grid grid-cols-1 gap-4 lg:gap-6 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-1">
              <DexRealtimeTab />
            </div>
            <div className="min-w-0 xl:col-span-2">
              <MarketChartPanel />
            </div>
          </div>
        </Zone>
      </motion.div>
    </div>
  );
});

export { DashboardIndex };
