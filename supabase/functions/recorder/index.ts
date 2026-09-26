// Supabase Edge Function (Deno 2): the Signal History recorder.
// Thin shell only — all logic is the existing pure recorder, bundled into
// ../_shared/recorder-core.js by `npm run recorder:bundle` before deploy.
// Deploy with --no-verify-jwt: the scheduler authenticates with its own
// shared secret header (x-recorder-secret), checked in constant time.
import postgres from "npm:postgres@3.4.9";
import { createRecorderHandler } from "../_shared/recorder-core.js";

const url = Deno.env.get("RECORDER_DB_URL"); // recorder_writer via the transaction pooler (:6543)
const sql = url
  ? postgres(url, { prepare: false, max: 1, idle_timeout: 20, connect_timeout: 10 })
  : null;

Deno.serve(createRecorderHandler({ sql, secret: Deno.env.get("RECORDER_CRON_SECRET") }));
