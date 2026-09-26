import { liquidityChange } from "@/lib/signals/liquidity";
import { buyPressure } from "@/lib/signals/momentum";
import { transactionAcceleration, volumeAcceleration } from "@/lib/signals/pace";
import type { PairSnapshot } from "@/lib/signals/pairSnapshot";
import type { AssetObservation, AssetTrack, LaneTrack, SessionState } from "./facts";
import {
  BOOST_CHANGE_MIN_DELTA,
  IMBALANCE_MIN_RATIO,
  IMBALANCE_MIN_SAMPLE_TXNS,
  INTELLIGENCE_RULES_VERSION,
  LIQUIDITY_CHANGE_LOOKBACK_MINUTES,
  LIQUIDITY_CHANGE_MIN_ABS_USD,
  LIQUIDITY_CHANGE_MIN_PREVIOUS_USD,
  LIQUIDITY_CHANGE_MIN_REL,
  type Lane,
  PRICE_EXPANSION_M5_PCT,
  RUN_MAX_GAP_MS,
  SESSION_DELTA_MAX_SPAN_MS,
  TXN_ACCELERATION_MIN,
  VOLUME_ACCELERATION_MIN,
} from "./rules";

/**
 * EVIDENCE EVENTS — deterministic extraction from real session observations.
 *
 * Every event is an ONSET: a condition that stays true across consecutive
 * observations is one event, stamped with the observation where it was
 * first seen (`observedAt`), extended by `lastObservedAt` while it holds.
 * A missing field is unknown — it never counts as true, false or zero — and
 * ends a run, as do a gap longer than RUN_MAX_GAP_MS and a change of pair.
 *
 * `onset` says how much we actually saw:
 *   OBSERVED                   a real earlier observation (within the run
 *                              gap) showed the condition false — the change
 *                              itself happened between two observations.
 *   IN_PROGRESS_WHEN_OBSERVED  the condition was already true the first time
 *                              it could be evaluated; it may have begun
 *                              before. Never an origin for the Edge Clock.
 * Session deltas (LIQUIDITY_CHANGE, BOOST_CHANGE) compare two real
 * observations, so their onset is always OBSERVED.
 *
 * Supported types (every one backed by a real schema field + captured fixture):
 *   PRICE_EXPANSION      priceChange.m5                     provider m5 window
 *   VOLUME_ACCELERATION  volume.m5 vs volume.h1 (radar VA)  m5 vs (h1 − m5) pace
 *   TXN_ACCELERATION     txns.m5 vs txns.h1 (radar TA)      m5 vs (h1 − m5) pace
 *   BUY_SELL_IMBALANCE   txns.m5 buys/sells (radar BP)      provider m5 window
 *   LIQUIDITY_CHANGE     liquidity.usd, two observations    session delta
 *   BOOST_CHANGE         boosts.active, two observations    session delta
 *   PAIR_DISCOVERED      first universe observation after the first round
 *   MOMENTUM_FIRED       radar.momentum of the round        radar round
 *   RISK_FIRED           radar.risk of the round            radar round
 *   PROVIDER_STALE       lane failure / canonical slot unresolved
 *   PROVIDER_RECOVERED   next success after that
 * None of the requested types is dropped.
 */

export type EventFamily =
  | "PRICE"
  | "VOLUME"
  | "LIQUIDITY"
  | "TRANSACTIONS"
  | "BOOST"
  | "SIGNAL"
  | "PROVIDER";

export type EventType =
  | "PRICE_EXPANSION"
  | "VOLUME_ACCELERATION"
  | "TXN_ACCELERATION"
  | "BUY_SELL_IMBALANCE"
  | "LIQUIDITY_CHANGE"
  | "BOOST_CHANGE"
  | "PAIR_DISCOVERED"
  | "MOMENTUM_FIRED"
  | "RISK_FIRED"
  | "PROVIDER_RECOVERED"
  | "PROVIDER_STALE";

