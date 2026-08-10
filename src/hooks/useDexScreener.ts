import { useQuery } from "@tanstack/react-query";
import { FALLBACK_BOOSTS, FALLBACK_ADS } from "@/components/marco/shared/mockData";
import type { BoostToken, AdToken, BoostTier } from "@/components/marco/shared/types";

// ------------------------------
// Type Definitions
// ------------------------------

// Token Boost Response Type (re-export for backward compatibility)
export type TokenBoost = BoostToken;

// Token Profile Update Type
export type TokenProfileUpdate = {
  id?: string;
  tokenAddress: string;
  chain: string;
  symbol: string;
  name: string;
  updateType: string;
  timestamp: number;
  icon?: string;
};

// Order Type
export type Order = {
  id?: string;
  pairAddress: string;
  side: "buy" | "sell";
  price: number;
  amount: number;
  total: number;
  timestamp: number;
};

// Pair Type
export type Pair = {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd: string;
  txns: { h24: { buys: number; sells: number } };
  volume: { h24: number };
  priceChange: { h24: number };
  liquidity: { usd: number; base: number; quote: number };
  fdv: number;
  marketCap: number;
  pairCreatedAt: number;
  info?: { imageUrl?: string };
};

// Token Type
export type Token = {
  chainId: string;
  address: string;
  name: string;
  symbol: string;
  icon?: string;
  priceUsd?: number;
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
};

// Meta Type
export type Meta = {
  slug: string;
  title: string;
  description: string;
  image: string;
};

// DexScreener API Response Types
interface DexScreenerToken {
  symbol?: string;
  name?: string;
  chainId?: string;
  address?: string;
  image?: string;
  logo?: string;
  priceUsd?: number;
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
}

interface DexScreenerBoost {
  token?: DexScreenerToken;
  dex?: string;
  amount?: number;
  tier?: BoostTier;
}

interface DexScreenerAd {
  token?: DexScreenerToken;
  type?: string;
  timestamp?: number;
}

interface DexScreenerPair {
  baseToken?: { symbol?: string; name?: string; address?: string };
  chainId?: string;
  dexId?: string;
  priceUsd?: number;
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  info?: { imageUrl?: string };
}

interface DexScreenerBoostResponse {
  boosts?: DexScreenerBoost[];
}

interface DexScreenerAdsResponse {
  ads?: DexScreenerAd[];
}

interface DexScreenerTakeoversResponse {
  takeovers?: DexScreenerAd[];
}

interface DexScreenerTrendingResponse {
  pairs?: DexScreenerPair[];
}

// ------------------------------
// API Helpers
// ------------------------------

// Direct public API (CORS-enabled). The old "/api/dex" proxy never existed in the
// static Vercel deploy, so every feed silently fell back to mocks in production.
const API_BASE = "https://api.dexscreener.com";

// Map from DexScreener chain IDs to our internal chain names
const CHAIN_ID_MAP: Record<string, string> = {
  "solana": "sol",
  "ethereum": "eth",
  "base": "base",
  "binance-smart-chain": "bnb",
  "bsc": "bnb",
};

// Convert to standard chain name
function normalizeChain(chain: string): string {
  return CHAIN_ID_MAP[chain.toLowerCase()] || chain.toLowerCase();
}

// ------------------------------
// Fetch Functions
// ------------------------------

// Token Boosts
async function fetchTokenBoosts(): Promise<TokenBoost[]> {
  try {
    const res = await fetch(`${API_BASE}/token-boosts/latest/v1`);
    if (!res.ok) throw new Error(`Token Boosts ${res.status}`);
    const data: DexScreenerBoostResponse = await res.json();
    
    return (data.boosts || []).map((item, index) => ({
      id: `boost-${index}`,
      symbol: item.token?.symbol || "UNKNOWN",
      name: item.token?.name || "Unknown Token",
      chain: normalizeChain(item.token?.chainId || "eth"),
      dex: item.dex || "Unknown",
      price: item.token?.priceUsd || 0,
      change24h: item.token?.priceChange?.h24 || 0,
      volume24h: item.token?.volume?.h24 || 0,
      boostAmount: item.amount || 0,
      boostTier: item.tier || "Low Boost",
      tokenAddress: item.token?.address || "",
      icon: item.token?.image || item.token?.logo || `https://dd.dexscreener.com/ds-data/tokens/${item.token?.chainId || "eth"}/${item.token?.address || ""}.png`,
    }));
  } catch (err) {
    console.warn("DexScreener Token Boosts API failed, using fallback:", err);
    return FALLBACK_BOOSTS;
  }
}

