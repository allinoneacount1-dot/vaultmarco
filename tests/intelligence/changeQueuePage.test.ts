import { describe, expect, it } from "vitest";
import { QUEUE_SORTS, queueRow, sortQueue } from "@/lib/intelligence/changeQueue";
import {
  QUEUE_SORT_META,
  buildQueueEntry,
  changeText,
  hasSortKey,
  laneView,
  pageLaneState,
  queueEntries,
  queueEntry,
  ratioText,
  sortKeyText,
  usdDeltaText,
} from "@/lib/intelligence/changeQueueView";
import { collisionFamilies } from "@/lib/intelligence/collision";
import { assetEvents } from "@/lib/intelligence/events";
import type { AssetObservation, SessionState } from "@/lib/intelligence/facts";
import { assetFreshness } from "@/lib/intelligence/freshness";
import { createSessionState, ingest } from "@/lib/intelligence/sessionHistory";
import { SESSION_MAX_ASSETS, staleAfterMs } from "@/lib/intelligence/rules";
import type { DexPair } from "@/lib/providers/schemas";
import {
  AERO_PAIR,
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
} from "./helpers";

/** Session built from real fixture payloads with provider-field overrides per round. */
function session(
  rounds: Array<{ lane?: "realtime" | "universe"; at: number; o: AssetObservation[] }>,
) {
  let s = createSessionState(START);
  for (const r of rounds) s = ingest(s, batch(r.lane ?? "realtime", r.at, r.o));
  return s;
}

/** No rule fires: flat m5 price, balanced m5 txns (the real fixture values otherwise). */
const calm = { priceChange: { m5: 0.1 }, txns: { m5: { buys: 10, sells: 10 } } };
const up = (m5: number) => ({ ...calm, priceChange: { m5 } });
const B58 = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const tag = (i: number) => B58[Math.floor(i / 24)] + B58[i % 24];

