/**
 * ALPHA RADAR — every threshold in one place.
 *
 * These are the only numbers the signal rules are allowed to compare against.
 * Each one is a named, documented constant so a signal shown in the UI can be
 * traced back to the exact rule and value that produced it, and so they can be
 * recalibrated later from recorded signal history without touching the rules.
 *
 * Nothing here is a score weight. There is no composite score.
 */

/* ------------------------------------------------------------------ *
 * Recent-vs-previous window comparison (VA / TA)
 * ------------------------------------------------------------------ */

/** The "recent" window is the provider's 5-minute bucket. */
export const RECENT_WINDOW_MINUTES = 5;

/**
 * For pairs at least an hour old the previous window is the rest of the
 * provider's 1-hour bucket: 60 − 5 minutes.
 */
export const PREVIOUS_WINDOW_MINUTES_MATURE = 55;

/**
 * For pairs younger than an hour, the h1 bucket only covers the pair's
 * lifetime, so the previous window is `age − 5` minutes — but never shorter
 * than this, or a few seconds of history would be scaled up into a fake pace.
 */
export const MIN_SAFE_PREVIOUS_MINUTES = 10;

/** Below this much previous-window volume there is nothing to compare against. */
export const MIN_PREVIOUS_VOLUME_USD = 100;

/** Below this many previous-window transactions there is nothing to compare against. */
export const MIN_PREVIOUS_TXNS = 5;

/* ------------------------------------------------------------------ *
 * EARLY MOMENTUM rule
 * ------------------------------------------------------------------ */

/** Volume acceleration: recent pace must be at least this multiple of the previous pace. */
export const VA_MIN = 3.0;

/** Transaction acceleration: recent pace must be at least this multiple of the previous pace. */
export const TA_MIN = 2.0;

/** Buy pressure: m5 buys / m5 sells must be at least this. */
export const BP_MIN = 1.5;

/**
 * Hard sample guard for buy pressure: with fewer m5 transactions than this the
 * ratio is noise and is not used as evidence at all.
 */
export const BP_MIN_SAMPLE_TXNS = 8;

/** Pools thinner than this are ignored by the momentum rule. */
export const MIN_LIQUIDITY_USD = 25_000;

/** Pairs younger than this are ignored by the momentum rule. */
export const MIN_PAIR_AGE_MINUTES = 10;

/**
 * "Liquidity stable" evidence: liquidity over the lookback must not have
 * fallen by more than this fraction.
 */
export const LIQUIDITY_STABLE_MAX_DRAWDOWN = 0.1;

/** How far back we look for the liquidity-stable and boost-delta evidence. */
export const EVIDENCE_LOOKBACK_MINUTES = 60;

/** Boost delta (active boosts now − active boosts at lookback) counts as evidence from this value. */
export const BOOST_DELTA_MIN = 5;

/* ------------------------------------------------------------------ *
 * LIQUIDITY EVENT rule (RISK mode)
 * ------------------------------------------------------------------ */

/** Compare current liquidity against the snapshot at least this many minutes old. */
export const LIQUIDITY_EVENT_LOOKBACK_MINUTES = 5;

/**
 * An event needs BOTH a relative and an absolute move, measured against a
 * pool that was meaningful to begin with — so a $500 → $350 pool is never
 * reported alongside $500K → $350K.
 */
export const LIQUIDITY_EVENT_MIN_REL = 0.25;
export const LIQUIDITY_EVENT_MIN_ABS_USD = 10_000;
export const LIQUIDITY_EVENT_MIN_PREVIOUS_USD = 25_000;

/** HIGH severity needs both of these; anything else that qualifies is MEDIUM. */
export const LIQUIDITY_EVENT_HIGH_REL = 0.5;
export const LIQUIDITY_EVENT_HIGH_ABS_USD = 50_000;

/* ------------------------------------------------------------------ *
 * Snapshot history
 * ------------------------------------------------------------------ */

/** Snapshots older than this are dropped from the in-memory history. */
export const HISTORY_MAX_AGE_MINUTES = 60;
