import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { X, Activity, Zap, Users, BarChart3, ArrowUpRight, CheckCircle2 } from "lucide-react";

const partnerData = {
  "Trading Ecosystem": {
    tag: "Trading",
    description: "Integrated trading infrastructure with DEXs, CEXs, and order book aggregators.",
    stats: [
      { label: "Total Volume", value: "$1.2B" },
      { label: "Active Traders", value: "24,500" },
      { label: "Trading Pairs", value: "3,200" },
      { label: "Slippage", value: "<0.1%" },
    ],
    features: ["Cross-chain swaps", "Limit orders", "Stop-loss/take-profit", "Slippage protection"],
    partners: ["Uniswap", "Jupiter", "1inch", "Kyber Network"],
  },
  "Launch Partners": {
    tag: "Launchpads",
    description: "Curated launchpad network for vetted token launches and initial offerings.",
    stats: [
      { label: "Projects Launched", value: "120+" },
      { label: "Average ROI", value: "3.2x" },
      { label: "Holders", value: "50,000+" },
      { label: "Success Rate", value: "88%" },
    ],
    features: [
      "Vetted projects only",
      "Fair launch distribution",
      "Liquidity lock verification",
      "Post-launch support",
    ],
    partners: ["CoinList", "DAO Maker", "Starter", "TrustSwap"],
  },
  "Strategic Networks": {
    tag: "Strategy",
    description:
      "Strategic network partnerships with KOLs, communities, and infrastructure providers.",
    stats: [
      { label: "Community Size", value: "500,000+" },
      { label: "KOL Partners", value: "85+" },
      { label: "Regional Hubs", value: "12" },
      { label: "Partnership ROI", value: "5.8x" },
    ],
    features: [
      "Cross-promotion",
      "Co-marketing campaigns",
      "Community events",
      "Strategic investment",
    ],
    partners: ["CoinGecko", "CoinMarketCap", "Messari", "DefiLlama"],
  },
};

type PartnerName = keyof typeof partnerData;

interface PartnerDashboardModalProps {
  partnerName: PartnerName | null;
  onClose: () => void;
}

export function PartnerDashboardModal({ partnerName, onClose }: PartnerDashboardModalProps) {
  if (!partnerName || !partnerData[partnerName]) return null;
  const data = partnerData[partnerName];

  return (
    <Dialog open={!!partnerName} onOpenChange={() => onClose()}>
      <DialogContent className="glass-strong border-glow sm:max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-[10px] font-mono tracking-[0.25em] text-primary uppercase mb-1">
                {data.tag}
              </div>
              <DialogTitle className="font-display text-2xl text-chrome">{partnerName}</DialogTitle>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="size-5 text-muted-foreground" />
            </button>
          </div>
          <DialogDescription className="text-muted-foreground text-sm">
            {data.description}
          </DialogDescription>
        </DialogHeader>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          {data.stats.map((stat, i) => (
            <div
              key={i}
              className="p-4 rounded-xl border border-white/10 hover:bg-white/5 transition-colors"
            >
              <div className="text-[11px] text-muted-foreground font-mono mb-1">{stat.label}</div>
              <div className="text-xl font-display text-foreground">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="mt-5">
          <div className="text-[11px] font-mono tracking-[0.25em] text-primary uppercase mb-2">
            Features
          </div>
          <div className="grid grid-cols-2 gap-2">
            {data.features.map((feat, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle2 className="size-3.5 text-accent" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Network Partners */}
        <div className="mt-5">
          <div className="text-[11px] font-mono tracking-[0.25em] text-primary uppercase mb-2">
            Network Members
          </div>
          <div className="flex flex-wrap gap-2">
            {data.partners.map((p, i) => (
              <div
                key={i}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-muted-foreground"
              >
                {p}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <a
            href="#contact"
            onClick={onClose}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-3 text-[12px] font-medium uppercase tracking-[0.18em] glow-cyan hover:scale-[1.01] transition-transform"
          >
            Partner With Us <ArrowUpRight className="size-4" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