export const EVENT_FAMILY: Record<EventType, EventFamily> = {
  PRICE_EXPANSION: "PRICE",
  VOLUME_ACCELERATION: "VOLUME",
  TXN_ACCELERATION: "TRANSACTIONS",
  BUY_SELL_IMBALANCE: "TRANSACTIONS",
  LIQUIDITY_CHANGE: "LIQUIDITY",
  BOOST_CHANGE: "BOOST",
  PAIR_DISCOVERED: "SIGNAL",
  MOMENTUM_FIRED: "SIGNAL",
  RISK_FIRED: "SIGNAL",
  PROVIDER_RECOVERED: "PROVIDER",
  PROVIDER_STALE: "PROVIDER",
};

/** Market-structure changes (Edge Clock / Change Queue). Provider state and discovery are not. */
export const STRUCTURAL_TYPES: ReadonlySet<EventType> = new Set<EventType>([
  "PRICE_EXPANSION",
  "VOLUME_ACCELERATION",
  "TXN_ACCELERATION",
  "BUY_SELL_IMBALANCE",
  "LIQUIDITY_CHANGE",
  "BOOST_CHANGE",
  "MOMENTUM_FIRED",
  "RISK_FIRED",
]);

export type EventDirection = "UP" | "DOWN" | "BUY" | "SELL" | "ADDED" | "REMOVED" | null;
export type EventUnit = "PCT" | "RATIO" | "USD" | "COUNT" | null;

export type EventHorizon = {
  /** PROVIDER_WINDOW: the provider's rolling window · SESSION_DELTA: two real observations · RADAR_ROUND · LANE. */
  kind: "PROVIDER_WINDOW" | "SESSION_DELTA" | "RADAR_ROUND" | "LANE" | "UNIVERSE";
  label: string;
  /** Window/span in ms when it is known exactly. */
  ms: number | null;
};

export type EvidenceEvent = {
  /** Deterministic: type · asset · pair · onset time · direction. */
  id: string;
  type: EventType;
  family: EventFamily;
  assetKey: string;
  chainId: string;
  address: string;
  pairAddress: string | null;
  baseAddress: string;
  quoteAddress: string | null;
  /** Observation where the condition was first seen (a real receive time). */
  observedAt: number;
  /** Last observation in the run where it still held. */
  lastObservedAt: number;
  /** Still true at the asset's latest observation. */
  active: boolean;
  onset: "OBSERVED" | "IN_PROGRESS_WHEN_OBSERVED";
  /** Provider + lane(s) of the onset observation, e.g. "DEXSCREENER · REALTIME". */
  source: string;
  direction: EventDirection;
  unit: EventUnit;
  value: number | null;
  /** Only when genuinely observed. */
  prior: number | null;
  priorObservedAt: number | null;
  threshold: number | null;
  horizon: EventHorizon;
  caveat: string | null;
  evidence: Record<string, number | string | null>;
  rulesVersion: string;
};

const MIN5 = 5 * 60_000;
const M5: EventHorizon = { kind: "PROVIDER_WINDOW", label: "M5 (PROVIDER WINDOW)", ms: MIN5 };
const PACE: EventHorizon = {
  kind: "PROVIDER_WINDOW",
  label: "M5 PACE VS PREVIOUS (H1 − M5) PACE",
  ms: MIN5,
};
const PACE_CAVEAT =
  "Provider windows overlap (m5 ⊂ h1); compared as m5 pace vs the h1 − m5 remainder over its real span.";

const sourceOf = (o: AssetObservation) =>
  `${o.provider.toUpperCase()} · ${o.lanes.map((l) => l.toUpperCase()).join(" + ")}`;

type Hit = {
  dir: EventDirection;
  value: number | null;
  evidence: Record<string, number | string | null>;
};
/** true-with-details / false / null (unknown). */
type Test = (
  o: AssetObservation,
  i: number,
  obs: readonly AssetObservation[],
) => Hit | false | null;

type Spec = {
  type: EventType;
  unit: EventUnit;
  threshold: number | null;
  horizon: EventHorizon;
  caveat: string | null;
  /** Session deltas: onset is always OBSERVED (the change is between two real observations). */
  delta?: boolean;
  /** Metric used for `prior` on an OBSERVED onset of a state condition. */
  metric?: (s: PairSnapshot) => number | null;
  test: Test;
};

