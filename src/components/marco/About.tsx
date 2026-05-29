import { motion } from "framer-motion";
import { Globe2, Brain, Network, MessageCircle } from "lucide-react";
import { SectionHeader, fadeUp } from "./SectionHeader";

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
