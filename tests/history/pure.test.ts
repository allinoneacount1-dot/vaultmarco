import { describe, expect, it } from "vitest";
import {
  EXIT_NEGATIVE_STREAK,
  HISTORY_RULESET_REVISION,
  MAX_NEGATIVE_GAP_MS,
  OUTCOME_TOLERANCE_MS,
  ROUND_LEASE_MS,
  TRACKING_LOST_MS,
} from "@/lib/history/constants";
import { applyRound, stepEpisode, type FiredSignal } from "@/lib/history/episodes";
import { eventId, roundKey, rulesVersion, rulesVersionOf } from "@/lib/history/ids";
import type { EpisodeState, Observation, ObservationClass, SignalType } from "@/lib/history/model";
import {
  acceptSample,
  expireIfElapsed,
  noteFailure,
  scheduleOutcomes,
} from "@/lib/history/outcomes";
import { canCommit, decideClaim, gapKeys } from "@/lib/history/rounds";
import { sha256Hex } from "@/lib/history/sha256";
import * as thresholds from "@/lib/signals/thresholds";
import { snapshot } from "../signals/fixtures";
import { HONSE, HONSE_KEY, HONSE_PAIR, MIN, T0 } from "./helpers";

/* ------------------------------------------------------------------ */

describe("identities", () => {
  it("sha256 matches the FIPS 180-4 test vectors", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(sha256Hex("a".repeat(1000))).toBe(
      "41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3",
    );
  });

  it("round key is the scheduled UTC minute", () => {
    expect(roundKey(T0 + 7 * MIN + 59_999)).toBe("2026-09-26T00:07Z");
  });

  it("event id is deterministic and identity-exact", () => {
    const a = eventId("rv", HONSE_KEY, "EARLY_MOMENTUM", "2026-09-26T00:00Z");
    expect(eventId("rv", HONSE_KEY, "EARLY_MOMENTUM", "2026-09-26T00:00Z")).toBe(a);
    expect(
      eventId("rv", `solana:${HONSE.toLowerCase()}`, "EARLY_MOMENTUM", "2026-09-26T00:00Z"),
    ).not.toBe(a);
    expect(eventId("rv", HONSE_KEY, "LIQUIDITY_ADDED", "2026-09-26T00:00Z")).not.toBe(a);
  });

  it("rules version is stable, and changes when any threshold changes", () => {
    expect(rulesVersion()).toBe(rulesVersion());
    expect(rulesVersion()).toBe(rulesVersionOf({ ...thresholds }));
    expect(rulesVersionOf({ ...thresholds, VA_MIN: 3.1 })).not.toBe(rulesVersion());
  });

  it("rules version includes the explicit semantic revision", () => {
    const r = HISTORY_RULESET_REVISION;
    // Same revision + same thresholds → exactly the same version (and compact).
    expect(rulesVersionOf({ ...thresholds }, r)).toBe(rulesVersion());
    expect(rulesVersion()).toMatch(/^rv_[0-9a-f]{16}$/);
    // Same revision, one threshold changed → different.
    expect(rulesVersionOf({ ...thresholds, BP_MIN: 1.6 }, r)).not.toBe(rulesVersion());
    // Identical thresholds, semantic revision changed → different.
    expect(rulesVersionOf({ ...thresholds }, r + 1)).not.toBe(rulesVersion());
    // Order of the constants never matters.
    const reversed = Object.fromEntries(Object.entries(thresholds).reverse());
    expect(rulesVersionOf(reversed, r)).toBe(rulesVersion());
  });
});

/* ------------------------------------------------------------------ */

function openEp(at = T0): EpisodeState {
  return {
    eventId: "evt_x",
    assetKey: HONSE_KEY,
    type: "EARLY_MOMENTUM",
    rulesVersion: "rv",
    status: "OPEN",
    closeReason: null,
    closedAt: null,
    lastFiredAt: at,
    lastValidAt: at,
    lastEvaluatedAt: at,
    negativeStreakCount: 0,
    negativeStreakStartedAt: null,
    lastValidNegativeAt: null,
    roundsFired: 1,
    peakVaRatio: 3.2,
    peakAbsLiquidityDeltaUsd: null,
  };
}

