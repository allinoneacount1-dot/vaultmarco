import { describe, expect, it } from "vitest";
import { extractAssetEvents } from "@/lib/intelligence/events";
import type { SessionState } from "@/lib/intelligence/facts";
import { failureBatch } from "@/lib/intelligence/ingest";
import { createSessionState, ingest } from "@/lib/intelligence/sessionHistory";
import { edgeClockModel } from "@/lib/intelligence/edgeClock";
import { sinceText } from "@/lib/intelligence/trace";
import { MIN, SEC, SOL_KEY, SOL_PAIR, START, T0, batch, obs } from "./helpers";

type Over = Parameters<typeof obs>[2];

function solSession(steps: Over[]): SessionState {
  let s = createSessionState(START);
  steps.forEach((over, i) => {
    const at = T0 + i * 30 * SEC;
    s = ingest(s, batch("realtime", at, [obs(SOL_PAIR, at, over)]));
  });
  return s;
}

const modelOf = (s: SessionState) => {
  const track = s.assets.get(SOL_KEY)!;
  return edgeClockModel(track, extractAssetEvents(track, s.lanes));
};

const CALM: Over = {
  priceUsd: 100,
  priceChange: { m5: 0.2 },
  txns: { m5: { buys: 120, sells: 100 } },
};
const EXPAND: Over = { ...CALM, priceUsd: 104, priceChange: { m5: 4 } };
const metric = (m: ReturnType<typeof modelOf>, id: string) => m.since.find((x) => x.id === id)!;

describe("edge clock page core — origin and evidence since it", () => {
  it("origin = the observation where the change was first seen; since-deltas compare it with the latest same-pool observation", () => {
    const s = solSession([
      CALM,
      CALM,
      EXPAND,
      { ...EXPAND, priceUsd: 110, priceChange: { m5: 5 }, liquidityUsd: 26_000_000 },
    ]);
    const m = modelOf(s);
    expect(m.origin).toMatchObject({ type: "PRICE_EXPANSION", observedAt: T0 + 60 * SEC });
    expect(m.originObs!.observedAt).toBe(T0 + 60 * SEC);
    expect(m.previousObs!.observedAt).toBe(T0 + 30 * SEC);
    expect(m.latestObs!.observedAt).toBe(T0 + 90 * SEC);
    expect(m.samePool).toBe(true);
    expect(m.sinceBlocked).toBeNull();
    const price = metric(m, "PRICE");
    expect(price).toMatchObject({ from: 104, to: 110, delta: 6 });
    expect(price.deltaPct).toBeCloseTo((6 / 104) * 100, 10);
    expect(sinceText(price).delta).toBe("+5.77%");
    const liq = metric(m, "LIQUIDITY");
    expect(liq.from).toBe(SOL_PAIR.liquidity!.usd);
    expect(liq.delta).toBeCloseTo(26_000_000 - SOL_PAIR.liquidity!.usd!, 2);
    expect(m.observedActiveMs).toBe(30 * SEC);
  });

  it("missing on either side → no delta ('—'); canonical pools carry no boosts", () => {
    const s = solSession([CALM, CALM, EXPAND, { ...EXPAND, liquidityUsd: null }]);
    const m = modelOf(s);
    const liq = metric(m, "LIQUIDITY");
    expect(liq.delta).toBeNull();
    expect(liq.missing).toBe("NOT REPORTED AT THE LATEST OBSERVATION");
    expect(sinceText(liq)).toMatchObject({ to: "—", delta: "—" });
    const boosts = metric(m, "BOOSTS");
    expect(boosts).toMatchObject({ from: null, to: null, delta: null });
    expect(sinceText(boosts).delta).toBe("—");
  });

  it("zero is data: a real 0 on both sides is a 0 delta, not '—'", () => {
    const zero: Over = { ...EXPAND, volume: { m5: 0 } };
    const s = solSession([CALM, CALM, zero, zero]);
    const v = metric(modelOf(s), "VOLUME_M5");
    expect(v).toMatchObject({ from: 0, to: 0, delta: 0, deltaPct: null });
    expect(sinceText(v)).toMatchObject({ from: "$0", to: "$0", delta: "$0" });
  });

  it("origin is the latest observation → no delta yet (never a self-comparison)", () => {
    const m = modelOf(solSession([CALM, CALM, EXPAND]));
    expect(m.origin).not.toBeNull();
    expect(m.sinceBlocked).toBe("NO LATER OBSERVATION YET");
    expect(m.since.every((x) => x.delta == null)).toBe(true);
  });

  it("independent families since the origin: one vote per family, provider events excluded", () => {
    const VA: Over = { ...EXPAND, volume: { m5: 400_000, h1: 1_700_000 } };
    let s = solSession([CALM, CALM, EXPAND, VA, VA]);
    s = ingest(s, failureBatch("realtime", T0 + 130 * SEC, new Error("429"))!);
    const at = T0 + 150 * SEC;
    s = ingest(s, batch("realtime", at, [obs(SOL_PAIR, at, VA)]));
    const m = modelOf(s);
    expect(m.origin!.type).toBe("PRICE_EXPANSION");
    expect(m.families!.count).toBe(2);
    expect(m.families!.families.map((f) => f.family)).toEqual(["PRICE", "VOLUME"]);
    expect(m.sinceEvents.every((e) => e.family !== "PROVIDER")).toBe(true);
  });

  it("the origin never moves while the move holds, whatever time it is rendered", () => {
    const steps = [CALM, CALM, EXPAND, EXPAND];
    const first = modelOf(solSession(steps)).origin!;
    const later = modelOf(solSession([...steps, EXPAND, EXPAND, EXPAND])).origin!;
    expect(later.observedAt).toBe(first.observedAt);
    expect(later.id).toBe(first.id);
  });

  it("no qualifying change → no origin and no since evidence (never page load / session start / first observation)", () => {
    const m = modelOf(solSession([CALM, CALM, CALM]));
    expect(m.origin).toBeNull();
    expect(m.earlier).toBeNull();
    expect(m.since).toEqual([]);
    expect(m.families).toBeNull();
  });

  it("already in progress at first observation → listed, never an origin", () => {
    const m = modelOf(solSession([EXPAND, EXPAND]));
    expect(m.origin).toBeNull();
    expect(m.inProgress.map((e) => e.type)).toEqual(["PRICE_EXPANSION"]);
  });

  it("an earlier, now-inactive change is secondary context, distinct from the active origin", () => {
    const DOWN: Over = { ...CALM, priceChange: { m5: -4 } };
    const s = solSession([CALM, EXPAND, CALM, CALM, DOWN, DOWN]);
    const m = modelOf(s);
    expect(m.origin).toMatchObject({ direction: "DOWN", observedAt: T0 + 120 * SEC });
    expect(m.earlier).toMatchObject({ direction: "UP", observedAt: T0 + 30 * SEC, active: false });
  });

  it("ended move with nothing active → origin null, earlier kept for context", () => {
    const m = modelOf(solSession([CALM, EXPAND, CALM]));
    expect(m.origin).toBeNull();
    expect(m.earlier).toMatchObject({ type: "PRICE_EXPANSION", active: false });
  });

  it("a gap longer than the run gap breaks the run: the later expansion is in progress, not an origin", () => {
    let s = solSession([CALM, CALM]);
    const at = T0 + 30 * SEC + 10 * MIN;
    s = ingest(s, batch("realtime", at, [obs(SOL_PAIR, at, EXPAND)]));
    const m = modelOf(s);
    expect(m.origin).toBeNull();
    expect(m.inProgress).toHaveLength(1);
  });
});
