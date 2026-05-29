import { motion } from "framer-motion";
import { Star, X } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useMarketPrices, formatPrice } from "@/hooks/useMarketPrices";
import { Skeleton } from "./Skeleton";

export function Watchlist() {
  const { watchlist, removeFromWatchlist } = useWatchlist();
  const { data: prices, isLoading } = useMarketPrices();

  const getCoinPrice = (id: string) => {
    return prices?.find((p) => p.id === id);
  };

  return (
    <section id="watchlist" className="relative py-24 sm:py-32">
      <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="inline-flex items-center gap-2 text-[10px] font-mono tracking-[0.35em] text-primary mb-4">
            <span className="size-1 rounded-full bg-primary animate-pulse-glow" />
            08 / WATCHLIST
          </div>
          <h2 className="text-chrome font-display text-3xl sm:text-5xl font-semibold">
            Your Watchlist
          </h2>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg max-w-2xl">
            Save your favorite coins and track their prices in real-time (data saved in your
            browser).
          </p>
        </motion.div>

        <motion.div
          className="mt-10 glass-strong border-glow rounded-2xl p-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {watchlist.length === 0 ? (
            <div className="text-center py-10">
              <Star className="size-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Your watchlist is empty. Add coins from the Live Market Panel!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {watchlist.map((item, index) => {
                const coinData = getCoinPrice(item.id);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-xl"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-foreground font-bold">{item.sym}</span>
                      <span className="text-muted-foreground text-sm">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {isLoading || !coinData ? (
                        <Skeleton className="h-4 w-24" />
                      ) : (
                        <div className="text-right">
                          <div className="text-foreground font-mono">
                            {formatPrice(coinData.px)}
                          </div>
                          <div
                            className={`text-xs font-mono ${coinData.ch >= 0 ? "text-accent" : "text-red-400"}`}
                          >
                            {coinData.ch >= 0 ? "+" : ""}
                            {coinData.ch.toFixed(2)}%
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => removeFromWatchlist(item.id)}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        aria-label={`Remove ${item.sym} from watchlist`}
                      >
                        <X className="size-4 text-muted-foreground" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
