import { useQuery } from "@tanstack/react-query";
import { Activity, Zap } from "lucide-react";
import { Skeleton } from "./Skeleton";

// Real ETH gas via beaconcha.in gasnow (free, keyless). Returns gwei.
const fetchGasPrice = async () => {
  const res = await fetch("https://beaconcha.in/api/v1/execution/gasnow");
  if (!res.ok) throw new Error(`gasnow ${res.status}`);
  const json = (await res.json()) as { data?: { standard?: number } };
  const wei = json.data?.standard;
  if (!wei) throw new Error("gasnow empty");
  return { average: Math.max(1, Math.round(wei / 1e9)) };
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
  if (!data) return null; // free API unavailable — hide rather than fake it

  return (
    <div className="hairline flex items-center gap-2 px-3 py-1.5">
      <Activity className="size-3 text-(--gold)" strokeWidth={1.8} />
      <div className="flex items-baseline gap-1">
        <span className="mono-data text-xs text-(--bone)">{data?.average}</span>
        <span className="mono-data text-[10px] text-(--faint)">gwei</span>
      </div>
    </div>
  );
}
