import { useEffect, useRef } from "react";
import { createChart, IChartApi, ISeriesApi } from "lightweight-charts";

type CandlestickData = {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export function PriceChart({ symbol = "BTC" }: { symbol?: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Generate mock candlestick data for now
  const generateMockData = (count: number): CandlestickData[] => {
    const data: CandlestickData[] = [];
    let basePrice = symbol === "BTC" ? 68000 : 3500;
    const now = Math.floor(Date.now() / 1000);

    for (let i = count - 1; i >= 0; i--) {
      const time = now - i * 3600; // 1 hour candles
      const volatility = 0.02;
      const change = (Math.random() - 0.5) * 2 * volatility * basePrice;
      const open = basePrice;
      const close = basePrice + change;
      const high = Math.max(open, close) + Math.random() * volatility * basePrice;
      const low = Math.min(open, close) - Math.random() * volatility * basePrice;

      data.push({
        time,
        open,
        high,
        low,
        close,
      });

      basePrice = close;
    }
    return data;
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Initialize chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 300,
      layout: {
        background: { type: "solid", color: "transparent" },
        textColor: "#9CA3AF",
      },
      grid: {
        vertLines: { color: "#2D3748" },
        horzLines: { color: "#2D3748" },
      },
      timeScale: {
        borderColor: "#374151",
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#22C55E",
      downColor: "#EF4444",
      borderUpColor: "#22C55E",
      borderDownColor: "#EF4444",
      wickUpColor: "#22C55E",
      wickDownColor: "#EF4444",
    });

    candlestickSeries.setData(generateMockData(100));

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [symbol]);

  return (
    <div className="w-full rounded-xl border border-white/10 overflow-hidden">
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}