/** An observation of class `cls` captured at real time `at` (NO_DATA has no time). */
const obs = (cls: ObservationClass, at: number): Observation =>
  cls === "NO_DATA" ? { class: "NO_DATA", observedAt: null } : { class: cls, observedAt: at };

/** Feed a sequence of (minute offset, class) into one episode; observed `lag` ms after the scheduled minute. */
function run(seq: Array<[number, ObservationClass]>, start = openEp(), lag = 0) {
  let ep = start;
  for (const [m, cls] of seq)
    ep = stepEpisode(ep, obs(cls, T0 + m * MIN + lag), T0 + m * MIN, undefined) ?? ep;
  return ep;
}

describe("episode state machine", () => {
  it("VALID_NEGATIVE increments; NO_DATA neither counts nor resets", () => {
    const ep = run([
      [1, "VALID_NEGATIVE"],
      [2, "NO_DATA"],
      [3, "VALID_NEGATIVE"],
    ]);
    expect(ep.negativeStreakCount).toBe(2);
    expect(ep.negativeStreakStartedAt).toBe(T0 + MIN);
    expect(ep.lastValidNegativeAt).toBe(T0 + 3 * MIN);
    expect(ep.status).toBe("OPEN");
  });

  it(`${EXIT_NEGATIVE_STREAK} consecutive valid negatives close as SIGNAL_EXIT`, () => {
    const ep = run([1, 2, 3, 4, 5].map((m) => [m, "VALID_NEGATIVE"] as [number, ObservationClass]));
    expect([ep.status, ep.closeReason, ep.closedAt]).toEqual([
      "CLOSED",
      "SIGNAL_EXIT",
      T0 + 5 * MIN,
    ]);
  });

  it("FIRED resets the streak", () => {
    const ep = run([
      [1, "VALID_NEGATIVE"],
      [2, "VALID_NEGATIVE"],
      [3, "FIRED"],
      [4, "VALID_NEGATIVE"],
    ]);
    expect(ep.negativeStreakCount).toBe(1);
    expect(ep.roundsFired).toBe(2);
    expect(ep.status).toBe("OPEN");
  });

  it(`a short NO_DATA gap (≤ ${MAX_NEGATIVE_GAP_MS / MIN} min between negatives) keeps the streak`, () => {
    const ep = run([
      [1, "VALID_NEGATIVE"],
      [2, "VALID_NEGATIVE"],
      [3, "VALID_NEGATIVE"],
      [4, "VALID_NEGATIVE"],
      [5, "NO_DATA"],
      [6, "NO_DATA"],
      [7, "NO_DATA"],
      [8, "NO_DATA"],
      [9, "VALID_NEGATIVE"], // exactly 5 min after minute 4
    ]);
    expect([ep.status, ep.closeReason]).toEqual(["CLOSED", "SIGNAL_EXIT"]);
  });

  it("a LONG gap cannot turn old negatives into an exit: 4 negatives → 50 min NO_DATA → 1 negative", () => {
    const seq: Array<[number, ObservationClass]> = [
      [1, "VALID_NEGATIVE"],
      [2, "VALID_NEGATIVE"],
      [3, "VALID_NEGATIVE"],
      [4, "VALID_NEGATIVE"],
    ];
    for (let m = 5; m <= 54; m++) seq.push([m, "NO_DATA"]);
    seq.push([55, "VALID_NEGATIVE"]);
    const ep = run(seq);
    expect(ep.status).toBe("OPEN"); // not an observed exit
    expect(ep.negativeStreakCount).toBe(1); // streak restarted at minute 55
    expect(ep.negativeStreakStartedAt).toBe(T0 + 55 * MIN);
  });

  it("gap one millisecond over the limit restarts the streak", () => {
    let ep = run([[1, "VALID_NEGATIVE"]]);
    const t = T0 + MIN + MAX_NEGATIVE_GAP_MS + 1;
    ep = stepEpisode(ep, obs("VALID_NEGATIVE", t), t, undefined)!;
    expect(ep.negativeStreakCount).toBe(1);
  });

  it(`no valid observation for ${TRACKING_LOST_MS / MIN} min → TRACKING_LOST (not SIGNAL_EXIT)`, () => {
    const seq: Array<[number, ObservationClass]> = [];
    for (let m = 1; m <= 60; m++) seq.push([m, "NO_DATA"]);
    const ep = run(seq);
    expect([ep.status, ep.closeReason, ep.closedAt]).toEqual([
      "CLOSED",
      "TRACKING_LOST",
      T0 + 60 * MIN,
    ]);
    const before = run(seq.slice(0, 59));
    expect(before.status).toBe("OPEN");
  });

  it("a closed episode and replayed / older rounds are no-ops", () => {
    const ep = run([[1, "VALID_NEGATIVE"]]);
    const neg = obs("VALID_NEGATIVE", T0 + MIN + 5000);
    expect(stepEpisode(ep, neg, T0 + MIN, undefined)).toBeNull(); // same round
    expect(stepEpisode(ep, obs("FIRED", T0), T0, undefined)).toBeNull(); // older
    const closed = { ...ep, status: "CLOSED" as const };
    expect(stepEpisode(closed, obs("FIRED", T0 + 9 * MIN), T0 + 9 * MIN, undefined)).toBeNull();
  });

  it("an observation not newer than lastValidAt is not new evidence (counts as NO_DATA)", () => {
    const ep = openEp(T0 + 30_000); // last valid observation at 00:00:30
    const next = stepEpisode(ep, obs("VALID_NEGATIVE", T0 + 30_000), T0 + MIN, undefined)!;
    expect([next.negativeStreakCount, next.lastValidAt, next.lastEvaluatedAt]).toEqual([
      0,
      T0 + 30_000,
      T0 + MIN,
    ]);
  });
});

