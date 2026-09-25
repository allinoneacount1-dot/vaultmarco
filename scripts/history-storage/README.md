# Signal History — local storage benchmark

**Local, disposable Postgres only. Not a migration, not a deployment.** `run.sh` refuses a non-local `PGHOST`.

This is the permanent regression benchmark for the Phase 3 storage design:

- immutable `history.signal_event`
- narrow, HOT-updated `history.signal_episode`
- `history.signal_outcome`
- the `history.signal_round` round/gap log
- temporary `engine.snapshot_round` (90-minute retention)

It measures the **actual Postgres footprint** of the recorder's write pattern: heap, TOAST, indexes, dead tuples, HOT ratio and autovacuum runs, sampled hourly. Estimating JSON sizes is not enough.

## What it replays

1. **Payloads come from the real engine.** `export-fixtures.ts` runs the real engine (`fetchRealtimePairs` → `fetchPairUniverse` → radar) and the recorder's `compactSnapshot` over the recorded DexScreener fixtures. It produces a real `MomentumSignal`, a real `LiquidityEvent`, a compact snapshot and one engine round.
   - The engine round is scaled to production cardinality (42 pairs) by re-keying the recorded snapshots. That scaling is test-only.
2. **The workload is the agreed upper bound.** `replay.sql` writes what the recorder writes, one round at a time with a commit per round:
   - one new event every 7 rounds (about 205 a day), each with 5 outcomes;
   - episodes open about 65 rounds, then close as SIGNAL_EXIT;
   - engine state inserted each round and pruned after 90 minutes;
   - a claimed-then-completed round row every minute.
3. **Cadence matches production.** Start Postgres with `-c autovacuum_naptime=1s` and use `SLEEP=1`: one round per autovacuum cycle, the same ratio as production (one round per minute, 60 s naptime). A 24-hour-equivalent run takes about 24 minutes.

## Run

```bash
PGHOST=/path/to/socket PGPORT=5432 PGUSER=me PGDATABASE=postgres \
ROUNDS=2160 SLEEP=1 scripts/history-storage/run.sh      # 36 h equivalent
```

`report.sql` prints:

- the engine-state size per hour (the plateau check);
- durable history per hour;
- the final footprint by relation;
- the logical JSON payload next to the physical size;
- a one-year projection at the replayed event rate, against the 500 MB free-tier quota.

It prints this twice: once as replayed (autovacuum only) and once after `VACUUM (ANALYZE)`.

## Pass criteria (Step A)

- The engine state reaches a bounded steady state and stays flat.
- The projected year-one footprint at the upper-bound load is under 50% of 500 MB (250 MB).
- `signal_episode` HOT-update ratio is at least 95%.
