import type { PairUniverse, RadarStatus } from "@/lib/providers/universe";
import type { SnapshotHistory } from "@/lib/signals/history";
import { liquidityChange } from "@/lib/signals/liquidity";
import { LIQUIDITY_EVENT_LOOKBACK_MINUTES } from "@/lib/signals/thresholds";
import type { ObservationClass, SignalType } from "./model";

/**
 * ROUND CLASSIFICATION — what one round tells us about one (asset, type).
 *
 * The existing engine is the only authority on whether a signal fired: FIRED
 * comes solely from `radar.momentum` / `radar.risk`. The engine returns `null`
 * both for "evaluated and false" and "could not be evaluated", so this module
 * separates those by reading fields the engine ALREADY produced (PairIntelligence
 * pace/buy-pressure results and gates) or by calling the engine's own
 * `liquidityChange` — it never re-implements a rule.
 *
 *   FIRED           the engine emitted the signal this round
 *   VALID_NEGATIVE  the rule was fully evaluable on this round's data and did not fire
 *   NO_DATA         anything else: non-usable round, pair absent, inputs insufficient
 */

/** Rounds whose observations may move an episode. */
export function isUsableRound(status: RadarStatus | "failed"): boolean {
  return status === "live" || status === "degraded";
}

export type RoundView = {
  status: RadarStatus | "failed";
  universe: PairUniverse | null;
  history: SnapshotHistory;
};

export function classify(round: RoundView, assetKey: string, type: SignalType): ObservationClass {
  const u = round.universe;
  if (!isUsableRound(round.status) || !u) return "NO_DATA";

  if (type === "EARLY_MOMENTUM") {
    if (u.radar.momentum.some((m) => m.key === assetKey)) return "FIRED";
  } else {
    const direction = type === "LIQUIDITY_ADDED" ? "ADDED" : "REMOVED";
    if (u.radar.risk.some((e) => e.key === assetKey && e.direction === direction)) return "FIRED";
  }

  const intel = u.intelligence[assetKey];
  if (!intel) return "NO_DATA"; // pair not observed this round

  if (type === "EARLY_MOMENTUM") {
    const { liquidity, age } = intel.gates;
    // A gate that failed on a REAL value is a decided negative.
    if (liquidity.value != null && !liquidity.passed) return "VALID_NEGATIVE";
    if (age.value != null && !age.passed) return "VALID_NEGATIVE";
    // Gates unknown → the rule could not be evaluated.
    if (liquidity.value == null || age.value == null) return "NO_DATA";
    // Every required rule input must have been computable.
    if (!intel.va.ok || !intel.ta.ok || !intel.bp.ok) return "NO_DATA";
    return "VALID_NEGATIVE";
  }

  // Liquidity events: evaluable exactly when the engine's own comparison exists.
  const change = liquidityChange(round.history.get(assetKey), LIQUIDITY_EVENT_LOOKBACK_MINUTES);
  return change ? "VALID_NEGATIVE" : "NO_DATA";
}