function baseEvent(
  spec: Spec,
  o: AssetObservation,
  hit: Hit,
): Omit<EvidenceEvent, "lastObservedAt" | "active" | "onset" | "prior" | "priorObservedAt"> {
  return {
    id: `${spec.type}|${o.assetKey}|${o.pairAddress ?? "∅"}|${o.observedAt}|${hit.dir ?? "-"}`,
    type: spec.type,
    family: EVENT_FAMILY[spec.type],
    assetKey: o.assetKey,
    chainId: o.chainId,
    address: o.address,
    pairAddress: o.pairAddress,
    baseAddress: o.baseAddress,
    quoteAddress: o.quoteAddress,
    observedAt: o.observedAt,
    source: sourceOf(o),
    direction: hit.dir,
    unit: spec.unit,
    value: hit.value,
    threshold: spec.threshold,
    horizon: spec.horizon,
    caveat: spec.caveat,
    evidence: hit.evidence,
    rulesVersion: INTELLIGENCE_RULES_VERSION,
  };
}

/** Fold one condition over the observations into onset events. */
function runEvents(spec: Spec, obs: readonly AssetObservation[]): EvidenceEvent[] {
  const out: EvidenceEvent[] = [];
  let open: EvidenceEvent | null = null;
  let prev: { o: AssetObservation; result: Hit | false | null } | null = null;
  obs.forEach((o, i) => {
    const result = spec.test(o, i, obs);
    // Consecutive = same pair, and no longer apart than the run gap.
    const contiguous =
      prev != null &&
      prev.o.pairAddress === o.pairAddress &&
      o.observedAt - prev.o.observedAt <= RUN_MAX_GAP_MS;
    if (result && open && contiguous && open.direction === result.dir) {
      open.lastObservedAt = o.observedAt;
    } else if (result) {
      const negativeBefore = contiguous && prev!.result === false;
      const observedChange = spec.delta === true || negativeBefore;
      const prior =
        observedChange && !spec.delta && spec.metric ? spec.metric(prev!.o.snapshot) : null;
      open = {
        ...baseEvent(spec, o, result),
        lastObservedAt: o.observedAt,
        active: false,
        onset: observedChange ? "OBSERVED" : "IN_PROGRESS_WHEN_OBSERVED",
        prior: spec.delta ? (result.evidence.prior as number | null) : prior,
        priorObservedAt: spec.delta
          ? (result.evidence.priorObservedAt as number | null)
          : prior != null
            ? prev!.o.observedAt
            : null,
      };
      out.push(open);
    } else {
      open = null;
    }
    prev = { o, result };
  });
  const last = obs[obs.length - 1];
  for (const e of out) e.active = last != null && e.lastObservedAt === last.observedAt;
  return out;
}

const pct = (n: number) => Math.abs(n);

