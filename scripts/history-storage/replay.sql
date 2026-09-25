-- LOCAL STORAGE BENCHMARK ONLY.
-- Replays the recorder's write pattern at the agreed UPPER-BOUND load, one
-- round at a time, committing per round, with a sleep between rounds so
-- autovacuum sees the same rounds-per-cycle ratio as production (one round per
-- 60 s naptime ⇔ one round per 1 s naptime here).
--
-- psql variables: :rounds (e.g. 2160 = 36 h), :sleep (seconds per round),
-- files under :dir produced by export-fixtures.ts.
--
-- Upper bound: one new event every 7 rounds (≈ 205 / day), two thirds EARLY
-- MOMENTUM and one third LIQUIDITY_REMOVED, each open ~65 rounds (≈ 10 open at
-- any time); five outcomes per event, resolved when due.

\set engine_json `cat :dir/engine_round.json`
\set momentum_json `cat :dir/momentum_evidence.json`
\set liquidity_json `cat :dir/liquidity_evidence.json`
\set compact_json `cat :dir/compact_snapshot.json`

create temp table payload as select
  :'engine_json'::jsonb as engine,
  :'momentum_json'::jsonb as momentum,
  :'liquidity_json'::jsonb as liquidity,
  :'compact_json'::jsonb as compact,
  (:rounds)::int as rounds,
  (:sleep)::float8 as sleep_s,
  jsonb_build_object(
    'BOOST_LATEST', jsonb_build_object('attempts',1,'ok',1,'failed',0,'rateLimited',0,'skipped',0),
    'BOOST_TOP', jsonb_build_object('attempts',1,'ok',1,'failed',0,'rateLimited',0,'skipped',0),
    'ADS', jsonb_build_object('attempts',1,'ok',1,'failed',0,'rateLimited',0,'skipped',0),
    'CANONICAL_PAIR', jsonb_build_object('attempts',4,'ok',4,'failed',0,'rateLimited',0,'skipped',0),
    'TOKEN_ENRICHMENT', jsonb_build_object('attempts',3,'ok',3,'failed',0,'rateLimited',0,'skipped',0),
    'DUE_TOKEN_BATCH', jsonb_build_object('attempts',1,'ok',1,'failed',0,'rateLimited',0,'skipped',0),
    'PAIR_FALLBACK', jsonb_build_object('attempts',0,'ok',0,'failed',0,'rateLimited',0,'skipped',0)
  ) as requests;

create or replace procedure bench.take_sample(n int) language plpgsql as $$
begin
  insert into bench.sample
  select n, c.oid::regclass::text,
         pg_total_relation_size(c.oid), pg_relation_size(c.oid),
         coalesce(pg_total_relation_size(nullif(c.reltoastrelid, 0)), 0),
         pg_indexes_size(c.oid), s.n_live_tup, s.n_dead_tup, s.n_tup_hot_upd, s.n_tup_upd
  from pg_class c join pg_stat_user_tables s on s.relid = c.oid
  where s.schemaname in ('history', 'engine');
end $$;

do $$
declare
  t0 timestamptz := '2026-09-26 00:00:00+00';
  p record;
  r timestamptz; k text; i int; n int := 0; ev text; typ text; evid jsonb;
begin
  select * into p from payload;
  for i in 0 .. p.rounds - 1 loop
    r := t0 + make_interval(mins => i);
    k := to_char(r at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"');

    -- claim (short write), then the single round commit
    insert into history.signal_round (key, scheduled_at, state, attempt, owner, lease_until)
      values (k, r, 'CLAIMED', 1, 'w' || i, r + interval '50 seconds');
    commit;

    update history.signal_round
       set state = 'COMPLETED', lease_until = null, data_status = 'live', rules_version = 'rv_bench',
           universe_size = 42, requests = p.requests, finished_at = r + interval '3 seconds'
     where key = k and owner = 'w' || i and state = 'CLAIMED';

    insert into engine.snapshot_round values (k, r, p.engine);
    delete from engine.snapshot_round where observed_at < r - interval '90 minutes';

    if i % 7 = 0 then
      n := n + 1;
      ev := 'evt_' || md5('bench' || n);
      typ := case when n % 3 = 0 then 'LIQUIDITY_REMOVED' else 'EARLY_MOMENTUM' end;
      evid := case when typ = 'EARLY_MOMENTUM' then p.momentum else p.liquidity end;
      insert into history.signal_event
        values (ev, 'solana:Bench' || n, 'solana', 'Bench' || n, 'BenchPair' || n, 'SYM', typ,
                case when typ = 'EARLY_MOMENTUM' then null else 'MEDIUM' end, 'rv_bench', k, r, evid, p.compact);
      insert into history.signal_episode (event_id, asset_key, type, rules_version, status,
          last_fired_at, last_valid_at, last_evaluated_at, rounds_fired, peak_va_ratio)
        values (ev, 'solana:Bench' || n, typ, 'rv_bench', 'OPEN', r, r, r, 1, 4.2);
      insert into history.signal_outcome (event_id, horizon_minutes, target_at, window_end_at, availability)
        select ev, h, r + make_interval(mins => h),
               r + make_interval(mins => h) + case h when 5 then interval '2 min' when 15 then interval '3 min'
                 when 60 then interval '10 min' when 240 then interval '20 min' else interval '60 min' end,
               'PENDING'
        from unnest(array[5, 15, 60, 240, 1440]) h;
    end if;

    -- open episodes: FIRED for their first 60 minutes, then VALID_NEGATIVE until SIGNAL_EXIT
    update history.signal_episode e
       set last_evaluated_at = r, last_fired_at = r, last_valid_at = r, rounds_fired = rounds_fired + 1
      from history.signal_event s
     where s.id = e.event_id and e.status = 'OPEN' and e.last_evaluated_at < r
       and s.opened_at > r - interval '60 minutes';
    update history.signal_episode
       set last_evaluated_at = r, last_valid_at = r, last_valid_negative_at = r,
           negative_streak_started_at = coalesce(negative_streak_started_at, r),
           negative_streak_count = negative_streak_count + 1
     where status = 'OPEN' and last_evaluated_at < r;
    update history.signal_episode
       set status = 'CLOSED', close_reason = 'SIGNAL_EXIT', closed_at = r
     where status = 'OPEN' and negative_streak_count >= 5;

    -- due outcomes observed from the round (compact market fields)
    update history.signal_outcome
       set availability = 'OBSERVED', observed_at = target_at + interval '2 seconds', delay_seconds = 2,
           source = 'ROUND', pair_address = 'BenchPair', round_key = k, market = p.compact, attempts = 1
     where availability = 'PENDING' and target_at <= r;

    commit;
    if i % 60 = 59 then call bench.take_sample(i + 1); commit; end if;
    perform pg_sleep(p.sleep_s);
  end loop;
end $$;
