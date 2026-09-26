import { ENDPOINTS, type Endpoint, type HorizonMinutes } from "@/lib/history/constants";
import { roundKey } from "@/lib/history/ids";
import type {
  CompactSnapshot,
  Cooldown,
  EngineRound,
  EpisodeState,
  OutcomeObservation,
  RequestAccounting,
  RoundRecord,
  SignalEvent,
} from "@/lib/history/model";
import type { CommitResult, RecorderStore, RoundCommit } from "@/lib/history/ports";
import type { PgPool, PgQueryable, Row } from "./pg";

/**
 * POSTGRES RecorderStore — the same logical contract as MemoryRecorderStore,
 * enforced by real SQL (see supabase/migrations/*_signal_history_recorder.sql):
 *
 *   claim     INSERT … ON CONFLICT DO NOTHING; takeover is a compare-and-set
 *             UPDATE on the expected (state, attempt, owner) that also requires
 *             the lease to have expired on the store clock. One short statement.
 *   commit    ONE transaction, opened only after all provider I/O is done:
 *             lock the round row (FOR UPDATE) → verify owner + attempt →
 *             events (insert-once) → episode CAS updates → new episodes →
 *             pending / resolved outcomes → engine state → cooldowns → GAP rows
 *             → final round row → retention. Any failure rolls everything back.
 *
 * Every statement takes ONE jsonb parameter (or text scalars), so values are
 * typed by SQL, not guessed by the driver. Times cross the boundary as epoch
 * milliseconds via engine.ms_to_ts / engine.ts_to_ms (exact integer maths).
 */

const COUNTERS = ["attempts", "ok", "failed", "rateLimited", "skipped"] as const;

class CommitAbort extends Error {
  constructor(readonly reason: "NOT_OWNER" | "EPISODE_CONFLICT") {
    super(reason);
  }
}

const json = (v: unknown) => JSON.stringify(v);
const num = (v: unknown): number => Number(v);
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

export function accountingToArray(a: RequestAccounting | null): number[] | null {
  if (!a) return null;
  return ENDPOINTS.flatMap((e) => COUNTERS.map((c) => a[e][c]));
}

export function arrayToAccounting(arr: readonly unknown[] | null): RequestAccounting | null {
  if (!arr) return null;
  return Object.fromEntries(
    ENDPOINTS.map((e, i) => [
      e,
      Object.fromEntries(COUNTERS.map((c, j) => [c, Number(arr[i * 5 + j])])),
    ]),
  ) as RequestAccounting;
}

const roundRow = (r: RoundRecord) => ({
  key: r.key,
  scheduled_at: r.scheduledAt,
  state: r.state,
  attempt: r.attempt,
  owner: r.owner,
  lease_until: r.leaseUntil,
  data_status: r.dataStatus,
  rules_version: r.rulesVersion,
  universe_size: r.universeSize,
  issues: r.issues,
  requests: accountingToArray(r.requests),
  finished_at: r.finishedAt,
});

const ROUND_COLUMNS = `key text, scheduled_at bigint, state text, attempt smallint, owner text,
  lease_until bigint, data_status text, rules_version text, universe_size smallint, issues text[],
  requests smallint[], finished_at bigint`;

const SELECT_ROUND = `select key, engine.ts_to_ms(scheduled_at)::float8 as scheduled_at, state, attempt,
  owner, engine.ts_to_ms(lease_until)::float8 as lease_until, data_status, rules_version,
  universe_size, issues, requests, engine.ts_to_ms(finished_at)::float8 as finished_at
  from history.signal_round`;

function toRound(r: Row): RoundRecord {
  return {
    key: String(r.key),
    scheduledAt: num(r.scheduled_at),
    state: r.state as RoundRecord["state"],
    attempt: num(r.attempt),
    owner: (r.owner as string | null) ?? null,
    leaseUntil: numOrNull(r.lease_until),
    dataStatus: (r.data_status as RoundRecord["dataStatus"]) ?? null,
    rulesVersion: (r.rules_version as string | null) ?? null,
    universeSize: numOrNull(r.universe_size),
    issues: ((r.issues as string[] | null) ?? []).map(String),
    requests: arrayToAccounting((r.requests as unknown[] | null) ?? null),
    finishedAt: numOrNull(r.finished_at),
  };
}

