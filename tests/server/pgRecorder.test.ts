import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENDPOINTS, ENGINE_RETENTION_MS } from "@/lib/history/constants";
import { outcomeKey } from "@/lib/history/duePlanner";
import { MemoryRecorderStore } from "@/lib/history/memoryStore";
import type { OutcomeObservation, RoundRecord } from "@/lib/history/model";
import type { RecorderStore } from "@/lib/history/ports";
import { runRound, type RoundReport } from "@/lib/history/recorder";
import { PgRecorderStore } from "@/server/recorder/pgStore";
import type { PgPool } from "@/server/recorder/pg";
import { HONSE, MIN, T0, fixtureHttp, noSleep, type Scenario } from "../history/helpers";
import { createTestDb, dumpState, faultyPool, pgEnabled, type TestDb } from "./pgHarness";

/**
 * The FULL recorder (existing engine + pure recorder) over recorded DexScreener
 * fixtures, run step-for-step against MemoryRecorderStore and PgRecorderStore.
 * The Postgres store must produce the same reports and the same durable truth.
 */

type Step = { m: number; lag?: number; s?: Scenario };

async function drive(
  store: RecorderStore,
  steps: Step[],
  setClock: (t: number) => void,
  now: () => number,
) {
  let scenario: Scenario = {};
  const reports: RoundReport[] = [];
  let n = 0;
  for (const step of steps) {
    if (step.s) scenario = step.s;
    setClock(T0 + step.m * MIN + (step.lag ?? 2_000));
    reports.push(
      await runRound(T0 + step.m * MIN, {
        store,
        http: fixtureHttp(() => scenario),
        now,
        owner: `w${++n}`,
        sleep: noSleep,
      }),
    );
  }
  return reports;
}

const MARKET_KEYS = [
  "priceUsd",
  "liquidityUsd",
  "fdv",
  "marketCap",
  "volumeH1",
  "volumeH24",
  "txnsH1",
  "priceChangeH1",
] as const;

/** The durable comparison: what the Postgres schema keeps for an outcome. */
function durableView(o: OutcomeObservation) {
  const base = {
    eventId: o.eventId,
    horizonMinutes: o.horizonMinutes,
    targetAt: o.targetAt,
    windowEndAt: o.windowEndAt,
    availability: o.availability,
    unavailableReason: o.unavailableReason,
    observedAt: o.observedAt,
    delaySeconds: o.delaySeconds,
    source: o.source,
    pairAddress: o.pairAddress,
    roundKey: o.roundKey,
    attempts: o.attempts,
    market: o.market ? Object.fromEntries(MARKET_KEYS.map((k) => [k, o.market![k]])) : null,
  };
  return o.availability === "PENDING" ? { ...base, lastFailure: o.lastFailure } : base;
}

async function pgOutcomes(db: TestDb, store: PgRecorderStore) {
  const pending = (await store.pendingOutcomes()).map(durableView);
  const rows = await db.admin`select event_id, horizon_minutes, availability, unavailable_reason,
    engine.ts_to_ms(target_at)::float8 as target_at, engine.ts_to_ms(window_end_at)::float8 as window_end_at,
    engine.ts_to_ms(observed_at)::float8 as observed_at, delay_seconds, source, pair_address,
    engine.ts_to_ms(round_at)::float8 as round_at, price_usd, liquidity_usd, fdv, market_cap, volume_h1,
    volume_h24, txns_h1_buys, txns_h1_sells, price_change_h1, attempts from history.signal_outcome`;
  const durable = rows.map((r) => ({
    eventId: r.event_id,
    horizonMinutes: r.horizon_minutes,
    targetAt: r.target_at,
    windowEndAt: r.window_end_at,
    availability: r.availability,
    unavailableReason: r.unavailable_reason,
    observedAt: r.observed_at,
    delaySeconds: r.delay_seconds,
    source: r.source,
    pairAddress: r.pair_address,
    roundKey: r.round_at == null ? null : new Date(r.round_at).toISOString().slice(0, 16) + "Z",
    attempts: r.attempts,
    market:
      r.availability === "OBSERVED"
        ? {
            priceUsd: r.price_usd,
            liquidityUsd: r.liquidity_usd,
            fdv: r.fdv,
            marketCap: r.market_cap,
            volumeH1: r.volume_h1,
            volumeH24: r.volume_h24,
            txnsH1:
              r.txns_h1_buys == null ? null : { buys: r.txns_h1_buys, sells: r.txns_h1_sells },
            priceChangeH1: r.price_change_h1,
          }
        : null,
  }));
  return [...pending, ...durable].sort((a, b) =>
    outcomeKey(a.eventId, a.horizonMinutes).localeCompare(outcomeKey(b.eventId, b.horizonMinutes)),
  );
}