describe("episode time = REAL observation time, not the scheduled minute", () => {
  const LAG = 40_000; // every round observed 40 s after its scheduled minute

  it("FIRED and VALID_NEGATIVE record observedAt; lastEvaluatedAt stays the scheduled round", () => {
    const ep = run(
      [
        [1, "VALID_NEGATIVE"],
        [2, "FIRED"],
        [3, "VALID_NEGATIVE"],
      ],
      openEp(),
      LAG,
    );
    expect(ep.lastFiredAt).toBe(T0 + 2 * MIN + LAG);
    expect(ep.lastValidAt).toBe(T0 + 3 * MIN + LAG);
    expect(ep.negativeStreakStartedAt).toBe(T0 + 3 * MIN + LAG);
    expect(ep.lastValidNegativeAt).toBe(T0 + 3 * MIN + LAG);
    expect(ep.lastEvaluatedAt).toBe(T0 + 3 * MIN);
  });

  it("SIGNAL_EXIT closes at the real time of the fifth negative", () => {
    const ep = run(
      [1, 2, 3, 4, 5].map((m) => [m, "VALID_NEGATIVE"] as [number, ObservationClass]),
      openEp(),
      LAG,
    );
    expect([ep.closeReason, ep.closedAt]).toEqual(["SIGNAL_EXIT", T0 + 5 * MIN + LAG]);
  });

  it("negative continuity is measured between REAL observation times", () => {
    // Scheduled 1 min apart, but observed 5 min + 1 ms apart → not continuous.
    let ep = openEp();
    ep = stepEpisode(ep, obs("VALID_NEGATIVE", T0 + MIN), T0 + MIN, undefined)!;
    ep = stepEpisode(
      ep,
      obs("VALID_NEGATIVE", T0 + MIN + MAX_NEGATIVE_GAP_MS + 1),
      T0 + 2 * MIN,
      undefined,
    )!;
    expect(ep.negativeStreakCount).toBe(1);
  });
});

