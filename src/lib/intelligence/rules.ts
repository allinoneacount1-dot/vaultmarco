/**
 * INTELLIGENCE RULES — every threshold, window and bound the intelligence
 * suite compares against, in one versioned place.
 *
 * Nothing here is a score weight; there is no composite score. Where the
 * Alpha Radar / signal layer already defines a deterministic threshold it is
 * IMPORTED from `lib/signals/thresholds` (never copied), so the suite and the
 * radar can never disagree about the same observation.
 *
 * Bump INTELLIGENCE_RULES_VERSION whenever a value or the meaning of a rule
 * changes. Every evidence event carries the version it was extracted under.
 */
import {
  BP_MIN,
  BP_MIN_SAMPLE_TXNS,
  HISTORY_MAX_AGE_MINUTES,
  LIQUIDITY_EVENT_LOOKBACK_MINUTES,
  LIQUIDITY_EVENT_MIN_ABS_USD,
  LIQUIDITY_EVENT_MIN_PREVIOUS_USD,
  LIQUIDITY_STABLE_MAX_DRAWDOWN,
  TA_MIN,
  VA_MIN,
} from "@/lib/signals/thresholds";

/**
 * intel-2 (from intel-1): freshness aligned with the landing windows
 * (LIVE ≤ 1.5 × cadence), central divergence predicates, rule metadata.
 */
export const INTELLIGENCE_RULES_VERSION = "intel-2";

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

/* ------------------------------------------------------------------ *
 * Observation lanes (existing queries only — the suite adds none)
 * ------------------------------------------------------------------ */

export type Lane = "realtime" | "universe";

/**
 * Cadence of each EXISTING lane, mirrored for freshness math. A unit test
 * asserts these equal the real query options (usePairUniverse), so they
 * cannot drift apart silently.
 *   realtime — REALTIME_QUERY_KEY, canonical pairs, refetchInterval 30 s
 *   universe — PAIR_UNIVERSE_KEY, boosts/ads/enrichment + radar, 60 s
 */
export const LANE_CADENCE_MS: Record<Lane, number> = {
  realtime: 30 * SECOND,
  universe: 60 * SECOND,
};

/* ------------------------------------------------------------------ *
 * Freshness
 * ------------------------------------------------------------------ */

/**
 * An observation is LIVE while its age is ≤ FRESHNESS_LIVE_CADENCES × lane
 * cadence, and STALE beyond: realtime (30 s) LIVE ≤ 45 s, universe/feed
 * (60 s) LIVE ≤ 90 s — the same windows the landing uses, so one underlying
 * observation is never LIVE here while the landing calls it STALE.
 * Independently of age, a lane failure or unresolved slot after the asset's
 * latest observation makes it STALE until a NEW observation arrives
 * (freshness.ts).
 */
export const FRESHNESS_LIVE_CADENCES = 1.5;

export function staleAfterMs(lane: Lane): number {
  return FRESHNESS_LIVE_CADENCES * LANE_CADENCE_MS[lane];
}

/* ------------------------------------------------------------------ *
 * Session history bounds
 * ------------------------------------------------------------------ */

/**
 * Rolling retention of session observations. Reuses the radar's own history
 * window (HISTORY_MAX_AGE_MINUTES = 60) so the suite never holds more — or
 * claims more — history than the radar evaluates.
 */
export const SESSION_MAX_AGE_MS = HISTORY_MAX_AGE_MINUTES * MINUTE;

/**
 * Hard cap per asset. The fastest lane (30 s) yields 120 observations per
 * 60 min; 150 leaves room for the two lanes interleaving on canonical pairs
 * without ever exceeding the age window in practice.
 */
export const SESSION_MAX_OBSERVATIONS_PER_ASSET = 150;

/**
 * Hard cap on tracked assets. One universe round holds ≤ 40 assets (3 lists ×
 * ENRICH_LIMIT 12 + 4 canonical); 96 keeps ~an hour of rotation. Beyond it the
 * least-recently-observed asset is evicted first.
 */
export const SESSION_MAX_ASSETS = 96;

/** Provider status points kept per lane (240 × 30 s = 2 h of lane history). */
export const SESSION_MAX_LANE_POINTS = 240;

