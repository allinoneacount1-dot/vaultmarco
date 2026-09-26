import { TrendingUp, Zap, BarChart3, DollarSign } from "lucide-react";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useTokenBoosts } from "@/hooks/useDexScreener";
import { Tick } from "./desk";

function compact(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n).toLocaleString()}`;
}

type Tone = "neutral" | "warn" | "down" | "up";
const TONE: Record<Tone, string> = {
  neutral: "text-(--faint)",
  warn: "text-(--champagne)",
  down: "text-(--down)",
  up: "text-(--up)",
};

/** Provider state line: what we know, from where — never "LIVE" before data exists. */
function sourceLine(status: string, source: string): { text: string; tone: Tone } {
  switch (status) {
    case "loading":
      return { text: `CONNECTING · ${source}`, tone: "neutral" };
    case "stale":
      return { text: `LAST KNOWN · ${source}`, tone: "warn" };
    case "offline":
      return { text: `UNAVAILABLE · ${source}`, tone: "down" };
    case "degraded":
      return { text: `PARTIAL · ${source}`, tone: "warn" };
    default:
      return { text: `LIVE · ${source}`, tone: "neutral" };
  }
}

/**
 * Machined stat cells — totals derived from the top-20 tape + boost feed.
 *
 * Every cell reads "—" when its provider has no real data to report. A zero is
 * only ever shown when a provider actually reported zero. Sage / oxide are
 * reserved for real price direction; provider state uses neutral / warn tones.
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
  const market = sourceLine(marketStatus, "COINGECKO");

  const kpis: {
    title: string;
    value: string;
    raw: number | null;
    sub: string;
    tone: Tone;
    icon: typeof DollarSign;
  }[] = [
    {
      title: "MARKET CAP · TOP 20",
      value: hasMarket ? compact(mcap) : "—",
      raw: hasMarket ? mcap : null,
      sub: market.text,
      tone: market.tone,
      icon: DollarSign,
    },
    {
      title: "VOLUME · 24H",
      value: hasMarket ? compact(volume) : "—",
      raw: hasMarket ? volume : null,
      sub: hasMarket ? "ACROSS THE TAPE" : market.text,
      tone: hasMarket ? "neutral" : market.tone,
      icon: BarChart3,
    },
    {
      title: "TOP GAINER · 24H",
      value: top ? top.sym : "—",
      raw: null,
      sub: top ? `${top.ch >= 0 ? "+" : ""}${top.ch.toFixed(1)}%` : market.text,
      tone: top ? (top.ch >= 0 ? "up" : "down") : market.tone,
      icon: TrendingUp,
    },
    {
      title: "ACTIVE BOOSTS",
      value: boostCount === null ? "—" : String(boostCount),
      raw: boostCount,
      sub: sourceLine(boostsStatus, "DEXSCREENER").text,
      tone: sourceLine(boostsStatus, "DEXSCREENER").tone,
      icon: Zap,
    },
  ];

  return (
    <div className="hairline grid grid-cols-2 bg-(--panel) lg:grid-cols-4">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        return (
          <div
            key={kpi.title}
            className={`min-w-0 border-(--hairline) p-4 sm:p-6 ${index % 2 === 0 ? "border-r" : ""} ${
              index < 2 ? "border-b lg:border-b-0" : ""
            } ${index === 1 ? "lg:border-r" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="mono-label text-[9px]! tracking-[0.2em]! sm:tracking-[0.28em]!">
                {kpi.title}
              </span>
              <Icon className="size-3.5 shrink-0 text-(--faint)" strokeWidth={1.8} />
            </div>
            <Tick
              value={kpi.raw}
              className="mono-data mt-3 block truncate text-[20px] font-medium leading-none text-(--bone) sm:mt-4 sm:text-[24px]"
            >
              {kpi.value}
            </Tick>
            {/* Mobile keeps the state word; the source name joins from sm up. */}
            <div className={`mono-data mt-2 truncate text-[10px] sm:text-[11px] ${TONE[kpi.tone]}`}>
              {kpi.sub.includes(" · ") ? (
                <>
                  {kpi.sub.split(" · ")[0]}
                  <span className="hidden sm:inline">
                    {" "}
                    · {kpi.sub.split(" · ").slice(1).join(" · ")}
                  </span>
                </>
              ) : (
                kpi.sub
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
