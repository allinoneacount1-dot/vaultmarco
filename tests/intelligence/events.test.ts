import { describe, expect, it } from "vitest";
import { assetKey } from "@/lib/assetIdentity";
import type { AssetObservation, RadarFiring } from "@/lib/intelligence/facts";
import { EVENT_FAMILY, type EvidenceEvent, extractAssetEvents } from "@/lib/intelligence/events";
import { batchFromRealtime, failureBatch } from "@/lib/intelligence/ingest";
import {
  INTELLIGENCE_RULES_VERSION,
  PRICE_EXPANSION_M5_PCT,
  RUN_MAX_GAP_MS,
  SESSION_DELTA_MAX_SPAN_MS,
} from "@/lib/intelligence/rules";
import { createSessionState, ingest } from "@/lib/intelligence/sessionHistory";
import { VA_MIN } from "@/lib/signals/thresholds";
import {
  MIN,
  SEC,
  SOL_KEY,
  SOL_PAIR,
  START,
  T0,
  TOKEN_A,
  WETH_KEY,
  WETH_PAIR,
  batch,
  obs,
  realEnvelope,
} from "./helpers";

type RadarIn = { assetKey: string } & RadarFiring;

function run(observations: AssetObservation[], radar: RadarIn[] = []) {
  let s = createSessionState(START);
  for (const o of observations) {
    const lane = o.lanes[0];
    s = ingest(
      s,
      batch(lane, o.observedAt, [o], { radar: radar.filter((r) => r.observedAt === o.observedAt) }),
    );
  }
  return s;
}
const eventsOf = (observations: AssetObservation[], key = SOL_KEY, radar: RadarIn[] = []) => {
  const s = run(observations, radar);
  return extractAssetEvents(s.assets.get(key)!, s.lanes);
};
const ofType = (events: EvidenceEvent[], t: EvidenceEvent["type"]) =>
  events.filter((e) => e.type === t);
const t = (i: number) => T0 + i * 30 * SEC;

