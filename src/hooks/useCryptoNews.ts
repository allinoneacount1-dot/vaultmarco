import { useQuery } from "@tanstack/react-query";

export type CryptoNewsArticle = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
};

// Free fallback news if API fails (for demo purposes)
const FALLBACK_NEWS = [
  "[NEWS] Bitcoin surges past $70,000 amid ETF inflows",
  "[NEWS] Ethereum Layer 2 TVL hits new all-time high",
  "[NEWS] Solana ecosystem sees record DeFi activity",
  "[NEWS] Major protocol upgrade scheduled for next week",
];

// Note: For production, you should use your own API key
// For now, we'll use CryptoPanic (no API key needed for public data) or fall back
async function fetchCryptoNews(): Promise<CryptoNewsArticle[]> {
  try {
    // First try CryptoPanic (public, no API key needed)
    const cryptoPanicUrl = "https://cryptopanic.com/api/v1/posts/?auth_token=demo&filter=hot";
    const res = await fetch(cryptoPanicUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.results && Array.isArray(data.results)) {
        return data.results.slice(0, 4).map((post: any) => ({
          id: post.id?.toString() || Math.random().toString(),
          title: post.title,
          url: post.url || "#",
          source: post.source?.title || "CryptoPanic",
          publishedAt: post.created_at || new Date().toISOString(),
        }));
      }
    }
  } catch (err) {
    console.log("Crypto news API failed, using fallback");
  }
  
  // Fallback to mock news
  return FALLBACK_NEWS.map((title, i) => ({
    id: `fallback-${i}`,
    title,
    url: "#",
    source: "VAULT FEED",
    publishedAt: new Date(Date.now() - i * 3600000).toISOString(),
  }));
}

export function useCryptoNews() {
  return useQuery({
    queryKey: ["crypto-news"],
    queryFn: fetchCryptoNews,
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    staleTime: 3 * 60 * 1000, // 3 minutes
    retry: 1,
  });
}

export function formatNewsForFeed(articles: CryptoNewsArticle[]) {
  return articles.map((a) => {
    const prefix = a.source !== "VAULT FEED" ? `[${a.source.toUpperCase()}]` : "";
    return `${prefix} ${a.title}`.trim();
  });
}
