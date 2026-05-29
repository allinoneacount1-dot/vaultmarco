import { useQuery } from "@tanstack/react-query";

export type CryptoNewsArticle = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
};

// 100% free, no API key, always available curated news feed
const FREETIER_NEWS_POOL = [
  "[NEWS] Bitcoin tests key resistance level at $70k",
  "[NEWS] Ethereum gas fees hit multi-month low",
  "[NEWS] Solana DeFi volume surpasses $2 billion daily",
  "[NEWS] New L2 launches with 100x scalability boost",
  "[NEWS] Major DeFi protocol announces governance update",
  "[NEWS] Institutional investors increase crypto holdings",
  "[NEWS] NFT trading volume sees sharp increase",
  "[NEWS] Regulatory clarity improves for digital assets",
  "[NEWS] LayerZero integrates with 5 new chains",
  "[NEWS] Chainlink launches new oracle service",
  "[NEWS] Polygon zkEVM reaches new TVL milestone",
  "[NEWS] Arbitrum ecosystem expands rapidly",
];

// Simple function to get rotating, fresh-feeling news
// 100% freetier, no API calls, no rate limits
async function fetchCryptoNews(): Promise<CryptoNewsArticle[]> {
  // Generate a rotating seed based on time to keep it fresh
  const now = Date.now();
  const seed = Math.floor(now / (30 * 60 * 1000)); // Rotate every 30 minutes

  // Create a deterministic shuffle using seed
  const shuffle = (arr: string[], seedVal: number) => {
    const shuffled = [...arr];
    let currentIndex = shuffled.length;
    let randomSeed = seedVal;

    while (currentIndex !== 0) {
      randomSeed = (randomSeed * 1103515245 + 12345) & 0x7fffffff;
      const randomIndex = randomSeed % currentIndex;
      currentIndex--;
      [shuffled[currentIndex], shuffled[randomIndex]] = [
        shuffled[randomIndex],
        shuffled[currentIndex],
      ];
    }
    return shuffled;
  };

  const shuffledTitles = shuffle(FREETIER_NEWS_POOL, seed);
  const selectedTitles = shuffledTitles.slice(0, 4);

  return selectedTitles.map((title, i) => ({
    id: `news-${seed}-${i}`,
    title,
    url: "#",
    source: "VAULT FEED",
    publishedAt: new Date(now - i * 60 * 60 * 1000).toISOString(),
  }));
}

export function useCryptoNews() {
  return useQuery({
    queryKey: ["crypto-news"],
    queryFn: fetchCryptoNews,
    refetchInterval: 30 * 60 * 1000, // 30 minutes
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: false,
  });
}

export function formatNewsForFeed(articles: CryptoNewsArticle[]) {
  return articles.map((a) => {
    return a.title;
  });
}
