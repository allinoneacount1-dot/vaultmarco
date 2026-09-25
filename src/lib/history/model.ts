import type { Endpoint, HorizonMinutes } from "./constants";
import type { RadarStatus } from "@/lib/providers/universe";

/**
 * SIGNAL HISTORY data model.
 *
 * DURABLE PRODUCT DATA: SignalEvent (immutable), EpisodeState (narrow,
 * mutable), OutcomeObservation, RoundRecord (operational round / gap log).
 * TEMPORARY ENGINE STATE: EngineRound — raw snapshots kept only so the
 * deterministic rules can look back; never Signal History.
 *
 * All times are epoch milliseconds.
 */

export type SignalType = "EARLY_MOMENTUM" | "LIQUIDITY_ADDED" | "LIQUIDITY_REMOVED";

/** What one usable round tells us about one (asset, signal type). */
export type ObservationClass = "FIRED" | "VALID_NEGATIVE" | "NO_DATA";

/** Selected real PairSnapshot fields kept with an event or outcome — no full provider blobs. */
export type CompactSnapshot = {
  observedAt: number;
  pairAddress: string | null;
  dexId: string | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  fdv: number | null;
  marketCap: number | null;
  volumeM5: number | null;
  volumeH1: number | null;
  volumeH24: number | null;
  txnsM5: { buys: number; sells: number } | null;
  txnsH1: { buys: number; sells: number } | null;
  priceChangeM5: number | null;
  priceChangeH1: number | null;
  pairCreatedAt: number | null;
  boostsActive: number | null;
};

/** The existing engine's own rule object for the signal, stored as produced. */
export type SignalEvidence =
  | { type: "EARLY_MOMENTUM"; rule: import("@/lib/signals/momentum").MomentumSignal }
  | {
      type: "LIQUIDITY_ADDED" | "LIQUIDITY_REMOVED";
      rule: import("@/lib/signals/liquidity").LiquidityEvent;
    };

/** IMMUTABLE after insert. */
export type SignalEvent = {
  id: string;
  assetKey: string;
  chainId: string;
  /** Provider ORIGINAL base address. */
  address: string;
  /** The pair the signal fired on; outcomes observe THIS pair only. */
  pairAddress: string;
  symbol: string | null;
  type: SignalType;
  severity: "MEDIUM" | "HIGH" | null;
  rulesVersion: string;
  /** Round key and time of the round the signal first fired in. */
  openedRound: string;
  openedAt: number;
  evidence: SignalEvidence;
  openSnapshot: CompactSnapshot;
};

export type EpisodeCloseReason =
  /** Observed exit: EXIT_NEGATIVE_STREAK consecutive, continuous VALID_NEGATIVE observations. */
  | "SIGNAL_EXIT"
  /** No valid observation for TRACKING_LOST_MS. NOT an observed exit. */
  | "TRACKING_LOST"
  /** Thresholds changed; episodes under the old rules stop. NOT an observed exit. */
  | "RULES_CHANGED";

/** NARROW and mutable — the only per-round writes for an open episode. */
export type EpisodeState = {
  eventId: string;
  assetKey: string;
  type: SignalType;
  rulesVersion: string;
  status: "OPEN" | "CLOSED";
  closeReason: EpisodeCloseReason | null;
  closedAt: number | null;
  lastFiredAt: number;
  /** Last FIRED or VALID_NEGATIVE observation. */
  lastValidAt: number;
  /** Monotonic guard: rounds at or before this are ignored. */
  lastEvaluatedAt: number;
  negativeStreakCount: number;
  negativeStreakStartedAt: number | null;
  lastValidNegativeAt: number | null;
  roundsFired: number;
  peakVaRatio: number | null;
  peakAbsLiquidityDeltaUsd: number | null;
};

export type OutcomeAvailability = "PENDING" | "OBSERVED" | "UNAVAILABLE";

export type UnavailableReason =
  | "WINDOW_ELAPSED"
  | "PROVIDER_ERROR"
  | "RATE_LIMITED"
  | "PAIR_NOT_RETURNED"
  | "BUDGET_DEFERRED";

export type OutcomeSource = "ROUND" | "DUE_TOKEN_BATCH" | "PAIR_FALLBACK";

export type OutcomeObservation = {
  eventId: string;
  horizonMinutes: HorizonMinutes;
  targetAt: number;
  /** targetAt + tolerance; the last instant an observation is accepted. */
  windowEndAt: number;
  availability: OutcomeAvailability;
  unavailableReason: UnavailableReason | null;
  /** Most recent failure while PENDING — becomes the reason if the window elapses. */
  lastFailure: UnavailableReason | null;
  observedAt: number | null;
  /** observedAt − targetAt, in whole seconds (≥ 0). */
  delaySeconds: number | null;
  source: OutcomeSource | null;
  /** Must equal the event's pairAddress. */
  pairAddress: string | null;
  roundKey: string | null;
  market: CompactSnapshot | null;
  attempts: number;
};

/** A usable round is one whose observations may move an episode. */
export type RoundDataStatus = RadarStatus;

export type RoundState = "CLAIMED" | "COMPLETED" | "FAILED" | "GAP" | "SUPERSEDED";

export type RequestAccounting = Record<
  Endpoint,
  { attempts: number; ok: number; failed: number; rateLimited: number; skipped: number }
>;

export type RoundRecord = {
  /** Deterministic identity: the scheduled minute, e.g. "2026-09-26T00:07Z". */
  key: string;
  scheduledAt: number;
  state: RoundState;
  attempt: number;
  /** Claim owner token; commits are accepted only from the current owner. */
  owner: string | null;
  leaseUntil: number | null;
  /** Data status of the round (null for GAP / not yet finished). */
  dataStatus: RoundDataStatus | null;
  rulesVersion: string | null;
  universeSize: number | null;
  issues: string[];
  requests: RequestAccounting | null;
  finishedAt: number | null;
};

/** Temporary engine state: one row per round, pruned after ENGINE_RETENTION_MS. */
export type EngineRound = {
  key: string;
  observedAt: number;
  snapshots: import("@/lib/signals/pairSnapshot").PairSnapshot[];
};

/** Per-endpoint 429 cooldown, persisted across rounds. */
export type Cooldown = { endpoint: Endpoint; until: number; consecutive429: number };