/** Radar firings / canonical-slot gaps kept per asset. */
export const SESSION_MAX_RADAR_PER_ASSET = 150;
export const SESSION_MAX_GAPS_PER_ASSET = 60;

/* ------------------------------------------------------------------ *
 * Event continuity
 * ------------------------------------------------------------------ */

/**
 * A condition that stays true across consecutive observations is ONE event at
 * its first observation. Two consecutive observations further apart than this
 * are not "consecutive" (the recorder was not running, e.g. the user left the
 * dashboard): the run breaks and a later observation starts a new event.
 * 3 × the slow cadence.
 */
export const RUN_MAX_GAP_MS = 3 * LANE_CADENCE_MS.universe;

/**
 * Cross-observation deltas (liquidity, boosts) are only computed between two
 * real session observations of the same pair at most this far apart; a wider
 * gap hides what happened in between.
 */
export const SESSION_DELTA_MAX_SPAN_MS = 15 * MINUTE;

/* ------------------------------------------------------------------ *
 * Event rules
 * ------------------------------------------------------------------ */

/**
 * PRICE_EXPANSION — |priceChange.m5| ≥ this percent, provider horizon M5.
 * A deterministic MARCOVAULT rule and a PRODUCT-DEFINED threshold: it is not
 * statistically calibrated and it is not a prediction. The radar has no
 * price rule to import.
 */
export const PRICE_EXPANSION_M5_PCT = 3;

/** VOLUME_ACCELERATION — the radar's VA rule, imported (m5 pace vs (h1 − m5) pace). */
export const VOLUME_ACCELERATION_MIN = VA_MIN;

/** TXN_ACCELERATION — the radar's TA rule, imported. */
export const TXN_ACCELERATION_MIN = TA_MIN;

/**
 * BUY_SELL_IMBALANCE — the radar's buy-pressure ratio and sample guard,
 * imported, applied symmetrically: buys/max(sells,1) ≥ BP_MIN is BUY-side,
 * sells/max(buys,1) ≥ BP_MIN is SELL-side, both only with ≥ BP_MIN_SAMPLE_TXNS
 * m5 transactions.
 */
export const IMBALANCE_MIN_RATIO = BP_MIN;
export const IMBALANCE_MIN_SAMPLE_TXNS = BP_MIN_SAMPLE_TXNS;

/**
 * LIQUIDITY_CHANGE — session delta between two real observations of the same
 * pair, the later compared with the newest one at least
 * LIQUIDITY_CHANGE_LOOKBACK_MINUTES older (the radar's liquidityChange()).
 *   |Δ| / previous ≥ LIQUIDITY_STABLE_MAX_DRAWDOWN (0.10, the radar's own
 *                    "no longer stable" boundary),
 *   |Δ| ≥ LIQUIDITY_EVENT_MIN_ABS_USD ($10k), previous ≥ LIQUIDITY_EVENT_MIN_PREVIOUS_USD ($25k).
 * RISK_FIRED remains the radar's stricter 25 % rule.
 */
export const LIQUIDITY_CHANGE_LOOKBACK_MINUTES = LIQUIDITY_EVENT_LOOKBACK_MINUTES;
export const LIQUIDITY_CHANGE_MIN_REL = LIQUIDITY_STABLE_MAX_DRAWDOWN;
export const LIQUIDITY_CHANGE_MIN_ABS_USD = LIQUIDITY_EVENT_MIN_ABS_USD;
export const LIQUIDITY_CHANGE_MIN_PREVIOUS_USD = LIQUIDITY_EVENT_MIN_PREVIOUS_USD;

/**
 * BOOST_CHANGE — `boosts.active` is a provider integer count; any change of
 * at least one between two consecutive real observations of the asset is a
 * discrete provider-recorded change.
 */
export const BOOST_CHANGE_MIN_DELTA = 1;

/* ------------------------------------------------------------------ *
 * Shared page windows (used by the page modules)
 * ------------------------------------------------------------------ */

/**
 * COLLISION — families whose event onsets fall within this many ms of each
 * other "changed together". One provider m5 window: two onsets further apart
 * than the provider's shortest window are not the same move.
 */
export const COLLISION_WINDOW_MS = 5 * MINUTE;

