import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Cpu,
  Hexagon,
  Layers,
  Coins,
  Globe,
  TrendingUp,
  Zap,
  Rocket,
  MessageCircle,
  RadioTower,
  ShieldCheck,
  LineChart,
  Flame,
  Network,
} from "lucide-react";
import { SectionHeader, fadeUp, staggerContainer } from "./SectionHeader";
import { PartnerDashboardModal } from "./PartnerDashboardModal";

const partners = [
  {
    name: "Community Alpha",
    tag: "Network",
    icon: MessageCircle,
    logos: ["solana", "telegram", "discord"],
  },
  { name: "Web3 Builders", tag: "Builders", icon: Cpu, logos: ["ethereum", "solana", "bnb"] },
  { name: "AI Infrastructure", tag: "AI", icon: Cpu, logos: ["nvidia", "openai", "coingecko"] },
  {
    name: "Trading Ecosystem",
    tag: "Trading",
    icon: LineChart,
    logos: ["uniswap", "jupiter", "pumpfun"],
  },
  {
    name: "Launch Partners",
    tag: "Launchpads",
    icon: Flame,
    logos: ["coinlist", "daomaker", "trustswap"],
  },
  {
    name: "Strategic Networks",
    tag: "Strategy",
    icon: Network,
    logos: ["solana", "ethereum", "bnb", "base"],
  },
];

const PartnerLogo = ({ name }: { name: string }) => {
  const config: Record<string, { bg: string; icon: React.ReactNode }> = {
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
    openai: { bg: "#10a37f", icon: <Cpu className="size-3" /> },
    coingecko: { bg: "#fca311", icon: <TrendingUp className="size-3" /> },
    coinlist: { bg: "#38bdf8", icon: <TrendingUp className="size-3" /> },
    daomaker: { bg: "#818cf8", icon: <ShieldCheck className="size-3" /> },
    trustswap: { bg: "#fca311", icon: <Layers className="size-3" /> },
  };
  const c = config[name] || { bg: "#64748b", icon: <Hexagon className="size-3" /> };

  return (
    <motion.div
      className="size-6 rounded-full border border-white/10 flex items-center justify-center"
      style={{ backgroundColor: c.bg }}
      whileHover={{ scale: 1.2, rotate: 10 }}
      transition={{ type: "spring", stiffness: 400, damping: 10 }}
    >
      {c.icon}
    </motion.div>
  );
};

export function Partnerships() {
  const [openPartner, setOpenPartner] = useState<string | null>(null);
  return (
    <section id="partnerships" className="relative py-24 sm:py-32 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
        <SectionHeader
          kicker="05 / PARTNERSHIPS"
          title="Allied Networks."
          sub="Building bridges across communities, ecosystems and AI infrastructure. Future-proof collaborations only."
        />

        <motion.div
          className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={staggerContainer}
          initial="initial"
          whileInView="whileInView"
          viewport={{ once: true, margin: "-100px" }}
        >
          {partners.map((p, i) => (
            <motion.button
              key={p.name}
              type="button"
              className="w-full group glass rounded-2xl p-6 border-glow hover:bg-white/[0.06] transition-all text-left relative overflow-hidden"
              variants={fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.1 }}
              whileHover={{ scale: 1.03, y: -5, boxShadow: "0 20px 40px rgba(145,231,255,0.15)" }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setOpenPartner(p.name)}
            >
              <motion.div
                className="absolute -bottom-20 -right-20 size-40 rounded-full bg-primary/20 blur-xl"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.2, 0.4, 0.2],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.3,
                }}
              />
              <div className="flex items-start gap-4 relative z-10">
                <motion.div
                  className="size-12 grid place-items-center rounded-xl bg-white/5 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-all"
                  whileHover={{
                    scale: 1.1,
                    rotate: -5,
                    boxShadow: "0 0 20px rgba(145,231,255,0.3)",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <p.icon className="size-5" />
                </motion.div>
                <div>
                  <motion.div
                    className="font-display text-lg text-foreground"
                    whileHover={{ scale: 1.03 }}
                  >
                    {p.name}
                  </motion.div>
                  <div className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground uppercase mt-1">
                    {p.tag}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 flex-wrap relative z-10">
                {p.logos?.map((logo, idx) => (
                  <PartnerLogo key={idx} name={logo} />
                ))}
              </div>
            </motion.button>
          ))}
        </motion.div>

        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.3 }}
          className="mt-10 glass-strong border-glow rounded-2xl p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative overflow-hidden"
          whileHover={{ scale: 1.01 }}
        >
          <motion.div
            className="absolute -top-20 left-1/2 -translate-x-1/2 size-[300px] rounded-full bg-primary/20 blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <div className="relative z-10">
            <div className="font-display text-2xl sm:text-3xl text-chrome">
              Interested in Partnership?
            </div>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Communities, AI projects, launchpads, KOL networks — let's build.
            </p>
          </div>
          <motion.a
            href="#contact"
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-3 text-[12px] font-medium uppercase tracking-[0.18em] glow-cyan hover:scale-[1.03] transition-transform relative z-10"
            whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(145,231,255,0.5)" }}
            whileTap={{ scale: 0.98 }}
          >
            Contact For Collaboration
            <motion.div
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <ArrowUpRight className="size-4" />
            </motion.div>
          </motion.a>
        </motion.div>

        <PartnerDashboardModal partnerName={openPartner} onClose={() => setOpenPartner(null)} />
      </div>
    </section>
  );
}
