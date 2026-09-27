import { liquidityChange } from "@/lib/signals/liquidity";
import { type PaceResult, transactionAcceleration, volumeAcceleration } from "@/lib/signals/pace";
import type { AssetObservation } from "./facts";
import { poolSegment } from "./events";
import {
  BOOST_CHANGE_MIN_DELTA,
  DIVERGENCE_ACTIVITY_FLAT_RATIO,
  DIVERGENCE_PRICE_FLAT_M5_PCT,
  DIVERGENCE_RULES,
  type DivergenceId,
  IMBALANCE_MIN_RATIO,
  IMBALANCE_MIN_SAMPLE_TXNS,
  INTELLIGENCE_RULES_VERSION,
  LIQUIDITY_CHANGE_LOOKBACK_MINUTES,
  LIQUIDITY_CHANGE_MIN_ABS_USD,
  LIQUIDITY_CHANGE_MIN_PREVIOUS_USD,
  LIQUIDITY_CHANGE_MIN_REL,
  PRICE_EXPANSION_M5_PCT,
  SESSION_DELTA_MAX_SPAN_MS,
  TXN_ACCELERATION_MIN,
  VOLUME_ACCELERATION_MIN,
} from "./rules";

/**
 * DIVERGENCE — "what doesn't fit?" Pure evaluators of the predicates defined
 * in rules.ts (DIVERGENCE_RULES), on an asset's LATEST observation and its
 * unbroken same-pool session segment.
 *
 *   DIVERGED       every input present and the predicate holds
 *   NOT_DIVERGED   every input present and the predicate does not hold
 *   NOT_EVALUABLE  any required input missing (null field, pace insufficient,
 *                  no comparable same-pool observation) — never false, never 0
 *
 * Labels are direction-neutral ("PRICE / VOLUME · DIVERGED"); no
 * interpretation (no accumulation, no bull/bear) is attached.
 */

export type DivergenceState = "DIVERGED" | "NOT_DIVERGED" | "NOT_EVALUABLE";

export type DivergenceMetric = {
  name: string;
  value: number | null;
  unit: "PCT" | "RATIO" | "USD" | "FRACTION" | "COUNT";
  horizon: string;
};

export type DivergenceResult = {
  id: DivergenceId;
  label: string;
  state: DivergenceState;
  /** Why NOT_EVALUABLE (first missing input), else null. */
  missing: string | null;
  metrics: DivergenceMetric[];
  assetKey: string;
  chainId: string;
  address: string;
  pairAddress: string | null;
  quoteAddress: string | null;
  dexId: string | null;
  /** The latest observation the predicate was evaluated on. */
  observedAt: number;
  /** For session-delta predicates: the earlier real observation compared. */
  priorObservedAt: number | null;
  source: string;
  rulesVersion: string;
};

type Eval = {
  state: DivergenceState;
  missing: string | null;
  metrics: DivergenceMetric[];
  priorObservedAt?: number | null;
};

const ruleOf = (id: DivergenceId) => DIVERGENCE_RULES.find((r) => r.id === id)!;
const horizonOf = (id: DivergenceId, i: number) => ruleOf(id).metrics[i].horizon;
const ratio = (p: PaceResult) => (p.ok ? p.ratio : null);
const paceMissing = (p: PaceResult, what: string) => (p.ok ? null : `${what}: ${p.reason}`);

function verdict(missing: string | null, holds: boolean, metrics: DivergenceMetric[]): Eval {
  if (missing) return { state: "NOT_EVALUABLE", missing, metrics };
  return { state: holds ? "DIVERGED" : "NOT_DIVERGED", missing: null, metrics };
}

const flat = (m5: number) => Math.abs(m5) < DIVERGENCE_PRICE_FLAT_M5_PCT;

