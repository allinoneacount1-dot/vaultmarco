import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export function PriceChart({ symbol = "BTC" }: { symbol?: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [activeSymbol, setActiveSymbol] = useState(symbol);

  // Simple SVG chart for reliability instead of lightweight-charts
  const [chartData, setChartData] = useState<number[]>([]);

  useEffect(() => {
    // Generate simple price data
    const data: number[] = [];
    let price = activeSymbol === "BTC" ? 69000 : activeSymbol === "ETH" ? 3600 : activeSymbol === "SOL" ? 140 : 65;
    
    for (let i = 0; i < 100; i++) {
      price += (Math.random() - 0.48) * (price * 0.01);
      data.push(price);
    }
    setChartData(data);
  }, [activeSymbol]);

  // Create SVG path
  const getPath = () => {
    if (chartData.length === 0) return "";
    
    const width = 800;
    const height = 300;
    const max = Math.max(...chartData);
    const min = Math.min(...chartData);
    const range = max - min || 1;
    
    const points = chartData.map((value, i) => {
      const x = (i / (chartData.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    }).join(" ");
    
    const areaPoints = points + ` L ${width} ${height} L 0 ${height} Z`;
    
    return { path: points, area: areaPoints };
  };

  const { path, area } = getPath();

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {["BTC", "ETH", "SOL", "HYPE"].map((s) => (
          <button
            key={s}
            onClick={() => setActiveSymbol(s)}
            className={`px-4 py-2 rounded-full text-[11px] font-mono transition-all whitespace-nowrap ${
              activeSymbol === s ? "bg-primary text-primary-foreground " : "hairline bg-(--panel) text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}/USD
          </button>
        ))}
      </div>

      <motion.div
        ref={chartContainerRef}
        className="w-full rounded-md border border-(--hairline) overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
      >
        <svg viewBox="0 0 800 300" className="w-full h-80">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#CECCC1" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#CECCC1" stopOpacity="0" />
            </linearGradient>
          </defs>
          
          <path d={area} fill="url(#chartGradient)" />
          <path d={path} fill="none" stroke="#CECCC1" strokeWidth="2" />
          
          {/* Grid lines */}
          <line x1="0" y1="150" x2="800" y2="150" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <line x1="0" y1="75" x2="800" y2="75" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <line x1="0" y1="225" x2="800" y2="225" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        </svg>
      </motion.div>
    </div>
  );
}
