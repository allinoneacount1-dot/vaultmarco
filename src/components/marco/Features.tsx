import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useInView } from "framer-motion";
import { SectionHeading } from "./shell/SectionHeading";
import { FadeIn } from "./shell/Reveal";
import { Pct, Price, StateDot } from "./desk";
import { useLandingIntel } from "@/hooks/useLandingIntel";
import { type DeskState, feedState } from "@/lib/deskState";
import {
  type PreviewModel,
  SECTION_TEXT,
  TICKER_HORIZON,
  ageLabel,
  compactUsd,
  idleModel,
} from "@/lib/landing/liveIntel";

const MODULES = [
  { n: "01", t: "Overview Desk", d: "KPIs and every live feed, one screen." },
  { n: "02", t: "Boost & Ads Feeds", d: "Promoted flow, unmasked." },
  { n: "03", t: "DEX Realtime", d: "The multi-chain tape as it prints." },
  { n: "04", t: "Market Ticker", d: "CoinGecko market tape, polled every 60s." },
];

/** Literal classes (Tailwind only emits classes it can read in source). */
const STATE_TONE: Record<DeskState, string> = {
  loading: "text-(--faint)!",
  live: "text-(--gold)!",
  degraded: "text-(--champagne)!",
  stale: "text-(--champagne)!",
  offline: "text-(--down)!",
};

/** Value ink: current data reads bone, last-known reads muted, nothing reads faint. */
const VALUE_TONE: Record<DeskState, string> = {
  loading: "text-(--faint)",
  live: "text-(--bone)",
  degraded: "text-(--bone)",
  stale: "text-(--muted-2)",
  offline: "text-(--faint)",
};

const IDLE = idleModel();

/**
 * The framed preview. Pure presentation of a PreviewModel: every number on it
 * is a provider value, "—" when unknown, never a sample.
 */
function PreviewFrame({ model, now }: { model: PreviewModel; now: number }) {
  const age = model.state === "loading" ? null : ageLabel(model.updatedAt, now);
  const feeds: { label: string; state: DeskState }[] = [
    { label: "BOOST FEED", state: model.feeds.boostFeed },
    { label: "ADS FEED", state: model.feeds.adsFeed },
    { label: "DEX REALTIME", state: model.feeds.dexRealtime },
  ];
  return (
    <div className="hairline bg-(--void)" data-testid="intel-preview" data-state={model.state}>
      {/* window caption */}
      <div className="hairline-b flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-3.5">
        <span className="mono-label text-(--muted-2)!">VAULT://INTELLIGENCE</span>
        <span
          role="status"
          aria-live="polite"
          data-testid="intel-status"
          className={`mono-label flex items-center gap-2 whitespace-nowrap text-[9px]! ${STATE_TONE[model.state]}`}
        >
          <StateDot state={model.state} />
          {SECTION_TEXT[model.state]}
          {age && <span className="text-(--faint)!">· UPDATED {age}</span>}
        </span>
      </div>
      {/* KPI cells */}
      <div className="hairline-b grid grid-cols-3">
        {model.metrics.map((c, i) => (
          <div
            key={c.key}
            data-testid={`intel-metric-${c.key}`}
            data-state={c.state}
            className={`min-w-0 px-3.5 py-5 sm:px-5 ${i < 2 ? "hairline-r" : ""}`}
          >
            <div className="mono-label text-[9px]! leading-snug">{c.label}</div>
            <div
              className={`mono-data mt-2 truncate text-[15px] font-medium sm:text-[18px] ${
                c.value == null ? "text-(--faint)" : VALUE_TONE[c.state]
              }`}
            >
              {c.key === "boosts"
                ? c.value == null
                  ? "—"
                  : c.value.toLocaleString("en-US")
                : compactUsd(c.value)}
            </div>
            <div className="mono-data mt-1 truncate text-[10px] sm:text-[11px]">
              {c.change !== undefined ? (
                <Pct value={c.change} digits={1} suffix={TICKER_HORIZON} />
              ) : (
                <span className="text-(--faint)">{c.source}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* screener rows */}
      <div className="px-5 py-3">
        <div className="hairline-b grid grid-cols-[40px_1fr_auto_auto] items-center gap-3 sm:grid-cols-[54px_1fr_auto_auto] sm:gap-4 pb-2.5">
          <span className="mono-label text-[9px]!">CHAIN</span>
          <span className="mono-label text-[9px]!">PAIR</span>
          <span className="mono-label text-[9px]!">USD</span>
          <span className="mono-label w-14 text-right text-[9px]!">{TICKER_HORIZON}</span>
        </div>
        {model.rows.map((r) => (
          <div
            key={r.key}
            data-testid="intel-row"
            data-chain-id={r.chainId}
            data-pair-address={r.pairAddress}
            data-base-address={r.baseAddress}
            data-quote-address={r.quoteAddress}
            data-resolved={r.resolved ? "true" : "false"}
            className="hairline-b grid grid-cols-[40px_1fr_auto_auto] items-center gap-3 sm:grid-cols-[54px_1fr_auto_auto] sm:gap-4 py-3.5 last:border-b-0"
          >
            <span className="mono-label text-[9px]! text-(--muted-2)!">{r.chainLabel}</span>
            <span className="mono-data truncate text-[12px] text-(--bone)">{r.pairLabel}</span>
            <Price value={r.priceUsd} className="text-[12px] text-(--muted-2)" />
            <Pct value={r.change24h} digits={2} className="w-14 text-right text-[12px]" />
          </div>
        ))}
      </div>
      {/* caption bar — each feed's real provider state */}
      <div className="hairline-t flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {feeds.map((f) => (
            <span
              key={f.label}
              data-testid="intel-feed"
              data-feed={f.label}
              data-state={f.state}
              className="mono-label flex items-center gap-1.5 text-[9px]!"
            >
              {f.label}
              <span className={`flex items-center gap-1 ${STATE_TONE[f.state]}`}>
                <StateDot state={f.state} />
                {feedState(f.state)}
              </span>
            </span>
          ))}
        </span>
        <span className="mono-label text-[9px]! text-(--muted-2)!">MULTI-CHAIN</span>
      </div>
    </div>
  );
}

/** Mounted once the preview first nears the viewport: joins the shared query caches. */
function LivePreview() {
  const { model, now } = useLandingIntel();
  return <PreviewFrame model={model} now={now} />;
}

/**
 * Until the section is first in view, the frame shows identity only (every
 * value "—", CONNECTING) and no provider query is observed from this page.
 */
function IntelPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "200px 0px 200px 0px" });
  return <div ref={ref}>{inView ? <LivePreview /> : <PreviewFrame model={IDLE} now={0} />}</div>;
}

