import { useMarketPrices, formatPrice, type FeedStatus } from "@/hooks/useMarketPrices";

/**
 * Truthful label for the ticker's existing status chip. "LIVE" is reserved for
 * data that came from a successful provider read; last-known-good data reads
 * "STALE" and an unavailable provider reads "OFFLINE".
 */
function statusLabel(status: FeedStatus): string {
  switch (status) {
    case "loading":
      return "SYNC";
    case "live":
    case "degraded":
      return "LIVE";
    case "stale":
      return "STALE";
    case "offline":
      return "OFFLINE";
  }
}

const PLACEHOLDER: Array<{ sym: string; px: number; ch: number | null }> = [
  { sym: "SOL", px: 0, ch: null },
  { sym: "ETH", px: 0, ch: null },
  { sym: "BTC", px: 0, ch: null },
];

export function LiveTicker() {
  const { data, providerStatus } = useMarketPrices();
  const coins = data ?? [];
  const rows: Array<{ sym: string; px: number; ch: number | null }> = coins.length
    ? coins
    : PLACEHOLDER;

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
              {statusLabel(providerStatus)}
            </span>
            {rows.map((c) => (
              <span key={c.sym + k} className="flex items-center gap-2.5">
                <span className="text-(--faint)">{c.sym}</span>
                {c.px > 0 && <span className="text-(--bone)">{formatPrice(c.px)}</span>}
                <span className={c.ch != null && c.ch < 0 ? "text-(--down)" : "text-(--up)"}>
                  {c.ch == null ? "—" : `${c.ch >= 0 ? "+" : ""}${c.ch.toFixed(2)}%`}
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
