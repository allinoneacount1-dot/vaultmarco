import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { SectionHeading } from "./shell/SectionHeading";
import { FadeIn, EASE_VAULT } from "./shell/Reveal";

/**
 * SCENE 03 — the ecosystem as a vault index.
 * ARSENAL: the two revenue doors (owner: "tonjolkan link trojan & terminal padre")
 * DOORS: remaining destinations — every link appears exactly ONCE in this section
 * (no overlapping referral targets). Canonical ref codes:
 * achilles `?start=r-oxjackpot`, padre `/rk/dexmultichain`.
 */

const ARSENAL = [
  {
    name: "Achilles Sniper Bot",
    desc: "Sniper-grade execution infrastructure. First bullet, best entry — powered by Achilles Trojan.",
    href: "https://t.me/achilles_trojanbot?start=r-oxjackpot",
    tag: "TELEGRAM BOT",
    cta: "DEPLOY THE BOT",
  },
  {
    name: "Padre Terminal",
    desc: "Multi-chain charting and execution surface for serious operators. Trade where the vault trades.",
    href: "https://trade.padre.gg/rk/dexmultichain",
    tag: "TRADING TERMINAL",
    cta: "ENTER THE TERMINAL",
  },
];

type Door = {
  name: string;
  desc: string;
  href: string;
  tag: string;
  featured?: boolean;
};

const DOORS: Door[] = [
  {
    name: "Elite Access",
    desc: "Invite-only room for elite operators — highest-level alpha, signals, and networking.",
    href: "https://t.me/+LXLE9HVc8sA0YWQ8",
    tag: "PRIVATE",
    featured: true,
  },
  {
    name: "Community Group",
    desc: "Real-time discussions and market intelligence among multi-chain operators.",
    href: "https://t.me/DxmZone",
    tag: "TELEGRAM",
  },
  {
    name: "Alpha Channel",
    desc: "Curated updates, narratives, and trading insights — broadcast straight from the vault.",
    href: "https://t.me/DexMultichain",
    tag: "TELEGRAM",
  },
];

const CAPABILITIES = [
  { t: "Research Vault", d: "Curated dossiers on chains, narratives and protocols." },
  { t: "Wallet Tracker", d: "Whales and smart money across SOL, ETH, BASE & Hyperliquid." },
  { t: "Multi-Chain Trading", d: "Unified execution across 14+ chains, MEV-aware." },
  { t: "AI Workflow Automation", d: "Pipelines for signal extraction and execution support." },
  { t: "Market Intelligence", d: "Operator-grade signals, zero noise." },
  { t: "Alpha Discovery", d: "Narrative scouting before the herd arrives." },
  { t: "Real-Time Monitoring", d: "24/7 watch over flows and pools." },
  { t: "Narrative Tracking", d: "Map the meta as it forms." },
];

