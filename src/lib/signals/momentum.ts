import { type PairSnapshot, pairAgeMinutes } from "./pairSnapshot";
import { type PaceResult, transactionAcceleration, volumeAcceleration } from "./pace";
import { liquidityChangeSince } from "./liquidity";
import {
  BOOST_DELTA_MIN,
  BP_MIN,
  BP_MIN_SAMPLE_TXNS,
  EVIDENCE_LOOKBACK_MINUTES,
  LIQUIDITY_STABLE_MAX_DRAWDOWN,
  MIN_LIQUIDITY_USD,
  MIN_PAIR_AGE_MINUTES,
  TA_MIN,
  VA_MIN,
} from "./thresholds";

/**
 * BP — buy pressure over the last five minutes:  m5 buys / max(m5 sells, 1).
 * Not computed at all below BP_MIN_SAMPLE_TXNS transactions — the ratio of a
 * handful of trades is noise, not evidence.
 */
export type BuyPressure =
  | { ok: true; ratio: number; buys: number; sells: number; sample: number }
  | { ok: false; reason: "NO_WINDOW" | "INSUFFICIENT_SAMPLE"; sample: number };

export function buyPressure(s: PairSnapshot): BuyPressure {
  if (!s.txns.m5) return { ok: false, reason: "NO_WINDOW", sample: 0 };
  const { buys, sells } = s.txns.m5;
  const sample = buys + sells;
  if (sample < BP_MIN_SAMPLE_TXNS) return { ok: false, reason: "INSUFFICIENT_SAMPLE", sample };
  return { ok: true, ratio: buys / Math.max(sells, 1), buys, sells, sample };
}

/**
 * One piece of evidence: a named dimension, whether its rule passed, the raw
 * value it was judged on, the threshold it was judged against, and the
 * one-line reason text used when it passes. Nothing is inferred; a dimension
 * whose input is missing is `available: false` and is neither counted nor
 * mentioned.
 */
export type Evidence = {
  dimension: "volume" | "transactions" | "buyers" | "liquidity" | "attention";
  available: boolean;
  passed: boolean;
  value: number | null;
  threshold: number;
  reason: string | null;
  /** Why the dimension was unavailable, when it was. */
  unavailable?: string;
};

export type MomentumSignal = {
  key: string;
  label: "EARLY MOMENTUM";
  /** Number of evidence dimensions that passed, out of the fixed total. */
  evidence: { passed: number; total: number };
  reasons: string[];
  dimensions: Evidence[];
  gates: { liquidityUsd: number; ageMinutes: number };
  va: Extract<PaceResult, { ok: true }>;
  ta: Extract<PaceResult, { ok: true }>;
  bp: Extract<BuyPressure, { ok: true }>;
  observedAt: number;
};

export const EVIDENCE_TOTAL = 5;

const x = (n: number) => `${n.toFixed(1)}×`;

/**
 * Evaluate every evidence dimension for the latest snapshot of a pair.
 * `history` is the pair's own observations (oldest first, latest last) and is
 * only used for the liquidity-stable and attention dimensions.
 */
