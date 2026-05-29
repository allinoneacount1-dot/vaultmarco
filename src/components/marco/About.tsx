import { motion } from "framer-motion";
import { Globe2, Brain, Network, MessageCircle } from "lucide-react";
import { SectionHeader, fadeUp, staggerContainer } from "./SectionHeader";

export function About() {
  const stats = [
    { v: "14+", l: "Chains Tracked" },
    { v: "24/7", l: "Market Coverage" },
    { v: "AI", l: "Powered Workflows" },
    { v: "∞", l: "Alpha Pipeline" },
  ];

  const features = [
    { icon: Globe2, t: "Multi-Chain Native", d: "Solana, Ethereum, Base, Hyperliquid, BNB, Sui & beyond — one operator, every chain." },
    { icon: Brain, t: "AI Workflow Builder", d: "Custom pipelines for signal extraction, narrative tracking and execution support." },
    { icon: Network, t: "Trading Infrastructure", d: "Sniper-grade execution, terminals and scanners wired into a single command surface." },
    { icon: MessageCircle, t: "Community Intel", d: "Live discussions, curated channels and signal sharing across the ecosystem." },
  ];

  return (
    <section id="about" className="relative py-24 sm:py-32 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
        <SectionHeader
          kicker="01 / ABOUT"
          title="Building Systems For The Next Crypto Cycle."
          sub="Operating at the intersection of Web3 markets, AI infrastructure, and community-driven research. Marco builds the systems, tools, and intelligence flows that turn market noise into actionable alpha."
        />

        <div className="mt-14 grid lg:grid-cols-12 gap-6">
          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.1 }}
            className="lg:col-span-7 glass border-glow rounded-2xl p-7 sm:p-10 relative overflow-hidden"
            whileHover={{ scale: 1.01, transition: { duration: 0.3 } }}
          >
            <motion.div
              className="absolute -top-20 -left-20 size-64 rounded-full bg-primary/20 blur-3xl"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute -bottom-20 -right-20 size-64 rounded-full bg-violet-500/20 blur-3xl"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.2, 0.4, 0.2],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5,
              }}
            />

            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="whileInView"
              viewport={{ once: true, margin: "-100px" }}
              className="grid sm:grid-cols-2 gap-6 relative z-10"
            >
              {features.map((b, i) => (
                <motion.div
                  key={t(b.t)}
                  className="group relative"
                  variants={fadeUp}
                  transition={{ ...fadeUp.transition, delay: i * 0.1 }}
                  whileHover={{ scale: 1.05, x: 5 }}
                >
                  <motion.div
                    className="size-9 grid place-items-center rounded-lg bg-primary/10 text-primary mb-3 group-hover:glow-cyan transition-all"
                    whileHover={{
                      scale: 1.1,
                      rotate: 5,
                      backgroundColor: "rgba(145, 231, 255, 0.3)",
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  >
                    <b.icon className="size-4" />
                  </motion.div>
                  <div className="font-display text-lg text-foreground">{b.t}</div>
                  <div className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{b.d}</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div
            className="lg:col-span-5 grid grid-cols-2 gap-4"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true, margin: "-100px" }}
          >
            {stats.map((s, i) => (
              <motion.div
                key={s.l}
                className="glass rounded-2xl p-6 border-glow relative overflow-hidden group"
                variants={fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.15 }}
                whileHover={{
                  scale: 1.05,
                  y: -5,
                  transition: { duration: 0.3 },
                }}
              >
                <motion.div
                  className="absolute -top-10 -right-10 size-24 rounded-full bg-primary/20 blur-2xl"
                  animate={{
                    scale: [1, 1.3, 1],
                    x: [0, 10, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.2,
                  }}
                />
                <motion.div
                  className="text-chrome font-display text-4xl sm:text-5xl font-semibold"
                  animate={{
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.2,
                  }}
                >
                  {s.v}
                </motion.div>
                <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  {s.l}
                </div>
              </motion.div>
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
