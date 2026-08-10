import { TrendingUp, Zap, Shield, DollarSign } from "lucide-react";

interface KPI {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const kpis: KPI[] = [
  { title: "TOTAL VOLUME · 24H", value: "$124.5M", change: "+18.2%", isPositive: true, icon: TrendingUp },
  { title: "ACTIVE BOOSTS", value: "127", change: "+12.5%", isPositive: true, icon: Zap },
  { title: "RUG SCANNER CHECKS", value: "2,847", change: "−5.3%", isPositive: false, icon: Shield },
  { title: "TOTAL MARKET CAP", value: "$2.4T", change: "+3.1%", isPositive: true, icon: DollarSign },
];

/** Machined stat cells — one hairline frame, dividers instead of gaps. */
export function KPICards() {
  return (
    <div className="hairline mb-8 grid grid-cols-1 bg-(--panel) md:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        return (
          <div
            key={index}
            className="border-b border-(--hairline) p-6 last:border-b-0 md:[&:nth-child(odd)]:border-r lg:border-b-0 lg:[&:not(:last-child)]:border-r"
          >
            <div className="flex items-center justify-between">
              <span className="mono-label text-[9px]!">{kpi.title}</span>
              <Icon className="size-3.5 text-(--faint)" strokeWidth={1.8} />
            </div>
            <div className="mono-data mt-4 text-[24px] font-medium leading-none text-(--bone)">
              {kpi.value}
            </div>
            <div className={`mono-data mt-2 text-[11px] ${kpi.isPositive ? "text-(--up)" : "text-(--down)"}`}>
              {kpi.change}
            </div>
          </div>
        );
      })}
    </div>
  );
}
