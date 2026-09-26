-- LOCAL STORAGE BENCHMARK ONLY — replay setup.
-- Defines bench.round(i): the recorder's write pattern for ONE scheduled
-- minute at the agreed UPPER-BOUND load. run.sh calls it once per round as a
-- separate client statement (then sleeps), so the backend goes idle between
-- rounds and reports table statistics — exactly like production's separate,
-- short round transactions. (Running all rounds inside one DO block hides dead
-- tuples from autovacuum and is NOT a valid methodology.)
--
-- Upper bound: one new event every 7 rounds (≈ 205 / day), two thirds EARLY
-- MOMENTUM and one third LIQUIDITY_REMOVED; each episode FIRES for its first
-- 60 minutes then records valid negatives until SIGNAL_EXIT; five outcomes per
-- event, resolved when due (insert-only), with PENDING bookkeeping as engine
-- state.

\set engine_json `cat :dir/engine_round.json`
\set momentum_json `cat :dir/momentum_evidence.json`
\set liquidity_json `cat :dir/liquidity_evidence.json`
\set compact_json `cat :dir/compact_snapshot.json`

create table bench.payload as select
  :'engine_json'::jsonb as engine,
  :'momentum_json'::jsonb as momentum,
  :'liquidity_json'::jsonb as liquidity,
  :'compact_json'::jsonb as compact,
  -- 7 endpoints × [attempts, ok, failed, rateLimited, skipped]
  array[1,1,0,0,0, 1,1,0,0,0, 1,1,0,0,0, 4,4,0,0,0, 3,3,0,0,0, 1,1,0,0,0, 0,0,0,0,0]::smallint[] as requests;

create procedure bench.take_sample(n int) language sql as $$
  insert into bench.sample
  select n, c.oid::regclass::text,
         pg_total_relation_size(c.oid), pg_relation_size(c.oid),
         coalesce(pg_total_relation_size(nullif(c.reltoastrelid, 0)), 0),
         pg_indexes_size(c.oid), s.n_live_tup, s.n_dead_tup, s.n_tup_hot_upd, s.n_tup_upd,
         s.autovacuum_count
  from pg_class c join pg_stat_user_tables s on s.relid = c.oid
  where s.schemaname in ('history', 'engine');
$$;

create procedure bench.round(i int) language plpgsql as $$
declare
  t0 timestamptz := '2026-09-26 00:00:00+00';
  p bench.payload%rowtype;
  r timestamptz := t0 + make_interval(mins => i);
  k text := to_char(r at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"');
  n int; ev text; typ text;
begin
  select * into p from bench.payload;

  -- 1. claim (its own short transaction)
  insert into history.signal_round (key, scheduled_at, state, attempt, owner, lease_until)
    values (k, r, 'CLAIMED', 1, 'w' || i, r + interval '50 seconds');
  commit;

  -- 2. (provider I/O happens here in production — no transaction open)

  -- 3. one atomic round commit
  update history.signal_round
     set state = 'COMPLETED', lease_until = null, data_status = 'live', rules_version = 'rv_bench',
         universe_size = 42, issues = '{}', requests = p.requests, finished_at = r + interval '3 seconds'
   where key = k and owner = 'w' || i and state = 'CLAIMED';

  insert into engine.snapshot_round values (k, r, p.engine);
  delete from engine.snapshot_round where observed_at < r - interval '90 minutes';

  if i % 7 = 0 then
    n := i / 7 + 1;
    ev := 'evt_' || md5('bench' || n);
    typ := case when n % 3 = 0 then 'LIQUIDITY_REMOVED' else 'EARLY_MOMENTUM' end;
    insert into history.signal_event
      values (ev, 'solana:Bench' || n, 'solana', 'Bench' || n, 'BenchPair' || n, 'SYM', typ,
              case when typ = 'EARLY_MOMENTUM' then null else 'MEDIUM' end, 'rv_bench', r,
              case when typ = 'EARLY_MOMENTUM' then p.momentum else p.liquidity end, p.compact);
    insert into history.signal_episode (event_id, asset_key, type, rules_version, status,
        last_fired_at, last_valid_at, last_evaluated_at, rounds_fired, peak_va_ratio)
      values (ev, 'solana:Bench' || n, typ, 'rv_bench', 'OPEN', r, r, r, 1, 4.2);
    insert into engine.pending_outcome (event_id, horizon_minutes, target_at, window_end_at)
      select ev, h, r + make_interval(mins => h),
             r + make_interval(mins => h) + case h when 5 then interval '2 min' when 15 then interval '3 min'
               when 60 then interval '10 min' when 240 then interval '20 min' else interval '60 min' end
      from unnest(array[5, 15, 60, 240, 1440]) h;
  end if;

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

  -- due outcomes: resolved rows are INSERTED (from this round's own sample), pending rows deleted
  insert into history.signal_outcome
    select d.event_id, d.horizon_minutes, 'OBSERVED', null, d.target_at, d.target_at + interval '2 seconds', 2,
           'ROUND', r, 'BenchPair',
           (p.compact->>'priceUsd')::float8, (p.compact->>'liquidityUsd')::float8, (p.compact->>'fdv')::float8,
           (p.compact->>'marketCap')::float8, (p.compact->>'volumeH1')::float8, (p.compact->>'volumeH24')::float8,
           (p.compact->'txnsH1'->>'buys')::int, (p.compact->'txnsH1'->>'sells')::int,
           (p.compact->>'priceChangeH1')::float8, 1
    from engine.pending_outcome d where d.target_at <= r
    on conflict do nothing;
  delete from engine.pending_outcome where target_at <= r;

  commit;
end $$;
