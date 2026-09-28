import { signedPct } from "@/lib/format";
import { edgeClockOrigin, firstObservedStructuralChange } from "./edgeClock";
import type { SinceMetric } from "./edgeClock";
import {
  type EventDirection,
  type EventFamily,
  type EventType,
  type EvidenceEvent,
  STRUCTURAL_TYPES,
  compareEvents,
  isLaneOnly,
} from "./events";
import type { AssetObservation, AssetTrack } from "./facts";
import { ageLabel } from "./freshness";
import { EVENT_RULE_IDS, EVENT_RULE_SUBJECT, TRACE_WINDOW_RULE_IDS } from "./ruleRefs";
import { type RuleMeta, TRACE_WINDOWS_MS, ruleMeta } from "./rules";

/**
 * VAULT TRACE + EDGE CLOCK page cores — "what moved first?" and "how old is
 * this move?" as pure functions over one asset's session track and its
 * evidence events (events.ts). No clock is read here: every time is a real
 * observation time from the track; the caller passes nothing but data.
 *
 * Wording is chronology only. The tape orders onsets in observed time; it
 * never says one change led to another. "OBSERVED BEFORE" is the strongest
 * relation used anywhere.
 */

/* ------------------------------------------------------------------ *
 * Windows (5M / 15M / 1H / SESSION) — TRACE_WINDOW_*_MS metadata in rules.ts
 * ------------------------------------------------------------------ */

export type TraceWindowId = keyof typeof TRACE_WINDOWS_MS | "SESSION";

export const TRACE_WINDOW_IDS: readonly TraceWindowId[] = ["5M", "15M", "1H", "SESSION"];

export type TraceWindowOption = {
  id: TraceWindowId;
  /** Window length; null for SESSION (everything retained). */
  ms: number | null;
  enabled: boolean;
  /** Why it is disabled (honest, measured), else null. */
  reason: string | null;
};

/** The asset's retained observation span: first retained → latest observation. */
export type HistorySpan = { from: number; to: number; spanMs: number };

export function historySpan(track: AssetTrack | null | undefined): HistorySpan | null {
  const obs = track?.observations;
  if (!obs || obs.length === 0) return null;
  const from = obs[0].observedAt;
  const to = obs[obs.length - 1].observedAt;
  return { from, to, spanMs: to - from };
}

/**
 * A fixed window is offered only when the session history of this asset
 * actually spans it (first retained observation to latest ≥ the window).
 * SESSION is offered as soon as one observation exists.
 */
/** A fixed window's length, read from the rules.ts metadata (TRACE_WINDOW_*_MS). */
export function traceWindowMs(id: TraceWindowId): number | null {
  if (id === "SESSION") return null;
  return ruleMeta(TRACE_WINDOW_RULE_IDS[id])?.value ?? null;
}

export function traceWindows(span: HistorySpan | null): TraceWindowOption[] {
  return TRACE_WINDOW_IDS.map((id) => {
    const ms = traceWindowMs(id);
    if (span == null) {
      return { id, ms, enabled: false, reason: "NO OBSERVATION OF THIS ASSET THIS SESSION" };
    }
    if (ms == null || span.spanMs >= ms) return { id, ms, enabled: true, reason: null };
    return {
      id,
      ms,
      enabled: false,
      reason: `OBSERVED HISTORY OF THIS ASSET SPANS ${ageLabel(span.spanMs)}`,
    };
  });
}

/** The selected window if it is enabled, else SESSION (never a window the history does not span). */
export function effectiveWindow(
  options: readonly TraceWindowOption[],
  wanted: TraceWindowId,
): TraceWindowId {
  return options.find((o) => o.id === wanted)?.enabled ? wanted : "SESSION";
}

/* ------------------------------------------------------------------ *
 * Rules shown next to the evidence they produced
 * ------------------------------------------------------------------ */

export type RuleLine = { id: string; text: string; horizon: string; source: string };

