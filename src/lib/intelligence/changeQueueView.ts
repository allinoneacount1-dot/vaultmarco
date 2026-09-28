import type { DeskState } from "@/lib/deskState";
import {
  type QueueRow,
  type QueueSort,
  qualifiesForQueue,
  queueRow,
  sortQueue,
} from "./changeQueue";
import { collisionFamilies } from "./collision";
import { type EventDirection, type EventType, type EvidenceEvent, assetEvents } from "./events";
import type { AssetTrack, LaneTrack, SessionState } from "./facts";
import { type Lane, COLLISION_WINDOW_MS, ruleMeta, staleAfterMs } from "./rules";

/**
 * CHANGE QUEUE VIEW MODEL — the page's pure read of the session.
 *
 * Ordering, qualification and the row metrics are the foundation's
 * (`queueRow`, `sortQueue`, `QUEUE_COMPARATORS` in ./changeQueue); this module
 * only joins each row with the evidence the page shows next to it (the newest
 * qualifying event itself, the families in the collision window, the latest
 * observation's price and pool) and names the lanes' page-level state.
 * No clock is read here: ages are computed by the caller from a `now` it owns.
 */

export type QueueEntry = {
  row: QueueRow;
  /** The newest qualifying event (`row.newestId`). */
  newest: EvidenceEvent;
  /**
   * Distinct families whose onsets fall in the rules window
   * (COLLISION_WINDOW_MS) ending at the newest pool-level onset, one pool only
   * (the foundation's `collisionFamilies`). Null when nothing is in a window.
   */
  familiesInWindow: number | null;
  windowStart: number | null;
  windowEnd: number | null;
  /** Latest real observation of the asset. */
  symbol: string | null;
  priceUsd: number | null;
  pairAddress: string | null;
  dexId: string | null;
  lanes: Lane[];
  latestObservedAt: number;
};

type Cached = { lanes: SessionState["lanes"]; entry: QueueEntry | null };
const cache = new WeakMap<AssetTrack, Cached>();

const sameEntry = (a: QueueEntry, b: QueueEntry) =>
  a.newest.id === b.newest.id &&
  a.newest.lastObservedAt === b.newest.lastObservedAt &&
  a.newest.active === b.newest.active &&
  a.row.eventCount === b.row.eventCount &&
  a.row.familyCount === b.row.familyCount &&
  a.row.volumeAcceleration === b.row.volumeAcceleration &&
  a.row.liquidityChangeUsd === b.row.liquidityChangeUsd &&
  a.familiesInWindow === b.familiesInWindow &&
  a.windowStart === b.windowStart &&
  a.priceUsd === b.priceUsd &&
  a.symbol === b.symbol &&
  a.pairAddress === b.pairAddress &&
  a.dexId === b.dexId &&
  a.latestObservedAt === b.latestObservedAt &&
  a.lanes.join() === b.lanes.join();

/** One asset's queue entry, or null when it has no qualifying change this session. */
export function buildQueueEntry(
  track: AssetTrack,
  lanes: SessionState["lanes"],
): QueueEntry | null {
  const events = assetEvents(track, lanes);
  const row = queueRow(events);
  const latest = track.observations[track.observations.length - 1];
  if (!row || !latest) return null;
  const qualifying = events.filter(qualifiesForQueue);
  const newest = qualifying.find((e) => e.id === row.newestId);
  if (!newest) return null;
  const c = collisionFamilies(qualifying, COLLISION_WINDOW_MS);
  return {
    row,
    newest,
    familiesInWindow: c ? c.count : null,
    windowStart: c ? c.windowStart : null,
    windowEnd: c ? c.windowEnd : null,
    symbol: latest.snapshot.baseSymbol,
    priceUsd: latest.snapshot.priceUsd,
    pairAddress: latest.pairAddress,
    dexId: latest.snapshot.dexId,
    lanes: latest.lanes,
    latestObservedAt: latest.observedAt,
  };
}

