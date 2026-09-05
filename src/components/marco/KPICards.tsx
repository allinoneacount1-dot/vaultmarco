import { TrendingUp, Zap, BarChart3, DollarSign } from "lucide-react";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useTokenBoosts } from "@/hooks/useDexScreener";

function compact(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n).toLocaleString()}`;
}

/**
 * Machined stat cells — totals derived from the top-20 tape + boost feed.
 *
 * Every cell reads "—" when its provider has no real data to report. A zero is
 * only ever shown when a provider actually reported zero.
 */
export function KPICards() {
  const { data: coins, providerStatus: marketStatus } = useMarketPrices();
  const { data: boosts, providerStatus: boostsStatus } = useTokenBoosts();

  const list = coins ?? [];
  const hasMarket = list.length > 0;
  const volume = list.reduce((a, c) => a + (c.volume || 0), 0);
  const mcap = list.reduce((a, c) => a + (c.mc || 0), 0);
  const top = list.length ? [...list].sort((a, b) => b.ch - a.ch)[0] : null;
  const boostCount = boosts ? boosts.length : null;

  const marketSub =
    marketStatus === "stale"
      ? "LAST KNOWN · COINGECKO"
      : marketStatus === "offline"
        ? "UNAVAILABLE · COINGECKO"
        : "LIVE · COINGECKO";
  const boostsSub =
    boostsStatus === "stale"
      ? "DEXSCREENER · LAST KNOWN"
      : boostsStatus === "offline"
        ? "DEXSCREENER · UNAVAILABLE"
        : "DEXSCREENER FEED";

  const kpis = [
    {
      title: "MARKET CAP · TOP 20",
      value: hasMarket ? compact(mcap) : "—",
      sub: marketSub,
      up: true,
      icon: DollarSign,
    },
    {
      title: "VOLUME · 24H",
      value: hasMarket ? compact(volume) : "—",
      sub: "ACROSS THE TAPE",
      up: true,
      icon: BarChart3,
    },
    {
      title: "TOP GAINER · 24H",
      value: top ? top.sym : "—",
      sub: top ? `${top.ch >= 0 ? "+" : ""}${top.ch.toFixed(1)}%` : "…",
      up: (top?.ch ?? 0) >= 0,
      icon: TrendingUp,
    },
    {
      title: "ACTIVE BOOSTS",
      value: boostCount === null ? "—" : String(boostCount),
      sub: boostsSub,
      up: true,
      icon: Zap,
    },
  ];

  return (
    <div className="hairline mb-8 grid grid-cols-1 bg-(--panel) md:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        return (
          <div
            key={index}
            className="border-b border-(--hairline) p-6 last:border-b-0 md:[&:nth-child(odd)]:border-r lg:border-b-0 lg:[&:not(:last-child)]:border-r"
          >
            <div className="flex items-center justify-between">
              <span className="mono-label text-[9px]!">{kpi.title}</span>
              <Icon className="size-3.5 text-(--faint)" strokeWidth={1.8} />
            </div>
            <div className="mono-data mt-4 text-[24px] font-medium leading-none text-(--bone)">
              {kpi.value}
            </div>
            <div className={`mono-data mt-2 text-[11px] ${kpi.up ? "text-(--up)" : "text-(--down)"}`}>
              {kpi.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
}