describe("events — onset semantics", () => {
  it("a condition that stays true is ONE event at its first observation", () => {
    const ev = eventsOf([
      obs(SOL_PAIR, t(0), { priceChange: { m5: 0.5 } }),
      obs(SOL_PAIR, t(1), { priceChange: { m5: 4 } }),
      obs(SOL_PAIR, t(2), { priceChange: { m5: 5 } }),
      obs(SOL_PAIR, t(3), { priceChange: { m5: 6 } }),
    ]);
    const px = ofType(ev, "PRICE_EXPANSION");
    expect(px).toHaveLength(1);
    expect(px[0]).toMatchObject({
      observedAt: t(1),
      lastObservedAt: t(3),
      active: true,
      onset: "OBSERVED",
      direction: "UP",
      value: 4,
      prior: 0.5,
      priorObservedAt: t(0),
      threshold: PRICE_EXPANSION_M5_PCT,
      family: "PRICE",
      rulesVersion: INTELLIGENCE_RULES_VERSION,
      assetKey: SOL_KEY,
      chainId: "solana",
      pairAddress: SOL_PAIR.pairAddress,
      baseAddress: SOL_PAIR.baseToken.address,
      quoteAddress: SOL_PAIR.quoteToken!.address,
    });
    expect(px[0].horizon.kind).toBe("PROVIDER_WINDOW");
  });

  it("true at the first observation is IN_PROGRESS_WHEN_OBSERVED with no invented prior", () => {
    const [e] = ofType(
      eventsOf([obs(SOL_PAIR, t(0), { priceChange: { m5: -4 } })]),
      "PRICE_EXPANSION",
    );
    expect(e).toMatchObject({
      onset: "IN_PROGRESS_WHEN_OBSERVED",
      prior: null,
      priorObservedAt: null,
      direction: "DOWN",
    });
  });

  it("zero is data (a real negative), missing is unknown (breaks the run, never zero)", () => {
    const zero = eventsOf([
      obs(SOL_PAIR, t(0), { priceChange: { m5: 0 } }),
      obs(SOL_PAIR, t(1), { priceChange: { m5: 3 } }),
    ]);
    expect(ofType(zero, "PRICE_EXPANSION")[0]).toMatchObject({ onset: "OBSERVED", prior: 0 });
    const missing = eventsOf([
      obs(SOL_PAIR, t(0), { priceChange: { m5: null } }),
      obs(SOL_PAIR, t(1), { priceChange: { m5: 3 } }),
    ]);
    expect(ofType(missing, "PRICE_EXPANSION")[0]).toMatchObject({
      onset: "IN_PROGRESS_WHEN_OBSERVED",
      prior: null,
    });
    const allMissing = eventsOf([obs(SOL_PAIR, t(0), { priceChange: { m5: null } })]);
    expect(ofType(allMissing, "PRICE_EXPANSION")).toEqual([]);
  });

  it("a direction flip or a gap longer than the run gap starts a new event", () => {
    const ev = ofType(
      eventsOf([
        obs(SOL_PAIR, t(0), { priceChange: { m5: 4 } }),
        obs(SOL_PAIR, t(1), { priceChange: { m5: -4 } }),
        obs(SOL_PAIR, t(1) + RUN_MAX_GAP_MS + SEC, { priceChange: { m5: -5 } }),
      ]),
      "PRICE_EXPANSION",
    );
    expect(ev.map((e) => [e.direction, e.observedAt, e.onset])).toEqual([
      ["UP", t(0), "IN_PROGRESS_WHEN_OBSERVED"],
      ["DOWN", t(1), "IN_PROGRESS_WHEN_OBSERVED"],
      ["DOWN", t(1) + RUN_MAX_GAP_MS + SEC, "IN_PROGRESS_WHEN_OBSERVED"],
    ]);
    expect(ev.map((e) => e.active)).toEqual([false, false, true]);
  });

  it("extraction is deterministic, chronological and has unique ids", () => {
    const list = [
      obs(SOL_PAIR, t(0), { priceChange: { m5: 0 } }),
      obs(SOL_PAIR, t(1), { priceChange: { m5: 4 }, liquidityUsd: 1_000_000 }),
    ];
    const a = eventsOf(list);
    const b = eventsOf(list);
    expect(a).toEqual(b);
    expect(new Set(a.map((e) => e.id)).size).toBe(a.length);
    expect(a.map((e) => e.observedAt)).toEqual(
      [...a.map((e) => e.observedAt)].sort((x, y) => x - y),
    );
    for (const e of a) expect(e.family).toBe(EVENT_FAMILY[e.type]);
  });
});

describe("events — provider-window rules reuse the radar", () => {
  // 47-minute-old pair: previous window 42 min; 16,800 → 400/min; recent 6,800/5 → VA 3.4.
  const accel = (at: number) =>
    obs(SOL_PAIR, at, {
      pairCreatedAt: at - 47 * MIN,
      volume: { m5: 6_800, h1: 23_600 },
      txns: { m5: { buys: 38, sells: 14 }, h1: { buys: 150, sells: 112 } },
    });

  it("VOLUME_ACCELERATION / TXN_ACCELERATION use the radar's VA / TA", () => {
    const ev = eventsOf([accel(t(0))]);
    const va = ofType(ev, "VOLUME_ACCELERATION")[0];
    expect(va.value).toBeCloseTo(3.4, 5);
    expect(va.threshold).toBe(VA_MIN);
    expect(va.caveat).toMatch(/overlap/);
    expect(ofType(ev, "TXN_ACCELERATION")[0].value).toBeCloseTo(2.08, 2);
  });

  it("the real SOL fixture (m5 120 buys / 68 sells) is a BUY imbalance; WETH 5/5 is balanced", async () => {
    const env = await realEnvelope(T0);
    const s = ingest(createSessionState(START), batchFromRealtime(env)!);
    const sol = ofType(extractAssetEvents(s.assets.get(SOL_KEY)!, s.lanes), "BUY_SELL_IMBALANCE");
    expect(sol[0]).toMatchObject({ direction: "BUY", evidence: { buysM5: 120, sellsM5: 68 } });
    expect(sol[0].value).toBeCloseTo(120 / 68, 6);
    const weth = extractAssetEvents(s.assets.get(WETH_KEY)!, s.lanes);
    expect(ofType(weth, "BUY_SELL_IMBALANCE")).toEqual([]);
    // Real majors: no price expansion in the captured m5 moves.
    expect(ofType(weth, "PRICE_EXPANSION")).toEqual([]);
  });

  it("SELL side and the sample guard", () => {
    const sell = eventsOf([obs(SOL_PAIR, t(0), { txns: { m5: { buys: 10, sells: 30 } } })]);
    expect(ofType(sell, "BUY_SELL_IMBALANCE")[0]).toMatchObject({ direction: "SELL", value: 3 });
    const thin = eventsOf([obs(SOL_PAIR, t(0), { txns: { m5: { buys: 6, sells: 0 } } })]);
    expect(ofType(thin, "BUY_SELL_IMBALANCE")).toEqual([]);
    const zero = eventsOf([obs(SOL_PAIR, t(0), { txns: { m5: { buys: 0, sells: 0 } } })]);
    expect(ofType(zero, "BUY_SELL_IMBALANCE")).toEqual([]);
  });
});

