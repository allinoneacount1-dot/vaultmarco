import { Activity, Zap } from "lucide-react";
import { Panel } from "./Panel";

// Mock DexScreener data
const mockPairs = [
  {
    chain: "Solana",
    baseToken: "SOL",
    quoteToken: "USDC",
    price: 145.23,
    volume24h: "$2.1M",
    liquidity: "$500K",
    change24h: 5.2,
  },
  {
    chain: "Base",
    baseToken: "DEGEN",
    quoteToken: "ETH",
    price: 0.000123,
    volume24h: "$1.2M",
    liquidity: "$300K",
    change24h: -2.4,
  },
  {
    chain: "Ethereum",
    baseToken: "PEPE",
    quoteToken: "USDT",
    price: 0.00001345,
    volume24h: "$890K",
    liquidity: "$250K",
    change24h: 12.1,
  },
  {
    chain: "Solana",
    baseToken: "BONK",
    quoteToken: "SOL",
    price: 0.00000234,
    volume24h: "$560K",
    liquidity: "$150K",
    change24h: 8.5,
  },
];

export function DexRealtimeTab() {
  return (
    <Panel title="DEX REALTIME · DEXSCREENER" icon={Activity}>
      <div className="space-y-3">
        {mockPairs.map((pair, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-xl border border-white/10 p-3 hover:bg-white/5 transition-colors"
          >
            <div>
              <div className="flex items-center gap-2 text-[12px] font-mono text-foreground">
                <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                  {pair.chain}
                </span>
                {pair.baseToken}/{pair.quoteToken}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Vol: {pair.volume24h} • Liq: {pair.liquidity}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[12px] font-mono text-foreground">
                {pair.price < 0.001 ? pair.price.toFixed(8) : pair.price.toFixed(2)}
              </div>
              <div
                className={`text-[11px] font-mono mt-1 ${
                  pair.change24h > 0 ? "text-accent" : "text-red-400"
                }`}
              >
                {pair.change24h > 0 ? "+" : ""}
                {pair.change24h.toFixed(1)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
