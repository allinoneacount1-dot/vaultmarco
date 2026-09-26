import { describe, expect, it } from "vitest";
import { MemoryRecorderStore } from "@/lib/history/memoryStore";
import {
  HEALTH_SECRET_HEADER,
  RECORDER_SECRET_HEADER,
  handleHealthRequest,
  handleRecorderRequest,
  parseScheduledAt,
  type LogEntry,
  type RecorderHandlerDeps,
} from "@/server/recorder/handler";
import { fetchRawHttp } from "@/server/recorder/http";
import { secretMatches } from "@/server/recorder/secret";
import { HONSE_KEY, MIN, T0, fixtureHttp, noSleep } from "../history/helpers";

const SECRET = "test-only-cron-secret-0123456789";

function setup(patch: Partial<RecorderHandlerDeps> = {}) {
  let t = T0 + 2_000;
  const logs: LogEntry[] = [];
  const counted: string[] = [];
  const store = new MemoryRecorderStore();
  let n = 0;
  const deps: RecorderHandlerDeps = {
    secret: SECRET,
    store,
    http: fixtureHttp(() => ({ honse: "signal" })),
    now: () => t,
    newOwner: () => `owner-${++n}`,
    noteInvocation: async (r) => void counted.push(r),
    log: (e) => logs.push(e),
    sleep: noSleep,
    ...patch,
  };
  const call = (
    body: unknown,
    headers: Record<string, string> = { [RECORDER_SECRET_HEADER]: SECRET },
    method = "POST",
  ) =>
    handleRecorderRequest(
      new Request("http://localhost/recorder", {
        method,
        headers: { "content-type": "application/json", ...headers },
        body: method === "GET" ? undefined : typeof body === "string" ? body : JSON.stringify(body),
      }),
      deps,
    );
  return { deps, store, logs, counted, call, setNow: (v: number) => (t = v) };
}

describe("recorder Edge Function shell", () => {
  it("rejects missing / wrong secrets and non-POST methods; the secret is never logged", async () => {
    const h = setup();
    expect((await h.call({ scheduledAt: T0 }, {})).status).toBe(401);
    expect((await h.call({ scheduledAt: T0 }, { [RECORDER_SECRET_HEADER]: "wrong" })).status).toBe(
      401,
    );
    expect((await h.call(null, { [RECORDER_SECRET_HEADER]: SECRET }, "GET")).status).toBe(405);
    expect(h.store.rounds.size).toBe(0);
    await h.call({ scheduledAt: "2026-09-26T00:00:00Z" });
    expect(JSON.stringify(h.logs)).not.toContain(SECRET);
  });

  it("an unset secret on the function rejects every call", async () => {
    const h = setup({ secret: undefined });
    expect((await h.call({ scheduledAt: T0 })).status).toBe(401);
    expect(secretMatches("", "")).toBe(false);
    expect(secretMatches(SECRET, SECRET)).toBe(true);
  });

  it("misconfigured runtime (no database) answers 503 after auth", async () => {
    const h = setup({ store: null });
    expect((await h.call({ scheduledAt: T0 })).status).toBe(503);
  });

  it("scheduledAt must be a scheduler-provided exact minute, not in the future", async () => {
    expect(parseScheduledAt({ scheduledAt: "2026-09-26T00:07:00Z" }, T0 + 8 * MIN)).toBe(
      T0 + 7 * MIN,
    );
    expect(parseScheduledAt({ scheduledAt: T0 }, T0)).toBe(T0);
    expect(parseScheduledAt({ scheduledAt: "2026-09-26T00:07:30Z" }, T0 + 8 * MIN)).toMatch(
      /exact UTC minute/,
    );
    expect(parseScheduledAt({}, T0)).toMatch(/ISO timestamp/);
    expect(parseScheduledAt({ scheduledAt: T0 + 5 * MIN }, T0)).toMatch(/future/);
    const h = setup();
    const r = await h.call("not json");
    expect(r.status).toBe(400);
    expect(h.counted).toEqual(["BAD_REQUEST"]);
    expect(h.store.rounds.size).toBe(0);
  });

  it("a DELAYED invocation runs the scheduled minute, not the function's start minute", async () => {
    const h = setup();
    h.setNow(T0 + 50_000); // pg_cron fired at 00:00, the function starts 50 s later
    const res = await h.call({ scheduledAt: "2026-09-26T00:00:00Z" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      key: "2026-09-26T00:00Z",
      result: "COMPLETED",
      invocationDelayMs: 50_000,
    });
    const ev = [...h.store.eventsById.values()][0];
    expect(ev).toMatchObject({
      assetKey: HONSE_KEY,
      openedRound: "2026-09-26T00:00Z",
      openedAt: T0 + 50_000,
    });
    expect(h.logs.find((l) => l.evt === "recorder.round")).toMatchObject({
      key: "2026-09-26T00:00Z",
      result: "COMPLETED",
    });
  });

  it("a duplicate invocation of the same minute is SKIPPED (200) and counted", async () => {
    const h = setup();
    expect((await (await h.call({ scheduledAt: T0 })).json()).result).toBe("COMPLETED");
    expect((await (await h.call({ scheduledAt: T0 })).json()).result).toBe("SKIPPED");
    expect(h.counted).toEqual(["COMPLETED", "SKIPPED"]);
  });

  it("a store failure (database unavailable) answers 500, is logged without secrets, and commits nothing", async () => {
    const broken = new MemoryRecorderStore();
    broken.newestKnownAt = async () => {
      throw new Error("connection refused");
    };
    const h = setup({ store: broken });
    const res = await h.call({ scheduledAt: T0 });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ key: "2026-09-26T00:00Z", result: "ERROR" });
    expect(broken.commits).toBe(0);
    expect(h.logs.find((l) => l.evt === "recorder.error")).toMatchObject({
      error: "connection refused",
    });
    expect(JSON.stringify(h.logs)).not.toContain(SECRET);
  });

  it("a failing operational counter never affects the round", async () => {
    const h = setup({
      noteInvocation: async () => {
        throw new Error("counter down");
      },
    });
    const res = await h.call({ scheduledAt: T0 });
    expect(res.status).toBe(200);
    expect(h.logs.some((l) => l.evt === "recorder.counter_failed")).toBe(true);
  });
});