describe("change queue page — view model over the foundation queue", () => {
  it("only assets with a qualifying change are queued; order is exactly sortQueue's", () => {
    const s = session([
      { at: T0, o: [obs(SOL_PAIR, T0, calm), obs(WETH_PAIR, T0, calm), obs(AERO_PAIR, T0, calm)] },
      {
        at: T0 + 30 * SEC,
        o: [
          obs(SOL_PAIR, T0 + 30 * SEC, up(4)),
          obs(WETH_PAIR, T0 + 30 * SEC, up(-5)),
          obs(AERO_PAIR, T0 + 30 * SEC, calm),
        ],
      },
    ]);
    for (const sort of QUEUE_SORTS) {
      const entries = queueEntries(s.assets, s.lanes, sort);
      const rows = [...s.assets.values()]
        .map((t) => queueRow(assetEvents(t, s.lanes)))
        .filter((r) => r != null);
      expect(entries.map((e) => e.row.assetKey)).toEqual(
        sortQueue(rows, sort).map((r) => r.assetKey),
      );
    }
    const keys = queueEntries(s.assets, s.lanes, "NEWEST").map((e) => e.row.assetKey);
    expect(keys).toHaveLength(2);
    expect(keys).not.toContain("base:" + AERO_PAIR.baseToken.address.toLowerCase());
  });

  it("the newest change is the event queueRow chose, with its direction and observed onset", () => {
    const s = session([
      { at: T0, o: [obs(WETH_PAIR, T0, calm)] },
      { at: T0 + 30 * SEC, o: [obs(WETH_PAIR, T0 + 30 * SEC, up(-5))] },
    ]);
    const e = queueEntry(s.assets.get(WETH_KEY)!, s.lanes)!;
    expect(e.row.newestType).toBe("PRICE_EXPANSION");
    expect(e.newest.type).toBe(e.row.newestType);
    // The row names its event: no second lookup by (time, type) is needed.
    expect(e.newest.id).toBe(e.row.newestId);
    expect(e.row.newestDirection).toBe("DOWN");
    expect(e.newest.observedAt).toBe(e.row.newestAt);
    expect(e.newest.direction).toBe("DOWN");
    expect(e.newest.onset).toBe("OBSERVED");
    expect(changeText(e.newest.type, e.newest.direction)).toBe("PRICE EXPANSION · DOWN");
    // Observed time is the payload's receive time, never render time.
    expect(e.newest.observedAt).toBe(T0 + 30 * SEC);
  });

  it("families are counted in the rules window by the foundation's collisionFamilies", () => {
    const s = session([
      { at: T0, o: [obs(SOL_PAIR, T0, calm)] },
      {
        at: T0 + 30 * SEC,
        o: [obs(SOL_PAIR, T0 + 30 * SEC, { ...up(6), volume: { m5: 400_000, h1: 600_000 } })],
      },
    ]);
    const track = s.assets.get(SOL_KEY)!;
    const e = queueEntry(track, s.lanes)!;
    const c = collisionFamilies(
      assetEvents(track, s.lanes).filter((x) => x.family !== "PROVIDER"),
    )!;
    expect(e.familiesInWindow).toBe(c.count);
    expect(e.familiesInWindow).toBeGreaterThanOrEqual(2);
    expect([e.windowStart, e.windowEnd]).toEqual([c.windowStart, c.windowEnd]);
  });

  it("price and observed pool come from the latest real observation; unknown price is null, not 0", () => {
    const s = session([
      { at: T0, o: [obs(SOL_PAIR, T0, up(5))] },
      { at: T0 + 30 * SEC, o: [obs(SOL_PAIR, T0 + 30 * SEC, { ...up(5), priceUsd: null })] },
    ]);
    const e = queueEntry(s.assets.get(SOL_KEY)!, s.lanes)!;
    expect(e.priceUsd).toBeNull();
    expect(e.pairAddress).toBe(SOL_PAIR.pairAddress);
    expect(e.dexId).toBe(SOL_PAIR.dexId);
    const zero = session([{ at: T0, o: [obs(SOL_PAIR, T0, { ...up(5), priceUsd: 0 })] }]);
    expect(queueEntry(zero.assets.get(SOL_KEY)!, zero.lanes)!.priceUsd).toBe(0);
  });

  it("a provider-only asset never queues; the empty queue is empty (no synthetic row)", () => {
    let s = session([{ at: T0, o: [obs(SOL_PAIR, T0, calm)] }]);
    s = ingest(s, batch("realtime", T0 + 30 * SEC, [], { state: "failed", code: "RATE_LIMITED" }));
    s = ingest(s, batch("realtime", T0 + 60 * SEC, [obs(SOL_PAIR, T0 + 60 * SEC, calm)]));
    expect(assetEvents(s.assets.get(SOL_KEY)!, s.lanes).some((e) => e.family === "PROVIDER")).toBe(
      true,
    );
    expect(queueEntries(s.assets, s.lanes, "NEWEST")).toEqual([]);
    expect(
      queueEntries(createSessionState(START).assets, createSessionState(START).lanes, "NEWEST"),
    ).toEqual([]);
  });

  it("entries keep their identity when only the lanes changed (rows do not re-render)", () => {
    let s = session([{ at: T0, o: [obs(SOL_PAIR, T0, up(5))] }]);
    const a = queueEntry(s.assets.get(SOL_KEY)!, s.lanes);
    // Another asset's round changes `lanes` but not SOL's track or evidence.
    s = ingest(
      s,
      batch("universe", T0 + 10 * SEC, [obs(TOKEN_A, T0 + 10 * SEC, calm, "universe")]),
    );
    const b = queueEntry(s.assets.get(SOL_KEY)!, s.lanes);
    expect(b).toBe(a);
    // A new observation of SOL does produce a new entry.
    s = ingest(s, batch("realtime", T0 + 30 * SEC, [obs(SOL_PAIR, T0 + 30 * SEC, up(7))]));
    expect(queueEntry(s.assets.get(SOL_KEY)!, s.lanes)).not.toBe(a);
  });

  it("a stale asset keeps its row, and its freshness is STALE — never LIVE", () => {
    let s = session([{ at: T0, o: [obs(SOL_PAIR, T0, up(5))] }]);
    s = ingest(s, batch("realtime", T0 + 30 * SEC, [], { state: "failed", code: "TIMEOUT" }));
    const entries = queueEntries(s.assets, s.lanes, "NEWEST");
    expect(entries.map((e) => e.row.assetKey)).toEqual([SOL_KEY]);
    const f = assetFreshness(s.assets.get(SOL_KEY)!, s.lanes, T0 + 31 * SEC);
    expect(f.state).toBe("stale");
    // Vanished from the universe: the row stays, aging makes it STALE.
    const vanished = session([{ at: T0, o: [obs(SOL_PAIR, T0, up(5))] }]);
    expect(queueEntries(vanished.assets, vanished.lanes, "NEWEST")).toHaveLength(1);
    expect(
      assetFreshness(
        vanished.assets.get(SOL_KEY)!,
        vanished.lanes,
        T0 + staleAfterMs("realtime") + 1,
      ).state,
    ).toBe("stale");
  });
});