describe("events — session deltas", () => {
  it("LIQUIDITY_CHANGE compares two real observations of the same pair", () => {
    const ev = ofType(
      eventsOf([
        obs(SOL_PAIR, T0, { liquidityUsd: 100_000 }),
        obs(SOL_PAIR, T0 + 6 * MIN, { liquidityUsd: 85_000 }),
      ]),
      "LIQUIDITY_CHANGE",
    );
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({
      direction: "REMOVED",
      value: 85_000,
      prior: 100_000,
      priorObservedAt: T0,
      onset: "OBSERVED",
      observedAt: T0 + 6 * MIN,
    });
    expect(ev[0].evidence.deltaUsd).toBe(-15_000);
  });

  it("no liquidity delta across a pair switch, a too-wide gap, or a missing side", () => {
    const other = { pairAddress: "OtherPoo1111111111111111111111111111111111" };
    const switched = eventsOf([
      obs(SOL_PAIR, T0, { liquidityUsd: 100_000 }),
      obs(SOL_PAIR, T0 + 6 * MIN, { liquidityUsd: 50_000, ...other }),
    ]);
    expect(ofType(switched, "LIQUIDITY_CHANGE")).toEqual([]);
    const wide = eventsOf([
      obs(SOL_PAIR, T0, { liquidityUsd: 100_000 }),
      obs(SOL_PAIR, T0 + SESSION_DELTA_MAX_SPAN_MS + MIN, { liquidityUsd: 50_000 }),
    ]);
    expect(ofType(wide, "LIQUIDITY_CHANGE")).toEqual([]);
    const missing = eventsOf([
      obs(SOL_PAIR, T0, { liquidityUsd: null }),
      obs(SOL_PAIR, T0 + 6 * MIN, { liquidityUsd: 50_000 }),
    ]);
    expect(ofType(missing, "LIQUIDITY_CHANGE")).toEqual([]);
    const noPair = eventsOf([
      obs(SOL_PAIR, T0, { liquidityUsd: 100_000, pairAddress: null }),
      obs(SOL_PAIR, T0 + 6 * MIN, { liquidityUsd: 50_000, pairAddress: null }),
    ]);
    expect(ofType(noPair, "LIQUIDITY_CHANGE")).toEqual([]);
  });

  it("BOOST_CHANGE from the real boosts.active field; canonical pairs (no field) never fire", () => {
    const key = assetKey("solana", TOKEN_A.baseToken.address);
    const ev = ofType(
      eventsOf(
        [
          obs(TOKEN_A, T0, {}, "universe"),
          obs(TOKEN_A, T0 + MIN, { boostsActive: 12 }, "universe"),
        ],
        key,
      ),
      "BOOST_CHANGE",
    );
    expect(ev[0]).toMatchObject({
      direction: "UP",
      value: 12,
      prior: 10,
      priorObservedAt: T0,
      onset: "OBSERVED",
    });
    const canonical = eventsOf([obs(SOL_PAIR, T0), obs(SOL_PAIR, T0 + MIN)]);
    expect(ofType(canonical, "BOOST_CHANGE")).toEqual([]);
  });
});

