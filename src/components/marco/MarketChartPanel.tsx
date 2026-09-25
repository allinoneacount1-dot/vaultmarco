import { useState } from "react";
import { CandlestickChart } from "lucide-react";
import { Panel } from "./Panel";
import { TradingViewChart } from "./TradingViewChart";

/** Binance USDT spot pairs — the most liquid feeds TradingView serves for free. */
const ASSETS = [
  { id: "BTC", symbol: "BINANCE:BTCUSDT" },
  { id: "ETH", symbol: "BINANCE:ETHUSDT" },
  { id: "SOL", symbol: "BINANCE:SOLUSDT" },
  { id: "BNB", symbol: "BINANCE:BNBUSDT" },
] as const;

type AssetId = (typeof ASSETS)[number]["id"];

/**
 * Live TradingView chart with a BTC / ETH / SOL / BNB switch, using the same
 * pill selector as DEX REALTIME.
 *
 * Each chart is a full TradingView iframe, so they mount lazily on first
 * selection and are then kept mounted but hidden (`invisible`, not
 * `display:none`, so the iframe keeps its size and TradingView needs no
 * re-layout). Switching is therefore instant and never reloads the page or
 * the other charts.
 */
export function MarketChartPanel() {
  const [asset, setAsset] = useState<AssetId>("BTC");
  const [mounted, setMounted] = useState<ReadonlySet<AssetId>>(() => new Set(["BTC"]));

  const select = (id: AssetId) => {
    setAsset(id);
    setMounted((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  };

  return (
    <Panel title={`MARKET CHART · ${asset}/USDT`} icon={CandlestickChart}>
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Select asset">
          {ASSETS.map((a) => (
            <button
              key={a.id}
              onClick={() => select(a.id)}
              aria-pressed={asset === a.id}
              className={`px-4 py-2 rounded-full text-[11px] font-mono transition-all ${
                asset === a.id
                  ? "chrome-fill"
                  : "hairline text-muted-foreground hover:text-foreground"
              }`}
            >
              {a.id}
            </button>
          ))}
        </div>

        <div className="relative h-[320px] sm:h-[400px] lg:h-[480px] overflow-hidden rounded-md border border-(--hairline)">
          {ASSETS.filter((a) => mounted.has(a.id)).map((a) => (
            <div
              key={a.id}
              aria-hidden={asset !== a.id}
              className={`absolute inset-0 ${asset === a.id ? "visible" : "invisible pointer-events-none"}`}
            >
              <TradingViewChart symbol={a.symbol} className="h-full" />
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
