import { handleHealthRequest, handleRecorderRequest, type LogEntry } from "./handler";
import { fetchRawHttp } from "./http";
import { postgresJsPool, type PostgresJsLike } from "./pg";
import { PgRecorderStore } from "./pgStore";

/**
 * BUNDLE ENTRY for the Supabase Edge Functions (built by
 * `npm run recorder:bundle` into supabase/functions/_shared/recorder-core.js).
 * The Deno entry files pass in a postgres.js client and secrets read from the
 * function environment; everything else is the existing pure recorder.
 */

export { PgRecorderStore } from "./pgStore";
export { postgresJsPool } from "./pg";
export { fetchRawHttp } from "./http";
export { handleHealthRequest, handleRecorderRequest } from "./handler";

const structuredLog = (entry: LogEntry) => console.log(JSON.stringify(entry));

export function createRecorderHandler(opts: {
  /** postgres.js client for the recorder_writer role; null if not configured. */
  sql: PostgresJsLike | null;
  secret: string | undefined;
  fetchImpl?: typeof fetch;
  now?: () => number;
  log?: (entry: LogEntry) => void;
}): (req: Request) => Promise<Response> {
  const now = opts.now ?? Date.now;
  const store = opts.sql ? new PgRecorderStore(postgresJsPool(opts.sql), { now }) : null;
  const http = fetchRawHttp(opts.fetchImpl ?? fetch);
  return (req) =>
    handleRecorderRequest(req, {
      secret: opts.secret,
      store,
      http,
      now,
      newOwner: () => crypto.randomUUID(),
      noteInvocation: store ? (result, at) => store.noteInvocation(result, at) : undefined,
      log: opts.log ?? structuredLog,
    });
}

export function createHealthHandler(opts: {
  /** postgres.js client for the read-only recorder_reader role; null if not configured. */
  sql: PostgresJsLike | null;
  secret: string | undefined;
  log?: (entry: LogEntry) => void;
}): (req: Request) => Promise<Response> {
  const pool = opts.sql ? postgresJsPool(opts.sql) : null;
  return (req) =>
    handleHealthRequest(req, {
      secret: opts.secret,
      readHealth: pool
        ? async () => (await pool.query(`select ops.recorder_health_at(now()) as h`))[0]?.h
        : null,
      log: opts.log ?? structuredLog,
    });
}
