import { EXIT_NEGATIVE_STREAK, MAX_NEGATIVE_GAP_MS, TRACKING_LOST_MS } from "./constants";
import { compactSnapshot } from "./compact";
import { eventId } from "./ids";
import type { EpisodeState, Observation, SignalEvent, SignalEvidence, SignalType } from "./model";
import type { PairSnapshot } from "@/lib/signals/pairSnapshot";

/**
 * EPISODE STATE MACHINE (pure).
 *
 *   OPEN      FIRED with no open episode for (assetKey, type)
 *   FIRED     while open: streak cleared, no new event
 *   NEGATIVE  VALID_NEGATIVE: streak + 1, unless the previous valid negative is
 *             more than MAX_NEGATIVE_GAP_MS ago — then the streak restarts at 1
 *   NO_DATA   nothing changes (never counts as a negative, never resets)
 *   EXIT      streak reaches EXIT_NEGATIVE_STREAK → CLOSED / SIGNAL_EXIT
 *   LOST      no valid observation for TRACKING_LOST_MS → CLOSED / TRACKING_LOST
 *   RULES     rules version changed → CLOSED / RULES_CHANGED
 *
 * TIME. Every episode time is the REAL observation time the classifier
 * returns (`Observation.observedAt`), never the scheduled minute. The round's
 * scheduled time is used only as the round-order guard (`lastEvaluatedAt`),
 * for RULES_CHANGED, and as the evaluation time of a NO_DATA round (which has
 * no observation; the scheduled minute is never later than real time, so a
 * loss is never declared early).
 *
 * TRACKING LOSS IS CHECKED FIRST. Before a new FIRED or VALID_NEGATIVE is
 * attached, the gap since the previous `lastValidAt` is measured. If it is
 * ≥ TRACKING_LOST_MS (e.g. the recorder was down), the episode closes as
 * TRACKING_LOST at `lastValidAt + TRACKING_LOST_MS` and the new observation is
 * NOT attached: a FIRED then opens a NEW episode in the same round; a
 * VALID_NEGATIVE opens nothing.
 *
 * Monotonic: a round at or before `lastEvaluatedAt` is ignored, so replaying
 * a round (or an older round after a newer one) is a no-op. An observation not
 * newer than `lastValidAt` is not new evidence and counts as NO_DATA.
 */

export type FiredSignal = {
  assetKey: string;
  type: SignalType;
  severity: "MEDIUM" | "HIGH" | null;
  snapshot: PairSnapshot;
  evidence: SignalEvidence;
  vaRatio: number | null;
  absLiquidityDeltaUsd: number | null;
};

export type RoundInput = {
  key: string;
  at: number;
  rulesVersion: string;
  /** Only meaningful for usable rounds; non-usable rounds classify as NO_DATA. */
  observe: (assetKey: string, type: SignalType) => Observation;
  /** Signals the engine emitted this round (empty for non-usable rounds). */
  fired: readonly FiredSignal[];
};

export type EpisodeTransitions = {
  opened: Array<{ event: SignalEvent; episode: EpisodeState }>;
  /** Updated episodes (including those closed this round), with the version they must replace. */
  updated: Array<{ episode: EpisodeState; expectedLastEvaluatedAt: number }>;
};

const openKey = (assetKey: string, type: SignalType) => `${type}|${assetKey}`;

function maxOrNull(a: number | null, b: number | null): number | null {
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
}

/**
 * Apply one observation to one open episode in the round scheduled at
 * `roundAt`. Returns the new state, or null when the round is a replay.
 */
