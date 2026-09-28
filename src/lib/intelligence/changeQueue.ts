import type { EventDirection, EventType, EvidenceEvent } from "./events";

/**
 * CHANGE QUEUE — "what deserves attention now?" as an EVENT QUEUE, not a
 * ranking. There is no score anywhere in these types. Rows are ordered only
 * by one of four deterministic, evidence-based keys, with fixed tie-breaks:
 *
 *   NEWEST                    newest qualifying change first
 *   MOST_EVENTS               more qualifying events first
 *   LARGEST_VOLUME_ACCELERATION  larger VA ratio (m5 pace ÷ previous pace) of the
 *                                newest VOLUME_ACCELERATION event first — an
 *                                acceleration ratio, NOT a volume change
 *   LARGEST_LIQUIDITY_CHANGE     larger |Δ USD| of the newest LIQUIDITY_CHANGE
 *                                event first — a session delta between two real
 *                                observations of the SAME pool
 *
 * then (every sort) newest change first, then assetKey ascending. A row
 * without the metric a sort needs goes after every row that has it — an
 * unknown is never treated as zero.
 */

export type QueueSort =
  | "NEWEST"
  | "MOST_EVENTS"
  | "LARGEST_VOLUME_ACCELERATION"
  | "LARGEST_LIQUIDITY_CHANGE";

export const QUEUE_SORTS: readonly QueueSort[] = [
  "NEWEST",
  "MOST_EVENTS",
  "LARGEST_VOLUME_ACCELERATION",
  "LARGEST_LIQUIDITY_CHANGE",
];

export type QueueRow = {
  assetKey: string;
  chainId: string;
  address: string;
  pairAddress: string | null;
  newestAt: number;
  /** Id of the newest qualifying event (the one newestAt / newestType describe). */
  newestId: string;
  newestType: EventType;
  newestDirection: EventDirection;
  /**
   * How much of the newest change's start was seen. IN_PROGRESS_WHEN_OBSERVED
   * means it was already true at its first observation: `newestAt` is then
   * when it was FIRST SEEN, not when it began — the page must say so.
   */
  newestOnset: EvidenceEvent["onset"];
  eventCount: number;
  familyCount: number;
  /** VA ratio of the newest VOLUME_ACCELERATION event, or null. */
  volumeAcceleration: number | null;
  /** Δ USD of the newest LIQUIDITY_CHANGE event, or null. */
  liquidityChangeUsd: number | null;
};

/** Provider-state events are not market changes and never qualify a row. */
export function qualifiesForQueue(e: EvidenceEvent): boolean {
  return e.family !== "PROVIDER";
}

/** One row from one asset's events, or null when it has no qualifying change. */
export function queueRow(events: readonly EvidenceEvent[]): QueueRow | null {
  const q = events.filter(qualifiesForQueue);
  if (q.length === 0) return null;
  const newest = q.reduce((a, b) =>
    b.observedAt > a.observedAt || (b.observedAt === a.observedAt && b.id > a.id) ? b : a,
  );
  const newestOf = (t: EventType) =>
    q
      .filter((e) => e.type === t)
      .reduce<EvidenceEvent | null>(
        (a, b) => (a == null || b.observedAt >= a.observedAt ? b : a),
        null,
      );
  const va = newestOf("VOLUME_ACCELERATION");
  const liq = newestOf("LIQUIDITY_CHANGE");
  const delta = liq?.evidence.deltaUsd;
  return {
    assetKey: newest.assetKey,
    chainId: newest.chainId,
    address: newest.address,
    pairAddress: newest.pairAddress,
    newestAt: newest.observedAt,
    newestId: newest.id,
    newestType: newest.type,
    newestDirection: newest.direction,
    newestOnset: newest.onset,
    eventCount: q.length,
    familyCount: new Set(q.map((e) => e.family)).size,
    volumeAcceleration: va?.value ?? null,
    liquidityChangeUsd: typeof delta === "number" ? delta : null,
  };
}

const tie = (a: QueueRow, b: QueueRow) =>
  b.newestAt - a.newestAt || (a.assetKey < b.assetKey ? -1 : a.assetKey > b.assetKey ? 1 : 0);

/** Larger first; null after every number. */
const desc = (x: number | null, y: number | null) =>
  x == null && y == null ? 0 : x == null ? 1 : y == null ? -1 : y - x;

export const QUEUE_COMPARATORS: Record<QueueSort, (a: QueueRow, b: QueueRow) => number> = {
  NEWEST: tie,
  MOST_EVENTS: (a, b) => b.eventCount - a.eventCount || tie(a, b),
  LARGEST_VOLUME_ACCELERATION: (a, b) =>
    desc(a.volumeAcceleration, b.volumeAcceleration) || tie(a, b),
  LARGEST_LIQUIDITY_CHANGE: (a, b) =>
    desc(
      a.liquidityChangeUsd == null ? null : Math.abs(a.liquidityChangeUsd),
      b.liquidityChangeUsd == null ? null : Math.abs(b.liquidityChangeUsd),
    ) || tie(a, b),
};

export function sortQueue(rows: readonly QueueRow[], sort: QueueSort): QueueRow[] {
  return [...rows].sort(QUEUE_COMPARATORS[sort]);
}
