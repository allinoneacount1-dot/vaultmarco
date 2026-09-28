import { describe, expect, it } from "vitest";
import { evaluateDivergences } from "@/lib/intelligence/divergence";
import {
  DIVERGENCE_STATE_TEXT,
  DIVERGENCE_THRESHOLD_REFS,
  compactHorizon,
  metricText,
  orderDivergences,
  overlapNote,
  pairLabel,
  rawMetricRows,
  ruleValueText,
  summarizeDivergences,
  thresholdLines,
} from "@/lib/intelligence/divergenceView";
import { DIVERGENCE_RULES, INTELLIGENCE_RULES, ruleMeta } from "@/lib/intelligence/rules";
import { HYPE_PAIR, MIN, SEC, SOL_PAIR, T0, obs } from "./helpers";

/** Real SOL/USDC payload with m5 volume raised so VA ≥ 3 while price stays flat. */
const divergedSol = (at = T0) => obs(SOL_PAIR, at, { volume: { m5: 500_000 } });

describe("divergence page — ordering and states", () => {
  it("DIVERGED first, then ALIGNED, then NOT EVALUABLE; rules.ts order within a group", () => {
    const results = evaluateDivergences([divergedSol()]);
    const ordered = orderDivergences(results);
    const rank = { DIVERGED: 0, NOT_DIVERGED: 1, NOT_EVALUABLE: 2 } as const;
    for (let i = 1; i < ordered.length; i++) {
      const a = ordered[i - 1];
      const b = ordered[i];
      expect(rank[a.state]).toBeLessThanOrEqual(rank[b.state]);
      if (a.state === b.state) {
        const ia = DIVERGENCE_RULES.findIndex((r) => r.id === a.id);
        const ib = DIVERGENCE_RULES.findIndex((r) => r.id === b.id);
        expect(ia).toBeLessThan(ib);
      }
    }
    expect(ordered[0]).toMatchObject({ id: "PRICE_VS_VOLUME", state: "DIVERGED" });
    // Canonical payloads carry no boosts.active → NOT EVALUABLE, listed last.
    expect(ordered.at(-1)).toMatchObject({ id: "BOOST_VS_ACTIVITY", state: "NOT_EVALUABLE" });
    expect(ordered).toHaveLength(DIVERGENCE_RULES.length);
  });

  it("the unmodified captured SOL payload has no divergence: an honest none (ALIGNED / NOT EVALUABLE only)", () => {
    const s = summarizeDivergences(evaluateDivergences([obs(SOL_PAIR, T0)]));
    expect(s.DIVERGED).toBe(0);
    expect(s.NOT_DIVERGED).toBeGreaterThan(0);
    expect(s.total).toBe(DIVERGENCE_RULES.length);
    expect(DIVERGENCE_STATE_TEXT.NOT_DIVERGED).toBe("ALIGNED");
  });

  it("the pair label drops the state suffix; the state is shown separately", () => {
    expect(pairLabel("PRICE / VOLUME · DIVERGED")).toBe("PRICE / VOLUME");
    for (const r of DIVERGENCE_RULES) expect(pairLabel(r.label)).not.toContain("DIVERGED");
  });

  it("missing m5 / h1 → NOT EVALUABLE with the missing input named; never 0", () => {
    const o = obs(SOL_PAIR, T0, { volume: { m5: null, h1: null }, priceChange: { m5: null } });
    const results = evaluateDivergences([o]);
    const pv = results.find((r) => r.id === "PRICE_VS_VOLUME")!;
    expect(pv.state).toBe("NOT_EVALUABLE");
    expect(pv.missing).toBe("priceChange.m5");
    for (const m of pv.metrics) expect(metricText(m).value).toBe("—");
    const rows = rawMetricRows([o], results);
    expect(rows.find((r) => r.field === "volume.m5")).toMatchObject({ raw: null, value: "—" });
    expect(rows.find((r) => r.field === "volume.h1")).toMatchObject({ raw: null, value: "—" });
  });

  it("zero is data: a 0 % price change is flat (evaluable) and renders 0.00 %, not —", () => {
    const o = obs(SOL_PAIR, T0, {
      priceChange: { m5: 0 },
      volume: { m5: 500_000 },
      txns: { m5: { buys: 0, sells: 0 } },
    });
    const results = evaluateDivergences([o]);
    const pv = results.find((r) => r.id === "PRICE_VS_VOLUME")!;
    expect(pv.state).toBe("DIVERGED");
    expect(metricText(pv.metrics[0]).value).toBe("0.00%");
    const rows = rawMetricRows([o], results);
    expect(rows.find((r) => r.field === "priceChange.m5")!.value).toBe("0.00%");
    expect(rows.find((r) => r.field === "txns.m5.buys")).toMatchObject({ raw: 0, value: "0" });
    // 0 txns is below the sample guard → NOT EVALUABLE, never "balanced".
    const bal = results.find((r) => r.id === "BALANCE_VS_PRICE")!;
    expect(bal.state).toBe("NOT_EVALUABLE");
    expect(bal.missing).toMatch(/sample/);
  });

  it("HYPE (no liquidity in its payload): VOLUME / LIQUIDITY is NOT EVALUABLE and liquidity renders —", () => {
    const o = obs(HYPE_PAIR, T0);
    const results = evaluateDivergences([o]);
    expect(results.find((r) => r.id === "VOLUME_VS_LIQUIDITY")!.state).toBe("NOT_EVALUABLE");
    expect(rawMetricRows([o], results).find((r) => r.field === "liquidity.usd")!.value).toBe("—");
  });
});