describe("events — radar, discovery, provider", () => {
  const firing = (at: number): RadarIn => ({
    assetKey: SOL_KEY,
    kind: "MOMENTUM",
    observedAt: at,
    roundAt: at,
    direction: null,
    severity: null,
    value: 3.4,
    prior: null,
    priorObservedAt: null,
    reasons: ["Volume 3.4× previous pace"],
  });

  it("MOMENTUM_FIRED is recorded from the radar round; onset OBSERVED after a non-firing round", () => {
    const list = [0, 1, 2].map((i) => obs(SOL_PAIR, T0 + i * MIN, {}, "universe"));
    const ev = ofType(
      eventsOf(list, SOL_KEY, [firing(T0 + MIN), firing(T0 + 2 * MIN)]),
      "MOMENTUM_FIRED",
    );
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({
      observedAt: T0 + MIN,
      lastObservedAt: T0 + 2 * MIN,
      onset: "OBSERVED",
      value: 3.4,
    });
  });

  it("PAIR_DISCOVERED only for an asset that entered after the first universe round", () => {
    const key = assetKey("solana", TOKEN_A.baseToken.address);
    let s = ingest(
      createSessionState(START),
      batch("universe", T0, [obs(SOL_PAIR, T0, {}, "universe")]),
    );
    s = ingest(s, batch("universe", T0 + MIN, [obs(TOKEN_A, T0 + MIN, {}, "universe")]));
    const ev = ofType(extractAssetEvents(s.assets.get(key)!, s.lanes), "PAIR_DISCOVERED");
    expect(ev).toHaveLength(1);
    expect(ev[0].observedAt).toBe(T0 + MIN);
    expect(ev[0].evidence.pairCreatedAt).toBe(TOKEN_A.pairCreatedAt);
    expect(ofType(extractAssetEvents(s.assets.get(SOL_KEY)!, s.lanes), "PAIR_DISCOVERED")).toEqual(
      [],
    );
  });

  it("PROVIDER_STALE on a lane failure, PROVIDER_RECOVERED on the next success", () => {
    let s = ingest(createSessionState(START), batch("realtime", T0, [obs(SOL_PAIR, T0)]));
    s = ingest(s, failureBatch("realtime", T0 + 40 * SEC, { code: "RATE_LIMITED" })!);
    s = ingest(s, failureBatch("realtime", T0 + 70 * SEC, { code: "TIMEOUT" })!);
    s = ingest(s, batch("realtime", T0 + 100 * SEC, [obs(SOL_PAIR, T0 + 100 * SEC)]));
    const ev = extractAssetEvents(s.assets.get(SOL_KEY)!, s.lanes).filter(
      (e) => e.family === "PROVIDER",
    );
    expect(ev.map((e) => [e.type, e.observedAt])).toEqual([
      ["PROVIDER_STALE", T0 + 40 * SEC],
      ["PROVIDER_RECOVERED", T0 + 100 * SEC],
    ]);
    expect(ev[0].evidence.code).toBe("RATE_LIMITED");
  });

  it("a canonical slot gap is per-asset provider evidence", async () => {
    let s = ingest(createSessionState(START), batchFromRealtime(await realEnvelope(T0))!);
    s = ingest(s, batchFromRealtime(await realEnvelope(T0 + 30 * SEC, ["ethereum"]))!);
    s = ingest(s, batchFromRealtime(await realEnvelope(T0 + 60 * SEC))!);
    const weth = extractAssetEvents(s.assets.get(WETH_KEY)!, s.lanes).filter(
      (e) => e.family === "PROVIDER",
    );
    expect(weth.map((e) => [e.type, e.observedAt])).toEqual([
      ["PROVIDER_STALE", T0 + 30 * SEC],
      ["PROVIDER_RECOVERED", T0 + 60 * SEC],
    ]);
    const sol = extractAssetEvents(s.assets.get(SOL_KEY)!, s.lanes).filter(
      (e) => e.family === "PROVIDER",
    );
    expect(sol).toEqual([]);
  });
});