async function pgEpisodes(db: TestDb) {
  const rows = await db.admin`select event_id from history.signal_episode order by event_id`;
  return rows.map((r) => r.event_id as string);
}

async function compareStores(steps: Step[], db: TestDb) {
  let t = T0;
  const setClock = (v: number) => (t = v);
  const now = () => t;
  const mem = new MemoryRecorderStore();
  const memReports = await drive(mem, steps, setClock, now);
  const pg = new PgRecorderStore(db.writerPool, { now });
  const pgReports = await drive(pg, steps, setClock, now);

  expect(pgReports).toEqual(memReports);

  // Events: identical, including evidence and the compact opening snapshot.
  const ids = [...mem.eventsById.keys()].sort();
  expect(await pg.events(ids)).toEqual(ids.map((id) => mem.eventsById.get(id)));
  expect((await pgEpisodes(db)).sort()).toEqual([...mem.episodes.keys()].sort());

  // Episodes (open ones through the store's read path; closed ones via SQL).
  expect(await pg.openEpisodes()).toEqual(
    [...mem.episodes.values()]
      .filter((e) => e.status === "OPEN")
      .sort((a, b) => a.eventId.localeCompare(b.eventId)),
  );
  const closed = await db.admin`select event_id, close_reason,
    engine.ts_to_ms(closed_at)::float8 as closed_at, rounds_fired, negative_streak_count
    from history.signal_episode where status = 'CLOSED' order by event_id`;
  expect(closed).toEqual(
    [...mem.episodes.values()]
      .filter((e) => e.status === "CLOSED")
      .sort((a, b) => a.eventId.localeCompare(b.eventId))
      .map((e) => ({
        event_id: e.eventId,
        close_reason: e.closeReason,
        closed_at: e.closedAt,
        rounds_fired: e.roundsFired,
        negative_streak_count: e.negativeStreakCount,
      })),
  );

  // Outcomes: PENDING in engine state, resolved truth durable — same content.
  expect(await pgOutcomes(db, pg)).toEqual(
    [...mem.outcomes.values()]
      .map(durableView)
      .sort((a, b) =>
        outcomeKey(a.eventId, a.horizonMinutes).localeCompare(
          outcomeKey(b.eventId, b.horizonMinutes),
        ),
      ),
  );

  // Round log (including GAP rows), engine state and cooldowns.
  const memRounds = [...mem.rounds.values()].sort((a, b) => a.scheduledAt - b.scheduledAt);
  const pgRounds: (RoundRecord | null)[] = [];
  for (const r of memRounds) pgRounds.push(await pg.getRound(r.key));
  expect(pgRounds).toEqual(memRounds);
  const [{ n }] = await db.admin`select count(*)::int as n from history.signal_round`;
  expect(n).toBe(memRounds.length);
  expect(await pg.loadEngineRounds(0)).toEqual(await mem.loadEngineRounds(0));
  expect(await pg.cooldowns()).toEqual(
    (await mem.cooldowns()).sort((a, b) => a.endpoint.localeCompare(b.endpoint)),
  );
  return { mem, pg, memReports };
}

const range = (from: number, to: number, s?: Scenario): Step[] =>
  Array.from({ length: to - from + 1 }, (_, i) => ({
    m: from + i,
    ...(i === 0 && s ? { s } : {}),
  }));

