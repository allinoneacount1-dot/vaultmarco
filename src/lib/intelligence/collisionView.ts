import { type Collision, POOL_LEVEL_FAMILIES, collisionFamilies } from "./collision";
import type { EvidenceEvent } from "./events";
import { ageLabel } from "./freshness";
import { COLLISION_WINDOW_MS, ruleMeta } from "./rules";
import { countText, pctText, ratioText, usdText } from "./divergenceView";

/**
 * COLLISION VIEW — the foundation's `collisionFamilies` result, restated for
 * the page. Counting, family de-duplication, the window and the one-pool rule
 * are the foundation's (collision.ts); this module only adds what the page
 * must SAY about it:
 *   - whether it is a collision at all (≥ 2 independent families),
 *   - the real span between the first and last contributing family onsets,
 *   - which pool-level events inside the same window were left out because
 *     they were observed on a different pool (a pool switch), so the page can
 *     say so instead of silently dropping them.
 */

/** Minimum number of independent families for the page to call it a collision. */
const MIN_FAMILIES = 2;

export type CollisionView = {
  collision: Collision | null;
  /** ≥ 2 independent families inside the window. */
  isCollision: boolean;
  /** Pool-level events inside [windowStart, windowEnd] observed on another pool. */
  excluded: EvidenceEvent[];
  /** Distinct other pools those excluded events came from. */
  excludedPools: (string | null)[];
  windowMs: number;
};

export function collisionView(
  events: readonly EvidenceEvent[],
  windowMs: number = COLLISION_WINDOW_MS,
): CollisionView {
  const collision = collisionFamilies(events, windowMs);
  if (!collision) {
    return { collision: null, isCollision: false, excluded: [], excludedPools: [], windowMs };
  }
  const excluded = events.filter(
    (e) =>
      POOL_LEVEL_FAMILIES.has(e.family) &&
      e.pairAddress !== collision.pairAddress &&
      e.observedAt >= collision.windowStart &&
      e.observedAt <= collision.windowEnd,
  );
  const excludedPools = [...new Set(excluded.map((e) => e.pairAddress))];
  return {
    collision,
    isCollision: collision.count >= MIN_FAMILIES,
    excluded,
    excludedPools,
    windowMs,
  };
}

/** The rules window as text, e.g. "05m 00s". Read from rules.ts metadata. */
export function collisionWindowText(): string {
  return ageLabel(ruleMeta("COLLISION_WINDOW_MS")?.value ?? COLLISION_WINDOW_MS);
}

/** "3 CHANGES" / "1 CHANGE". */
export function changesText(n: number): string {
  return `${n} ${n === 1 ? "CHANGE" : "CHANGES"}`;
}

/** Span between the first and last contributing family onsets, e.g. "03m 18s". */
export function spanText(c: Collision | null): string {
  return c ? ageLabel(c.spanMs) : "—";
}

/** "PRICE_EXPANSION" → "PRICE EXPANSION". */
export function eventTypeText(e: EvidenceEvent): string {
  return e.type.replace(/_/g, " ");
}

/** The event's own value in its unit; unknown "—", 0 stays 0. */
export function eventValueText(e: EvidenceEvent): string {
  switch (e.unit) {
    case "PCT":
      return pctText(e.value);
    case "RATIO":
      return ratioText(e.value);
    case "USD":
      return usdText(e.value);
    case "COUNT":
      return countText(e.value, true);
    default:
      return e.value == null ? "—" : String(e.value);
  }
}

export const ONSET_TEXT: Record<EvidenceEvent["onset"], string> = {
  OBSERVED: "ONSET OBSERVED",
  IN_PROGRESS_WHEN_OBSERVED: "IN PROGRESS WHEN FIRST OBSERVED",
};
