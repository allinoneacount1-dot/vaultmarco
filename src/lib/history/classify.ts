import type { PairUniverse, RadarStatus } from "@/lib/providers/universe";
import type { SnapshotHistory } from "@/lib/signals/history";
import { liquidityChange } from "@/lib/signals/liquidity";
import { LIQUIDITY_EVENT_LOOKBACK_MINUTES } from "@/lib/signals/thresholds";
import type { Observation, SignalType } from "./model";

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
 *
 * Each FIRED / VALID_NEGATIVE carries the REAL time of the evidence the engine
 * evaluated, read from the engine's own output — never the scheduled minute:
 *   momentum   the evaluated snapshot's `observedAt` (MomentumSignal / PairIntelligence)
 *   liquidity  the comparison's `currentObservedAt` (LiquidityEvent / liquidityChange)
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

const NO_DATA: Observation = { class: "NO_DATA", observedAt: null };
const fired = (observedAt: number): Observation => ({ class: "FIRED", observedAt });
const negative = (observedAt: number): Observation => ({ class: "VALID_NEGATIVE", observedAt });

export function classify(round: RoundView, assetKey: string, type: SignalType): Observation {
  const u = round.universe;
  if (!isUsableRound(round.status) || !u) return NO_DATA;

  if (type === "EARLY_MOMENTUM") {
    const m = u.radar.momentum.find((s) => s.key === assetKey);
    if (m) return fired(m.observedAt);
  } else {
    const direction = type === "LIQUIDITY_ADDED" ? "ADDED" : "REMOVED";
    const e = u.radar.risk.find((r) => r.key === assetKey && r.direction === direction);
    if (e) return fired(e.change.currentObservedAt);
  }

  const intel = u.intelligence[assetKey];
  if (!intel) return NO_DATA; // pair not observed this round

  if (type === "EARLY_MOMENTUM") {
    const at = intel.snapshot.observedAt;
    const { liquidity, age } = intel.gates;
    // A gate that failed on a REAL value is a decided negative.
    if (liquidity.value != null && !liquidity.passed) return negative(at);
    if (age.value != null && !age.passed) return negative(at);
    // Gates unknown → the rule could not be evaluated.
    if (liquidity.value == null || age.value == null) return NO_DATA;
    // Every required rule input must have been computable.
    if (!intel.va.ok || !intel.ta.ok || !intel.bp.ok) return NO_DATA;
    return negative(at);
  }

  // Liquidity events: evaluable exactly when the engine's own comparison exists.
  const change = liquidityChange(round.history.get(assetKey), LIQUIDITY_EVENT_LOOKBACK_MINUTES);
  return change ? negative(change.currentObservedAt) : NO_DATA;
}