/**
 * Trace filters. SESSION = everything retained. Offered only when the asset's
 * observations span them. Exported as INTELLIGENCE_RULES metadata
 * (TRACE_WINDOW_*_MS), which is where the trace filter reads its horizon.
 */
export const TRACE_WINDOW_5M_MS = 5 * MINUTE;
export const TRACE_WINDOW_15M_MS = 15 * MINUTE;
export const TRACE_WINDOW_1H_MS = 60 * MINUTE;

export const TRACE_WINDOWS_MS = {
  "5M": TRACE_WINDOW_5M_MS,
  "15M": TRACE_WINDOW_15M_MS,
  "1H": TRACE_WINDOW_1H_MS,
} as const;

/* ------------------------------------------------------------------ *
 * Divergence predicates (intel-2) — evaluated in divergence.ts
 * ------------------------------------------------------------------ */

/**
 * "Flat" price: |priceChange.m5| below this percent. PRODUCT-DEFINED, not
 * calibrated: one sixth of PRICE_EXPANSION_M5_PCT, i.e. clearly not an
 * expansion. Used only to say two metrics disagree, never to predict.
 */
export const DIVERGENCE_PRICE_FLAT_M5_PCT = 0.5;

/**
 * "Not accelerating" activity: a pace ratio (radar VA / TA) at or below 1.0,
 * i.e. the last five minutes ran no faster than the previous (h1 − m5) span.
 * A plain arithmetic boundary, PRODUCT-DEFINED.
 */
export const DIVERGENCE_ACTIVITY_FLAT_RATIO = 1.0;

export type DivergenceId =
  | "PRICE_VS_VOLUME"
  | "PRICE_VS_TXNS"
  | "VOLUME_VS_LIQUIDITY"
  | "BALANCE_VS_PRICE"
  | "BOOST_VS_ACTIVITY"
  | "PRICE_EXPANSION_WITHOUT_VOLUME";

export type DivergenceRule = {
  id: DivergenceId;
  /** Direction-neutral display label. */
  label: string;
  /** Provider fields that must ALL be present; any null → NOT_EVALUABLE (never false, never 0). */
  requiredFields: readonly string[];
  /** Two real same-pool session observations needed (a session delta). */
  needsSessionDelta: boolean;
  /** Each metric with its horizon. */
  metrics: readonly { name: string; horizon: string }[];
  /** Whether the compared windows overlap in time, and how that is handled. */
  overlap: string;
  /** The predicate, in words (exact thresholds referenced by name). */
  predicate: string;
  implementable: true;
  /** Which assets can be evaluated with the captured provider contract. */
  coverage: string;
};

const PACE_FIELDS = ["volume.m5", "volume.h1", "pairCreatedAt"] as const;
const TXN_PACE_FIELDS = ["txns.m5", "txns.h1", "pairCreatedAt"] as const;
const PACE_OVERLAP =
  "m5 ⊂ h1: compared as m5 pace vs the (h1 − m5) remainder over its real span (radar pace)";

