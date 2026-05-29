import { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { motion } from "framer-motion";

type CandlestickData = {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
};

// Generate realistic mock candlestick data
const generateMockData = (count: number, symbol: string): CandlestickData[] => {
  const data: CandlestickData[] = [];
  let basePrice = symbol === "BTC" ? 69000 : 3600;
  const now = Math.floor(Date.now() / 1000);

  for (let i = count - 1; i >= 0; i--) {
    const time = now - i * 3600; // 1 hour candles
    const volatility = symbol === "BTC" ? 0.005 : 0.01;
    const change = (Math.random() - 0.5) * 2 * volatility * basePrice;
    const open = basePrice;
    const close = basePrice + change;
    const high = Math.max(open, close) + Math.random() * volatility * basePrice;
    const low = Math.min(open, close) - Math.random() * volatility * basePrice;

    data.push({
      time,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
    });

    basePrice = close;
  }
  return data;
};

export function PriceChart({ symbol = "BTC" }: { symbol?: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any | null>(null);
  const seriesRef = useRef<any>(null);
  const [activeSymbol, setActiveSymbol] = useState(symbol);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Initialize chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { type: "solid", color: "transparent" },
        textColor: "#9CA3AF",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.05)" },
        horzLines: { color: "rgba(255,255,255,0.05)" },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
      },
    });

    // Create candlestick series
    const candlestickSeries = chart.addSeries({
      type: "Candlestick",
      upColor: "#22C55E",
      downColor: "#EF4444",
      borderUpColor: "#22C55E",
      borderDownColor: "#EF4444",
      wickUpColor: "#22C55E",
      wickDownColor: "#EF4444",
    });

    candlestickSeries.data = generateMockData(100, activeSymbol);

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chart) chart.remove();
    };
  }, [activeSymbol]);

  // Update data when symbol changes
  useEffect(() => {
    if (seriesRef.current) {
      seriesRef.current.data = generateMockData(100, activeSymbol);
    }
  }, [activeSymbol]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {["BTC", "ETH", "SOL", "HYPE"].map((s) => (
          <button
            key={s}
            onClick={() => setActiveSymbol(s)}
            className={`px-4 py-2 rounded-full text-[11px] font-mono transition-all ${
              activeSymbol === s ? "bg-primary text-primary-foreground glow-cyan" : "glass text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}/USD
          </button>
        ))}
      </div>

      <motion.div
        ref={chartContainerRef}
        className="w-full rounded-xl border border-white/10 overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
      />
    </div>
  );
}