const EPISODE_COLUMNS = `event_id text, asset_key text, type text, rules_version text, status text,
  close_reason text, closed_at bigint, last_fired_at bigint, last_valid_at bigint,
  last_evaluated_at bigint, negative_streak_count smallint, negative_streak_started_at bigint,
  last_valid_negative_at bigint, rounds_fired integer, peak_va_ratio float8,
  peak_abs_liquidity_delta float8, expected bigint`;

const episodeRow = (e: EpisodeState, expected: number | null) => ({
  event_id: e.eventId,
  asset_key: e.assetKey,
  type: e.type,
  rules_version: e.rulesVersion,
  status: e.status,
  close_reason: e.closeReason,
  closed_at: e.closedAt,
  last_fired_at: e.lastFiredAt,
  last_valid_at: e.lastValidAt,
  last_evaluated_at: e.lastEvaluatedAt,
  negative_streak_count: e.negativeStreakCount,
  negative_streak_started_at: e.negativeStreakStartedAt,
  last_valid_negative_at: e.lastValidNegativeAt,
  rounds_fired: e.roundsFired,
  peak_va_ratio: e.peakVaRatio,
  peak_abs_liquidity_delta: e.peakAbsLiquidityDeltaUsd,
  expected,
});

const OUTCOME_COLUMNS = `event_id text, horizon smallint, availability text, unavailable_reason text,
  last_failure text, target_at bigint, window_end_at bigint, observed_at bigint,
  delay_seconds integer, source text, round_at bigint, pair_address text, price_usd float8,
  liquidity_usd float8, fdv float8, market_cap float8, volume_h1 float8, volume_h24 float8,
  txns_h1_buys integer, txns_h1_sells integer, price_change_h1 float8, attempts smallint`;

const outcomeRow = (o: OutcomeObservation) => {
  const m: CompactSnapshot | null = o.market;
  return {
    event_id: o.eventId,
    horizon: o.horizonMinutes,
    availability: o.availability,
    unavailable_reason: o.unavailableReason,
    last_failure: o.lastFailure,
    target_at: o.targetAt,
    window_end_at: o.windowEndAt,
    observed_at: o.observedAt,
    delay_seconds: o.delaySeconds,
    source: o.source,
    round_at: o.roundKey ? Date.parse(o.roundKey) : null,
    pair_address: o.pairAddress,
    price_usd: m?.priceUsd ?? null,
    liquidity_usd: m?.liquidityUsd ?? null,
    fdv: m?.fdv ?? null,
    market_cap: m?.marketCap ?? null,
    volume_h1: m?.volumeH1 ?? null,
    volume_h24: m?.volumeH24 ?? null,
    txns_h1_buys: m?.txnsH1?.buys ?? null,
    txns_h1_sells: m?.txnsH1?.sells ?? null,
    price_change_h1: m?.priceChangeH1 ?? null,
    attempts: o.attempts,
  };
};

const INSERT_DURABLE_OUTCOMES_FROM = (source: string) => `
  insert into history.signal_outcome (event_id, horizon_minutes, availability, unavailable_reason,
    target_at, window_end_at, observed_at, delay_seconds, source, round_at, pair_address, price_usd,
    liquidity_usd, fdv, market_cap, volume_h1, volume_h24, txns_h1_buys, txns_h1_sells,
    price_change_h1, attempts)
  select x.event_id, x.horizon, x.availability, x.unavailable_reason, engine.ms_to_ts(x.target_at),
    engine.ms_to_ts(x.window_end_at), engine.ms_to_ts(x.observed_at), x.delay_seconds, x.source,
    engine.ms_to_ts(x.round_at), x.pair_address, x.price_usd, x.liquidity_usd, x.fdv, x.market_cap,
    x.volume_h1, x.volume_h24, x.txns_h1_buys, x.txns_h1_sells, x.price_change_h1, x.attempts
  ${source}`;

export type PgRecorderStoreOptions = {
  /** Store clock (the same one the recorder uses): claim start times and lease-expiry checks. */
  now: () => number;
};

