import type { AssetObservation } from "./facts";
import type { DivergenceMetric, DivergenceResult, DivergenceState } from "./divergence";
import { DIVERGENCE_RULES, type DivergenceId, type RuleMeta, ruleMeta } from "./rules";

/**
 * DIVERGENCE VIEW — presentation-ready, deterministic re-statement of the
 * foundation's divergence results (divergence.ts). Nothing here decides
 * whether metrics disagree; it orders the results, formats the real values
 * ("—" for unknown, 0 stays 0), and names the rule thresholds each predicate
 * compared against, read from rules.ts via `ruleMeta` (never restated).
 */

/** Display word per state. NOT_DIVERGED reads "ALIGNED": inputs present, predicate false. */
export const DIVERGENCE_STATE_TEXT: Record<DivergenceState, string> = {
  DIVERGED: "DIVERGED",
  NOT_DIVERGED: "ALIGNED",
  NOT_EVALUABLE: "NOT EVALUABLE",
};

const STATE_ORDER: Record<DivergenceState, number> = {
  DIVERGED: 0,
  NOT_DIVERGED: 1,
  NOT_EVALUABLE: 2,
};

const RULE_INDEX = new Map(DIVERGENCE_RULES.map((r, i) => [r.id, i]));

/** DIVERGED first, then ALIGNED, then NOT EVALUABLE; within a group, rules.ts order. */
export function orderDivergences(results: readonly DivergenceResult[]): DivergenceResult[] {
  return [...results].sort(
    (a, b) =>
      STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
      (RULE_INDEX.get(a.id) ?? 0) - (RULE_INDEX.get(b.id) ?? 0),
  );
}

export type DivergenceSummary = Record<DivergenceState, number> & { total: number };

export function summarizeDivergences(results: readonly DivergenceResult[]): DivergenceSummary {
  const s: DivergenceSummary = { DIVERGED: 0, NOT_DIVERGED: 0, NOT_EVALUABLE: 0, total: 0 };
  for (const r of results) {
    s[r.state]++;
    s.total++;
  }
  return s;
}

/** "PRICE / VOLUME · DIVERGED" → "PRICE / VOLUME" (the state is shown separately). */
export function pairLabel(label: string): string {
  return label.replace(/\s*·\s*DIVERGED$/, "");
}

/* ------------------------------------------------------------------ *
 * Number text — unknown is "—"; a real 0 is rendered as 0
 * ------------------------------------------------------------------ */

const MINUS = "−";
const finite = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);

function signed(n: number, digits: number): string {
  const v = Number(n.toFixed(digits));
  if (v === 0) return (0).toFixed(digits);
  return `${v > 0 ? "+" : MINUS}${Math.abs(v).toFixed(digits)}`;
}

export function pctText(n: number | null | undefined, digits = 2): string {
  return finite(n) ? `${signed(n, digits)}%` : "—";
}

export function ratioText(n: number | null | undefined): string {
  return finite(n) ? `${n.toFixed(n >= 100 ? 0 : 2)}×` : "—";
}

export function usdText(n: number | null | undefined): string {
  if (!finite(n)) return "—";
  const sign = n < 0 ? MINUS : "";
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return `${sign}$${a.toFixed(2)}`;
}

export function countText(n: number | null | undefined, signedCount = false): string {
  if (!finite(n)) return "—";
  if (!signedCount || n === 0) return String(n);
  return `${n > 0 ? "+" : MINUS}${Math.abs(n)}`;
}

/** A metric's value in its own unit. */
export function metricValueText(m: DivergenceMetric): string {
  switch (m.unit) {
    case "PCT":
      return pctText(m.value);
    case "RATIO":
      return ratioText(m.value);
    case "FRACTION":
      return finite(m.value) ? pctText(m.value * 100, 1) : "—";
    case "USD":
      return usdText(m.value);
    case "COUNT":
      return countText(m.value, true);
  }
}

/**
 * Short horizon for the compact line; the full horizon string (rules.ts) is
 * always kept alongside it for the tooltip / screen readers.
 */
export function compactHorizon(h: string): string {
  const u = h.toUpperCase();
  if (u.startsWith("M5 PACE VS (H1 − M5) PACE")) return "PACE · M5 VS H1−M5";
  if (u.startsWith("M5 (PROVIDER WINDOW")) return "M5";
  if (u.startsWith("SESSION DELTA")) return "SESSION Δ · SAME POOL";
  if (u.startsWith("CONSECUTIVE SESSION OBSERVATIONS")) return "SESSION Δ · SAME POOL";
  return u;
}