async function fetchTopTokenBoosts(): Promise<TokenBoost[]> {
  try {
    const res = await fetch(`${API_BASE}/token-boosts/top/v1`);
    if (!res.ok) throw new Error(`Top Token Boosts ${res.status}`);
    const data: DexScreenerBoostResponse = await res.json();
    
    return (data.boosts || []).map((item, index) => ({
      id: `top-boost-${index}`,
      symbol: item.token?.symbol || "UNKNOWN",
      name: item.token?.name || "Unknown Token",
      chain: normalizeChain(item.token?.chainId || "eth"),
      dex: item.dex || "Unknown",
      price: item.token?.priceUsd || 0,
      change24h: item.token?.priceChange?.h24 || 0,
      volume24h: item.token?.volume?.h24 || 0,
      boostAmount: item.amount || 0,
      boostTier: item.tier || "Low Boost",
      tokenAddress: item.token?.address || "",
      icon: item.token?.image || item.token?.logo || `https://dd.dexscreener.com/ds-data/tokens/${item.token?.chainId || "eth"}/${item.token?.address || ""}.png`,
    }));
  } catch (err) {
    console.warn("DexScreener Top Token Boosts API failed, using fallback:", err);
    return FALLBACK_BOOSTS;
  }
}

// Ads & Takeovers
async function fetchAds(): Promise<AdToken[]> {
  try {
    const res = await fetch(`${API_BASE}/ads/latest/v1`);
    if (!res.ok) throw new Error(`Ads ${res.status}`);
    const data: DexScreenerAdsResponse = await res.json();
    
    return (data.ads || []).map((item, index) => ({
      id: `ad-${index}`,
      type: item.type || "AD",
      symbol: item.token?.symbol || "UNKNOWN",
      name: item.token?.name || "Unknown Token",
      price: item.token?.priceUsd || 0,
      change24h: item.token?.priceChange?.h24 || 0,
      volume: item.token?.volume?.h24 || 0,
      liquidity: item.token?.liquidity?.usd || 0,
      timestamp: item.timestamp || Date.now(),
      chain: normalizeChain(item.token?.chainId || "eth"),
      tokenAddress: item.token?.address || "",
      icon: item.token?.image || item.token?.logo || `https://dd.dexscreener.com/ds-data/tokens/${item.token?.chainId || "eth"}/${item.token?.address || ""}.png`,
    }));
  } catch (err) {
    console.warn("DexScreener Ads API failed, using fallback:", err);
    return FALLBACK_ADS;
  }
}

async function fetchCommunityTakeovers(): Promise<AdToken[]> {
  try {
    const res = await fetch(`${API_BASE}/community-takeovers/latest/v1`);
    if (!res.ok) throw new Error(`Community Takeovers ${res.status}`);
    const data: DexScreenerTakeoversResponse = await res.json();
    
    return (data.takeovers || []).map((item, index) => ({
      id: `takeover-${index}`,
      type: "Takeover",
      symbol: item.token?.symbol || "UNKNOWN",
      name: item.token?.name || "Unknown Token",
      price: item.token?.priceUsd || 0,
      change24h: item.token?.priceChange?.h24 || 0,
      volume: item.token?.volume?.h24 || 0,
      liquidity: item.token?.liquidity?.usd || 0,
      timestamp: item.timestamp || Date.now(),
      chain: normalizeChain(item.token?.chainId || "eth"),
      tokenAddress: item.token?.address || "",
      icon: item.token?.image || item.token?.logo || `https://dd.dexscreener.com/ds-data/tokens/${item.token?.chainId || "eth"}/${item.token?.address || ""}.png`,
    }));
  } catch (err) {
    console.warn("DexScreener Community Takeovers API failed, using fallback:", err);
    return FALLBACK_ADS.filter(a => a.type === "Takeover");
  }
}

// Trending
async function fetchTrending(): Promise<BoostToken[]> {
  try {
    const res = await fetch(`${API_BASE}/metas/trending/v1`);
    if (!res.ok) throw new Error(`Trending ${res.status}`);
    const data: DexScreenerTrendingResponse = await res.json();
    
    return (data.pairs || []).map((item, index) => ({
      id: `trending-${index}`,
      symbol: item.baseToken?.symbol || "UNKNOWN",
      name: item.baseToken?.name || "Unknown Token",
      chain: normalizeChain(item.chainId || "eth"),
      dex: item.dexId || "Unknown",
      price: item.priceUsd || 0,
      change24h: item.priceChange?.h24 || 0,
      volume24h: item.volume?.h24 || 0,
      boostAmount: 0,
      boostTier: "Low Boost" as BoostTier,
      tokenAddress: item.baseToken?.address || "",
      icon: item.info?.imageUrl || `https://dd.dexscreener.com/ds-data/tokens/${item.chainId || "eth"}/${item.baseToken?.address || ""}.png`,
    }));
  } catch (err) {
    console.warn("DexScreener Trending API failed, using fallback:", err);
    return [...FALLBACK_BOOSTS.map(b => ({ ...b, boostTier: b.boostTier as BoostTier }))];
  }
}

