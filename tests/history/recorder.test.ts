import { describe, expect, it } from "vitest";
import {
  ENGINE_RETENTION_MS,
  ROUND_LEASE_MS,
  ROUND_REQUEST_CEILING,
  TRACKING_LOST_MS,
} from "@/lib/history/constants";
import { outcomeKey } from "@/lib/history/duePlanner";
import { roundKey } from "@/lib/history/ids";
import type { MemoryRecorderStore } from "@/lib/history/memoryStore";
import { runRound } from "@/lib/history/recorder";
import { HONSE, HONSE_KEY, HONSE_PAIR, MIN, T0, harness } from "./helpers";

/**
 * Full recorder rounds through the EXISTING engine (fetchRealtimePairs →
 * fetchPairUniverse → radar) over recorded DexScreener fixtures, against the
 * in-memory store that enforces the same invariants as the planned schema.
 */

const momentum = (store: MemoryRecorderStore) =>
  [...store.episodes.values()].filter(
    (e) => e.assetKey === HONSE_KEY && e.type === "EARLY_MOMENTUM",
  );

describe("recorder — episode lifecycle on real engine output", () => {
  it("FIRED opens one EARLY_MOMENTUM episode with compact evidence and 5 outcomes; per-endpoint accounting", async () => {
    const h = harness({ honse: "signal" });
    const r = await h.at(0);
    expect(r.result).toBe("COMPLETED");
    expect(r.dataStatus).toBe("live");
    const [ep] = momentum(h.store);
    expect(ep).toMatchObject({ status: "OPEN", roundsFired: 1 });
    const event = h.store.eventsById.get(ep.eventId)!;
    expect(event).toMatchObject({
      assetKey: HONSE_KEY,
      chainId: "solana",
      address: HONSE,
      pairAddress: HONSE_PAIR,
      type: "EARLY_MOMENTUM",
      openedRound: "2026-09-26T00:00Z",
    });
    // Evidence = the engine's own rule object; snapshot = selected real fields only.
    expect(event.evidence.type).toBe("EARLY_MOMENTUM");
    expect(event.evidence.rule).toMatchObject({ key: HONSE_KEY, label: "EARLY MOMENTUM" });
    expect(Object.keys(event.openSnapshot)).not.toContain("url");
    expect(event.openSnapshot).toMatchObject({ pairAddress: HONSE_PAIR, liquidityUsd: 25532.33 });
    expect(
      [...h.store.outcomes.values()]
        .filter((o) => o.eventId === event.id)
        .map((o) => o.horizonMinutes),
    ).toEqual([5, 15, 60, 240, 1440]);
    expect(r.accounting).toMatchObject({
      BOOST_LATEST: { attempts: 1, ok: 1 },
      BOOST_TOP: { attempts: 1, ok: 1 },
      ADS: { attempts: 1, ok: 1 },
      CANONICAL_PAIR: { attempts: 4, ok: 4 },
      TOKEN_ENRICHMENT: { ok: 2 },
      DUE_TOKEN_BATCH: { attempts: 0 },
      PAIR_FALLBACK: { attempts: 0 },
    });
    expect(r.requests).toBeLessThanOrEqual(ROUND_REQUEST_CEILING);
  });

  it("repeated FIRED does not duplicate; five valid negatives close as SIGNAL_EXIT; re-entry opens a new episode", async () => {
    const h = harness({ honse: "signal" });
    for (let m = 0; m < 3; m++) await h.at(m);
    expect(momentum(h.store)).toHaveLength(1);
    expect(momentum(h.store)[0].roundsFired).toBe(3);

    h.set({ honse: "negative" }); // recorded fixture: 20 buys : 20 sells → evaluable, does not fire
    for (let m = 3; m < 7; m++) await h.at(m);
    expect(momentum(h.store)[0]).toMatchObject({ status: "OPEN", negativeStreakCount: 4 });
    await h.at(7);
    expect(momentum(h.store)[0]).toMatchObject({
      status: "CLOSED",
      closeReason: "SIGNAL_EXIT",
      closedAt: T0 + 7 * MIN + 2_000, // real time of the fifth negative observation
    });

    h.set({ honse: "signal" });
    await h.at(8);
    const eps = momentum(h.store);
    expect(eps).toHaveLength(2);
    expect(eps.filter((e) => e.status === "OPEN")).toHaveLength(1);
  });

  it("NO_DATA (thin m5 sample) never counts as negative; an hour of it is TRACKING_LOST, not an exit", async () => {
    const h = harness({ honse: "signal" });
    await h.at(0);
    h.set({ honse: "lowsample" }); // buy-pressure sample below the engine's minimum → not evaluable
    // Last valid observation 00:00:02 → the round at 01:00 is 59 min 58 s later: still open.
    for (let m = 1; m <= 60; m++) await h.at(m);
    expect(momentum(h.store)[0]).toMatchObject({ status: "OPEN", negativeStreakCount: 0 });
    await h.at(61);
    expect(momentum(h.store)[0]).toMatchObject({
      status: "CLOSED",
      closeReason: "TRACKING_LOST",
      closedAt: T0 + 2_000 + TRACKING_LOST_MS,
    });
  });

  it("a full provider outage: rounds recorded offline, no transitions, no negatives", async () => {
    const h = harness({ honse: "signal" });
    await h.at(0);
    h.set({ override: () => ({ status: 503, retryAfter: null, body: null }) });
    const r = await h.at(1);
    expect(r).toMatchObject({ result: "COMPLETED", dataStatus: "offline", opened: 0 });
    expect(momentum(h.store)[0]).toMatchObject({
      status: "OPEN",
      negativeStreakCount: 0,
      lastValidAt: T0 + 2_000,
    });
    expect(h.store.engine.has(roundKey(T0 + MIN))).toBe(false); // nothing observed, nothing stored
    expect(r.requests).toBeLessThanOrEqual(ROUND_REQUEST_CEILING);
  });

  it("recorder down > 60 min, then FIRED: old episode TRACKING_LOST (not SIGNAL_EXIT), NEW episode with a distinct id, GAP rows stay GAP", async () => {
    const h = harness({ honse: "signal" });
    await h.at(0);
    const [first] = momentum(h.store);
    const r = await h.at(61); // minutes 1–60 never ran
    expect(r).toMatchObject({ result: "COMPLETED", opened: 1, gaps: 60 });
    expect(r.closed).toEqual({ SIGNAL_EXIT: 0, TRACKING_LOST: 1, RULES_CHANGED: 0 });
    const eps = momentum(h.store);
    expect(eps).toHaveLength(2);
    const old = h.store.episodes.get(first.eventId)!;
    expect(old).toMatchObject({
      status: "CLOSED",
      closeReason: "TRACKING_LOST",
      closedAt: T0 + 2_000 + TRACKING_LOST_MS,
      lastValidAt: T0 + 2_000, // the minute-61 observation was NOT attached
      roundsFired: 1,
    });
    const fresh = eps.find((e) => e.eventId !== first.eventId)!;
    expect(fresh).toMatchObject({ status: "OPEN", lastValidAt: T0 + 61 * MIN + 2_000 });
    expect(h.store.eventsById.get(fresh.eventId)).toMatchObject({
      openedRound: "2026-09-26T01:01Z",
      openedAt: T0 + 61 * MIN + 2_000,
    });
    await h.at(62);
    for (let m = 1; m <= 60; m++) {
      expect(h.store.rounds.get(roundKey(T0 + m * MIN))).toMatchObject({
        state: "GAP",
        dataStatus: null,
        requests: null,
      });
    }
  });

  it("recorder down > 60 min, then VALID_NEGATIVE: old episode TRACKING_LOST, nothing replaces it", async () => {
    const h = harness({ honse: "signal" });
    await h.at(0);
    h.set({ honse: "negative" });
    const r = await h.at(61);
    expect(r.opened).toBe(0);
    expect(r.closed.TRACKING_LOST).toBe(1);
    const eps = momentum(h.store);
    expect(eps).toHaveLength(1);
    expect(eps[0]).toMatchObject({
      closeReason: "TRACKING_LOST",
      closedAt: T0 + 2_000 + TRACKING_LOST_MS,
      negativeStreakCount: 0,
    });
  });

  it("exact boundary on the recorder clock: valid observation exactly 60 min after lastValidAt is lost; 1 ms earlier it attaches", async () => {
    const lost = harness({ honse: "signal" });
    await lost.at(0, 0); // lastValidAt = 00:00:00.000
    await lost.at(60, 0); // observed 01:00:00.000 = lastValidAt + 60 min
    expect(momentum(lost.store).map((e) => e.closeReason)).toEqual(["TRACKING_LOST", null]);

    const kept = harness({ honse: "signal" });
    await kept.at(0, 1); // lastValidAt = 00:00:00.001
    await kept.at(60, 0); // 59 min 59.999 s later
    expect(momentum(kept.store)).toHaveLength(1);
    expect(momentum(kept.store)[0]).toMatchObject({ status: "OPEN", roundsFired: 2 });
  });

  it("liquidity drain on the recorded pool fires LIQUIDITY_REMOVED from the engine's own rule", async () => {
    const h = harness({ honse: "negative" });
    for (let m = 0; m <= 5; m++) await h.at(m);
    h.set({ honse: "negative", honseLiquidity: 12_000 }); // 25,532 → 12,000
    await h.at(6);
    const liq = [...h.store.episodes.values()].filter((e) => e.type === "LIQUIDITY_REMOVED");
    expect(liq).toHaveLength(1);
    const ev = h.store.eventsById.get(liq[0].eventId)!;
    expect(ev.severity).toBe("MEDIUM");
    expect(ev.evidence).toMatchObject({
      type: "LIQUIDITY_REMOVED",
      rule: { direction: "REMOVED" },
    });
  });
});