const EVALUATORS: Record<DivergenceId, (seg: AssetObservation[]) => Eval> = {
  PRICE_VS_VOLUME: (seg) => {
    const s = seg[seg.length - 1].snapshot;
    const va = volumeAcceleration(s);
    const m5 = s.priceChange.m5;
    const metrics: DivergenceMetric[] = [
      { name: "PRICE CHANGE", value: m5, unit: "PCT", horizon: horizonOf("PRICE_VS_VOLUME", 0) },
      {
        name: "VOLUME ACCELERATION",
        value: ratio(va),
        unit: "RATIO",
        horizon: horizonOf("PRICE_VS_VOLUME", 1),
      },
    ];
    const missing = m5 == null ? "priceChange.m5" : paceMissing(va, "volume pace");
    return verdict(
      missing,
      va.ok && m5 != null && va.ratio >= VOLUME_ACCELERATION_MIN && flat(m5),
      metrics,
    );
  },
  PRICE_VS_TXNS: (seg) => {
    const s = seg[seg.length - 1].snapshot;
    const ta = transactionAcceleration(s);
    const m5 = s.priceChange.m5;
    const metrics: DivergenceMetric[] = [
      { name: "PRICE CHANGE", value: m5, unit: "PCT", horizon: horizonOf("PRICE_VS_TXNS", 0) },
      {
        name: "TXN ACCELERATION",
        value: ratio(ta),
        unit: "RATIO",
        horizon: horizonOf("PRICE_VS_TXNS", 1),
      },
    ];
    const missing = m5 == null ? "priceChange.m5" : paceMissing(ta, "transaction pace");
    return verdict(
      missing,
      ta.ok && m5 != null && ta.ratio >= TXN_ACCELERATION_MIN && flat(m5),
      metrics,
    );
  },
  VOLUME_VS_LIQUIDITY: (seg) => {
    const last = seg[seg.length - 1];
    const va = volumeAcceleration(last.snapshot);
    const c =
      last.pairAddress == null
        ? null
        : liquidityChange(
            seg.map((o) => o.snapshot),
            LIQUIDITY_CHANGE_LOOKBACK_MINUTES,
          );
    const inSpan =
      c != null && c.currentObservedAt - c.previousObservedAt <= SESSION_DELTA_MAX_SPAN_MS;
    const metrics: DivergenceMetric[] = [
      {
        name: "VOLUME ACCELERATION",
        value: ratio(va),
        unit: "RATIO",
        horizon: horizonOf("VOLUME_VS_LIQUIDITY", 0),
      },
      {
        name: "LIQUIDITY CHANGE",
        value: inSpan ? c!.deltaRel : null,
        unit: "FRACTION",
        horizon: horizonOf("VOLUME_VS_LIQUIDITY", 1),
      },
    ];
    const missing =
      paceMissing(va, "volume pace") ??
      (last.snapshot.liquidityUsd == null
        ? "liquidity.usd"
        : !inSpan
          ? "no comparable same-pool liquidity observation"
          : null);
    const holds =
      va.ok &&
      inSpan &&
      va.ratio >= VOLUME_ACCELERATION_MIN &&
      c!.deltaRel <= -LIQUIDITY_CHANGE_MIN_REL &&
      Math.abs(c!.deltaUsd) >= LIQUIDITY_CHANGE_MIN_ABS_USD &&
      c!.previousUsd >= LIQUIDITY_CHANGE_MIN_PREVIOUS_USD;
    return {
      ...verdict(missing, holds, metrics),
      priorObservedAt: inSpan ? c!.previousObservedAt : null,
    };
  },
  BALANCE_VS_PRICE: (seg) => {
    const s = seg[seg.length - 1].snapshot;
    const w = s.txns.m5;
    const m5 = s.priceChange.m5;
    const sample = w ? w.buys + w.sells : null;
    const buyRatio = w ? w.buys / Math.max(w.sells, 1) : null;
    const sellRatio = w ? w.sells / Math.max(w.buys, 1) : null;
    const metrics: DivergenceMetric[] = [
      {
        name: "BUYS / SELLS",
        value: buyRatio,
        unit: "RATIO",
        horizon: horizonOf("BALANCE_VS_PRICE", 0),
      },
      { name: "PRICE CHANGE", value: m5, unit: "PCT", horizon: horizonOf("BALANCE_VS_PRICE", 1) },
    ];
    const missing =
      w == null
        ? "txns.m5"
        : m5 == null
          ? "priceChange.m5"
          : (sample as number) < IMBALANCE_MIN_SAMPLE_TXNS
            ? `txns.m5 sample < ${IMBALANCE_MIN_SAMPLE_TXNS}`
            : null;
    const holds =
      m5 != null &&
      ((buyRatio! >= IMBALANCE_MIN_RATIO && m5 <= -DIVERGENCE_PRICE_FLAT_M5_PCT) ||
        (sellRatio! >= IMBALANCE_MIN_RATIO && m5 >= DIVERGENCE_PRICE_FLAT_M5_PCT));
    return verdict(missing, holds, metrics);
  },
  BOOST_VS_ACTIVITY: (seg) => {
    const last = seg[seg.length - 1];
    const now = last.snapshot.boostsActive;
    let prev: AssetObservation | null = null;
    for (let j = seg.length - 2; j >= 0; j--) {
      if (seg[j].snapshot.boostsActive != null) {
        prev = seg[j];
        break;
      }
    }
    const inSpan = prev != null && last.observedAt - prev.observedAt <= SESSION_DELTA_MAX_SPAN_MS;
    const delta = now != null && inSpan ? now - (prev!.snapshot.boostsActive as number) : null;
    const ta = transactionAcceleration(last.snapshot);
    const metrics: DivergenceMetric[] = [
      {
        name: "ACTIVE BOOSTS CHANGE",
        value: delta,
        unit: "COUNT",
        horizon: horizonOf("BOOST_VS_ACTIVITY", 0),
      },
      {
        name: "TXN ACCELERATION",
        value: ratio(ta),
        unit: "RATIO",
        horizon: horizonOf("BOOST_VS_ACTIVITY", 1),
      },
    ];
    const missing =
      now == null
        ? "boosts.active"
        : delta == null
          ? "no comparable same-pool boosts.active observation"
          : paceMissing(ta, "transaction pace");
    const holds =
      delta != null &&
      ta.ok &&
      delta >= BOOST_CHANGE_MIN_DELTA &&
      ta.ratio <= DIVERGENCE_ACTIVITY_FLAT_RATIO;
    return {
      ...verdict(missing, holds, metrics),
      priorObservedAt: delta != null ? prev!.observedAt : null,
    };
  },
  PRICE_EXPANSION_WITHOUT_VOLUME: (seg) => {
    const s = seg[seg.length - 1].snapshot;
    const va = volumeAcceleration(s);
    const m5 = s.priceChange.m5;
    const metrics: DivergenceMetric[] = [
      {
        name: "PRICE CHANGE",
        value: m5,
        unit: "PCT",
        horizon: horizonOf("PRICE_EXPANSION_WITHOUT_VOLUME", 0),
      },
      {
        name: "VOLUME ACCELERATION",
        value: ratio(va),
        unit: "RATIO",
        horizon: horizonOf("PRICE_EXPANSION_WITHOUT_VOLUME", 1),
      },
    ];
    const missing = m5 == null ? "priceChange.m5" : paceMissing(va, "volume pace");
    const holds =
      va.ok &&
      m5 != null &&
      Math.abs(m5) >= PRICE_EXPANSION_M5_PCT &&
      va.ratio <= DIVERGENCE_ACTIVITY_FLAT_RATIO;
    return verdict(missing, holds, metrics);
  },
};

/** Every divergence predicate on the asset's latest observation. Empty input → []. */
export function evaluateDivergences(obs: readonly AssetObservation[]): DivergenceResult[] {
  if (obs.length === 0) return [];
  const last = obs[obs.length - 1];
  const seg = poolSegment(obs, obs.length - 1);
  return DIVERGENCE_RULES.map((rule) => {
    const e = EVALUATORS[rule.id](seg);
    return {
      id: rule.id,
      label: rule.label,
      state: e.state,
      missing: e.missing,
      metrics: e.metrics,
      assetKey: last.assetKey,
      chainId: last.chainId,
      address: last.address,
      pairAddress: last.pairAddress,
      quoteAddress: last.quoteAddress,
      dexId: last.snapshot.dexId,
      observedAt: last.observedAt,
      priorObservedAt: e.priorObservedAt ?? null,
      source: `${last.provider.toUpperCase()} · ${last.lanes.map((l) => l.toUpperCase()).join(" + ")}`,
      rulesVersion: INTELLIGENCE_RULES_VERSION,
    };
  });
}