export const DIVERGENCE_RULES: readonly DivergenceRule[] = [
  {
    id: "PRICE_VS_VOLUME",
    label: "PRICE / VOLUME · DIVERGED",
    requiredFields: ["priceChange.m5", ...PACE_FIELDS],
    needsSessionDelta: false,
    metrics: [
      { name: "PRICE CHANGE", horizon: "M5 (provider window)" },
      { name: "VOLUME ACCELERATION", horizon: "M5 PACE VS (H1 − M5) PACE" },
    ],
    overlap: `price M5 and volume M5 cover the same five minutes; ${PACE_OVERLAP}`,
    predicate: "VA ≥ VOLUME_ACCELERATION_MIN AND |priceChange.m5| < DIVERGENCE_PRICE_FLAT_M5_PCT",
    implementable: true,
    coverage: "canonical + feed pools with pairCreatedAt and ≥ 15 min of pool age",
  },
  {
    id: "PRICE_VS_TXNS",
    label: "PRICE / TRANSACTIONS · DIVERGED",
    requiredFields: ["priceChange.m5", ...TXN_PACE_FIELDS],
    needsSessionDelta: false,
    metrics: [
      { name: "PRICE CHANGE", horizon: "M5 (provider window)" },
      { name: "TXN ACCELERATION", horizon: "M5 PACE VS (H1 − M5) PACE" },
    ],
    overlap: `same five minutes; ${PACE_OVERLAP}`,
    predicate: "TA ≥ TXN_ACCELERATION_MIN AND |priceChange.m5| < DIVERGENCE_PRICE_FLAT_M5_PCT",
    implementable: true,
    coverage: "canonical + feed pools with pairCreatedAt and ≥ 15 min of pool age",
  },
  {
    id: "VOLUME_VS_LIQUIDITY",
    label: "VOLUME / LIQUIDITY · DIVERGED",
    requiredFields: [...PACE_FIELDS, "liquidity.usd (two same-pool observations)"],
    needsSessionDelta: true,
    metrics: [
      { name: "VOLUME ACCELERATION", horizon: "M5 PACE VS (H1 − M5) PACE" },
      {
        name: "LIQUIDITY CHANGE",
        horizon: `SESSION DELTA ≥ LIQUIDITY_CHANGE_LOOKBACK_MINUTES, same pool, ≤ SESSION_DELTA_MAX_SPAN_MS`,
      },
    ],
    overlap:
      "different horizons (provider M5 pace vs a session delta between two receive times); shown side by side, not combined",
    predicate:
      "VA ≥ VOLUME_ACCELERATION_MIN AND same-pool liquidity Δ ≤ −LIQUIDITY_CHANGE_MIN_REL with |Δ| ≥ LIQUIDITY_CHANGE_MIN_ABS_USD and previous ≥ LIQUIDITY_CHANGE_MIN_PREVIOUS_USD",
    implementable: true,
    coverage:
      "pools reporting liquidity (not HYPE/USDC), after ≥ 5 min of same-pool session observations",
  },
  {
    id: "BALANCE_VS_PRICE",
    label: "BUY/SELL BALANCE / PRICE · DIVERGED",
    requiredFields: ["txns.m5.buys", "txns.m5.sells", "priceChange.m5"],
    needsSessionDelta: false,
    metrics: [
      { name: "BUY/SELL BALANCE", horizon: "M5 (provider window, counts not USD)" },
      { name: "PRICE CHANGE", horizon: "M5 (provider window)" },
    ],
    overlap: "same M5 window; counts of trades vs price, not independent samples",
    predicate:
      "m5 sample ≥ IMBALANCE_MIN_SAMPLE_TXNS AND ((buys/max(sells,1) ≥ IMBALANCE_MIN_RATIO AND priceChange.m5 ≤ −DIVERGENCE_PRICE_FLAT_M5_PCT) OR (sells/max(buys,1) ≥ IMBALANCE_MIN_RATIO AND priceChange.m5 ≥ +DIVERGENCE_PRICE_FLAT_M5_PCT))",
    implementable: true,
    coverage: "canonical + feed pools with ≥ 8 m5 transactions",
  },
  {
    id: "BOOST_VS_ACTIVITY",
    label: "BOOST / ACTIVITY · DIVERGED",
    requiredFields: ["boosts.active (two same-pool observations)", ...TXN_PACE_FIELDS],
    needsSessionDelta: true,
    metrics: [
      { name: "ACTIVE BOOSTS CHANGE", horizon: "CONSECUTIVE SESSION OBSERVATIONS, same pool" },
      { name: "TXN ACCELERATION", horizon: "M5 PACE VS (H1 − M5) PACE" },
    ],
    overlap: "different horizons (session delta vs provider pace); shown side by side",
    predicate:
      "boosts.active increased by ≥ BOOST_CHANGE_MIN_DELTA AND TA ≤ DIVERGENCE_ACTIVITY_FLAT_RATIO",
    implementable: true,
    coverage:
      "feed pools only — boosts.active is absent from every captured canonical payload (NOT EVALUABLE there)",
  },
  {
    id: "PRICE_EXPANSION_WITHOUT_VOLUME",
    label: "PRICE EXPANSION / VOLUME · DIVERGED",
    requiredFields: ["priceChange.m5", ...PACE_FIELDS],
    needsSessionDelta: false,
    metrics: [
      { name: "PRICE CHANGE", horizon: "M5 (provider window)" },
      { name: "VOLUME ACCELERATION", horizon: "M5 PACE VS (H1 − M5) PACE" },
    ],
    overlap: `same five minutes; ${PACE_OVERLAP}`,
    predicate: "|priceChange.m5| ≥ PRICE_EXPANSION_M5_PCT AND VA ≤ DIVERGENCE_ACTIVITY_FLAT_RATIO",
    implementable: true,
    coverage: "canonical + feed pools with pairCreatedAt and ≥ 15 min of pool age",
  },
];

