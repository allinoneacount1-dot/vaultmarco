-- ============================================================================
-- MARCOVAULT · Signal History — B0 scheduler (MANUAL, NOT A MIGRATION)
--
-- Run by the owner in the Supabase SQL editor ONLY during B0 provisioning,
-- after: the migration is applied, pg_cron + pg_net are enabled, the recorder
-- Edge Function is deployed, and the two Vault secrets below exist.
-- Nothing in this file contains a real secret or project URL.
--
-- Prerequisite (run once, replacing the placeholders — never commit values):
--   select vault.create_secret('<RECORDER_CRON_SECRET>', 'recorder_cron_secret');
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/recorder', 'recorder_url');
-- The same <RECORDER_CRON_SECRET> is set on the function:
--   supabase secrets set RECORDER_CRON_SECRET=<RECORDER_CRON_SECRET>
-- ============================================================================

-- One round per minute. The ROUND IDENTITY comes from the database clock here
-- (the minute this job started), sent as `scheduledAt`; the function never
-- re-derives it from its own start time, so a delayed invocation still runs the
-- scheduled minute. pg_net is asynchronous: this job only enqueues the request.
select cron.schedule(
  'signal-history-recorder',
  '* * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'recorder_url'),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-recorder-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'recorder_cron_secret')
    ),
    body := jsonb_build_object(
      'scheduledAt', to_char(date_trunc('minute', now()) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ),
    timeout_milliseconds := 60000
  );
  $job$
);

-- Daily housekeeping: pg_cron run history is never cleaned automatically
-- (1,440 rows/day from the job above); keep 7 days. Also prunes the 30-day
-- ops.invocation_daily counters. pg_net responses expire on their own (6 h).
select cron.schedule(
  'signal-history-housekeeping',
  '17 3 * * *',
  $job$ select ops.prune_housekeeping(); $job$
);

-- To stop the recorder at any time (B0 rollback):
--   select cron.unschedule('signal-history-recorder');
--   select cron.unschedule('signal-history-housekeeping');