describe("divergence page — metrics, horizons and thresholds come from rules.ts", () => {
  it("each metric reads value + horizon, e.g. a pace ratio against M5 vs H1 − M5", () => {
    const pv = evaluateDivergences([divergedSol()]).find((r) => r.id === "PRICE_VS_VOLUME")!;
    const [price, va] = pv.metrics.map(metricText);
    expect(price).toMatchObject({ name: "PRICE CHANGE", value: "−0.07%", horizon: "M5" });
    expect(va.name).toBe("VOLUME ACCELERATION");
    expect(va.value).toMatch(/^\d+\.\d{2}×$/);
    expect(va.horizon).toBe("PACE · M5 VS H1−M5");
    expect(va.fullHorizon).toBe(DIVERGENCE_RULES[0].metrics[1].horizon);
  });

  it("every predicate lists its thresholds, and each value is the rules.ts value (no copies)", () => {
    for (const rule of DIVERGENCE_RULES) {
      const refs = DIVERGENCE_THRESHOLD_REFS[rule.id];
      expect(refs.length, rule.id).toBeGreaterThan(0);
      const lines = thresholdLines(rule.id);
      expect(lines).toHaveLength(refs.length);
      for (const [i, ref] of refs.entries()) {
        const meta = ruleMeta(ref.ruleId);
        expect(meta, ref.ruleId).not.toBeNull();
        expect(lines[i].text).toContain(ruleValueText(meta!));
        expect(lines[i].horizon).toBe(meta!.horizon.toUpperCase());
        // The constant is one the predicate (or its metric horizons) actually names.
        const named = `${rule.predicate} ${rule.metrics.map((m) => m.horizon).join(" ")}`;
        if (ref.ruleId !== "SESSION_DELTA_MAX_SPAN_MS")
          expect(named, rule.id).toContain(ref.ruleId);
      }
    }
    expect(thresholdLines("PRICE_VS_VOLUME").map((l) => l.text)).toEqual([
      "VA ≥ 3.0×",
      "|PRICE M5| < 0.5%",
    ]);
  });

  it("every referenced rule id is exported metadata", () => {
    const ids = new Set(INTELLIGENCE_RULES.map((r) => r.id));
    for (const refs of Object.values(DIVERGENCE_THRESHOLD_REFS)) {
      for (const r of refs) expect(ids.has(r.ruleId), r.ruleId).toBe(true);
    }
  });

  it("the overlap caveat (m5 ⊂ h1) is carried from rules.ts for the pace predicates", () => {
    expect(overlapNote("PRICE_VS_VOLUME")).toContain("m5 ⊂ h1");
    expect(overlapNote("VOLUME_VS_LIQUIDITY")).toContain("different horizons");
  });

  it("compact horizons keep unknown strings verbatim", () => {
    expect(compactHorizon("M5 (provider window, counts not USD)")).toBe("M5");
    expect(compactHorizon("SOMETHING ELSE")).toBe("SOMETHING ELSE");
  });
});

describe("divergence page — raw metrics and session deltas", () => {
  it("a session-delta predicate adds the earlier SAME-POOL observation it compared with", () => {
    const a = obs(SOL_PAIR, T0, { volume: { m5: 500_000 } });
    const b = obs(SOL_PAIR, T0 + 6 * MIN, { volume: { m5: 500_000 }, liquidityUsd: 20_000_000 });
    const results = evaluateDivergences([a, b]);
    const vl = results.find((r) => r.id === "VOLUME_VS_LIQUIDITY")!;
    expect(vl.state).toBe("DIVERGED");
    expect(vl.priorObservedAt).toBe(T0);
    const prior = rawMetricRows([a, b], results).find((r) => r.field.startsWith("liquidity.usd ("));
    expect(prior).toMatchObject({ observedAt: T0, raw: a.snapshot.liquidityUsd });
  });

  it("a pool switch: no earlier-pool row is ever shown, the delta predicate is NOT EVALUABLE", () => {
    const a = obs(SOL_PAIR, T0);
    const b = obs(SOL_PAIR, T0 + 6 * MIN, {
      pairAddress: "OtherPool1111111111111111111111111111111111",
    });
    const results = evaluateDivergences([a, b]);
    expect(results.find((r) => r.id === "VOLUME_VS_LIQUIDITY")!.state).toBe("NOT_EVALUABLE");
    const rows = rawMetricRows([a, b], results);
    expect(rows.every((r) => r.observedAt === b.observedAt)).toBe(true);
  });

  it("a duplicate observation (same pool, same time) changes nothing", () => {
    const a = divergedSol(T0);
    const once = evaluateDivergences([a]);
    const twice = evaluateDivergences([a, divergedSol(T0 + 30 * SEC)]);
    expect(twice.map((r) => r.state)).toEqual(once.map((r) => r.state));
  });

  it("no input, no rows", () => {
    expect(rawMetricRows([], [])).toEqual([]);
    expect(orderDivergences([])).toEqual([]);
  });

  it("no interpretation vocabulary anywhere the page prints", () => {
    const results = evaluateDivergences([divergedSol()]);
    const text = [
      ...Object.values(DIVERGENCE_STATE_TEXT),
      ...results.map((r) => pairLabel(r.label)),
      ...results.flatMap((r) => r.metrics.map((m) => Object.values(metricText(m)).join(" "))),
      ...DIVERGENCE_RULES.flatMap((r) => thresholdLines(r.id).map((l) => `${l.text} ${l.horizon}`)),
      ...rawMetricRows([divergedSol()], results).map((r) => `${r.field} ${r.horizon}`),
    ].join("\n");
    expect(text).not.toMatch(
      /accumulat|distribut|bull|bear|buying|selling|confiden|score|predict/i,
    );
  });
});
