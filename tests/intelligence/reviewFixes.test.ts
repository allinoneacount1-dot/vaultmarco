import { afterEach, describe, expect, it, vi } from "vitest";
import { SnapshotHistory } from "@/lib/signals/history";
import { computeRadar } from "@/lib/signals/radar";
import { toPairSnapshot } from "@/lib/signals/pairSnapshot";
import type { DexPair } from "@/lib/providers/dexscreener";
import { collisionFamilies } from "@/lib/intelligence/collision";
import { collisionView } from "@/lib/intelligence/collisionView";
import { queueRow } from "@/lib/intelligence/changeQueue";
import { changeText } from "@/lib/intelligence/changeQueueView";
import { edgeClockOrigin } from "@/lib/intelligence/edgeClock";
import {
  EVENT_FAMILY,
  type EventType,
  type EvidenceEvent,
  extractAssetEvents,
  isLaneOnly,
} from "@/lib/intelligence/events";
import type { SessionState } from "@/lib/intelligence/facts";
import { batchFromUniverse } from "@/lib/intelligence/ingest";
import { TYPE_TEXT, firstMoves } from "@/lib/intelligence/moment";
import { INTELLIGENCE_RULES_VERSION } from "@/lib/intelligence/rules";
import {
  SessionStore,
  createSessionState,
  ingest,
  recordingGaps,
} from "@/lib/intelligence/sessionHistory";
import { factLabel } from "@/lib/intelligence/trace";
import { intelligenceSession, nowSnapshot } from "@/hooks/useIntelligence";
import { MIN, SEC, SOL_KEY, SOL_PAIR, START, T0, TOKEN_A, batch, obs } from "./helpers";

/**
 * PR #18 review fixes (intel-3). Each block reproduces one finding; every
 * test here fails on 7193d41 and passes after the fix.
 */

const onlyTrack = (s: SessionState) => [...s.assets.values()][0];
const eventsOf = (s: SessionState) => extractAssetEvents(onlyTrack(s), s.lanes);
const onPool = (pool: string) => ({ ...TOKEN_A, pairAddress: pool }) as DexPair;

describe("B1 — radar firings never compare two pools", () => {
  /** A feed asset through the REAL radar: pool/liquidity per universe round, one minute apart. */
  function radarSession(rounds: ReadonlyArray<readonly [string, number]>) {
    const history = new SnapshotHistory();
    let s = createSessionState(START);
    rounds.forEach(([pool, usd], i) => {
      const at = T0 + i * MIN;
      const snap = {
        ...toPairSnapshot(onPool(pool), at, ["boost-latest"]),
        liquidityUsd: usd,
        pairAddress: pool,
      };
      history.record([snap]);
      const radar = computeRadar([snap], history, at);
      const u = {
        snapshots: [snap],
        radar,
        radarInputs: { status: "live", issues: [] },
        observedAt: at,
      } as never;
      s = ingest(s, batchFromUniverse(u, at)!);
    });
    return s;
  }

  it("a RISK firing whose prior is from another pool is dropped (never an Edge Clock origin)", () => {
    const s = radarSession([
      ...Array.from({ length: 6 }, () => ["POOL_A", 1_000_000] as const),
      ["POOL_B", 800_000],
      ["POOL_B", 740_000],
    ]);
    const events = eventsOf(s);
    expect(events.filter((e) => e.type === "RISK_FIRED")).toEqual([]);
    expect(edgeClockOrigin(events)?.type).not.toBe("RISK_FIRED");
  });

  it("control: a same-pool liquidity drop still records the radar's RISK firing, prior on the same pool", () => {
    const s = radarSession([
      ...Array.from({ length: 6 }, () => ["POOL_A", 1_000_000] as const),
      ["POOL_A", 700_000],
    ]);
    const risk = eventsOf(s).filter((e) => e.type === "RISK_FIRED");
    expect(risk).toHaveLength(1);
    const track = onlyTrack(s);
    const prior = track.observations.find((o) => o.observedAt === risk[0].priorObservedAt);
    expect(prior?.pairAddress).toBe("POOL_A");
  });

  it("a MOMENTUM firing is dropped when a pool switch lies inside the radar's evidence lookback", () => {
    const run = (pools: string[]) => {
      let s = createSessionState(START);
      pools.forEach((pool, i) => {
        const at = T0 + i * MIN;
        const o = obs(onPool(pool), at, {}, "universe");
        const radar =
          i === pools.length - 1
            ? [
                {
                  assetKey: o.assetKey,
                  kind: "MOMENTUM" as const,
                  observedAt: at,
                  roundAt: at,
                  direction: null,
                  severity: null,
                  value: 4,
                  prior: null,
                  priorObservedAt: null,
                  reasons: [],
                },
              ]
            : [];
        s = ingest(s, batch("universe", at, [o], { radar }));
      });
      return eventsOf(s).filter((e) => e.type === "MOMENTUM_FIRED");
    };
    expect(run(["POOL_A", "POOL_A", "POOL_B", "POOL_B"])).toEqual([]);
    expect(run(["POOL_A", "POOL_A", "POOL_A", "POOL_A"])).toHaveLength(1);
  });
});