export function stepEpisode(
  ep: EpisodeState,
  obs: Observation,
  roundAt: number,
  fired: FiredSignal | undefined,
): EpisodeState | null {
  if (ep.status !== "OPEN" || roundAt <= ep.lastEvaluatedAt) return null;
  const next: EpisodeState = { ...ep, lastEvaluatedAt: roundAt };
  const fresh = obs.observedAt != null && obs.observedAt > ep.lastValidAt;
  const t = fresh ? obs.observedAt! : roundAt;

  // 1. Tracking loss, judged BEFORE the new observation may be attached.
  if (t - ep.lastValidAt >= TRACKING_LOST_MS) {
    return {
      ...next,
      status: "CLOSED",
      closeReason: "TRACKING_LOST",
      closedAt: ep.lastValidAt + TRACKING_LOST_MS,
    };
  }
  if (!fresh) return next; // NO_DATA: nothing else changes

  // 2. Attach the observation at its real time.
  if (obs.class === "FIRED") {
    return {
      ...next,
      lastFiredAt: t,
      lastValidAt: t,
      roundsFired: ep.roundsFired + 1,
      negativeStreakCount: 0,
      negativeStreakStartedAt: null,
      lastValidNegativeAt: null,
      peakVaRatio: maxOrNull(ep.peakVaRatio, fired?.vaRatio ?? null),
      peakAbsLiquidityDeltaUsd: maxOrNull(
        ep.peakAbsLiquidityDeltaUsd,
        fired?.absLiquidityDeltaUsd ?? null,
      ),
    };
  }
  const continuous =
    ep.negativeStreakCount > 0 &&
    ep.lastValidNegativeAt != null &&
    t - ep.lastValidNegativeAt <= MAX_NEGATIVE_GAP_MS;
  const count = continuous ? ep.negativeStreakCount + 1 : 1;
  const negative: EpisodeState = {
    ...next,
    lastValidAt: t,
    negativeStreakCount: count,
    negativeStreakStartedAt: continuous ? ep.negativeStreakStartedAt : t,
    lastValidNegativeAt: t,
  };
  if (count >= EXIT_NEGATIVE_STREAK) {
    return { ...negative, status: "CLOSED", closeReason: "SIGNAL_EXIT", closedAt: t };
  }
  return negative;
}

function newEpisode(
  f: FiredSignal,
  round: RoundInput,
): { event: SignalEvent; episode: EpisodeState } {
  const id = eventId(round.rulesVersion, f.assetKey, f.type, round.key);
  const event: SignalEvent = {
    id,
    assetKey: f.assetKey,
    chainId: f.snapshot.chainId,
    address: f.snapshot.baseAddress,
    pairAddress: f.snapshot.pairAddress ?? "",
    symbol: f.snapshot.baseSymbol,
    type: f.type,
    severity: f.severity,
    rulesVersion: round.rulesVersion,
    openedRound: round.key, // scheduler identity
    openedAt: f.snapshot.observedAt, // real observation time
    evidence: f.evidence,
    openSnapshot: compactSnapshot(f.snapshot),
  };
  const episode: EpisodeState = {
    eventId: id,
    assetKey: f.assetKey,
    type: f.type,
    rulesVersion: round.rulesVersion,
    status: "OPEN",
    closeReason: null,
    closedAt: null,
    lastFiredAt: f.snapshot.observedAt,
    lastValidAt: f.snapshot.observedAt,
    lastEvaluatedAt: round.at,
    negativeStreakCount: 0,
    negativeStreakStartedAt: null,
    lastValidNegativeAt: null,
    roundsFired: 1,
    peakVaRatio: f.vaRatio,
    peakAbsLiquidityDeltaUsd: f.absLiquidityDeltaUsd,
  };
  return { event, episode };
}

/**
 * One round's transitions for every open episode plus every fired signal.
 * A signal whose pair has no pairAddress cannot anchor outcomes and is not opened.
 * A signal whose previous episode closed this round (TRACKING_LOST or
 * RULES_CHANGED) opens a new episode with a distinct event id (new openedRound).
 */
export function applyRound(open: readonly EpisodeState[], round: RoundInput): EpisodeTransitions {
  const out: EpisodeTransitions = { opened: [], updated: [] };
  const firedBy = new Map(round.fired.map((f) => [openKey(f.assetKey, f.type), f]));
  const stillOpen = new Set<string>();

  for (const ep of open) {
    if (ep.status !== "OPEN") continue;
    if (round.at <= ep.lastEvaluatedAt) {
      stillOpen.add(openKey(ep.assetKey, ep.type)); // replay / out-of-order: no-op
      continue;
    }
    if (ep.rulesVersion !== round.rulesVersion) {
      out.updated.push({
        episode: {
          ...ep,
          lastEvaluatedAt: round.at,
          status: "CLOSED",
          closeReason: "RULES_CHANGED",
          closedAt: round.at,
        },
        expectedLastEvaluatedAt: ep.lastEvaluatedAt,
      });
      continue;
    }
    const k = openKey(ep.assetKey, ep.type);
    const next = stepEpisode(ep, round.observe(ep.assetKey, ep.type), round.at, firedBy.get(k));
    if (next) out.updated.push({ episode: next, expectedLastEvaluatedAt: ep.lastEvaluatedAt });
    // A FIRED can only close an episode as TRACKING_LOST (never SIGNAL_EXIT);
    // it then opens the NEW episode below, in this same round.
    if (!next || next.status === "OPEN") stillOpen.add(k);
  }

  for (const f of round.fired) {
    const k = openKey(f.assetKey, f.type);
    if (stillOpen.has(k) || !f.snapshot.pairAddress) continue;
    stillOpen.add(k);
    out.opened.push(newEpisode(f, round));
  }
  return out;
}