export class PgRecorderStore implements RecorderStore {
  constructor(
    private readonly pool: PgPool,
    private readonly opts: PgRecorderStoreOptions,
  ) {}

  // ---- temporary engine state ------------------------------------------------
  async loadEngineRounds(sinceMs: number): Promise<EngineRound[]> {
    const rows = await this.pool.query(
      `select key, engine.ts_to_ms(scheduled_at)::float8 as at, snapshots
       from engine.snapshot_round where scheduled_at >= engine.ms_to_ts($1::bigint)
       order by scheduled_at`,
      [String(sinceMs)],
    );
    return rows.map((r) => ({
      key: String(r.key),
      observedAt: num(r.at),
      snapshots: r.snapshots as EngineRound["snapshots"],
    }));
  }

  // ---- rounds ------------------------------------------------------------------
  async getRound(key: string): Promise<RoundRecord | null> {
    const [r] = await this.pool.query(`${SELECT_ROUND} where key = $1`, [key]);
    return r ? toRound(r) : null;
  }

  async newestFinishedAt(): Promise<number | null> {
    const [r] = await this.pool.query(
      `select engine.ts_to_ms(max(scheduled_at))::float8 as at from history.signal_round
       where state in ('COMPLETED', 'FAILED')`,
    );
    return numOrNull(r?.at);
  }

  async newestKnownAt(): Promise<number | null> {
    const [r] = await this.pool.query(
      `select engine.ts_to_ms(max(scheduled_at))::float8 as at from history.signal_round`,
    );
    return numOrNull(r?.at);
  }

  async roundExists(key: string): Promise<boolean> {
    const rows = await this.pool.query(`select 1 from history.signal_round where key = $1`, [key]);
    return rows.length > 0;
  }

  async tryClaim(next: RoundRecord, expected: RoundRecord | null): Promise<boolean> {
    const payload = { ...roundRow(next), now: this.opts.now() };
    if (expected == null) {
      const rows = await this.pool.query(
        `insert into history.signal_round (key, scheduled_at, state, attempt, owner, lease_until,
           data_status, rules_version, universe_size, issues, requests, started_at, finished_at)
         select x.key, engine.ms_to_ts(x.scheduled_at), x.state, x.attempt, x.owner,
           engine.ms_to_ts(x.lease_until), x.data_status, x.rules_version, x.universe_size,
           coalesce(x.issues, '{}'), x.requests,
           case when x.state = 'CLAIMED' then engine.ms_to_ts(x.now) end, engine.ms_to_ts(x.finished_at)
         from jsonb_to_record($1::text::jsonb) as x(${ROUND_COLUMNS}, now bigint)
         on conflict do nothing
         returning key`,
        [json(payload)],
      );
      return rows.length === 1;
    }
    const rows = await this.pool.query(
      `update history.signal_round r set
         state = x.state, attempt = x.attempt, owner = x.owner,
         lease_until = engine.ms_to_ts(x.lease_until), data_status = x.data_status,
         rules_version = x.rules_version, universe_size = x.universe_size,
         issues = coalesce(x.issues, '{}'), requests = x.requests,
         started_at = case when x.state = 'CLAIMED' then engine.ms_to_ts(x.now) else r.started_at end,
         finished_at = engine.ms_to_ts(x.finished_at)
       from jsonb_to_record($1::text::jsonb) as x(${ROUND_COLUMNS}, now bigint,
         exp_state text, exp_attempt smallint, exp_owner text)
       where r.key = x.key
         and r.state = x.exp_state and r.attempt = x.exp_attempt
         and r.owner is not distinct from x.exp_owner
         -- a takeover (CLAIMED → CLAIMED) additionally requires the lease to have expired
         and (x.state <> 'CLAIMED' or r.state <> 'CLAIMED' or r.lease_until <= engine.ms_to_ts(x.now))
       returning r.key`,
      [
        json({
          ...payload,
          exp_state: expected.state,
          exp_attempt: expected.attempt,
          exp_owner: expected.owner,
        }),
      ],
    );
    return rows.length === 1;
  }