const SPECS: Spec[] = [
  {
    type: "PRICE_EXPANSION",
    unit: "PCT",
    threshold: PRICE_EXPANSION_M5_PCT,
    horizon: M5,
    caveat: null,
    metric: (s) => s.priceChange.m5,
    test: (o) => {
      const m5 = o.snapshot.priceChange.m5;
      if (m5 == null) return null;
      if (pct(m5) < PRICE_EXPANSION_M5_PCT) return false;
      return {
        dir: m5 >= 0 ? "UP" : "DOWN",
        value: m5,
        evidence: { priceChangeM5: m5, priceUsd: o.snapshot.priceUsd },
      };
    },
  },
  {
    type: "VOLUME_ACCELERATION",
    unit: "RATIO",
    threshold: VOLUME_ACCELERATION_MIN,
    horizon: PACE,
    caveat: PACE_CAVEAT,
    metric: (s) => {
      const r = volumeAcceleration(s);
      return r.ok ? r.ratio : null;
    },
    test: (o) => {
      const r = volumeAcceleration(o.snapshot);
      if (!r.ok) return null;
      if (r.ratio < VOLUME_ACCELERATION_MIN) return false;
      return {
        dir: "UP",
        value: r.ratio,
        evidence: {
          volumeM5: o.snapshot.volume.m5,
          volumeH1: o.snapshot.volume.h1,
          recentPerMinute: r.recentPerMinute,
          previousPerMinute: r.previousPerMinute,
          previousMinutes: r.previousMinutes,
        },
      };
    },
  },
  {
    type: "TXN_ACCELERATION",
    unit: "RATIO",
    threshold: TXN_ACCELERATION_MIN,
    horizon: PACE,
    caveat: PACE_CAVEAT,
    metric: (s) => {
      const r = transactionAcceleration(s);
      return r.ok ? r.ratio : null;
    },
    test: (o) => {
      const r = transactionAcceleration(o.snapshot);
      if (!r.ok) return null;
      if (r.ratio < TXN_ACCELERATION_MIN) return false;
      return {
        dir: "UP",
        value: r.ratio,
        evidence: {
          txnsM5: r.recent,
          txnsPrevious: r.previous,
          previousMinutes: r.previousMinutes,
        },
      };
    },
  },
  {
    type: "BUY_SELL_IMBALANCE",
    unit: "RATIO",
    threshold: IMBALANCE_MIN_RATIO,
    horizon: M5,
    caveat: "Counts of transactions, not USD; below the sample guard no ratio is evaluated.",
    test: (o) => {
      const bp = buyPressure(o.snapshot);
      if (!bp.ok) return null; // no window, or below the radar's sample guard
      const { buys, sells, sample } = bp;
      if (sample < IMBALANCE_MIN_SAMPLE_TXNS) return null;
      const buyRatio = buys / Math.max(sells, 1);
      const sellRatio = sells / Math.max(buys, 1);
      const evidence = { buysM5: buys, sellsM5: sells, sample };
      if (buyRatio >= IMBALANCE_MIN_RATIO) return { dir: "BUY", value: buyRatio, evidence };
      if (sellRatio >= IMBALANCE_MIN_RATIO) return { dir: "SELL", value: sellRatio, evidence };
      return false;
    },
  },
  {
    type: "LIQUIDITY_CHANGE",
    unit: "USD",
    threshold: LIQUIDITY_CHANGE_MIN_REL,
    horizon: {
      kind: "SESSION_DELTA",
      label: `≥ ${LIQUIDITY_CHANGE_LOOKBACK_MINUTES}M BETWEEN TWO SESSION OBSERVATIONS`,
      ms: null,
    },
    caveat: "Compared only between two real observations of the same pair.",
    delta: true,
    test: (o, i, obs) => {
      // A pool delta needs a known pool: no pair address, no comparison.
      if (o.snapshot.liquidityUsd == null || o.pairAddress == null) return null;
      const samePair = obs
        .slice(0, i + 1)
        .filter((x) => x.pairAddress === o.pairAddress)
        .map((x) => x.snapshot);
      const c = liquidityChange(samePair, LIQUIDITY_CHANGE_LOOKBACK_MINUTES);
      if (!c) return null;
      if (c.currentObservedAt - c.previousObservedAt > SESSION_DELTA_MAX_SPAN_MS) return null;
      if (
        Math.abs(c.deltaRel) < LIQUIDITY_CHANGE_MIN_REL ||
        Math.abs(c.deltaUsd) < LIQUIDITY_CHANGE_MIN_ABS_USD ||
        c.previousUsd < LIQUIDITY_CHANGE_MIN_PREVIOUS_USD
      ) {
        return false;
      }
      return {
        dir: c.deltaUsd < 0 ? "REMOVED" : "ADDED",
        value: c.currentUsd,
        evidence: {
          prior: c.previousUsd,
          priorObservedAt: c.previousObservedAt,
          deltaUsd: c.deltaUsd,
          deltaRel: c.deltaRel,
          spanMinutes: c.spanMinutes,
        },
      };
    },
  },
  {
    type: "BOOST_CHANGE",
    unit: "COUNT",
    threshold: BOOST_CHANGE_MIN_DELTA,
    horizon: { kind: "SESSION_DELTA", label: "CONSECUTIVE SESSION OBSERVATIONS", ms: null },
    caveat: "boosts.active as reported on the pair; canonical pairs carry no boost field.",
    delta: true,
    test: (o, i, obs) => {
      const now = o.snapshot.boostsActive;
      if (now == null) return null;
      let prev: AssetObservation | null = null;
      for (let j = i - 1; j >= 0; j--) {
        if (obs[j].snapshot.boostsActive != null) {
          prev = obs[j];
          break;
        }
      }
      if (!prev || o.observedAt - prev.observedAt > SESSION_DELTA_MAX_SPAN_MS) return null;
      const before = prev.snapshot.boostsActive as number;
      const delta = now - before;
      if (Math.abs(delta) < BOOST_CHANGE_MIN_DELTA) return false;
      return {
        dir: delta > 0 ? "UP" : "DOWN",
        value: now,
        evidence: { prior: before, priorObservedAt: prev.observedAt, delta },
      };
    },
  },
];

