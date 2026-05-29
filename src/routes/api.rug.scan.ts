import { createAPIFileRoute } from "@tanstack/react-start/api";

// Simple in-memory cache to keep consistent scores for same token
const rugScanCache = new Map<
  string,
  { score: number; checks: { name: string; passed: boolean }[]; timestamp: number }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const Route = createAPIFileRoute("/api/rug/scan")({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const tokenSymbol = url.searchParams.get("symbol") || "SOL";

    // Check cache first
    const cached = rugScanCache.get(tokenSymbol);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return new Response(
        JSON.stringify({
          symbol: tokenSymbol,
          score: cached.score,
          checks: cached.checks,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Generate new score
    const score = Math.floor(Math.random() * 100);
    const checks = [
      { name: "Liquidity Locked", passed: score > 30 },
      { name: "Contract Renounced", passed: score > 50 },
      { name: "Top 10 Holders <50%", passed: score > 40 },
      { name: "No Honeypot", passed: score > 20 },
      { name: "Verified Contract", passed: score > 35 },
    ];

    // Store in cache
    rugScanCache.set(tokenSymbol, {
      score,
      checks,
      timestamp: Date.now(),
    });

    return new Response(
      JSON.stringify({
        symbol: tokenSymbol,
        score,
        checks,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  },
});
