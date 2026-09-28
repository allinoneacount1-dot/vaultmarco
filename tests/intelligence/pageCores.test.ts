import { describe, expect, it } from "vitest";
import {
  EVENT_FAMILY,
  type EventType,
  type EvidenceEvent,
  extractAssetEvents,
} from "@/lib/intelligence/events";
import {
  edgeClockOrigin,
  eventsSince,
  firstObservedStructuralChange,
} from "@/lib/intelligence/edgeClock";
import { collisionFamilies } from "@/lib/intelligence/collision";
import { QUEUE_SORTS, queueRow, sortQueue, type QueueRow } from "@/lib/intelligence/changeQueue";
import { COLLISION_WINDOW_MS, INTELLIGENCE_RULES_VERSION } from "@/lib/intelligence/rules";
import { createSessionState, ingest } from "@/lib/intelligence/sessionHistory";
import { MIN, SEC, SOL_KEY, SOL_PAIR, START, T0, batch, obs } from "./helpers";

function ev(type: EventType, at: number, over: Partial<EvidenceEvent> = {}): EvidenceEvent {
  return {
    id: `${type}|${over.assetKey ?? SOL_KEY}|p|${at}|-`,
    type,
    family: EVENT_FAMILY[type],
    assetKey: SOL_KEY,
    chainId: "solana",
    address: SOL_PAIR.baseToken.address,
    pairAddress: SOL_PAIR.pairAddress ?? null,
    baseAddress: SOL_PAIR.baseToken.address,
    quoteAddress: null,
    dexId: null,
    observedAt: at,
    lastObservedAt: at,
    active: true,
    onset: "OBSERVED",
    source: "DEXSCREENER · REALTIME",
    direction: "UP",
    unit: null,
    value: null,
    prior: null,
    priorObservedAt: null,
    threshold: null,
    horizon: { kind: "PROVIDER_WINDOW", label: "M5", ms: 300_000 },
    caveat: null,
    evidence: {},
    rulesVersion: INTELLIGENCE_RULES_VERSION,
    ...over,
  };
}

describe("edge clock origin", () => {
  it("an active, contiguous observed reversal may be the Edge Clock origin", () => {
    let s = createSessionState(START);
    [4, 5, -4, -5].forEach((v, i) => {
      const at = T0 + i * 30 * SEC;
      s = ingest(s, batch("realtime", at, [obs(SOL_PAIR, at, { priceChange: { m5: v } })]));
    });
    const events = extractAssetEvents(s.assets.get(SOL_KEY)!, s.lanes);
    const origin = edgeClockOrigin(events)!;
    expect(origin).toMatchObject({ type: "PRICE_EXPANSION", direction: "DOWN", onset: "OBSERVED" });
    expect(origin.observedAt).toBe(T0 + 60 * SEC);
  });

  it("is null when nothing was observed changing — session start / first observation never become the origin", () => {
    // A condition already true at the first observation, observed for 10 minutes.
    let s = createSessionState(START);
    for (let i = 0; i < 20; i++) {
      const at = T0 + i * 30 * SEC;
      s = ingest(s, batch("realtime", at, [obs(SOL_PAIR, at, { priceChange: { m5: 5 } })]));
    }
    const events = extractAssetEvents(s.assets.get(SOL_KEY)!, s.lanes);
    expect(
      events.some((e) => e.type === "PRICE_EXPANSION" && e.onset === "IN_PROGRESS_WHEN_OBSERVED"),
    ).toBe(true);
    expect(edgeClockOrigin(events)).toBeNull();
    expect(firstObservedStructuralChange(events)).toBeNull();
    expect(edgeClockOrigin([])).toBeNull();
  });

  it("starts at the real observation where the change was first seen", () => {
    let s = createSessionState(START);
    const m5 = [0.2, 0.4, 4, 5, 6];
    m5.forEach((v, i) => {
      const at = T0 + i * 30 * SEC;
      s = ingest(s, batch("realtime", at, [obs(SOL_PAIR, at, { priceChange: { m5: v } })]));
    });
    const events = extractAssetEvents(s.assets.get(SOL_KEY)!, s.lanes);
    const origin = edgeClockOrigin(events)!;
    expect(origin.type).toBe("PRICE_EXPANSION");
    expect(origin.observedAt).toBe(T0 + 60 * SEC);
    expect(origin.observedAt).not.toBe(s.startedAt);
    expect(origin.observedAt).not.toBe(s.assets.get(SOL_KEY)!.firstSeenAt);
    expect(eventsSince(events, origin).every((e) => e.observedAt >= origin.observedAt)).toBe(true);
  });

  it("ignores provider, discovery, in-progress and inactive events; earliest active onset wins", () => {
    const list = [
      ev("PROVIDER_RECOVERED", T0),
      ev("PAIR_DISCOVERED", T0 + 1),
      ev("PRICE_EXPANSION", T0 + 2, { onset: "IN_PROGRESS_WHEN_OBSERVED" }),
      ev("VOLUME_ACCELERATION", T0 + 3, { active: false }),
      ev("LIQUIDITY_CHANGE", T0 + 5),
      ev("TXN_ACCELERATION", T0 + 4),
    ];
    expect(edgeClockOrigin(list)!.type).toBe("TXN_ACCELERATION");
    expect(firstObservedStructuralChange(list)!.type).toBe("VOLUME_ACCELERATION");
  });
});