/** SCENE 04 — the intelligence desk: a quiet look through the dashboard glass. */
export function Features() {
  return (
    <section id="intelligence" className="relative bg-[rgba(11,12,14,0.9)]">
      <div className="u-container py-28 md:py-36">
        <SectionHeading
          index="03"
          sub="THE INTELLIGENCE"
          title="Inside the Desk"
          right={<span className="mono-label">SOURCES · DEXSCREENER · COINGECKO</span>}
        />

        <div className="grid items-start gap-14 lg:grid-cols-[1.25fr_1fr]">
          {/* framed dashboard preview — provider data only */}
          <FadeIn>
            <IntelPreview />
          </FadeIn>

          {/* modules index + CTA */}
          <div>
            <FadeIn>
              <p className="max-w-[46ch] text-[14.5px] leading-relaxed text-(--muted-2)">
                The dashboard is the vault's reading room: live DexScreener flow, boosts, paid
                placements and the realtime multi-chain tape — filtered into one calm, machined
                surface.
              </p>
            </FadeIn>
            <div className="mt-10">
              {MODULES.map((m, i) => (
                <FadeIn key={m.n} delay={i * 0.04}>
                  <div className="hairline-b flex items-baseline gap-5 py-4">
                    <span className="mono-data text-[11px] text-(--gold)">{m.n}</span>
                    <span className="w-44 shrink-0 font-display text-[13.5px] font-medium tracking-[0.02em] text-(--bone)">
                      {m.t}
                    </span>
                    <span className="hidden text-[12.5px] text-(--faint) sm:block">{m.d}</span>
                  </div>
                </FadeIn>
              ))}
            </div>
            <FadeIn delay={0.2} className="mt-10">
              <Link
                to="/dashboard"
                className="chrome-fill inline-flex items-center gap-3 px-7 py-4 font-mono text-[11px] font-semibold tracking-[0.18em] transition-[filter] duration-300 hover:brightness-110"
              >
                OPEN DASHBOARD
                <ArrowUpRight className="size-4" strokeWidth={2.4} />
              </Link>
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  );
}