// Token Profile Updates
async function fetchTokenProfileUpdates(): Promise<TokenProfileUpdate[]> {
  try {
    const res = await fetch(`${API_BASE}/token-profiles/recent-updates/v1`);
    if (!res.ok) throw new Error(`Token Profile Updates ${res.status}`);
    const data = await res.json();
    
    return (data?.updates || []).map((item, index) => ({
      id: `profile-update-${index}`,
      tokenAddress: item?.token?.address || "",
      chain: normalizeChain(item?.token?.chainId || "eth"),
      symbol: item?.token?.symbol || "UNKNOWN",
      name: item?.token?.name || "Unknown Token",
      updateType: item?.updateType || "unknown",
      timestamp: item?.timestamp || Date.now(),
      icon: item?.token?.image || `https://dd.dexscreener.com/ds-data/tokens/${item?.token?.chainId || "eth"}/${item?.token?.address}.png`,
    }));
  } catch (err) {
    console.warn("DexScreener Token Profile Updates API failed:", err);
    return [];
  }
}

// Orders
async function fetchOrders(chainId: string, tokenAddress: string): Promise<Order[]> {
  try {
    const res = await fetch(`${API_BASE}/orders/v1/${chainId}/${tokenAddress}`);
    if (!res.ok) throw new Error(`Orders ${res.status}`);
    const data = await res.json();
    
    return (data?.orders || []).map((item, index) => ({
      id: `order-${index}`,
      pairAddress: item?.pairAddress || "",
      side: item?.side === "sell" ? "sell" : "buy",
      price: item?.price || 0,
      amount: item?.amount || 0,
      total: item?.total || 0,
      timestamp: item?.timestamp || Date.now(),
    }));
  } catch (err) {
    console.warn("DexScreener Orders API failed:", err);
    return [];
  }
}

// Single Pair
async function fetchPair(chainId: string, pairId: string): Promise<Pair | null> {
  try {
    const res = await fetch(`${API_BASE}/latest/dex/pairs/${chainId}/${pairId}`);
    if (!res.ok) throw new Error(`Pair ${res.status}`);
    const data = await res.json();
    return data?.pair || null;
  } catch (err) {
    console.warn("DexScreener Pair API failed:", err);
    return null;
  }
}

