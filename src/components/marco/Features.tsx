import { motion } from "framer-motion";
import {
  Activity,
  Bell,
  Database,
  LineChart,
  RadioTower,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";
import { SectionHeader, fadeUp, staggerContainer } from "./SectionHeader";

const features = [
  { icon: ShieldCheck, t: "Rug Scanner", d: "Quick safety checks for tokens before trading." },
  { icon: Zap, t: "Price Alerts", d: "Custom notifications for your target entry/exit points." },
  { icon: Activity, t: "On-Chain Heatmap", d: "Visualize chain activity at a glance." },
  { icon: Bell, t: "Whale Watch", d: "Track smart money movements across chains." },
  { icon: LineChart, t: "Live Charting", d: "Professional price charts for technical analysis." },
  { icon: RadioTower, t: "News Feed", d: "Curated crypto news integrated into your workflow." },
  { icon: Wallet, t: "Wallet Connection", d: "RainbowKit-powered wallet support." },
];

export function Features() {
  return (
    <section id="tools" className="relative py-24 sm:py-32 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
        <SectionHeader
          kicker="03 / CAPABILITIES"
          title="Featured Capabilities."
          sub="Tools built for operators, by operators."
        />

        <motion.div
          className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-4"
          variants={staggerContainer}
          initial="initial"
          whileInView="whileInView"
          viewport={{ once: true, margin: "-100px" }}
        >
          {features.map((f, i) => (
            <motion.div
              key={f.t}
              className="group glass rounded-xl p-5 border-glow hover:bg-white/[0.06] transition-all relative overflow-hidden"
              variants={fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.08 }}
              whileHover={{ scale: 1.05, y: -6, boxShadow: "0 20px 40px rgba(145,231,255,0.15)" }}
              whileTap={{ scale: 0.97 }}
            >
              <motion.div
                className="absolute -top-10 -right-10 size-24 rounded-full bg-primary/20 blur-xl"
                animate={{
                  scale: [1, 1.4, 1],
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.2,
                }}
              />
              <motion.div
                className="size-10 grid place-items-center rounded-lg bg-white/5 text-primary mb-4 relative z-10"
                whileHover={{
                  scale: 1.2,
                  rotate: 360,
                  backgroundColor: "rgba(145,231,255,0.3)",
                  boxShadow: "0 0 25px rgba(145,231,255,0.4)",
                }}
                transition={{
                  scale: { type: "spring", stiffness: 400, damping: 10 },
                  rotate: { duration: 0.6, ease: "easeInOut" },
                }}
              >
                <f.icon className="size-4" />
              </motion.div>
              <motion.div
                className="font-display text-base text-foreground relative z-10"
                whileHover={{ scale: 1.05 }}
              >
                {f.t}
              </motion.div>
              <motion.div
                className="text-xs text-muted-foreground mt-1.5 relative z-10"
                initial={{ opacity: 0.8 }}
                whileHover={{ opacity: 1 }}
              >
                {f.d}
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
