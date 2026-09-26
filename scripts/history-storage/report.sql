-- LOCAL STORAGE BENCHMARK ONLY — report for a finished replay.
\pset footer off
\echo '== Engine state over time (plateau check), hourly samples'
select round_no / 60 as hour,
       pg_size_pretty(sum(total_bytes)) as engine_total,
       sum(autovacuums) as autovacuums,
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

\echo '== Durable product data only (history.* except the round log)'
select pg_size_pretty(sum(pg_total_relation_size(relid))) as durable_total, sum(pg_total_relation_size(relid)) as durable_bytes
from pg_stat_user_tables where schemaname = 'history' and relname <> 'signal_round';

\echo '== Logical payload (JSON / text octets) vs physical footprint'
select 'signal_event' as rel, count(*) as rows,
       sum(octet_length(evidence::text) + octet_length(open_snapshot::text)) as logical_json_bytes,
       pg_total_relation_size('history.signal_event') as physical_bytes
from history.signal_event
union all
select 'signal_outcome', count(*), 0, pg_total_relation_size('history.signal_outcome')
from history.signal_outcome
union all
select 'signal_episode', count(*), 0, pg_total_relation_size('history.signal_episode') from history.signal_episode
union all
select 'signal_round', count(*), 0, pg_total_relation_size('history.signal_round')
from history.signal_round
union all
select 'engine.snapshot_round', count(*), sum(octet_length(snapshots::text)), pg_total_relation_size('engine.snapshot_round')
from engine.snapshot_round;

\echo '== One-year projection at the replayed (upper-bound) event rate — per FULLY RESOLVED event (all 5 outcomes)'
with m as (
  select (select count(*) from history.signal_event) as events,
         (select count(*) from history.signal_outcome) as outcomes,
         (select extract(epoch from max(scheduled_at) - min(scheduled_at)) / 86400.0 from history.signal_round) as days,
         pg_total_relation_size('history.signal_event') as ev_b,
         pg_total_relation_size('history.signal_episode') as ep_b,
         pg_total_relation_size('history.signal_outcome') as oc_b,
         pg_total_relation_size('history.signal_round') as rd_b,
         (select count(*) from history.signal_round) as rounds,
         (select sum(total_bytes) from bench.sample where relation like 'engine.%'
           and round_no = (select max(round_no) from bench.sample)) as engine_b
), per as (
  select *, events / days as per_day,
         ev_b::numeric / events as event_b, ep_b::numeric / events as episode_b,
         5 * oc_b::numeric / outcomes as outcomes_b
  from m
)
select round(per_day) as events_per_day,
       round(event_b) as event_bytes, round(episode_b) as episode_bytes, round(outcomes_b) as five_outcomes_bytes,
       round(event_b + episode_b + outcomes_b) as bytes_per_event,
       pg_size_pretty((per_day * 365 * (event_b + episode_b + outcomes_b))::bigint) as durable_year_one,
       pg_size_pretty((rd_b::numeric / rounds * 1440 * 30)::bigint) as round_log_30d,
       pg_size_pretty(engine_b::bigint) as engine_steady,
       pg_size_pretty((per_day * 365 * (event_b + episode_b + outcomes_b) + rd_b::numeric / rounds * 1440 * 30 + engine_b)::bigint) as year_one_total,
       round(100 * (per_day * 365 * (event_b + episode_b + outcomes_b) + rd_b::numeric / rounds * 1440 * 30 + engine_b) / (500 * 1024 * 1024), 1) as pct_of_500mb,
       round((250 * 1024 * 1024 - rd_b::numeric / rounds * 1440 * 30 - engine_b) / (365 * (event_b + episode_b + outcomes_b))) as max_events_per_day_for_50pct
from per;
