import { useState, useEffect, useRef } from "react";
import { Bell, X, Volume2, VolumeX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

type WhaleAlert = {
  id: number;
  chain: string;
  token: string;
  amount: string;
  type: "BUY" | "SELL";
  time: string;
};

export function WhaleAlertIcon() {
  const [isOpen, setIsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const lastIdsRef = useRef<number[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["whaleAlerts"],
    queryFn: async () => {
      const res = await fetch("/api/whale/alerts");
      return res.json() as WhaleAlert[];
    },
    refetchInterval: 20000, // 20 seconds
    onSuccess: (newData) => {
      const currentIds = newData.map((a) => a.id);
      const newAlerts = newData.filter((a) => !lastIdsRef.current.includes(a.id));

      if (soundEnabled && newAlerts.length > 0) {
        toast.success("New whale alert!");
      }

      lastIdsRef.current = currentIds;
    },
  });

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="size-9 rounded-full glass border border-white/10 hover:bg-white/5 transition-all flex items-center justify-center"
          aria-label={soundEnabled ? "Mute whale alerts" : "Unmute whale alerts"}
        >
          {soundEnabled ? (
            <Volume2 className="size-4 text-muted-foreground hover:text-foreground" />
          ) : (
            <VolumeX className="size-4 text-muted-foreground hover:text-foreground" />
          )}
        </button>
        <button
          onClick={() => {
            setIsOpen(!isOpen);
          }}
          className="relative flex items-center justify-center size-9 rounded-full glass border border-white/10 hover:bg-white/5 transition-all"
          aria-label="Whale Alerts"
        >
          <Bell className="size-4 text-muted-foreground hover:text-foreground" />
          {data && data.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-accent animate-pulse-glow" />
          )}
        </button>
      </div>

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
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-2 rounded-xl bg-white/5">
                    <div className="h-3 w-16 bg-white/10 rounded animate-pulse mb-1" />
                    <div className="h-3 w-32 bg-white/5 rounded animate-pulse" />
                  </div>
                ))
              : data?.map((alert: WhaleAlert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <div
                      className={`px-2 py-1 rounded-full text-[9px] font-mono ${
                        alert.type === "BUY"
                          ? "bg-accent/20 text-accent"
                          : "bg-red-500/20 text-red-400"
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
