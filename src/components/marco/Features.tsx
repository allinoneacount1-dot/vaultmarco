import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { SectionHeading } from "./shell/SectionHeading";
import { FadeIn } from "./shell/Reveal";

const MODULES = [
  { n: "01", t: "Command Center", d: "Every feed on one screen." },
  { n: "02", t: "DEX Trending", d: "What moves, as it moves." },
  { n: "03", t: "Boost & Paid Feeds", d: "Promoted flow, unmasked." },
  { n: "04", t: "Rug Scanner", d: "Safety checks before entry." },
  { n: "05", t: "Watchlist & Alerts", d: "Your pairs, your triggers." },
  { n: "06", t: "Live Market", d: "Real-time multi-chain tape." },
];

const PREVIEW_ROWS = [
  { chain: "SOL", pair: "SOL / USDC", price: "176.26", delta: "+4.05", up: true },
  { chain: "ETH", pair: "WETH / USDT", price: "3,620.00", delta: "+1.90", up: true },
  { chain: "BASE", pair: "AERO / USDC", price: "1.2140", delta: "−2.31", up: false },
  { chain: "SOL", pair: "JUP / USDC", price: "0.8620", delta: "+6.42", up: true },
];

/** SCENE 04 — the intelligence desk: a quiet look through the dashboard glass. */
export function Features() {
  return (
    <section id="intelligence" className="relative bg-(--graphite)">
      <div className="u-container py-28 md:py-36">
        <SectionHeading
          index="03"
          sub="THE INTELLIGENCE"
          title="Inside the Desk"
          right={<span className="mono-label">LIVE DATA · DEXSCREENER · COINGECKO</span>}
        />

        <div className="grid items-start gap-14 lg:grid-cols-[1.25fr_1fr]">
          {/* framed dashboard preview — machined, not a screenshot */}
          <FadeIn>
            <div className="hairline bg-(--void)">
              {/* window caption */}
              <div className="hairline-b flex items-center justify-between px-5 py-3.5">
                <span className="mono-label text-(--muted-2)!">VAULT://INTELLIGENCE</span>
                <span className="mono-label flex items-center gap-2 text-[9px]! text-(--gold)!">
                  <span className="size-1 rounded-full bg-(--gold)" /> LIVE
                </span>
              </div>
              {/* KPI cells */}
              <div className="hairline-b grid grid-cols-3">
                {[
                  { k: "VOL 24H", v: "$124.5M", d: "+18.2%", up: true },
                  { k: "ACTIVE BOOSTS", v: "127", d: "+12.5%", up: true },
                  { k: "MARKET CAP", v: "$2.4T", d: "+3.1%", up: true },
                ].map((c, i) => (
                  <div key={c.k} className={`px-5 py-5 ${i < 2 ? "hairline-r" : ""}`}>
                    <div className="mono-label text-[9px]!">{c.k}</div>
                    <div className="mono-data mt-2 text-[18px] font-medium text-(--bone)">{c.v}</div>
                    <div className={`mono-data mt-1 text-[11px] ${c.up ? "text-(--up)" : "text-(--down)"}`}>{c.d}</div>
                  </div>
                ))}
              </div>
              {/* screener rows */}
              <div className="px-5 py-3">
                {PREVIEW_ROWS.map((r) => (
                  <div
                    key={r.pair}
                    className="hairline-b grid grid-cols-[54px_1fr_auto_auto] items-center gap-4 py-3.5 last:border-b-0"
                  >
                    <span className="mono-label text-[9px]! text-(--muted-2)!">{r.chain}</span>
                    <span className="mono-data text-[12px] text-(--bone)">{r.pair}</span>
                    <span className="mono-data text-[12px] text-(--muted-2)">{r.price}</span>
                    <span className={`mono-data w-14 text-right text-[12px] ${r.up ? "text-(--up)" : "text-(--down)"}`}>
                      {r.delta}%
                    </span>
                  </div>
                ))}
              </div>
              {/* caption bar */}
              <div className="hairline-t flex items-center justify-between px-5 py-3">
                <span className="mono-label text-[9px]!">BOOST FEED · ADS FEED · TAKEOVERS · SCANNER</span>
                <span className="mono-label text-[9px]! text-(--muted-2)!">14+ CHAINS</span>
              </div>
            </div>
          </FadeIn>

          {/* modules index + CTA */}
          <div>
            <FadeIn>
              <p className="max-w-[46ch] text-[14.5px] leading-relaxed text-(--muted-2)">
                The dashboard is the vault's reading room: live DexScreener flow, boosts, paid
                placements, community takeovers and safety tooling — filtered into one calm,
                machined surface.
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