describe("recorder — idempotency, leases, gaps", () => {
  it("the same scheduled minute twice is harmless", async () => {
    const h = harness({ honse: "signal" });
    await h.at(0);
    const snapshot = JSON.stringify([
      ...h.store.eventsById.keys(),
      h.store.outcomes.size,
      [...h.store.episodes.values()],
    ]);
    const commits = h.store.commits;
    const again = await runRound(T0, h.deps());
    expect(again.result).toBe("SKIPPED");
    expect(h.store.commits).toBe(commits);
    expect(
      JSON.stringify([
        ...h.store.eventsById.keys(),
        h.store.outcomes.size,
        [...h.store.episodes.values()],
      ]),
    ).toBe(snapshot);
  });

  it("a crashed worker's claim blocks only until its lease expires; the stale worker can never commit", async () => {
    const h = harness({ honse: "signal" });
    // Worker "crashed" claims minute 0 and never commits.
    await h.store.tryClaim(
      {
        key: roundKey(T0),
        scheduledAt: T0,
        state: "CLAIMED",
        attempt: 1,
        owner: "crashed",
        leaseUntil: T0 + ROUND_LEASE_MS,
        dataStatus: null,
        rulesVersion: null,
        universeSize: null,
        issues: [],
        requests: null,
        finishedAt: null,
      },
      null,
    );
    h.clock.set(T0 + 10_000);
    expect((await runRound(T0, h.deps())).result).toBe("SKIPPED"); // lease active
    h.clock.set(T0 + ROUND_LEASE_MS + 1);
    const r = await runRound(T0, h.deps());
    expect(r.result).toBe("COMPLETED");
    expect(h.store.rounds.get(roundKey(T0))).toMatchObject({ state: "COMPLETED", attempt: 2 });
    const late = await h.store.commit({
      round: { ...h.store.rounds.get(roundKey(T0))!, owner: "crashed" },
      owner: "crashed",
      attempt: 1,
      gaps: [],
      engine: { put: null, pruneBefore: 0 },
      events: [],
      episodes: [],
      outcomeInserts: [],
      outcomeUpdates: [],
      cooldowns: [],
      pruneRoundLogBefore: 0,
    });
    expect(late).toEqual({ ok: false, reason: "NOT_OWNER" });
  });

  it("missed scheduled minutes are recorded as GAP rows with no values, never backfilled", async () => {
    const h = harness({ honse: "negative" });
    await h.at(0);
    const r = await h.at(4);
    expect(r.gaps).toBe(3);
    for (const m of [1, 2, 3]) {
      expect(h.store.rounds.get(roundKey(T0 + m * MIN))).toMatchObject({
        state: "GAP",
        dataStatus: null,
        requests: null,
      });
      expect(h.store.engine.has(roundKey(T0 + m * MIN))).toBe(false);
    }
  });

  it("an older minute arriving after a newer one finished is SUPERSEDED and writes nothing", async () => {
    const h = harness({ honse: "signal" });
    await h.at(5);
    h.clock.set(T0 + 6 * MIN);
    expect((await runRound(T0 + 2 * MIN, h.deps())).result).toBe("SUPERSEDED");
  });
});

