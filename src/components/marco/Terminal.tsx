import { useEffect, useState } from "react";
import { Activity, TrendingUp, Zap } from "lucide-react";
import { useMarketPrices, formatPrice, MarketCoin } from "@/hooks/useMarketPrices";
import { useCryptoNews, formatNewsForFeed } from "@/hooks/useCryptoNews";

export function Terminal() {
  const [tick, setTick] = useState(0);
  const { data: coins, isLoading } = useMarketPrices();
  const { data: news, isLoading: isNewsLoading } = useCryptoNews();

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1500);
    return () => clearInterval(id);
  }, []);

  const sol = coins?.find((c) => c.sym === "SOL");
  const top4 = coins?.filter((c) => ["SOL", "ETH", "HYPE", "BTC"].includes(c.sym)) ?? [];
  const feed = news
    ? formatNewsForFeed(news)
    : [
        "[ALPHA] Whale moved 1.2M USDC into SOL/HYPE pool",
        "[SCAN] New liquidity pool detected on Base · $48k locked",
        "[SIG]  AI model flagged narrative shift: AI-agents +18%",
        "[EXEC] Sniper armed · slippage 1.2% · MEV protected",
      ];

  return (
    <div className="relative glass-strong border-glow rounded-2xl p-4 sm:p-5 overflow-hidden scanline">
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-red-500/80" />
          <span className="size-2.5 rounded-full bg-yellow-500/80" />
          <span className="size-2.5 rounded-full bg-green-500/80" />
          <span className="ml-3 text-[10px] tracking-[0.3em] text-muted-foreground font-mono">
            VAULT://TERMINAL.LIVE
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-accent">
          <span className="size-1.5 rounded-full bg-accent animate-pulse-glow" />
          {isLoading || isNewsLoading ? "SYNC" : "LIVE"}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3 pt-4">
        <div className="col-span-3 glass rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">
                SOL/USDC {sol && `· ${formatPrice(sol.px)}`}
              </span>
              {sol && (
                <span
                  className={`text-xs font-mono ${sol.ch >= 0 ? "text-accent" : "text-red-400"}`}
                >
                  {sol.ch >= 0 ? "+" : ""}
                  {sol.ch.toFixed(2)}%
                </span>
              )}
            </div>
            <Activity className="size-3 text-primary" />
          </div>
          <MiniChart tick={tick} bias={sol?.ch ?? 0} />
        </div>

        <div className="col-span-2 glass rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] tracking-[0.25em] text-muted-foreground font-mono">
              LIVE · 24H
            </span>
            <Zap className="size-3 text-primary" />
          </div>
          <div className="space-y-1.5">
            {(top4.length ? top4 : Array.from({ length: 4 })).map(
              (t: MarketCoin | undefined, i) => (
                <div
                  key={t?.sym ?? i}
                  className="flex items-center justify-between text-[11px] font-mono"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground">{t?.sym ?? "···"}</span>
                  </div>
                  <span className={t?.ch >= 0 ? "text-accent" : "text-red-400"}>
                    {t ? `${t.ch >= 0 ? "+" : ""}${t.ch.toFixed(2)}%` : "—"}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="col-span-5 glass rounded-xl p-3 h-28 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] tracking-[0.25em] text-muted-foreground font-mono">
              LIVE NEWS
            </span>
            <TrendingUp className="size-3 text-violet-300" />
          </div>
          <div className="font-mono text-[11px] space-y-1">
            {feed.map((line, i) => (
              <div key={i} className="text-muted-foreground">
                <span className="text-primary mr-1">›</span>
                {line}
                {i === 0 && <span className="animate-blink text-primary">_</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
    </div>
  );
}

function MiniChart({ tick, bias }: { tick: number; bias: number }) {
  // Simple seeded random for consistent output between server and client
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  const trend = bias / 100;
  const candles = Array.from({ length: 28 }, (_, i) => {
    const seed = (i + tick * 0.3) * 0.7;
    const drift = trend * i * 0.6;
    const o = 50 + Math.sin(seed) * 18 + drift;
    const c = 50 + Math.sin(seed + 0.8) * 20 + drift;
    const h = Math.max(o, c) + 4 + seededRandom(seed + 100) * 2;
    const l = Math.min(o, c) - 4 - seededRandom(seed + 200) * 2;
    return { o, c, h, l };
  });
  return (
    <svg viewBox="0 0 280 100" className="w-full h-28">
      <defs>
        <linearGradient id="up" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.88 0.2 165)" />
          <stop offset="100%" stopColor="oklch(0.7 0.18 165)" />
        </linearGradient>
        <linearGradient id="dn" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.7 0.22 25)" />
          <stop offset="100%" stopColor="oklch(0.55 0.22 25)" />
        </linearGradient>
      </defs>
      {[20, 40, 60, 80].map((y) => (
        <line key={y} x1="0" x2="280" y1={y} y2={y} stroke="rgba(255,255,255,0.04)" />
      ))}
      {candles.map((c, i) => {
        const x = i * 10 + 2;
        const up = c.c >= c.o;
        return (
          <g key={i}>
            <line
              x1={x + 3}
              x2={x + 3}
              y1={c.h}
              y2={c.l}
              stroke={up ? "oklch(0.88 0.2 165 / 0.6)" : "oklch(0.7 0.22 25 / 0.6)"}
              strokeWidth="1"
            />
            <rect
              x={x}
              y={Math.min(c.o, c.c)}
              width="6"
              height={Math.max(2, Math.abs(c.c - c.o))}
              fill={up ? "url(#up)" : "url(#dn)"}
            />
          </g>
        );
      })}
    </svg>
  );
}
