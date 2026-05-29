import { motion } from "framer-motion";
import { useState } from "react";
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
import { SectionHeader, fadeUp } from "./SectionHeader";
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

// Simple logo component using Lucide icons
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
    <div
      className="size-6 rounded-full border border-white/10 flex items-center justify-center"
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
