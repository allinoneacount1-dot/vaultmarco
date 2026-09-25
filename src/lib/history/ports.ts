import type {
  Cooldown,
  EngineRound,
  EpisodeState,
  OutcomeObservation,
  RoundRecord,
  SignalEvent,
} from "./model";

/**
 * STORAGE PORTS. Implemented later by a Postgres adapter (Step B) and today by
 * the in-memory store used in tests. The recorder never sees SQL, SDKs or
 * connection details.
 *
 * Transaction boundary (Step B): `claim` is its own short write; provider I/O
 * happens with NO transaction open; `commit` is one short transaction that
 * re-verifies the claim and applies everything atomically — or nothing.
 */

/** TEMPORARY ENGINE STATE — its own boundary; never read as Signal History. */
export interface EngineStateRepository {
  /** Rounds observed at or after `sinceMs`, oldest first. */
  loadEngineRounds(sinceMs: number): Promise<EngineRound[]>;
}

export interface RoundRepository {
  getRound(key: string): Promise<RoundRecord | null>;
  /** Scheduled time of the newest COMPLETED/FAILED round, or null. */
  newestFinishedAt(): Promise<number | null>;
  /** Scheduled time of the newest round of any state, or null. */
  newestKnownAt(): Promise<number | null>;
  roundExists(key: string): Promise<boolean>;
  /**
   * Compare-and-set claim: writes `next` only if the stored record still
   * equals `expected` (null = must not exist). Returns whether it won.
   */
  tryClaim(next: RoundRecord, expected: RoundRecord | null): Promise<boolean>;
}

/** DURABLE PRODUCT DATA reads the recorder needs. */
export interface HistoryRepository {
  openEpisodes(): Promise<EpisodeState[]>;
  pendingOutcomes(): Promise<OutcomeObservation[]>;
  events(ids: readonly string[]): Promise<SignalEvent[]>;
  cooldowns(): Promise<Cooldown[]>;
}

export type RoundCommit = {
  /** Final round record; accepted only if (owner, attempt) still hold the claim. */
  round: RoundRecord;
  owner: string;
  attempt: number;
  gaps: RoundRecord[];
  engine: { put: EngineRound | null; pruneBefore: number };
  events: SignalEvent[];
  /** expectedLastEvaluatedAt null = new episode. */
  episodes: Array<{ episode: EpisodeState; expectedLastEvaluatedAt: number | null }>;
  outcomeInserts: OutcomeObservation[];
  /** Applied only where the stored outcome is still PENDING. */
  outcomeUpdates: OutcomeObservation[];
  cooldowns: Cooldown[];
  pruneRoundLogBefore: number;
};

export type CommitResult =
  | { ok: true }
  | { ok: false; reason: "NOT_OWNER" | "EPISODE_CONFLICT" | "DUPLICATE_OPEN_EPISODE" };

export interface RecorderStore extends EngineStateRepository, RoundRepository, HistoryRepository {
  /** One atomic transaction: everything or nothing. */
  commit(c: RoundCommit): Promise<CommitResult>;
}
