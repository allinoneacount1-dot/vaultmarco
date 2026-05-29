import { useMarketPrices, formatPrice } from "@/hooks/useMarketPrices";

export function LiveTicker() {
  const { data, isLoading, isError } = useMarketPrices();
  const coins = data ?? [];

  return (
    <div
      className="mt-10 glass rounded-xl overflow-hidden"
      role="marquee"
      aria-label="Live market prices from CoinGecko"
    >
      <div className="flex whitespace-nowrap animate-ticker font-mono text-[11px] py-2.5">
        {Array.from({ length: 2 }).map((_, k) => (
          <div key={k} className="flex items-center gap-8 px-4">
            <span className="text-[9px] tracking-[0.3em] text-primary/70 uppercase">
              {isError ? "Offline" : isLoading ? "Sync" : "Live"}
            </span>
            {(coins.length
              ? coins
              : [
                  { sym: "SOL", px: 0, ch: 0 },
                  { sym: "ETH", px: 0, ch: 0 },
                  { sym: "BTC", px: 0, ch: 0 },
                ]
            ).map((c) => (
              <span key={c.sym + k} className="flex items-center gap-2">
                <span className="text-muted-foreground">{c.sym}</span>
                {c.px > 0 && <span className="text-foreground/70">{formatPrice(c.px)}</span>}
                <span className={c.ch < 0 ? "text-red-400" : "text-accent"}>
                  {c.ch >= 0 ? "+" : ""}{c.ch.toFixed(2)}%
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
