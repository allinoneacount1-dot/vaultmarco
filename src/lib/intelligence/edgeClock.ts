import { transactionAcceleration, volumeAcceleration } from "@/lib/signals/pace";
import { type Collision, collisionFamilies } from "./collision";
import { type EvidenceEvent, STRUCTURAL_TYPES, poolSegment } from "./events";
import type { AssetObservation, AssetTrack } from "./facts";
import { RUN_MAX_GAP_MS } from "./rules";

/**
 * EDGE CLOCK ORIGIN — "how old is this move?"
 *
 * The origin can only be a REAL, OBSERVED, qualifying structural change: an
 * event of a STRUCTURAL_TYPES type whose onset is OBSERVED (a real earlier
 * observation showed the condition false, or a session delta between two
 * real observations). It is never page load, session start, first render,
 * the asset's first observation or a synthetic baseline: a condition that
 * was already true when first observed (IN_PROGRESS_WHEN_OBSERVED) is not an
 * origin, because its start was not seen.
 *
 * `edgeClockOrigin` answers for the move in progress: among qualifying events
 * still ACTIVE at the asset's latest observation, the earliest onset. Null
 * when there is none ("NO STRUCTURAL CHANGE OBSERVED THIS SESSION").
 */

export function qualifiesAsOrigin(e: EvidenceEvent): boolean {
  return STRUCTURAL_TYPES.has(e.type) && e.onset === "OBSERVED";
}

const earliest = (list: EvidenceEvent[]): EvidenceEvent | null =>
  list.reduce<EvidenceEvent | null>(
    (best, e) =>
      best == null ||
      e.observedAt < best.observedAt ||
      (e.observedAt === best.observedAt && e.id < best.id)
        ? e
        : best,
    null,
  );

export function edgeClockOrigin(events: readonly EvidenceEvent[]): EvidenceEvent | null {
  return earliest(events.filter((e) => qualifiesAsOrigin(e) && e.active));
}

/** Earliest qualifying structural change retained this session, active or not. */
export function firstObservedStructuralChange(
  events: readonly EvidenceEvent[],
): EvidenceEvent | null {
  return earliest(events.filter(qualifiesAsOrigin));
}

/** Events observed at or after the origin (the evidence "since" it), chronological. */
export function eventsSince(
  events: readonly EvidenceEvent[],
  origin: EvidenceEvent,
): EvidenceEvent[] {
  return events
    .filter((e) => e.observedAt >= origin.observedAt)
    .sort((a, b) => a.observedAt - b.observedAt || (a.id < b.id ? -1 : 1));
}

/* ------------------------------------------------------------------ *
 * EDGE CLOCK page model — evidence since the origin
 * ------------------------------------------------------------------ */

export type SinceMetricId =
  | "PRICE"
  | "VOLUME_M5"
  | "VOLUME_PACE"
  | "LIQUIDITY"
  | "TXNS_M5"
  | "TXN_PACE"
  | "BOOSTS";

export type SinceMetric = {
  id: SinceMetricId;
  label: string;
  /** Value at the origin observation (same pool), or null. */
  from: number | null;
  /** Value at the latest observation (same pool), or null. */
  to: number | null;
  /** to − from, only when both are real; else null ("—"). */
  delta: number | null;
  /** delta / from × 100 where meaningful (from > 0), else null. */
  deltaPct: number | null;
  unit: "USD" | "PRICE" | "RATIO" | "COUNT";
  horizon: string;
  /** Why no delta: the first missing input, else null. */
  missing: string | null;
};

export type EdgeClockModel = {
  /** Active, OBSERVED-onset structural change with the earliest onset. */
  origin: EvidenceEvent | null;
  /** Earliest OBSERVED structural change retained, only when it is NOT the origin. */
  earlier: EvidenceEvent | null;
  /** Active structural conditions already true when first observed (start not seen). */
  inProgress: EvidenceEvent[];
  /** Observation where the origin was first seen (same pool). */
  originObs: AssetObservation | null;
  /** The previous real observation of the same pool before the origin (within the run gap). */
  previousObs: AssetObservation | null;
  latestObs: AssetObservation | null;
  /** Latest observation is on the origin's pool with no switch in between. */
  samePool: boolean;
  /** Why no since-delta can be computed at all (origin not retained, pool switch, no later observation), else null. */
  sinceBlocked: string | null;
  since: SinceMetric[];
  /** Structural events whose onset is at/after the origin, same pool, chronological. */
  sinceEvents: EvidenceEvent[];
  /** Independent families among them (collisionFamilies over origin → latest). */
  families: Collision | null;
  /** Observed duration origin → last observation where it still held. */
  observedActiveMs: number | null;
};

/** Horizon of a plain origin → latest comparison (shown once, not per row). */
export const PAIR_HORIZON = "ORIGIN OBSERVATION → LATEST OBSERVATION · SAME POOL";