describe.skipIf(!pgEnabled)("recorder on PgRecorderStore ≡ recorder on MemoryRecorderStore", () => {
  const scenarios: Array<[string, Step[]]> = [
    [
      "signal → repeated FIRED → five negatives → SIGNAL_EXIT → re-entry; +5m / +15m outcomes from rounds",
      [
        ...range(0, 2, { honse: "signal" }),
        ...range(3, 7, { honse: "negative" }),
        ...range(8, 20, { honse: "signal" }),
      ],
    ],
    [
      "recorder down > 60 min: GAP rows, TRACKING_LOST at lastValidAt + 60 min, same-round re-open",
      [{ m: 0, s: { honse: "signal" } }, ...range(61, 70)],
    ],
    [
      "delayed round: observed 00:00:40 → +5m target 00:05:40; the 00:05:02 sample never counts",
      [{ m: 0, lag: 40_000, s: { honse: "signal" } }, ...range(1, 9)],
    ],
    [
      "liquidity drain fires LIQUIDITY_REMOVED from the engine's own rule",
      [
        ...range(0, 5, { honse: "negative" }),
        ...range(6, 12, { honse: "negative", honseLiquidity: 12_000 }),
      ],
    ],
    [
      "token leaves the universe → due token batch; missing pair → pair fallback",
      [
        { m: 0, s: { honse: "signal" } },
        ...range(1, 16, { honse: "negative", honseGone: true, tokenBatchOmitsPair: true }),
      ],
    ],
    [
      "pair never returned inside the window → UNAVAILABLE (PAIR_NOT_RETURNED)",
      [
        { m: 0, s: { honse: "signal" } },
        ...range(1, 8, {
          honse: "negative",
          honseGone: true,
          tokenBatchOmitsPair: true,
          fallbackEmpty: true,
        }),
      ],
    ],
    [
      "429 on the due batch: cooldown persisted, later rounds skip, RATE_LIMITED when the window closes",
      [
        { m: 0, s: { honse: "signal" } },
        ...range(1, 8, {
          honse: "negative",
          honseGone: true,
          override: (u) =>
            u.includes(`/tokens/v1/solana/${HONSE}`) && !u.includes(",")
              ? { status: 429, retryAfter: "600", body: null }
              : null,
        }),
      ],
    ],
    [
      "full provider outage: rounds recorded offline, no transitions",
      [
        { m: 0, s: { honse: "signal" } },
        ...range(1, 3, { override: () => ({ status: 503, retryAfter: null, body: null }) }),
      ],
    ],
    [
      "130 rounds: engine state bounded by the 90-minute retention",
      range(0, 129, { honse: "negative" }),
    ],
  ];

  for (const [name, steps] of scenarios) {
    it(
      name,
      async () => {
        const db = await createTestDb("stepb_e2e");
        try {
          const { pg } = await compareStores(steps, db);
          if (name.startsWith("130 rounds")) {
            const engine = await pg.loadEngineRounds(0);
            expect(engine.length).toBeLessThanOrEqual(ENGINE_RETENTION_MS / MIN + 1);
          }
        } finally {
          await db.drop();
        }
      },
      120_000,
    );
  }
});

