import type { AdToken, BoostToken } from "@/components/marco/shared/types";
import { fetchRealtimePairs, type RealtimeRow } from "./dexPairs";
import {
  DEXSCREENER_SOURCE,
  type Deps,
  enrichRefs,
  enrichTokens,
  fetchAdItems,
  fetchBoostItems,
  toAdTokens,
  toBoostTokens,
  tokenKey,
} from "./dexscreener";
import { type DataEnvelope, ProviderError, liveEnvelope, toProviderErrorInfo } from "./envelope";
import { fetchJson } from "./http";
import type { SnapshotHistory } from "@/lib/signals/history";
import {
  type PairSnapshot,
  type UniverseMembership,
  toPairSnapshot,
} from "@/lib/signals/pairSnapshot";
import { type RadarResult, computeRadar } from "@/lib/signals/radar";

/**
 * PAIR UNIVERSE — the single DexScreener poll every dashboard panel reads.
 *
 *   providers → normalized PairSnapshot → snapshot history → signal functions → UI
 *
 * One round fetches the boost list, the ad list and the canonical realtime
 * pairs in parallel, then enriches the union of boost + ad references in ONE
 * batched pass (≤ 30 addresses per request, grouped by chain). The Boost Feed,
 * Ads Feed, DEX Realtime and Alpha Radar all read this object from the same
 * query cache, so consolidating here strictly reduces request count.
 *
 * Each source keeps its own envelope: a failing source is carried forward as
 * `stale` from its last real payload (or reported `offline` if it never
 * succeeded) while the others stay `live`. The round only throws when every
 * source failed, so react-query keeps the previous round.
 */
export type PairUniverse = {
  boosts: DataEnvelope<BoostToken[]> | null;
  ads: DataEnvelope<AdToken[]> | null;
  realtime: DataEnvelope<RealtimeRow[]> | null;
  /** Latest observation of every enriched pair this round. */
  snapshots: PairSnapshot[];
  radar: RadarResult;
  observedAt: number;
};

const defaultDeps: Deps = { fetchJson, now: () => Date.now() };

/** Carry a source's last real payload forward as `stale`, or `null` if there is none. */
function carry<T>(
  previous: DataEnvelope<T> | null | undefined,
  err: unknown,
): DataEnvelope<T> | null {
  if (!previous) return null;
  return {
    ...previous,
    status: "stale",
    fetchedAt: null,
    error: toProviderErrorInfo(DEXSCREENER_SOURCE, err),
  };
}

export async function fetchPairUniverse(
  previous: PairUniverse | undefined,
  history: SnapshotHistory,
  deps: Deps = defaultDeps,
): Promise<PairUniverse> {
  const [boostsRes, adsRes, realtimeRes] = await Promise.allSettled([
    fetchBoostItems("latest", deps),
    fetchAdItems(deps),
    fetchRealtimePairs(deps),
  ]);

  if (
    boostsRes.status === "rejected" &&
    adsRes.status === "rejected" &&
    realtimeRes.status === "rejected"
  ) {
    throw new ProviderError(DEXSCREENER_SOURCE, "HTTP_ERROR", "every DexScreener source failed");
  }

  // One enrichment pass over the union of what the feeds would each enrich.
  const boostRefs = boostsRes.status === "fulfilled" ? enrichRefs(boostsRes.value.ranked) : [];
  const adRefs = adsRes.status === "fulfilled" ? enrichRefs(adsRes.value.ranked) : [];
  const index = await enrichTokens([...boostRefs, ...adRefs], deps);
  const observedAt = deps.now();

  const boosts =
    boostsRes.status === "fulfilled"
      ? liveEnvelope(
          DEXSCREENER_SOURCE,
          toBoostTokens(boostsRes.value.ranked, index),
          observedAt,
          boostsRes.value.dropped,
        )
      : carry(previous?.boosts, boostsRes.reason);

  const ads =
    adsRes.status === "fulfilled"
      ? liveEnvelope(
          DEXSCREENER_SOURCE,
          toAdTokens(adsRes.value.ranked, index),
          observedAt,
          adsRes.value.dropped,
        )
      : carry(previous?.ads, adsRes.reason);

  const realtime =
    realtimeRes.status === "fulfilled"
      ? realtimeRes.value
      : carry(previous?.realtime, realtimeRes.reason);

  // Normalize every enriched pair once; membership records which feed(s) brought it in.
  const inBoosts = new Set(boostRefs.map((r) => tokenKey(r.chainId, r.tokenAddress)));
  const inAds = new Set(adRefs.map((r) => tokenKey(r.chainId, r.tokenAddress)));
  const snapshots: PairSnapshot[] = [];
  for (const [key, pair] of index) {
    const membership: UniverseMembership =
      inBoosts.has(key) && inAds.has(key) ? "boost+ad" : inAds.has(key) ? "ad" : "boost";
    snapshots.push(toPairSnapshot(pair, observedAt, membership));
  }

  history.record(snapshots);
  const radar = computeRadar(snapshots, history, observedAt);

  return { boosts, ads, realtime, snapshots, radar, observedAt };
}