/** e.g. { value: "−2.80%", horizon: "M5" } or { value: "2.90×", horizon: "PACE · M5 VS H1−M5" }. */
export function metricText(m: DivergenceMetric): {
  name: string;
  value: string;
  horizon: string;
  fullHorizon: string;
} {
  return {
    name: m.name,
    value: metricValueText(m),
    horizon: compactHorizon(m.horizon),
    fullHorizon: m.horizon,
  };
}

/* ------------------------------------------------------------------ *
 * Thresholds each predicate compared against (rules.ts metadata)
 * ------------------------------------------------------------------ */

type ThresholdRef = { ruleId: string; subject: string; op: string };

/**
 * Which rules.ts constants each predicate (DIVERGENCE_RULES[].predicate)
 * references, with the comparison it applies. The VALUES are read from
 * `ruleMeta` at call time; nothing numeric is restated here.
 */
export const DIVERGENCE_THRESHOLD_REFS: Record<DivergenceId, readonly ThresholdRef[]> = {
  PRICE_VS_VOLUME: [
    { ruleId: "VOLUME_ACCELERATION_MIN", subject: "VA", op: "≥" },
    { ruleId: "DIVERGENCE_PRICE_FLAT_M5_PCT", subject: "|PRICE M5|", op: "<" },
  ],
  PRICE_VS_TXNS: [
    { ruleId: "TXN_ACCELERATION_MIN", subject: "TA", op: "≥" },
    { ruleId: "DIVERGENCE_PRICE_FLAT_M5_PCT", subject: "|PRICE M5|", op: "<" },
  ],
  VOLUME_VS_LIQUIDITY: [
    { ruleId: "VOLUME_ACCELERATION_MIN", subject: "VA", op: "≥" },
    { ruleId: "LIQUIDITY_CHANGE_MIN_REL", subject: "LIQ Δ", op: "≤ −" },
    { ruleId: "LIQUIDITY_CHANGE_MIN_ABS_USD", subject: "|LIQ Δ|", op: "≥" },
    { ruleId: "LIQUIDITY_CHANGE_MIN_PREVIOUS_USD", subject: "PREVIOUS LIQ", op: "≥" },
    { ruleId: "LIQUIDITY_CHANGE_LOOKBACK_MINUTES", subject: "COMPARED ≥", op: "" },
    { ruleId: "SESSION_DELTA_MAX_SPAN_MS", subject: "SPAN ≤", op: "" },
  ],
  BALANCE_VS_PRICE: [
    { ruleId: "IMBALANCE_MIN_SAMPLE_TXNS", subject: "M5 TXNS", op: "≥" },
    { ruleId: "IMBALANCE_MIN_RATIO", subject: "ONE SIDE / OTHER", op: "≥" },
    { ruleId: "DIVERGENCE_PRICE_FLAT_M5_PCT", subject: "|PRICE M5| AGAINST IT", op: "≥" },
  ],
  BOOST_VS_ACTIVITY: [
    { ruleId: "BOOST_CHANGE_MIN_DELTA", subject: "ACTIVE BOOSTS Δ", op: "≥ +" },
    { ruleId: "DIVERGENCE_ACTIVITY_FLAT_RATIO", subject: "TA", op: "≤" },
    { ruleId: "SESSION_DELTA_MAX_SPAN_MS", subject: "SPAN ≤", op: "" },
  ],
  PRICE_EXPANSION_WITHOUT_VOLUME: [
    { ruleId: "PRICE_EXPANSION_M5_PCT", subject: "|PRICE M5|", op: "≥" },
    { ruleId: "DIVERGENCE_ACTIVITY_FLAT_RATIO", subject: "VA", op: "≤" },
  ],
};

export function ruleValueText(meta: RuleMeta): string {
  switch (meta.unit) {
    case "PCT":
      return `${meta.value}%`;
    case "RATIO":
      return `${meta.value.toFixed(1)}×`;
    case "FRACTION":
      return `${Math.round(meta.value * 100)}%`;
    case "USD":
      return usdText(meta.value);
    case "MINUTES":
      return `${meta.value} MIN`;
    case "MS":
      return meta.value % 60_000 === 0 ? `${meta.value / 60_000} MIN` : `${meta.value / 1000} S`;
    case "TXNS":
      return `${meta.value} TXNS`;
    case "COUNT":
      return String(meta.value);
    case "MULTIPLE":
      return `${meta.value}×`;
  }
}

export type ThresholdLine = {
  ruleId: string;
  /** e.g. "VA ≥ 3.0×" */
  text: string;
  /** Horizon the rule applies to (rules.ts metadata). */
  horizon: string;
  source: RuleMeta["source"];
};

