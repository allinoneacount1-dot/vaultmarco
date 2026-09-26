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

export const INTELLIGENCE_RULES_VERSION = "intel-1";

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
 * An observation is STALE once it is older than
 *   FRESHNESS_STALE_CADENCES × lane cadence + FRESHNESS_GRACE_MS.
 * Two missed polls plus request/retry time: one late poll is jitter, two is a
 * provider that is not answering. realtime → 90 s, universe → 150 s.
 */
export const FRESHNESS_STALE_CADENCES = 2;
export const FRESHNESS_GRACE_MS = 30 * SECOND;

export function staleAfterMs(lane: Lane): number {
  return FRESHNESS_STALE_CADENCES * LANE_CADENCE_MS[lane] + FRESHNESS_GRACE_MS;
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
 * PRICE_EXPANSION — |priceChange.m5| ≥ this percent (provider m5 window).
 * New to the suite (the radar has no price rule). 3 % in five minutes is an
 * order of magnitude above the canonical majors' recorded m5 moves (|m5| ≤
 * 0.07 % in the captured fixtures) and is the smallest round number that a
 * low-liquidity pool does not cross on ordinary noise every poll.
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

/** Trace filters. SESSION = everything retained. Offered only when observations span them. */
export const TRACE_WINDOWS_MS = {
  "5M": 5 * MINUTE,
  "15M": 15 * MINUTE,
  "1H": 60 * MINUTE,
} as const;
