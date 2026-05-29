import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "./SectionHeader";

const metrics = [
  { v: "14+", label: "Chains", color: "text-primary" },
  { v: "24/7", label: "Coverage", color: "text-[#BE96FF]" },
  { v: "AI", label: "Powered", color: "text-[#B4FFC8]" },
  { v: "∞", label: "Alpha", color: "text-primary" },
];

export function SocialProof() {
  return (
    <section className="relative py-20 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-10"
          variants={staggerContainer}
          initial="initial"
          whileInView="whileInView"
          viewport={{ once: true, margin: "-100px" }}
        >
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              className="flex flex-col items-center gap-1"
              variants={fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.15 }}
            >
              <motion.div
                className={`font-display text-5xl sm:text-6xl ${m.color}`}
                animate={{
                  scale: [1, 1.1, 1],
                  textShadow: [
                    "0 0 20px rgba(145,231,255,0.3)",
                    "0 0 40px rgba(145,231,255,0.6)",
                    "0 0 20px rgba(145,231,255,0.3)",
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.3,
                }}
              >
                {m.v}
              </motion.div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                {m.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
