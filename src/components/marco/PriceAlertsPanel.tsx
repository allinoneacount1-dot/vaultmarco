import { useState } from "react";
import { Zap, X } from "lucide-react";
import { motion } from "framer-motion";
import { MarketCoin } from "@/hooks/useMarketPrices";
import { usePriceAlerts, PriceAlert } from "@/hooks/usePriceAlerts";
import { Panel } from "./Panel";

type PriceAlertsPanelProps = {
  marketData?: MarketCoin[];
};

export function PriceAlertsPanel({ marketData }: PriceAlertsPanelProps) {
  const { alerts, addAlert, removeAlert } = usePriceAlerts();
  const [showForm, setShowForm] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoin || !targetPrice) return;

    const coin = marketData?.find((c) => c.sym === selectedCoin || c.id === selectedCoin);
    if (!coin) return;

    addAlert({
      coinId: coin.id,
      coinSymbol: coin.sym,
      targetPrice: parseFloat(targetPrice),
      direction,
    });

    // Reset form
    setShowForm(false);
    setSelectedCoin("");
    setTargetPrice("");
  };

  return (
    <Panel title="PRICE ALERTS · LIVE" icon={Zap}>
      <div className="space-y-3">
        {/* Toggle Form Button */}
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full text-left text-[10px] font-mono tracking-[0.2em] text-primary hover:text-accent transition-colors uppercase"
        >
          {showForm ? "Cancel" : "+ Set New Alert"}
        </button>

        {/* Add Alert Form */}
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="space-y-2 pt-2 border-t border-white/5"
          >
            <select
              value={selectedCoin}
              onChange={(e) => setSelectedCoin(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-[11px] font-mono text-foreground outline-none focus:border-primary"
            >
              <option value="">Select Coin</option>
              {(marketData ?? []).map((c) => (
                <option key={c.id} value={c.sym}>
                  {c.sym}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as "above" | "below")}
                className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-[11px] font-mono text-foreground outline-none focus:border-primary"
              >
                <option value="above">Above</option>
                <option value="below">Below</option>
              </select>

              <input
                type="number"
                step="0.0001"
                placeholder="Target Price"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-[11px] font-mono text-foreground outline-none focus:border-primary"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-primary text-primary-foreground text-[10px] font-mono tracking-[0.2em] py-1.5 rounded-md uppercase hover:bg-accent transition-colors"
            >
              Create Alert
            </button>
          </motion.form>
        )}

        {/* Alert List */}
        <div className="space-y-1">
          {alerts.length === 0 ? (
            <div className="text-[11px] font-mono text-muted-foreground">
              No alerts set. Create one above!
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between text-[11px] font-mono"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`${
                      alert.triggered ? "text-muted-foreground line-through" : "text-foreground"
                    }`}
                  >
                    {alert.coinSymbol}
                  </span>
                  <span className="text-muted-foreground">
                    {alert.direction} ${alert.targetPrice}
                  </span>
                  {alert.triggered && (
                    <span className="text-xs text-accent uppercase tracking-wider">Triggered</span>
                  )}
                </div>
                <button
                  onClick={() => removeAlert(alert.id)}
                  className="text-muted-foreground hover:text-red-400 transition-colors"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </Panel>
  );
}