describe("change queue page — sort keys and captions", () => {
  const s = session([{ at: T0, o: [obs(SOL_PAIR, T0, up(5))] }]);
  const row = queueEntry(s.assets.get(SOL_KEY)!, s.lanes)!.row;

  it("rows lacking the key render '—' and are marked missing; 0 is data", () => {
    const r = { ...row, volumeAcceleration: null, liquidityChangeUsd: null };
    expect(sortKeyText(r, "LARGEST_VOLUME_ACCELERATION")).toBe("—");
    expect(sortKeyText(r, "LARGEST_LIQUIDITY_CHANGE")).toBe("—");
    expect(hasSortKey(r, "LARGEST_VOLUME_ACCELERATION")).toBe(false);
    expect(hasSortKey(r, "NEWEST")).toBe(true);
    const z = { ...row, volumeAcceleration: 0, liquidityChangeUsd: 0 };
    expect(sortKeyText(z, "LARGEST_VOLUME_ACCELERATION")).toBe("0.00×");
    expect(sortKeyText(z, "LARGEST_LIQUIDITY_CHANGE")).toBe("$0");
    expect(hasSortKey(z, "LARGEST_LIQUIDITY_CHANGE")).toBe(true);
    expect(sortKeyText(row, "MOST_EVENTS")).toBe(String(row.eventCount));
    expect(sortKeyText(row, "NEWEST")).toBeNull();
  });

  it("formats signed USD deltas and ratios without inventing values", () => {
    expect(usdDeltaText(-15_234)).toBe("−$15.2K");
    expect(usdDeltaText(2_500_000)).toBe("+$2.50M");
    expect(usdDeltaText(null)).toBe("—");
    expect(usdDeltaText(Number.NaN)).toBe("—");
    expect(ratioText(4.216)).toBe("4.22×");
    expect(ratioText(undefined)).toBe("—");
  });

  it("exactly four sorts, each with an honest caption; no merit vocabulary", () => {
    expect(QUEUE_SORTS).toEqual([
      "NEWEST",
      "MOST_EVENTS",
      "LARGEST_VOLUME_ACCELERATION",
      "LARGEST_LIQUIDITY_CHANGE",
    ]);
    expect(QUEUE_SORT_META.LARGEST_VOLUME_ACCELERATION.caption).toMatch(
      /volume-acceleration ratio, M5 vs H1 pace/,
    );
    expect(QUEUE_SORT_META.LARGEST_LIQUIDITY_CHANGE.caption).toMatch(/same observed pool/);
    for (const s of QUEUE_SORTS) {
      const m = QUEUE_SORT_META[s];
      expect(m.caption.length).toBeGreaterThan(40);
      expect(`${m.label} ${m.caption}`).not.toMatch(
        /score|rank|best|top pick|confidence|probab|bull|bear|predict/i,
      );
    }
  });
});