/**
 * Memoized per track; when only the lanes changed and the entry's content is
 * the same, the previous object is returned so memoized rows do not re-render.
 */
export function queueEntry(track: AssetTrack, lanes: SessionState["lanes"]): QueueEntry | null {
  const hit = cache.get(track);
  if (hit && hit.lanes === lanes) return hit.entry;
  const next = buildQueueEntry(track, lanes);
  const entry = hit?.entry && next && sameEntry(hit.entry, next) ? hit.entry : next;
  cache.set(track, { lanes, entry });
  return entry;
}

/** Every queued asset in the order of `sort` (the foundation's comparator). */
export function queueEntries(
  assets: SessionState["assets"],
  lanes: SessionState["lanes"],
  sort: QueueSort,
): QueueEntry[] {
  const byKey = new Map<string, QueueEntry>();
  for (const track of assets.values()) {
    const e = queueEntry(track, lanes);
    if (e) byKey.set(e.row.assetKey, e);
  }
  return sortQueue(
    [...byKey.values()].map((e) => e.row),
    sort,
  ).map((r) => byKey.get(r.assetKey)!);
}

/* ------------------------------------------------------------------ *
 * Sorts — labels and honest captions
 * ------------------------------------------------------------------ */

const va = ruleMeta("VOLUME_ACCELERATION_MIN");
const liqRel = ruleMeta("LIQUIDITY_CHANGE_MIN_REL");
const liqAbs = ruleMeta("LIQUIDITY_CHANGE_MIN_ABS_USD");
const liqLook = ruleMeta("LIQUIDITY_CHANGE_LOOKBACK_MINUTES");

export const QUEUE_SORT_META: Record<
  QueueSort,
  { label: string; caption: string; keyLabel: string | null }
> = {
  NEWEST: {
    label: "NEWEST",
    caption:
      "Sorted by the observed onset of each asset's newest qualifying change (MARCOVAULT receive time), newest first · ties: asset key.",
    keyLabel: null,
  },
  MOST_EVENTS: {
    label: "MOST EVENTS",
    caption:
      "Sorted by the number of qualifying events observed this session (provider-state events excluded), most first · ties: newest change, then asset key.",
    keyLabel: "EVENTS",
  },
  LARGEST_VOLUME_ACCELERATION: {
    label: "LARGEST VOLUME ACCELERATION",
    caption: `Sorted by volume-acceleration ratio, M5 vs H1 pace (M5 pace ÷ (H1 − M5) pace) of the newest VOLUME ACCELERATION event, largest first · rule ≥ ${va?.value ?? "—"}× · rows without one last (—) · ties: newest change, then asset key.`,
    keyLabel: "VOL ACCEL",
  },
  LARGEST_LIQUIDITY_CHANGE: {
    label: "LARGEST LIQUIDITY CHANGE",
    caption: `Sorted by |Δ USD| of the newest LIQUIDITY CHANGE event, a session delta between two observations ≥ ${liqLook?.value ?? "—"}M apart on the same observed pool, largest first · rule ≥ ${liqRel ? liqRel.value * 100 : "—"}% and ≥ $${liqAbs ? liqAbs.value.toLocaleString("en-US") : "—"} · rows without one last (—) · ties: newest change, then asset key.`,
    keyLabel: "Δ LIQUIDITY",
  },
};

/** The value the active sort orders by, as displayed text; "—" when the row lacks it. */
export function sortKeyText(row: QueueRow, sort: QueueSort): string | null {
  switch (sort) {
    case "NEWEST":
      return null;
    case "MOST_EVENTS":
      return String(row.eventCount);
    case "LARGEST_VOLUME_ACCELERATION":
      return ratioText(row.volumeAcceleration);
    case "LARGEST_LIQUIDITY_CHANGE":
      return usdDeltaText(row.liquidityChangeUsd);
  }
}