  // ---- durable product data --------------------------------------------------
  async openEpisodes(): Promise<EpisodeState[]> {
    const rows = await this.pool.query(
      `select event_id, asset_key, type, rules_version, status, close_reason,
         engine.ts_to_ms(closed_at)::float8 as closed_at,
         engine.ts_to_ms(last_fired_at)::float8 as last_fired_at,
         engine.ts_to_ms(last_valid_at)::float8 as last_valid_at,
         engine.ts_to_ms(last_evaluated_at)::float8 as last_evaluated_at,
         negative_streak_count,
         engine.ts_to_ms(negative_streak_started_at)::float8 as negative_streak_started_at,
         engine.ts_to_ms(last_valid_negative_at)::float8 as last_valid_negative_at,
         rounds_fired, peak_va_ratio, peak_abs_liquidity_delta
       from history.signal_episode where status = 'OPEN' order by event_id`,
    );
    return rows.map(toEpisode);
  }

  async pendingOutcomes(): Promise<OutcomeObservation[]> {
    const rows = await this.pool.query(
      `select event_id, horizon_minutes, engine.ts_to_ms(target_at)::float8 as target_at,
         engine.ts_to_ms(window_end_at)::float8 as window_end_at, last_failure, attempts
       from engine.pending_outcome order by target_at, event_id, horizon_minutes`,
    );
    return rows.map((r) => ({
      eventId: String(r.event_id),
      horizonMinutes: num(r.horizon_minutes) as HorizonMinutes,
      targetAt: num(r.target_at),
      windowEndAt: num(r.window_end_at),
      availability: "PENDING",
      unavailableReason: null,
      lastFailure: (r.last_failure as OutcomeObservation["lastFailure"]) ?? null,
      observedAt: null,
      delaySeconds: null,
      source: null,
      pairAddress: null,
      roundKey: null,
      market: null,
      attempts: num(r.attempts),
    }));
  }

  async events(ids: readonly string[]): Promise<SignalEvent[]> {
    if (ids.length === 0) return [];
    const rows = await this.pool.query(
      `select id, asset_key, chain_id, address, pair_address, symbol, type, severity, rules_version,
         engine.ts_to_ms(opened_round)::float8 as opened_round,
         engine.ts_to_ms(opened_at)::float8 as opened_at, evidence, open_snapshot
       from history.signal_event
       where id in (select jsonb_array_elements_text($1::text::jsonb)) order by id`,
      [json(ids)],
    );
    return rows.map((r) => ({
      id: String(r.id),
      assetKey: String(r.asset_key),
      chainId: String(r.chain_id),
      address: String(r.address),
      pairAddress: String(r.pair_address),
      symbol: (r.symbol as string | null) ?? null,
      type: r.type as SignalEvent["type"],
      severity: (r.severity as SignalEvent["severity"]) ?? null,
      rulesVersion: String(r.rules_version),
      openedRound: roundKey(num(r.opened_round)),
      openedAt: num(r.opened_at),
      evidence: r.evidence as SignalEvent["evidence"],
      openSnapshot: r.open_snapshot as SignalEvent["openSnapshot"],
    }));
  }

  async cooldowns(): Promise<Cooldown[]> {
    const rows = await this.pool.query(
      `select endpoint, engine.ts_to_ms(until)::float8 as until, consecutive_429
       from engine.provider_cooldown order by endpoint`,
    );
    return rows.map((r) => ({
      endpoint: r.endpoint as Endpoint,
      until: num(r.until),
      consecutive429: num(r.consecutive_429),
    }));
  }

  // ---- the atomic commit -------------------------------------------------------
  async commit(c: RoundCommit): Promise<CommitResult> {
    try {
      await this.pool.transaction((tx) => this.applyCommit(tx, c));
      return { ok: true };
    } catch (err) {
      if (err instanceof CommitAbort) return { ok: false, reason: err.reason };
      if (isUniqueViolation(err, "signal_episode_one_open")) {
        return { ok: false, reason: "DUPLICATE_OPEN_EPISODE" };
      }
      throw err;
    }
  }

