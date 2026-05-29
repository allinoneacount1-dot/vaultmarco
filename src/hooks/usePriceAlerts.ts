import { useState, useEffect } from "react";
import { toast } from "sonner";
import { MarketCoin } from "./useMarketPrices";

export type PriceAlert = {
  id: string;
  coinId: string;
  coinSymbol: string;
  targetPrice: number;
  direction: "above" | "below";
  createdAt: number;
  triggered?: boolean;
};

const STORAGE_KEY = "marcovault-price-alerts";

export function usePriceAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  // Save to localStorage whenever alerts change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  }, [alerts]);

  const addAlert = (alert: Omit<PriceAlert, "id" | "createdAt">) => {
    const newAlert: PriceAlert = {
      ...alert,
      id: Date.now().toString(),
      createdAt: Date.now(),
    };
    setAlerts((prev) => [...prev, newAlert]);
    toast.success(`Alert set: ${alert.coinSymbol} ${alert.direction} $${alert.targetPrice}`);
  };

  const removeAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    toast.info("Alert removed");
  };

  const checkAlerts = (marketData: MarketCoin[]) => {
    alerts.forEach((alert) => {
      if (alert.triggered) return;

      const coin = marketData.find((c) => c.id === alert.coinId || c.sym === alert.coinSymbol);
      if (!coin) return;

      const price = coin.px;
      let triggered = false;

      if (alert.direction === "above" && price >= alert.targetPrice) {
        triggered = true;
      } else if (alert.direction === "below" && price <= alert.targetPrice) {
        triggered = true;
      }

      if (triggered) {
        // Mark as triggered
        setAlerts((prev) =>
          prev.map((a) => (a.id === alert.id ? { ...a, triggered: true } : a))
        );
        // Show toast
        toast(
          `🚨 ALERT: ${alert.coinSymbol} is now ${alert.direction} $${alert.targetPrice} (Current: $${formatPrice(price)})`,
          {
            duration: 10000,
            style: {
              background: "linear-gradient(135deg, #111827, #0f172a)",
              border: "1px solid #374151",
              color: "white",
            },
          }
        );
      }
    });
  };

  return { alerts, addAlert, removeAlert, checkAlerts };
}

function formatPrice(n: number) {
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 0.01) return n.toFixed(4);
  return n.toPrecision(3);
}
