import { useState } from "react";
import { CandlestickChart } from "lucide-react";
import { Panel } from "./Panel";
import { TradingViewChart } from "./TradingViewChart";
import { Segmented } from "./desk";

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
 * Single active widget: exactly one TradingView embed instance exists at any
 * time. Switching assets unmounts the current chart (its cleanup removes the
 * script and iframe) and mounts a fresh one for the new symbol, so there is
 * never more than one iframe, websocket or render loop alive — important on
 * mobile. The chart box keeps a fixed height, so a switch causes no layout
 * shift; the existing skeleton covers the load.
 */
export function MarketChartPanel() {
  const [asset, setAsset] = useState<AssetId>("BTC");
  const active = ASSETS.find((a) => a.id === asset) ?? ASSETS[0];

  return (
    <Panel
      title={`MARKET CHART · ${asset}/USDT`}
      icon={CandlestickChart}
      aside={<Segmented label="Select asset" options={ASSETS} value={asset} onChange={setAsset} />}
    >
      {/* Fixed height: a switch never shifts the page; TradingView stays dominant. */}
      <div className="h-[320px] overflow-hidden rounded-sm border border-(--hairline) sm:h-[400px] lg:h-[480px]">
        {/* `key` forces a clean remount per symbol. */}
        <TradingViewChart key={active.id} symbol={active.symbol} className="h-full" />
      </div>
    </Panel>
  );
}
