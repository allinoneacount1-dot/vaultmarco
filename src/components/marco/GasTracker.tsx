import { useQuery } from "@tanstack/react-query";
import { Activity, Zap } from "lucide-react";
import { Skeleton } from "./Skeleton";

// Fetch gas price from Etherscan (free API)
const fetchGasPrice = async () => {
  // Mock data for now, bisa diganti dengan real API nanti
  return {
    low: 25,
    average: 32,
    high: 45,
  };
};

export function GasTracker() {
  const { data, isLoading } = useQuery({
    queryKey: ["gasPrice"],
    queryFn: fetchGasPrice,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (isLoading) {
    return <Skeleton className="h-9 w-24" />;
  }

  return (
    <div className="flex items-center gap-2 rounded-full glass border border-white/10 px-3 py-1.5">
      <Activity className="size-3 text-primary" />
      <div className="flex items-baseline gap-1">
        <span className="text-xs font-mono text-foreground">{data?.average}</span>
        <span className="text-[10px] font-mono text-muted-foreground">gwei</span>
      </div>
    </div>
  );
}