describe("tracking loss is judged BEFORE a new observation is attached", () => {
  const LOST = TRACKING_LOST_MS;

  it("FIRED → >60 min without rounds → FIRED: TRACKING_LOST at lastValidAt + 60 min, observation not attached", () => {
    const ep = openEp(T0 + 2000);
    const next = stepEpisode(ep, obs("FIRED", T0 + 61 * MIN + 2000), T0 + 61 * MIN, undefined)!;
    expect([next.status, next.closeReason, next.closedAt]).toEqual([
      "CLOSED",
      "TRACKING_LOST",
      T0 + 2000 + LOST,
    ]);
    expect([next.lastFiredAt, next.lastValidAt, next.roundsFired]).toEqual([
      T0 + 2000,
      T0 + 2000,
      1,
    ]);
  });

  it("FIRED → >60 min without rounds → VALID_NEGATIVE: TRACKING_LOST, streak untouched", () => {
    const ep = openEp(T0);
    const next = stepEpisode(ep, obs("VALID_NEGATIVE", T0 + 61 * MIN), T0 + 61 * MIN, undefined)!;
    expect([next.closeReason, next.closedAt, next.negativeStreakCount]).toEqual([
      "TRACKING_LOST",
      T0 + LOST,
      0,
    ]);
  });

  it("exact boundary: a valid observation at lastValidAt + 60 min is lost; 1 ms earlier it attaches", () => {
    const ep = openEp(T0);
    const at = stepEpisode(ep, obs("FIRED", T0 + LOST), T0 + 60 * MIN, undefined)!;
    expect([at.closeReason, at.closedAt]).toEqual(["TRACKING_LOST", T0 + LOST]);
    const before = stepEpisode(ep, obs("FIRED", T0 + LOST - 1), T0 + 59 * MIN, undefined)!;
    expect([before.status, before.lastValidAt, before.roundsFired]).toEqual([
      "OPEN",
      T0 + LOST - 1,
      2,
    ]);
    const neg = stepEpisode(ep, obs("VALID_NEGATIVE", T0 + LOST), T0 + 60 * MIN, undefined)!;
    expect(neg.closeReason).toBe("TRACKING_LOST");
  });

  it("NO_DATA rounds close at lastValidAt + 60 min even when the loss is detected later", () => {
    const ep = openEp(T0 + 40_000);
    const early = stepEpisode(ep, obs("NO_DATA", 0), T0 + 60 * MIN, undefined)!;
    expect(early.status).toBe("OPEN"); // 59 min 20 s since the last valid observation
    const late = stepEpisode(early, obs("NO_DATA", 0), T0 + 61 * MIN, undefined)!;
    expect([late.closeReason, late.closedAt]).toEqual(["TRACKING_LOST", T0 + 40_000 + LOST]);
  });
});