describe("recorder — outcomes", () => {
  it("+5m is observed from the round itself (exact pair, real time, no extra request)", async () => {
    const h = harness({ honse: "signal" });
    for (let m = 0; m <= 5; m++) await h.at(m);
    const ev = [...h.store.eventsById.values()][0];
    const o = h.store.outcomes.get(outcomeKey(ev.id, 5))!;
    expect(o).toMatchObject({
      availability: "OBSERVED",
      source: "ROUND",
      pairAddress: HONSE_PAIR,
      observedAt: T0 + 5 * MIN + 2_000,
      delaySeconds: 0, // target = openedAt (00:00:02) + 5 min
    });
  });

  it("delayed round: scheduled 00:00:00, observed 00:00:40 → +5m target 00:05:40; an earlier sample never counts", async () => {
    const h = harness({ honse: "signal" });
    await h.at(0, 40_000);
    const ev = [...h.store.eventsById.values()][0];
    expect([ev.openedRound, ev.openedAt]).toEqual(["2026-09-26T00:00Z", T0 + 40_000]);
    expect(momentum(h.store)[0]).toMatchObject({
      lastFiredAt: T0 + 40_000,
      lastValidAt: T0 + 40_000,
      lastEvaluatedAt: T0,
    });
    const o5 = () => h.store.outcomes.get(outcomeKey(ev.id, 5))!;
    expect([o5().targetAt, o5().windowEndAt]).toEqual([
      T0 + 5 * MIN + 40_000,
      T0 + 7 * MIN + 40_000,
    ]);
    for (let m = 1; m <= 5; m++) await h.at(m);
    // Round 5 sampled the exact pair at 00:05:02 — before the 00:05:40 target.
    expect(o5()).toMatchObject({ availability: "PENDING", observedAt: null });
    expect(h.log.some((u) => u.includes(`/tokens/v1/solana/${HONSE}`))).toBe(false); // not due yet
    await h.at(6);
    expect(o5()).toMatchObject({
      availability: "OBSERVED",
      source: "ROUND",
      observedAt: T0 + 6 * MIN + 2_000,
      delaySeconds: 22,
    });
  });

  it("token LEAVES the universe: its outcome is still captured through the due token batch", async () => {
    const h = harness({ honse: "signal" });
    await h.at(0);
    h.set({ honse: "negative", honseGone: true });
    for (let m = 1; m <= 15; m++) await h.at(m);
    const ev = [...h.store.eventsById.values()][0];
    const o15 = h.store.outcomes.get(outcomeKey(ev.id, 15))!;
    expect(o15).toMatchObject({
      availability: "OBSERVED",
      source: "DUE_TOKEN_BATCH",
      pairAddress: HONSE_PAIR,
    });
    expect(h.log.some((u) => u.includes(`/tokens/v1/solana/${HONSE}`) && !u.includes(","))).toBe(
      true,
    );
  });

  it("original pair missing from the token batch → pair-address fallback", async () => {
    const h = harness({ honse: "signal" });
    await h.at(0);
    h.set({ honse: "negative", honseGone: true, tokenBatchOmitsPair: true });
    for (let m = 1; m <= 5; m++) await h.at(m);
    const ev = [...h.store.eventsById.values()][0];
    expect(h.store.outcomes.get(outcomeKey(ev.id, 5))).toMatchObject({
      availability: "OBSERVED",
      source: "PAIR_FALLBACK",
      pairAddress: HONSE_PAIR,
    });
    expect(h.log.some((u) => u.includes(`/latest/dex/pairs/solana/${HONSE_PAIR}`))).toBe(true);
  });

  it("original pair unobservable inside the window → UNAVAILABLE (PAIR_NOT_RETURNED), no other pool substituted", async () => {
    const h = harness({ honse: "signal" });
    await h.at(0);
    h.set({ honse: "negative", honseGone: true, tokenBatchOmitsPair: true, fallbackEmpty: true });
    for (let m = 1; m <= 8; m++) await h.at(m);
    const ev = [...h.store.eventsById.values()][0];
    expect(h.store.outcomes.get(outcomeKey(ev.id, 5))).toMatchObject({
      availability: "UNAVAILABLE",
      unavailableReason: "PAIR_NOT_RETURNED",
      observedAt: null,
      market: null,
    });
  });

  it("a 429 on the due batch: no same-round retry, cooldown persisted, outcome reason RATE_LIMITED if the window closes", async () => {
    const h = harness({ honse: "signal" });
    await h.at(0);
    let dueCalls = 0;
    h.set({
      honse: "negative",
      honseGone: true,
      override: (u) =>
        u.includes(`/tokens/v1/solana/${HONSE}`) && !u.includes(",")
          ? (dueCalls++, { status: 429, retryAfter: "600", body: null })
          : null,
    });
    for (let m = 1; m <= 8; m++) await h.at(m);
    expect(dueCalls).toBe(1); // later rounds skip the cooling endpoint
    expect(h.store.cooldownsByEndpoint.get("DUE_TOKEN_BATCH")).toMatchObject({ consecutive429: 1 });
    const ev = [...h.store.eventsById.values()][0];
    expect(h.store.outcomes.get(outcomeKey(ev.id, 5))).toMatchObject({
      availability: "UNAVAILABLE",
      unavailableReason: "RATE_LIMITED",
    });
  });
});

describe("recorder — temporary engine state retention", () => {
  it("engine state is bounded by retention over a simulated day; product data is never pruned", async () => {
    const h = harness({ honse: "negative" });
    let maxRows = 0;
    for (let m = 0; m < 1440; m += 1) {
      await h.at(m);
      maxRows = Math.max(maxRows, h.store.engine.size);
    }
    const bound = ENGINE_RETENTION_MS / MIN + 1;
    expect(maxRows).toBeLessThanOrEqual(bound);
    expect(h.store.engine.size).toBeLessThanOrEqual(bound);
    const oldest = Math.min(...[...h.store.engine.values()].map((r) => r.observedAt));
    expect(oldest).toBeGreaterThanOrEqual(T0 + 1439 * MIN - ENGINE_RETENTION_MS);
  }, 60_000);
});
