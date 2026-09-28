import { formatNumber } from "@/components/marco/shared/helpers";
import { signedPct } from "@/lib/format";
import { type QueueRow, queueRow, qualifiesForQueue, sortQueue } from "./changeQueue";
import { type Collision, collisionFamilies } from "./collision";
import type { DivergenceResult, DivergenceState } from "./divergence";
import { edgeClockOrigin } from "./edgeClock";
import {
  type EventDirection,
  type EventType,
  type EvidenceEvent,
  STRUCTURAL_TYPES,
  assetEvents,
} from "./events";
import type { AssetTrack, SessionState } from "./facts";
import { type RuleMeta, ruleMeta } from "./rules";

/**
 * THE MOMENT — "what just changed?" for ONE asset.
 *
 * Pure composition over the foundation: nothing here detects, thresholds or
 * windows anything. Events come from events.ts, the Edge Clock origin from
 * edgeClock.ts, divergences from divergence.ts, the collision from
 * collision.ts and the picker order from changeQueue.ts. This module only
 * selects, groups and words what those return, so The Moment can never
 * disagree with the full pages it links to.
 *
 * The one constant below is a DISPLAY length (how many rows a compact
 * summary shows), not a rule: it never decides whether something qualifies.
 */

/** Rows shown in the compact WHAT MOVED FIRST summary (display only). */
export const MOMENT_FIRST_MOVES = 5;
/** Assets offered by the no-selection quick picker (display only). */
export const MOMENT_PICKER_SIZE = 6;

/* ------------------------------------------------------------------ *
 * Which rule produced an event (threshold + horizon come from rules.ts)
 * ------------------------------------------------------------------ */

/**
 * The rules.ts ids each event type is evaluated with, primary first. Radar
 * firings use the Alpha Radar's own deterministic rule (recorded as it fired),
 * discovery and provider events use no threshold: they map to no rule.
 */
export const EVENT_RULE_IDS: Record<EventType, readonly string[]> = {
  PRICE_EXPANSION: ["PRICE_EXPANSION_M5_PCT"],
  VOLUME_ACCELERATION: ["VOLUME_ACCELERATION_MIN"],
  TXN_ACCELERATION: ["TXN_ACCELERATION_MIN"],
  BUY_SELL_IMBALANCE: ["IMBALANCE_MIN_RATIO", "IMBALANCE_MIN_SAMPLE_TXNS"],
  LIQUIDITY_CHANGE: [
    "LIQUIDITY_CHANGE_MIN_REL",
    "LIQUIDITY_CHANGE_MIN_ABS_USD",
    "LIQUIDITY_CHANGE_MIN_PREVIOUS_USD",
    "LIQUIDITY_CHANGE_LOOKBACK_MINUTES",
  ],
  BOOST_CHANGE: ["BOOST_CHANGE_MIN_DELTA"],
  PAIR_DISCOVERED: [],
  MOMENTUM_FIRED: [],
  RISK_FIRED: [],
  PROVIDER_RECOVERED: [],
  PROVIDER_STALE: [],
};

export function eventRules(type: EventType): RuleMeta[] {
  return EVENT_RULE_IDS[type].map((id) => ruleMeta(id)).filter((r): r is RuleMeta => r != null);
}

/** "≥ 3%", "≥ 1.5×", "≥ $10K", "≥ 10%" (fraction), "≥ 5 MIN", "≥ 8 TXNS". */
export function ruleThresholdText(r: RuleMeta): string {
  const v = r.value;
  switch (r.unit) {
    case "PCT":
      return `≥ ${v}%`;
    case "RATIO":
      return `≥ ${v}×`;
    case "USD":
      return `≥ ${formatNumber(v)}`;
    case "FRACTION":
      return `≥ ${+(v * 100).toFixed(4)}%`;
    case "COUNT":
      return `≥ ${v}`;
    case "TXNS":
      return `≥ ${v} TXNS`;
    case "MINUTES":
      return `≥ ${v} MIN`;
    case "MS":
      return `${v / 1000} S`;
    case "MULTIPLE":
      return `${v}×`;
  }
}

/* ------------------------------------------------------------------ *
 * WHAT CHANGED — the main instrument
 * ------------------------------------------------------------------ */

/**
 * The asset's currently active evidence: market-structure events (the
 * evidence-supported STRUCTURAL_TYPES) still true at its latest observation.
 * Newest onset first; ties by the foundation's id. Discovery and provider
 * state are not "changes" of the asset and are never listed here.
 */
