# Signal History — Supabase server recorder (Phase 3, Step B)

Code only. **Nothing here has been provisioned, applied or deployed.** B0 is a
separate, owner-approved step (checklist below).

```
pg_cron (every minute, database clock → scheduledAt)
  → pg_net HTTP POST  (x-recorder-secret from Vault)
  → Edge Function `recorder` (Deno 2)            supabase/functions/recorder/index.ts
      → thin shell: auth · scheduledAt · clock   src/server/recorder/handler.ts
      → PgRecorderStore / fetch RawHttp          src/server/recorder/pgStore.ts, http.ts
      → EXISTING pure recorder (runRound)        src/lib/history/recorder.ts
      → EXISTING deterministic signal engine     src/lib/signals, src/lib/providers
  → Postgres (private schemas history / engine / ops, role recorder_writer)
Edge Function `health` (role recorder_reader) → ops.recorder_health_at(now())
```

| Path | What |
|---|---|
| `migrations/20260926120000_signal_history_recorder.sql` | Schemas, tables, constraints, indexes, roles, grants, `ops` status/health functions, housekeeping |
| `functions/recorder/index.ts`, `functions/health/index.ts` | Deno entry files (a few lines each) |
| `functions/_shared/recorder-core.js` | **Generated** by `npm run recorder:bundle` (gitignored): the core + store + handlers as one platform-neutral ES module, zero external imports |
| `b0/cron.sql` | Manual B0 script: the one-minute schedule and daily housekeeping (not a migration) |

## Security model

- `history`, `engine`, `ops` are **private**: never add them to *Settings → API → Exposed schemas*.
  `anon`, `authenticated` and `PUBLIC` have no privilege on any of their objects (tested).
- `recorder_writer` (recorder function): insert/select events, CAS updates on episodes,
  insert-only outcomes, round/engine/cooldown maintenance. It cannot update or delete
  events or outcomes (grants **and** an immutability trigger).
- `recorder_reader` (health function): may only call the `ops` status/health functions.
- Neither role uses `service_role` or any API key. Both are created `NOLOGIN`; B0 gives them
  passwords. Credentials live only in Edge Function secrets and Vault — never in the repo,
  never in `VITE_*` variables, never in the browser.
- The cron job authenticates with `x-recorder-secret` (compared in constant time);
  functions are deployed with `--no-verify-jwt` for that reason. Secrets are never logged.

## B0 provisioning checklist — NOT EXECUTED (requires owner approval)

1. Create a Supabase **Free** project, region **Singapore (ap-southeast-1)**. Do not upgrade to Pro.
2. Record the platform baseline **before** anything else:
   `select pg_database_size(current_database());`
3. Apply the migration (`supabase db push`, or paste the file into the SQL editor).
4. Give the two roles passwords (generated locally, stored only in a password manager):
   `alter role recorder_writer with login password '<generated>';`
   `alter role recorder_reader with login password '<generated>';`
5. Build connection strings for the **transaction pooler (port 6543)** using
   `recorder_writer.<project-ref>` / `recorder_reader.<project-ref>` as the user name.
   Verify both roles can connect through Supavisor.
6. Set function secrets (never commit):
   `supabase secrets set RECORDER_DB_URL=… RECORDER_CRON_SECRET=… HEALTH_DB_URL=… HEALTH_SECRET=…`
7. Build and deploy:
   `npm run recorder:bundle`
   `supabase functions deploy recorder --no-verify-jwt`
   `supabase functions deploy health --no-verify-jwt`
8. Verify health responds (expected `STALE` before the first round):
   `curl -H "x-health-secret: $HEALTH_SECRET" https://<ref>.supabase.co/functions/v1/health`
9. Enable the `pg_cron` and `pg_net` extensions; create the two Vault secrets
   (`recorder_cron_secret`, `recorder_url`) as described at the top of `b0/cron.sql`.
10. Run `b0/cron.sql` (one-minute recorder + daily housekeeping).
11. Within 3 minutes, health should be `OK`; `ops.recorder_status` should show completed rounds.
12. **DexScreener access:** rounds report `data_status = 'live'` and `ok` request counts > 0.
13. **Forced duplicate:** POST the last completed minute to the recorder by hand → `SKIPPED`, no new rows.
14. **Lease takeover:** as `postgres`, insert a `CLAIMED` row for a minute ~2 minutes ahead with
    `owner = 'b0-stuck'`, `attempt = 1`, `lease_until` = that minute; when cron fires it must
    complete with `attempt = 2`.
15. **Forced rollback:** `revoke insert on engine.snapshot_round from recorder_writer` for one
    minute → that round must be `FAILED` with no partial writes; then re-grant.
16. Run 24–72 h. Record from `ops.recorder_status`: GAP count (scheduler misses),
    `duration_ms` p50/p95, 429s by endpoint, events/day, outcome coverage, database size growth.
    Record Edge Function CPU time from the Supabase function logs/metrics.
17. Rollback at any time: `select cron.unschedule('signal-history-recorder');`

B1 (shadow recorder on Pro) stays on HOLD until B0 passes.
