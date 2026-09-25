import { describe, expect, it } from "vitest";
import {
  COOLDOWN_MAX_MS,
  ENDPOINT_CAP_PER_ROUND,
  MAX_ADDRESSES_PER_REQUEST,
} from "@/lib/history/constants";
import { planDue, planPairFallback, resolveWithPairs, outcomeKey } from "@/lib/history/duePlanner";
import { MemoryRecorderStore } from "@/lib/history/memoryStore";
import type {
  EpisodeState,
  OutcomeObservation,
  RoundRecord,
  SignalEvent,
} from "@/lib/history/model";
import { scheduleOutcomes } from "@/lib/history/outcomes";
import { RequestLedger, endpointOf, nextCooldownMs, parseRetryAfter } from "@/lib/history/requests";
import { roundKey } from "@/lib/history/ids";
import type { DexPair } from "@/lib/providers/schemas";
import { snapshot } from "../signals/fixtures";
import { HONSE, HONSE_KEY, HONSE_PAIR, MIN, T0, noSleep } from "./helpers";

function ev(
  i: number,
  chainId = "solana",
  address = `Tok${i}x`.padEnd(44, "1"),
  pair = `Pair${i}x`.padEnd(44, "1"),
): SignalEvent {
  return {
    id: `evt_${i}`,
    assetKey: `${chainId}:${address}`,
    chainId,
    address,
    pairAddress: pair,
    symbol: null,
    type: "EARLY_MOMENTUM",
    severity: null,
    rulesVersion: "rv",
    openedRound: roundKey(T0),
    openedAt: T0,
    evidence: { type: "EARLY_MOMENTUM", rule: {} as never },
    openSnapshot: {} as never,
  };
}
const due15 = (e: SignalEvent) => scheduleOutcomes(e).find((o) => o.horizonMinutes === 15)!;