/** The thresholds + horizons a predicate compared against. Unknown rule ids are skipped. */
export function thresholdLines(id: DivergenceId): ThresholdLine[] {
  const out: ThresholdLine[] = [];
  for (const ref of DIVERGENCE_THRESHOLD_REFS[id]) {
    const meta = ruleMeta(ref.ruleId);
    if (!meta) continue;
    const value = ruleValueText(meta);
    const glue = ref.op.endsWith("−") || ref.op.endsWith("+") ? "" : " ";
    const text = ref.op ? `${ref.subject} ${ref.op}${glue}${value}` : `${ref.subject} ${value}`;
    out.push({
      ruleId: ref.ruleId,
      text,
      horizon: meta.horizon.toUpperCase(),
      source: meta.source,
    });
  }
  return out;
}

/** The overlap / independence note rules.ts attaches to each predicate. */
export function overlapNote(id: DivergenceId): string {
  return DIVERGENCE_RULES.find((r) => r.id === id)?.overlap ?? "";
}

/* ------------------------------------------------------------------ *
 * Raw metrics the predicates read (supporting surface)
 * ------------------------------------------------------------------ */

export type RawMetricRow = {
  /** Provider field path, as named in DIVERGENCE_RULES[].requiredFields. */
  field: string;
  value: string;
  /** The raw number (null = not reported). */
  raw: number | null;
  horizon: string;
  /** Real observation time the value comes from. */
  observedAt: number;
  /** Pool of that observation (evidence, never scope). */
  pairAddress: string | null;
};

/**
 * Every provider field the six predicates read, from the latest observation,
 * plus the earlier same-pool observation a session-delta predicate compared
 * with (only when the foundation reported one: `priorObservedAt`).
 */
export function rawMetricRows(
  observations: readonly AssetObservation[],
  results: readonly DivergenceResult[],
): RawMetricRow[] {
  const last = observations[observations.length - 1];
  if (!last) return [];
  const s = last.snapshot;
  const pool = last.pairAddress;
  const row = (
    field: string,
    raw: number | null,
    value: string,
    horizon: string,
    o: AssetObservation = last,
  ): RawMetricRow => ({
    field,
    raw,
    value,
    horizon,
    observedAt: o.observedAt,
    pairAddress: o.pairAddress,
  });
  const rows: RawMetricRow[] = [
    row("priceChange.m5", s.priceChange.m5, pctText(s.priceChange.m5), "M5"),
    row("volume.m5", s.volume.m5, usdText(s.volume.m5), "M5"),
    row("volume.h1", s.volume.h1, usdText(s.volume.h1), "H1 (CONTAINS M5)"),
    row("txns.m5.buys", s.txns.m5?.buys ?? null, countText(s.txns.m5?.buys), "M5"),
    row("txns.m5.sells", s.txns.m5?.sells ?? null, countText(s.txns.m5?.sells), "M5"),
    row("txns.h1.buys", s.txns.h1?.buys ?? null, countText(s.txns.h1?.buys), "H1 (CONTAINS M5)"),
    row("txns.h1.sells", s.txns.h1?.sells ?? null, countText(s.txns.h1?.sells), "H1 (CONTAINS M5)"),
    row("liquidity.usd", s.liquidityUsd, usdText(s.liquidityUsd), "AT OBSERVATION"),
    row("boosts.active", s.boostsActive, countText(s.boostsActive), "AT OBSERVATION"),
    row(
      "pairCreatedAt",
      s.pairCreatedAt,
      finite(s.pairCreatedAt) ? new Date(s.pairCreatedAt).toISOString().slice(0, 10) : "—",
      "POOL AGE (PACE GATE)",
    ),
  ];
  const prior = (id: DivergenceId, field: string, pick: (o: AssetObservation) => number | null) => {
    const r = results.find((x) => x.id === id);
    if (!r || r.priorObservedAt == null) return;
    const o = observations.find(
      (x) => x.observedAt === r.priorObservedAt && x.pairAddress === pool,
    );
    if (!o) return;
    const v = pick(o);
    rows.push(
      row(
        `${field} (earlier, same pool)`,
        v,
        field === "liquidity.usd" ? usdText(v) : countText(v),
        "SESSION OBSERVATION",
        o,
      ),
    );
  };
  prior("VOLUME_VS_LIQUIDITY", "liquidity.usd", (o) => o.snapshot.liquidityUsd);
  prior("BOOST_VS_ACTIVITY", "boosts.active", (o) => o.snapshot.boostsActive);
  return rows;
}
