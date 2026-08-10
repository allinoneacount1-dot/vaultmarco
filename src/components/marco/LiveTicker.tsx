import { useMarketPrices, formatPrice } from "@/hooks/useMarketPrices";

export function LiveTicker() {
  const { data, isLoading, isError } = useMarketPrices();
  const coins = data ?? [];

  return (
    <div
      className="hairline-t relative z-[20] overflow-hidden bg-(--void)"
      role="marquee"
      aria-label="Live market prices"
    >
      <div className="animate-ticker mono-data flex whitespace-nowrap py-3.5 text-[11px]">
        {Array.from({ length: 2 }).map((_, k) => (
          <div key={k} className="flex items-center gap-10 px-5">
            <span className="flex items-center gap-2 text-[9px] tracking-[0.3em] text-(--gold)">
              <span className="inline-block size-1 rounded-full bg-(--gold)" />
              {isError ? "OFFLINE" : isLoading ? "SYNC" : "LIVE"}
            </span>
            {(coins.length
              ? coins
              : [
                  { sym: "SOL", px: 0, ch: 0 },
                  { sym: "ETH", px: 0, ch: 0 },
                  { sym: "BTC", px: 0, ch: 0 },
                ]
            ).map((c) => (
              <span key={c.sym + k} className="flex items-center gap-2.5">
                <span className="text-(--faint)">{c.sym}</span>
                {c.px > 0 && <span className="text-(--bone)">{formatPrice(c.px)}</span>}
                <span className={c.ch < 0 ? "text-(--down)" : "text-(--up)"}>
                  {c.ch >= 0 ? "+" : ""}
                  {c.ch.toFixed(2)}%
                </span>
              </span>
            ))}
            <span className="text-[9px] tracking-[0.3em] text-(--faint)">MARCOVAULT</span>
          </div>
        ))}
      </div>
    </div>
  );
}
