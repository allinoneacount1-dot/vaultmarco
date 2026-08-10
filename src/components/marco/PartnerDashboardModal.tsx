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
  ShieldCheck,
  Sparkles,
  Globe,
  Rocket,
  Coins,
  Hexagon,
  Layers,
  RadioTower,
  Terminal,
  Cpu,
  Bot,
  LineChart as LineChartIcon,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

// Simple logo component using Lucide icons
const PartnerLogo = ({ name }: { name: string }) => {
  const config: Record<string, { bg: string; icon: React.ReactNode }> = {
    solana: { bg: "#17181B", icon: <Hexagon className="size-3" /> },
    ethereum: { bg: "#17181B", icon: <Layers className="size-3" /> },
    bnb: { bg: "#17181B", icon: <Coins className="size-3" /> },
    base: { bg: "#17181B", icon: <Globe className="size-3" /> },
    uniswap: { bg: "#17181B", icon: <TrendingUp className="size-3" /> },
    jupiter: { bg: "#17181B", icon: <Zap className="size-3" /> },
    pumpfun: { bg: "#17181B", icon: <Rocket className="size-3" /> },
    "1inch": { bg: "#17181B", icon: <LineChartIcon className="size-3" /> },
    telegram: { bg: "#17181B", icon: <RadioTower className="size-3" /> },
    discord: { bg: "#17181B", icon: <RadioTower className="size-3" /> },
    nvidia: { bg: "#17181B", icon: <Cpu className="size-3" /> },
    openai: { bg: "#17181B", icon: <Bot className="size-3" /> },
    coingecko: { bg: "#17181B", icon: <Sparkles className="size-3" /> },
    coinmarketcap: { bg: "#17181B", icon: <Coins className="size-3" /> },
    messari: { bg: "#17181B", icon: <Sparkles className="size-3" /> },
    defillama: { bg: "#17181B", icon: <BarChart3 className="size-3" /> },
    coinlist: { bg: "#17181B", icon: <Terminal className="size-3" /> },
    daomaker: { bg: "#17181B", icon: <ShieldCheck className="size-3" /> },
    trustswap: { bg: "#17181B", icon: <Layers className="size-3" /> },
    starter: { bg: "#17181B", icon: <Rocket className="size-3" /> },
  };
  const c = config[name.toLowerCase()] || { bg: "#17181B", icon: <Hexagon className="size-3" /> };

  return (
    <div
      className="size-6 rounded-full border border-(--hairline) flex items-center justify-center"
      style={{ backgroundColor: c.bg }}
    >
      {c.icon}
    </div>
  );
};

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
    description:
      "Integrated trading infrastructure with DEXs, CEXs, and order book aggregators across multiple chains.",
    stats: [
      { label: "Total Volume", value: "$1.2B" },
      { label: "Active Traders", value: "24,500" },
      { label: "Trading Pairs", value: "3,200" },
      { label: "Slippage", value: "<0.1%" },
    ],
    features: ["Cross-chain swaps", "Limit orders", "Stop-loss/take-profit", "Slippage protection"],
    partners: [
      { name: "Uniswap", key: "uniswap" },
      { name: "Jupiter", key: "jupiter" },
      { name: "PumpFun", key: "pumpfun" },
      { name: "1inch", key: "1inch" },
    ],
  },
  "Launch Partners": {
    tag: "Launchpads",
    description:
      "Curated launchpad network for vetted token launches and initial offerings across major chains.",
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
      { name: "CoinList", key: "coinlist" },
      { name: "DAO Maker", key: "daomaker" },
      { name: "Starter", key: "starter" },
      { name: "TrustSwap", key: "trustswap" },
    ],
  },
  "Strategic Networks": {
    tag: "Strategy",
    description:
      "Strategic network partnerships with KOLs, communities, and layer-1/2 infrastructure providers.",
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
      { name: "Solana", key: "solana" },
      { name: "Ethereum", key: "ethereum" },
      { name: "BNB Chain", key: "bnb" },
      { name: "Base", key: "base" },
      { name: "CoinGecko", key: "coingecko" },
      { name: "CoinMarketCap", key: "coinmarketcap" },
      { name: "Messari", key: "messari" },
      { name: "DefiLlama", key: "defillama" },
    ],
  },
};

export type PartnerName = keyof typeof partnerData;

interface PartnerDashboardModalProps {
  partnerName: PartnerName | null;
  onClose: () => void;
}

export function PartnerDashboardModal({ partnerName, onClose }: PartnerDashboardModalProps) {
  if (!partnerName || !partnerData[partnerName]) return null;
  const data = partnerData[partnerName];

  return (
    <Dialog open={!!partnerName} onOpenChange={() => onClose()}>
      <DialogContent className="hairline bg-(--panel) sm:max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-[10px] font-mono tracking-[0.25em] text-(--gold) uppercase mb-1">
                {data.tag}
              </div>
              <DialogTitle className="font-display text-2xl chrome-text">{partnerName}</DialogTitle>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-(--panel-2) transition-colors"
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
              className="p-4 rounded-md border border-(--hairline) hover:bg-(--panel-2) transition-colors"
            >
              <div className="text-[11px] text-muted-foreground font-mono mb-1">{stat.label}</div>
              <div className="text-xl font-display text-foreground">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Growth Chart */}
        <div className="mt-5">
          <div className="text-[11px] font-mono tracking-[0.25em] text-(--gold) uppercase mb-2 flex items-center gap-1.5">
            <TrendingUp className="size-3" /> Growth Trend
          </div>
          <div className="h-48 rounded-md border border-(--hairline) p-2">
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
          <div className="text-[11px] font-mono tracking-[0.25em] text-(--gold) uppercase mb-2">
            Features
          </div>
          <div className="grid grid-cols-2 gap-2">
            {data.features.map((feat, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle2 className="size-3.5 text-(--up)" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Network Partners with Logos */}
        <div className="mt-5">
          <div className="text-[11px] font-mono tracking-[0.25em] text-(--gold) uppercase mb-2">
            Network Members
          </div>
          <div className="flex flex-wrap gap-2">
            {data.partners.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-(--panel-2) border border-(--hairline)"
              >
                <PartnerLogo name={p.key} />
                <span className="text-[11px] text-muted-foreground">{p.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <a
            href="#contact"
            onClick={onClose}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-3 text-[12px] font-medium uppercase tracking-[0.18em] hover:scale-[1.01] transition-transform"
          >
            Partner With Us <ArrowUpRight className="size-4" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