  private async applyCommit(tx: PgQueryable, c: RoundCommit): Promise<void> {
    // 1. Lock and re-verify the claim: only the current (owner, attempt) may commit.
    const [cur] = await tx.query(
      `select state, owner, attempt from history.signal_round where key = $1 for update`,
      [c.round.key],
    );
    if (
      !cur ||
      cur.state !== "CLAIMED" ||
      cur.owner !== c.owner ||
      num(cur.attempt) !== c.attempt
    ) {
      throw new CommitAbort("NOT_OWNER");
    }

    // 2. Events: insert-once by deterministic id; an existing event is never rewritten.
    if (c.events.length > 0) {
      await tx.query(
        `insert into history.signal_event (id, asset_key, chain_id, address, pair_address, symbol,
           type, severity, rules_version, opened_round, opened_at, evidence, open_snapshot)
         select x.id, x.asset_key, x.chain_id, x.address, x.pair_address, x.symbol, x.type,
           x.severity, x.rules_version, engine.ms_to_ts(x.opened_round), engine.ms_to_ts(x.opened_at),
           x.evidence, x.open_snapshot
         from jsonb_to_recordset($1::text::jsonb) as x(id text, asset_key text, chain_id text,
           address text, pair_address text, symbol text, type text, severity text,
           rules_version text, opened_round bigint, opened_at bigint, evidence jsonb, open_snapshot jsonb)
         on conflict (id) do nothing`,
        [
          json(
            c.events.map((e) => ({
              id: e.id,
              asset_key: e.assetKey,
              chain_id: e.chainId,
              address: e.address,
              pair_address: e.pairAddress,
              symbol: e.symbol,
              type: e.type,
              severity: e.severity,
              rules_version: e.rulesVersion,
              opened_round: Date.parse(e.openedRound),
              opened_at: e.openedAt,
              evidence: e.evidence,
              open_snapshot: e.openSnapshot,
            })),
          ),
        ],
      );
    }

    // 3. Episode compare-and-set updates FIRST (a close and a re-open of the same
    //    asset/type in one round must not trip the one-OPEN index).
    const updates = c.episodes.filter((e) => e.expectedLastEvaluatedAt != null);
    if (updates.length > 0) {
      const rows = await tx.query(
        `update history.signal_episode e set
           status = x.status, close_reason = x.close_reason, closed_at = engine.ms_to_ts(x.closed_at),
           last_fired_at = engine.ms_to_ts(x.last_fired_at),
           last_valid_at = engine.ms_to_ts(x.last_valid_at),
           last_evaluated_at = engine.ms_to_ts(x.last_evaluated_at),
           negative_streak_count = x.negative_streak_count,
           negative_streak_started_at = engine.ms_to_ts(x.negative_streak_started_at),
           last_valid_negative_at = engine.ms_to_ts(x.last_valid_negative_at),
           rounds_fired = x.rounds_fired, peak_va_ratio = x.peak_va_ratio,
           peak_abs_liquidity_delta = x.peak_abs_liquidity_delta
         from jsonb_to_recordset($1::text::jsonb) as x(${EPISODE_COLUMNS})
         where e.event_id = x.event_id and e.last_evaluated_at = engine.ms_to_ts(x.expected)
         returning e.event_id`,
        [json(updates.map((u) => episodeRow(u.episode, u.expectedLastEvaluatedAt)))],
      );
      if (rows.length !== updates.length) throw new CommitAbort("EPISODE_CONFLICT");
    }

    // 4. New episodes (a replayed open of the same event is an idempotent no-op).
    const opens = c.episodes.filter((e) => e.expectedLastEvaluatedAt == null);
    if (opens.length > 0) {
      await tx.query(
        `insert into history.signal_episode (event_id, asset_key, type, rules_version, status,
           close_reason, closed_at, last_fired_at, last_valid_at, last_evaluated_at,
           negative_streak_count, negative_streak_started_at, last_valid_negative_at, rounds_fired,
           peak_va_ratio, peak_abs_liquidity_delta)
         select x.event_id, x.asset_key, x.type, x.rules_version, x.status, x.close_reason,
           engine.ms_to_ts(x.closed_at), engine.ms_to_ts(x.last_fired_at),
           engine.ms_to_ts(x.last_valid_at), engine.ms_to_ts(x.last_evaluated_at),
           x.negative_streak_count, engine.ms_to_ts(x.negative_streak_started_at),
           engine.ms_to_ts(x.last_valid_negative_at), x.rounds_fired, x.peak_va_ratio,
           x.peak_abs_liquidity_delta
         from jsonb_to_recordset($1::text::jsonb) as x(${EPISODE_COLUMNS})
         on conflict (event_id) do nothing`,
        [json(opens.map((o) => episodeRow(o.episode, null)))],
      );
    }

    // 5. New outcome schedules: PENDING bookkeeping (never re-created once resolved).
    const pendingInserts = c.outcomeInserts.filter((o) => o.availability === "PENDING");
    if (pendingInserts.length > 0) {
      await tx.query(
        `insert into engine.pending_outcome (event_id, horizon_minutes, target_at, window_end_at,
           last_failure, attempts)
         select x.event_id, x.horizon, engine.ms_to_ts(x.target_at), engine.ms_to_ts(x.window_end_at),
           x.last_failure, x.attempts
         from jsonb_to_recordset($1::text::jsonb) as x(${OUTCOME_COLUMNS})
         where not exists (select 1 from history.signal_outcome o
                           where o.event_id = x.event_id and o.horizon_minutes = x.horizon)
         on conflict do nothing`,
        [json(pendingInserts.map(outcomeRow))],
      );
    }
    const resolvedInserts = c.outcomeInserts.filter((o) => o.availability !== "PENDING");
    if (resolvedInserts.length > 0) {
      await tx.query(
        `${INSERT_DURABLE_OUTCOMES_FROM(`from jsonb_to_recordset($1::text::jsonb) as x(${OUTCOME_COLUMNS})
           where not exists (select 1 from history.signal_outcome o
                             where o.event_id = x.event_id and o.horizon_minutes = x.horizon)`)}
         on conflict do nothing`,
        [json(resolvedInserts.map(outcomeRow))],
      );
    }

    // 6. Outcome updates apply only while the outcome is still PENDING.
    //    Resolved → delete the pending row and insert the durable row once.
    const resolved = c.outcomeUpdates.filter((o) => o.availability !== "PENDING");
    if (resolved.length > 0) {
      await tx.query(
        `with x as (select * from jsonb_to_recordset($1::text::jsonb) as x(${OUTCOME_COLUMNS})),
         d as (delete from engine.pending_outcome p using x
               where p.event_id = x.event_id and p.horizon_minutes = x.horizon
               returning p.event_id, p.horizon_minutes)
         ${INSERT_DURABLE_OUTCOMES_FROM(
           `from x join d on d.event_id = x.event_id and d.horizon_minutes = x.horizon`,
         )}`,
        [json(resolved.map(outcomeRow))],
      );
    }
    const stillPending = c.outcomeUpdates.filter((o) => o.availability === "PENDING");
    if (stillPending.length > 0) {
      await tx.query(
        `update engine.pending_outcome p set last_failure = x.last_failure, attempts = x.attempts
         from jsonb_to_recordset($1::text::jsonb) as x(${OUTCOME_COLUMNS})
         where p.event_id = x.event_id and p.horizon_minutes = x.horizon`,
        [json(stillPending.map(outcomeRow))],
      );
    }

    // 7. Temporary engine state + retention (90 min).
    if (c.engine.put) {
      await tx.query(
        `insert into engine.snapshot_round (key, scheduled_at, snapshots)
         select x.key, engine.ms_to_ts(x.at), x.snapshots
         from jsonb_to_record($1::text::jsonb) as x(key text, at bigint, snapshots jsonb)
         on conflict (key) do update set scheduled_at = excluded.scheduled_at, snapshots = excluded.snapshots`,
        [
          json({
            key: c.engine.put.key,
            at: c.engine.put.observedAt,
            snapshots: c.engine.put.snapshots,
          }),
        ],
      );
    }
    await tx.query(
      `delete from engine.snapshot_round where scheduled_at < engine.ms_to_ts($1::bigint)`,
      [String(c.engine.pruneBefore)],
    );

    // 8. Provider cooldowns (persist across invocations).
    if (c.cooldowns.length > 0) {
      await tx.query(
        `insert into engine.provider_cooldown (endpoint, until, consecutive_429)
         select x.endpoint, engine.ms_to_ts(x.until), x.consecutive_429
         from jsonb_to_recordset($1::text::jsonb) as x(endpoint text, until bigint, consecutive_429 smallint)
         on conflict (endpoint) do update set until = excluded.until,
           consecutive_429 = excluded.consecutive_429`,
        [
          json(
            c.cooldowns.map((cd) => ({
              endpoint: cd.endpoint,
              until: cd.until,
              consecutive_429: cd.consecutive429,
            })),
          ),
        ],
      );
    }

    // 9. GAP rows for never-observed minutes (never backfilled; existing rows win).
    if (c.gaps.length > 0) {
      await tx.query(
        `insert into history.signal_round (key, scheduled_at, state, attempt, owner, lease_until,
           data_status, rules_version, universe_size, issues, requests, finished_at)
         select x.key, engine.ms_to_ts(x.scheduled_at), x.state, x.attempt, x.owner,
           engine.ms_to_ts(x.lease_until), x.data_status, x.rules_version, x.universe_size,
           coalesce(x.issues, '{}'), x.requests, engine.ms_to_ts(x.finished_at)
         from jsonb_to_recordset($1::text::jsonb) as x(${ROUND_COLUMNS})
         on conflict do nothing`,
        [json(c.gaps.map(roundRow))],
      );
    }

    // 10. The final round row.
    await tx.query(
      `update history.signal_round r set
         state = x.state, attempt = x.attempt, owner = x.owner,
         lease_until = engine.ms_to_ts(x.lease_until), data_status = x.data_status,
         rules_version = x.rules_version, universe_size = x.universe_size,
         issues = coalesce(x.issues, '{}'), requests = x.requests,
         finished_at = engine.ms_to_ts(x.finished_at)
       from jsonb_to_record($1::text::jsonb) as x(${ROUND_COLUMNS})
       where r.key = x.key`,
      [json(roundRow(c.round))],
    );

    // 11. Round-log retention (30 days); an in-flight claim is never pruned.
    await tx.query(
      `delete from history.signal_round
       where scheduled_at < engine.ms_to_ts($1::bigint) and state <> 'CLAIMED'`,
      [String(c.pruneRoundLogBefore)],
    );
  }