describe("B2 — collision counts only OBSERVED onsets", () => {
  it("conditions already true at the first observation are not a collision; they are listed as NOT COUNTED", () => {
    let s = createSessionState(START);
    const o1 = obs(TOKEN_A, T0, {
      priceChange: { m5: 6 },
      volume: { m5: 60_000, h1: 80_000 },
      txns: { m5: { buys: 90, sells: 10 }, h1: { buys: 120, sells: 40 } },
    });
    s = ingest(s, batch("realtime", T0, [o1]));
    const events = eventsOf(s);
    expect(events.some((e) => e.onset === "IN_PROGRESS_WHEN_OBSERVED")).toBe(true);
    const v = collisionView(events);
    expect(v.isCollision).toBe(false);
    expect(v.collision).toBeNull();
    expect(v.notCounted.length).toBeGreaterThan(0);
    expect(v.notCounted.every((e) => e.onset === "IN_PROGRESS_WHEN_OBSERVED")).toBe(true);
  });
});

/** A synthetic event for pure family-vote checks. */
function ev(type: EventType, at: number, over: Partial<EvidenceEvent> = {}): EvidenceEvent {
  return {
    id: `${type}|${SOL_KEY}|p|${at}|-`,
    type,
    family: EVENT_FAMILY[type],
    assetKey: SOL_KEY,
    chainId: "solana",
    address: SOL_PAIR.baseToken.address,
    pairAddress: "p",
    baseAddress: SOL_PAIR.baseToken.address,
    quoteAddress: null,
    dexId: null,
    observedAt: at,
    lastObservedAt: at,
    active: true,
    onset: "OBSERVED",
    source: "DEXSCREENER · UNIVERSE",
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

describe("M1 — independent families never count a derived radar signal", () => {
  it("MOMENTUM_FIRED with VOLUME_ACCELERATION is ONE family; RISK_FIRED with LIQUIDITY_CHANGE is ONE", () => {
    const c = collisionFamilies([
      ev("VOLUME_ACCELERATION", T0),
      ev("MOMENTUM_FIRED", T0 + SEC),
      ev("LIQUIDITY_CHANGE", T0 + 2 * SEC, { direction: "REMOVED" }),
      ev("RISK_FIRED", T0 + 3 * SEC, { direction: "REMOVED" }),
      ev("PAIR_DISCOVERED", T0 + 4 * SEC, { direction: null }),
    ])!;
    expect(c.families.map((f) => f.family)).toEqual(["VOLUME", "LIQUIDITY"]);
    expect(c.count).toBe(2);
  });

  it("the rules version records the change", () => {
    expect(INTELLIGENCE_RULES_VERSION).toBe("intel-3");
  });
});

describe("M2 — the session starts when the recorder first mounts, not at app boot", () => {
  it("the module store is not started on import (app boot)", () => {
    expect(Number.isFinite(intelligenceSession.getState().startedAt)).toBe(false);
  });

  it("before start every batch is pre-session; start/pause/resume record intervals", () => {
    const store = new SessionStore();
    store.ingest(batch("realtime", T0, [obs(SOL_PAIR, T0)]));
    expect(store.getState().assets.size).toBe(0);
    expect(store.getState().rejected.preSession).toBeGreaterThan(0);

    store.start(T0 + MIN);
    expect(store.getState().startedAt).toBe(T0 + MIN);
    store.ingest(batch("realtime", T0 + 30 * SEC, [obs(SOL_PAIR, T0 + 30 * SEC)]));
    expect(store.getState().assets.size).toBe(0); // still before the mount
    store.ingest(batch("realtime", T0 + 2 * MIN, [obs(SOL_PAIR, T0 + 2 * MIN)]));
    expect(store.getState().assets.size).toBe(1);

    store.pause(T0 + 5 * MIN);
    store.start(T0 + 9 * MIN);
    store.start(T0 + 10 * MIN); // idempotent while recording
    const s = store.getState();
    expect(s.startedAt).toBe(T0 + MIN);
    expect(s.recording).toEqual([
      { from: T0 + MIN, to: T0 + 5 * MIN },
      { from: T0 + 9 * MIN, to: null },
    ]);
    expect(recordingGaps(s.recording)).toEqual([{ from: T0 + 5 * MIN, to: T0 + 9 * MIN }]);
  });
});

describe("M3 — WHAT MOVED FIRST lists observed onsets only (the Trace sequence)", () => {
  it("in-progress conditions at the first observation are never first moves; a later onset is", () => {
    let s = createSessionState(START);
    const hot = {
      priceChange: { m5: 0.1 },
      txns: { m5: { buys: 90, sells: 10 }, h1: { buys: 120, sells: 40 } },
    };
    const o1 = obs(TOKEN_A, T0, hot);
    s = ingest(s, batch("realtime", T0, [o1]));
    const before = eventsOf(s);
    expect(before.filter((e) => e.onset === "IN_PROGRESS_WHEN_OBSERVED").length).toBeGreaterThan(0);
    expect(firstMoves(before, o1.pairAddress)).toEqual([]);
    // The next observation starts a price expansion: that is the first move.
    const o2 = obs(TOKEN_A, T0 + 30 * SEC, { ...hot, priceChange: { m5: 6 } });
    s = ingest(s, batch("realtime", T0 + 30 * SEC, [o2]));
    const first = firstMoves(eventsOf(s), o2.pairAddress);
    expect(first.map((x) => [x.event.type, x.event.onset])).toEqual([
      ["PRICE_EXPANSION", "OBSERVED"],
    ]);
  });

  it("chronological; same-observation onsets are flagged; PAIR_DISCOVERED is excluded", () => {
    const first = firstMoves(
      [
        ev("PAIR_DISCOVERED", T0, { direction: null }),
        ev("VOLUME_ACCELERATION", T0 + MIN),
        ev("PRICE_EXPANSION", T0 + MIN),
        ev("LIQUIDITY_CHANGE", T0 + 2 * MIN),
      ],
      "p",
    );
    expect(first.map((s) => s.event.type)).toEqual([
      "PRICE_EXPANSION",
      "VOLUME_ACCELERATION",
      "LIQUIDITY_CHANGE",
    ]);
    expect(first.map((s) => s.sameObservation)).toEqual([false, true, false]);
  });
});

describe("m1 — a lane recovery is per-asset only if the asset was observed after it", () => {
  it("LANE RECOVERED (lane context, no collision vote) until the asset is observed again", () => {
    let s = createSessionState(START);
    s = ingest(s, batch("realtime", T0, [obs(SOL_PAIR, T0)]));
    s = ingest(s, batch("realtime", T0 + 30 * SEC, [], { state: "failed" }));
    s = ingest(s, batch("realtime", T0 + 60 * SEC, []));
    const rec = eventsOf(s).find(
      (e) => e.type === "PROVIDER_RECOVERED" && e.horizon.kind === "LANE",
    )!;
    expect(isLaneOnly(rec)).toBe(true);
    expect(factLabel(rec)).toBe("LANE RECOVERED · REALTIME LANE");
    expect(collisionFamilies([rec])).toBeNull();

    s = ingest(s, batch("realtime", T0 + 90 * SEC, [obs(SOL_PAIR, T0 + 90 * SEC)]));
    const again = eventsOf(s).find((e) => e.id === rec.id)!;
    expect(isLaneOnly(again)).toBe(false);
    expect(factLabel(again)).toBe("PROVIDER RECOVERED · REALTIME LANE");
  });
});

describe("m2 — useNow's first frame is the current second, never a module-load value", () => {
  afterEach(() => vi.useRealTimers());
  it("without a running ticker the snapshot is the current wall second", () => {
    vi.useFakeTimers({ now: T0 + 10 * MIN + 1_234 });
    expect(nowSnapshot()).toBe(T0 + 10 * MIN + 1_000);
  });
});

describe("m3 — discovery wording", () => {
  it("PAIR_DISCOVERED reads ENTERED OBSERVED UNIVERSE everywhere", () => {
    expect(TYPE_TEXT.PAIR_DISCOVERED).toBe("ENTERED OBSERVED UNIVERSE");
    expect(changeText("PAIR_DISCOVERED", null)).toBe("ENTERED OBSERVED UNIVERSE");
  });
});

describe("N1 — a queue row says when its newest change's start was not seen", () => {
  it("in-progress at the first observation → newestOnset IN_PROGRESS_WHEN_OBSERVED; a seen onset → OBSERVED", () => {
    let s = createSessionState(START);
    const calm = { priceChange: { m5: 0.1 } };
    s = ingest(s, batch("realtime", T0, [obs(TOKEN_A, T0, { priceChange: { m5: 4 } })]));
    // Every condition here was already true at the first observation.
    expect(queueRow(eventsOf(s))!.newestOnset).toBe("IN_PROGRESS_WHEN_OBSERVED");

    let t = createSessionState(START);
    t = ingest(t, batch("realtime", T0, [obs(TOKEN_A, T0, calm)]));
    t = ingest(
      t,
      batch("realtime", T0 + 30 * SEC, [obs(TOKEN_A, T0 + 30 * SEC, { priceChange: { m5: 4 } })]),
    );
    expect(queueRow(eventsOf(t))).toMatchObject({
      newestType: "PRICE_EXPANSION",
      newestOnset: "OBSERVED",
    });
  });
});

describe("N2 — nothing dated inside a closed pause is recorded", () => {
  it("a cached observation / lane round from the pause is rejected on remount; later data is kept", () => {
    const store = new SessionStore();
    store.start(T0);
    store.ingest(batch("realtime", T0 + 10 * SEC, [obs(SOL_PAIR, T0 + 10 * SEC)]));
    store.pause(T0 + MIN);
    store.start(T0 + 10 * MIN);
    // The landing kept polling while the dashboard was closed: a cached round from the pause.
    store.ingest(batch("realtime", T0 + 5 * MIN, [obs(SOL_PAIR, T0 + 5 * MIN)]));
    const s = store.getState();
    expect(s.assets.get(SOL_KEY)!.observations.map((o) => o.observedAt)).toEqual([T0 + 10 * SEC]);
    expect(s.lanes.realtime.points.map((p) => p.at)).toEqual([T0 + 10 * SEC]);
    expect(s.rejected.paused).toBe(2);
    store.ingest(batch("realtime", T0 + 11 * MIN, [obs(SOL_PAIR, T0 + 11 * MIN)]));
    expect(store.getState().assets.get(SOL_KEY)!.observations).toHaveLength(2);
  });
});

describe("N3 — StrictMode's mount → unmount → mount replay", () => {
  it("leaves no visible pause and rejects nothing", () => {
    const store = new SessionStore();
    store.start(T0);
    store.pause(T0);
    store.start(T0);
    expect(recordingGaps(store.getState().recording)).toEqual([]);
    store.ingest(batch("realtime", T0, [obs(SOL_PAIR, T0)]));
    expect(store.getState().assets.size).toBe(1);
    expect(store.getState().rejected.paused).toBe(0);
  });
});