describe("collision families", () => {
  it("pair-switch regression: events on pool A then pool B inside the window never form one collision", () => {
    const A = SOL_PAIR.pairAddress!;
    const B = "OtherPoo1111111111111111111111111111111111";
    const list = [
      ev("PRICE_EXPANSION", T0, { pairAddress: A }),
      ev("LIQUIDITY_CHANGE", T0 + 30 * SEC, { pairAddress: A }),
      ev("VOLUME_ACCELERATION", T0 + MIN, { pairAddress: B }),
      ev("PROVIDER_STALE", T0 + 2 * MIN, { pairAddress: A }),
    ];
    const c = collisionFamilies(list)!;
    expect(c.pairAddress).toBe(B);
    expect(c.families.map((f) => f.family)).toEqual(["VOLUME", "PROVIDER"]);
    const a = collisionFamilies(list, COLLISION_WINDOW_MS, { pairAddress: A })!;
    expect(a.families.map((f) => f.family)).toEqual(["PRICE", "LIQUIDITY", "PROVIDER"]);
    for (const f of [...c.families, ...a.families]) {
      if (f.family !== "PROVIDER") {
        expect(new Set(f.events.map((e) => e.pairAddress)).size).toBe(1);
      }
    }
  });

  it("counts families, not events — same family in the window is one vote", () => {
    const c = collisionFamilies([
      ev("TXN_ACCELERATION", T0),
      ev("BUY_SELL_IMBALANCE", T0 + 10 * SEC),
      ev("PRICE_EXPANSION", T0 + 20 * SEC),
      ev("PRICE_EXPANSION", T0 + 40 * SEC, { direction: "DOWN", id: "px2" }),
    ])!;
    expect(c.count).toBe(2);
    expect(c.families.map((f) => [f.family, f.events.length])).toEqual([
      ["TRANSACTIONS", 2],
      ["PRICE", 2],
    ]);
    expect(c.spanMs).toBe(20 * SEC);
  });

  it("window boundaries are inclusive and bounded by COLLISION_WINDOW_MS", () => {
    const end = T0 + COLLISION_WINDOW_MS;
    const c = collisionFamilies([
      ev("VOLUME_ACCELERATION", T0 - 1),
      ev("LIQUIDITY_CHANGE", T0),
      ev("BOOST_CHANGE", end),
    ])!;
    expect(c.families.map((f) => f.family)).toEqual(["LIQUIDITY", "BOOST"]);
    expect([c.windowStart, c.windowEnd]).toEqual([T0, end]);
    expect(collisionFamilies([])).toBeNull();
    expect(
      collisionFamilies([ev("PROVIDER_STALE", T0)], COLLISION_WINDOW_MS, { families: ["PRICE"] }),
    ).toBeNull();
  });
});

describe("change queue", () => {
  const row = (key: string, over: Partial<QueueRow>): QueueRow => ({
    assetKey: key,
    chainId: "solana",
    address: key,
    pairAddress: null,
    newestAt: T0,
    newestId: `PRICE_EXPANSION|${key}`,
    newestType: "PRICE_EXPANSION",
    newestDirection: "UP",
    eventCount: 1,
    familyCount: 1,
    volumeAcceleration: null,
    liquidityChangeUsd: null,
    ...over,
  });
  const rows = [
    row("a", { newestAt: T0, eventCount: 3, volumeAcceleration: 4, liquidityChangeUsd: -50_000 }),
    row("b", {
      newestAt: T0 + MIN,
      eventCount: 1,
      volumeAcceleration: null,
      liquidityChangeUsd: 20_000,
    }),
    row("c", {
      newestAt: T0 + MIN,
      eventCount: 3,
      volumeAcceleration: 4,
      liquidityChangeUsd: null,
    }),
    row("d", {
      newestAt: T0 - MIN,
      eventCount: 0 + 2,
      volumeAcceleration: 0,
      liquidityChangeUsd: 0,
    }),
  ];
  const keys = (r: QueueRow[]) => r.map((x) => x.assetKey);

  it("deterministic orderings with fixed tie-breaks (newest, then assetKey); unknown sorts last, 0 is data", () => {
    expect(keys(sortQueue(rows, "NEWEST"))).toEqual(["b", "c", "a", "d"]);
    expect(keys(sortQueue(rows, "MOST_EVENTS"))).toEqual(["c", "a", "d", "b"]);
    expect(keys(sortQueue(rows, "LARGEST_VOLUME_ACCELERATION"))).toEqual(["c", "a", "d", "b"]);
    expect(keys(sortQueue(rows, "LARGEST_LIQUIDITY_CHANGE"))).toEqual(["a", "b", "d", "c"]);
    for (const s of QUEUE_SORTS)
      expect(sortQueue([...rows].reverse(), s)).toEqual(sortQueue(rows, s));
  });

  it("rows carry no score; provider-only assets do not queue", () => {
    const r = queueRow([
      ev("PRICE_EXPANSION", T0),
      ev("PROVIDER_STALE", T0 + MIN),
      ev("PRICE_EXPANSION", T0 + 5, { id: "x" }),
    ])!;
    expect(r).toMatchObject({ newestAt: T0 + 5, eventCount: 2, familyCount: 1 });
    expect(Object.keys(r).some((k) => /score|rank|confidence|probab/i.test(k))).toBe(false);
    expect(queueRow([ev("PROVIDER_STALE", T0)])).toBeNull();
    const liq = queueRow([
      ev("LIQUIDITY_CHANGE", T0, { evidence: { deltaUsd: -15_000 } }),
      ev("VOLUME_ACCELERATION", T0 + 1, { value: 3.2 }),
    ])!;
    expect([liq.liquidityChangeUsd, liq.volumeAcceleration]).toEqual([-15_000, 3.2]);
  });
});
