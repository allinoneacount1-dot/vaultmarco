import type { PairSnapshot } from "./pairSnapshot";
import {
  LIQUIDITY_EVENT_HIGH_ABS_USD,
  LIQUIDITY_EVENT_HIGH_REL,
  LIQUIDITY_EVENT_LOOKBACK_MINUTES,
  LIQUIDITY_EVENT_MIN_ABS_USD,
  LIQUIDITY_EVENT_MIN_PREVIOUS_USD,
  LIQUIDITY_EVENT_MIN_REL,
} from "./thresholds";

/**
 * LV — liquidity velocity between two observations of the same pair.
 *
 *   deltaUsd = now − previous
 *   deltaRel = deltaUsd / previous
 *
 * Both are reported because a percentage alone cannot tell a $500 pool from a
 * $500K pool.
 */
export type LiquidityChange = {
  previousUsd: number;
  currentUsd: number;
  deltaUsd: number;
  deltaRel: number;
  /** Minutes between the two observations. */
  spanMinutes: number;
  previousObservedAt: number;
  currentObservedAt: number;
};

/**
 * Compare the latest snapshot against the newest snapshot that is at least
 * `lookbackMinutes` older. Returns null when there is no such snapshot yet or
 * either side has no liquidity figure.
 */
export function liquidityChange(
  history: readonly PairSnapshot[],
  lookbackMinutes: number,
): LiquidityChange | null {
  if (history.length < 2) return null;
  const current = history[history.length - 1];
  if (current.liquidityUsd == null) return null;

  const cutoff = current.observedAt - lookbackMinutes * 60_000;
  let previous: PairSnapshot | null = null;
  for (let i = history.length - 2; i >= 0; i--) {
    const s = history[i];
    if (s.observedAt <= cutoff && s.liquidityUsd != null) {
      previous = s;
      break;
    }
  }
  if (!previous || previous.liquidityUsd == null || previous.liquidityUsd <= 0) return null;

  const deltaUsd = current.liquidityUsd - previous.liquidityUsd;
  return {
    previousUsd: previous.liquidityUsd,
    currentUsd: current.liquidityUsd,
    deltaUsd,
    deltaRel: deltaUsd / previous.liquidityUsd,
    spanMinutes: (current.observedAt - previous.observedAt) / 60_000,
    previousObservedAt: previous.observedAt,
    currentObservedAt: current.observedAt,
  };
}

/**
 * Compare the latest snapshot against the OLDEST snapshot within the last
 * `lookbackMinutes` — "how has liquidity moved over the history we have",
 * used by the momentum rule's liquidity-stable evidence. Returns null with
 * fewer than two usable observations.
 */
export function liquidityChangeSince(
  history: readonly PairSnapshot[],
  lookbackMinutes: number,
): LiquidityChange | null {
  if (history.length < 2) return null;
  const current = history[history.length - 1];
  if (current.liquidityUsd == null) return null;
  const cutoff = current.observedAt - lookbackMinutes * 60_000;
  const previous = history.find(
    (s) => s !== current && s.observedAt >= cutoff && s.liquidityUsd != null,
  );
  if (!previous || previous.liquidityUsd == null || previous.liquidityUsd <= 0) return null;
  const deltaUsd = current.liquidityUsd - previous.liquidityUsd;
  return {
    previousUsd: previous.liquidityUsd,
    currentUsd: current.liquidityUsd,
    deltaUsd,
    deltaRel: deltaUsd / previous.liquidityUsd,
    spanMinutes: (current.observedAt - previous.observedAt) / 60_000,
    previousObservedAt: previous.observedAt,
    currentObservedAt: current.observedAt,
  };
}

export type LiquiditySeverity = "HIGH" | "MEDIUM";

export type LiquidityEvent = {
  key: string;
  direction: "REMOVED" | "ADDED";
  severity: LiquiditySeverity;
  change: LiquidityChange;
  /** The rule inputs that qualified this event, for traceability. */
  rule: {
    minRel: number;
    minAbsUsd: number;
    minPreviousUsd: number;
    highRel: number;
    highAbsUsd: number;
  };
};

/**
 * LIQUIDITY EVENT rule. Qualifies only when ALL hold:
 *   |deltaRel| ≥ LIQUIDITY_EVENT_MIN_REL
 *   |deltaUsd| ≥ LIQUIDITY_EVENT_MIN_ABS_USD
 *   previousUsd ≥ LIQUIDITY_EVENT_MIN_PREVIOUS_USD
 * Severity is HIGH when |deltaRel| ≥ LIQUIDITY_EVENT_HIGH_REL AND
 * |deltaUsd| ≥ LIQUIDITY_EVENT_HIGH_ABS_USD, else MEDIUM.
 */
export function liquidityEvent(history: readonly PairSnapshot[]): LiquidityEvent | null {
  const change = liquidityChange(history, LIQUIDITY_EVENT_LOOKBACK_MINUTES);
  if (!change) return null;
  const absRel = Math.abs(change.deltaRel);
  const absUsd = Math.abs(change.deltaUsd);
  if (
    absRel < LIQUIDITY_EVENT_MIN_REL ||
    absUsd < LIQUIDITY_EVENT_MIN_ABS_USD ||
    change.previousUsd < LIQUIDITY_EVENT_MIN_PREVIOUS_USD
  ) {
    return null;
  }
  const severity: LiquiditySeverity =
    absRel >= LIQUIDITY_EVENT_HIGH_REL && absUsd >= LIQUIDITY_EVENT_HIGH_ABS_USD
      ? "HIGH"
      : "MEDIUM";
  return {
    key: history[history.length - 1].key,
    direction: change.deltaUsd < 0 ? "REMOVED" : "ADDED",
    severity,
    change,
    rule: {
      minRel: LIQUIDITY_EVENT_MIN_REL,
      minAbsUsd: LIQUIDITY_EVENT_MIN_ABS_USD,
      minPreviousUsd: LIQUIDITY_EVENT_MIN_PREVIOUS_USD,
      highRel: LIQUIDITY_EVENT_HIGH_REL,
      highAbsUsd: LIQUIDITY_EVENT_HIGH_ABS_USD,
    },
  };
}
