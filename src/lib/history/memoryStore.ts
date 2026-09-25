import type { CommitResult, RecorderStore, RoundCommit } from "./ports";
import type {
  Cooldown,
  EngineRound,
  EpisodeState,
  OutcomeObservation,
  RoundRecord,
  SignalEvent,
} from "./model";
import { canCommit } from "./rounds";
import { outcomeKey } from "./duePlanner";

/**
 * In-memory RecorderStore. It enforces the SAME invariants the Postgres schema
 * will (so the recorder is tested against them now):
 *   • at most one OPEN episode per (assetKey, type)
 *   • one outcome per (eventId, horizon); updates only from PENDING
 *   • events are immutable (insert-once by id)
 *   • episode updates are compare-and-set on lastEvaluatedAt
 *   • commits only from the current (owner, attempt); all-or-nothing
 */
export class MemoryRecorderStore implements RecorderStore {
  rounds = new Map<string, RoundRecord>();
  engine = new Map<string, EngineRound>();
  eventsById = new Map<string, SignalEvent>();
  episodes = new Map<string, EpisodeState>();
  outcomes = new Map<string, OutcomeObservation>();
  cooldownsByEndpoint = new Map<string, Cooldown>();
  commits = 0;

  async loadEngineRounds(sinceMs: number) {
    return [...this.engine.values()]
      .filter((r) => r.observedAt >= sinceMs)
      .sort((a, b) => a.observedAt - b.observedAt);
  }
  async getRound(key: string) {
    return this.rounds.get(key) ?? null;
  }
  async newestFinishedAt() {
    let n: number | null = null;
    for (const r of this.rounds.values()) {
      if ((r.state === "COMPLETED" || r.state === "FAILED") && (n == null || r.scheduledAt > n)) {
        n = r.scheduledAt;
      }
    }
    return n;
  }
  async newestKnownAt() {
    let n: number | null = null;
    for (const r of this.rounds.values()) if (n == null || r.scheduledAt > n) n = r.scheduledAt;
    return n;
  }
  async roundExists(key: string) {
    return this.rounds.has(key);
  }
  async tryClaim(next: RoundRecord, expected: RoundRecord | null) {
    const cur = this.rounds.get(next.key) ?? null;
    const same =
      (cur == null && expected == null) ||
      (cur != null &&
        expected != null &&
        cur.attempt === expected.attempt &&
        cur.owner === expected.owner &&
        cur.state === expected.state);
    if (!same) return false;
    this.rounds.set(next.key, next);
    return true;
  }
  async openEpisodes() {
    return [...this.episodes.values()].filter((e) => e.status === "OPEN");
  }
  async pendingOutcomes() {
    return [...this.outcomes.values()].filter((o) => o.availability === "PENDING");
  }
  async events(ids: readonly string[]) {
    return ids.map((id) => this.eventsById.get(id)).filter((e): e is SignalEvent => !!e);
  }
  async cooldowns() {
    return [...this.cooldownsByEndpoint.values()];
  }

  async commit(c: RoundCommit): Promise<CommitResult> {
    // ---- validate everything first (all-or-nothing) ----
    if (!canCommit(this.rounds.get(c.round.key) ?? null, c.owner, c.attempt)) {
      return { ok: false, reason: "NOT_OWNER" };
    }
    const nextEpisodes = new Map(this.episodes);
    for (const { episode, expectedLastEvaluatedAt } of c.episodes) {
      const cur = nextEpisodes.get(episode.eventId);
      if (expectedLastEvaluatedAt == null) {
        if (cur) continue; // replayed open: idempotent no-op
      } else if (!cur || cur.lastEvaluatedAt !== expectedLastEvaluatedAt) {
        return { ok: false, reason: "EPISODE_CONFLICT" };
      }
      nextEpisodes.set(episode.eventId, episode);
    }
    const openKeys = new Set<string>();
    for (const e of nextEpisodes.values()) {
      if (e.status !== "OPEN") continue;
      const k = `${e.type}|${e.assetKey}`;
      if (openKeys.has(k)) return { ok: false, reason: "DUPLICATE_OPEN_EPISODE" };
      openKeys.add(k);
    }

    // ---- apply ----
    for (const g of c.gaps) if (!this.rounds.has(g.key)) this.rounds.set(g.key, g);
    this.rounds.set(c.round.key, c.round);
    if (c.engine.put) this.engine.set(c.engine.put.key, c.engine.put);
    for (const [k, r] of this.engine)
      if (r.observedAt < c.engine.pruneBefore) this.engine.delete(k);
    for (const e of c.events) if (!this.eventsById.has(e.id)) this.eventsById.set(e.id, e);
    this.episodes = nextEpisodes;
    for (const o of c.outcomeInserts) {
      const k = outcomeKey(o.eventId, o.horizonMinutes);
      if (!this.outcomes.has(k)) this.outcomes.set(k, o);
    }
    for (const o of c.outcomeUpdates) {
      const k = outcomeKey(o.eventId, o.horizonMinutes);
      if (this.outcomes.get(k)?.availability === "PENDING") this.outcomes.set(k, o);
    }
    for (const cd of c.cooldowns) this.cooldownsByEndpoint.set(cd.endpoint, cd);
    for (const [k, r] of this.rounds) {
      if (r.scheduledAt < c.pruneRoundLogBefore && r.state !== "CLAIMED") this.rounds.delete(k);
    }
    this.commits++;
    return { ok: true };
  }
}