describe("due outcome planner", () => {
  const now = T0 + 15 * MIN + 5_000;

  it("token that LEFT the universe is still planned (targeted batch, not dropped)", () => {
    const e = ev(1, "solana", HONSE, HONSE_PAIR);
    const plan = planDue({
      now,
      pending: [due15(e)],
      events: new Map([[e.id, e]]),
      roundSnapshots: [],
      roundKey: null,
    });
    expect(plan.tokenBatches).toEqual([
      {
        chainId: "solana",
        tokenAddresses: [HONSE],
        wants: [{ eventId: e.id, horizonMinutes: 15, pairAddress: HONSE_PAIR }],
      },
    ]);
    expect(plan.fromRound).toEqual([]);
  });

  it("the event's exact pair in THIS round is reused with no request", () => {
    const e = ev(1, "solana", HONSE, HONSE_PAIR);
    const s = snapshot({
      key: HONSE_KEY,
      chainId: "solana",
      pairAddress: HONSE_PAIR,
      observedAt: now,
    });
    const plan = planDue({
      now,
      pending: [due15(e)],
      events: new Map([[e.id, e]]),
      roundSnapshots: [s],
      roundKey: "k",
    });
    expect(plan.tokenBatches).toEqual([]);
    expect(plan.fromRound[0]).toMatchObject({
      availability: "OBSERVED",
      source: "ROUND",
      roundKey: "k",
      delaySeconds: 5,
    });
  });

  it("a different pool of the token in this round is NOT reused", () => {
    const e = ev(1, "solana", HONSE, HONSE_PAIR);
    const s = snapshot({
      key: HONSE_KEY,
      chainId: "solana",
      pairAddress: "OtherPool".padEnd(44, "1"),
      observedAt: now,
    });
    const plan = planDue({
      now,
      pending: [due15(e)],
      events: new Map([[e.id, e]]),
      roundSnapshots: [s],
      roundKey: "k",
    });
    expect(plan.fromRound).toEqual([]);
    expect(plan.tokenBatches).toHaveLength(1);
  });

  it(`batches ≤ ${MAX_ADDRESSES_PER_REQUEST} addresses per chain, deterministic order, deduped across events and horizons`, () => {
    const events = Array.from({ length: 65 }, (_, i) => ev(i, i % 5 === 0 ? "base" : "solana"));
    const dupe = { ...ev(999, "solana", events[1].address, events[1].pairAddress) };
    const all = [...events, dupe];
    const pending = all.map(due15);
    const plan = planDue({
      now,
      pending,
      events: new Map(all.map((e) => [e.id, e])),
      roundSnapshots: [],
      roundKey: null,
      maxTokenBatches: 99,
    });
    for (const b of plan.tokenBatches)
      expect(b.tokenAddresses.length).toBeLessThanOrEqual(MAX_ADDRESSES_PER_REQUEST);
    expect(plan.tokenBatches.map((b) => [b.chainId, b.tokenAddresses.length])).toEqual([
      ["base", 13],
      ["solana", 30],
      ["solana", 22],
    ]);
    const addrs = plan.tokenBatches.flatMap((b) => b.tokenAddresses);
    expect(new Set(addrs).size).toBe(addrs.length); // one slot per token
    expect(plan.tokenBatches.flatMap((b) => b.wants)).toHaveLength(66); // both events kept
    const again = planDue({
      now,
      pending: [...pending].reverse(),
      events: new Map(all.map((e) => [e.id, e])),
      roundSnapshots: [],
      roundKey: null,
      maxTokenBatches: 99,
    });
    expect(again.tokenBatches).toEqual(plan.tokenBatches);
  });

  it("beyond the per-round cap, wants are deferred (retried next round inside the window)", () => {
    const events = Array.from({ length: 200 }, (_, i) => ev(i));
    const plan = planDue({
      now,
      pending: events.map(due15),
      events: new Map(events.map((e) => [e.id, e])),
      roundSnapshots: [],
      roundKey: null,
    });
    expect(plan.tokenBatches).toHaveLength(ENDPOINT_CAP_PER_ROUND.DUE_TOKEN_BATCH);
    expect(plan.deferred).toHaveLength(200 - 4 * 30);
  });

  it("not yet due and expired are separated", () => {
    const e = ev(1);
    const outs = scheduleOutcomes(e);
    const plan = planDue({
      now: T0 + 7 * MIN + 1,
      pending: outs,
      events: new Map([[e.id, e]]),
      roundSnapshots: [],
      roundKey: null,
    });
    expect(plan.expired.map((o) => [o.horizonMinutes, o.unavailableReason])).toEqual([
      [5, "WINDOW_ELAPSED"],
    ]);
    expect(plan.notYetDue).toBe(4);
  });

  it("exact pairAddress selection among several pools; missing pair → fallback plan", () => {
    const e = ev(1, "solana", HONSE, HONSE_PAIR);
    const o = due15(e);
    const pending = new Map([[outcomeKey(e.id, 15), o]]);
    const events = new Map([[e.id, e]]);
    const pool = (addr: string, liq: number) =>
      ({
        chainId: "solana",
        pairAddress: addr,
        baseToken: { address: HONSE, symbol: "honse" },
        priceUsd: "0.00006",
        liquidity: { usd: liq },
      }) as unknown as DexPair;
    const want = [{ eventId: e.id, horizonMinutes: 15, pairAddress: HONSE_PAIR }];
    const hit = resolveWithPairs(
      want,
      "solana",
      [pool("BiggerPool".padEnd(44, "1"), 9e6), pool(HONSE_PAIR, 26_000)],
      now,
      pending,
      events,
      "DUE_TOKEN_BATCH",
    );
    expect(hit.observed[0].market?.liquidityUsd).toBe(26_000); // the captured pool, not the biggest one
    const miss = resolveWithPairs(
      want,
      "solana",
      [pool("BiggerPool".padEnd(44, "1"), 9e6)],
      now,
      pending,
      events,
      "DUE_TOKEN_BATCH",
    );
    expect(miss.missing).toEqual(want);
    const fb = planPairFallback(miss.missing, () => "solana");
    expect(fb.batches).toEqual([{ chainId: "solana", pairAddresses: [HONSE_PAIR], wants: want }]);
  });
});

/* ------------------------------------------------------------------ */

