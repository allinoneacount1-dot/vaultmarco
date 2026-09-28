import { describe, expect, it } from "vitest";
import { STRUCTURAL_TYPES } from "@/lib/intelligence/events";
import {
  DIVERGENCE_THRESHOLD_REFS,
  EVENT_RULE_IDS,
  EVENT_RULE_SUBJECT,
  TRACE_WINDOW_RULE_IDS,
  referencedRuleIds,
} from "@/lib/intelligence/ruleRefs";
import {
  DIVERGENCE_RULES,
  INTELLIGENCE_RULES,
  TRACE_WINDOWS_MS,
  ruleMeta,
} from "@/lib/intelligence/rules";
import { eventRules as momentEventRules } from "@/lib/intelligence/moment";
import { eventRules as traceEventRules, traceWindowMs } from "@/lib/intelligence/trace";

describe("rule references — one central event/predicate → rule mapping", () => {
  it("every referenced rule id is exported INTELLIGENCE_RULES metadata", () => {
    const ids = new Set(INTELLIGENCE_RULES.map((r) => r.id));
    for (const id of referencedRuleIds()) expect(ids.has(id), id).toBe(true);
  });

  it("every MARCOVAULT-thresholded event type names at least one rule, each with a subject", () => {
    const thresholded = [
      "PRICE_EXPANSION",
      "VOLUME_ACCELERATION",
      "TXN_ACCELERATION",
      "BUY_SELL_IMBALANCE",
      "LIQUIDITY_CHANGE",
      "BOOST_CHANGE",
    ] as const;
    for (const t of thresholded) {
      expect(STRUCTURAL_TYPES.has(t), t).toBe(true);
      expect(EVENT_RULE_IDS[t].length, t).toBeGreaterThan(0);
      for (const id of EVENT_RULE_IDS[t]) expect(EVENT_RULE_SUBJECT[id], id).toBeTruthy();
    }
    expect(EVENT_RULE_IDS.PROVIDER_STALE).toEqual([]);
    // Radar firings keep the Alpha Radar's own rule, recorded as it fired.
    expect(EVENT_RULE_IDS.MOMENTUM_FIRED).toEqual([]);
    expect(EVENT_RULE_IDS.RISK_FIRED).toEqual([]);
  });

  it("The Moment and Vault Trace read the same mapping (they can never disagree)", () => {
    for (const t of Object.keys(EVENT_RULE_IDS) as (keyof typeof EVENT_RULE_IDS)[]) {
      expect(momentEventRules(t).map((r) => r.id)).toEqual(EVENT_RULE_IDS[t]);
      expect(traceEventRules(t).map((r) => r.id)).toEqual(EVENT_RULE_IDS[t]);
    }
  });

  it("every divergence predicate has threshold references", () => {
    for (const d of DIVERGENCE_RULES) {
      expect(DIVERGENCE_THRESHOLD_REFS[d.id].length, d.id).toBeGreaterThan(0);
    }
  });

  it("trace windows come from rules metadata and equal the TRACE_WINDOWS_MS constants", () => {
    for (const [id, ruleId] of Object.entries(TRACE_WINDOW_RULE_IDS)) {
      const meta = ruleMeta(ruleId);
      expect(meta, ruleId).not.toBeNull();
      expect(meta!.unit).toBe("MS");
      expect(meta!.value).toBe(TRACE_WINDOWS_MS[id as keyof typeof TRACE_WINDOWS_MS]);
      expect(traceWindowMs(id as keyof typeof TRACE_WINDOWS_MS)).toBe(meta!.value);
    }
    expect(traceWindowMs("SESSION")).toBeNull();
  });
});
