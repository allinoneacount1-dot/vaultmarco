import { OUTCOME_HORIZONS_MINUTES, OUTCOME_TOLERANCE_MS } from "./constants";
import { compactSnapshot } from "./compact";
import type {
  CompactSnapshot,
  OutcomeObservation,
  OutcomeSource,
  SignalEvent,
  UnavailableReason,
} from "./model";
import { sameAddress } from "@/lib/assetIdentity";
import type { PairSnapshot } from "@/lib/signals/pairSnapshot";

/**
 * OUTCOME OBSERVATIONS — what the event's OWN pair did afterwards.
 *
 * Time semantics (exact, directional):
 *   targetAt     = event.openedAt + horizon
 *   windowEndAt  = targetAt + tolerance(horizon)
 *   accepted  ⇔  targetAt ≤ observedAt ≤ windowEndAt      (both inclusive)
 * A sample taken before the target is never used, however close. The first
 * accepted sample wins and is immutable. `delaySeconds` records how late the
 * real sample was; the stored time is always the sample's real time.
 */

export function scheduleOutcomes(event: SignalEvent): OutcomeObservation[] {
  return OUTCOME_HORIZONS_MINUTES.map((h) => {
    const targetAt = event.openedAt + h * 60_000;
    return {
      eventId: event.id,
      horizonMinutes: h,
      targetAt,
      windowEndAt: targetAt + OUTCOME_TOLERANCE_MS[h],
      availability: "PENDING",
      unavailableReason: null,
      lastFailure: null,
      observedAt: null,
      delaySeconds: null,
      source: null,
      pairAddress: null,
      roundKey: null,
      market: null,
      attempts: 0,
    };
  });
}

export function inWindow(
  o: Pick<OutcomeObservation, "targetAt" | "windowEndAt">,
  t: number,
): boolean {
  return t >= o.targetAt && t <= o.windowEndAt;
}

/** Due: pending, target reached, window still open. */
export function isDue(o: OutcomeObservation, now: number): boolean {
  return o.availability === "PENDING" && inWindow(o, now);
}

/**
 * Record a real sample of the event's pair. Returns the observed outcome, or
 * null when the sample is not acceptable (outside the window, different pair,
 * or the outcome is no longer pending).
 */
export function acceptSample(
  o: OutcomeObservation,
  event: Pick<SignalEvent, "pairAddress">,
  snapshot: PairSnapshot,
  source: OutcomeSource,
  roundKey: string | null,
): OutcomeObservation | null {
  if (o.availability !== "PENDING") return null;
  if (!snapshot.pairAddress || !sameAddress(snapshot.pairAddress, event.pairAddress)) return null;
  if (!inWindow(o, snapshot.observedAt)) return null;
  const market: CompactSnapshot = compactSnapshot(snapshot);
  return {
    ...o,
    availability: "OBSERVED",
    observedAt: snapshot.observedAt,
    delaySeconds: Math.floor((snapshot.observedAt - o.targetAt) / 1000),
    source,
    pairAddress: snapshot.pairAddress,
    roundKey,
    market,
    unavailableReason: null,
    attempts: o.attempts + 1,
  };
}

/** Note a failed attempt while pending; it becomes the reason if the window elapses. */
export function noteFailure(o: OutcomeObservation, reason: UnavailableReason): OutcomeObservation {
  return { ...o, lastFailure: reason, attempts: o.attempts + 1 };
}

/** Past the window with no accepted sample → UNAVAILABLE (never interpolated). */
export function expireIfElapsed(o: OutcomeObservation, now: number): OutcomeObservation | null {
  if (o.availability !== "PENDING" || now <= o.windowEndAt) return null;
  return {
    ...o,
    availability: "UNAVAILABLE",
    unavailableReason: o.lastFailure ?? "WINDOW_ELAPSED",
  };
}
