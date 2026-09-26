/**
 * SIGNAL HISTORY — every recorder constant in one place.
 *
 * Like `signals/thresholds.ts`, these are the only numbers the recorder is
 * allowed to compare against, so each behaviour (when an episode closes, when
 * an outcome is accepted, how much a round may request) traces back to one
 * named, documented value.
 */

const MINUTE = 60_000;

/* ------------------------------------------------------------------ *
 * Ruleset revision (part of every persisted rulesVersion)
 * ------------------------------------------------------------------ */

/**
 * SEMANTIC REVISION of the rules behind persisted Signal History.
 *
 * `rulesVersion` = hash(this revision + every numeric constant exported by
 * `signals/thresholds.ts`, sorted by name). Threshold numbers alone cannot
 * detect a change in what a rule MEANS, so this integer is bumped by hand.
 * A new rulesVersion closes every open episode as RULES_CHANGED; a signal that
 * still fires opens a new event under the new version in the same round.
 *
 * INCREMENT it in the same change whenever a production change can alter the
 * meaning of a persisted event, episode or outcome without necessarily
 * changing a threshold number, including changes to:
 *   - EARLY MOMENTUM semantics; volume (VA) or transaction (TA) acceleration;
 *     buy-pressure (BP); evidence evaluation
 *   - liquidity event semantics; liquidity lookback selection
 *   - signal qualification / gates
 *   - FIRED / VALID_NEGATIVE / NO_DATA classification
 *   - asset or signal identity (assetKey, event id inputs)
 *   - observation-time semantics
 *   - negative-streak continuity; SIGNAL_EXIT; TRACKING_LOST; RULES_CHANGED
 *   - episode opening / re-entry
 *   - any other rule whose change could make an existing event or episode
 *     mean something different
 *
 * Do NOT bump it for CSS, UI layout, colours, copy, unrelated React
 * components, docs-only or tests-only changes, or infrastructure / storage
 * adapter work that preserves recorder semantics — a bump closes every open
 * episode, so unrelated work must never cause one.
 *
 * Never derive it from a git SHA, branch, deployment id, package version or
 * build time: those change for unrelated work.
 */
export const HISTORY_RULESET_REVISION = 1;

/* ------------------------------------------------------------------ *
 * Episode lifecycle
 * ------------------------------------------------------------------ */

/** A SIGNAL_EXIT needs this many consecutive VALID_NEGATIVE observations. */
export const EXIT_NEGATIVE_STREAK = 5;

/**
 * Continuity of the exit streak: two consecutive VALID_NEGATIVE observations
 * may be at most this far apart. A longer gap (NO_DATA rounds or missed
 * minutes in between) restarts the streak at the newer observation, so a
 * streak can never bridge a period we did not observe.
 */
export const MAX_NEGATIVE_GAP_MS = 5 * MINUTE;

/**
 * An open episode with no VALID observation (FIRED or VALID_NEGATIVE) for
 * this long terminates as TRACKING_LOST — explicitly not a signal exit.
 */
export const TRACKING_LOST_MS = 60 * MINUTE;

/* ------------------------------------------------------------------ *
 * Outcomes
 * ------------------------------------------------------------------ */

/** Outcome horizons, minutes after the event opened. */
export const OUTCOME_HORIZONS_MINUTES = [5, 15, 60, 240, 1440] as const;
export type HorizonMinutes = (typeof OUTCOME_HORIZONS_MINUTES)[number];

/**
 * Tolerance per horizon. An observation is accepted only when
 *   targetAt ≤ observedAt ≤ targetAt + tolerance      (both ends inclusive)
 * — never before the target, never after the window.
 */
export const OUTCOME_TOLERANCE_MS: Record<HorizonMinutes, number> = {
  5: 2 * MINUTE,
  15: 3 * MINUTE,
  60: 10 * MINUTE,
  240: 20 * MINUTE,
  1440: 60 * MINUTE,
};

/** DexScreener accepts at most this many addresses per multi-address request. */
export const MAX_ADDRESSES_PER_REQUEST = 30;

/* ------------------------------------------------------------------ *
 * Rounds
 * ------------------------------------------------------------------ */

export const ROUND_INTERVAL_MS = MINUTE;

/** A claim is held this long; an unfinished round can be taken over after it. */
export const ROUND_LEASE_MS = 50_000;

/** Provider work must finish within this, leaving time to commit inside the lease. */
export const ROUND_DEADLINE_MS = 40_000;

/** At most this many missed minutes are recorded as GAP rows in one round (older gaps stay implicit). */
export const MAX_GAP_ROWS_PER_ROUND = 1440;

/* ------------------------------------------------------------------ *
 * Temporary engine state and operational retention
 * ------------------------------------------------------------------ */

/**
 * Engine snapshots are kept this long: the rules look back 5 (liquidity event)
 * and 60 (evidence) minutes, plus margin. They are engine state, never history.
 */
export const ENGINE_RETENTION_MS = 90 * MINUTE;

/** Round/gap operational records are kept this long. */
export const ROUND_LOG_RETENTION_MS = 30 * 24 * 60 * MINUTE;

/* ------------------------------------------------------------------ *
 * Provider request budget (per round)
 * ------------------------------------------------------------------ */

export type Endpoint =
  | "BOOST_LATEST"
  | "BOOST_TOP"
  | "ADS"
  | "CANONICAL_PAIR"
  | "TOKEN_ENRICHMENT"
  | "DUE_TOKEN_BATCH"
  | "PAIR_FALLBACK";

export const ENDPOINTS: readonly Endpoint[] = [
  "BOOST_LATEST",
  "BOOST_TOP",
  "ADS",
  "CANONICAL_PAIR",
  "TOKEN_ENRICHMENT",
  "DUE_TOKEN_BATCH",
  "PAIR_FALLBACK",
];

/** Hard per-round request cap per endpoint (first attempts). */
export const ENDPOINT_CAP_PER_ROUND: Record<Endpoint, number> = {
  BOOST_LATEST: 1,
  BOOST_TOP: 1,
  ADS: 1,
  CANONICAL_PAIR: 4,
  TOKEN_ENRICHMENT: 6,
  DUE_TOKEN_BATCH: 4,
  PAIR_FALLBACK: 2,
};

/** DexScreener rate-limit class of each endpoint (requests / minute). */
export const ENDPOINT_RATE_CLASS_RPM: Record<Endpoint, 60 | 300> = {
  BOOST_LATEST: 60,
  BOOST_TOP: 60,
  ADS: 60,
  CANONICAL_PAIR: 300,
  TOKEN_ENRICHMENT: 300,
  DUE_TOKEN_BATCH: 300,
  PAIR_FALLBACK: 300,
};

/** Retries for non-429 transient failures, across the whole round. */
export const RETRY_BUDGET_PER_ROUND = 4;

/** Jittered delay before a transient retry. */
export const RETRY_DELAY_MIN_MS = 1_000;
export const RETRY_DELAY_MAX_MS = 2_000;

/** Cooldown after a 429 without Retry-After: BASE × 2^(n−1), bounded by MAX. */
export const COOLDOWN_BASE_MS = MINUTE;
export const COOLDOWN_MAX_MS = 15 * MINUTE;

/** Absolute ceiling of requests one round can issue. */
export const ROUND_REQUEST_CEILING =
  Object.values(ENDPOINT_CAP_PER_ROUND).reduce((a, b) => a + b, 0) + RETRY_BUDGET_PER_ROUND;
