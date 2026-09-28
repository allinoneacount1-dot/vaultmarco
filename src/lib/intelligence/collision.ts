import { type EventFamily, type EvidenceEvent, isLaneOnly } from "./events";
import { COLLISION_NON_VOTING_TYPES, COLLISION_WINDOW_MS } from "./rules";

/**
 * COLLISION — "what changed together?"
 *
 * Counts independent evidence FAMILIES whose event onsets fall inside one
 * bounded window, never raw events: several events of the same family in the
 * window are ONE family (its earliest event in the window represents it).
 * The window ends at the newest onset considered and spans `windowMs`
 * (COLLISION_WINDOW_MS by default), inclusive at both ends. Not confidence,
 * not causality — co-occurrence in time only.
 *
 * ONE POOL: pool-level market events (price, volume, liquidity, transactions,
 * boosts, radar signals) are only combined when they were observed on the
 * SAME pairAddress. A feed asset's observed pool can switch between rounds;
 * events on pool A and pool B never form one collision. The pool is the one
 * of the newest pool-level event in the pool (or `opts.pairAddress`).
 * PROVIDER events are lane-level and are not tied to a pool.
 *
 * VOTES (intel-3): only an OBSERVED onset votes — a condition already true
 * when first observed says nothing about WHEN it changed. The Alpha Radar's
 * derived signals (COLLISION_NON_VOTING_TYPES) never vote: they are computed
 * from the same observations as the families they summarise. A lane recovery
 * the asset was not observed after is lane context, not this asset's change.
 * So "N INDEPENDENT FAMILIES" stays literally true.
 */

const NON_VOTING: ReadonlySet<string> = new Set(COLLISION_NON_VOTING_TYPES);

/** Whether an event may vote for its family in a collision. */
export function votesInCollision(e: EvidenceEvent): boolean {
  return e.onset === "OBSERVED" && !NON_VOTING.has(e.type) && !isLaneOnly(e);
}

export const POOL_LEVEL_FAMILIES: ReadonlySet<EventFamily> = new Set<EventFamily>([
  "PRICE",
  "VOLUME",
  "LIQUIDITY",
  "TRANSACTIONS",
  "BOOST",
  "SIGNAL",
]);

export type CollisionFamily = { family: EventFamily; firstAt: number; events: EvidenceEvent[] };

export type Collision = {
  families: CollisionFamily[];
  /** Number of distinct families (the only count). */
  count: number;
  windowStart: number;
  windowEnd: number;
  /** Last family onset − first family onset. */
  spanMs: number;
  /** The one observed pool the pool-level events belong to (null if none). */
  pairAddress: string | null;
};

export function collisionFamilies(
  events: readonly EvidenceEvent[],
  windowMs: number = COLLISION_WINDOW_MS,
  opts: { end?: number; families?: readonly EventFamily[]; pairAddress?: string | null } = {},
): Collision | null {
  let pool = events.filter(
    (e) => votesInCollision(e) && (!opts.families || opts.families.includes(e.family)),
  );
  if (pool.length === 0 || !(windowMs >= 0)) return null;
  const poolLevel = pool.filter((e) => POOL_LEVEL_FAMILIES.has(e.family));
  const newestPoolEvent = poolLevel.reduce<EvidenceEvent | null>(
    (a, e) =>
      a == null || e.observedAt > a.observedAt || (e.observedAt === a.observedAt && e.id > a.id)
        ? e
        : a,
    null,
  );
  const pairAddress =
    opts.pairAddress !== undefined ? opts.pairAddress : (newestPoolEvent?.pairAddress ?? null);
  pool = pool.filter((e) => !POOL_LEVEL_FAMILIES.has(e.family) || e.pairAddress === pairAddress);
  if (pool.length === 0) return null;
  const windowEnd = opts.end ?? Math.max(...pool.map((e) => e.observedAt));
  const windowStart = windowEnd - windowMs;
  const inWindow = pool
    .filter((e) => e.observedAt >= windowStart && e.observedAt <= windowEnd)
    .sort((a, b) => a.observedAt - b.observedAt || (a.id < b.id ? -1 : 1));
  if (inWindow.length === 0) return null;
  const byFamily = new Map<EventFamily, CollisionFamily>();
  for (const e of inWindow) {
    const f = byFamily.get(e.family);
    if (f) f.events.push(e);
    else byFamily.set(e.family, { family: e.family, firstAt: e.observedAt, events: [e] });
  }
  const families = [...byFamily.values()].sort(
    (a, b) => a.firstAt - b.firstAt || (a.family < b.family ? -1 : 1),
  );
  const spanMs = families[families.length - 1].firstAt - families[0].firstAt;
  return { families, count: families.length, windowStart, windowEnd, spanMs, pairAddress };
}
