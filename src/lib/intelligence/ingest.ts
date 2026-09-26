import { assetKey } from "@/lib/assetIdentity";
import { CANONICAL_PAIRS, type RealtimeRow } from "@/lib/providers/dexPairs";
import type { DataEnvelope } from "@/lib/providers/envelope";
import type { PairUniverse } from "@/lib/providers/universe";
import { type PairSnapshot, toPairSnapshot } from "@/lib/signals/pairSnapshot";
import { type AssetObservation, type IngestBatch, PROVIDER } from "./facts";
import type { Lane } from "./rules";

/**
 * INGESTION — turn the state an EXISTING query already holds into a
 * normalized batch. Pure; no request, no clock.
 *
 * Timestamps come only from the payload that was received:
 *   realtime  envelope.fetchedAt (null after a failure → nothing is ingested)
 *   universe  each snapshot's own observedAt (canonical pairs keep the
 *             realtime lane's fetchedAt, so they de-duplicate exactly)
 *   failure   react-query's errorUpdatedAt (when the failure was recorded)
 */

export function observationFromSnapshot(
  s: PairSnapshot,
  lane: Lane,
  providerStatus: AssetObservation["providerStatus"],
): AssetObservation {
  return {
    assetKey: s.key,
    chainId: s.chainId,
    address: s.baseAddress,
    pairAddress: s.pairAddress,
    baseAddress: s.baseAddress,
    quoteAddress: s.quoteAddress ?? null,
    provider: PROVIDER,
    lanes: [lane],
    sources: s.sources,
    observedAt: s.observedAt,
    providerStatus,
    snapshot: s,
  };
}

/** Fast lane: one successful envelope → observations of every resolved slot + gaps for the rest. */
export function batchFromRealtime(
  env: DataEnvelope<RealtimeRow[]> | undefined,
): IngestBatch | null {
  if (!env || env.fetchedAt == null || !Array.isArray(env.data)) return null; // not a fresh payload
  if (env.status !== "live" && env.status !== "degraded") return null;
  const at = env.fetchedAt;
  const observations: AssetObservation[] = [];
  const gaps: NonNullable<IngestBatch["gaps"]> = [];
  for (const row of env.data) {
    if (row.resolved && row.pair) {
      const snap = toPairSnapshot(row.pair, at, ["realtime"]);
      observations.push(observationFromSnapshot(snap, "realtime", env.status));
      continue;
    }
    const canonical = CANONICAL_PAIRS.find((p) => p.key === row.key);
    if (!canonical) continue;
    gaps.push({
      assetKey: assetKey(canonical.chainId, canonical.baseAddress),
      chainId: canonical.chainId,
      address: canonical.baseAddress,
      at,
      lane: "realtime",
      reason: (row.reason ?? "unresolved").toUpperCase(),
    });
  }
  return {
    lane: "realtime",
    at,
    state: env.status === "live" ? "ok" : "partial",
    issues: gaps.map((g) => `${g.chainId} slot ${g.reason}`),
    observations,
    gaps,
  };
}

/**
 * Slow lane: one completed universe round. A live/degraded round contributes
 * its snapshots and radar firings; a stale-fallback or offline round is a
 * failure point only (its snapshots are the previous round's, already held).
 * `roundAt` is when react-query recorded the round (dataUpdatedAt).
 */
export function batchFromUniverse(
  u: PairUniverse | undefined,
  roundAt: number,
): IngestBatch | null {
  if (!u) return null;
  const status = u.radarInputs.status;
  if (status !== "live" && status !== "degraded") {
    return {
      lane: "universe",
      at: roundAt,
      state: "failed",
      code: status.toUpperCase(),
      issues: u.radarInputs.issues,
      observations: [],
    };
  }
  const observations = u.snapshots.map((s) => observationFromSnapshot(s, "universe", status));
  const radar: NonNullable<IngestBatch["radar"]> = [];
  for (const m of u.radar.momentum) {
    radar.push({
      assetKey: m.key,
      kind: "MOMENTUM",
      observedAt: m.observedAt,
      roundAt: u.observedAt,
      direction: null,
      severity: null,
      value: m.va.ratio,
      prior: null,
      priorObservedAt: null,
      reasons: m.reasons,
    });
  }
  for (const e of u.radar.risk) {
    radar.push({
      assetKey: e.key,
      kind: "RISK",
      observedAt: e.change.currentObservedAt,
      roundAt: u.observedAt,
      direction: e.direction,
      severity: e.severity,
      value: e.change.deltaUsd,
      prior: e.change.previousUsd,
      priorObservedAt: e.change.previousObservedAt,
      reasons: [],
    });
  }
  return {
    lane: "universe",
    at: u.observedAt,
    state: status === "live" ? "ok" : "partial",
    issues: u.radarInputs.issues,
    observations,
    radar,
  };
}

/** A lane's query failed (react-query error state). */
export function failureBatch(
  lane: Lane,
  errorUpdatedAt: number,
  error: unknown,
): IngestBatch | null {
  if (!(errorUpdatedAt > 0)) return null;
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : "ERROR";
  return { lane, at: errorUpdatedAt, state: "failed", code, issues: [], observations: [] };
}
