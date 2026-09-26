import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseScheduledAt } from "@/server/recorder/handler";
import { createTestDb, pgEnabled, type TestDb } from "./pgHarness";

/**
 * supabase/b0/cron.sql is applied by hand in B0. Here it runs against STUB
 * cron / net / vault schemas (same function signatures) in a local database, to
 * prove what the scheduled job sends — without any Supabase project.
 */

const CRON_SQL = readFileSync(
  fileURLToPath(new URL("../../supabase/b0/cron.sql", import.meta.url)),
  "utf8",
);

const STUBS = `
  create schema cron; create schema net; create schema vault;
  create table cron.jobs (jobname text primary key, schedule text, command text);
  create function cron.schedule(job_name text, schedule text, command text) returns bigint
    language sql as $$ insert into cron.jobs values (job_name, schedule, command) returning 1::bigint $$;
  create table cron.job_run_details (runid bigserial, end_time timestamptz);
  create table net.requests (url text, body jsonb, headers jsonb, timeout_milliseconds int);
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
      headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint
    language sql as $$ insert into net.requests values (url, body, headers, timeout_milliseconds) returning 1::bigint $$;
  create table vault.decrypted_secrets (name text primary key, decrypted_secret text);
  insert into vault.decrypted_secrets values
    ('recorder_url', 'https://example.invalid/functions/v1/recorder'),
    ('recorder_cron_secret', 'stub-secret-for-test');`;

describe.skipIf(!pgEnabled)("B0 cron SQL (against stub pg_cron / pg_net / Vault)", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb("stepb_cron");
    await db.admin.unsafe(STUBS);
    await db.admin.unsafe(CRON_SQL);
  }, 30_000);
  afterAll(async () => {
    await db?.drop();
  });

  it("schedules the recorder every minute and housekeeping daily", async () => {
    const jobs = await db.admin`select jobname, schedule from cron.jobs order by jobname`;
    expect(jobs).toEqual([
      { jobname: "signal-history-housekeeping", schedule: "17 3 * * *" },
      { jobname: "signal-history-recorder", schedule: "* * * * *" },
    ]);
  });

  it("the job posts the database-derived scheduled minute with the Vault secret header", async () => {
    const [{ command }] =
      await db.admin`select command from cron.jobs where jobname = 'signal-history-recorder'`;
    await db.admin.unsafe(command); // what pg_cron runs each minute
    const [req] = await db.admin`select url, body, headers, timeout_milliseconds from net.requests`;
    expect(req.url).toBe("https://example.invalid/functions/v1/recorder");
    expect(req.headers).toEqual({
      "content-type": "application/json",
      "x-recorder-secret": "stub-secret-for-test",
    });
    expect(req.timeout_milliseconds).toBe(60_000);
    expect(req.body.scheduledAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:00Z$/);
    const ms = parseScheduledAt(req.body, Date.now() + 60_000);
    expect(typeof ms).toBe("number");
    expect(Math.abs((ms as number) - Date.now())).toBeLessThan(2 * 60_000);
  });

  it("the housekeeping job prunes pg_cron run history older than 7 days", async () => {
    await db.admin.unsafe(`insert into cron.job_run_details (end_time) values
      (now() - interval '8 days'), (now() - interval '6 days'), (now())`);
    const [{ command }] =
      await db.admin`select command from cron.jobs where jobname = 'signal-history-housekeeping'`;
    await db.admin.unsafe(command);
    const [{ n }] = await db.admin`select count(*)::int as n from cron.job_run_details`;
    expect(n).toBe(2);
  });
});
