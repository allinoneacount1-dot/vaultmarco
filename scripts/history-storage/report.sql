-- LOCAL STORAGE BENCHMARK ONLY — report for a finished replay.
\pset footer off
\echo '== Engine state over time (plateau check), hourly samples'
select round_no / 60 as hour,
       pg_size_pretty(sum(total_bytes)) as engine_total,
       sum(total_bytes) as engine_bytes,
       sum(live_tup) as live_rows,
       sum(dead_tup) as dead_rows
from bench.sample where relation like 'engine.%'
group by round_no order by round_no;

\echo '== History (durable product data) over time'
select round_no / 60 as hour, pg_size_pretty(sum(total_bytes)) as history_total, sum(total_bytes) as history_bytes
from bench.sample where relation like 'history.%'
group by round_no order by round_no;

\echo '== Final footprint by relation (actual, including TOAST and indexes)'
select c.oid::regclass as relation,
       s.n_live_tup as live, s.n_dead_tup as dead,
       pg_size_pretty(pg_relation_size(c.oid)) as heap,
       pg_size_pretty(coalesce(pg_total_relation_size(nullif(c.reltoastrelid, 0)), 0)) as toast,
       pg_size_pretty(pg_indexes_size(c.oid)) as indexes,
       pg_size_pretty(pg_total_relation_size(c.oid)) as total,
       pg_total_relation_size(c.oid) as total_bytes,
       case when s.n_tup_upd > 0 then round(100.0 * s.n_tup_hot_upd / s.n_tup_upd, 1) end as hot_pct,
       s.autovacuum_count as autovacuums
from pg_class c join pg_stat_user_tables s on s.relid = c.oid
where s.schemaname in ('history', 'engine') order by 1;

\echo '== Logical payload (JSON / text octets) vs physical footprint'
select 'signal_event' as rel, count(*) as rows,
       sum(octet_length(evidence::text) + octet_length(open_snapshot::text)) as logical_json_bytes,
       pg_total_relation_size('history.signal_event') as physical_bytes
from history.signal_event
union all
select 'signal_outcome', count(*), sum(coalesce(octet_length(market::text), 0)), pg_total_relation_size('history.signal_outcome')
from history.signal_outcome
union all
select 'signal_episode', count(*), 0, pg_total_relation_size('history.signal_episode') from history.signal_episode
union all
select 'signal_round', count(*), sum(coalesce(octet_length(requests::text), 0)), pg_total_relation_size('history.signal_round')
from history.signal_round
union all
select 'engine.snapshot_round', count(*), sum(octet_length(snapshots::text)), pg_total_relation_size('engine.snapshot_round')
from engine.snapshot_round;

\echo '== One-year projection at the replayed (upper-bound) event rate'
with ev as (
  select count(*) as events,
         (select extract(epoch from max(scheduled_at) - min(scheduled_at)) / 86400.0 from history.signal_round) as days,
         pg_total_relation_size('history.signal_event') + pg_total_relation_size('history.signal_episode')
           + pg_total_relation_size('history.signal_outcome') as durable_bytes
  from history.signal_event
), rd as (
  select count(*) as rounds, pg_total_relation_size('history.signal_round') as round_bytes from history.signal_round
), eng as (
  select sum(total_bytes) as engine_bytes from bench.sample
  where relation like 'engine.%' and round_no = (select max(round_no) from bench.sample)
)
select ev.events, round(ev.days::numeric, 2) as days_replayed,
       round(ev.events / ev.days) as events_per_day,
       round(ev.durable_bytes::numeric / ev.events) as bytes_per_event_incl_episode_outcomes_indexes,
       pg_size_pretty((ev.durable_bytes / ev.days * 365)::bigint) as durable_year_one,
       pg_size_pretty((rd.round_bytes::numeric / rd.rounds * 1440 * 30)::bigint) as round_log_30d_steady,
       pg_size_pretty(eng.engine_bytes::bigint) as engine_steady,
       pg_size_pretty((ev.durable_bytes / ev.days * 365 + rd.round_bytes::numeric / rd.rounds * 1440 * 30 + eng.engine_bytes)::bigint) as year_one_total,
       round(100 * (ev.durable_bytes / ev.days * 365 + rd.round_bytes::numeric / rd.rounds * 1440 * 30 + eng.engine_bytes) / (500 * 1024 * 1024), 1) as pct_of_500mb
from ev, rd, eng;
