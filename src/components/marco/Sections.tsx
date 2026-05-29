import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  Brain,
  Compass,
  Cpu,
  Crown,
  Database,
  Eye,
  Flame,
  Globe2,
  LineChart,
  MessageCircle,
  Network,
  Radar,
  Send,
  ShieldAlert,
  Star,
  Target,
  Terminal as TerminalIcon,
  Twitter,
  Wallet,
  Workflow,
  Zap,
  ShieldCheck,
  Sparkles,
  Globe,
  Rocket,
  Coins,
  TrendingUp,
  Hexagon,
  Layers,
  RadioTower,
  Terminal,
} from "lucide-react";
import {
  useMarketPrices,
  formatPrice,
  useChainHeatmap,
  useVolumeData,
  useMarketAlerts,
  formatVolume,
} from "@/hooks/useMarketPrices";
import { usePriceAlerts } from "@/hooks/usePriceAlerts";
import { ContactForm } from "./ContactForm";
import { Skeleton, SkeletonRow } from "./Skeleton";
import { Faq } from "./Faq";
import { useWatchlist } from "@/hooks/useWatchlist";
import { MagneticButton } from "./MagneticButton";
import { PriceAlertsPanel } from "./PriceAlertsPanel";
import { Panel, Row } from "./Panel";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6 },
};

function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 500, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 500, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], [10, -10]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], [-10, 10]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xPct = (mouseX - centerX) / centerX;
    const yPct = (mouseY - centerY) / centerY;

    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
    >
      <div style={{ transform: "translateZ(20px)" }}>{children}</div>
    </motion.div>
  );
}

function SectionHeader({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="max-w-3xl">
      <div className="inline-flex items-center gap-2 text-[10px] font-mono tracking-[0.35em] text-primary mb-4">
        <span className="size-1 rounded-full bg-primary animate-pulse-glow" />
        {kicker}
      </div>
      <h2 className="text-chrome font-display text-3xl sm:text-5xl font-semibold leading-tight">
        {title}
      </h2>
      {sub && <p className="mt-4 text-muted-foreground text-base sm:text-lg max-w-2xl">{sub}</p>}
    </div>
  );
}