// Search
async function searchPairs(query: string): Promise<Pair[]> {
  try {
    const res = await fetch(`${API_BASE}/latest/dex/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`Search ${res.status}`);
    const data = await res.json();
    return data?.pairs || [];
  } catch (err) {
    console.warn("DexScreener Search API failed:", err);
    return [];
  }
}

// Token Pairs
async function fetchTokenPairs(chainId: string, tokenAddress: string): Promise<Pair[]> {
  try {
    const res = await fetch(`${API_BASE}/token-pairs/v1/${chainId}/${tokenAddress}`);
    if (!res.ok) throw new Error(`Token Pairs ${res.status}`);
    const data = await res.json();
    return data?.pairs || [];
  } catch (err) {
    console.warn("DexScreener Token Pairs API failed:", err);
    return [];
  }
}

// Tokens (multi-address)
async function fetchTokens(chainId: string, tokenAddresses: string[]): Promise<Token[]> {
  try {
    const addressesParam = tokenAddresses.join(",");
    const res = await fetch(`${API_BASE}/tokens/v1/${chainId}/${addressesParam}`);
    if (!res.ok) throw new Error(`Tokens ${res.status}`);
    const data = await res.json();
    return data?.tokens || [];
  } catch (err) {
    console.warn("DexScreener Tokens API failed:", err);
    return [];
  }
}

// Meta by Slug
async function fetchMeta(slug: string): Promise<Meta | null> {
  try {
    const res = await fetch(`${API_BASE}/metas/meta/v1/${slug}`);
    if (!res.ok) throw new Error(`Meta ${res.status}`);
    const data = await res.json();
    return data?.meta || null;
  } catch (err) {
    console.warn("DexScreener Meta API failed:", err);
    return null;
  }
}

// ------------------------------
// Hooks
// ------------------------------

const DEFAULT_QUERY_OPTIONS = {
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
  refetchOnMount: true,
  retry: 2,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
};

// Token Boosts Hooks
export function useTokenBoosts() {
  return useQuery<BoostToken[]>({
    queryKey: ["dexscreener-token-boosts"],
    queryFn: fetchTokenBoosts,
    refetchInterval: 60_000,
    staleTime: 30_000,
    gcTime: 300_000,
    ...DEFAULT_QUERY_OPTIONS,
  });
}

export function useTopTokenBoosts() {
  return useQuery<BoostToken[]>({
    queryKey: ["dexscreener-top-boosts"],
    queryFn: fetchTopTokenBoosts,
    refetchInterval: 120_000,
    staleTime: 60_000,
    gcTime: 300_000,
    ...DEFAULT_QUERY_OPTIONS,
  });
}

// Ads & Takeovers Hooks
export function useAds() {
  return useQuery<AdToken[]>({
    queryKey: ["dexscreener-ads"],
    queryFn: fetchAds,
    refetchInterval: 120_000,
    staleTime: 60_000,
    gcTime: 300_000,
    ...DEFAULT_QUERY_OPTIONS,
  });
}

export function useCommunityTakeovers() {
  return useQuery<AdToken[]>({
    queryKey: ["dexscreener-takeovers"],
    queryFn: fetchCommunityTakeovers,
    refetchInterval: 300_000,
    staleTime: 120_000,
    gcTime: 600_000,
    ...DEFAULT_QUERY_OPTIONS,
  });
}

// Trending Hook
export function useTrending() {
  return useQuery<BoostToken[]>({
    queryKey: ["dexscreener-trending"],
    queryFn: fetchTrending,
    refetchInterval: 60_000,
    staleTime: 30_000,
    gcTime: 300_000,
    ...DEFAULT_QUERY_OPTIONS,
  });
}

// Token Profile Updates Hook
export function useTokenProfileUpdates() {
  return useQuery<TokenProfileUpdate[]>({
    queryKey: ["dexscreener-profile-updates"],
    queryFn: fetchTokenProfileUpdates,
    refetchInterval: 300_000,
    staleTime: 120_000,
    gcTime: 600_000,
    ...DEFAULT_QUERY_OPTIONS,
  });
}

// Orders Hook
export function useOrders(chainId: string, tokenAddress: string) {
  return useQuery<Order[]>({
    queryKey: ["dexscreener-orders", chainId, tokenAddress],
    queryFn: () => fetchOrders(chainId, tokenAddress),
    refetchInterval: 30_000,
    staleTime: 15_000,
    gcTime: 120_000,
    ...DEFAULT_QUERY_OPTIONS,
    enabled: !!chainId && !!tokenAddress,
  });
}

// Pair Hook
export function usePair(chainId: string, pairId: string) {
  return useQuery<Pair | null>({
    queryKey: ["dexscreener-pair", chainId, pairId],
    queryFn: () => fetchPair(chainId, pairId),
    refetchInterval: 60_000,
    staleTime: 30_000,
    gcTime: 300_000,
    ...DEFAULT_QUERY_OPTIONS,
    enabled: !!chainId && !!pairId,
  });
}

// Search Hook
export function useSearchPairs(query: string) {
  return useQuery<Pair[]>({
    queryKey: ["dexscreener-search", query],
    queryFn: () => searchPairs(query),
    refetchInterval: 300_000,
    staleTime: 120_000,
    gcTime: 600_000,
    ...DEFAULT_QUERY_OPTIONS,
    enabled: !!query && query.length > 0,
  });
}

// Token Pairs Hook
export function useTokenPairs(chainId: string, tokenAddress: string) {
  return useQuery<Pair[]>({
    queryKey: ["dexscreener-token-pairs", chainId, tokenAddress],
    queryFn: () => fetchTokenPairs(chainId, tokenAddress),
    refetchInterval: 60_000,
    staleTime: 30_000,
    gcTime: 300_000,
    ...DEFAULT_QUERY_OPTIONS,
    enabled: !!chainId && !!tokenAddress,
  });
}

// Tokens Hook
export function useTokens(chainId: string, tokenAddresses: string[]) {
  return useQuery<Token[]>({
    queryKey: ["dexscreener-tokens", chainId, tokenAddresses.join(",")],
    queryFn: () => fetchTokens(chainId, tokenAddresses),
    refetchInterval: 60_000,
    staleTime: 30_000,
    gcTime: 300_000,
    ...DEFAULT_QUERY_OPTIONS,
    enabled: !!chainId && tokenAddresses.length > 0,
  });
}

// Meta Hook
export function useMeta(slug: string) {
  return useQuery<Meta | null>({
    queryKey: ["dexscreener-meta", slug],
    queryFn: () => fetchMeta(slug),
    refetchInterval: 600_000,
    staleTime: 300_000,
    gcTime: 1200_000,
    ...DEFAULT_QUERY_OPTIONS,
    enabled: !!slug,
  });
}
