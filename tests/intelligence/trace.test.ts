import { describe, expect, it } from "vitest";
import { extractAssetEvents } from "@/lib/intelligence/events";
import type { AssetObservation, SessionState } from "@/lib/intelligence/facts";
import { failureBatch } from "@/lib/intelligence/ingest";
import { EVENT_RULE_IDS } from "@/lib/intelligence/ruleRefs";
import { TRACE_WINDOWS_MS, ruleMeta } from "@/lib/intelligence/rules";
import { createSessionState, ingest } from "@/lib/intelligence/sessionHistory";
import {
  buildTrace,
  effectiveWindow,
  eventRules,
  factLabel,
  historySpan,
  offsetText,
  poolBreaks,
  ruleValueText,
  signedUsdText,
  traceWindows,
  usdText,
  valueText,
} from "@/lib/intelligence/trace";
import { MIN, SEC, SOL_KEY, SOL_PAIR, START, T0, TOKEN_A, batch, obs } from "./helpers";

type Over = Parameters<typeof obs>[2];

/** Ingest one realtime SOL observation per step, 30 s apart. */
function solSession(steps: Over[], at0 = T0): SessionState {
  let s = createSessionState(START);
  steps.forEach((over, i) => {
    const at = at0 + i * 30 * SEC;
    s = ingest(s, batch("realtime", at, [obs(SOL_PAIR, at, over)]));
  });
  return s;
}

// Calm baseline: no rule met (buy/sell 120/100 < 1.5, VA ≈ 2.26 < 3, |m5| < 3 %).
const CALM: Over = { priceChange: { m5: 0.2 }, txns: { m5: { buys: 120, sells: 100 } } };
const EXPAND: Over = { ...CALM, priceChange: { m5: 4.2 } };
const EXPAND_VA: Over = { ...EXPAND, volume: { m5: 400_000, h1: 1_700_000 } };

const tapeOf = (
  s: SessionState,
  key = SOL_KEY,
  w: Parameters<typeof buildTrace>[2] = "SESSION",
) => {
  const track = s.assets.get(key)!;
  return buildTrace(track, extractAssetEvents(track, s.lanes), w);
};

describe("trace windows — offered only when the session history spans them", () => {
  it("one observation: only SESSION; fixed windows disabled with the measured span", () => {
    const w = traceWindows({ from: T0, to: T0, spanMs: 0 });
    expect(w.map((o) => [o.id, o.enabled])).toEqual([
      ["5M", false],
      ["15M", false],
      ["1H", false],
      ["SESSION", true],
    ]);
    expect(w[0].reason).toBe("OBSERVED HISTORY OF THIS ASSET SPANS 00m 00s");
  });

  it("boundaries are inclusive: exactly 5 min spans 5M; 14m59s does not span 15M", () => {
    const w5 = traceWindows({ from: T0, to: T0 + TRACE_WINDOWS_MS["5M"], spanMs: 5 * MIN });
    expect(w5.find((o) => o.id === "5M")!.enabled).toBe(true);
    const w15 = traceWindows({ from: T0, to: T0, spanMs: 15 * MIN - SEC });
    expect(w15.find((o) => o.id === "15M")!.enabled).toBe(false);
    expect(w15.find((o) => o.id === "15M")!.reason).toContain("14m 59s");
    const w1h = traceWindows({ from: T0, to: T0, spanMs: 60 * MIN });
    expect(w1h.every((o) => o.enabled)).toBe(true);
  });

  it("no observation: nothing is offered", () => {
    expect(traceWindows(null).every((o) => !o.enabled)).toBe(true);
    expect(historySpan(null)).toBeNull();
  });

  it("an unspanned window falls back to SESSION (never pretends to more history)", () => {
    const w = traceWindows({ from: T0, to: T0, spanMs: 2 * MIN });
    expect(effectiveWindow(w, "15M")).toBe("SESSION");
    const s = solSession([CALM, CALM, EXPAND]);
    expect(tapeOf(s, SOL_KEY, "1H").window).toBe("SESSION");
  });
});

