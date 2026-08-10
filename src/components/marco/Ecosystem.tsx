import { motion } from "framer-motion";
import { SectionHeading } from "./shell/SectionHeading";
import { EASE_VAULT } from "./shell/Reveal";

type Entry = {
  name: string;
  desc: string;
  href: string;
  tag: "TELEGRAM" | "BOT" | "TERMINAL" | "PRIVATE";
};

const ENTRIES: Entry[] = [
  { name: "Community Group", desc: "Real-time discussions and market intelligence among multi-chain operators.", href: "https://t.me/DxmZone", tag: "TELEGRAM" },
  { name: "Alpha Channel", desc: "Curated updates, narratives, and trading insights — broadcast straight from the vault.", href: "https://t.me/DexMultichain", tag: "TELEGRAM" },
  { name: "Sniper Bot", desc: "Advanced sniper execution infrastructure powered by Achilles Trojan.", href: "https://t.me/achilles_trojanbot?start=r-oxjackpot", tag: "BOT" },
  { name: "Padre Terminal", desc: "Advanced multi-chain charting and execution surface for serious traders.", href: "https://trade.padre.gg/rk/dexmultichain", tag: "TERMINAL" },
  { name: "Research Vault", desc: "Curated dossiers on chains, narratives and protocols — operator's research desk.", href: "https://t.me/DexMultichain", tag: "TELEGRAM" },
  { name: "Wallet Tracker", desc: "Watch whales and smart money across SOL, ETH, BASE & Hyperliquid in real time.", href: "https://t.me/DxmZone", tag: "TELEGRAM" },
  { name: "Multi-Chain Trading", desc: "Unified execution across 14+ chains with MEV-aware infrastructure.", href: "https://trade.padre.gg/rk/dexmultichain", tag: "TERMINAL" },
  { name: "AI Workflow Automation", desc: "Custom pipelines for signal extraction, narrative tracking and execution support.", href: "https://t.me/DxmZone", tag: "TELEGRAM" },
  { name: "Market Intelligence", desc: "Operator-grade signals, no noise — curated intelligence from the vault.", href: "https://t.me/+LXLE9HVc8sA0YWQ8", tag: "PRIVATE" },
  { name: "Alpha Discovery", desc: "Narrative scouting before the herd — early detection of emerging trends.", href: "https://t.me/+LXLE9HVc8sA0YWQ8", tag: "PRIVATE" },
  { name: "Elite Access", desc: "Exclusive private group for elite operators — highest level alpha, signals, and networking.", href: "https://t.me/+LXLE9HVc8sA0YWQ8", tag: "PRIVATE" },
  { name: "Real-Time Monitoring", desc: "24/7 watch over flows and pools — never miss a move.", href: "https://trade.padre.gg/rk/dexmultichain", tag: "TERMINAL" },
  { name: "Narrative Tracking", desc: "Map the meta as it forms — stay ahead of market narratives.", href: "https://t.me/DxmZone", tag: "TELEGRAM" },
];

/** SCENE 03 — the ecosystem as a numbered vault index (no card grids). */
export function Ecosystem() {
  return (
    <section id="ecosystem" className="relative bg-(--void)">
      <div className="u-container py-28 md:py-36">
        <SectionHeading
          index="02"
          sub="THE ECOSYSTEM"
          title="The Vault Index"
          right={<span className="mono-label">{String(ENTRIES.length).padStart(2, "0")} SERVICES · ALL OPERATIONAL</span>}
        />

        <div>
          {ENTRIES.map((e, i) => (
            <motion.a
              key={e.name}
              href={e.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group hairline-b grid grid-cols-[44px_1fr_auto] items-center gap-4 py-6 transition-colors duration-500 hover:bg-(--graphite) md:grid-cols-[72px_minmax(220px,0.9fr)_1.4fr_120px_40px] md:gap-6 md:py-7"
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-8% 0px" }}
              transition={{ duration: 0.7, delay: (i % 6) * 0.05, ease: EASE_VAULT }}
            >
              <span className="mono-data pl-1 text-[12px] text-(--gold)">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-display text-[16px] font-medium tracking-[0.02em] text-(--bone) transition-colors duration-300 md:text-[18px]">
                <span className="group-hover:chrome-text">{e.name}</span>
              </span>
              <span className="col-start-2 row-start-2 text-[13px] leading-relaxed text-(--faint) md:col-start-3 md:row-start-1 md:pr-8">
                {e.desc}
              </span>
              <span className="mono-label hidden justify-self-end text-[9px]! md:block">
                <span className="hairline px-2.5 py-1.5">{e.tag}</span>
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
      </div>
    </section>
  );
}
