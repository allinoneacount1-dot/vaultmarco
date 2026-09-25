import { EXIT_NEGATIVE_STREAK, MAX_NEGATIVE_GAP_MS, TRACKING_LOST_MS } from "./constants";
import { compactSnapshot } from "./compact";
import { eventId } from "./ids";
import type {
  EpisodeState,
  ObservationClass,
  SignalEvent,
  SignalEvidence,
  SignalType,
} from "./model";
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
 * Monotonic: a round at or before `lastEvaluatedAt` is ignored, so replaying
 * a round (or an older round after a newer one) is a no-op.
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
  observe: (assetKey: string, type: SignalType) => ObservationClass;
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

/** Apply one observation to one open episode. Returns the new state, or null when unchanged. */
export function stepEpisode(
  ep: EpisodeState,
  cls: ObservationClass,
  at: number,
  fired: FiredSignal | undefined,
): EpisodeState | null {
  if (ep.status !== "OPEN" || at <= ep.lastEvaluatedAt) return null;
  let next: EpisodeState = { ...ep, lastEvaluatedAt: at };

  if (cls === "FIRED") {
    next = {
      ...next,
      lastFiredAt: at,
      lastValidAt: at,
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
  } else if (cls === "VALID_NEGATIVE") {
    const continuous =
      ep.negativeStreakCount > 0 &&
      ep.lastValidNegativeAt != null &&
      at - ep.lastValidNegativeAt <= MAX_NEGATIVE_GAP_MS;
    const count = continuous ? ep.negativeStreakCount + 1 : 1;
    next = {
      ...next,
      lastValidAt: at,
      negativeStreakCount: count,
      negativeStreakStartedAt: continuous ? ep.negativeStreakStartedAt : at,
      lastValidNegativeAt: at,
    };
    if (count >= EXIT_NEGATIVE_STREAK) {
      return { ...next, status: "CLOSED", closeReason: "SIGNAL_EXIT", closedAt: at };
    }
  }

  if (at - next.lastValidAt >= TRACKING_LOST_MS) {
    return { ...next, status: "CLOSED", closeReason: "TRACKING_LOST", closedAt: at };
  }
  return next;
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
    openedRound: round.key,
    openedAt: round.at,
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
    lastFiredAt: round.at,
    lastValidAt: round.at,
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
    if (next) {
      out.updated.push({ episode: next, expectedLastEvaluatedAt: ep.lastEvaluatedAt });
      if (next.status === "OPEN") stillOpen.add(k);
      else if (firedBy.has(k)) stillOpen.add(k); // closed this round cannot also re-open in it
    }
  }

  for (const f of round.fired) {
    const k = openKey(f.assetKey, f.type);
    if (stillOpen.has(k) || !f.snapshot.pairAddress) continue;
    stillOpen.add(k);
    out.opened.push(newEpisode(f, round));
  }
  return out;
}