/* ABOUT ----------------------------------------------------------- */
export function About() {
  const stats = [
    { v: "14+", l: "Chains Tracked" },
    { v: "24/7", l: "Market Coverage" },
    { v: "AI", l: "Powered Workflows" },
    { v: "∞", l: "Alpha Pipeline" },
  ];
  return (
    <section id="about" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div {...fadeUp}>
          <SectionHeader
            kicker="01 / ABOUT"
            title="Building Systems For The Next Crypto Cycle."
            sub="Operating at the intersection of Web3 markets, AI infrastructure, and community-driven research. Marco builds the systems, tools, and intelligence flows that turn market noise into actionable alpha."
          />
        </motion.div>

        <div className="mt-14 grid lg:grid-cols-12 gap-6">
          <motion.div
            {...fadeUp}
            className="lg:col-span-7 glass border-glow rounded-2xl p-7 sm:p-10"
          >
            <div className="grid sm:grid-cols-2 gap-6">
              {[
                {
                  icon: Globe2,
                  t: "Multi-Chain Native",
                  d: "Solana, Ethereum, Base, Hyperliquid, BNB, Sui & beyond — one operator, every chain.",
                },
                {
                  icon: Brain,
                  t: "AI Workflow Builder",
                  d: "Custom pipelines for signal extraction, narrative tracking and execution support.",
                },
                {
                  icon: Network,
                  t: "Trading Infrastructure",
                  d: "Sniper-grade execution, terminals and scanners wired into a single command surface.",
                },
                {
                  icon: MessageCircle,
                  t: "Community Intel",
                  d: "Live discussions, curated channels and signal sharing across the ecosystem.",
                },
              ].map((b) => (
                <div key={t(b.t)} className="group">
                  <div className="size-9 grid place-items-center rounded-lg bg-primary/10 text-primary mb-3 group-hover:glow-cyan transition-shadow">
                    <b.icon className="size-4" />
                  </div>
                  <div className="font-display text-lg text-foreground">{b.t}</div>
                  <div className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{b.d}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div {...fadeUp} className="lg:col-span-5 grid grid-cols-2 gap-4">
            {stats.map((s) => (
              <div key={s.l} className="glass rounded-2xl p-6 border-glow relative overflow-hidden">
                <div className="text-chrome font-display text-4xl sm:text-5xl font-semibold">
                  {s.v}
                </div>
                <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  {s.l}
                </div>
                <div className="absolute -top-10 -right-10 size-24 rounded-full bg-primary/20 blur-2xl" />
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
function t(s: string) {
  return s;
}

/* ECOSYSTEM ------------------------------------------------------- */
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

/* FEATURES -------------------------------------------------------- */
const features = [
  { icon: Network, t: "Multi-Chain Trading", d: "Unified execution across 14+ chains." },
  { icon: Workflow, t: "AI Workflow Automation", d: "Pipelines that turn data into decisions." },
  { icon: Eye, t: "Market Intelligence", d: "Operator-grade signals, no noise." },
  { icon: Flame, t: "Alpha Discovery", d: "Narrative scouting before the herd." },
  { icon: Target, t: "Sniper Execution", d: "MEV-aware infrastructure for fast entries." },
  { icon: MessageCircle, t: "Community Research", d: "Collective intel from the vault." },
  { icon: Activity, t: "Real-Time Monitoring", d: "24/7 watch over flows and pools." },
  { icon: Compass, t: "Narrative Tracking", d: "Map the meta as it forms." },
];

export function Features() {
  return (
    <section id="tools" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div {...fadeUp}>
          <SectionHeader
            kicker="03 / CAPABILITIES"
            title="Featured Capabilities."
            sub="The operating layer between you and the market."
          />
        </motion.div>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.t}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: (i % 4) * 0.05 }}
              className="group glass rounded-xl p-5 border-glow hover:bg-white/[0.06] transition-all hover:-translate-y-1"
            >
              <div className="size-10 grid place-items-center rounded-lg bg-white/5 text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <f.icon className="size-4" />
              </div>
              <div className="font-display text-base text-foreground">{f.t}</div>
              <div className="text-xs text-muted-foreground mt-1.5">{f.d}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* COMMAND CENTER -------------------------------------------------- */
export function CommandCenter() {
  const { data, isLoading, isError } = useMarketPrices();
  const { checkAlerts } = usePriceAlerts();
  const heatmap = useChainHeatmap(data);
  const volumeData = useVolumeData(data);
  const alerts = useMarketAlerts(data);
  const [activeTab, setActiveTab] = useState("default");

  // Check alerts whenever market data updates
  useEffect(() => {
    if (data) {
      checkAlerts(data);
    }
  }, [data, checkAlerts]);

  const tabs = [
    { id: "default", label: "All Panels" },
    { id: "dex", label: "DEX Realtime" },
  ];

  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div {...fadeUp}>
          <SectionHeader
            kicker="04 / COMMAND CENTER"
            title="Inside The Vault."
            sub="A cinematic surface that fuses live market data, charts, scanners, alerts and AI signals into one professional crypto command center. All panels stream real-time data from CoinGecko."
          />
        </motion.div>

        <motion.div {...fadeUp} className="mt-10 mb-6 flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-[11px] font-mono transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground glow-cyan"
                  : "glass text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </motion.div>

        <motion.div {...fadeUp} className="grid lg:grid-cols-3 gap-5">
          {activeTab === "default" && (
            <>
              <LiveMarketPanel data={data} isLoading={isLoading} isError={isError} />

              <Panel title="WALLET TRACKING · LIVE" icon={Eye}>
                {[
                  ["0x4f...d21a", "ETH", "+$182k"],
                  ["7Gp...J9xQ", "SOL", "+$58k"],
                  ["0x91...77ee", "BASE", "-$11k"],
                  ["8Aq...kZv2", "HYPE", "+$94k"],
                ].map(([a, c, p]) => (
                  <Row key={a} label={a} mid={c} value={p} ok={!p.startsWith("-")} />
                ))}
              </Panel>

              <Panel title="TOKEN SCANNER · LIVE" icon={Radar}>
                {(data ?? []).slice(0, 4).map((c) => (
                  <Row
                    key={c.id}
                    label={c.sym}
                    mid={c.name.slice(0, 8)}
                    value={`${c.ch >= 0 ? "+" : ""}${c.ch.toFixed(1)}%`}
                    ok={c.ch >= 0}
                  />
                ))}
              </Panel>

              <Panel title="CHAIN HEATMAP · LIVE" icon={Cpu}>
                <div className="grid grid-cols-4 gap-1.5 mt-1">
                  {!data
                    ? Array.from({ length: 12 }).map((_, i) => (
                        <Skeleton key={i} className="aspect-square" />
                      ))
                    : heatmap.map((c) => (
                        <motion.div
                          key={c.sym}
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.3 }}
                          className="aspect-square rounded grid place-items-center text-[9px] font-mono cursor-pointer hover:scale-110 transition-transform"
                          style={{
                            background:
                              c.ch >= 0
                                ? `linear-gradient(135deg, oklch(0.88 0.2 165 / ${0.3 + c.heat / 200}), oklch(0.6 0.18 165 / ${0.2 + c.heat / 300}))`
                                : `linear-gradient(135deg, oklch(0.6 0.24 27 / ${0.3 + c.heat / 200}), oklch(0.4 0.2 27 / ${0.2 + c.heat / 300}))`,
                            color: c.heat > 60 ? "#050505" : "white",
                            boxShadow:
                              c.heat > 50
                                ? `0 0 ${c.heat / 2}px ${c.ch >= 0 ? "oklch(0.88 0.2 165 / 0.5)" : "oklch(0.6 0.24 27 / 0.5)"}`
                                : "none",
                          }}
                          title={`${c.sym}: ${c.ch >= 0 ? "+" : ""}${c.ch.toFixed(1)}%`}
                        >
                          {c.sym}
                        </motion.div>
                      ))}
                </div>
              </Panel>

              <Panel title="AI SIGNAL FEED · LIVE" icon={Brain}>
                {[
                  "Narrative shift: AI-agents +18%",
                  "Whale rotation SOL → HYPE",
                  "Volume surge on BASE memes",
                  "MEV alert: backrun detected",
                  "New listing on major exchange",
                ].map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className="text-[11px] font-mono text-muted-foreground flex gap-2"
                  >
                    <span className="text-violet-300">›</span>
                    <span>{s}</span>
                  </motion.div>
                ))}
              </Panel>

              <PriceAlertsPanel marketData={data} />

              <Panel title="VOLUME INDICATORS · LIVE" icon={LineChart}>
                <div className="space-y-2 mt-1">
                  {!data
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="h-3 w-12" />
                          <Skeleton className="flex-1 h-3" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      ))
                    : volumeData.map((v, i) => (
                        <motion.div
                          key={v.sym}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ duration: 0.4, delay: i * 0.05 }}
                          className="flex items-center gap-3"
                        >
                          <span className="text-[11px] font-mono w-12 text-foreground">
                            {v.sym}
                          </span>
                          <div className="flex-1 h-3 bg-white/5 rounded-sm overflow-hidden">
                            <motion.div
                              className="h-full rounded-sm"
                              style={{ background: v.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, (v.volume / 1e10) * 100)}%` }}
                              transition={{ duration: 0.8, delay: i * 0.05 }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground w-20 text-right">
                            {formatVolume(v.volume)}
                          </span>
                        </motion.div>
                      ))}
                </div>
              </Panel>
            </>
          )}

          {activeTab === "dex" && (
            <div className="lg:col-span-3">
              <DexRealtimeTab />
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

import { MarketCoin } from "@/hooks/useMarketPrices";

function LiveMarketPanel({
  data,
  isLoading,
  isError,
}: {
  data?: MarketCoin[];
  isLoading?: boolean;
  isError?: boolean;
}) {
  const { addToWatchlist, isInWatchlist } = useWatchlist();
  const [scanningToken, setScanningToken] = useState<{ sym: string; name: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const coins = (data ?? []).slice(0, 8);

  // Mock AI scoring function
  const getAIScore = (sym: string) => {
    const scores: Record<string, number> = {
      BTC: 95,
      ETH: 92,
      SOL: 88,
      HYPE: 75,
      BONK: 65,
      PEPE: 55,
      SUI: 78,
      TON: 82,
      BNB: 85,
      AVAX: 79,
      ARB: 80,
      OP: 77,
      POL: 74,
      LINK: 86,
      DOGE: 60,
      SHIB: 50,
    };
    return scores[sym] ?? Math.floor(Math.random() * 60) + 40;
  };

  return (
    <>
      <div className="glass-strong border-glow rounded-2xl p-5 scanline lg:col-span-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
            <span className="text-[10px] font-mono tracking-[0.3em] text-accent flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-accent animate-pulse-glow" />
              LIVE MARKET · COINGECKO
            </span>
            <Activity className="size-3.5 text-accent" />
          </div>
          <div className="space-y-2">
            {isError && (
              <div className="text-[11px] font-mono text-red-400">
                Market feed offline — retrying…
              </div>
            )}
            {isLoading && !data && <SkeletonRow />}
            {coins.map((c, i) => {
              const aiScore = getAIScore(c.sym);
              return (
                <motion.div
                  key={c.sym}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="flex items-center justify-between text-[11px] font-mono hover:bg-white/5 rounded-lg px-2 py-1 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-foreground w-12">{c.sym}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono ${
                        aiScore > 80
                          ? "bg-accent/20 text-accent"
                          : aiScore > 60
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {aiScore}
                    </span>
                  </div>
                  <span className="text-muted-foreground tabular-nums flex-1 text-right px-2">
                    {formatPrice(c.px)}
                  </span>
                  <span
                    className={`tabular-nums w-16 text-right ${c.ch < 0 ? "text-red-400" : "text-accent"}`}
                  >
                    {c.ch >= 0 ? "+" : ""}
                    {c.ch.toFixed(2)}%
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setScanningToken({ sym: c.sym, name: c.name });
                        setIsModalOpen(true);
                      }}
                      className="p-1 rounded-full text-muted-foreground hover:text-accent hover:bg-white/5 transition-all"
                      aria-label={`Scan ${c.sym} for rug`}
                      title="Scan Rug"
                    >
                      <ShieldAlert className="size-3.5" />
                    </button>
                    <button
                      onClick={() => addToWatchlist({ id: c.id, sym: c.sym, name: c.name })}
                      className={`p-1 rounded-full transition-colors ${
                        isInWatchlist(c.id)
                          ? "text-accent bg-accent/10"
                          : "text-muted-foreground hover:text-accent"
                      }`}
                      aria-label={`Add ${c.sym} to watchlist`}
                      title="Add to watchlist"
                    >
                      <Star
                        className="size-3.5"
                        fill={isInWatchlist(c.id) ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
      <RugScannerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        token={scanningToken}
      />
    </>
  );
}

/* PARTNERSHIPS ---------------------------------------------------- */
const partners = [
  { name: "Community Alpha", tag: "Network", icon: MessageCircle, logos: ["solana", "telegram", "discord"] },
  { name: "Web3 Builders", tag: "Builders", icon: Cpu, logos: ["ethereum", "solana", "bnb"] },
  { name: "AI Infrastructure", tag: "AI", icon: Brain, logos: ["nvidia", "openai", "coingecko"] },
  { name: "Trading Ecosystem", tag: "Trading", icon: LineChart, logos: ["uniswap", "jupiter", "pumpfun"] },
  { name: "Launch Partners", tag: "Launchpads", icon: Flame, logos: ["coinlist", "daomaker", "trustswap"] },
  { name: "Strategic Networks", tag: "Strategy", icon: Network, logos: ["solana", "ethereum", "bnb", "base"] },
];

// Simple logo component using Lucide icons
const PartnerLogo = ({ name }: { name: string }) => {
  const config: Record<string, { bg: string, icon: React.ReactNode }> = {
    solana: { bg: "#9945ff", icon: <Hexagon className="size-3" /> },
    ethereum: { bg: "#627eea", icon: <Layers className="size-3" /> },
    bnb: { bg: "#f0b90b", icon: <Coins className="size-3" /> },
    base: { bg: "#22c55e", icon: <Globe className="size-3" /> },
    uniswap: { bg: "#ff007a", icon: <TrendingUp className="size-3" /> },
    jupiter: { bg: "#9945ff", icon: <Zap className="size-3" /> },
    pumpfun: { bg: "#06b6d4", icon: <Rocket className="size-3" /> },
    telegram: { bg: "#0ea5e9", icon: <MessageCircle className="size-3" /> },
    discord: { bg: "#6366f1", icon: <RadioTower className="size-3" /> },
    nvidia: { bg: "#76b900", icon: <Cpu className="size-3" /> },
    openai: { bg: "#10a37f", icon: <Bot className="size-3" /> },
    coingecko: { bg: "#fca311", icon: <Sparkles className="size-3" /> },
    coinlist: { bg: "#38bdf8", icon: <Terminal className="size-3" /> },
    daomaker: { bg: "#818cf8", icon: <ShieldCheck className="size-3" /> },
    trustswap: { bg: "#fca311", icon: <Layers className="size-3" /> },
  };
  const c = config[name] || { bg: "#64748b", icon: <Hexagon className="size-3" /> };
  
  return (
    <div className="size-6 rounded-full border border-white/10 flex items-center justify-center"
      style={{ backgroundColor: c.bg }}
    >
      {c.icon}
    </div>
  );
};

export function Partnerships() {
  const [openPartner, setOpenPartner] = useState<string | null>(null);
  return (
    <section id="partnerships" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div {...fadeUp}>
          <SectionHeader
            kicker="05 / PARTNERSHIPS"
            title="Allied Networks."
            sub="Building bridges across communities, ecosystems and AI infrastructure. Future-proof collaborations only."
          />
        </motion.div>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {partners.map((p, i) => (
            <motion.button
              key={p.name}
              type="button"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="w-full group glass rounded-2xl p-6 border-glow hover:bg-white/[0.06] transition-all text-left"
              onClick={() => setOpenPartner(p.name)}
            >
              <div className="flex items-center gap-4">
                <div className="size-12 grid place-items-center rounded-xl bg-white/5 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                  <p.icon className="size-5" />
                </div>
                <div>
                  <div className="font-display text-lg text-foreground">{p.name}</div>
                  <div className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground uppercase mt-1">
                    {p.tag}
                  </div>
                </div>
              </div>
              {/* Logo list */}
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                {p.logos?.map((logo, idx) => (
                  <PartnerLogo key={idx} name={logo} />
                ))}
              </div>
            </motion.button>
          ))}
        </div>

        <motion.div
          {...fadeUp}
          className="mt-10 glass-strong border-glow rounded-2xl p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
        >
          <div>
            <div className="font-display text-2xl sm:text-3xl text-chrome">
              Interested in Partnership?
            </div>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Communities, AI projects, launchpads, KOL networks — let's build.
            </p>
          </div>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-3 text-[12px] font-medium uppercase tracking-[0.18em] glow-cyan hover:scale-[1.03] transition-transform"
          >
            Contact For Collaboration <ArrowUpRight className="size-4" />
          </a>
        </motion.div>

        {/* Partner Dashboard Modal */}
        <PartnerDashboardModal partnerName={openPartner} onClose={() => setOpenPartner(null)} />
      </div>
    </section>
  );
}

/* SOCIAL PROOF ---------------------------------------------------- */
export function SocialProof() {
  const items = [
    { v: "14+", l: "Multi-Chain Ecosystem" },
    { v: "10k+", l: "Growing Web3 Community" },
    { v: "AI", l: "Enhanced Workflows" },
    { v: "24/7", l: "Real-Time Market Analysis" },
  ];
  return (
    <section className="relative py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="glass-strong border-glow rounded-3xl p-8 sm:p-12 grid grid-cols-2 lg:grid-cols-4 gap-6 relative overflow-hidden">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 size-[400px] rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          {items.map((it, i) => (
            <motion.div
              key={it.l}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className="relative text-center"
            >
              <div className="text-chrome font-display text-4xl sm:text-5xl font-semibold">
                {it.v}
              </div>
              <div className="mt-2 text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                {it.l}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* CONTACT --------------------------------------------------------- */
export function Contact() {
  return (
    <section id="contact" className="relative py-24 sm:py-32">
      <div className="absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[500px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
        <motion.div {...fadeUp} className="text-center">
          <div className="inline-flex items-center gap-2 text-[10px] font-mono tracking-[0.35em] text-primary mb-4">
            <span className="size-1 rounded-full bg-primary animate-pulse-glow" />
            06 / ENTER
          </div>
          <h2 className="text-chrome font-display text-5xl sm:text-7xl font-semibold tracking-tight">
            Enter The Vault.
          </h2>
          <p className="mt-5 text-muted-foreground max-w-xl mx-auto">
            Join the ecosystem and stay ahead of the next market narrative.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="https://t.me/DxmZone"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-3 text-[12px] font-medium uppercase tracking-[0.18em] glow-cyan hover:scale-[1.03] transition-transform"
            >
              <Send className="size-3.5" /> Join Telegram
            </a>
            <a
              href="https://x.com/vaultmarco"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full glass border-glow px-5 py-3 text-[12px] font-medium uppercase tracking-[0.18em] hover:bg-white/8 transition-colors"
            >
              <Twitter className="size-3.5" /> Follow on X
            </a>
            <a
              href="https://trade.padre.gg/rk/dexmultichain"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full glass border-glow px-5 py-3 text-[12px] font-medium uppercase tracking-[0.18em] hover:bg-white/8 transition-colors"
            >
              <TerminalIcon className="size-3.5" /> Open Terminal
            </a>
          </div>
        </motion.div>

        <ContactForm />
      </div>
    </section>
  );
}

/* FOOTER ---------------------------------------------------------- */
export function Footer() {
  return (
    <footer className="relative pt-16 pb-10 border-t border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-2">
            <div className="font-display font-semibold text-chrome text-xl tracking-[0.18em]">
              MARCOVAULT
            </div>
            <p className="mt-4 text-sm text-muted-foreground max-w-sm leading-relaxed">
              Built for the next generation of Web3 operators. Multi-chain alpha, AI workflows and
              sniper-grade execution.
            </p>
          </div>

          <div>
            <div className="text-[10px] font-mono tracking-[0.3em] text-muted-foreground mb-4">
              NAVIGATE
            </div>
            <ul className="space-y-2 text-sm">
              {["About", "Ecosystem", "Tools", "Partnerships", "Watchlist", "Contact", "FAQ"].map(
                (l) => (
                  <li key={l}>
                    <a
                      href={`#${l.toLowerCase()}`}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {l}
                    </a>
                  </li>
                ),
              )}
            </ul>
          </div>

          <div>
            <div className="text-[10px] font-mono tracking-[0.3em] text-muted-foreground mb-4">
              CONNECT
            </div>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://x.com/vaultmarco"
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  X / Twitter
                </a>
              </li>
              <li>
                <a
                  href="https://t.me/DxmZone"
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Telegram Group
                </a>
              </li>
              <li>
                <a
                  href="https://t.me/DexMultichain"
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Telegram Channel
                </a>
              </li>
              <li>
                <a
                  href="https://trade.padre.gg/rk/dexmultichain"
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Padre Terminal
                </a>
              </li>
              <li>
                <a
                  href="https://t.me/achilles_trojanbot?start=r-oxjackpot"
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sniper Bot
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-[11px] font-mono tracking-[0.2em] text-muted-foreground uppercase">
            © {new Date().getFullYear()} MARCOVAULT · All rights reserved
          </div>
          <div className="text-[11px] font-mono tracking-[0.2em] text-primary uppercase">
            Built For The Next Generation Of Web3 Operators
          </div>
        </div>
      </div>
    </footer>
  );
}

import { Watchlist } from "./Watchlist";
import { Terminal } from "./Terminal";
import { RugScannerModal } from "./RugScannerModal";
import { DexRealtimeTab } from "./DexRealtimeTab";
import { PartnerDashboardModal } from "./PartnerDashboardModal";

export function Sections() {
  return (
    <>
      <Terminal />
      <About />
      <Ecosystem />
      <Features />
      <CommandCenter />
      <Watchlist />
      <Partnerships />
      <SocialProof />
      <Contact />
      <Faq />
      <Footer />
    </>
  );
}

// silence unused
export const _ = { Bot };
