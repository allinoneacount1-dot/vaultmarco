import { createAPIFileRoute } from "@tanstack/react-start/api";

export const Route = createAPIFileRoute("/api/dex/screener")({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const chainId = url.searchParams.get("chainId") || "solana";
    const tokenAddress =
      url.searchParams.get("tokenAddress") || "So11111111111111111111111111111111111111112";

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
      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("DexScreener API error:", error);
      return new Response(
        JSON.stringify({
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
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  },
});