describe("trace — chronology of observed onsets", () => {
  it("orders onsets oldest first; the first OBSERVED structural onset is the gold anchor", () => {
    const s = solSession([CALM, CALM, EXPAND, EXPAND_VA, EXPAND_VA]);
    const t = tapeOf(s);
    const events = t.rows.flatMap((r) => (r.kind === "event" ? [r] : []));
    expect(events.map((r) => r.event.type)).toEqual(["PRICE_EXPANSION", "VOLUME_ACCELERATION"]);
    expect(events.map((r) => r.at)).toEqual([T0 + 60 * SEC, T0 + 90 * SEC]);
    expect(t.first!.type).toBe("PRICE_EXPANSION");
    expect(events[0].anchors).toEqual(["FIRST_IN_VIEW", "EDGE_CLOCK_ORIGIN"]);
    expect(events[1].anchors).toEqual([]);
    expect(events[1].offsetMs).toBe(30 * SEC);
    expect(t.sequence.map((x) => [x.family, x.offsetMs])).toEqual([
      ["PRICE", 0],
      ["VOLUME", 30 * SEC],
    ]);
    expect(t.inProgress).toBe(0);
  });

  it("the anchor time is a real observation time, never session start or the first observation", () => {
    const s = solSession([CALM, CALM, EXPAND]);
    const t = tapeOf(s);
    expect(t.first!.observedAt).toBe(T0 + 60 * SEC);
    expect(t.first!.observedAt).not.toBe(s.startedAt);
    expect(t.first!.observedAt).not.toBe(s.assets.get(SOL_KEY)!.firstSeenAt);
  });

  it("a condition already true at the first observation is IN PROGRESS: shown, counted, never an anchor or in the order", () => {
    const s = solSession([EXPAND, EXPAND, EXPAND]);
    const t = tapeOf(s);
    expect(t.rows).toHaveLength(1);
    expect(t.first).toBeNull();
    expect(t.origin).toBeNull();
    expect(t.sequence).toEqual([]);
    expect(t.inProgress).toBe(1);
    const r = t.rows[0];
    expect(r.kind === "event" && r.anchors).toEqual([]);
  });

  it("empty truth: calm observations produce no rows and no anchor", () => {
    const t = tapeOf(solSession([CALM, CALM, CALM]));
    expect(t.rows).toEqual([]);
    expect(t.first).toBeNull();
    expect(t.marketEvents + t.laneEvents).toBe(0);
    expect(t.span).toEqual({ from: T0, to: T0 + 60 * SEC, spanMs: 60 * SEC });
  });

  it("a 5M window keeps only onsets at or after end − 5 min (inclusive), end = newest real time", () => {
    const VA_ONLY: Over = { ...CALM, volume: { m5: 400_000, h1: 1_700_000 } };
    /** calm, expansion at `expandAt`, calm every 30 s, VA at T0 + 330 s (the end). */
    const session = (expandAt: number) => {
      let s = createSessionState(START);
      const points: [number, Over][] = [
        [T0, CALM],
        [expandAt, EXPAND],
      ];
      for (let at = expandAt + 30 * SEC; at < T0 + 330 * SEC; at += 30 * SEC)
        points.push([at, CALM]);
      points.push([T0 + 330 * SEC, VA_ONLY]);
      for (const [at, o] of points) s = ingest(s, batch("realtime", at, [obs(SOL_PAIR, at, o)]));
      return s;
    };
    const onEdge = tapeOf(session(T0 + 30 * SEC), SOL_KEY, "5M");
    expect(onEdge.window).toBe("5M");
    expect(onEdge.end).toBe(T0 + 330 * SEC);
    expect(onEdge.windowStart).toBe(T0 + 30 * SEC);
    expect(onEdge.rows.map((r) => r.at)).toEqual([T0 + 30 * SEC, T0 + 330 * SEC]);
    const justBefore = session(T0 + 29 * SEC);
    expect(tapeOf(justBefore, SOL_KEY, "5M").rows.map((r) => r.at)).toEqual([T0 + 330 * SEC]);
    expect(tapeOf(justBefore).rows.map((r) => r.at)).toEqual([T0 + 29 * SEC, T0 + 330 * SEC]);
  });

  it("provider failure and recovery are lane-context rows, never anchors or part of the order", () => {
    let s = solSession([CALM, CALM]);
    s = ingest(s, failureBatch("realtime", T0 + 45 * SEC, new Error("429"))!);
    const at = T0 + 60 * SEC;
    s = ingest(s, batch("realtime", at, [obs(SOL_PAIR, at, EXPAND)]));
    const t = tapeOf(s);
    const types = t.rows.map((r) => (r.kind === "event" ? r.event.type : "POOL"));
    expect(types).toEqual(["PROVIDER_STALE", "PRICE_EXPANSION", "PROVIDER_RECOVERED"]);
    const lane = t.rows.filter((r) => r.kind === "event" && r.laneContext);
    expect(lane).toHaveLength(2);
    expect(lane.every((r) => r.kind === "event" && r.anchors.length === 0)).toBe(true);
    expect(t.sequence.map((x) => x.family)).toEqual(["PRICE"]);
    expect(t.laneEvents).toBe(2);
    expect(t.marketEvents).toBe(1);
  });

  it("a pool switch is a visible break; the family order is restricted to the latest pool", () => {
    const B = "Pool2222222222222222222222222222222222222222";
    const calmT: Over = {
      priceChange: { m5: 0.1 },
      // Pace below the VA / TA rules: the provider's h1 dominates m5.
      volume: { m5: 100, h1: 4_000 },
      txns: { m5: { buys: 10, sells: 10 }, h1: { buys: 200, sells: 200 } },
      boostsActive: 10,
    };
    const hotT: Over = { ...calmT, priceChange: { m5: 6 } };
    const on = (pair: string | null, at: number, over: Over): AssetObservation =>
      obs(TOKEN_A, at, { ...over, pairAddress: pair }, "universe");
    const A = TOKEN_A.pairAddress!;
    let s = createSessionState(START);
    const seq: [string, Over][] = [
      [A, calmT],
      [A, hotT],
      [B, calmT],
      [B, hotT],
    ];
    seq.forEach(([p, o], i) => {
      const at = T0 + i * MIN;
      s = ingest(s, batch("universe", at, [on(p, at, o)]));
    });
    const key = [...s.assets.keys()][0];
    const t = tapeOf(s, key);
    const kinds = t.rows.map((r) => (r.kind === "pool" ? "POOL" : r.event.type));
    expect(kinds).toEqual(["PRICE_EXPANSION", "POOL", "PRICE_EXPANSION"]);
    const brk = t.rows.find((r) => r.kind === "pool")!;
    expect(brk.kind === "pool" && brk.pool).toMatchObject({
      at: T0 + 2 * MIN,
      fromPair: A,
      toPair: B,
    });
    expect(t.poolSwitches).toBe(1);
    expect(t.sequencePool).toBe(B);
    expect(t.sequence.map((x) => x.event.pairAddress)).toEqual([B]);
    // First in view is still the earliest observed onset (pool A), chronology only.
    expect(t.first!.pairAddress).toBe(A);
    expect(poolBreaks(s.assets.get(key)!.observations)).toHaveLength(1);
  });

  it("duplicate observations (same pair + time from both lanes) do not duplicate rows", () => {
    let s = solSession([CALM, CALM, EXPAND]);
    const at = T0 + 60 * SEC;
    s = ingest(s, batch("universe", at, [obs(SOL_PAIR, at, EXPAND, "universe")]));
    s = ingest(s, batch("realtime", at, [obs(SOL_PAIR, at, EXPAND)]));
    const t = tapeOf(s);
    expect(t.rows).toHaveLength(1);
    expect(new Set(t.rows.map((r) => r.key)).size).toBe(t.rows.length);
  });

  it("timestamp inversion: batches arriving out of order still give a chronological tape", () => {
    const steps: [number, Over][] = [
      [T0 + 60 * SEC, EXPAND],
      [T0, CALM],
      [T0 + 30 * SEC, CALM],
      [T0 + 90 * SEC, EXPAND_VA],
    ];
    let s = createSessionState(START);
    for (const [at, o] of steps) s = ingest(s, batch("realtime", at, [obs(SOL_PAIR, at, o)]));
    const t = tapeOf(s);
    const ats = t.rows.map((r) => r.at);
    expect([...ats].sort((a, b) => a - b)).toEqual(ats);
    expect(t.first?.observedAt ?? T0 + 60 * SEC).toBe(T0 + 60 * SEC);
  });

  it("is deterministic: the same session gives the same tape", () => {
    const s = solSession([CALM, CALM, EXPAND, EXPAND_VA]);
    expect(tapeOf(s)).toEqual(tapeOf(s));
  });
});

