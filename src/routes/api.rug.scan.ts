import { createAPIFileRoute } from "@tanstack/react-start/api";

export const Route = createAPIFileRoute("/api/rug/scan")({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const tokenSymbol = url.searchParams.get("symbol") || "SOL";

    // Mock scoring - ready for real API
    const score = Math.floor(Math.random() * 100);
    const checks = [
      { name: "Liquidity Locked", passed: score > 30 },
      { name: "Contract Renounced", passed: score > 50 },
      { name: "Top 10 Holders <50%", passed: score > 40 },
      { name: "No Honeypot", passed: score > 20 },
      { name: "Verified Contract", passed: score > 35 },
    ];

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
