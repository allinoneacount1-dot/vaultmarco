import { type DataEnvelope, liveEnvelope } from "./envelope";
import { fetchJson } from "./http";
import { CoinGeckoMarketSchema, parseItems } from "./schemas";

export const COINGECKO_SOURCE = "coingecko";
const API_BASE = "https://api.coingecko.com/api/v3";

export type MarketCoin = {
  id: string;
  sym: string;
  name: string;
  px: number;
  /** 24h % change. */
  ch: number;
  /** 24h volume. */
  volume: number;
  /** Market cap. */
  mc: number;
  image?: string;
};

export type Deps = { fetchJson: typeof fetchJson; now: () => number };
const defaultDeps: Deps = { fetchJson, now: () => Date.now() };

export const COINS = [
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

/**
 * Read live market prices.
 *
 * Throws a `ProviderError` on any failure. It never returns a substitute
 * payload — the caller (react-query) keeps the last real successful response
 * and marks it `stale`, which is the only permitted degraded behaviour.
 */
export async function fetchMarketPrices(
  deps: Deps = defaultDeps,
): Promise<DataEnvelope<MarketCoin[]>> {
  const url =
    `${API_BASE}/coins/markets?vs_currency=usd&ids=${COINS.join(",")}` +
    `&price_change_percentage=24h&order=market_cap_desc`;

  const raw = await deps.fetchJson(COINGECKO_SOURCE, url);
  const { items, dropped } = parseItems(COINGECKO_SOURCE, raw, CoinGeckoMarketSchema);

  const data: MarketCoin[] = items.map((c) => ({
    id: c.id,
    sym: SYM_MAP[c.id] ?? c.symbol.toUpperCase(),
    name: c.name,
    px: c.current_price,
    ch: c.price_change_percentage_24h ?? 0,
    volume: c.total_volume ?? 0,
    mc: c.market_cap ?? 0,
    image: c.image,
  }));

  return liveEnvelope(COINGECKO_SOURCE, data, deps.now(), dropped);
}