describe("change queue page — page-level lane state", () => {
  const lanesOf = (s: SessionState) => s.lanes;
  const empty = createSessionState(START);

  it("CONNECTING before any round; OFFLINE when every round failed without data", () => {
    expect(pageLaneState(empty.lanes, T0).state).toBe("loading");
    let s = ingest(empty, batch("realtime", T0, [], { state: "failed", code: "RATE_LIMITED" }));
    expect(pageLaneState(s.lanes, T0).state).toBe("offline");
    s = ingest(s, batch("universe", T0, [], { state: "failed", code: "TIMEOUT" }));
    expect(pageLaneState(s.lanes, T0).state).toBe("offline");
  });

  it("LIVE when both lanes are current; DEGRADED when one fails or is partial; STALE when none is current", () => {
    let s = session([
      { at: T0, o: [obs(SOL_PAIR, T0, calm)] },
      { lane: "universe", at: T0, o: [obs(TOKEN_A, T0, calm, "universe")] },
    ]);
    expect(pageLaneState(lanesOf(s), T0 + SEC).state).toBe("live");
    const failedRt = ingest(
      s,
      batch("realtime", T0 + 30 * SEC, [], { state: "failed", code: "RATE_LIMITED" }),
    );
    const v = pageLaneState(failedRt.lanes, T0 + 31 * SEC);
    expect(v.state).toBe("degraded");
    expect(v.lanes.find((l) => l.lane === "realtime")).toMatchObject({
      state: "stale",
      code: "RATE_LIMITED",
    });
    expect(v.lanes.find((l) => l.lane === "universe")!.state).toBe("live");
    const partial = ingest(s, batch("universe", T0 + 60 * SEC, [], { state: "partial" }));
    expect(pageLaneState(partial.lanes, T0 + 61 * SEC).state).toBe("degraded");
    s = ingest(
      failedRt,
      batch("universe", T0 + 60 * SEC, [], { state: "failed", code: "TIMEOUT" }),
    );
    expect(pageLaneState(s.lanes, T0 + 61 * SEC).state).toBe("stale");
  });

  it("a lane older than its freshness window is STALE even without a failure", () => {
    const s = session([{ at: T0, o: [obs(SOL_PAIR, T0, calm)] }]);
    expect(laneView("realtime", s.lanes.realtime, T0 + staleAfterMs("realtime")).state).toBe(
      "live",
    );
    expect(laneView("realtime", s.lanes.realtime, T0 + staleAfterMs("realtime") + 1).state).toBe(
      "stale",
    );
    expect(pageLaneState(s.lanes, T0 + 10 * MIN).state).toBe("stale");
  });
});

describe("change queue page — performance at the recorder's asset cap", () => {
  it(`builds and sorts ${SESSION_MAX_ASSETS} queued assets × 60 min of observations quickly`, () => {
    const pairs: DexPair[] = Array.from({ length: SESSION_MAX_ASSETS }, (_, i) => ({
      ...TOKEN_A,
      pairAddress: `Pair${tag(i)}`.padEnd(44, "x"),
      baseToken: { ...TOKEN_A.baseToken, address: `Asset${tag(i)}`.padEnd(44, "z") },
    }));
    let s = createSessionState(START);
    // 60 universe rounds (60 min at 60 s): alternating price expansion so events keep forming.
    for (let r = 0; r < 60; r++) {
      const at = T0 + r * MIN;
      s = ingest(
        s,
        batch(
          "universe",
          at,
          pairs.map((p, i) => obs(p, at, up(r % 2 === 0 ? 4 + (i % 5) : 0.2), "universe")),
        ),
      );
    }
    expect(s.assets.size).toBe(SESSION_MAX_ASSETS);
    const t0 = performance.now();
    const cold = queueEntries(s.assets, s.lanes, "NEWEST");
    const t1 = performance.now();
    for (const sort of QUEUE_SORTS) queueEntries(s.assets, s.lanes, sort);
    const t2 = performance.now();
    expect(cold).toHaveLength(SESSION_MAX_ASSETS);
    console.log(
      `CHANGE-QUEUE-PERF model: ${SESSION_MAX_ASSETS} assets × ${s.assets.values().next().value!.observations.length} obs — cold build ${(t1 - t0).toFixed(1)} ms; 4 sorts warm ${(t2 - t1).toFixed(1)} ms`,
    );
    // Generous bound: a lane round must not stall the page.
    expect(t1 - t0).toBeLessThan(1500);
    expect(t2 - t1).toBeLessThan(200);
    // buildQueueEntry (uncached) equals the memoized result.
    const t = [...s.assets.values()][0];
    expect(buildQueueEntry(t, s.lanes)).toEqual(queueEntry(t, s.lanes));
  });
});