export function activeChanges(events: readonly EvidenceEvent[]): EvidenceEvent[] {
  return events
    .filter((e) => e.active && STRUCTURAL_TYPES.has(e.type))
    .sort((a, b) => b.observedAt - a.observedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export const TYPE_TEXT: Record<EventType, string> = {
  PRICE_EXPANSION: "PRICE EXPANSION",
  VOLUME_ACCELERATION: "VOLUME ACCELERATION",
  TXN_ACCELERATION: "TXN ACCELERATION",
  BUY_SELL_IMBALANCE: "BUY/SELL IMBALANCE",
  LIQUIDITY_CHANGE: "LIQUIDITY CHANGE",
  BOOST_CHANGE: "BOOST CHANGE",
  PAIR_DISCOVERED: "PAIR DISCOVERED",
  MOMENTUM_FIRED: "RADAR MOMENTUM FIRED",
  RISK_FIRED: "RADAR RISK FIRED",
  PROVIDER_RECOVERED: "PROVIDER RECOVERED",
  PROVIDER_STALE: "PROVIDER STALE",
};

/**
 * Direction in words (never colour alone). Imbalance is worded as a count
 * comparison so it can never read as an instruction to buy or sell.
 */
export function directionText(type: EventType, dir: EventDirection): string {
  if (dir == null) return "—";
  if (type === "BUY_SELL_IMBALANCE") return dir === "BUY" ? "BUYS > SELLS" : "SELLS > BUYS";
  if (type === "LIQUIDITY_CHANGE" || type === "RISK_FIRED") {
    return dir === "ADDED" ? "LIQUIDITY ADDED" : "LIQUIDITY REMOVED";
  }
  return dir;
}

/** Arrow glyph that accompanies the direction text. */
export function directionGlyph(dir: EventDirection): string {
  if (dir === "UP" || dir === "ADDED" || dir === "BUY") return "▲";
  if (dir === "DOWN" || dir === "REMOVED" || dir === "SELL") return "▼";
  return "·";
}

export const ONSET_TEXT: Record<EvidenceEvent["onset"], string> = {
  OBSERVED: "ONSET OBSERVED",
  IN_PROGRESS_WHEN_OBSERVED: "IN PROGRESS WHEN OBSERVED",
};

const ratio = (n: number) => `${n.toFixed(2)}×`;
const count = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

/** The event's own value in its unit; unknown is "—", a real 0 stays 0. */
export function eventValueText(e: Pick<EvidenceEvent, "unit" | "value">): string {
  const v = e.value;
  if (v == null || !Number.isFinite(v)) return "—";
  switch (e.unit) {
    case "PCT":
      return signedPct(v, 2);
    case "RATIO":
      return ratio(v);
    case "USD":
      return formatNumber(v);
    case "COUNT":
      return count(v);
    default:
      return String(v);
  }
}

type Fmt = "pct" | "usd" | "ratio" | "count" | "min" | "frac" | "time" | "text";

/** Label + format of the raw evidence keys events.ts records. */
const EVIDENCE_KEYS: Record<string, { label: string; fmt: Fmt }> = {
  priceChangeM5: { label: "PRICE Δ M5", fmt: "pct" },
  priceUsd: { label: "PRICE", fmt: "usd" },
  volumeM5: { label: "VOLUME M5", fmt: "usd" },
  volumeH1: { label: "VOLUME H1", fmt: "usd" },
  recentPerMinute: { label: "M5 PACE / MIN", fmt: "usd" },
  previousPerMinute: { label: "PREVIOUS PACE / MIN", fmt: "usd" },
  previousMinutes: { label: "PREVIOUS SPAN", fmt: "min" },
  txnsM5: { label: "TXNS M5", fmt: "count" },
  txnsPrevious: { label: "TXNS PREVIOUS SPAN", fmt: "count" },
  buysM5: { label: "BUYS M5", fmt: "count" },
  sellsM5: { label: "SELLS M5", fmt: "count" },
  sample: { label: "SAMPLE", fmt: "count" },
  prior: { label: "PRIOR", fmt: "text" },
  priorObservedAt: { label: "PRIOR OBSERVED", fmt: "time" },
  deltaUsd: { label: "Δ USD", fmt: "usd" },
  deltaRel: { label: "Δ REL", fmt: "frac" },
  spanMinutes: { label: "SPAN", fmt: "min" },
  delta: { label: "Δ", fmt: "count" },
  severity: { label: "SEVERITY", fmt: "text" },
  reasons: { label: "RADAR REASONS", fmt: "text" },
};

/** Keys never shown as numeric evidence (identity/time handled elsewhere). */
const HIDDEN_KEYS = new Set(["priorObservedAt"]);

export type EvidenceLine = {
  key: string;
  label: string;
  text: string;
  raw: number | string | null;
};

/**
 * The event's numeric evidence as display lines, in the order events.ts
 * recorded it. A null stays "—"; a real 0 is printed as 0. `clock` renders
 * timestamps (the caller's locale clock).
 */
export function evidenceLines(e: EvidenceEvent): EvidenceLine[] {
  const out: EvidenceLine[] = [];
  for (const [key, raw] of Object.entries(e.evidence)) {
    if (HIDDEN_KEYS.has(key)) continue;
    const spec = EVIDENCE_KEYS[key] ?? { label: key.toUpperCase(), fmt: "text" as Fmt };
    let text: string;
    if (raw == null || (typeof raw === "number" && !Number.isFinite(raw))) text = "—";
    else if (typeof raw === "string") text = raw;
    else {
      // PRIOR takes the event's own unit.
      const fmt = key === "prior" ? unitFmt(e.unit) : spec.fmt;
      text = formatRaw(raw, fmt);
    }
    out.push({ key, label: spec.label, text, raw });
  }
  return out;
}

function unitFmt(u: EvidenceEvent["unit"]): Fmt {
  return u === "PCT" ? "pct" : u === "USD" ? "usd" : u === "RATIO" ? "ratio" : "count";
}

function formatRaw(n: number, fmt: Fmt): string {
  switch (fmt) {
    case "pct":
      return signedPct(n, 2);
    case "usd":
      return formatNumber(n);
    case "ratio":
      return ratio(n);
    case "count":
      return count(n);
    case "min":
      return `${+n.toFixed(1)} MIN`;
    case "frac":
      return signedPct(n * 100, 1);
    default:
      return String(n);
  }
}

/* ------------------------------------------------------------------ *
 * Supporting column — compact summaries (foundation helpers only)
 * ------------------------------------------------------------------ */

/** WHAT MOVED FIRST: the earliest market events retained this session, chronological. */
export function firstMoves(
  events: readonly EvidenceEvent[],
  n: number = MOMENT_FIRST_MOVES,
): EvidenceEvent[] {
  // events arrive in the foundation's chronological order (compareEvents).
  return events.filter(qualifiesForQueue).slice(0, Math.max(0, n));
}

export type EdgeSummary =
  | { kind: "ORIGIN"; origin: EvidenceEvent; ageMs: number }
  | { kind: "NONE" };

/** EDGE AGE: the Edge Clock origin and its age at `now` (ages only, never an observation time). */
export function edgeSummary(events: readonly EvidenceEvent[], now: number): EdgeSummary {
  const origin = edgeClockOrigin(events);
  if (!origin) return { kind: "NONE" };
  return { kind: "ORIGIN", origin, ageMs: Math.max(0, now - origin.observedAt) };
}

export type DivergenceSummary = {
  counts: Record<DivergenceState, number>;
  /** Every predicate in rules.ts order, with its state (NOT_EVALUABLE included). */
  rows: Array<Pick<DivergenceResult, "id" | "label" | "state" | "missing">>;
};

/** DIVERGENCES: counts and per-predicate states from evaluateDivergences(). */
export function divergenceSummary(results: readonly DivergenceResult[]): DivergenceSummary {
  const counts: Record<DivergenceState, number> = {
    DIVERGED: 0,
    NOT_DIVERGED: 0,
    NOT_EVALUABLE: 0,
  };
  for (const r of results) counts[r.state]++;
  return {
    counts,
    rows: results.map((r) => ({ id: r.id, label: r.label, state: r.state, missing: r.missing })),
  };
}

/** COLLISION: the foundation's family count over the rules window (COLLISION_WINDOW_MS). */
export function collisionSummary(events: readonly EvidenceEvent[]): Collision | null {
  return collisionFamilies(events);
}

/* ------------------------------------------------------------------ *
 * No-selection quick picker
 * ------------------------------------------------------------------ */

export type PickerRow = QueueRow & { symbol: string | null };

/**
 * Observed assets that have at least one real qualifying event, ordered by
 * the NEWEST observed event (the Change Queue's NEWEST order — never a
 * score). Symbol is the provider-reported label only; identity stays chain +
 * address.
 */
export function pickerRows(
  tracks: ReadonlyMap<string, AssetTrack>,
  lanes: SessionState["lanes"],
  n: number = MOMENT_PICKER_SIZE,
): PickerRow[] {
  const rows: PickerRow[] = [];
  for (const track of tracks.values()) {
    const row = queueRow(assetEvents(track, lanes));
    if (!row) continue;
    const latest = track.observations[track.observations.length - 1];
    rows.push({ ...row, symbol: latest?.snapshot.baseSymbol ?? null });
  }
  // sortQueue keeps the row objects, so the provider symbol travels with each row.
  return (sortQueue(rows, "NEWEST") as PickerRow[]).slice(0, Math.max(0, n));
}
