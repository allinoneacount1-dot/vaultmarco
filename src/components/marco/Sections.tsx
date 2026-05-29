import { motion } from "framer-motion";
import {
  Activity, ArrowUpRight, Bot, Brain, Compass, Cpu, Database, Eye, Flame,
  Globe2, LineChart, MessageCircle, Network, Radar, Send, Target,
  Terminal as TerminalIcon, Twitter, Wallet, Workflow, Zap,
} from "lucide-react";
import { useMarketPrices, formatPrice } from "@/hooks/useMarketPrices";
import { ContactForm } from "./ContactForm";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6 },
};

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
          <motion.div {...fadeUp} className="lg:col-span-7 glass border-glow rounded-2xl p-7 sm:p-10">
            <div className="grid sm:grid-cols-2 gap-6">
              {[
                { icon: Globe2, t: "Multi-Chain Native", d: "Solana, Ethereum, Base, Hyperliquid, BNB, Sui & beyond — one operator, every chain." },
                { icon: Brain, t: "AI Workflow Builder", d: "Custom pipelines for signal extraction, narrative tracking and execution support." },
                { icon: Network, t: "Trading Infrastructure", d: "Sniper-grade execution, terminals and scanners wired into a single command surface." },
                { icon: MessageCircle, t: "Community Intel", d: "Live discussions, curated channels and signal sharing across the ecosystem." },
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
                <div className="text-chrome font-display text-4xl sm:text-5xl font-semibold">{s.v}</div>
                <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{s.l}</div>
                <div className="absolute -top-10 -right-10 size-24 rounded-full bg-primary/20 blur-2xl" />
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
function t(s: string) { return s; }

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
            sub="Six operational surfaces — community, signals, execution, research, analytics — engineered to compound."
          />
        </motion.div>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {ecosystem.map((e, i) => (
            <motion.a
              key={e.name}
              href={e.href}
              target="_blank"
              rel="noreferrer"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.07 }}
              className="group relative glass border-glow rounded-2xl p-7 overflow-hidden hover:bg-white/[0.06] transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="size-12 grid place-items-center rounded-xl bg-primary/10 text-primary group-hover:glow-cyan transition-all">
                  <e.icon className="size-5" />
                </div>
                <ArrowUpRight className="size-5 text-muted-foreground group-hover:text-foreground group-hover:-translate-y-1 group-hover:translate-x-1 transition-all" />
              </div>
              <div className="mt-6 font-display text-2xl text-foreground">{e.name}</div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{e.desc}</p>
              <div className="mt-6 inline-flex items-center gap-2 text-[11px] font-mono tracking-[0.25em] text-primary">
                <span className="size-1 rounded-full bg-primary animate-pulse-glow" />
                {e.cta}
              </div>
              <div className="absolute -bottom-20 -right-20 size-48 rounded-full bg-primary/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.a>
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
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div {...fadeUp}>
          <SectionHeader
            kicker="04 / COMMAND CENTER"
            title="Inside The Vault."
            sub="A cinematic surface that fuses live market data, charts, scanners, alerts and AI signals into one professional crypto command center. The LIVE MARKET panel below streams real prices from CoinGecko; other panels are illustrative previews of the operator workspace."
          />
        </motion.div>

        <motion.div
          {...fadeUp}
          className="mt-14 grid lg:grid-cols-3 gap-5"
        >
          <LiveMarketPanel />

          <Panel title="WALLET TRACKING · DEMO" icon={Eye}>
            {[
              ["0x4f...d21a", "ETH", "+$182k"],
              ["7Gp...J9xQ", "SOL", "+$58k"],
              ["0x91...77ee", "BASE", "-$11k"],
              ["8Aq...kZv2", "HL",  "+$94k"],
            ].map(([a, c, p]) => (
              <Row key={a} label={a} mid={c} value={p} ok={!p.startsWith("-")} />
            ))}
          </Panel>

          <Panel title="TOKEN SCANNER · DEMO" icon={Radar}>
            {[
              ["AION",  "SOL",  "0:14"],
              ["NEXUS", "BASE", "1:02"],
              ["VAULT", "ETH",  "2:38"],
              ["NOVA",  "HL",   "3:51"],
            ].map(([s, c, age]) => (
              <Row key={s + age} label={s} mid={c} value={`age ${age}`} />
            ))}
          </Panel>

          <Panel title="CHAIN HEATMAP · DEMO" icon={Cpu}>
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              {["SOL","ETH","BASE","HL","BNB","SUI","TON","AVAX","ARB","OP","POL","LIN"].map((c, i) => {
                const heat = (i * 37) % 100;
                return (
                  <div
                    key={c}
                    className="aspect-square rounded grid place-items-center text-[9px] font-mono"
                    style={{
                      background: `oklch(0.5 0.18 ${200 - heat} / ${0.25 + heat / 200})`,
                      color: heat > 60 ? "#050505" : "white",
                    }}
                  >
                    {c}
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="AI SIGNAL FEED · DEMO" icon={Brain}>
            {[
              "Narrative shift: AI-agents +18%",
              "Whale rotation SOL → HYPE",
              "Volume surge on BASE memes",
              "MEV alert: backrun detected",
            ].map((s, i) => (
              <div key={i} className="text-[11px] font-mono text-muted-foreground flex gap-2">
                <span className="text-violet-300">›</span>
                <span>{s}</span>
              </div>
            ))}
          </Panel>

          <Panel title="MARKET ALERTS · DEMO" icon={Zap}>
            {[
              ["HYPE", "BREAKOUT", "ok"],
              ["BONK", "VOL SPIKE", "ok"],
              ["PEPE", "DUMP RISK", "bad"],
              ["SUI",  "RECLAIM",  "ok"],
            ].map(([s, st, k]) => (
              <Row key={s + st} label={s} mid={st} value={k === "ok" ? "●" : "●"} ok={k === "ok"} />
            ))}
          </Panel>


          <Panel title="VOLUME INDICATORS" icon={LineChart}>
            <div className="flex items-end gap-1 h-24 mt-2">
              {Array.from({ length: 22 }).map((_, i) => {
                const h = 20 + ((i * 53) % 70);
                const hot = i > 14;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{
                      height: `${h}%`,
                      background: hot ? "linear-gradient(180deg, oklch(0.88 0.2 165), oklch(0.6 0.18 165))" : "linear-gradient(180deg, oklch(0.85 0.18 200 / 0.7), oklch(0.5 0.18 200 / 0.5))",
                    }}
                  />
                );
              })}
            </div>
          </Panel>
        </motion.div>
      </div>
    </section>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="glass-strong border-glow rounded-2xl p-5 scanline">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
        <span className="text-[10px] font-mono tracking-[0.3em] text-muted-foreground">{title}</span>
        <Icon className="size-3.5 text-primary" />
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function LiveMarketPanel() {
  const { data, isLoading, isError } = useMarketPrices();
  const coins = (data ?? []).slice(0, 6);
  return (
    <div className="glass-strong border-glow rounded-2xl p-5 scanline lg:col-span-1 relative">
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
        {isLoading && !data && (
          <div className="text-[11px] font-mono text-muted-foreground">Connecting to feed…</div>
        )}
        {coins.map((c) => (
          <div key={c.sym} className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-foreground w-12">{c.sym}</span>
            <span className="text-muted-foreground tabular-nums">{formatPrice(c.px)}</span>
            <span
              className={`tabular-nums w-16 text-right ${c.ch < 0 ? "text-red-400" : "text-accent"}`}
            >
              {c.ch >= 0 ? "+" : ""}
              {c.ch.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ label, mid, value, ok }: { label: string; mid: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between text-[11px] font-mono">
      <span className="text-foreground">{label}</span>
      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">{mid}</span>
      <span className={ok === false ? "text-red-400" : "text-accent"}>{value}</span>
    </div>
  );
}

/* PARTNERSHIPS ---------------------------------------------------- */
const partners = [
  { name: "Community Alpha", tag: "Network",      icon: MessageCircle },
  { name: "Web3 Builders",   tag: "Builders",     icon: Cpu },
  { name: "AI Infrastructure", tag: "AI",         icon: Brain },
  { name: "Trading Ecosystem", tag: "Trading",    icon: LineChart },
  { name: "Launch Partners", tag: "Launchpads",   icon: Flame },
  { name: "Strategic Networks", tag: "Strategy",  icon: Network },
];

export function Partnerships() {
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
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="group glass rounded-2xl p-6 border-glow hover:bg-white/[0.06] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="size-12 grid place-items-center rounded-xl bg-white/5 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                  <p.icon className="size-5" />
                </div>
                <div>
                  <div className="font-display text-lg text-foreground">{p.name}</div>
                  <div className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground uppercase mt-1">{p.tag}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div {...fadeUp} className="mt-10 glass-strong border-glow rounded-2xl p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div>
            <div className="font-display text-2xl sm:text-3xl text-chrome">Interested in Partnership?</div>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">Communities, AI projects, launchpads, KOL networks — let's build.</p>
          </div>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-3 text-[12px] font-medium uppercase tracking-[0.18em] glow-cyan hover:scale-[1.03] transition-transform"
          >
            Contact For Collaboration <ArrowUpRight className="size-4" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

/* SOCIAL PROOF ---------------------------------------------------- */
export function SocialProof() {
  const items = [
    { v: "14+",  l: "Multi-Chain Ecosystem" },
    { v: "10k+", l: "Growing Web3 Community" },
    { v: "AI",   l: "Enhanced Workflows" },
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
              <div className="text-chrome font-display text-4xl sm:text-5xl font-semibold">{it.v}</div>
              <div className="mt-2 text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{it.l}</div>
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
            <a href="https://t.me/DxmZone" target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-3 text-[12px] font-medium uppercase tracking-[0.18em] glow-cyan hover:scale-[1.03] transition-transform">
              <Send className="size-3.5" /> Join Telegram
            </a>
            <a href="https://x.com/vaultmarco" target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-2 rounded-full glass border-glow px-5 py-3 text-[12px] font-medium uppercase tracking-[0.18em] hover:bg-white/8 transition-colors">
              <Twitter className="size-3.5" /> Follow on X
            </a>
            <a href="https://trade.padre.gg/rk/dexmultichain" target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-2 rounded-full glass border-glow px-5 py-3 text-[12px] font-medium uppercase tracking-[0.18em] hover:bg-white/8 transition-colors">
              <TerminalIcon className="size-3.5" /> Open Terminal
            </a>
          </div>
        </motion.div>

        <motion.form
          {...fadeUp}
          onSubmit={(e) => { e.preventDefault(); alert("Message captured. Marco will reach out."); }}
          className="mt-14 glass-strong border-glow rounded-3xl p-6 sm:p-10 grid sm:grid-cols-2 gap-4"
        >
          <Field label="Name" name="name" placeholder="Your name" />
          <Field label="Telegram" name="telegram" placeholder="@handle" />
          <Field label="Email" name="email" type="email" placeholder="you@domain.com" className="sm:col-span-2" />
          <Field label="Message" name="message" placeholder="Tell us about the collaboration…" textarea className="sm:col-span-2" />
          <div className="sm:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2">
            <span className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground">
              SECURE · ENCRYPTED · DIRECT
            </span>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 text-[12px] font-medium uppercase tracking-[0.18em] glow-cyan hover:scale-[1.03] transition-transform"
            >
              Transmit <ArrowUpRight className="size-4" />
            </button>
          </div>
        </motion.form>
      </div>
    </section>
  );
}

function Field({
  label, name, placeholder, type = "text", textarea, className = "",
}: {
  label: string; name: string; placeholder?: string; type?: string; textarea?: boolean; className?: string;
}) {
  const cls =
    "w-full bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/40 transition-all";
  return (
    <label className={`block ${className}`}>
      <span className="block text-[10px] font-mono tracking-[0.25em] text-muted-foreground mb-2 uppercase">{label}</span>
      {textarea ? (
        <textarea name={name} rows={4} placeholder={placeholder} className={cls} />
      ) : (
        <input name={name} type={type} placeholder={placeholder} className={cls} />
      )}
    </label>
  );
}

/* FOOTER ---------------------------------------------------------- */
export function Footer() {
  return (
    <footer className="relative pt-16 pb-10 border-t border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-2">
            <div className="font-display font-semibold text-chrome text-xl tracking-[0.18em]">MARCOVAULT</div>
            <p className="mt-4 text-sm text-muted-foreground max-w-sm leading-relaxed">
              Built for the next generation of Web3 operators. Multi-chain alpha, AI workflows and sniper-grade execution.
            </p>
          </div>

          <div>
            <div className="text-[10px] font-mono tracking-[0.3em] text-muted-foreground mb-4">NAVIGATE</div>
            <ul className="space-y-2 text-sm">
              {["About","Ecosystem","Tools","Partnerships","Contact"].map(l=>(
                <li key={l}><a href={`#${l.toLowerCase()}`} className="text-muted-foreground hover:text-foreground transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-[10px] font-mono tracking-[0.3em] text-muted-foreground mb-4">CONNECT</div>
            <ul className="space-y-2 text-sm">
              <li><a href="https://x.com/vaultmarco" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">X / Twitter</a></li>
              <li><a href="https://t.me/DxmZone" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">Telegram Group</a></li>
              <li><a href="https://t.me/DexMultichain" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">Telegram Channel</a></li>
              <li><a href="https://trade.padre.gg/rk/dexmultichain" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">Padre Terminal</a></li>
              <li><a href="https://t.me/achilles_trojanbot?start=r-oxjackpot" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">Sniper Bot</a></li>
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

// silence unused
export const _ = { Bot };