describe("applyRound — open / dedupe / re-entry / rules change", () => {
  const fired = (type: SignalType = "EARLY_MOMENTUM"): FiredSignal => ({
    assetKey: HONSE_KEY,
    type,
    severity: null,
    snapshot: snapshot({
      key: HONSE_KEY,
      baseAddress: HONSE,
      pairAddress: HONSE_PAIR,
      observedAt: T0,
    }),
    evidence: { type: "EARLY_MOMENTUM", rule: {} as never },
    vaRatio: 4,
    absLiquidityDeltaUsd: null,
  });
  const round = (m: number, cls: ObservationClass, f: FiredSignal[] = [], rules = "rv") => ({
    key: roundKey(T0 + m * MIN),
    at: T0 + m * MIN,
    rulesVersion: rules,
    observe: () => obs(cls, T0 + m * MIN),
    fired: f,
  });
  const firedAt = (m: number, lag = 0): FiredSignal => {
    const f = fired();
    f.snapshot = { ...f.snapshot, observedAt: T0 + m * MIN + lag };
    return f;
  };

  it("FIRED opens exactly one episode; repeated FIRED does not duplicate", () => {
    const r1 = applyRound([], round(0, "FIRED", [fired(), fired()]));
    expect(r1.opened).toHaveLength(1);
    const ep = r1.opened[0].episode;
    const r2 = applyRound([ep], round(1, "FIRED", [fired()]));
    expect(r2.opened).toHaveLength(0);
    expect(r2.updated[0].episode.roundsFired).toBe(2);
    expect(r2.updated[0].expectedLastEvaluatedAt).toBe(T0);
    expect(r1.opened[0].event.id).toBe(eventId("rv", HONSE_KEY, "EARLY_MOMENTUM", roundKey(T0)));
  });

  it("different signal types for the same asset are separate episodes", () => {
    const r = applyRound(
      [],
      round(0, "FIRED", [fired("EARLY_MOMENTUM"), fired("LIQUIDITY_ADDED")]),
    );
    expect(r.opened.map((o) => o.episode.type).sort()).toEqual([
      "EARLY_MOMENTUM",
      "LIQUIDITY_ADDED",
    ]);
  });

  it("re-entry after a real close opens a NEW episode with a new id", () => {
    const first = applyRound([], round(0, "FIRED", [fired()])).opened[0];
    let ep = first.episode;
    for (let m = 1; m <= 5; m++)
      ep = applyRound([ep], round(m, "VALID_NEGATIVE")).updated[0].episode;
    expect(ep.closeReason).toBe("SIGNAL_EXIT");
    const again = applyRound([], round(9, "FIRED", [fired()]));
    expect(again.opened).toHaveLength(1);
    expect(again.opened[0].event.id).not.toBe(first.event.id);
  });

  it("a rules-version change closes as RULES_CHANGED (not an exit) and re-opens under the new rules", () => {
    const ep = applyRound([], round(0, "FIRED", [fired()])).opened[0].episode;
    const r = applyRound([ep], round(1, "FIRED", [fired()], "rv2"));
    expect(r.updated[0].episode.closeReason).toBe("RULES_CHANGED");
    expect(r.opened).toHaveLength(1);
    expect(r.opened[0].event.rulesVersion).toBe("rv2");
  });

  it("openedRound is the scheduled minute; openedAt and episode times are the snapshot's real observedAt", () => {
    const r = applyRound([], round(0, "FIRED", [firedAt(0, 40_000)]));
    const { event, episode } = r.opened[0];
    expect([event.openedRound, event.openedAt]).toEqual(["2026-09-26T00:00Z", T0 + 40_000]);
    expect([episode.lastFiredAt, episode.lastValidAt, episode.lastEvaluatedAt]).toEqual([
      T0 + 40_000,
      T0 + 40_000,
      T0,
    ]);
    expect(event.id).toBe(eventId("rv", HONSE_KEY, "EARLY_MOMENTUM", "2026-09-26T00:00Z"));
  });

  it("recorder downtime: TRACKING_LOST closes the old episode and the current FIRED opens a NEW one in the same round", () => {
    const first = applyRound([], round(0, "FIRED", [firedAt(0)])).opened[0];
    const r = applyRound([first.episode], round(61, "FIRED", [firedAt(61)]));
    expect(r.updated).toHaveLength(1);
    expect(r.updated[0].episode).toMatchObject({
      eventId: first.event.id,
      status: "CLOSED",
      closeReason: "TRACKING_LOST",
      closedAt: T0 + TRACKING_LOST_MS,
    });
    expect(r.opened).toHaveLength(1);
    expect(r.opened[0].event.id).not.toBe(first.event.id);
    expect(r.opened[0].event.openedRound).toBe("2026-09-26T01:01Z");
    expect(r.opened[0].episode.status).toBe("OPEN");
  });

  it("recorder downtime then VALID_NEGATIVE: TRACKING_LOST and nothing opens", () => {
    const first = applyRound([], round(0, "FIRED", [firedAt(0)])).opened[0];
    const r = applyRound([first.episode], round(61, "VALID_NEGATIVE"));
    expect(r.updated[0].episode.closeReason).toBe("TRACKING_LOST");
    expect(r.opened).toHaveLength(0);
  });

  it("a signal with no pair address cannot anchor outcomes and is not opened", () => {
    const f = fired();
    f.snapshot = { ...f.snapshot, pairAddress: null };
    expect(applyRound([], round(0, "FIRED", [f])).opened).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */

describe("round / lease state machine", () => {
  it("claim, skip finished, skip active lease, take over an expired lease", () => {
    const c = decideClaim(null, T0, "A", T0 + 1000, null);
    expect(c.kind).toBe("CLAIM");
    const rec = (c as { record: import("@/lib/history/model").RoundRecord }).record;
    expect([rec.key, rec.state, rec.attempt, rec.owner]).toEqual([
      "2026-09-26T00:00Z",
      "CLAIMED",
      1,
      "A",
    ]);

    expect(decideClaim(rec, T0, "B", T0 + 2000, null)).toEqual({
      kind: "SKIP",
      reason: "ACTIVE_LEASE",
    });
    const t = decideClaim(rec, T0, "B", T0 + 1000 + ROUND_LEASE_MS + 1, null);
    expect(t.kind).toBe("TAKEOVER");
    const taken = (t as { record: typeof rec }).record;
    expect([taken.attempt, taken.owner]).toEqual([2, "B"]);

    expect(canCommit(taken, "A", 1)).toBe(false); // the crashed worker can never write
    expect(canCommit(taken, "B", 2)).toBe(true);
    expect(decideClaim({ ...taken, state: "COMPLETED" }, T0, "C", T0 + 99_999, null)).toEqual({
      kind: "SKIP",
      reason: "ALREADY_FINISHED",
    });
  });

  it("a minute older than the newest finished round is SUPERSEDED", () => {
    expect(decideClaim(null, T0, "A", T0 + 10 * MIN, T0 + 5 * MIN).kind).toBe("SUPERSEDED");
  });

  it("missed minutes become GAP keys, never backfilled", () => {
    expect(gapKeys(T0, T0 + 4 * MIN, () => false)).toEqual([
      "2026-09-26T00:01Z",
      "2026-09-26T00:02Z",
      "2026-09-26T00:03Z",
    ]);
    expect(gapKeys(T0, T0 + MIN, () => false)).toEqual([]);
    expect(gapKeys(null, T0, () => false)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */

describe("outcomes — exact directional tolerance", () => {
  const event = {
    id: "evt_x",
    openedAt: T0,
    pairAddress: HONSE_PAIR,
  } as import("@/lib/history/model").SignalEvent;
  const outs = scheduleOutcomes(event);
  const o15 = outs.find((o) => o.horizonMinutes === 15)!;
  const sample = (at: number, pair = HONSE_PAIR) =>
    snapshot({
      key: HONSE_KEY,
      pairAddress: pair,
      observedAt: at,
      priceUsd: 0.00006,
      liquidityUsd: 26_000,
    });

  it("schedules exactly 5, 15, 60, 240, 1440 minutes with their tolerances", () => {
    expect(
      outs.map((o) => [
        o.horizonMinutes,
        (o.targetAt - T0) / MIN,
        (o.windowEndAt - o.targetAt) / MIN,
      ]),
    ).toEqual([
      [5, 5, 2],
      [15, 15, 3],
      [60, 60, 10],
      [240, 240, 20],
      [1440, 1440, 60],
    ]);
    expect(outs.every((o) => o.availability === "PENDING")).toBe(true);
  });

  it("boundaries: target accepted (delay 0), 1 ms before target rejected, window end accepted, 1 ms after rejected", () => {
    expect(acceptSample(o15, event, sample(o15.targetAt), "ROUND", null)?.delaySeconds).toBe(0);
    expect(acceptSample(o15, event, sample(o15.targetAt - 1), "ROUND", null)).toBeNull();
    expect(acceptSample(o15, event, sample(o15.windowEndAt), "ROUND", null)?.availability).toBe(
      "OBSERVED",
    );
    expect(acceptSample(o15, event, sample(o15.windowEndAt + 1), "ROUND", null)).toBeNull();
    expect(o15.windowEndAt - o15.targetAt).toBe(OUTCOME_TOLERANCE_MS[15]);
  });

  it("late but within tolerance: +16m12s is stored as +16m12s, delay 72 s", () => {
    const at = T0 + 16 * MIN + 12_000;
    const got = acceptSample(o15, event, sample(at), "DUE_TOKEN_BATCH", null)!;
    expect([got.observedAt, got.delaySeconds, got.source]).toEqual([at, 72, "DUE_TOKEN_BATCH"]);
    expect(got.market).toMatchObject({
      priceUsd: 0.00006,
      liquidityUsd: 26_000,
      pairAddress: HONSE_PAIR,
    });
  });

  it("a different pool of the same token is never accepted", () => {
    expect(
      acceptSample(
        o15,
        event,
        sample(o15.targetAt, "SomeOtherPool1111111111111111111111111111"),
        "ROUND",
        null,
      ),
    ).toBeNull();
  });

  it("first accepted sample wins; it is immutable", () => {
    const got = acceptSample(o15, event, sample(o15.targetAt), "ROUND", null)!;
    expect(acceptSample(got, event, sample(o15.targetAt + 1000), "ROUND", null)).toBeNull();
  });

  it("outside tolerance → UNAVAILABLE with the last recorded failure as reason", () => {
    expect(expireIfElapsed(o15, o15.windowEndAt)).toBeNull(); // still inside
    expect(expireIfElapsed(o15, o15.windowEndAt + 1)).toMatchObject({
      availability: "UNAVAILABLE",
      unavailableReason: "WINDOW_ELAPSED",
      observedAt: null,
      market: null,
    });
    const failed = noteFailure(o15, "RATE_LIMITED");
    expect(expireIfElapsed(failed, o15.windowEndAt + 1)?.unavailableReason).toBe("RATE_LIMITED");
  });
});
