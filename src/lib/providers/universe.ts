import type { AdToken, BoostToken } from "@/components/marco/shared/types";
import type { RealtimeRow } from "./dexPairs";
import {
  DEXSCREENER_SOURCE,
  type Deps,
  enrichRefs,
  enrichTokensDetailed,
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
  type UniverseSource,
  snapshotKey,
  toPairSnapshot,
} from "@/lib/signals/pairSnapshot";
import { type PairIntelligence, buildIntelligence } from "@/lib/signals/intelligence";
import { type RadarResult, computeRadar } from "@/lib/signals/radar";

/**
 * PAIR UNIVERSE — the slow lane (60 s) of the DexScreener data layer.
 *
 *   providers → normalized PairSnapshot → snapshot history → signal functions → UI
 *
 * Universe = Boost LATEST ∪ Boost TOP ∪ Ads ∪ resolved canonical DEX Realtime.
 *
 * One round fetches the three lists in parallel and enriches the union of
 * their references in ONE batched pass (≤ 30 addresses per request, grouped
 * by chain, deduplicated by chain + address). The canonical DEX Realtime
 * pairs are NOT fetched here: they arrive as `realtime`, taken from the fast
 * lane's (30 s) query cache, which already holds their identity-validated
 * provider payloads.
 *
 * Each list keeps its own envelope: a failing list is carried forward as
 * `stale` from its last real payload (or `null` if it never succeeded). The
 * round only throws when every input failed, so react-query keeps the
 * previous round.
 */

/** What the fast lane handed over for this round. */
export type RealtimeInput =
  | { ok: true; rows: RealtimeRow[]; observedAt: number }
  | { ok: false; error: unknown };

export type SourceState = "ok" | "failed";

/**
 * RADAR STATUS — derived from the inputs that built THIS radar, never from
 * any single feed:
 *
 *   live      every source and every enrichment batch succeeded this round.
 *             (Zero pairs is only reported as an empty universe in this state.)
 *   degraded  this round produced usable snapshots, but at least one source
 *             or enrichment batch failed — the universe is partial.
 *   stale     this round produced no usable snapshots because inputs failed;
 *             the previous round's radar is shown, labelled as such.
 *   offline   inputs failed and there is no previous radar to fall back to.
 */
export type RadarStatus = "live" | "degraded" | "stale" | "offline";

export type RadarInputs = {
  status: RadarStatus;
  sources: {
    boostLatest: SourceState;
    boostTop: SourceState;
    ads: SourceState;
    realtime: SourceState;
  };
  enrichment: { requested: number; batches: number; failedBatches: number };
  /** One line per failed input, for the panel notice. Empty when live. */
  issues: string[];
};

