import type { EventFamily, EvidenceEvent } from "./events";
import { COLLISION_WINDOW_MS } from "./rules";

/**
 * COLLISION — "what changed together?"
 *
 * Counts independent evidence FAMILIES whose event onsets fall inside one
 * bounded window, never raw events: several events of the same family in the
 * window are ONE family (its earliest event in the window represents it).
 * The window ends at the newest onset considered and spans `windowMs`
 * (COLLISION_WINDOW_MS by default), inclusive at both ends. Not confidence,
 * not causality — co-occurrence in time only.
 */

export type CollisionFamily = { family: EventFamily; firstAt: number; events: EvidenceEvent[] };

export type Collision = {
  families: CollisionFamily[];
  /** Number of distinct families (the only count). */
  count: number;
  windowStart: number;
  windowEnd: number;
  /** Last family onset − first family onset. */
  spanMs: number;
};

export function collisionFamilies(
  events: readonly EvidenceEvent[],
  windowMs: number = COLLISION_WINDOW_MS,
  opts: { end?: number; families?: readonly EventFamily[] } = {},
): Collision | null {
  const pool = opts.families ? events.filter((e) => opts.families!.includes(e.family)) : events;
  if (pool.length === 0 || !(windowMs >= 0)) return null;
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
  return { families, count: families.length, windowStart, windowEnd, spanMs };
}