describe("health Edge Function shell", () => {
  const call = (deps: Parameters<typeof handleHealthRequest>[1], secret: string | null = SECRET) =>
    handleHealthRequest(
      new Request("http://localhost/health", {
        headers: secret ? { [HEALTH_SECRET_HEADER]: secret } : {},
      }),
      deps,
    );

  it("requires its own secret", async () => {
    expect(
      (await call({ secret: SECRET, readHealth: async () => ({ status: "OK" }) }, null)).status,
    ).toBe(401);
    expect(
      (await call({ secret: SECRET, readHealth: async () => ({ status: "OK" }) }, "x")).status,
    ).toBe(401);
  });

  it("200 for OK; 503 for STALE / FAILING / unreadable; body carries the status", async () => {
    const ok = await call({
      secret: SECRET,
      readHealth: async () => ({ status: "OK", open_episodes: 1 }),
    });
    expect([ok.status, await ok.json()]).toEqual([200, { status: "OK", open_episodes: 1 }]);
    for (const s of ["STALE", "FAILING"]) {
      const r = await call({ secret: SECRET, readHealth: async () => ({ status: s }) });
      expect([r.status, (await r.json()).status]).toEqual([503, s]);
    }
    const broken = await call({
      secret: SECRET,
      readHealth: async () => {
        throw new Error("db down");
      },
    });
    expect([broken.status, (await broken.json()).status]).toEqual([503, "UNKNOWN"]);
    expect((await call({ secret: SECRET, readHealth: null })).status).toBe(503);
  });
});

describe("provider HTTP adapter (fetch)", () => {
  const res = (status: number, body: string, headers: Record<string, string> = {}) =>
    new Response(body, { status, headers });

  it("2xx JSON → body; non-2xx → status + Retry-After, no body; invalid JSON → throws (never guessed)", async () => {
    const http200 = fetchRawHttp(async () => res(200, '{"pairs":[1]}'));
    expect(await http200("https://api.dexscreener.com/x")).toEqual({
      status: 200,
      retryAfter: null,
      body: { pairs: [1] },
    });
    const http429 = fetchRawHttp(async () => res(429, "slow down", { "retry-after": "30" }));
    expect(await http429("https://api.dexscreener.com/x")).toEqual({
      status: 429,
      retryAfter: "30",
      body: null,
    });
    const bad = fetchRawHttp(async () => res(200, "<html>"));
    await expect(bad("https://api.dexscreener.com/x")).rejects.toThrow(/invalid JSON/);
  });

  it("a hung provider request is aborted by the timeout", async () => {
    const hang: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    await expect(fetchRawHttp(hang, 20)("https://api.dexscreener.com/x")).rejects.toThrow(
      /aborted/,
    );
  });
});
