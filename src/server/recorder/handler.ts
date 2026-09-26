import { roundKey } from "@/lib/history/ids";
import type { RecorderStore } from "@/lib/history/ports";
import { runRound, type RoundReport } from "@/lib/history/recorder";
import type { RawHttp } from "@/lib/history/requests";
import { secretMatches } from "./secret";

/**
 * THIN PLATFORM SHELL for one scheduled recorder invocation. It only:
 *   authenticates the scheduler (shared secret header, constant-time),
 *   takes the round identity from the SCHEDULER (`scheduledAt` in the body —
 *     never from this function's start time, so a delayed invocation still
 *     runs the minute that was scheduled),
 *   runs the existing pure recorder, and
 *   returns / logs a compact result.
 * No signal rule, classification or storage logic lives here.
 */

export const RECORDER_SECRET_HEADER = "x-recorder-secret";
export const HEALTH_SECRET_HEADER = "x-health-secret";

/** Scheduler clocks may run slightly ahead of the function's clock. */
const MAX_FUTURE_SKEW_MS = 60_000;

export type LogEntry = Record<string, unknown>;

export type RecorderHandlerDeps = {
  secret: string | undefined;
  /** null when the runtime is misconfigured (e.g. no database URL). */
  store: RecorderStore | null;
  http: RawHttp;
  now: () => number;
  /** Unique owner token per invocation. */
  newOwner: () => string;
  /** Operational counter (best-effort; never affects the round). */
  noteInvocation?: (result: string, at: number) => Promise<void>;
  log?: (entry: LogEntry) => void;
  sleep?: (ms: number) => Promise<void>;
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/** Parse the scheduler-provided minute. Returns epoch ms or an error message. */
export function parseScheduledAt(body: unknown, now: number): number | string {
  const raw = (body as { scheduledAt?: unknown } | null)?.scheduledAt;
  const ms = typeof raw === "number" ? raw : typeof raw === "string" ? Date.parse(raw) : Number.NaN;
  if (!Number.isFinite(ms)) return "scheduledAt must be an ISO timestamp or epoch ms";
  if (ms % 60_000 !== 0) return "scheduledAt must be an exact UTC minute";
  if (ms > now + MAX_FUTURE_SKEW_MS) return "scheduledAt is in the future";
  return ms;
}

function statusFor(result: RoundReport["result"]): number {
  if (result === "FAILED") return 500;
  if (result === "LOST_CLAIM") return 409;
  return 200;
}

export async function handleRecorderRequest(
  req: Request,
  deps: RecorderHandlerDeps,
): Promise<Response> {
  const log = deps.log ?? (() => {});
  const note = async (result: string) => {
    try {
      await deps.noteInvocation?.(result, deps.now());
    } catch {
      log({ evt: "recorder.counter_failed", result });
    }
  };

  if (req.method !== "POST") return jsonResponse(405, { error: "method not allowed" });
  if (!secretMatches(req.headers.get(RECORDER_SECRET_HEADER), deps.secret)) {
    log({ evt: "recorder.unauthorized" });
    return jsonResponse(401, { error: "unauthorized" });
  }
  if (!deps.store) {
    log({ evt: "recorder.misconfigured" });
    return jsonResponse(503, { error: "recorder not configured" });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const started = deps.now();
  const scheduledAt = parseScheduledAt(body, started);
  if (typeof scheduledAt === "string") {
    log({ evt: "recorder.bad_request", error: scheduledAt });
    await note("BAD_REQUEST");
    return jsonResponse(400, { error: scheduledAt });
  }

  const owner = deps.newOwner();
  try {
    const r = await runRound(scheduledAt, {
      store: deps.store,
      http: deps.http,
      now: deps.now,
      owner,
      sleep: deps.sleep,
    });
    const out = {
      key: r.key,
      result: r.result,
      dataStatus: r.dataStatus,
      opened: r.opened,
      closed: r.closed,
      outcomesObserved: r.outcomesObserved,
      outcomesUnavailable: r.outcomesUnavailable,
      gaps: r.gaps,
      requests: r.requests,
      invocationDelayMs: started - scheduledAt,
      durationMs: deps.now() - started,
    };
    log({ evt: "recorder.round", owner, ...out });
    await note(r.result);
    return jsonResponse(statusFor(r.result), out);
  } catch (err) {
    // The store itself failed (e.g. database unavailable): nothing was committed.
    log({
      evt: "recorder.error",
      key: roundKey(scheduledAt),
      owner,
      error: err instanceof Error ? err.message : String(err),
    });
    await note("ERROR");
    return jsonResponse(500, { key: roundKey(scheduledAt), result: "ERROR" });
  }
}

export type HealthHandlerDeps = {
  secret: string | undefined;
  /** Reads ops.recorder_health_at(now()); null when misconfigured. */
  readHealth: (() => Promise<unknown>) | null;
  log?: (entry: LogEntry) => void;
};

/** Compact health: 200 when OK, 503 when STALE / FAILING / unreadable. */
export async function handleHealthRequest(
  req: Request,
  deps: HealthHandlerDeps,
): Promise<Response> {
  const log = deps.log ?? (() => {});
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse(405, { error: "method not allowed" });
  }
  if (!secretMatches(req.headers.get(HEALTH_SECRET_HEADER), deps.secret)) {
    log({ evt: "health.unauthorized" });
    return jsonResponse(401, { error: "unauthorized" });
  }
  if (!deps.readHealth) return jsonResponse(503, { status: "UNKNOWN", error: "not configured" });
  try {
    const health = (await deps.readHealth()) as { status?: string } | null;
    const status = health?.status ?? "UNKNOWN";
    return jsonResponse(status === "OK" ? 200 : 503, health ?? { status });
  } catch (err) {
    log({ evt: "health.error", error: err instanceof Error ? err.message : String(err) });
    return jsonResponse(503, { status: "UNKNOWN", error: "health query failed" });
  }
}