export function Ecosystem() {
  return (
    <section id="ecosystem" className="relative bg-[rgba(5,5,6,0.78)]">
      <div className="u-container py-28 md:py-36">
        <SectionHeading
          index="02"
          sub="THE ECOSYSTEM"
          title="The Vault Index"
          right={<span className="mono-label">02 ARSENAL · 03 DOORS · 08 CAPABILITIES</span>}
        />

        {/* — THE ARSENAL: the two featured weapons, gold-framed — */}
        <div className="grid gap-px md:grid-cols-2">
          {ARSENAL.map((a, i) => (
            <FadeIn key={a.href} delay={i * 0.08}>
              <a
                href={a.href}
                target="_blank"
                rel="noopener noreferrer"
                data-cursor="open"
                className="group relative flex h-full flex-col justify-between overflow-hidden bg-(--graphite) p-8 transition-colors duration-500 hover:bg-(--panel) md:p-10"
                style={{ border: "1px solid rgba(194,168,120,0.38)" }}
              >
                {/* corner ticks */}
                <span aria-hidden className="absolute left-0 top-0 h-5 w-px bg-(--gold)" />
                <span aria-hidden className="absolute left-0 top-0 h-px w-5 bg-(--gold)" />
                <span aria-hidden className="absolute bottom-0 right-0 h-5 w-px bg-(--gold)" />
                <span aria-hidden className="absolute bottom-0 right-0 h-px w-5 bg-(--gold)" />

                <div>
                  <div className="flex items-center justify-between">
                    <span className="mono-label text-[9px]! text-(--gold)!">◆ FEATURED · {a.tag}</span>
                    <span className="mono-data text-[11px] text-(--gold)">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mt-5 font-display text-[clamp(20px,2.4vw,28px)] font-semibold tracking-[0.02em] text-(--bone)">
                    <span className="group-hover:chrome-text">{a.name}</span>
                  </h3>
                  <p className="mt-3 max-w-[46ch] text-[13.5px] leading-relaxed text-(--muted-2)">{a.desc}</p>
                </div>
                <div className="mt-9 flex items-center justify-between">
                  <span className="chrome-fill inline-flex items-center gap-2.5 px-5 py-3 font-mono text-[10.5px] font-semibold tracking-[0.18em] transition-[filter] duration-300 group-hover:brightness-110">
                    {a.cta}
                    <ArrowUpRight className="size-3.5" strokeWidth={2.4} />
                  </span>
                  <span className="mono-label hidden text-[9px]! sm:block">REF LINK · OFFICIAL</span>
                </div>
              </a>
            </FadeIn>
          ))}
        </div>

        {/* — the doors: one row per unique destination — */}
        <div className="mt-16 md:mt-20">
          {DOORS.map((e, i) => (
            <motion.a
              key={e.href}
              href={e.href}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor="open"
              className={`group hairline-b relative grid grid-cols-[44px_1fr_auto] items-center gap-4 py-7 transition-colors duration-500 hover:bg-(--graphite) md:grid-cols-[72px_minmax(220px,0.9fr)_1.2fr_150px_40px] md:gap-6 ${
                e.featured ? "bg-[rgba(194,168,120,0.045)]" : ""
              }`}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -8% 0px" }}
              transition={{ duration: 0.7, delay: i * 0.06, ease: EASE_VAULT }}
            >
              {e.featured && (
                <span aria-hidden className="absolute left-0 top-1/2 h-9 w-[2px] -translate-y-1/2 bg-(--gold)" />
              )}
              <span className="mono-data pl-1 text-[12px] text-(--gold)">
                {String(i + 3).padStart(2, "0")}
              </span>
              <span className="font-display text-[17px] font-medium tracking-[0.02em] text-(--bone) transition-colors duration-300 md:text-[19px]">
                <span className={e.featured ? "text-(--champagne) group-hover:chrome-text" : "group-hover:chrome-text"}>
                  {e.name}
                </span>
                {e.featured && (
                  <span className="mono-label ml-3 align-middle text-[8px]! text-(--gold)!">◆ ELITE</span>
                )}
              </span>
              <span className="col-start-2 row-start-2 text-[13px] leading-relaxed text-(--faint) md:col-start-3 md:row-start-1 md:pr-8">
                {e.desc}
              </span>
              <span className="mono-label hidden justify-self-end text-[9px]! md:block">
                <span className={`px-2.5 py-1.5 ${e.featured ? "border border-(--gold) text-(--gold)" : "hairline"}`}>
                  {e.tag}
                </span>
              </span>
              <span
                aria-hidden
                className="justify-self-end pr-1 text-(--faint) transition-all duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-(--gold)"
              >
                ↗
              </span>
            </motion.a>
          ))}
        </div>

        {/* — capabilities: engraved grid, deliberately unlinked — */}
        <FadeIn className="mt-16 md:mt-20">
          <div className="mb-7 flex items-baseline justify-between">
            <span className="mono-label text-(--gold)!">BEHIND THE DOORS</span>
            <span className="mono-label hidden sm:block">RUNNING 24/7 INSIDE THE VAULT</span>
          </div>
          <div className="hairline grid sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map((c, i) => (
              <div
                key={c.t}
                className="border-(--hairline) p-6 max-lg:[&:not(:last-child)]:border-b lg:[&:nth-child(-n+4)]:border-b lg:[&:not(:nth-child(4n))]:border-r"
              >
                <div className="mono-data text-[10px] text-(--faint)">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="mt-3 font-display text-[13.5px] font-medium tracking-[0.02em] text-(--bone)">
                  {c.t}
                </div>
                <div className="mt-2 text-[12px] leading-relaxed text-(--faint)">{c.d}</div>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