  // ---- operational counters (outside the RecorderStore port) -----------------
  /** Count one invocation result for today (UTC). Best-effort operational truth. */
  async noteInvocation(result: string, at: number): Promise<void> {
    await this.pool.query(
      `insert into ops.invocation_daily (day, result, count)
       values ((engine.ms_to_ts($1::bigint) at time zone 'UTC')::date, $2, 1)
       on conflict (day, result) do update set count = ops.invocation_daily.count + 1`,
      [String(at), result],
    );
  }
}

function toEpisode(r: Row): EpisodeState {
  return {
    eventId: String(r.event_id),
    assetKey: String(r.asset_key),
    type: r.type as EpisodeState["type"],
    rulesVersion: String(r.rules_version),
    status: r.status as EpisodeState["status"],
    closeReason: (r.close_reason as EpisodeState["closeReason"]) ?? null,
    closedAt: numOrNull(r.closed_at),
    lastFiredAt: num(r.last_fired_at),
    lastValidAt: num(r.last_valid_at),
    lastEvaluatedAt: num(r.last_evaluated_at),
    negativeStreakCount: num(r.negative_streak_count),
    negativeStreakStartedAt: numOrNull(r.negative_streak_started_at),
    lastValidNegativeAt: numOrNull(r.last_valid_negative_at),
    roundsFired: num(r.rounds_fired),
    peakVaRatio: numOrNull(r.peak_va_ratio),
    peakAbsLiquidityDeltaUsd: numOrNull(r.peak_abs_liquidity_delta),
  };
}

function isUniqueViolation(err: unknown, constraint: string): boolean {
  if (typeof err !== "object" || err == null) return false;
  const e = err as { code?: unknown; constraint_name?: unknown; constraint?: unknown };
  return e.code === "23505" && (e.constraint_name ?? e.constraint) === constraint;
}
