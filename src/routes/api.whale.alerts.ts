import { createAPIFileRoute } from "@tanstack/react-start/api";

export const Route = createAPIFileRoute("/api/whale/alerts")({
  GET: async () => {
    // Mock data for now - ready for real API integration
    const mockWhales = [
      { id: 1, chain: "Solana", token: "SOL", amount: "$125,000", type: "BUY", time: "2 min ago" },
      { id: 2, chain: "Base", token: "DEGEN", amount: "$89,500", type: "SELL", time: "5 min ago" },
      {
        id: 3,
        chain: "Ethereum",
        token: "PEPE",
        amount: "$242,000",
        type: "BUY",
        time: "12 min ago",
      },
    ];

    return new Response(JSON.stringify(mockWhales), {
      headers: { "Content-Type": "application/json" },
    });
  },
});