describe.skipIf(!pgEnabled)("atomicity, concurrency, idempotency on real PostgreSQL", () => {
  it("a failure at ANY statement of the commit rolls back everything (fault injection at each step)", async () => {
    // Round 61 after 60 missed minutes, with a 429 on BOOST_TOP: its commit runs
    // every statement kind but one — claim lock, new event, episode CAS
    // (TRACKING_LOST), new episode, pending schedules, resolved outcomes (+60m
    // observed, +5m/+15m expired), engine put + prune, cooldown, 60 GAP rows,
    // final round, retention. (Still-pending failure notes are covered in pgStore.test.ts.)
    const round61: Scenario = {
      honse: "signal",
      override: (u) =>
        u.includes("/token-boosts/top/") ? { status: 429, retryAfter: "60", body: null } : null,
    };
    const stages: number[] = [];
    for (let failAt = 1; failAt <= 20; failAt++) {
      const db = await createTestDb("stepb_fault");
      try {
        let t = T0;
        const now = () => t;
        await drive(
          new PgRecorderStore(db.writerPool, { now }),
          [{ m: 0, s: { honse: "signal" } }],
          (v) => (t = v),
          now,
        );
        const before = await dumpState(db);
        const pool = faultyPool(db.writerPool, failAt);
        t = T0 + 61 * MIN + 2_000;
        const r = await runRound(T0 + 61 * MIN, {
          store: new PgRecorderStore(pool as PgPool, { now }),
          http: fixtureHttp(() => round61),
          now,
          owner: "faulty",
          sleep: noSleep,
        });
        if (!pool.tripped) break; // past the last statement of this commit
        stages.push(failAt);
        // The recorder then records the round as FAILED (its own second, clean
        // commit); the failed commit left nothing behind — no event, episode
        // change, outcome, engine row, cooldown or GAP row.
        expect(r.result).toBe("FAILED");
        const after = await dumpState(db);
        expect({ ...after, rounds: null }).toEqual({ ...before, rounds: null });
        const rounds =
          await db.admin`select key, state, data_status, requests from history.signal_round order by key`;
        expect(rounds).toEqual([
          {
            key: "2026-09-26T00:00Z",
            state: "COMPLETED",
            data_status: "live",
            requests: expect.any(Array),
          },
          { key: "2026-09-26T01:01Z", state: "FAILED", data_status: null, requests: null },
        ]);
      } finally {
        await db.drop();
      }
    }
    // 12 statements: lock, event, episode CAS, new episode, pending schedules,
    // resolved outcomes, engine put, engine prune, cooldown, GAP rows, final round, retention.
    expect(stages).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  }, 180_000);

  it("the same commit without a fault applies all of it (control for the fault test)", async () => {
    const db = await createTestDb("stepb_fault_ctl");
    try {
      let t = T0;
      const now = () => t;
      const reports = await drive(
        new PgRecorderStore(db.writerPool, { now }),
        [
          { m: 0, s: { honse: "signal" } },
          {
            m: 61,
            s: {
              honse: "signal",
              override: (u) =>
                u.includes("/token-boosts/top/")
                  ? { status: 429, retryAfter: "60", body: null }
                  : null,
            },
          },
        ],
        (v) => (t = v),
        now,
      );
      expect(reports[1]).toMatchObject({
        result: "COMPLETED",
        opened: 1,
        gaps: 60,
        closed: { TRACKING_LOST: 1 },
      });
      const [c] = await db.admin`select
        (select count(*)::int from history.signal_event) as events,
        (select count(*)::int from history.signal_round where state = 'GAP') as gaps,
        (select count(*)::int from history.signal_outcome) as resolved,
        (select count(*)::int from engine.pending_outcome) as pending,
        (select count(*)::int from engine.provider_cooldown) as cooldowns`;
      expect(c).toEqual({ events: 2, gaps: 60, resolved: 3, pending: 7, cooldowns: 1 });
    } finally {
      await db.drop();
    }
  }, 60_000);

  it("the same scheduled minute invoked concurrently: exactly one round runs, the other is SKIPPED", async () => {
    const db = await createTestDb("stepb_conc");
    try {
      const t = T0 + 2_000;
      const now = () => t;
      const run = (owner: string) =>
        runRound(T0, {
          store: new PgRecorderStore(db.writerPool, { now }),
          http: fixtureHttp(() => ({ honse: "signal" })),
          now,
          owner,
          sleep: noSleep,
        });
      const results = (await Promise.all([run("a"), run("b"), run("c")]))
        .map((r) => r.result)
        .sort();
      expect(results).toEqual(["COMPLETED", "SKIPPED", "SKIPPED"]);
      const [c] = await db.admin`select
        (select count(*)::int from history.signal_event) as events,
        (select count(*)::int from engine.pending_outcome) as pending,
        (select count(*)::int from history.signal_round) as rounds`;
      expect(c).toEqual({ events: 1, pending: 5, rounds: 1 });
      // A later retry of the same minute is harmless too.
      expect((await run("d")).result).toBe("SKIPPED");
    } finally {
      await db.drop();
    }
  }, 60_000);
});

