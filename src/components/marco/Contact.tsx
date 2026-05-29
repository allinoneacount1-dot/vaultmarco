import { motion } from "framer-motion";
import { ArrowUpRight, MessageSquare, Terminal, Zap } from "lucide-react";
import { SectionHeader, fadeUp } from "./SectionHeader";

export function Contact() {
  return (
    <section id="contact" className="relative py-24 sm:py-32 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
        <SectionHeader
          kicker="06 / CONTACT"
          title="Join the Operation."
          sub="Direct link to the Vault's command center."
        />

        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.1 }}
          className="mt-14 grid lg:grid-cols-2 gap-6"
        >
          <motion.div
            className="glass-strong rounded-3xl p-8 sm:p-10 border-glow relative overflow-hidden group"
            whileHover={{ scale: 1.01, boxShadow: "0 20px 50px rgba(145,231,255,0.15)" }}
          >
            <motion.div
              className="absolute -top-32 -left-32 size-64 rounded-full bg-primary/20 blur-3xl"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute -bottom-32 -right-32 size-64 rounded-full bg-violet-500/20 blur-3xl"
              animate={{
                scale: [1, 1.4, 1],
                opacity: [0.2, 0.4, 0.2],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5,
              }}
            />
            <div className="relative z-10">
              <motion.div
                className="size-12 grid place-items-center rounded-2xl bg-primary/10 text-primary mb-5"
                whileHover={{
                  scale: 1.15,
                  rotate: 10,
                  boxShadow: "0 0 30px rgba(145,231,255,0.4)",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <MessageSquare className="size-5" />
              </motion.div>
              <motion.h3
                className="text-chrome font-display text-2xl sm:text-3xl"
                whileHover={{ scale: 1.02 }}
              >
                Community Group
              </motion.h3>
              <p className="text-muted-foreground mt-2 mb-7 text-sm sm:text-base">
                Live discussions, setups and alpha among operators.
              </p>
              <motion.a
                href="https://t.me/DxmZone"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 text-[11px] font-medium uppercase tracking-[0.2em] glow-cyan hover:scale-[1.03] transition-transform"
                whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(145,231,255,0.5)" }}
                whileTap={{ scale: 0.98 }}
              >
                Enter Telegram
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ArrowUpRight className="size-4" />
                </motion.div>
              </motion.a>
            </div>
          </motion.div>

          <motion.div
            className="glass-strong rounded-3xl p-8 sm:p-10 border-glow relative overflow-hidden group"
            whileHover={{ scale: 1.01, boxShadow: "0 20px 50px rgba(145,231,255,0.15)" }}
          >
            <motion.div
              className="absolute -top-32 -right-32 size-64 rounded-full bg-[#BE96FF]/20 blur-3xl"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.2,
              }}
            />
            <div className="relative z-10">
              <motion.div
                className="size-12 grid place-items-center rounded-2xl bg-primary/10 text-primary mb-5"
                whileHover={{
                  scale: 1.15,
                  rotate: -10,
                  boxShadow: "0 0 30px rgba(190,150,255,0.4)",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <Terminal className="size-5" />
              </motion.div>
              <motion.h3
                className="text-chrome font-display text-2xl sm:text-3xl"
                whileHover={{ scale: 1.02 }}
              >
                Alpha Channel
              </motion.h3>
              <p className="text-muted-foreground mt-2 mb-7 text-sm sm:text-base">
                Broadcast-only updates, curated narratives and high-signal intel.
              </p>
              <motion.a
                href="https://t.me/DexMultichain"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-white/5 text-foreground px-6 py-3 text-[11px] font-medium uppercase tracking-[0.2em] border border-white/10 hover:bg-white/10 transition-colors"
                whileHover={{ scale: 1.05, borderColor: "rgba(145,231,255,0.3)" }}
                whileTap={{ scale: 0.98 }}
              >
                Open Channel
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                >
                  <Zap className="size-4" />
                </motion.div>
              </motion.a>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
