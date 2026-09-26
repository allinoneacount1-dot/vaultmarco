// Supabase Edge Function (Deno 2): recorder health (OK / STALE / FAILING).
// Read-only: connects as recorder_reader, which may only call the ops status
// functions. Deploy with --no-verify-jwt; callers present x-health-secret.
import postgres from "npm:postgres@3.4.9";
import { createHealthHandler } from "../_shared/recorder-core.js";

const url = Deno.env.get("HEALTH_DB_URL"); // recorder_reader via the transaction pooler (:6543)
const sql = url
  ? postgres(url, { prepare: false, max: 1, idle_timeout: 20, connect_timeout: 10 })
  : null;

Deno.serve(createHealthHandler({ sql, secret: Deno.env.get("HEALTH_SECRET") }));