export type PairUniverse = {
  boosts: DataEnvelope<BoostToken[]> | null;
  ads: DataEnvelope<AdToken[]> | null;
  /** Latest observation of every pair in the universe, deduplicated by chain + base address. */
  snapshots: PairSnapshot[];
  radar: RadarResult;
  /** Per-pair intelligence for every snapshot this round (Token Drawer input). */
  intelligence: Record<string, PairIntelligence>;
  radarInputs: RadarInputs;
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

type EnrichmentCounts = { requested: number; batches: number; failedBatches: number };

export async function fetchPairUniverse(
  previous: PairUniverse | undefined,
  history: SnapshotHistory,
  realtime: RealtimeInput,
  deps: Deps = defaultDeps,
): Promise<PairUniverse> {
  const [latestRes, topRes, adsRes] = await Promise.allSettled([
    fetchBoostItems("latest", deps),
    fetchBoostItems("top", deps),
    fetchAdItems(deps),
  ]);

  if (
    latestRes.status === "rejected" &&
    topRes.status === "rejected" &&
    adsRes.status === "rejected" &&
    !realtime.ok
  ) {
    throw new ProviderError(DEXSCREENER_SOURCE, "HTTP_ERROR", "every DexScreener source failed");
  }

  // One enrichment pass over the union of every list's enrich slice.
  const refsBySource: Array<[UniverseSource, Array<{ chainId: string; tokenAddress: string }>]> = [
    ["boost-latest", latestRes.status === "fulfilled" ? enrichRefs(latestRes.value.ranked) : []],
    ["boost-top", topRes.status === "fulfilled" ? enrichRefs(topRes.value.ranked) : []],
    ["ad", adsRes.status === "fulfilled" ? enrichRefs(adsRes.value.ranked) : []],
  ];
  const enrichment = await enrichTokensDetailed(
    refsBySource.flatMap(([, refs]) => refs),
    deps,
  );
  const { index } = enrichment;
  const counts: EnrichmentCounts = {
    requested: enrichment.requested,
    batches: enrichment.batches,
    failedBatches: enrichment.failedBatches,
  };
  const observedAt = deps.now();

  // Feeds: Boost Feed shows LATEST (unchanged); TOP only widens the radar universe.
  const boosts =
    latestRes.status === "fulfilled"
      ? liveEnvelope(
          DEXSCREENER_SOURCE,
          toBoostTokens(latestRes.value.ranked, index),
          observedAt,
          latestRes.value.dropped,
        )
      : carry(previous?.boosts, latestRes.reason);
  const ads =
    adsRes.status === "fulfilled"
      ? liveEnvelope(
          DEXSCREENER_SOURCE,
          toAdTokens(adsRes.value.ranked, index),
          observedAt,
          adsRes.value.dropped,
        )
      : carry(previous?.ads, adsRes.reason);

  // Which list(s) referenced each token.
  const sourcesByKey = new Map<string, UniverseSource[]>();
  for (const [source, refs] of refsBySource) {
    for (const r of refs) {
      const key = tokenKey(r.chainId, r.tokenAddress);
      const list = sourcesByKey.get(key) ?? [];
      if (!list.includes(source)) list.push(source);
      sourcesByKey.set(key, list);
    }
  }

  // Snapshot every enriched pair, then every resolved canonical pair.
  // Identity is chain + base address; when a canonical pair and an enriched
  // pair share it, the canonical (identity-validated) payload is kept and the
  // sources are merged.
  const snapshots = new Map<string, PairSnapshot>();
  for (const [key, pair] of index) {
    snapshots.set(key, toPairSnapshot(pair, observedAt, sourcesByKey.get(key) ?? []));
  }
  if (realtime.ok) {
    for (const row of realtime.rows) {
      if (!row.resolved || !row.pair) continue;
      const key = snapshotKey(row.pair.chainId, row.pair.baseToken.address);
      const sources: UniverseSource[] = [...(sourcesByKey.get(key) ?? []), "realtime"];
      snapshots.set(key, toPairSnapshot(row.pair, realtime.observedAt, sources));
    }
  }
  const current = [...snapshots.values()];

  const sources: RadarInputs["sources"] = {
    boostLatest: latestRes.status === "fulfilled" ? "ok" : "failed",
    boostTop: topRes.status === "fulfilled" ? "ok" : "failed",
    ads: adsRes.status === "fulfilled" ? "ok" : "failed",
    realtime: realtime.ok ? "ok" : "failed",
  };
  const issues = radarIssues(sources, counts);
  const healthy = issues.length === 0;

  if (current.length > 0 || healthy) {
    history.record(current);
    const radar = computeRadar(current, history, observedAt);
    return {
      boosts,
      ads,
      snapshots: current,
      radar,
      intelligence: buildIntelligence(current, history, radar),
      radarInputs: { status: healthy ? "live" : "degraded", sources, enrichment: counts, issues },
      observedAt,
    };
  }

  // Inputs failed and nothing usable came back: never report that as an
  // empty market. Fall back to the previous radar if there is one.
  const fallback = previous && previous.snapshots.length > 0 ? previous : null;
  return {
    boosts,
    ads,
    snapshots: fallback?.snapshots ?? [],
    radar: fallback?.radar ?? computeRadar([], history, observedAt),
    intelligence: fallback?.intelligence ?? {},
    radarInputs: {
      status: fallback ? "stale" : "offline",
      sources,
      enrichment: counts,
      issues,
    },
    observedAt: fallback?.observedAt ?? observedAt,
  };
}

/** One human-readable line per failed radar input. */
export function radarIssues(
  sources: RadarInputs["sources"],
  enrichment: EnrichmentCounts,
): string[] {
  const issues: string[] = [];
  if (sources.boostLatest === "failed") issues.push("BOOSTS LATEST unavailable");
  if (sources.boostTop === "failed") issues.push("BOOSTS TOP unavailable");
  if (sources.ads === "failed") issues.push("ADS unavailable");
  if (sources.realtime === "failed") issues.push("DEX REALTIME unavailable");
  if (enrichment.failedBatches > 0) {
    issues.push(
      enrichment.failedBatches === enrichment.batches
        ? `Token lookup failed for all ${enrichment.requested} listed tokens`
        : `Token lookup failed for ${enrichment.failedBatches} of ${enrichment.batches} batches`,
    );
  }
  return issues;
}
