import type { SnapshotHistory } from "./history";
import { type LiquidityChange, type LiquidityEvent, liquidityChangeSince } from "./liquidity";
import {
  type BuyPressure,
  type Evidence,
  type MomentumSignal,
  boostChange,
  buyPressure,
  evaluateEvidence,
} from "./momentum";
import { type PaceResult, transactionAcceleration, volumeAcceleration } from "./pace";
import { type PairSnapshot, pairAgeMinutes } from "./pairSnapshot";
import type { RadarResult } from "./radar";
import { EVIDENCE_LOOKBACK_MINUTES, MIN_LIQUIDITY_USD, MIN_PAIR_AGE_MINUTES } from "./thresholds";

/** One gate of the EARLY MOMENTUM rule, with the value it was judged on. */
export type Gate = { value: number | null; min: number; passed: boolean };

/**
 * PAIR INTELLIGENCE — everything the Token Drawer explains about one pair,
 * assembled from the existing signal functions. Nothing here is a new
 * formula: every field is either a raw snapshot value or the output of a
 * function the radar already uses, so the drawer can never disagree with the
 * radar about the same observation.
 */
export type PairIntelligence = {
  key: string;
  snapshot: PairSnapshot;
  /** Pair age at `snapshot.observedAt`, not at render time. */
  ageMinutes: number | null;
  va: PaceResult;
  ta: PaceResult;
  bp: BuyPressure;
  /** The five evidence dimensions, in the radar's fixed order. */
  evidence: Evidence[];
  /** Liquidity movement over the retained lookback (the "liquidity stable" input). */
  liquidityChange: LiquidityChange | null;
  /** Active-boost delta over the retained lookback (the "attention" input). */
  boostDelta: number | null;
  /** EARLY MOMENTUM gates, so the drawer can show why a strong pair did not fire. */
  gates: { liquidity: Gate; age: Gate };
  /** The radar's own EARLY MOMENTUM result for this pair this round, if it fired. */
  momentum: MomentumSignal | null;
  /** The radar's own liquidity event for this pair this round, if one qualified. */
  risk: LiquidityEvent | null;
};

/**
 * Build the intelligence for one snapshot.
 *
 * `history` is the pair's own observations (oldest first, `snapshot` last).
 * `radar` is the radar result of the same round; when it is null (a retained
 * snapshot outside the current universe) no current signal is attached.
 */
export function pairIntelligence(
  snapshot: PairSnapshot,
  history: readonly PairSnapshot[],
  radar: Pick<RadarResult, "momentum" | "risk"> | null,
): PairIntelligence {
  const ageMinutes = pairAgeMinutes(snapshot);
  return {
    key: snapshot.key,
    snapshot,
    ageMinutes,
    va: volumeAcceleration(snapshot),
    ta: transactionAcceleration(snapshot),
    bp: buyPressure(snapshot),
    evidence: evaluateEvidence(snapshot, history),
    liquidityChange: liquidityChangeSince(history, EVIDENCE_LOOKBACK_MINUTES),
    boostDelta: boostChange(history, EVIDENCE_LOOKBACK_MINUTES),
    gates: {
      liquidity: {
        value: snapshot.liquidityUsd,
        min: MIN_LIQUIDITY_USD,
        passed: snapshot.liquidityUsd != null && snapshot.liquidityUsd >= MIN_LIQUIDITY_USD,
      },
      age: {
        value: ageMinutes,
        min: MIN_PAIR_AGE_MINUTES,
        passed: ageMinutes != null && ageMinutes >= MIN_PAIR_AGE_MINUTES,
      },
    },
    momentum: radar?.momentum.find((m) => m.key === snapshot.key) ?? null,
    risk: radar?.risk.find((e) => e.key === snapshot.key) ?? null,
  };
}

/** Intelligence for every snapshot of one universe round, keyed by `chainId:baseAddress`. */
export function buildIntelligence(
  snapshots: readonly PairSnapshot[],
  history: SnapshotHistory,
  radar: Pick<RadarResult, "momentum" | "risk">,
): Record<string, PairIntelligence> {
  const out: Record<string, PairIntelligence> = {};
  for (const s of snapshots) out[s.key] = pairIntelligence(s, history.get(s.key), radar);
  return out;
}
