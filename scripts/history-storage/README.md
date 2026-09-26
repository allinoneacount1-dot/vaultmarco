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

## Methodology note: one statement per round

An earlier version ran every round inside a single `DO` block. A backend reports table statistics only when it goes idle between statements, so autovacuum never saw the dead tuples:

- `autovacuum_count` stayed 0 on every table for 36 simulated hours;
- engine state grew linearly (about 1 MB an hour) with no plateau.

Production rounds are separate, short transactions. `run.sh` therefore issues `call bench.round(i)` once per round as its own client statement, followed by `pg_sleep`.

## Storage layout chosen from measurement

The first full measurement projected **~101% of the 500 MB quota** in year one at the upper-bound load. About 6.2 KB per event, dominated by outcome rows that were inserted PENDING and then updated, each with a repeated-key JSON blob. The layout was changed without dropping any audit evidence:

| Change | Why |
|---|---|
| `history.signal_outcome` is **insert-only**, with typed columns for the selected real market fields | No update churn, no dead tuples, no JSON key repetition. |
| PENDING bookkeeping lives in `engine.pending_outcome` (temporary; the row is deleted when the outcome resolves) | Durable history holds only resolved truth. The (event, horizon) key stays unique in both tables. |
| Round accounting is a `smallint[]` (7 endpoints × 5 counters) instead of JSON | The 30-day round log is about 3× smaller. |

These are storage-adapter decisions for Step B. The pure recorder model (`OutcomeObservation` with `PENDING / OBSERVED / UNAVAILABLE`) is unchanged; the adapter maps PENDING to the engine table and resolved outcomes to the durable one.

**Tried and rejected:** `toast_tuple_target = 512` on `signal_event` compressed nothing. Postgres only invokes compression for rows above its fixed ~2 KB threshold, and event rows are about 1.5 KB. The heap measured 456 KB with the setting and 464 KB without it, so the setting was removed.

## Result: 36 h equivalent, upper-bound load (206 events a day)

| Check | Result | Verdict |
|---|---|---|
| Engine-state plateau | 1.12 MB at hour 1, then 1.77–1.84 MB from hour 2 to hour 36; autovacuum ran 159 times | **PASS** |
| `signal_episode` HOT-update ratio | 98.5% | **PASS** |
| Year-one footprint under 50% of 500 MB | **336 MB (67.2%)**: 4,463 B per fully resolved event (event 2,121 + episode 663 + five outcomes 1,679), plus 14 MB round log (30 days) and 1.8 MB engine state | **FAIL** |

At the upper-bound load, the 500 MB Free database tier is **not appropriate** for year one. It stays under 50% only up to about **151 events a day**. At 206 a day it would cross the 200 MB warning after about 7 months and the 300 MB critical threshold after about 11 months.

- **Not done:** the target was not met by removing audit evidence.
- **Remaining legitimate savings are small.** For example, bigint surrogate keys for the child tables would save roughly 8%. That still does not reach 50%.

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
