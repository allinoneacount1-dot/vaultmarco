#!/usr/bin/env bash
# LOCAL STORAGE BENCHMARK ONLY — never points at a hosted database.
#
# Requires a LOCAL, disposable PostgreSQL 16+ reachable through the standard
# libpq variables (PGHOST, PGPORT, PGUSER, PGDATABASE), started with
#   -c autovacuum_naptime=1s
# so that one replayed round per second matches production's one round per
# 60 s autovacuum cycle.
#
#   ROUNDS=2160 SLEEP=1 scripts/history-storage/run.sh      # 36 h equivalent (~36 min)
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${ROUNDS:=2160}" "${SLEEP:=1}" "${OUT:=/tmp/history-storage}"
case "${PGHOST:-}" in
  ""|/*|localhost|127.0.0.1) ;;
  *) echo "refusing to run against non-local PGHOST=$PGHOST" >&2; exit 1 ;;
esac

npx vite-node scripts/history-storage/export-fixtures.ts "$OUT"
psql -v ON_ERROR_STOP=1 -q -f scripts/history-storage/schema.sql
psql -v ON_ERROR_STOP=1 -q -v dir="$OUT" -f scripts/history-storage/replay.sql
# One client statement per round (backend idle in between, like production).
for ((i = 0; i < ROUNDS; i++)); do
  echo "call bench.round($i);"
  if ((SLEEP > 0)); then echo "select pg_sleep($SLEEP);"; fi
  if (((i + 1) % 60 == 0)); then echo "call bench.take_sample($((i + 1)));"; fi
done | psql -v ON_ERROR_STOP=1 -q -o /dev/null
echo "== report (as replayed, autovacuum only)"
psql -q -f scripts/history-storage/report.sql
psql -q -c "vacuum (analyze) history.signal_round, history.signal_event, history.signal_episode, history.signal_outcome, engine.snapshot_round, engine.pending_outcome"
echo "== after VACUUM (ANALYZE)"
psql -q -f scripts/history-storage/report.sql | sed -n '/Final footprint/,$p'
