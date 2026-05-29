import { createAPIFileRoute } from "@tanstack/react-start/api";

const dexScreenerCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds

export const Route = createAPIFileRoute("/api/dex/screener")({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const chainId = url.searchParams.get("chainId") || "solana";
    const tokenAddress =
      url.searchParams.get("tokenAddress") || "So11111111111111111111111111111111111111112";
    const cacheKey = `${chainId}-${tokenAddress}`;

    // Check cache
    const cached = dexScreenerCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return new Response(JSON.stringify(cached.data), {
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch DexScreener data");
      }

      const data = await response.json();

      // Cache the data
      dexScreenerCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("DexScreener API error:", error);

      // Fallback to mock data
      const mockData = {
        error: "Failed to fetch DexScreener data",
        mock: {
          pairs: [
            {
              chainId: "solana",
              baseToken: {
                symbol: "SOL",
                name: "Solana",
              },
              quoteToken: {
                symbol: "USDC",
              },
              priceUsd: "145.23",
              volume: { h24: "2100000" },
              liquidity: { usd: "500000" },
              priceChange: { h24: 5.2 },
            },
          ],
        },
      };

      return new Response(JSON.stringify(mockData), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
});