/** A rule value in its own unit, e.g. "3%", "3.0×", "$10,000", "10%", "8 TXNS", "5 MIN". */
export function ruleValueText(r: Pick<RuleMeta, "value" | "unit">): string {
  switch (r.unit) {
    case "PCT":
      return `${r.value}%`;
    case "RATIO":
      return `${r.value.toFixed(1)}×`;
    case "USD":
      return `$${r.value.toLocaleString("en-US")}`;
    case "FRACTION":
      return `${Math.round(r.value * 100)}%`;
    case "COUNT":
      return String(r.value);
    case "TXNS":
      return `${r.value} TXNS`;
    case "MINUTES":
      return `${r.value} MIN`;
    case "MS":
      return ageLabel(r.value);
    case "MULTIPLE":
      return `${r.value}×`;
  }
}

/** Threshold + horizon + origin of every rule an event type was evaluated against. */
export function eventRules(type: EventType): RuleLine[] {
  const out: RuleLine[] = [];
  for (const id of EVENT_RULE_IDS[type]) {
    const r = ruleMeta(id);
    if (!r) continue;
    out.push({
      id,
      text: `${EVENT_RULE_SUBJECT[id] ?? id} ${ruleValueText(r)}`,
      horizon: r.horizon.toUpperCase(),
      source: r.source.replace("_", " "),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Fact labels and numeric evidence (text only; no interpretation)
 * ------------------------------------------------------------------ */

const TYPE_LABEL: Record<EventType, string> = {
  PRICE_EXPANSION: "PRICE EXPANSION",
  VOLUME_ACCELERATION: "VOLUME ACCELERATION",
  TXN_ACCELERATION: "TXN ACCELERATION",
  BUY_SELL_IMBALANCE: "BUY/SELL IMBALANCE",
  LIQUIDITY_CHANGE: "LIQUIDITY CHANGE",
  BOOST_CHANGE: "ACTIVE BOOSTS CHANGE",
  PAIR_DISCOVERED: "ENTERED OBSERVED UNIVERSE",
  MOMENTUM_FIRED: "ALPHA RADAR · MOMENTUM FIRED",
  RISK_FIRED: "ALPHA RADAR · LIQUIDITY RISK FIRED",
  PROVIDER_RECOVERED: "PROVIDER RECOVERED",
  PROVIDER_STALE: "PROVIDER STALE",
};

const DIRECTION_WORD: Record<Exclude<EventDirection, null>, string> = {
  UP: "UP",
  DOWN: "DOWN",
  BUY: "BUY-SIDE",
  SELL: "SELL-SIDE",
  ADDED: "ADDED",
  REMOVED: "REMOVED",
};

export function typeLabel(type: EventType): string {
  return TYPE_LABEL[type];
}

/** Direction as a word (never colour alone); null when the type has none. */
export function directionWord(e: Pick<EvidenceEvent, "type" | "direction">): string | null {
  if (e.direction == null) return null;
  // One-directional types say nothing extra.
  if (
    e.type === "VOLUME_ACCELERATION" ||
    e.type === "TXN_ACCELERATION" ||
    e.type === "MOMENTUM_FIRED"
  ) {
    return null;
  }
  return DIRECTION_WORD[e.direction];
}

/** Concise fact label, e.g. "PRICE EXPANSION · UP", "PROVIDER STALE · REALTIME SLOT". */
export function factLabel(e: EvidenceEvent): string {
  const dir = directionWord(e);
  // A recovery this asset was not observed after is lane context only (intel-3).
  if (isLaneOnly(e)) return `LANE RECOVERED · ${e.horizon.label}`;
  if (e.family === "PROVIDER") return `${TYPE_LABEL[e.type]} · ${e.horizon.label}`;
  return dir ? `${TYPE_LABEL[e.type]} · ${dir}` : TYPE_LABEL[e.type];
}

/** Compact USD: $950, $12.3K, $25.85M, $1.2B; unknown → "—". A real 0 is "$0". */
export function usdText(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "−" : "";
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return `${sign}$${a.toFixed(a >= 100 || a === 0 ? 0 : 2)}`;
}

/** Signed USD delta with a typographic minus; a real 0 is "$0". */
export function signedUsdText(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n === 0) return "$0";
  return `${n > 0 ? "+" : ""}${usdText(n)}`;
}

export function ratioText(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}×`;
}

export function countText(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US");
}

export function signedCountText(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n > 0 ? `+${countText(n)}` : n < 0 ? `−${countText(-n)}` : "0";
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** The event's own value in its unit (the numeric evidence column). */
export function valueText(e: EvidenceEvent): string {
  switch (e.type) {
    case "PRICE_EXPANSION":
      return `${signedPct(e.value, 2)} M5`;
    case "VOLUME_ACCELERATION":
    case "TXN_ACCELERATION":
      return `${ratioText(e.value)} PACE`;
    case "BUY_SELL_IMBALANCE":
      return `${ratioText(e.value)} (${countText(num(e.evidence.buysM5))} B / ${countText(num(e.evidence.sellsM5))} S)`;
    case "LIQUIDITY_CHANGE": {
      const rel = num(e.evidence.deltaRel);
      return `${signedUsdText(num(e.evidence.deltaUsd))} (${signedPct(rel == null ? null : rel * 100, 1)}) → ${usdText(e.value)}`;
    }
    case "BOOST_CHANGE":
      return `${countText(e.prior)} → ${countText(e.value)}`;
    case "MOMENTUM_FIRED":
      return `VA ${ratioText(e.value)}`;
    case "RISK_FIRED":
      return `Δ ${signedUsdText(e.value)}`;
    case "PAIR_DISCOVERED":
      return typeof e.evidence.sources === "string" && e.evidence.sources
        ? e.evidence.sources.toUpperCase().replace(/,/g, " · ")
        : "—";
    case "PROVIDER_STALE":
    case "PROVIDER_RECOVERED": {
      const code = e.evidence.code ?? e.evidence.state ?? null;
      return typeof code === "string" && code ? code.toUpperCase() : "—";
    }
  }
}

/** The prior value in the same unit, only when a real earlier observation held it. */
export function priorText(e: EvidenceEvent): string | null {
  if (e.prior == null) return null;
  switch (e.type) {
    case "PRICE_EXPANSION":
      return `${signedPct(e.prior, 2)} M5`;
    case "VOLUME_ACCELERATION":
    case "TXN_ACCELERATION":
    case "BUY_SELL_IMBALANCE":
      return ratioText(e.prior);
    case "LIQUIDITY_CHANGE":
    case "RISK_FIRED":
      return usdText(e.prior);
    case "BOOST_CHANGE":
      return countText(e.prior);
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ *
 * Pool switches — a break in the tape
 * ------------------------------------------------------------------ */

export type PoolBreak = {
  /** observedAt of the first observation on the new pool. */
  at: number;
  fromPair: string | null;
  fromDex: string | null;
  toPair: string | null;
  toDex: string | null;
};

/** Every observed change of pool between consecutive retained observations. */
export function poolBreaks(obs: readonly AssetObservation[]): PoolBreak[] {
  const out: PoolBreak[] = [];
  for (let i = 1; i < obs.length; i++) {
    if (obs[i].pairAddress !== obs[i - 1].pairAddress) {
      out.push({
        at: obs[i].observedAt,
        fromPair: obs[i - 1].pairAddress,
        fromDex: obs[i - 1].snapshot.dexId,
        toPair: obs[i].pairAddress,
        toDex: obs[i].snapshot.dexId,
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * The tape
 * ------------------------------------------------------------------ */

export type TraceAnchor = "FIRST_IN_VIEW" | "EDGE_CLOCK_ORIGIN";

export type TraceEventRow = {
  kind: "event";
  key: string;
  at: number;
  event: EvidenceEvent;
  /** Provider lane context (visually subordinate). */
  laneContext: boolean;
  anchors: TraceAnchor[];
  /** at − first-in-view onset, when a first-in-view anchor exists. */
  offsetMs: number | null;
};

export type TracePoolRow = { kind: "pool"; key: string; at: number; pool: PoolBreak };

export type TraceRow = TraceEventRow | TracePoolRow;

export type TraceStep = {
  family: EventFamily;
  event: EvidenceEvent;
  /** onset − the first step's onset. */
  offsetMs: number;
  /** Same receive time as the previous step: one observation showed both, no order. */
  sameObservation: boolean;
};

/**
 * WHAT MOVED FIRST — the first OBSERVED-onset structural change per family on
 * one observed pool, chronological (compareEvents). Shared by VAULT TRACE and
 * THE MOMENT so the two can never disagree. Conditions already true when first
 * observed, provider state and PAIR_DISCOVERED are never part of it; steps
 * with the same receive time are flagged `sameObservation` (no order claimed).
 */
export function firstMoveSequence(
  events: readonly EvidenceEvent[],
  pool: string | null,
): TraceStep[] {
  const byFamily = new Map<EventFamily, EvidenceEvent>();
  for (const e of [...events].sort(compareEvents)) {
    if (!STRUCTURAL_TYPES.has(e.type) || e.onset !== "OBSERVED") continue;
    if (e.pairAddress !== pool) continue;
    if (!byFamily.has(e.family)) byFamily.set(e.family, e);
  }
  const seq = [...byFamily.values()].sort(compareEvents);
  return seq.map((e, i) => ({
    family: e.family,
    event: e,
    offsetMs: e.observedAt - seq[0].observedAt,
    sameObservation: i > 0 && e.observedAt === seq[i - 1].observedAt,
  }));
}

export type TraceModel = {
  windows: TraceWindowOption[];
  window: TraceWindowId;
  span: HistorySpan | null;
  /** Inclusive start of the shown window (null = SESSION, everything retained). */
  windowStart: number | null;
  /** End of the tape: the newest real time in it (observation or lane event). */
  end: number | null;
  /** Oldest first. */
  rows: TraceRow[];
  /** Earliest OBSERVED-onset structural change in view (a temporal anchor), or null. */
  first: EvidenceEvent | null;
  /** The Edge Clock origin (session-wide), or null. */
  origin: EvidenceEvent | null;
  /**
   * First OBSERVED onset per family on the latest observed pool, oldest first:
   * the order in which the families were OBSERVED — chronology, not cause.
   */
  sequence: TraceStep[];
  /** Pool the sequence is restricted to. */
  sequencePool: string | null;
  /** Structural events in view whose start was not seen (order unknown). */
  inProgress: number;
  poolSwitches: number;
  marketEvents: number;
  laneEvents: number;
};

/**
 * Build the tape for one asset. `events` are the asset's events
 * (assetEvents), `wanted` the requested window; an unspanned window falls
 * back to SESSION.
 */
export function buildTrace(
  track: AssetTrack | null | undefined,
  events: readonly EvidenceEvent[],
  wanted: TraceWindowId = "SESSION",
): TraceModel {
  const span = historySpan(track);
  const windows = traceWindows(span);
  const window = effectiveWindow(windows, wanted);
  const obs = track?.observations ?? [];
  const breaks = poolBreaks(obs);
  const newestEvent = events.reduce<number | null>(
    (m, e) => (m == null || e.observedAt > m ? e.observedAt : m),
    null,
  );
  const end =
    span == null && newestEvent == null
      ? null
      : Math.max(span?.to ?? -Infinity, newestEvent ?? -Infinity);
  const ms = traceWindowMs(window);
  const windowStart = ms == null || end == null ? null : end - ms;
  const inView = (at: number) => windowStart == null || at >= windowStart;

  const shown = events.filter((e) => inView(e.observedAt)).sort(compareEvents);
  const first = firstObservedStructuralChange(shown);
  const origin = edgeClockOrigin(events);

  const rows: TraceRow[] = [
    ...shown.map<TraceEventRow>((e) => {
      const anchors: TraceAnchor[] = [];
      if (first && e.id === first.id) anchors.push("FIRST_IN_VIEW");
      if (origin && e.id === origin.id) anchors.push("EDGE_CLOCK_ORIGIN");
      return {
        kind: "event",
        key: e.id,
        at: e.observedAt,
        event: e,
        laneContext: e.family === "PROVIDER",
        anchors,
        offsetMs: first ? e.observedAt - first.observedAt : null,
      };
    }),
    ...breaks
      .filter((b) => inView(b.at))
      .map<TracePoolRow>((b) => ({ kind: "pool", key: `pool|${b.at}`, at: b.at, pool: b })),
  ].sort(
    (a, b) =>
      a.at - b.at ||
      // A pool break precedes the events observed on the new pool at the same time.
      (a.kind === b.kind ? 0 : a.kind === "pool" ? -1 : 1) ||
      (a.kind === "event" && b.kind === "event" ? compareEvents(a.event, b.event) : 0),
  );

  const latestPool = obs.length ? obs[obs.length - 1].pairAddress : null;
  const sequence = firstMoveSequence(shown, latestPool);

  return {
    windows,
    window,
    span,
    windowStart,
    end,
    rows,
    first,
    origin,
    sequence,
    sequencePool: sequence.length ? latestPool : null,
    inProgress: shown.filter(
      (e) => STRUCTURAL_TYPES.has(e.type) && e.onset === "IN_PROGRESS_WHEN_OBSERVED",
    ).length,
    poolSwitches: rows.filter((r) => r.kind === "pool").length,
    marketEvents: shown.filter((e) => e.family !== "PROVIDER").length,
    laneEvents: shown.filter((e) => e.family === "PROVIDER").length,
  };
}

/** Signed offset from an anchor, e.g. "+01m 30s", "−00m 30s", "0s" at the anchor. */
export function offsetText(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms === 0) return "ANCHOR";
  return `${ms > 0 ? "+" : "−"}${ageLabel(Math.abs(ms))}`;
}

/* ------------------------------------------------------------------ *
 * EDGE CLOCK — since-origin text (the model is edgeClockModel in edgeClock.ts)
 * ------------------------------------------------------------------ */

/** Formatted "from → to" and delta for a since-metric; unknown → "—". */
export function sinceText(m: SinceMetric): { from: string; to: string; delta: string } {
  const fmt = (v: number | null) =>
    m.unit === "USD"
      ? usdText(v)
      : m.unit === "RATIO"
        ? ratioText(v)
        : m.unit === "COUNT"
          ? countText(v)
          : priceText(v);
  const delta =
    m.delta == null
      ? "—"
      : m.unit === "USD"
        ? `${signedUsdText(m.delta)}${m.deltaPct == null ? "" : ` (${signedPct(m.deltaPct, 1)})`}`
        : m.unit === "RATIO"
          ? `${m.delta > 0 ? "+" : m.delta < 0 ? "−" : ""}${Math.abs(m.delta).toFixed(2)}×`
          : m.unit === "COUNT"
            ? `${signedCountText(m.delta)}${m.deltaPct == null ? "" : ` (${signedPct(m.deltaPct, 1)})`}`
            : signedPct(m.deltaPct, 2);
  return { from: fmt(m.from), to: fmt(m.to), delta };
}

/** Plain USD price text for the since table (the page uses <Price> where it has room). */
export function priceText(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  const digits = a >= 1 ? 2 : a >= 0.001 ? 4 : 8;
  return `${n < 0 ? "−" : ""}$${a.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
