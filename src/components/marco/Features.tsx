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
import { SectionHeader, fadeUp } from "./SectionHeader";

const features = [
  { icon: ShieldCheck, t: "Rug Scanner", d: "Quick safety checks for tokens before trading." },
  { icon: Zap, t: "Price Alerts", d: "Custom notifications for your target entry/exit points." },
  { icon: Activity, t: "On-Chain Heatmap", d: "Visualize chain activity at a glance." },
  { icon: Database, t: "Watchlist Sync", d: "Saved in your browser, accessible anytime." },
  { icon: Bell, t: "Whale Watch", d: "Track smart money movements across chains." },
  { icon: LineChart, t: "Live Charting", d: "Professional price charts for technical analysis." },
  { icon: RadioTower, t: "News Feed", d: "Curated crypto news integrated into your workflow." },
  { icon: Wallet, t: "Wallet Connection", d: "RainbowKit-powered wallet support." },
];

export function Features() {
  return (
    <section id="tools" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div {...fadeUp}>
          <SectionHeader
            kicker="03 / CAPABILITIES"
            title="Featured Capabilities."
            sub="Tools built for operators, by operators."
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
