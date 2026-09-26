import { type EvidenceEvent, STRUCTURAL_TYPES } from "./events";

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