/* ------------------------------------------------------------------ *
 * Rule metadata — exportable, so pages can show threshold + horizon + origin
 * ------------------------------------------------------------------ */

export type RuleSource = "RADAR_IMPORTED" | "PRODUCT_DEFINED" | "QUERY_MIRROR";

export type RuleMeta = {
  id: string;
  value: number;
  unit: "PCT" | "RATIO" | "USD" | "FRACTION" | "COUNT" | "TXNS" | "MINUTES" | "MS" | "MULTIPLE";
  horizon: string;
  source: RuleSource;
  /** One line; never an empirical or predictive claim. */
  note: string;
};

export const INTELLIGENCE_RULES: readonly RuleMeta[] = [
  {
    id: "PRICE_EXPANSION_M5_PCT",
    value: PRICE_EXPANSION_M5_PCT,
    unit: "PCT",
    horizon: "M5 (provider window)",
    source: "PRODUCT_DEFINED",
    note: "Deterministic MARCOVAULT intel rule; product-defined threshold; not statistically calibrated; no forecast.",
  },
  {
    id: "VOLUME_ACCELERATION_MIN",
    value: VOLUME_ACCELERATION_MIN,
    unit: "RATIO",
    horizon: "M5 pace vs (H1 − M5) pace",
    source: "RADAR_IMPORTED",
    note: "Alpha Radar VA_MIN.",
  },
  {
    id: "TXN_ACCELERATION_MIN",
    value: TXN_ACCELERATION_MIN,
    unit: "RATIO",
    horizon: "M5 pace vs (H1 − M5) pace",
    source: "RADAR_IMPORTED",
    note: "Alpha Radar TA_MIN.",
  },
  {
    id: "IMBALANCE_MIN_RATIO",
    value: IMBALANCE_MIN_RATIO,
    unit: "RATIO",
    horizon: "M5 (provider window)",
    source: "RADAR_IMPORTED",
    note: "Alpha Radar BP_MIN, applied to both sides.",
  },
  {
    id: "IMBALANCE_MIN_SAMPLE_TXNS",
    value: IMBALANCE_MIN_SAMPLE_TXNS,
    unit: "TXNS",
    horizon: "M5 (provider window)",
    source: "RADAR_IMPORTED",
    note: "Alpha Radar BP_MIN_SAMPLE_TXNS.",
  },
  {
    id: "LIQUIDITY_CHANGE_MIN_REL",
    value: LIQUIDITY_CHANGE_MIN_REL,
    unit: "FRACTION",
    horizon: "Session delta, same pool",
    source: "RADAR_IMPORTED",
    note: "Alpha Radar LIQUIDITY_STABLE_MAX_DRAWDOWN.",
  },
  {
    id: "LIQUIDITY_CHANGE_MIN_ABS_USD",
    value: LIQUIDITY_CHANGE_MIN_ABS_USD,
    unit: "USD",
    horizon: "Session delta, same pool",
    source: "RADAR_IMPORTED",
    note: "Alpha Radar LIQUIDITY_EVENT_MIN_ABS_USD.",
  },
  {
    id: "LIQUIDITY_CHANGE_MIN_PREVIOUS_USD",
    value: LIQUIDITY_CHANGE_MIN_PREVIOUS_USD,
    unit: "USD",
    horizon: "Session delta, same pool",
    source: "RADAR_IMPORTED",
    note: "Alpha Radar LIQUIDITY_EVENT_MIN_PREVIOUS_USD.",
  },
  {
    id: "LIQUIDITY_CHANGE_LOOKBACK_MINUTES",
    value: LIQUIDITY_CHANGE_LOOKBACK_MINUTES,
    unit: "MINUTES",
    horizon: "Session delta, same pool",
    source: "RADAR_IMPORTED",
    note: "Alpha Radar LIQUIDITY_EVENT_LOOKBACK_MINUTES.",
  },
  {
    id: "BOOST_CHANGE_MIN_DELTA",
    value: BOOST_CHANGE_MIN_DELTA,
    unit: "COUNT",
    horizon: "Consecutive session observations, same pool",
    source: "PRODUCT_DEFINED",
    note: "Any change of the provider's integer count.",
  },
  {
    id: "SESSION_DELTA_MAX_SPAN_MS",
    value: SESSION_DELTA_MAX_SPAN_MS,
    unit: "MS",
    horizon: "Between two session observations",
    source: "PRODUCT_DEFINED",
    note: "Wider gaps hide the interval; no delta is computed.",
  },
  {
    id: "RUN_MAX_GAP_MS",
    value: RUN_MAX_GAP_MS,
    unit: "MS",
    horizon: "Consecutive observations",
    source: "PRODUCT_DEFINED",
    note: "3 × the slow lane cadence; beyond it continuity is broken.",
  },
  {
    id: "FRESHNESS_LIVE_CADENCES",
    value: FRESHNESS_LIVE_CADENCES,
    unit: "MULTIPLE",
    horizon: "Lane cadence (30 s → 45 s, 60 s → 90 s)",
    source: "PRODUCT_DEFINED",
    note: "Aligned with the landing freshness windows.",
  },
  {
    id: "LANE_CADENCE_REALTIME_MS",
    value: LANE_CADENCE_MS.realtime,
    unit: "MS",
    horizon: "Realtime lane",
    source: "QUERY_MIRROR",
    note: "Existing REALTIME_QUERY_KEY refetchInterval.",
  },
  {
    id: "LANE_CADENCE_UNIVERSE_MS",
    value: LANE_CADENCE_MS.universe,
    unit: "MS",
    horizon: "Universe lane",
    source: "QUERY_MIRROR",
    note: "Existing PAIR_UNIVERSE_KEY refetchInterval.",
  },
  {
    id: "SESSION_MAX_AGE_MS",
    value: SESSION_MAX_AGE_MS,
    unit: "MS",
    horizon: "Rolling session retention",
    source: "RADAR_IMPORTED",
    note: "Alpha Radar HISTORY_MAX_AGE_MINUTES.",
  },
  {
    id: "COLLISION_WINDOW_MS",
    value: COLLISION_WINDOW_MS,
    unit: "MS",
    horizon: "Event onsets",
    source: "PRODUCT_DEFINED",
    note: "One provider M5 window; co-occurrence only, not causality.",
  },
  {
    id: "TRACE_WINDOW_5M_MS",
    value: TRACE_WINDOW_5M_MS,
    unit: "MS",
    horizon: "Trace filter, latest observation back",
    source: "PRODUCT_DEFINED",
    note: "Offered only when the asset's session observations span it.",
  },
  {
    id: "TRACE_WINDOW_15M_MS",
    value: TRACE_WINDOW_15M_MS,
    unit: "MS",
    horizon: "Trace filter, latest observation back",
    source: "PRODUCT_DEFINED",
    note: "Offered only when the asset's session observations span it.",
  },
  {
    id: "TRACE_WINDOW_1H_MS",
    value: TRACE_WINDOW_1H_MS,
    unit: "MS",
    horizon: "Trace filter, latest observation back",
    source: "PRODUCT_DEFINED",
    note: "Offered only when the asset's session observations span it.",
  },
  {
    id: "DIVERGENCE_PRICE_FLAT_M5_PCT",
    value: DIVERGENCE_PRICE_FLAT_M5_PCT,
    unit: "PCT",
    horizon: "M5 (provider window)",
    source: "PRODUCT_DEFINED",
    note: "Product-defined 'flat price' boundary; not calibrated.",
  },
  {
    id: "DIVERGENCE_ACTIVITY_FLAT_RATIO",
    value: DIVERGENCE_ACTIVITY_FLAT_RATIO,
    unit: "RATIO",
    horizon: "M5 pace vs (H1 − M5) pace",
    source: "PRODUCT_DEFINED",
    note: "Pace no faster than the previous span.",
  },
];

export function ruleMeta(id: string): RuleMeta | null {
  return INTELLIGENCE_RULES.find((r) => r.id === id) ?? null;
}
