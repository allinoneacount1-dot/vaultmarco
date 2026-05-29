import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  X,
  Activity,
  Zap,
  Users,
  BarChart3,
  ArrowUpRight,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

// Mock growth data for charts
const growthData = [
  { month: "Jan", value: 100 },
  { month: "Feb", value: 150 },
  { month: "Mar", value: 180 },
  { month: "Apr", value: 220 },
  { month: "May", value: 300 },
  { month: "Jun", value: 380 },
];

const partnerData = {
  "Trading Ecosystem": {
    tag: "Trading",
    description: "Integrated trading infrastructure with DEXs, CEXs, and order book aggregators across multiple chains.",
    stats: [
      { label: "Total Volume", value: "$1.2B" },
      { label: "Active Traders", value: "24,500" },
      { label: "Trading Pairs", value: "3,200" },
      { label: "Slippage", value: "<0.1%" },
    ],
    features: [
      "Cross-chain swaps",
      "Limit orders",
      "Stop-loss/take-profit",
      "Slippage protection",
    ],
    partners: [
      { name: "Uniswap", logo: "https://assets.coingecko.com/coins/images/12541/large/uniswap-uni.png" },
      { name: "Jupiter", logo: "https://assets.coingecko.com/coins/images/28605/large/jup.png" },
      { name: "PumpFun", logo: "https://placehold.co/24x24/0f172a/06b6d4?text=P" },
      { name: "1inch", logo: "https://assets.coingecko.com/coins/images/12229/large/1inch.png" },
    ],
  },
  "Launch Partners": {
    tag: "Launchpads",
    description: "Curated launchpad network for vetted token launches and initial offerings across major chains.",
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
    partners: [
      { name: "CoinList", logo: "https://placehold.co/24x24/0f172a/38bdf8?text=C" },
      { name: "DAO Maker", logo: "https://placehold.co/24x24/0f172a/818cf8?text=D" },
      { name: "Starter", logo: "https://placehold.co/24x24/0f172a/22d3ee?text=T" },
      { name: "TrustSwap", logo: "https://assets.coingecko.com/coins/images/11943/large/swap.png" },
    ],
  },
  "Strategic Networks": {
    tag: "Strategy",
    description: "Strategic network partnerships with KOLs, communities, and layer-1/2 infrastructure providers.",
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
    partners: [
      { name: "Solana", logo: "https://assets.coingecko.com/coins/images/4128/large/solana.png" },
      { name: "Ethereum", logo: "https://assets.coingecko.com/coins/images/279/large/ethereum.png" },
      { name: "BNB Chain", logo: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png" },
      { name: "Base", logo: "https://placehold.co/24x24/0f172a/22c55e?text=B" },
      { name: "CoinGecko", logo: "https://assets.coingecko.com/coins/images/17156/large/coingecko_symbol.png" },
      { name: "CoinMarketCap", logo: "https://placehold.co/24x24/0f172a/60a5fa?text=C" },
      { name: "Messari", logo: "https://placehold.co/24x24/0f172a/a855f4?text=M" },
      { name: "DefiLlama", logo: "https://placehold.co/24x24/0f172a/f59e0b?text=L" },
    ],
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

        {/* Growth Chart */}
        <div className="mt-5">
          <div className="text-[11px] font-mono tracking-[0.25em] text-primary uppercase mb-2 flex items-center gap-1.5">
            <TrendingUp className="size-3" /> Growth Trend
          </div>
          <div className="h-48 rounded-xl border border-white/10 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growthData}>
                <XAxis
                  dataKey="month"
                  stroke="rgba(255,255,255,0.3)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.3)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#050505",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                  itemStyle={{ color: "#6EE7B7" }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#6EE7B7"
                  strokeWidth={2}
                  dot={{ fill: "#6EE7B7", r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
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

        {/* Network Partners with Logos */}
        <div className="mt-5">
          <div className="text-[11px] font-mono tracking-[0.25em] text-primary uppercase mb-2">
            Network Members
          </div>
          <div className="flex flex-wrap gap-2">
            {data.partners.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10"
              >
                <img
                  src={p.logo}
                  alt={p.name}
                  className="size-4 rounded-full object-cover"
                  loading="lazy"
                />
                <span className="text-[11px] text-muted-foreground">{p.name}</span>
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