describe("trace — labels, numbers and rules (no interpretation, unknown stays —)", () => {
  it("every rule id an event type names resolves via ruleMeta, with threshold and horizon", () => {
    for (const [type, ids] of Object.entries(EVENT_RULE_IDS)) {
      for (const id of ids) expect(ruleMeta(id), `${type} → ${id}`).not.toBeNull();
    }
    const [pe] = eventRules("PRICE_EXPANSION");
    expect(pe.text).toBe("|PRICE M5| ≥ 3%");
    expect(pe.horizon).toBe("M5 (PROVIDER WINDOW)");
    expect(eventRules("VOLUME_ACCELERATION")[0].text).toBe("VOLUME PACE ≥ 3.0×");
    expect(eventRules("LIQUIDITY_CHANGE").map((r) => r.text)).toEqual([
      "|Δ LIQUIDITY| ≥ 10%",
      "|Δ LIQUIDITY| ≥ $10,000",
      "PREVIOUS LIQUIDITY ≥ $25,000",
      "OBSERVATIONS APART ≥ 5 MIN",
    ]);
    expect(eventRules("PROVIDER_STALE")).toEqual([]);
    expect(ruleValueText({ value: 8, unit: "TXNS" })).toBe("8 TXNS");
  });

  it("zero is data, unknown is —", () => {
    expect(usdText(0)).toBe("$0");
    expect(usdText(null)).toBe("—");
    expect(usdText(Number.NaN)).toBe("—");
    expect(signedUsdText(0)).toBe("$0");
    expect(signedUsdText(-12_300)).toBe("−$12.3K");
    expect(usdText(25_847_366.55)).toBe("$25.85M");
    expect(offsetText(null)).toBe("—");
    expect(offsetText(90 * SEC)).toBe("+01m 30s");
    expect(offsetText(-30 * SEC)).toBe("−00m 30s");
  });

  it("fact labels carry direction as a word and never causal or predictive wording", () => {
    const s = solSession([CALM, CALM, { ...CALM, priceChange: { m5: -4 } }, EXPAND_VA]);
    const track = s.assets.get(SOL_KEY)!;
    const events = extractAssetEvents(track, s.lanes);
    const labels = events.map((e) => `${factLabel(e)} ${valueText(e)}`);
    expect(labels).toContain("PRICE EXPANSION · DOWN −4.00% M5");
    for (const l of labels) {
      expect(l).not.toMatch(/CAUS|BECAUSE|LED TO|DROVE|BULL|BEAR|PREDICT|CONFIDEN|SCORE/i);
    }
  });
});
