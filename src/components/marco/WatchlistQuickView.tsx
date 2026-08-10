import { useState } from "react";
import { Star, X } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useMarketPrices, formatPrice } from "@/hooks/useMarketPrices";
import { Skeleton } from "./Skeleton";

export function WatchlistQuickView() {
  const { watchlist } = useWatchlist();
  const { data: prices, isLoading } = useMarketPrices();
  const [isOpen, setIsOpen] = useState(false);

  const getCoinPrice = (id: string) => {
    return prices?.find((p) => p.id === id);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center size-9 rounded-full hairline bg-(--panel) border border-(--hairline) hover:bg-(--panel-2) transition-all"
        aria-label="Quick Watchlist View"
      >
        <Star className="size-4 text-muted-foreground hover:text-foreground" />
        {watchlist.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-accent" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 hairline bg-(--panel) rounded-lg p-4 z-50 animate-fade-in">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-(--hairline)">
            <span className="text-[11px] font-mono tracking-wider text-(--gold)">WATCHLIST</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          {watchlist.length === 0 ? (
            <p className="text-muted-foreground text-center py-4 text-[12px]">
              No items in watchlist.
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {watchlist.map((item) => {
                const coinData = getCoinPrice(item.id);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-(--panel-2) transition-colors"
                  >
                    <div>
                      <span className="text-[12px] font-bold text-foreground">{item.sym}</span>
                      <span className="text-[11px] text-muted-foreground block">{item.name}</span>
                    </div>
                    {isLoading || !coinData ? (
                      <Skeleton className="h-4 w-20" />
                    ) : (
                      <div className="text-right">
                        <div className="text-[12px] font-mono text-foreground">
                          {formatPrice(coinData.px)}
                        </div>
                        <div
                          className={`text-[11px] font-mono ${coinData.ch >= 0 ? "text-(--up)" : "text-(--down)"}`}
                        >
                          {coinData.ch >= 0 ? "+" : ""}
                          {coinData.ch.toFixed(2)}%
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
