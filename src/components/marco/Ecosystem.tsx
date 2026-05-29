import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  Compass,
  Crown,
  Database,
  Eye,
  Flame,
  MessageCircle,
  Network,
  Radar,
  Target,
  Terminal as TerminalIcon,
  Wallet,
  Workflow,
} from "lucide-react";
import { SectionHeader, fadeUp } from "./SectionHeader";
import { TiltCard } from "./TiltCard";

const ecosystem = [
  {
    icon: MessageCircle,
    name: "Community Group",
    desc: "Real-time discussions and market intelligence among multi-chain operators.",
    cta: "JOIN GROUP",
    href: "https://t.me/DxmZone",
    tone: "cyan",
  },
  {
    icon: Radar,
    name: "Alpha Channel",
    desc: "Curated updates, narratives, and trading insights — broadcast straight from the vault.",
    cta: "OPEN CHANNEL",
    href: "https://t.me/DexMultichain",
    tone: "mint",
  },
  {
    icon: Target,
    name: "Sniper Bot",
    desc: "Advanced sniper execution infrastructure powered by Achilles Trojan.",
    cta: "LAUNCH BOT",
    href: "https://t.me/achilles_trojanbot?start=r-oxjackpot",
    tone: "violet",
  },
  {
    icon: TerminalIcon,
    name: "Padre Terminal",
    desc: "Advanced multi-chain charting and execution surface for serious traders.",
    cta: "OPEN TERMINAL",
    href: "https://trade.padre.gg/rk/dexmultichain",
    tone: "cyan",
  },
  {
    icon: Database,
    name: "Research Vault",
    desc: "Curated dossiers on chains, narratives and protocols — operator's research desk.",
    cta: "BROWSE RESEARCH",
    href: "https://t.me/DexMultichain",
    tone: "violet",
  },
  {
    icon: Wallet,
    name: "Wallet Tracker",
    desc: "Watch whales and smart money across SOL, ETH, BASE & Hyperliquid in real time.",
    cta: "TRACK WALLETS",
    href: "https://t.me/DxmZone",
    tone: "mint",
  },
  {
    icon: Network,
    name: "Multi-Chain Trading",
    desc: "Unified execution across 14+ chains with MEV-aware infrastructure.",
    cta: "TRADE NOW",
    href: "https://trade.padre.gg/rk/dexmultichain",
    tone: "cyan",
  },
  {
    icon: Workflow,
    name: "AI Workflow Automation",
    desc: "Custom pipelines for signal extraction, narrative tracking and execution support.",
    cta: "BUILD WORKFLOW",
    href: "https://t.me/DxmZone",
    tone: "mint",
  },
  {
    icon: Eye,
    name: "Market Intelligence",
    desc: "Operator-grade signals, no noise — curated intelligence from the vault.",
    cta: "GET SIGNALS",
    href: "https://t.me/+LXLE9HVc8sA0YWQ8",
    tone: "violet",
  },
  {
    icon: Flame,
    name: "Alpha Discovery",
    desc: "Narrative scouting before the herd — early detection of emerging trends.",
    cta: "DISCOVER ALPHA",
    href: "https://t.me/+LXLE9HVc8sA0YWQ8",
    tone: "cyan",
  },
  {
    icon: Crown,
    name: "Elite Access",
    desc: "Exclusive private group for elite operators — highest level alpha, signals, and networking.",
    cta: "JOIN ELITE",
    href: "https://t.me/+LXLE9HVc8sA0YWQ8",
    tone: "violet",
  },
  {
    icon: Activity,
    name: "Real-Time Monitoring",
    desc: "24/7 watch over flows and pools — never miss a move.",
    cta: "START MONITORING",
    href: "https://trade.padre.gg/rk/dexmultichain",
    tone: "mint",
  },
  {
    icon: Compass,
    name: "Narrative Tracking",
    desc: "Map the meta as it forms — stay ahead of market narratives.",
    cta: "TRACK NARRATIVES",
    href: "https://t.me/DxmZone",
    tone: "violet",
  },
];

export function Ecosystem() {
  return (
    <section id="ecosystem" className="relative py-24 sm:py-32">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div {...fadeUp}>
          <SectionHeader
            kicker="02 / ECOSYSTEM"
            title="The Vault Ecosystem."
            sub="13 operational surfaces — community, signals, execution, research, analytics, AI workflows, trading systems — engineered to compound."
          />
        </motion.div>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ecosystem.map((e, i) => (
            <motion.div
              key={e.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.07 }}
            >
              <TiltCard className="h-full">
                <a
                  href={e.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`group relative h-full rounded-2xl p-7 overflow-hidden hover:bg-white/[0.06] transition-all block ${
                    e.name === "Elite Access" ? "animated-gradient-border" : "glass border-glow"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className={`size-12 grid place-items-center rounded-xl text-primary group-hover:glow-cyan transition-all ${
                        e.name === "Elite Access"
                          ? "bg-gradient-to-br from-primary/20 to-violet-500/20"
                          : "bg-primary/10"
                      }`}
                    >
                      <e.icon className="size-5" />
                    </div>
                    <ArrowUpRight className="size-5 text-muted-foreground group-hover:text-foreground group-hover:-translate-y-1 group-hover:translate-x-1 transition-all" />
                  </div>
                  {e.name === "Elite Access" && (
                    <div className="absolute top-3 right-3 bg-primary text-primary-foreground px-3 py-1 rounded-full text-[9px] font-mono tracking-[0.2em] uppercase">
                      Elite
                    </div>
                  )}
                  <div className="mt-6 font-display text-2xl text-foreground">{e.name}</div>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{e.desc}</p>
                  <div className="mt-6 inline-flex items-center gap-2 text-[11px] font-mono tracking-[0.25em] text-primary">
                    <span className="size-1 rounded-full bg-primary animate-pulse-glow" />
                    {e.cta}
                  </div>
                  <div
                    className={`absolute -bottom-20 -right-20 size-48 rounded-full blur-3xl transition-opacity ${
                      e.name === "Elite Access"
                        ? "bg-gradient-to-br from-primary/30 to-violet-500/30 opacity-100"
                        : "bg-primary/10 opacity-0 group-hover:opacity-100"
                    }`}
                  />
                </a>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
