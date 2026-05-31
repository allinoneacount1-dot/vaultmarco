import { TrendingUp, Zap, Shield, DollarSign } from "lucide-react";

interface KPI {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: React.ElementType;
  color: string;
}

const kpis: KPI[] = [
  {
    title: "Total Volume (24h)",
    value: "$124.5M",
    change: "+18.2%",
    isPositive: true,
    icon: TrendingUp,
    color: "from-green-500/20 to-emerald-500/10 border-green-500/30",
  },
  {
    title: "Active Boosts",
    value: "127",
    change: "+12.5%",
    isPositive: true,
    icon: Zap,
    color: "from-purple-500/20 to-violet-500/10 border-purple-500/30",
  },
  {
    title: "Rug Scanner Check",
    value: "2,847",
    change: "-5.3%",
    isPositive: false,
    icon: Shield,
    color: "from-red-500/20 to-rose-500/10 border-red-500/30",
  },
  {
    title: "Total Market Cap",
    value: "$2.4T",
    change: "+3.1%",
    isPositive: true,
    icon: DollarSign,
    color: "from-cyan-500/20 to-blue-500/10 border-cyan-500/30",
  },
];

export function KPICards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        return (
          <div
            key={index}
            className={`glass-strong rounded-2xl p-6 border ${kpi.color} hover:scale-[1.02] transition-all duration-300`}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className={`p-3 rounded-xl ${
                  kpi.isPositive ? "bg-green-500/20" : "bg-red-500/20"
                }`}
              >
                <Icon
                  className={`size-5 ${
                    kpi.isPositive ? "text-green-400" : "text-red-400"
                  }`}
                />
              </div>
              <span
                className={`text-[11px] font-mono px-2 py-1 rounded-full ${
                  kpi.isPositive
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {kpi.change}
              </span>
            </div>
            <h3 className="text-[11px] font-mono tracking-wide text-muted-foreground mb-1">
              {kpi.title}
            </h3>
            <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
          </div>
        );
      })}
    </div>
  );
}
