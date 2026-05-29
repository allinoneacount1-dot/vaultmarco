import { useState } from "react";
import { Bell, X } from "lucide-react";

// Mock whale alerts data
const mockWhaleAlerts = [
  { id: 1, chain: "Solana", token: "SOL", amount: "$125,000", type: "BUY", time: "2m ago" },
  { id: 2, chain: "Base", token: "DEGEN", amount: "$89,500", type: "SELL", time: "5m ago" },
  { id: 3, chain: "Ethereum", token: "PEPE", amount: "$242,000", type: "BUY", time: "12m ago" },
];

export function WhaleAlertIcon() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewAlert, setHasNewAlert] = useState(true);

  return (
    <div className="relative">
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setHasNewAlert(false);
        }}
        className="relative flex items-center justify-center size-9 rounded-full glass border border-white/10 hover:bg-white/5 transition-all"
        aria-label="Whale Alerts"
      >
        <Bell className="size-4 text-muted-foreground hover:text-foreground" />
        {hasNewAlert && (
          <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-accent animate-pulse-glow" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 glass-strong border-glow rounded-2xl p-4 z-50 animate-fade-in">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
            <span className="text-[11px] font-mono tracking-wider text-primary">WHALE ALERTS</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {mockWhaleAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors"
              >
                <div
                  className={`px-2 py-1 rounded-full text-[9px] font-mono ${
                    alert.type === "BUY" ? "bg-accent/20 text-accent" : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {alert.type}
                </div>
                <div className="flex-1">
                  <div className="text-[11px] text-foreground">
                    {alert.amount} {alert.token}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {alert.chain} • {alert.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
