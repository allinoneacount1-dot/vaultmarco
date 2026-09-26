import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ENGINE_RETENTION_MS, ROUND_LEASE_MS } from "@/lib/history/constants";
import { roundKey } from "@/lib/history/ids";
import type {
  EpisodeState,
  OutcomeObservation,
  RoundRecord,
  SignalEvent,
} from "@/lib/history/model";
import { acceptSample, scheduleOutcomes } from "@/lib/history/outcomes";
import type { RoundCommit } from "@/lib/history/ports";
import { emptyAccounting } from "@/lib/history/requests";
import { decideClaim, gapRecord } from "@/lib/history/rounds";
import { PgRecorderStore, accountingToArray, arrayToAccounting } from "@/server/recorder/pgStore";
import { snapshot } from "../signals/fixtures";
import { HONSE, HONSE_KEY, HONSE_PAIR, MIN, T0 } from "../history/helpers";
import { createTestDb, dumpState, pgEnabled, type TestDb } from "./pgHarness";

/**
 * PgRecorderStore against REAL PostgreSQL 16 (local, disposable): every
 * invariant MemoryRecorderStore enforces, now enforced by SQL constraints,
 * compare-and-set statements and one transaction.
 */

const DAY = 24 * 60 * MIN;

function event(i = 1, openedMinute = 0): SignalEvent {
  const openedAt = T0 + openedMinute * MIN + 2_000;
  return {
    id: `evt_test_${i}`,
    assetKey: HONSE_KEY,
    chainId: "solana",
    address: HONSE,
    pairAddress: HONSE_PAIR,
    symbol: "HONSE",
    type: "EARLY_MOMENTUM",
    severity: null,
    rulesVersion: "rv_test",
    openedRound: roundKey(T0 + openedMinute * MIN),
    openedAt,
    evidence: {
      type: "EARLY_MOMENTUM",
      rule: { key: HONSE_KEY, nested: { a: [1, 2.5, null] } } as never,
    },
    openSnapshot: {
      observedAt: openedAt,
      pairAddress: HONSE_PAIR,
      dexId: "pumpswap",
      priceUsd: 0.000123,
      liquidityUsd: 25532.33,
      fdv: null,
      marketCap: 123456,
      volumeM5: 10,
      volumeH1: 100,
      volumeH24: 1000,
      txnsM5: { buys: 30, sells: 10 },
      txnsH1: null,
      priceChangeM5: -1.5,
      priceChangeH1: 2,
      pairCreatedAt: T0 - DAY,
      boostsActive: 3,
    },
  };
}

function episode(e: SignalEvent, at: number, patch: Partial<EpisodeState> = {}): EpisodeState {
  return {
    eventId: e.id,
    assetKey: e.assetKey,
    type: e.type,
    rulesVersion: e.rulesVersion,
    status: "OPEN",
    closeReason: null,
    closedAt: null,
    lastFiredAt: e.openedAt,
    lastValidAt: e.openedAt,
    lastEvaluatedAt: at,
    negativeStreakCount: 0,
    negativeStreakStartedAt: null,
    lastValidNegativeAt: null,
    roundsFired: 1,
    peakVaRatio: 4.25,
    peakAbsLiquidityDeltaUsd: null,
    ...patch,
  };
}

