import { describe, expect, it } from "vitest";
import { collisionFamilies } from "@/lib/intelligence/collision";
import { evaluateDivergences } from "@/lib/intelligence/divergence";
import { edgeClockOrigin } from "@/lib/intelligence/edgeClock";
import {
  EVENT_FAMILY,
  type EventType,
  type EvidenceEvent,
  STRUCTURAL_TYPES,
  extractAssetEvents,
} from "@/lib/intelligence/events";
import type { SessionState } from "@/lib/intelligence/facts";
import { EVENT_RULE_IDS } from "@/lib/intelligence/ruleRefs";
import {
  MOMENT_FIRST_MOVES,
  activeChanges,
  collisionSummary,
  directionText,
  divergenceSummary,
  edgeSummary,
  eventRules,
  eventValueText,
  evidenceLines,
  firstMoves,
  pickerRows,
  ruleThresholdText,
} from "@/lib/intelligence/moment";
import { INTELLIGENCE_RULES_VERSION, ruleMeta } from "@/lib/intelligence/rules";
import { createSessionState, ingest } from "@/lib/intelligence/sessionHistory";
import {
  HYPE_PAIR,
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

/** SOL rounds: m5 price flat → +4.2 % (observed onset), volume pace jumps, buys > sells throughout. */
function solSession(rounds = 4): SessionState {
  let s = createSessionState(START);
  for (let i = 0; i < rounds; i++) {
    const at = T0 + i * 30 * SEC;
    const over =
      i === 0 ? {} : { priceChange: { m5: 4.2 }, volume: { m5: 500_000, h1: 1_686_315.7 } };
    s = ingest(s, batch("realtime", at, [obs(SOL_PAIR, at, over)]));
  }
  return s;
}

const solEvents = (s: SessionState) => extractAssetEvents(s.assets.get(SOL_KEY)!, s.lanes);

function ev(type: EventType, at: number, over: Partial<EvidenceEvent> = {}): EvidenceEvent {
  return {
    id: `${type}|${SOL_KEY}|p|${at}|-`,
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

describe("moment — WHAT CHANGED (active evidence only)", () => {
  it("lists the active structural events, newest onset first, with observed vs in-progress onsets", () => {
    const events = solEvents(solSession());
    const changes = activeChanges(events);
    const types = changes.map((e) => e.type);
    expect(types).toContain("PRICE_EXPANSION");
    expect(types).toContain("VOLUME_ACCELERATION");
    expect(types).toContain("BUY_SELL_IMBALANCE");
    for (const e of changes) {
      expect(e.active).toBe(true);
      expect(STRUCTURAL_TYPES.has(e.type)).toBe(true);
    }
    for (let i = 1; i < changes.length; i++) {
      expect(changes[i - 1].observedAt).toBeGreaterThanOrEqual(changes[i].observedAt);
    }
    const price = changes.find((e) => e.type === "PRICE_EXPANSION")!;
    expect(price).toMatchObject({ onset: "OBSERVED", direction: "UP", value: 4.2 });
    expect(price.observedAt).toBe(T0 + 30 * SEC);
    // Already true in the first observation: its start was not seen.
    expect(changes.find((e) => e.type === "BUY_SELL_IMBALANCE")!.onset).toBe(
      "IN_PROGRESS_WHEN_OBSERVED",
    );
  });

  it("a change that stopped holding is not listed; provider and discovery events never are", () => {
    let s = solSession(3);
    const at = T0 + 3 * 30 * SEC;
    s = ingest(s, batch("realtime", at, [obs(SOL_PAIR, at, { priceChange: { m5: 0.1 } })]));
    s = ingest(s, { lane: "realtime", at: at + 30 * SEC, state: "failed", observations: [] });
    const events = solEvents(s);
    expect(events.some((e) => e.type === "PRICE_EXPANSION")).toBe(true);
    expect(events.some((e) => e.family === "PROVIDER")).toBe(true);
    const changes = activeChanges(events);
    expect(changes.some((e) => e.type === "PRICE_EXPANSION")).toBe(false);
    expect(changes.some((e) => e.family === "PROVIDER" || e.type === "PAIR_DISCOVERED")).toBe(
      false,
    );
  });

  it("empty session → no change (the honest empty state), never a fabricated row", () => {
    expect(activeChanges([])).toEqual([]);
    const s = solSession(1);
    // One flat-price observation: only the in-progress imbalance can be active.
    expect(activeChanges(solEvents(s)).map((e) => e.type)).toEqual(["BUY_SELL_IMBALANCE"]);
  });
});

describe("moment — rule metadata shown next to the evidence", () => {
  it("every thresholded event type maps to rules.ts metadata whose value is the event's threshold", () => {
    const events = activeChanges(solEvents(solSession()));
    for (const e of events) {
      const rules = eventRules(e.type);
      if (e.threshold == null) continue;
      expect(rules.length, e.type).toBeGreaterThan(0);
      expect(rules[0].value, e.type).toBe(e.threshold);
      expect(rules[0].horizon.length).toBeGreaterThan(0);
    }
    for (const [type, ids] of Object.entries(EVENT_RULE_IDS)) {
      for (const id of ids) expect(ruleMeta(id), `${type} → ${id}`).not.toBeNull();
    }
  });

  it("threshold text reads the rule's own value and unit", () => {
    expect(ruleThresholdText(ruleMeta("PRICE_EXPANSION_M5_PCT")!)).toBe("≥ 3%");
    expect(ruleThresholdText(ruleMeta("VOLUME_ACCELERATION_MIN")!)).toBe("≥ 3×");
    expect(ruleThresholdText(ruleMeta("LIQUIDITY_CHANGE_MIN_REL")!)).toBe("≥ 10%");
    expect(ruleThresholdText(ruleMeta("LIQUIDITY_CHANGE_MIN_ABS_USD")!)).toBe("≥ $10K");
    expect(ruleThresholdText(ruleMeta("IMBALANCE_MIN_SAMPLE_TXNS")!)).toBe("≥ 8 TXNS");
    expect(eventRules("MOMENTUM_FIRED")).toEqual([]);
    expect(eventRules("PROVIDER_STALE")).toEqual([]);
  });
});

describe("moment — numbers: 0 is data, unknown is —", () => {
  it("event values keep a real zero and never turn null into 0", () => {
    expect(eventValueText({ unit: "PCT", value: 0 })).toBe("0.00%");
    expect(eventValueText({ unit: "USD", value: 0 })).toBe("$0");
    expect(eventValueText({ unit: "COUNT", value: 0 })).toBe("0");
    expect(eventValueText({ unit: "RATIO", value: null })).toBe("—");
    expect(eventValueText({ unit: "PCT", value: Number.NaN })).toBe("—");
    expect(eventValueText({ unit: "PCT", value: -4.2 })).toBe("−4.20%");
  });

  it("evidence lines keep zeros, show — for nulls, and hide timestamps", () => {
    const e = ev("VOLUME_ACCELERATION", T0, {
      unit: "RATIO",
      evidence: { volumeM5: 0, volumeH1: null, previousMinutes: 55, priorObservedAt: T0 - MIN },
    });
    const lines = evidenceLines(e);
    expect(lines.map((l) => [l.label, l.text])).toEqual([
      ["VOLUME M5", "$0"],
      ["VOLUME H1", "—"],
      ["PREVIOUS SPAN", "55 MIN"],
    ]);
  });
});

describe("moment — wording", () => {
  it("imbalance is a count comparison, never an instruction; no bull/bear vocabulary", () => {
    expect(directionText("BUY_SELL_IMBALANCE", "BUY")).toBe("BUYS > SELLS");
    expect(directionText("BUY_SELL_IMBALANCE", "SELL")).toBe("SELLS > BUYS");
    expect(directionText("LIQUIDITY_CHANGE", "REMOVED")).toBe("LIQUIDITY REMOVED");
    expect(directionText("PRICE_EXPANSION", null)).toBe("—");
    const all = (["UP", "DOWN", "BUY", "SELL", "ADDED", "REMOVED"] as const).flatMap((d) =>
      (Object.keys(EVENT_FAMILY) as EventType[]).map((t) => directionText(t, d)),
    );
    for (const w of all) expect(w).not.toMatch(/bull|bear|buy now|sell now|signal to/i);
  });
});

describe("moment — supporting summaries use only the foundation", () => {
  it("WHAT MOVED FIRST: first OBSERVED onset per family on the pool, chronological — the Trace sequence", () => {
    const pool = ev("PRICE_EXPANSION", T0).pairAddress;
    const events = [
      ev("PROVIDER_STALE", T0),
      ...Array.from({ length: 8 }, (_, i) =>
        ev(i % 2 ? "VOLUME_ACCELERATION" : "PRICE_EXPANSION", T0 + (i + 1) * SEC),
      ),
    ];
    const first = firstMoves(events, pool);
    expect(first.map((s) => s.family)).toEqual(["PRICE", "VOLUME"]);
    expect(first.map((s) => s.event.observedAt)).toEqual([T0 + SEC, T0 + 2 * SEC]);
    expect(first.every((s) => s.event.family !== "PROVIDER")).toBe(true);
    expect(firstMoves(events, pool, 1)).toHaveLength(1);
    expect(MOMENT_FIRST_MOVES).toBeGreaterThan(0);
    expect(firstMoves([], pool)).toEqual([]);
  });

  it("EDGE AGE is the Edge Clock origin's age; none when nothing structural was observed starting", () => {
    const events = solEvents(solSession());
    const now = T0 + 5 * MIN;
    const edge = edgeSummary(events, now);
    const origin = edgeClockOrigin(events)!;
    expect(edge).toEqual({ kind: "ORIGIN", origin, ageMs: now - origin.observedAt });
    // One observation: the imbalance is in progress, so there is no origin.
    expect(edgeSummary(solEvents(solSession(1)), now)).toEqual({ kind: "NONE" });
    // An age is never negative (clock skew between observation and render).
    const early = edgeSummary(events, origin.observedAt - 10 * SEC);
    expect(early.kind === "ORIGIN" && early.ageMs).toBe(0);
  });

  it("DIVERGENCES counts every predicate state, NOT_EVALUABLE included (HYPE has no liquidity)", () => {
    let s = createSessionState(START);
    s = ingest(s, batch("realtime", T0, [obs(HYPE_PAIR, T0)]));
    const track = [...s.assets.values()][0];
    const results = evaluateDivergences(track.observations);
    const d = divergenceSummary(results);
    expect(d.rows).toHaveLength(results.length);
    expect(d.counts.DIVERGED + d.counts.NOT_DIVERGED + d.counts.NOT_EVALUABLE).toBe(results.length);
    expect(d.rows.find((r) => r.id === "VOLUME_VS_LIQUIDITY")!.state).toBe("NOT_EVALUABLE");
    expect(d.rows.find((r) => r.id === "BOOST_VS_ACTIVITY")!.state).toBe("NOT_EVALUABLE");
    expect(divergenceSummary([]).rows).toEqual([]);
  });

  it("COLLISION is exactly collisionFamilies over the rules window", () => {
    const events = solEvents(solSession());
    expect(collisionSummary(events)).toEqual(collisionFamilies(events));
    expect(collisionSummary([])).toBeNull();
  });
});

describe("moment — no-selection quick picker", () => {
  it("lists observed assets with real qualifying events, newest event first, identity by chain + address", () => {
    let s = createSessionState(START);
    // WETH: m5 txns 5/5 — no qualifying event in a single flat observation.
    s = ingest(s, batch("realtime", T0, [obs(SOL_PAIR, T0), obs(WETH_PAIR, T0)]));
    const at = T0 + 30 * SEC;
    s = ingest(
      s,
      batch("realtime", at, [obs(SOL_PAIR, at), obs(WETH_PAIR, at, { priceChange: { m5: -3.5 } })]),
    );
    const rows = pickerRows(s.assets, s.lanes);
    expect(rows.map((r) => r.assetKey)).toEqual([WETH_KEY, SOL_KEY]);
    expect(rows[0]).toMatchObject({ symbol: "WETH", newestType: "PRICE_EXPANSION" });
    expect(pickerRows(s.assets, s.lanes, 1)).toHaveLength(1);
  });

  it("two assets sharing a symbol stay two rows (never identified by symbol)", () => {
    let s = createSessionState(START);
    const twin = { ...TOKEN_A, baseToken: { ...TOKEN_A.baseToken, symbol: "SOL" } };
    s = ingest(s, batch("realtime", T0, [obs(SOL_PAIR, T0)]));
    s = ingest(s, batch("universe", T0 + SEC, [obs(twin, T0 + SEC, {}, "universe")]));
    const at = T0 + 30 * SEC;
    s = ingest(s, batch("universe", at, [obs(twin, at, { priceChange: { m5: 5 } }, "universe")]));
    const rows = pickerRows(s.assets, s.lanes);
    const sols = rows.filter((r) => r.symbol === "SOL");
    expect(new Set(sols.map((r) => r.assetKey)).size).toBe(sols.length);
    expect(sols.length).toBe(2);
  });
});