/** Whether the row has the metric the sort needs (rows without it sort last). */
export function hasSortKey(row: QueueRow, sort: QueueSort): boolean {
  if (sort === "LARGEST_VOLUME_ACCELERATION") return row.volumeAcceleration != null;
  if (sort === "LARGEST_LIQUIDITY_CHANGE") return row.liquidityChangeUsd != null;
  return true;
}

/* ------------------------------------------------------------------ *
 * Text
 * ------------------------------------------------------------------ */

const TYPE_TEXT: Record<EventType, string> = {
  PRICE_EXPANSION: "PRICE EXPANSION",
  VOLUME_ACCELERATION: "VOLUME ACCELERATION",
  TXN_ACCELERATION: "TXN ACCELERATION",
  BUY_SELL_IMBALANCE: "BUY/SELL IMBALANCE",
  LIQUIDITY_CHANGE: "LIQUIDITY CHANGE",
  BOOST_CHANGE: "BOOST CHANGE",
  PAIR_DISCOVERED: "PAIR DISCOVERED",
  MOMENTUM_FIRED: "RADAR MOMENTUM FIRED",
  RISK_FIRED: "RADAR RISK FIRED",
  PROVIDER_RECOVERED: "PROVIDER RECOVERED",
  PROVIDER_STALE: "PROVIDER STALE",
};

/** "PRICE EXPANSION · UP" — direction in words, never by colour alone. */
export function changeText(type: EventType, direction: EventDirection): string {
  return direction ? `${TYPE_TEXT[type]} · ${direction}` : TYPE_TEXT[type];
}

export function ratioText(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}×`;
}

/** Signed compact USD, e.g. "−$15.2K"; unknown → "—", 0 → "$0". */
export function usdDeltaText(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  const body =
    a >= 1e9
      ? `${(a / 1e9).toFixed(2)}B`
      : a >= 1e6
        ? `${(a / 1e6).toFixed(2)}M`
        : a >= 1e3
          ? `${(a / 1e3).toFixed(1)}K`
          : a.toFixed(0);
  return `${sign}$${body}`;
}

/* ------------------------------------------------------------------ *
 * Page-level lane state
 * ------------------------------------------------------------------ */

export type LaneView = {
  lane: Lane;
  state: DeskState;
  /** Latest recorded round time, or null. */
  at: number | null;
  code: string | null;
};

/** One lane's state from its recorded rounds: never LIVE without a recent ok round. */
export function laneView(lane: Lane, track: LaneTrack, now: number): LaneView {
  const last = track.points[track.points.length - 1];
  if (!last) return { lane, state: "loading", at: null, code: null };
  const base = { lane, at: last.at, code: last.code };
  if (last.state === "failed")
    return { ...base, state: track.firstOkAt == null ? "offline" : "stale" };
  if (now - last.at > staleAfterMs(lane)) return { ...base, state: "stale" };
  return { ...base, state: last.state === "partial" ? "degraded" : "live" };
}

/**
 * The queue's page-level state across both lanes:
 *   CONNECTING  no lane has recorded a round;
 *   OFFLINE     every lane that answered has only failed;
 *   STALE       no lane is current (failed after data, or older than its window);
 *   DEGRADED    one lane is not current or a round was partial — the rows
 *               from the healthy lane stay, each with its own freshness;
 *   LIVE        every lane that has answered is current and complete.
 */
export function pageLaneState(
  lanes: Record<Lane, LaneTrack>,
  now: number,
): { state: DeskState; lanes: LaneView[] } {
  const views = (["realtime", "universe"] as const).map((l) => laneView(l, lanes[l], now));
  const answered = views.filter((v) => v.state !== "loading");
  let state: DeskState;
  if (answered.length === 0) state = "loading";
  else if (answered.every((v) => v.state === "offline")) state = "offline";
  else if (answered.every((v) => v.state === "stale" || v.state === "offline")) state = "stale";
  else if (answered.some((v) => v.state !== "live")) state = "degraded";
  else state = "live";
  return { state, lanes: views };
}
