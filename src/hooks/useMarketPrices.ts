import { useQuery } from "@tanstack/react-query";

export type MarketCoin = {
  id: string;
  sym: string;
  name: string;
  px: number;
  ch: number; // 24h % change
  image?: string;
};

const COINS = [
  "bitcoin",
  "ethereum",
  "solana",
  "hyperliquid",
  "bonk",
  "pepe",
  "sui",
  "toncoin",
  "binancecoin",
  "avalanche-2",
];

const SYM_MAP: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
  hyperliquid: "HYPE",
  bonk: "BONK",
  pepe: "PEPE",
  sui: "SUI",
  toncoin: "TON",
  binancecoin: "BNB",
  "avalanche-2": "AVAX",
};

async function fetchPrices(): Promise<MarketCoin[]> {
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COINS.join(
    ",",
  )}&price_change_percentage=24h`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = await res.json();
  return (data as any[]).map((c) => ({
    id: c.id,
    sym: SYM_MAP[c.id] ?? c.symbol.toUpperCase(),
    name: c.name,
    px: c.current_price,
    ch: c.price_change_percentage_24h ?? 0,
    image: c.image,
  }));
}

export function useMarketPrices() {
  return useQuery({
    queryKey: ["market-prices"],
    queryFn: fetchPrices,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });
}

export function formatPrice(n: number) {
  if (n >= 1) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(3)}`;
}