describe.skipIf(!pgEnabled)("operational truth: ops.recorder_status / ops.recorder_health", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb("stepb_ops");
    let t = T0;
    const now = () => t;
    await drive(
      new PgRecorderStore(db.writerPool, { now }),
      [
        ...range(0, 2, { honse: "signal" }),
        ...range(3, 7, { honse: "negative" }),
        ...range(8, 12, {
          honse: "signal",
          override: (u) =>
            u.includes("/token-boosts/top/")
              ? { status: 429, retryAfter: "120", body: null }
              : null,
        }),
      ],
      (v) => (t = v),
      now,
    );
    const store = new PgRecorderStore(db.writerPool, { now });
    await store.noteInvocation("COMPLETED", T0);
    await store.noteInvocation("SKIPPED", T0);
  }, 60_000);
  afterAll(async () => {
    await db?.drop();
  });

  const at = (ms: number) => new Date(ms).toISOString();

  it("the endpoint order in SQL equals the recorder's ENDPOINTS", async () => {
    const [{ e }] = await db.admin`select ops.endpoints() as e`;
    expect(e).toEqual([...ENDPOINTS]);
  });

  it("status answers 'is the recorder working?' from the recorded rounds alone", async () => {
    const [{ s }] =
      await db.admin`select ops.recorder_status_at(${at(T0 + 13 * MIN)}::timestamptz) as s`;
    expect(s).toMatchObject({
      last_completed_round: expect.stringContaining("00:12:00"),
      rounds_60m: { completed: 13, failed: 0, gap: 0 },
      events_total: 2,
      open_episodes: 1,
      closed_by_reason: { SIGNAL_EXIT: 1, TRACKING_LOST: 0, RULES_CHANGED: 0 },
      // Retry-After 120 s → 2-minute cooldown: BOOST_TOP is retried (and refused) at 00:08, 00:10, 00:12.
      rate_limited_24h_by_endpoint: { BOOST_TOP: 3 },
      lease_takeovers_24h: 0,
      abandoned_claims: 0,
      invocations_today: { COMPLETED: 1, SKIPPED: 1 },
    });
    expect(s.last_rate_limited).toContain("00:12:00");
    expect(s.last_provider_success).toContain("00:12:00");
    expect(s.outcomes.observed).toBeGreaterThan(0);
    expect(s.outcome_coverage_by_horizon["5"].observed).toBeGreaterThan(0);
    expect(s.duration_ms_24h.p50).not.toBeNull();
    expect(Number(s.database_bytes)).toBeGreaterThan(0);
  });

  it("health: OK right after a completed round, STALE after 3 minutes, FAILING after three FAILED rounds", async () => {
    const health = async (ms: number) =>
      (await db.admin`select ops.recorder_health_at(${at(ms)}::timestamptz) as h`)[0].h;
    // finished_at of minute 12 is its (fake) clock time T0 + 12m + 2s.
    expect((await health(T0 + 13 * MIN)).status).toBe("OK");
    expect((await health(T0 + 16 * MIN)).status).toBe("STALE");
    await db.admin
      .unsafe(`insert into history.signal_round (key, scheduled_at, state, attempt, owner, finished_at)
      select to_char(ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"'), ts, 'FAILED', 1, 'x', ts + interval '5 seconds'
      from generate_series('2026-09-26T00:13Z'::timestamptz, '2026-09-26T00:15Z', interval '1 minute') ts`);
    expect((await health(T0 + 15 * MIN + 10_000)).status).toBe("FAILING");
  });

  it("housekeeping prunes 30-day counters (and cron run history when pg_cron exists)", async () => {
    await db.admin`insert into ops.invocation_daily values ('2026-08-01', 'COMPLETED', 5)`;
    const [{ r }] = await db.admin`select ops.prune_housekeeping(${at(T0)}::timestamptz) as r`;
    expect(r).toEqual({ invocation_daily: 1, cron_job_run_details: 0 });
  });
});

describe.skipIf(!pgEnabled)("private schemas and least privilege", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb("stepb_priv");
  }, 30_000);
  afterAll(async () => {
    await db?.drop();
  });

  it("browser roles (anon, authenticated) and PUBLIC have no access to history / engine / ops", async () => {
    for (const role of ["anon", "authenticated", "public"]) {
      for (const schema of ["history", "engine", "ops"]) {
        const [{ ok }] =
          await db.admin`select has_schema_privilege(${role === "public" ? "public" : role}, ${schema}, 'USAGE') as ok`;
        expect({ role, schema, ok }).toEqual({ role, schema, ok: false });
      }
    }
    const [{ n }] =
      await db.admin`select count(*)::int as n from information_schema.role_table_grants
      where table_schema in ('history', 'engine', 'ops') and grantee in ('anon', 'authenticated', 'PUBLIC')`;
    expect(n).toBe(0);
    const [{ f }] =
      await db.admin`select count(*)::int as f from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where s.nspname in ('history', 'engine', 'ops')
        and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))`;
    expect(f).toBe(0);
  });

  it("recorder_reader can read health/status only — no table access, no writes", async () => {
    const [{ h }] = await db.reader`select ops.recorder_health_at(now()) as h`;
    expect(h.status).toBe("STALE");
    await expect(db.reader`select * from history.signal_event`).rejects.toMatchObject({
      code: "42501",
    });
    await expect(db.reader`select * from engine.snapshot_round`).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      db.reader`insert into ops.invocation_daily values (current_date, 'x', 1)`,
    ).rejects.toMatchObject({ code: "42501" });
    await expect(db.reader`select ops.prune_housekeeping()`).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("recorder_writer cannot rewrite history or run housekeeping", async () => {
    await expect(db.writer`update history.signal_outcome set attempts = 1`).rejects.toMatchObject({
      code: "42501",
    });
    await expect(db.writer`delete from history.signal_episode`).rejects.toMatchObject({
      code: "42501",
    });
    await expect(db.writer`select ops.prune_housekeeping()`).rejects.toMatchObject({
      code: "42501",
    });
    await expect(db.writer`create table history.x (a int)`).rejects.toMatchObject({
      code: "42501",
    });
  });
});
