-- LOCAL STORAGE BENCHMARK ONLY — NOT A PRODUCTION MIGRATION.
-- Mirrors the approved Phase 3 design (immutable event + narrow episode +
-- outcomes + round/gap log + temporary engine state) with the storage layout
-- chosen from measurement (see README):
--   • durable outcomes are INSERT-ONLY with typed columns; PENDING bookkeeping
--     is temporary engine state, deleted on resolution
--   • round accounting is a compact counter array

drop schema if exists history cascade;
drop schema if exists engine cascade;
drop schema if exists bench cascade;
create schema history;
create schema engine;   -- temporary engine state: never exposed, never Signal History
create schema bench;

-- Round / claim / gap log (operational; 30-day retention).
create table history.signal_round (
  key            text primary key,               -- scheduled minute, e.g. 2026-09-26T00:07Z
  scheduled_at   timestamptz not null unique,
  state          text not null check (state in ('CLAIMED','COMPLETED','FAILED','GAP','SUPERSEDED')),
  attempt        smallint not null default 1,
  owner          text,
  lease_until    timestamptz,
  data_status    text check (data_status in ('live','degraded','stale','offline')),
  rules_version  text,
  universe_size  smallint,
  issues         text[],
  -- per endpoint (fixed ENDPOINTS order) × [attempts, ok, failed, rateLimited, skipped]
  requests       smallint[],
  finished_at    timestamptz
);

-- TEMPORARY ENGINE STATE (90-minute retention).
create table engine.snapshot_round (
  key          text primary key,
  observed_at  timestamptz not null,
  snapshots    jsonb not null
) with (autovacuum_vacuum_scale_factor = 0, autovacuum_vacuum_threshold = 20,
        toast.autovacuum_vacuum_scale_factor = 0, toast.autovacuum_vacuum_threshold = 20);
create index snapshot_round_observed on engine.snapshot_round (observed_at);

create table engine.provider_cooldown (
  endpoint         text primary key,
  until            timestamptz not null,
  consecutive_429  smallint not null
);

-- PENDING outcome bookkeeping — temporary; the row is deleted when the outcome resolves.
create table engine.pending_outcome (
  event_id         text not null,
  horizon_minutes  smallint not null,
  target_at        timestamptz not null,
  window_end_at    timestamptz not null,
  last_failure     text,
  attempts         smallint not null default 0,
  primary key (event_id, horizon_minutes)
) with (autovacuum_vacuum_scale_factor = 0, autovacuum_vacuum_threshold = 20);
create index pending_outcome_target on engine.pending_outcome (target_at);

-- IMMUTABLE signal event. Evidence is the engine's own rule object, stored whole.
create table history.signal_event (
  id             text primary key,
  asset_key      text not null,
  chain_id       text not null,
  address        text not null,
  pair_address   text not null,
  symbol         text,
  type           text not null check (type in ('EARLY_MOMENTUM','LIQUIDITY_ADDED','LIQUIDITY_REMOVED')),
  severity       text check (severity in ('MEDIUM','HIGH')),
  rules_version  text not null,
  opened_at      timestamptz not null,           -- round identity = this minute
  evidence       jsonb not null,
  open_snapshot  jsonb not null
);
create index signal_event_feed  on history.signal_event (opened_at desc);
create index signal_event_asset on history.signal_event (asset_key, opened_at desc);

-- NARROW mutable episode state (HOT-update friendly: no indexed column changes per round).
create table history.signal_episode (
  event_id                    text primary key references history.signal_event on delete cascade,
  asset_key                   text not null,
  type                        text not null,
  rules_version               text not null,
  status                      text not null check (status in ('OPEN','CLOSED')),
  close_reason                text check (close_reason in ('SIGNAL_EXIT','TRACKING_LOST','RULES_CHANGED')),
  closed_at                   timestamptz,
  last_fired_at               timestamptz not null,
  last_valid_at               timestamptz not null,
  last_evaluated_at           timestamptz not null,
  negative_streak_count       smallint not null default 0,
  negative_streak_started_at  timestamptz,
  last_valid_negative_at      timestamptz,
  rounds_fired                int not null default 1,
  peak_va_ratio               double precision,
  peak_abs_liquidity_delta    double precision
) with (fillfactor = 70);
create unique index signal_episode_one_open on history.signal_episode (asset_key, type) where status = 'OPEN';

-- Resolved outcome observations: INSERT-ONLY, unique (event_id, horizon).
create table history.signal_outcome (
  event_id            text not null references history.signal_event on delete cascade,
  horizon_minutes     smallint not null check (horizon_minutes in (5, 15, 60, 240, 1440)),
  availability        text not null check (availability in ('OBSERVED','UNAVAILABLE')),
  unavailable_reason  text,
  target_at           timestamptz not null,
  observed_at         timestamptz,              -- the real sample time
  delay_seconds       int,
  source              text check (source in ('ROUND','DUE_TOKEN_BATCH','PAIR_FALLBACK')),
  round_at            timestamptz,              -- set when source = ROUND
  pair_address        text,                     -- audit: equals the event's pair
  price_usd           double precision,
  liquidity_usd       double precision,
  fdv                 double precision,
  market_cap          double precision,
  volume_h1           double precision,
  volume_h24          double precision,
  txns_h1_buys        int,
  txns_h1_sells       int,
  price_change_h1     double precision,
  attempts            smallint not null,
  primary key (event_id, horizon_minutes)
);

-- Benchmark sampling.
create table bench.sample (
  round_no     int not null,
  relation     text not null,
  total_bytes  bigint not null,
  heap_bytes   bigint not null,
  toast_bytes  bigint not null,
  index_bytes  bigint not null,
  live_tup     bigint,
  dead_tup     bigint,
  hot_upd      bigint,
  upd          bigint,
  autovacuums  bigint,
  primary key (round_no, relation)
);
