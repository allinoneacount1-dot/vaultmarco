import { useQuery } from "@tanstack/react-query";

export type MarketCoin = {
  id: string;
  sym: string;
  name: string;
  px: number;
  ch: number; // 24h % change
  volume: number; // 24h volume
  mc: number; // market cap
  image?: string;
};

export type ChainHeatmapItem = {
  name: string;
  sym: string;
  heat: number; // 0-100
  ch: number;
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
  "arbitrum",
  "optimism",
  "polygon-ecosystem-token",
  "chainlink",
  "dogecoin",
  "shiba-inu",
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
  arbitrum: "ARB",
  optimism: "OP",
  "polygon-ecosystem-token": "POL",
  chainlink: "LINK",
  dogecoin: "DOGE",
  "shiba-inu": "SHIB",
};

const CHAINS = [
  "SOL",
  "ETH",
  "BASE",
  "HYPE",
  "BNB",
  "SUI",
  "TON",
  "AVAX",
  "ARB",
  "OP",
  "POL",
  "LINK",
];

async function fetchPrices(): Promise<MarketCoin[]> {
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COINS.join(
    ",",
  )}&price_change_percentage=24h&order=market_cap_desc`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = await res.json();
  return (
    data as Array<{
      id: string;
      symbol: string;
      name: string;
      current_price: number;
      price_change_percentage_24h?: number;
      total_volume?: number;
      market_cap?: number;
      image?: string;
    }>
  ).map((c) => ({
    id: c.id,
    sym: SYM_MAP[c.id] ?? c.symbol.toUpperCase(),
    name: c.name,
    px: c.current_price,
    ch: c.price_change_percentage_24h ?? 0,
    volume: c.total_volume ?? 0,
    mc: c.market_cap ?? 0,
    image: c.image,
  }));
}

export function useMarketPrices() {
  return useQuery({
    queryKey: ["market-prices"],
    queryFn: fetchPrices,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 2,
  });
}

export function useChainHeatmap(data?: MarketCoin[]): ChainHeatmapItem[] {
  return CHAINS.map((sym) => {
    const coin = data?.find((c) => c.sym === sym);
    const ch = coin?.ch ?? 0;
    const heat = Math.max(0, Math.min(100, Math.abs(ch) * 5));
    return {
      name: sym,
      sym,
      heat,
      ch,
    };
  });
}

export function useVolumeData(data?: MarketCoin[]) {
  const baseData = data?.slice(0, 8) ?? [];
  return baseData.map((c, i) => ({
    sym: c.sym,
    volume: c.volume,
    color: i % 2 === 0 ? "oklch(0.88 0.2 165)" : "oklch(0.85 0.18 200)",
  }));
}

export function useMarketAlerts(data?: MarketCoin[]) {
  const baseAlerts = [
    { sym: "HYPE", type: "BREAKOUT", status: "ok" as const },
    { sym: "BONK", type: "VOL SPIKE", status: "ok" as const },
    { sym: "PEPE", type: "DUMP RISK", status: "bad" as const },
    { sym: "SUI", type: "RECLAIM", status: "ok" as const },
  ];

  if (!data) return baseAlerts;

  return data.slice(0, 6).map((c) => {
    const ch = c.ch;
    let type = "UPDATE";
    let status: "ok" | "bad" = "ok";
    if (ch > 10) {
      type = "BREAKOUT";
      status = "ok";
    } else if (ch > 5) {
      type = "PUMP";
      status = "ok";
    } else if (ch < -10) {
      type = "CRASH";
      status = "bad";
    } else if (ch < -5) {
      type = "DUMP";
      status = "bad";
    } else {
      type = "UPDATE";
    }
    return { sym: c.sym, type, status };
  });
}

export function formatPrice(n: number) {
  if (n >= 1) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(3)}`;
}

export function formatVolume(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n}`;
}