describe("request ledger — per-endpoint budget, 429, Retry-After", () => {
  it("Retry-After: seconds, HTTP-date, invalid", () => {
    expect(parseRetryAfter("30", T0)).toBe(30_000);
    expect(parseRetryAfter(new Date(T0 + 90_000).toUTCString(), T0)).toBe(90_000);
    expect(parseRetryAfter("soon", T0)).toBeNull();
    expect(parseRetryAfter(null, T0)).toBeNull();
  });

  it("cooldown: Retry-After honoured; otherwise 1, 2, 4, 8 min … bounded at 15 min", () => {
    expect(nextCooldownMs(1, 45_000)).toBe(45_000);
    expect([1, 2, 3, 4, 5, 9].map((n) => nextCooldownMs(n, null) / MIN)).toEqual([
      1, 2, 4, 8, 15, 15,
    ]);
    expect(nextCooldownMs(99, null)).toBe(COOLDOWN_MAX_MS);
  });

  it("endpoint attribution", () => {
    const b = "https://api.dexscreener.com";
    expect(endpointOf(`${b}/token-boosts/latest/v1`, "ENRICHMENT")).toBe("BOOST_LATEST");
    expect(endpointOf(`${b}/token-boosts/top/v1`, "ENRICHMENT")).toBe("BOOST_TOP");
    expect(endpointOf(`${b}/ads/latest/v1`, "ENRICHMENT")).toBe("ADS");
    expect(endpointOf(`${b}/latest/dex/pairs/solana/x`, "ENRICHMENT")).toBe("CANONICAL_PAIR");
    expect(endpointOf(`${b}/tokens/v1/solana/x`, "ENRICHMENT")).toBe("TOKEN_ENRICHMENT");
    expect(endpointOf(`${b}/tokens/v1/solana/x`, "DUE")).toBe("DUE_TOKEN_BATCH");
    expect(endpointOf(`${b}/latest/dex/pairs/solana/x,y`, "DUE")).toBe("PAIR_FALLBACK");
  });

  it("429 is never retried in-round, sets a cooldown, and the endpoint is then skipped", async () => {
    let calls = 0;
    const ledger = new RequestLedger(
      async () => {
        calls++;
        return { status: 429, retryAfter: "120", body: null };
      },
      () => T0,
      [],
      noSleep,
    );
    await expect(
      ledger.fetchJson("dexscreener", "https://api.dexscreener.com/ads/latest/v1"),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(calls).toBe(1);
    expect(ledger.cooldownUpdates()).toEqual([
      { endpoint: "ADS", until: T0 + 120_000, consecutive429: 1 },
    ]);
    // A later round inside the cooldown does not even call.
    const next = new RequestLedger(
      async () => {
        calls++;
        return { status: 200, retryAfter: null, body: [] };
      },
      () => T0 + 60_000,
      ledger.cooldownUpdates(),
      noSleep,
    );
    await expect(
      next.fetchJson("dexscreener", "https://api.dexscreener.com/ads/latest/v1"),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(calls).toBe(1);
    expect(next.accounting.ADS.skipped).toBe(1);
  });

  it("transient 5xx / network errors: one retry each from a shared round budget of 4", async () => {
    let calls = 0;
    const ledger = new RequestLedger(
      async () => {
        calls++;
        return { status: 503, retryAfter: null, body: null };
      },
      () => T0,
      [],
      noSleep,
    );
    const url = (i: number) => `https://api.dexscreener.com/latest/dex/pairs/c${i}/p`;
    for (let i = 0; i < 4; i++) await expect(ledger.fetchJson("d", url(i))).rejects.toBeTruthy();
    expect(calls).toBe(8); // 4 requests × (1 + 1 retry) — the retry budget is now spent
    expect(ledger.accounting.CANONICAL_PAIR.attempts).toBe(8);
    await expect(ledger.fetchJson("d", url(5))).rejects.toMatchObject({ code: "RATE_LIMITED" }); // cap 4 reached
    expect(calls).toBe(8);
  });

  it("hard per-endpoint cap per round", async () => {
    const ledger = new RequestLedger(
      async () => ({ status: 200, retryAfter: null, body: [] }),
      () => T0,
      [],
      noSleep,
    );
    await ledger.fetchJson("d", "https://api.dexscreener.com/token-boosts/latest/v1");
    await expect(
      ledger.fetchJson("d", "https://api.dexscreener.com/token-boosts/latest/v1"),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(ledger.accounting.BOOST_LATEST).toMatchObject({ attempts: 1, ok: 1, skipped: 1 });
  });
});

/* ------------------------------------------------------------------ */

describe("store invariants (the same the SQL enforces)", () => {
  const claimed = (owner = "A", attempt = 1): RoundRecord => ({
    key: roundKey(T0),
    scheduledAt: T0,
    state: "CLAIMED",
    attempt,
    owner,
    leaseUntil: T0 + 50_000,
    dataStatus: null,
    rulesVersion: null,
    universeSize: null,
    issues: [],
    requests: null,
    finishedAt: null,
  });
  const ep = (id: string): EpisodeState => ({
    eventId: id,
    assetKey: HONSE_KEY,
    type: "EARLY_MOMENTUM",
    rulesVersion: "rv",
    status: "OPEN",
    closeReason: null,
    closedAt: null,
    lastFiredAt: T0,
    lastValidAt: T0,
    lastEvaluatedAt: T0,
    negativeStreakCount: 0,
    negativeStreakStartedAt: null,
    lastValidNegativeAt: null,
    roundsFired: 1,
    peakVaRatio: null,
    peakAbsLiquidityDeltaUsd: null,
  });
  const commit = (over: Partial<import("@/lib/history/ports").RoundCommit> = {}) => ({
    round: { ...claimed(), state: "COMPLETED" as const },
    owner: "A",
    attempt: 1,
    gaps: [],
    engine: { put: null, pruneBefore: 0 },
    events: [],
    episodes: [],
    outcomeInserts: [],
    outcomeUpdates: [],
    cooldowns: [],
    pruneRoundLogBefore: 0,
    ...over,
  });

  it("only the current owner/attempt can commit", async () => {
    const s = new MemoryRecorderStore();
    await s.tryClaim(claimed("A", 1), null);
    expect(await s.commit(commit({ owner: "B" }))).toEqual({ ok: false, reason: "NOT_OWNER" });
    expect(await s.commit(commit())).toEqual({ ok: true });
    expect(await s.commit(commit())).toEqual({ ok: false, reason: "NOT_OWNER" }); // already completed
  });

  it("two open episodes for the same asset+type are refused, atomically", async () => {
    const s = new MemoryRecorderStore();
    await s.tryClaim(claimed(), null);
    const r = await s.commit(
      commit({
        episodes: [
          { episode: ep("evt_a"), expectedLastEvaluatedAt: null },
          { episode: ep("evt_b"), expectedLastEvaluatedAt: null },
        ],
        outcomeInserts: [{ eventId: "evt_a", horizonMinutes: 5 } as OutcomeObservation],
      }),
    );
    expect(r).toEqual({ ok: false, reason: "DUPLICATE_OPEN_EPISODE" });
    expect(s.episodes.size + s.outcomes.size).toBe(0); // nothing applied
  });

  it("eventId+horizon is unique; outcome updates apply only from PENDING", async () => {
    const s = new MemoryRecorderStore();
    const e = ev(1);
    const outs = scheduleOutcomes(e);
    await s.tryClaim(claimed(), null);
    await s.commit(commit({ outcomeInserts: [...outs, ...outs] }));
    expect(s.outcomes.size).toBe(5);
    const observed = { ...outs[0], availability: "OBSERVED" as const, observedAt: T0 + 5 * MIN };
    const late = { ...outs[0], availability: "UNAVAILABLE" as const };
    await s.tryClaim({ ...claimed(), key: roundKey(T0 + MIN), scheduledAt: T0 + MIN }, null);
    await s.commit(
      commit({
        round: { ...claimed(), key: roundKey(T0 + MIN), scheduledAt: T0 + MIN, state: "COMPLETED" },
        outcomeUpdates: [observed, late],
      }),
    );
    expect(s.outcomes.get(outcomeKey(e.id, 5))?.availability).toBe("OBSERVED");
  });
});
