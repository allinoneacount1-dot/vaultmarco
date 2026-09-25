import type { SnapshotHistory } from "./history";
import { type LiquidityEvent, liquidityEvent } from "./liquidity";
import { type MomentumSignal, earlyMomentum } from "./momentum";
import type { PairSnapshot } from "./pairSnapshot";

export type RadarResult = {
  /** EARLY MOMENTUM signals, strongest volume acceleration first. */
  momentum: MomentumSignal[];
  /** Liquidity events, largest absolute USD move first. */
  risk: LiquidityEvent[];
  /** How many pairs were evaluated this round. */
  universeSize: number;
  /** Epoch ms of the earliest observation in history, or null before the first poll. */
  historySince: number | null;
  observedAt: number;
};

/**
 * Run every signal rule over the latest snapshot of every pair in the
 * universe. Pure: the same snapshots and history always give the same result.
 */
export function computeRadar(
  snapshots: readonly PairSnapshot[],
  history: SnapshotHistory,
  observedAt: number,
): RadarResult {
  const momentum: MomentumSignal[] = [];
  const risk: LiquidityEvent[] = [];

  for (const s of snapshots) {
    const own = history.get(s.key);
    const m = earlyMomentum(s, own);
    if (m) momentum.push(m);
    const e = liquidityEvent(own);
    if (e) risk.push(e);
  }

  momentum.sort((a, b) => b.va.ratio - a.va.ratio);
  risk.sort((a, b) => Math.abs(b.change.deltaUsd) - Math.abs(a.change.deltaUsd));

  return {
    momentum,
    risk,
    universeSize: snapshots.length,
    historySince: history.since,
    observedAt,
  };
}