function metric(
  id: SinceMetricId,
  label: string,
  unit: SinceMetric["unit"],
  from: number | null,
  to: number | null,
  why: string | null,
  horizon = PAIR_HORIZON,
): SinceMetric {
  if (why) return { id, label, unit, from, to, delta: null, deltaPct: null, horizon, missing: why };
  if (from == null || to == null) {
    return {
      id,
      label,
      unit,
      from,
      to,
      delta: null,
      deltaPct: null,
      horizon,
      missing:
        from == null ? "NOT REPORTED AT THE ORIGIN" : "NOT REPORTED AT THE LATEST OBSERVATION",
    };
  }
  const delta = to - from;
  return {
    id,
    label,
    unit,
    from,
    to,
    delta,
    deltaPct: from > 0 ? (delta / from) * 100 : null,
    horizon,
    missing: null,
  };
}

const txnTotal = (o: AssetObservation | null) => {
  const w = o?.snapshot.txns.m5;
  return w ? w.buys + w.sells : null;
};
const pace = (r: ReturnType<typeof volumeAcceleration>) => (r.ok ? r.ratio : null);

export function edgeClockModel(
  track: AssetTrack | null | undefined,
  events: readonly EvidenceEvent[],
): EdgeClockModel {
  const obs = track?.observations ?? [];
  const origin = edgeClockOrigin(events);
  const firstEver = firstObservedStructuralChange(events);
  const earlier = firstEver && (!origin || firstEver.id !== origin.id) ? firstEver : null;
  const inProgress = events.filter(
    (e) => STRUCTURAL_TYPES.has(e.type) && e.onset === "IN_PROGRESS_WHEN_OBSERVED" && e.active,
  );
  const latestObs = obs.length ? obs[obs.length - 1] : null;

  const empty: EdgeClockModel = {
    origin,
    earlier,
    inProgress,
    originObs: null,
    previousObs: null,
    latestObs,
    samePool: false,
    sinceBlocked: null,
    since: [],
    sinceEvents: [],
    families: null,
    observedActiveMs: null,
  };
  if (!origin || !latestObs) return empty;

  const originIdx = obs.findIndex(
    (o) => o.observedAt === origin.observedAt && o.pairAddress === origin.pairAddress,
  );
  const originObs = originIdx >= 0 ? obs[originIdx] : null;
  const prevCandidate = originIdx > 0 ? obs[originIdx - 1] : null;
  const previousObs =
    prevCandidate &&
    originObs &&
    prevCandidate.pairAddress === originObs.pairAddress &&
    originObs.observedAt - prevCandidate.observedAt <= RUN_MAX_GAP_MS
      ? prevCandidate
      : null;

  const segment = poolSegment(obs, obs.length - 1);
  const samePool =
    originObs != null && segment.some((o) => o === originObs) && latestObs.pairAddress != null;
  const later = originObs != null && latestObs.observedAt > originObs.observedAt;
  const why = !originObs
    ? "ORIGIN OBSERVATION NO LONGER RETAINED"
    : !samePool
      ? "OBSERVED POOL CHANGED SINCE THE ORIGIN"
      : !later
        ? "NO LATER OBSERVATION YET"
        : null;
  const a = originObs?.snapshot ?? null;
  const b = latestObs.snapshot;
  const since: SinceMetric[] = [
    metric("PRICE", "PRICE", "PRICE", a?.priceUsd ?? null, b.priceUsd, why),
    metric("VOLUME_M5", "VOLUME M5", "USD", a?.volume.m5 ?? null, b.volume.m5, why),
    metric(
      "VOLUME_PACE",
      "VOLUME PACE",
      "RATIO",
      a ? pace(volumeAcceleration(a)) : null,
      pace(volumeAcceleration(b)),
      why,
      "M5 PACE VS (H1 − M5) PACE · AT ORIGIN → LATEST",
    ),
    metric("LIQUIDITY", "LIQUIDITY", "USD", a?.liquidityUsd ?? null, b.liquidityUsd, why),
    metric("TXNS_M5", "TXNS M5", "COUNT", txnTotal(originObs), txnTotal(latestObs), why),
    metric(
      "TXN_PACE",
      "TXN PACE",
      "RATIO",
      a ? pace(transactionAcceleration(a)) : null,
      pace(transactionAcceleration(b)),
      why,
      "M5 PACE VS (H1 − M5) PACE · AT ORIGIN → LATEST",
    ),
    metric("BOOSTS", "ACTIVE BOOSTS", "COUNT", a?.boostsActive ?? null, b.boostsActive, why),
  ];

  const sinceEvents = eventsSince(events, origin).filter(
    (e) => STRUCTURAL_TYPES.has(e.type) && e.pairAddress === origin.pairAddress,
  );
  const familiesEnd = Math.max(latestObs.observedAt, ...sinceEvents.map((e) => e.observedAt));
  const families =
    sinceEvents.length > 0
      ? collisionFamilies(sinceEvents, familiesEnd - origin.observedAt, {
          end: familiesEnd,
          pairAddress: origin.pairAddress,
        })
      : null;

  return {
    ...empty,
    originObs,
    previousObs,
    samePool,
    sinceBlocked: why,
    since,
    sinceEvents,
    families,
    observedActiveMs: origin.lastObservedAt - origin.observedAt,
  };
}
