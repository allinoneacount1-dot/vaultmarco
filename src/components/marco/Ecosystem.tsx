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
import { SectionHeader, fadeUp, staggerContainer } from "./SectionHeader";
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
    <section id="ecosystem" className="relative py-24 sm:py-32 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
        <SectionHeader
          kicker="02 / ECOSYSTEM"
          title="The Vault Ecosystem."
          sub="13 operational surfaces — community, signals, execution, research, analytics, AI workflows, trading systems — engineered to compound."
        />

        <motion.div
          className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-5"
          variants={staggerContainer}
          initial="initial"
          whileInView="whileInView"
          viewport={{ once: true, margin: "-100px" }}
        >
          {ecosystem.map((e, i) => (
            <motion.div
              key={e.name}
              variants={fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.08 }}
            >
              <TiltCard className="h-full">
                <motion.a
                  href={e.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`group relative h-full rounded-2xl p-7 overflow-hidden hover:bg-white/[0.06] transition-all block ${
                    e.name === "Elite Access" ? "animated-gradient-border" : "glass border-glow"
                  }`}
                  whileHover={{ scale: 1.03, y: -8 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <motion.div
                    className="absolute -bottom-32 -right-32 size-64 rounded-full blur-3xl transition-opacity"
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    animate={{
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      scale: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                    }}
                    style={{
                      background:
                        e.name === "Elite Access"
                          ? "linear-gradient(135deg, rgba(190,150,255,0.4), rgba(145,231,255,0.3))"
                          : "rgba(145,231,255,0.3)",
                    }}
                  />

                  <div className="flex items-start justify-between gap-4 relative z-10">
                    <motion.div
                      className={`size-12 grid place-items-center rounded-xl text-primary group-hover:glow-cyan transition-all ${
                        e.name === "Elite Access"
                          ? "bg-gradient-to-br from-primary/20 to-violet-500/20"
                          : "bg-primary/10"
                      }`}
                      whileHover={{
                        scale: 1.15,
                        rotate: 10,
                        boxShadow: "0 0 30px rgba(145,231,255,0.4)",
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 12 }}
                    >
                      <e.icon className="size-5" />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      whileHover={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <ArrowUpRight className="size-5 text-muted-foreground group-hover:text-foreground group-hover:-translate-y-1 group-hover:translate-x-1 transition-all" />
                    </motion.div>
                  </div>

                  {e.name === "Elite Access" && (
                    <motion.div
                      className="absolute top-3 right-3 bg-primary text-primary-foreground px-3 py-1 rounded-full text-[9px] font-mono tracking-[0.2em] uppercase"
                      animate={{
                        scale: [1, 1.05, 1],
                        boxShadow: ["0 0 10px rgba(145,231,255,0.3)", "0 0 20px rgba(145,231,255,0.5)", "0 0 10px rgba(145,231,255,0.3)"],
                      }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      Elite
                    </motion.div>
                  )}

                  <motion.div
                    className="mt-6 font-display text-2xl text-foreground relative z-10"
                    whileHover={{ scale: 1.02 }}
                  >
                    {e.name}
                  </motion.div>
                  <motion.p
                    className="mt-2 text-sm text-muted-foreground leading-relaxed relative z-10"
                    initial={{ opacity: 0.8 }}
                    whileHover={{ opacity: 1 }}
                  >
                    {e.desc}
                  </motion.p>
                  <motion.div
                    className="mt-6 inline-flex items-center gap-2 text-[11px] font-mono tracking-[0.25em] text-primary relative z-10"
                    whileHover={{ gap: 4 }}
                    transition={{ duration: 0.2 }}
                  >
                    <motion.span
                      className="size-1 rounded-full bg-primary"
                      animate={{ scale: [1, 1.8, 1], opacity: [1, 0.4, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                    {e.cta}
                  </motion.div>
                </motion.a>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