describe.skipIf(!pgEnabled)("PgRecorderStore on real PostgreSQL", () => {
  let db: TestDb;
  let clockNow = T0;
  let store: PgRecorderStore;

  beforeAll(async () => {
    db = await createTestDb("stepb_store");
  }, 30_000);
  afterAll(async () => {
    await db?.drop();
  });
  beforeEach(async () => {
    await db.admin.unsafe(`
      alter table history.signal_event disable trigger signal_event_immutable;
      alter table history.signal_outcome disable trigger signal_outcome_immutable;
      truncate history.signal_outcome, engine.pending_outcome, history.signal_episode,
        history.signal_event, history.signal_round, engine.snapshot_round,
        engine.provider_cooldown, ops.invocation_daily;
      alter table history.signal_event enable trigger signal_event_immutable;
      alter table history.signal_outcome enable trigger signal_outcome_immutable;`);
    clockNow = T0;
    store = new PgRecorderStore(db.writerPool, { now: () => clockNow });
  });

  /** Claim minute m for `owner` at the current clock; returns the claim record. */
  async function claim(m: number, owner: string, s = store): Promise<RoundRecord> {
    const at = T0 + m * MIN;
    const existing = await s.getRound(roundKey(at));
    const d = decideClaim(existing, at, owner, clockNow, await s.newestFinishedAt());
    if (d.kind !== "CLAIM" && d.kind !== "TAKEOVER") throw new Error(`no claim: ${d.kind}`);
    if (!(await s.tryClaim(d.record, existing))) throw new Error("claim lost");
    return d.record;
  }

  function commitFor(claimRec: RoundRecord, patch: Partial<RoundCommit> = {}): RoundCommit {
    return {
      round: {
        ...claimRec,
        state: "COMPLETED",
        leaseUntil: null,
        dataStatus: "live",
        rulesVersion: "rv_test",
        universeSize: 42,
        issues: [],
        requests: emptyAccounting(),
        finishedAt: clockNow + 1_500,
      },
      owner: claimRec.owner!,
      attempt: claimRec.attempt,
      gaps: [],
      engine: { put: null, pruneBefore: claimRec.scheduledAt - ENGINE_RETENTION_MS },
      events: [],
      episodes: [],
      outcomeInserts: [],
      outcomeUpdates: [],
      cooldowns: [],
      pruneRoundLogBefore: claimRec.scheduledAt - 30 * DAY,
      ...patch,
    };
  }

  it("request accounting round-trips through the compact smallint[35] layout", () => {
    const a = emptyAccounting();
    a.TOKEN_ENRICHMENT.ok = 3;
    a.DUE_TOKEN_BATCH.rateLimited = 1;
    expect(accountingToArray(a)).toHaveLength(35);
    expect(arrayToAccounting(accountingToArray(a))).toEqual(a);
  });

  describe("claim / lease", () => {
    it("the first worker claims; a concurrent second worker cannot claim the same round", async () => {
      const at = T0;
      const a = decideClaim(null, at, "A", clockNow, null);
      const b = decideClaim(null, at, "B", clockNow, null);
      const results = await Promise.all([
        store.tryClaim((a as { record: RoundRecord }).record, null),
        store.tryClaim((b as { record: RoundRecord }).record, null),
      ]);
      expect(results.filter(Boolean)).toHaveLength(1);
      const r = await store.getRound(roundKey(at));
      expect(r).toMatchObject({ state: "CLAIMED", attempt: 1 });
      expect(["A", "B"]).toContain(r!.owner);
    });

    it("an expired lease is taken over (attempt + 1); the old worker can no longer commit", async () => {
      const first = await claim(0, "A");
      // Active lease: the SQL compare-and-set refuses a takeover even if asked.
      const early = { ...first, attempt: 2, owner: "B", leaseUntil: clockNow + ROUND_LEASE_MS };
      expect(await store.tryClaim(early, first)).toBe(false);

      clockNow = T0 + ROUND_LEASE_MS + 1;
      const second = await claim(0, "B");
      expect(second).toMatchObject({ attempt: 2, owner: "B" });
      expect(await store.getRound(roundKey(T0))).toMatchObject({
        state: "CLAIMED",
        attempt: 2,
        owner: "B",
      });

      // Two takeovers racing on the same expected state: exactly one wins.
      clockNow = T0 + 2 * ROUND_LEASE_MS + 2;
      const cur = (await store.getRound(roundKey(T0)))!;
      const t1 = { ...cur, attempt: 3, owner: "C", leaseUntil: clockNow + ROUND_LEASE_MS };
      const t2 = { ...cur, attempt: 3, owner: "D", leaseUntil: clockNow + ROUND_LEASE_MS };
      const won = await Promise.all([store.tryClaim(t1, cur), store.tryClaim(t2, cur)]);
      expect(won.filter(Boolean)).toHaveLength(1);

      // Stale owners A (attempt 1) and B (attempt 2) are rejected; nothing is written.
      const before = await dumpState(db);
      const ev = event();
      for (const stale of [first, second]) {
        expect(
          await store.commit(
            commitFor(stale, {
              events: [ev],
              episodes: [{ episode: episode(ev, T0), expectedLastEvaluatedAt: null }],
            }),
          ),
        ).toEqual({ ok: false, reason: "NOT_OWNER" });
      }
      expect(await dumpState(db)).toEqual(before);
    });

    it("a finished round cannot be committed again (duplicate scheduled minute is harmless)", async () => {
      const c = await claim(0, "A");
      const ev = event();
      const commit = commitFor(c, {
        events: [ev],
        episodes: [{ episode: episode(ev, T0), expectedLastEvaluatedAt: null }],
        outcomeInserts: scheduleOutcomes(ev),
      });
      expect(await store.commit(commit)).toEqual({ ok: true });
      const after = await dumpState(db);
      expect(await store.commit(commit)).toEqual({ ok: false, reason: "NOT_OWNER" });
      expect(
        decideClaim(await store.getRound(c.key), T0, "B", clockNow, await store.newestFinishedAt()),
      ).toEqual({
        kind: "SKIP",
        reason: "ALREADY_FINISHED",
      });
      expect(await dumpState(db)).toEqual(after);
      const [counts] = await db.admin`select
        (select count(*)::int from history.signal_event) as events,
        (select count(*)::int from history.signal_episode) as episodes,
        (select count(*)::int from engine.pending_outcome) as pending`;
      expect(counts).toEqual({ events: 1, episodes: 1, pending: 5 });
    });

    it("round started_at / finished_at / duration_ms are recorded", async () => {
      clockNow = T0 + 2_000;
      const c = await claim(0, "A");
      clockNow = T0 + 3_000;
      await store.commit(commitFor(c));
      const [r] = await db.admin`select engine.ts_to_ms(started_at)::float8 as s,
        engine.ts_to_ms(finished_at)::float8 as f, duration_ms from history.signal_round`;
      expect(r).toEqual({ s: T0 + 2_000, f: T0 + 4_500, duration_ms: 2_500 });
    });
  });

  describe("events, episodes, outcomes", () => {
    it("events are insert-once: a replay with different content never rewrites the stored event", async () => {
      const ev = event();
      const c1 = await claim(0, "A");
      await store.commit(commitFor(c1, { events: [ev] }));
      const c2 = await claim(1, "A");
      const tampered = { ...ev, symbol: "EVIL", openedAt: ev.openedAt + 1 };
      expect(await store.commit(commitFor(c2, { events: [tampered] }))).toEqual({ ok: true });
      expect(await store.events([ev.id])).toEqual([ev]);
      // Even a privileged role cannot mutate an event (trigger), and the writer has no UPDATE grant.
      await expect(db.admin`update history.signal_event set symbol = 'X'`).rejects.toThrow(
        /immutable/,
      );
      await expect(db.writer`update history.signal_event set symbol = 'X'`).rejects.toMatchObject({
        code: "42501",
      });
      await expect(db.writer`delete from history.signal_event`).rejects.toMatchObject({
        code: "42501",
      });
    });

    it("the event round-trips exactly (openedRound = scheduled minute, openedAt = real observation)", async () => {
      const ev = event(1, 7);
      const c = await claim(7, "A");
      await store.commit(commitFor(c, { events: [ev] }));
      const [back] = await store.events([ev.id]);
      expect(back).toEqual(ev);
      expect(back.openedRound).toBe("2026-09-26T00:07Z");
      expect(back.openedAt).toBe(T0 + 7 * MIN + 2_000);
    });

    it("the database rejects a second OPEN episode for the same asset + type; the commit applies nothing", async () => {
      const a = event(1);
      const c1 = await claim(0, "A");
      await store.commit(
        commitFor(c1, {
          events: [a],
          episodes: [{ episode: episode(a, T0), expectedLastEvaluatedAt: null }],
        }),
      );
      const before = await dumpState(db);
      const b = event(2, 1);
      const c2 = await claim(1, "A");
      const r = await store.commit(
        commitFor(c2, {
          events: [b],
          episodes: [{ episode: episode(b, T0 + MIN), expectedLastEvaluatedAt: null }],
          outcomeInserts: scheduleOutcomes(b),
        }),
      );
      expect(r).toEqual({ ok: false, reason: "DUPLICATE_OPEN_EPISODE" });
      const after = await dumpState(db);
      expect({ ...after, rounds: null }).toEqual({ ...before, rounds: null });
      expect(await store.getRound(c2.key)).toMatchObject({ state: "CLAIMED" }); // not completed
      // And directly in SQL:
      await expect(
        db.admin
          .unsafe(`insert into history.signal_event select 'evt_raw', asset_key, chain_id, address,
          pair_address, symbol, type, severity, rules_version, opened_round, opened_at, evidence, open_snapshot
          from history.signal_event limit 1;
          insert into history.signal_episode select 'evt_raw', asset_key, type, rules_version, status,
          close_reason, closed_at, last_fired_at, last_valid_at, last_evaluated_at, negative_streak_count,
          negative_streak_started_at, last_valid_negative_at, rounds_fired, peak_va_ratio,
          peak_abs_liquidity_delta from history.signal_episode limit 1`),
      ).rejects.toMatchObject({ code: "23505", constraint_name: "signal_episode_one_open" });
    });

    it("close + re-open of the same asset/type in ONE commit is accepted (updates apply before inserts)", async () => {
      const a = event(1);
      const c1 = await claim(0, "A");
      await store.commit(
        commitFor(c1, {
          events: [a],
          episodes: [{ episode: episode(a, T0), expectedLastEvaluatedAt: null }],
        }),
      );
      const b = event(2, 61);
      const c2 = await claim(61, "A");
      const closed = episode(a, T0 + 61 * MIN, {
        status: "CLOSED",
        closeReason: "TRACKING_LOST",
        closedAt: a.openedAt + 60 * MIN,
      });
      expect(
        await store.commit(
          commitFor(c2, {
            events: [b],
            episodes: [
              { episode: episode(b, T0 + 61 * MIN), expectedLastEvaluatedAt: null },
              { episode: closed, expectedLastEvaluatedAt: T0 },
            ],
          }),
        ),
      ).toEqual({ ok: true });
      expect((await store.openEpisodes()).map((e) => e.eventId)).toEqual([b.id]);
    });

    it("episode compare-and-set: a wrong expected lastEvaluatedAt fails the whole commit", async () => {
      const a = event(1);
      const c1 = await claim(0, "A");
      await store.commit(
        commitFor(c1, {
          events: [a],
          episodes: [{ episode: episode(a, T0), expectedLastEvaluatedAt: null }],
        }),
      );
      const before = await dumpState(db);
      const c2 = await claim(1, "A");
      const r = await store.commit(
        commitFor(c2, {
          engine: {
            put: { key: c2.key, observedAt: c2.scheduledAt, snapshots: [] },
            pruneBefore: 0,
          },
          episodes: [
            { episode: episode(a, T0 + MIN, { roundsFired: 2 }), expectedLastEvaluatedAt: T0 - 1 },
          ],
        }),
      );
      expect(r).toEqual({ ok: false, reason: "EPISODE_CONFLICT" });
      expect({ ...(await dumpState(db)), rounds: null }).toEqual({ ...before, rounds: null });
      // The correct expected value succeeds.
      const ok = await store.commit(
        commitFor(c2, {
          episodes: [
            { episode: episode(a, T0 + MIN, { roundsFired: 2 }), expectedLastEvaluatedAt: T0 },
          ],
        }),
      );
      expect(ok).toEqual({ ok: true });
      expect((await store.openEpisodes())[0]).toEqual(episode(a, T0 + MIN, { roundsFired: 2 }));
    });

    it("pending → resolved: pending row removed, durable row inserted once, never re-opened", async () => {
      const ev = event();
      const c1 = await claim(0, "A");
      await store.commit(commitFor(c1, { events: [ev], outcomeInserts: scheduleOutcomes(ev) }));
      expect(await store.pendingOutcomes()).toHaveLength(5);

      const o5 = (await store.pendingOutcomes()).find((o) => o.horizonMinutes === 5)!;
      const sample = snapshot({
        key: HONSE_KEY,
        chainId: "solana",
        pairAddress: HONSE_PAIR,
        observedAt: o5.targetAt + 3_000,
        priceUsd: 0.0002,
      });
      const observed = acceptSample(o5, ev, sample, "ROUND", roundKey(T0 + 5 * MIN))!;
      clockNow = T0 + 5 * MIN + 3_000;
      const c5 = await claim(5, "A");
      await store.commit(commitFor(c5, { outcomeUpdates: [observed] }));

      const [row] =
        await db.admin`select availability, engine.ts_to_ms(observed_at)::float8 as observed_at,
        delay_seconds, source, pair_address, price_usd, engine.ts_to_ms(round_at)::float8 as round_at
        from history.signal_outcome`;
      expect(row).toEqual({
        availability: "OBSERVED",
        observed_at: o5.targetAt + 3_000,
        delay_seconds: 3,
        source: "ROUND",
        pair_address: HONSE_PAIR,
        price_usd: 0.0002,
        round_at: T0 + 5 * MIN,
      });
      expect((await store.pendingOutcomes()).map((o) => o.horizonMinutes)).toEqual([
        15, 60, 240, 1440,
      ]);

      // Replayed resolution and replayed schedule: no duplicate durable row, no resurrected pending row.
      const c6 = await claim(6, "A");
      await store.commit(
        commitFor(c6, { outcomeUpdates: [observed], outcomeInserts: scheduleOutcomes(ev) }),
      );
      const [n] = await db.admin`select count(*)::int as n from history.signal_outcome`;
      expect(n.n).toBe(1);
      expect(await store.pendingOutcomes()).toHaveLength(4);
      // Durable outcomes are insert-only.
      await expect(db.writer`update history.signal_outcome set attempts = 9`).rejects.toMatchObject(
        { code: "42501" },
      );
      await expect(db.admin`delete from history.signal_outcome`).rejects.toThrow(/immutable/);
    });

    it("still-PENDING updates record the failure on the temporary row; UNAVAILABLE resolves durably", async () => {
      const ev = event();
      const c1 = await claim(0, "A");
      await store.commit(commitFor(c1, { events: [ev], outcomeInserts: scheduleOutcomes(ev) }));
      const o5 = (await store.pendingOutcomes()).find((o) => o.horizonMinutes === 5)!;
      const c2 = await claim(5, "A");
      await store.commit(
        commitFor(c2, { outcomeUpdates: [{ ...o5, lastFailure: "RATE_LIMITED", attempts: 1 }] }),
      );
      expect((await store.pendingOutcomes()).find((o) => o.horizonMinutes === 5)).toMatchObject({
        lastFailure: "RATE_LIMITED",
        attempts: 1,
      });
      const c3 = await claim(8, "A");
      const expired: OutcomeObservation = {
        ...o5,
        availability: "UNAVAILABLE",
        unavailableReason: "RATE_LIMITED",
        lastFailure: "RATE_LIMITED",
        attempts: 1,
      };
      await store.commit(commitFor(c3, { outcomeUpdates: [expired] }));
      const [row] =
        await db.admin`select availability, unavailable_reason, observed_at, attempts from history.signal_outcome`;
      expect(row).toEqual({
        availability: "UNAVAILABLE",
        unavailable_reason: "RATE_LIMITED",
        observed_at: null,
        attempts: 1,
      });
    });

    it("the durable table enforces the directional window: an out-of-window OBSERVED row rolls back the whole commit", async () => {
      const ev = event();
      const c1 = await claim(0, "A");
      await store.commit(commitFor(c1, { events: [ev], outcomeInserts: scheduleOutcomes(ev) }));
      const before = await dumpState(db);
      const o5 = (await store.pendingOutcomes()).find((o) => o.horizonMinutes === 5)!;
      const c2 = await claim(5, "A");
      const bogus: OutcomeObservation = {
        ...o5,
        availability: "OBSERVED",
        observedAt: o5.targetAt - 1, // before the target: never acceptable
        delaySeconds: 0,
        source: "ROUND",
        pairAddress: HONSE_PAIR,
        roundKey: c2.key,
        market: null,
        attempts: 1,
      };
      const other = event(2, 5);
      await expect(
        store.commit(
          commitFor(c2, {
            events: [{ ...other, assetKey: "solana:Other" }],
            outcomeUpdates: [bogus],
          }),
        ),
      ).rejects.toMatchObject({ code: "23514" });
      expect({ ...(await dumpState(db)), rounds: null }).toEqual({ ...before, rounds: null });
    });
  });

  describe("gaps, engine state, cooldowns, retention", () => {
    it("GAP rows carry no provider values; the schema rejects a GAP with values", async () => {
      const c = await claim(4, "A");
      await store.commit(
        commitFor(c, { gaps: [1, 2, 3].map((m) => gapRecord(roundKey(T0 + m * MIN), clockNow)) }),
      );
      const gaps =
        await db.admin`select key, state, attempt, owner, data_status, rules_version, universe_size,
        issues, requests from history.signal_round where state = 'GAP' order by key`;
      expect(gaps).toHaveLength(3);
      for (const g of gaps) {
        expect(g).toMatchObject({
          state: "GAP",
          attempt: 0,
          owner: null,
          data_status: null,
          rules_version: null,
          universe_size: null,
          requests: null,
        });
        expect(g.issues).toEqual([]);
      }
      await expect(
        db.admin`insert into history.signal_round (key, scheduled_at, state, attempt, data_status)
          values ('2026-09-26T09:00Z', '2026-09-26T09:00Z', 'GAP', 0, 'live')`,
      ).rejects.toMatchObject({ code: "23514" });
    });

    it("engine snapshots are pruned after 90 minutes and round-trip exactly", async () => {
      const snap = snapshot({
        key: HONSE_KEY,
        chainId: "solana",
        pairAddress: HONSE_PAIR,
        observedAt: T0 + 2_000,
      });
      for (const m of [0, 30, 60, 90, 91]) {
        clockNow = T0 + m * MIN;
        const c = await claim(m, "A");
        await store.commit(
          commitFor(c, {
            engine: {
              put: {
                key: c.key,
                observedAt: c.scheduledAt,
                snapshots: [{ ...snap, observedAt: c.scheduledAt + 2_000 }],
              },
              pruneBefore: c.scheduledAt - ENGINE_RETENTION_MS,
            },
          }),
        );
      }
      const rounds = await store.loadEngineRounds(0);
      expect(rounds.map((r) => r.key)).toEqual([
        "2026-09-26T00:30Z",
        "2026-09-26T01:00Z",
        "2026-09-26T01:30Z",
        "2026-09-26T01:31Z",
      ]);
      expect(rounds[0].snapshots).toEqual([{ ...snap, observedAt: T0 + 30 * MIN + 2_000 }]);
      expect(await store.loadEngineRounds(T0 + 60 * MIN)).toHaveLength(3);
    });

    it("round log is pruned after 30 days, except an in-flight CLAIMED round", async () => {
      const old = await claim(0, "A");
      await store.commit(commitFor(old));
      clockNow = T0 + MIN;
      await claim(1, "stuck"); // never committed
      clockNow = T0 + 31 * DAY;
      const late = await claim(31 * 24 * 60, "B");
      await store.commit(commitFor(late, { pruneRoundLogBefore: late.scheduledAt - 30 * DAY }));
      const keys = (await db.admin`select key, state from history.signal_round order by key`).map(
        (r) => `${r.key}:${r.state}`,
      );
      expect(keys).toEqual(["2026-09-26T00:01Z:CLAIMED", "2026-10-27T00:00Z:COMPLETED"]);
    });

    it("provider cooldowns survive a new store / connection (process restart)", async () => {
      const c = await claim(0, "A");
      await store.commit(
        commitFor(c, {
          cooldowns: [{ endpoint: "DUE_TOKEN_BATCH", until: T0 + 10 * MIN, consecutive429: 2 }],
        }),
      );
      const fresh = new PgRecorderStore(db.writerPool, { now: () => clockNow });
      expect(await fresh.cooldowns()).toEqual([
        { endpoint: "DUE_TOKEN_BATCH", until: T0 + 10 * MIN, consecutive429: 2 },
      ]);
    });

    it("invocation counters aggregate per UTC day and result", async () => {
      await store.noteInvocation("COMPLETED", T0 + 1);
      await store.noteInvocation("COMPLETED", T0 + 2);
      await store.noteInvocation("SKIPPED", T0 + 3);
      const rows =
        await db.admin`select day::text, result, count from ops.invocation_daily order by result`;
      expect(rows).toEqual([
        { day: "2026-09-26", result: "COMPLETED", count: 2 },
        { day: "2026-09-26", result: "SKIPPED", count: 1 },
      ]);
    });
  });
});
