import type { EventType } from "./events";
import type { DivergenceId } from "./rules";

/**
 * RULE REFERENCES — the one place that says WHICH rules.ts constants each
 * piece of evidence was evaluated against. Pages read the values through
 * `ruleMeta(id)` (rules.ts); nothing numeric is restated here, only ids and
 * the comparison wording that goes next to them.
 *
 * Guarded by tests: every id below must be exported INTELLIGENCE_RULES
 * metadata, so a renamed or removed rule cannot silently drop a threshold
 * from the page that shows it.
 */

/**
 * The rules.ts ids each evidence-event type is evaluated with, primary first.
 * Radar firings use the Alpha Radar's own deterministic rule (recorded as it
 * fired); discovery and provider events use no threshold, so they map to no
 * rule.
 */
export const EVENT_RULE_IDS: Record<EventType, readonly string[]> = {
  PRICE_EXPANSION: ["PRICE_EXPANSION_M5_PCT"],
  VOLUME_ACCELERATION: ["VOLUME_ACCELERATION_MIN"],
  TXN_ACCELERATION: ["TXN_ACCELERATION_MIN"],
  BUY_SELL_IMBALANCE: ["IMBALANCE_MIN_RATIO", "IMBALANCE_MIN_SAMPLE_TXNS"],
  LIQUIDITY_CHANGE: [
    "LIQUIDITY_CHANGE_MIN_REL",
    "LIQUIDITY_CHANGE_MIN_ABS_USD",
    "LIQUIDITY_CHANGE_MIN_PREVIOUS_USD",
    "LIQUIDITY_CHANGE_LOOKBACK_MINUTES",
  ],
  BOOST_CHANGE: ["BOOST_CHANGE_MIN_DELTA"],
  PAIR_DISCOVERED: [],
  MOMENTUM_FIRED: [],
  RISK_FIRED: [],
  PROVIDER_RECOVERED: [],
  PROVIDER_STALE: [],
};

/**
 * What an event rule compares, worded as the subject + operator that precede
 * the rule's value (e.g. "|PRICE M5| ≥" + "3%").
 */
export const EVENT_RULE_SUBJECT: Record<string, string> = {
  PRICE_EXPANSION_M5_PCT: "|PRICE M5| ≥",
  VOLUME_ACCELERATION_MIN: "VOLUME PACE ≥",
  TXN_ACCELERATION_MIN: "TXN PACE ≥",
  IMBALANCE_MIN_RATIO: "BUY/SELL RATIO ≥",
  IMBALANCE_MIN_SAMPLE_TXNS: "M5 SAMPLE ≥",
  LIQUIDITY_CHANGE_MIN_REL: "|Δ LIQUIDITY| ≥",
  LIQUIDITY_CHANGE_MIN_ABS_USD: "|Δ LIQUIDITY| ≥",
  LIQUIDITY_CHANGE_MIN_PREVIOUS_USD: "PREVIOUS LIQUIDITY ≥",
  LIQUIDITY_CHANGE_LOOKBACK_MINUTES: "OBSERVATIONS APART ≥",
  BOOST_CHANGE_MIN_DELTA: "|Δ ACTIVE BOOSTS| ≥",
};

export type ThresholdRef = { ruleId: string; subject: string; op: string };

/**
 * Which rules.ts constants each divergence predicate
 * (DIVERGENCE_RULES[].predicate) references, with the comparison it applies.
 */
export const DIVERGENCE_THRESHOLD_REFS: Record<DivergenceId, readonly ThresholdRef[]> = {
  PRICE_VS_VOLUME: [
    { ruleId: "VOLUME_ACCELERATION_MIN", subject: "VA", op: "≥" },
    { ruleId: "DIVERGENCE_PRICE_FLAT_M5_PCT", subject: "|PRICE M5|", op: "<" },
  ],
  PRICE_VS_TXNS: [
    { ruleId: "TXN_ACCELERATION_MIN", subject: "TA", op: "≥" },
    { ruleId: "DIVERGENCE_PRICE_FLAT_M5_PCT", subject: "|PRICE M5|", op: "<" },
  ],
  VOLUME_VS_LIQUIDITY: [
    { ruleId: "VOLUME_ACCELERATION_MIN", subject: "VA", op: "≥" },
    { ruleId: "LIQUIDITY_CHANGE_MIN_REL", subject: "LIQ Δ", op: "≤ −" },
    { ruleId: "LIQUIDITY_CHANGE_MIN_ABS_USD", subject: "|LIQ Δ|", op: "≥" },
    { ruleId: "LIQUIDITY_CHANGE_MIN_PREVIOUS_USD", subject: "PREVIOUS LIQ", op: "≥" },
    { ruleId: "LIQUIDITY_CHANGE_LOOKBACK_MINUTES", subject: "COMPARED ≥", op: "" },
    { ruleId: "SESSION_DELTA_MAX_SPAN_MS", subject: "SPAN ≤", op: "" },
  ],
  BALANCE_VS_PRICE: [
    { ruleId: "IMBALANCE_MIN_SAMPLE_TXNS", subject: "M5 TXNS", op: "≥" },
    { ruleId: "IMBALANCE_MIN_RATIO", subject: "ONE SIDE / OTHER", op: "≥" },
    { ruleId: "DIVERGENCE_PRICE_FLAT_M5_PCT", subject: "|PRICE M5| AGAINST IT", op: "≥" },
  ],
  BOOST_VS_ACTIVITY: [
    { ruleId: "BOOST_CHANGE_MIN_DELTA", subject: "ACTIVE BOOSTS Δ", op: "≥ +" },
    { ruleId: "DIVERGENCE_ACTIVITY_FLAT_RATIO", subject: "TA", op: "≤" },
    { ruleId: "SESSION_DELTA_MAX_SPAN_MS", subject: "SPAN ≤", op: "" },
  ],
  PRICE_EXPANSION_WITHOUT_VOLUME: [
    { ruleId: "PRICE_EXPANSION_M5_PCT", subject: "|PRICE M5|", op: "≥" },
    { ruleId: "DIVERGENCE_ACTIVITY_FLAT_RATIO", subject: "VA", op: "≤" },
  ],
};

/** The rules.ts metadata id of each fixed trace window (SESSION has none). */
export const TRACE_WINDOW_RULE_IDS = {
  "5M": "TRACE_WINDOW_5M_MS",
  "15M": "TRACE_WINDOW_15M_MS",
  "1H": "TRACE_WINDOW_1H_MS",
} as const;

/** Every rule id referenced above (for the guard test). */
export function referencedRuleIds(): string[] {
  return [
    ...Object.values(EVENT_RULE_IDS).flat(),
    ...Object.keys(EVENT_RULE_SUBJECT),
    ...Object.values(DIVERGENCE_THRESHOLD_REFS).flatMap((refs) => refs.map((r) => r.ruleId)),
    ...Object.values(TRACE_WINDOW_RULE_IDS),
  ];
}