/* ------------------------------------------------------------------ *
 * Radar firings (recorded from the round — the radar is the authority)
 * ------------------------------------------------------------------ */

function radarEvents(track: AssetTrack): EvidenceEvent[] {
  const evaluated = track.observations.filter((o) => o.lanes.includes("universe"));
  const out: EvidenceEvent[] = [];
  for (const kind of ["MOMENTUM", "RISK"] as const) {
    const type: EventType = kind === "MOMENTUM" ? "MOMENTUM_FIRED" : "RISK_FIRED";
    const firings = new Map(
      track.radar.filter((r) => r.kind === kind).map((r) => [r.observedAt, r] as const),
    );
    const spec: Spec = {
      type,
      unit: kind === "MOMENTUM" ? "RATIO" : "USD",
      threshold: null,
      horizon: { kind: "RADAR_ROUND", label: "ALPHA RADAR ROUND", ms: null },
      caveat: "The Alpha Radar's own deterministic rule; recorded as it fired.",
      test: (o) => {
        const f = firings.get(o.observedAt);
        if (!f) return false;
        return {
          dir: kind === "MOMENTUM" ? "UP" : f.direction,
          value: f.value,
          evidence: {
            severity: f.severity,
            reasons: f.reasons.join(" · ") || null,
            prior: f.prior,
            priorObservedAt: f.priorObservedAt,
          },
        };
      },
    };
    for (const e of runEvents(spec, evaluated)) {
      if (kind === "RISK") {
        e.prior = (e.evidence.prior as number | null) ?? null;
        e.priorObservedAt = (e.evidence.priorObservedAt as number | null) ?? null;
      }
      out.push(e);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Discovery + provider state
 * ------------------------------------------------------------------ */

function identityEvent(
  track: AssetTrack,
  o: AssetObservation,
  type: EventType,
  at: number,
  horizon: EventHorizon,
  evidence: Record<string, number | string | null>,
  source: string,
): EvidenceEvent {
  return {
    id: `${type}|${track.assetKey}|${o.pairAddress ?? "∅"}|${at}|-`,
    type,
    family: EVENT_FAMILY[type],
    assetKey: track.assetKey,
    chainId: track.chainId,
    address: track.address,
    pairAddress: o.pairAddress,
    baseAddress: o.baseAddress,
    quoteAddress: o.quoteAddress,
    observedAt: at,
    lastObservedAt: at,
    active: false,
    onset: "OBSERVED",
    source,
    direction: null,
    unit: null,
    value: null,
    prior: null,
    priorObservedAt: null,
    threshold: null,
    horizon,
    caveat: null,
    evidence,
    rulesVersion: INTELLIGENCE_RULES_VERSION,
  };
}

function discoveryEvent(track: AssetTrack): EvidenceEvent | null {
  if (track.enteredAt == null) return null;
  const o = track.observations.find((x) => x.observedAt === track.enteredAt);
  if (!o) return null;
  return identityEvent(
    track,
    o,
    "PAIR_DISCOVERED",
    o.observedAt,
    { kind: "UNIVERSE", label: "ENTERED OBSERVED UNIVERSE", ms: null },
    { sources: o.sources.join(","), pairCreatedAt: o.snapshot.pairCreatedAt },
    sourceOf(o),
  );
}

function providerEvents(track: AssetTrack, lanes: Record<Lane, LaneTrack>): EvidenceEvent[] {
  const out: EvidenceEvent[] = [];
  const first = track.observations[0];
  if (!first) return out;
  const nearest = (at: number) =>
    [...track.observations].reverse().find((o) => o.observedAt <= at) ?? first;

  // Lane-wide failures/recoveries, for lanes that have delivered this asset.
  const used = new Set(track.observations.flatMap((o) => o.lanes));
  for (const lane of ["realtime", "universe"] as const) {
    if (!used.has(lane)) continue;
    let failing = false;
    for (const p of lanes[lane].points) {
      if (p.at < track.firstSeenAt) {
        failing = p.state === "failed";
        continue;
      }
      if (p.state === "failed" && !failing) {
        failing = true;
        out.push(
          identityEvent(
            track,
            nearest(p.at),
            "PROVIDER_STALE",
            p.at,
            { kind: "LANE", label: `${lane.toUpperCase()} LANE`, ms: null },
            { lane, code: p.code, issues: p.issues.join(" · ") || null },
            `DEXSCREENER · ${lane.toUpperCase()}`,
          ),
        );
      } else if (p.state !== "failed" && failing) {
        failing = false;
        out.push(
          identityEvent(
            track,
            nearest(p.at),
            "PROVIDER_RECOVERED",
            p.at,
            { kind: "LANE", label: `${lane.toUpperCase()} LANE`, ms: null },
            { lane, state: p.state },
            `DEXSCREENER · ${lane.toUpperCase()}`,
          ),
        );
      }
    }
  }

  // Per-slot gaps (a canonical pair unresolved while its lane answered).
  let inGap = false;
  const timeline = [
    ...track.observations.map((o) => ({ at: o.observedAt, o, gap: null })),
    ...track.gaps.map((g) => ({ at: g.at, o: null, gap: g })),
  ].sort((a, b) => a.at - b.at || (a.gap ? 1 : -1));
  for (const t of timeline) {
    if (t.gap && !inGap) {
      inGap = true;
      out.push(
        identityEvent(
          track,
          nearest(t.at),
          "PROVIDER_STALE",
          t.at,
          { kind: "LANE", label: `${t.gap.lane.toUpperCase()} SLOT`, ms: null },
          { lane: t.gap.lane, code: t.gap.reason },
          `DEXSCREENER · ${t.gap.lane.toUpperCase()}`,
        ),
      );
    } else if (t.o && inGap) {
      inGap = false;
      out.push(
        identityEvent(
          track,
          t.o,
          "PROVIDER_RECOVERED",
          t.at,
          { kind: "LANE", label: "SLOT RESOLVED", ms: null },
          { lanes: t.o.lanes.join(",") },
          sourceOf(t.o),
        ),
      );
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/** Chronological order: onset time, then type, then id — total and deterministic. */
export function compareEvents(a: EvidenceEvent, b: EvidenceEvent): number {
  return (
    a.observedAt - b.observedAt ||
    (a.type < b.type ? -1 : a.type > b.type ? 1 : 0) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** Every evidence event for one asset, oldest onset first. Pure. */
export function extractAssetEvents(
  track: AssetTrack,
  lanes: Record<Lane, LaneTrack>,
): EvidenceEvent[] {
  const obs = track.observations;
  const events: EvidenceEvent[] = [];
  for (const spec of SPECS) events.push(...runEvents(spec, obs));
  events.push(...radarEvents(track));
  const d = discoveryEvent(track);
  if (d) events.push(d);
  events.push(...providerEvents(track, lanes));
  const seen = new Set<string>();
  return events
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort(compareEvents);
}

const cache = new WeakMap<AssetTrack, { lanes: SessionState["lanes"]; events: EvidenceEvent[] }>();

/** Memoized by (track, lanes) object identity — the store keeps both stable until they change. */
export function assetEvents(track: AssetTrack, lanes: SessionState["lanes"]): EvidenceEvent[] {
  const hit = cache.get(track);
  if (hit && hit.lanes === lanes) return hit.events;
  const events = extractAssetEvents(track, lanes);
  cache.set(track, { lanes, events });
  return events;
}