export function evaluateEvidence(s: PairSnapshot, history: readonly PairSnapshot[]): Evidence[] {
  const va = volumeAcceleration(s);
  const ta = transactionAcceleration(s);
  const bp = buyPressure(s);

  const volume: Evidence = va.ok
    ? {
        dimension: "volume",
        available: true,
        passed: va.ratio >= VA_MIN,
        value: va.ratio,
        threshold: VA_MIN,
        reason: `Volume ${x(va.ratio)} previous pace`,
      }
    : {
        dimension: "volume",
        available: false,
        passed: false,
        value: null,
        threshold: VA_MIN,
        reason: null,
        unavailable: va.reason,
      };

  const transactions: Evidence = ta.ok
    ? {
        dimension: "transactions",
        available: true,
        passed: ta.ratio >= TA_MIN,
        value: ta.ratio,
        threshold: TA_MIN,
        reason: `Transactions ${x(ta.ratio)}`,
      }
    : {
        dimension: "transactions",
        available: false,
        passed: false,
        value: null,
        threshold: TA_MIN,
        reason: null,
        unavailable: ta.reason,
      };

  const buyers: Evidence = bp.ok
    ? {
        dimension: "buyers",
        available: true,
        passed: bp.ratio >= BP_MIN,
        value: bp.ratio,
        threshold: BP_MIN,
        reason: `Buyers ${bp.ratio.toFixed(1)}:1`,
      }
    : {
        dimension: "buyers",
        available: false,
        passed: false,
        value: null,
        threshold: BP_MIN,
        reason: null,
        unavailable: bp.reason,
      };

  const lc = liquidityChangeSince(history, EVIDENCE_LOOKBACK_MINUTES);
  const liquidity: Evidence = lc
    ? {
        dimension: "liquidity",
        available: true,
        passed: lc.deltaRel >= -LIQUIDITY_STABLE_MAX_DRAWDOWN,
        value: lc.deltaRel,
        threshold: -LIQUIDITY_STABLE_MAX_DRAWDOWN,
        reason: "Liquidity stable",
      }
    : {
        dimension: "liquidity",
        available: false,
        passed: false,
        value: null,
        threshold: -LIQUIDITY_STABLE_MAX_DRAWDOWN,
        reason: null,
        unavailable: "INSUFFICIENT_HISTORY",
      };

  const boostDelta = boostChange(history, EVIDENCE_LOOKBACK_MINUTES);
  const attention: Evidence =
    boostDelta != null
      ? {
          dimension: "attention",
          available: true,
          passed: boostDelta >= BOOST_DELTA_MIN,
          value: boostDelta,
          threshold: BOOST_DELTA_MIN,
          reason: `Boost +${boostDelta}`,
        }
      : {
          dimension: "attention",
          available: false,
          passed: false,
          value: null,
          threshold: BOOST_DELTA_MIN,
          reason: null,
          unavailable: "INSUFFICIENT_HISTORY",
        };

  return [volume, transactions, buyers, liquidity, attention];
}

/** Active-boost delta between the latest snapshot and the oldest one within the lookback. */
export function boostChange(
  history: readonly PairSnapshot[],
  lookbackMinutes: number,
): number | null {
  if (history.length < 2) return null;
  const current = history[history.length - 1];
  if (current.boostsActive == null) return null;
  const cutoff = current.observedAt - lookbackMinutes * 60_000;
  const oldest = history.find((s) => s.observedAt >= cutoff && s.boostsActive != null);
  if (!oldest || oldest === current) return null;
  return current.boostsActive - (oldest.boostsActive as number);
}

/**
 * EARLY MOMENTUM — deterministic rule. Fires only when ALL of these hold:
 *   VA ≥ VA_MIN, TA ≥ TA_MIN, BP ≥ BP_MIN (with the sample guard),
 *   liquidity ≥ MIN_LIQUIDITY_USD, age ≥ MIN_PAIR_AGE_MINUTES,
 *   and liquidity has NOT fallen more than LIQUIDITY_STABLE_MAX_DRAWDOWN over
 *   the lookback when that history exists.
 * The reasons list contains exactly the dimensions that passed — a dimension
 * that failed or was unavailable is never mentioned.
 */
export function earlyMomentum(
  s: PairSnapshot,
  history: readonly PairSnapshot[],
): MomentumSignal | null {
  const age = pairAgeMinutes(s);
  if (age == null || age < MIN_PAIR_AGE_MINUTES) return null;
  if (s.liquidityUsd == null || s.liquidityUsd < MIN_LIQUIDITY_USD) return null;

  const dimensions = evaluateEvidence(s, history);
  const by = (d: Evidence["dimension"]) => dimensions.find((e) => e.dimension === d)!;

  if (!by("volume").passed || !by("transactions").passed || !by("buyers").passed) return null;
  const liquidity = by("liquidity");
  if (liquidity.available && !liquidity.passed) return null;

  const va = volumeAcceleration(s);
  const ta = transactionAcceleration(s);
  const bp = buyPressure(s);
  if (!va.ok || !ta.ok || !bp.ok) return null;

  const passed = dimensions.filter((d) => d.passed);
  return {
    key: s.key,
    label: "EARLY MOMENTUM",
    evidence: { passed: passed.length, total: EVIDENCE_TOTAL },
    reasons: passed.map((d) => d.reason as string),
    dimensions,
    gates: { liquidityUsd: s.liquidityUsd, ageMinutes: age },
    va,
    ta,
    bp,
    observedAt: s.observedAt,
  };
}
