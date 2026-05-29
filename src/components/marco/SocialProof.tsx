import { motion } from "framer-motion";
import { fadeUp } from "./SectionHeader";

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
              <div className="mt-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                {it.l}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
