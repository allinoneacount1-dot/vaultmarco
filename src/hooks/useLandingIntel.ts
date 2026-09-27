import { useEffect, useState } from "react";
import { useAds, useTokenBoosts } from "@/hooks/useDexScreener";
import { useGlobalStats } from "@/hooks/useGlobalStats";
import { useRealtimeQuery } from "@/hooks/usePairUniverse";
import type { DeskState } from "@/lib/deskState";
import { DEXSCREENER_SOURCE } from "@/lib/providers/dexPairs";
import { resolveEnvelope } from "@/lib/providers/envelope";
import { type PreviewModel, previewModel } from "@/lib/landing/liveIntel";

/** Wall clock for age labels, ticking once a second. Reads nothing from any cache. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * The landing preview's data: the dashboard's own queries, read through their
 * existing keys — DEX realtime fast lane (30 s), pair universe (60 s: boosts +
 * ads) and global stats (60 s). This hook adds no request loop of its own.
 */
export function useLandingIntel(): { model: PreviewModel; now: number } {
  const now = useNow();

  const rt = useRealtimeQuery();
  const rtEnvelope = resolveEnvelope({
    source: DEXSCREENER_SOURCE,
    previous: rt.data,
    isError: rt.isError,
    error: rt.error,
    fetchStatus: rt.fetchStatus,
    fetchFailureCount: rt.failureCount,
    fetchFailureReason: rt.failureReason,
  });
  const rtStatus: DeskState =
    rt.isPending && !rtEnvelope ? "loading" : (rtEnvelope?.status ?? "offline");

  const boosts = useTokenBoosts();
  const ads = useAds();

  const gs = useGlobalStats();
  const gEnvelope = gs.data?.coingecko;
  const gStatus: DeskState =
    gs.isPending && !gEnvelope ? "loading" : (gEnvelope?.status ?? "offline");

  const model = previewModel({
    now,
    realtime: { status: rtStatus, envelope: rtEnvelope },
    boosts: { status: boosts.providerStatus, envelope: boosts.envelope },
    ads: { status: ads.providerStatus, envelope: ads.envelope },
    global: { status: gStatus, envelope: gEnvelope },
  });
  return { model, now };
}
