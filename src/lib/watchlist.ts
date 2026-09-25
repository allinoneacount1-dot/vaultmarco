import { z } from "zod";
import { assetKey } from "@/lib/assetIdentity";
import type { AdToken, BoostToken } from "@/components/marco/shared/types";
import type { PairUniverse, RadarStatus } from "@/lib/providers/universe";
import type { SnapshotHistory } from "@/lib/signals/history";
import {
  type DrawerModel,
  type TokenRef,
  refFromAd,
  refFromBoost,
  resolveDrawerModel,
} from "@/lib/tokenDrawer";

/**
 * SMART WATCHLIST — "I care about this token."
 *
 * Only identity is stored: the canonical `assetKey`, the provider's original
 * chain + address, and when it was added. No market value is ever persisted;
 * a watched token's market state is resolved on every render from the
 * current Pair Universe and the retained real observations, with the same
 * `resolveDrawerModel` the Token Intelligence Drawer uses.
 *
 * Storage sits behind `WatchlistRepository`, so a later cloud-synced
 * repository can replace the local one without touching the UI.
 */

export type WatchItem = {
  /** Canonical `assetKey(chainId, address)`. */
  key: string;
  /** Provider's original chain id. */
  chainId: string;
  /** Provider's original address — used for display, copy and links. */
  address: string;
  /** Epoch ms when the user added it. */
  addedAt: number;
};

export type WatchlistPersistence = "local" | "memory";

export interface WatchlistRepository {
  /** Watched items, newest first. Same array reference until the list changes. */
  list(): readonly WatchItem[];
  /** Add (idempotent by canonical key). Returns false when the list is full. */
  add(token: { chainId: string; address: string }): boolean;
  remove(key: string): void;
  subscribe(listener: () => void): () => void;
  /** "memory" when browser storage is unavailable: the list will not survive a reload. */
  persistence(): WatchlistPersistence;
}

export const WATCHLIST_STORAGE_KEY = "marcovault:watchlist";
export const WATCHLIST_VERSION = 1;
export const WATCHLIST_MAX_ITEMS = 50;

const StoredItemV1 = z.object({
  key: z.string(),
  chainId: z.string().min(1),
  address: z.string().min(1),
  addedAt: z.number().finite(),
});
const StoredV1 = z.object({
  version: z.literal(1),
  items: z.array(z.unknown()),
});

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

type Loaded = { items: WatchItem[]; writable: boolean };

/**
 * Parse stored JSON defensively. Invalid entries are dropped; every key is
 * re-derived with `assetKey`, so identity always follows the canonical rule.
 * A payload written by a NEWER version is left untouched (not writable).
 */
export function parseStoredWatchlist(raw: string | null): Loaded {
  if (raw == null) return { items: [], writable: true };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { items: [], writable: true }; // corrupt: nothing recoverable
  }
  const version = (json as { version?: unknown } | null)?.version;
  if (typeof version === "number" && version > WATCHLIST_VERSION) {
    return { items: [], writable: false };
  }
  const parsed = StoredV1.safeParse(json);
  if (!parsed.success) return { items: [], writable: true };
  const byKey = new Map<string, WatchItem>();
  for (const entry of parsed.data.items) {
    const item = StoredItemV1.safeParse(entry);
    if (!item.success) continue;
    const key = assetKey(item.data.chainId, item.data.address);
    if (!byKey.has(key)) byKey.set(key, { ...item.data, key });
  }
  return {
    items: sortNewestFirst([...byKey.values()]).slice(0, WATCHLIST_MAX_ITEMS),
    writable: true,
  };
}

function sortNewestFirst(items: WatchItem[]): WatchItem[] {
  return items.sort((a, b) => b.addedAt - a.addedAt || (a.key < b.key ? -1 : 1));
}

/**
 * Browser-local repository (versioned JSON in localStorage).
 *
 * Write-safety model — one rule, held for the repository's whole lifetime:
 *
 *   `persistence` starts "local" only if storage exists and holds a missing,
 *   corrupt or v1 payload. It becomes "memory" — PERMANENTLY — the moment
 *   storage cannot be read, a write throws (quota / private mode), or a
 *   payload from a NEWER version is seen (on load, on a storage event, or
 *   just before a mutation). Nothing re-enables writing; a newer payload is
 *   therefore never overwritten by this instance.
 *
 *   Every local mutation re-reads storage first and applies WATCH / UNWATCH
 *   to the FRESH persisted items, not to this tab's possibly stale snapshot
 *   (another tab may have written before its storage event arrived). So
 *   mutations from several tabs compose in the order they happen: nothing is
 *   dropped and nothing already removed is resurrected.
 *
 *   In memory mode the list keeps working for this tab and ignores storage
 *   events (it can no longer interpret what is stored).
 */
export function createLocalWatchlistRepository(
  storage: KeyValueStorage | null,
  events?: Pick<Window, "addEventListener" | "removeEventListener">,
  now: () => number = () => Date.now(),
): WatchlistRepository {
  const read = (): Loaded => {
    try {
      return parseStoredWatchlist(storage?.getItem(WATCHLIST_STORAGE_KEY) ?? null);
    } catch {
      return { items: [], writable: false };
    }
  };
  const initial = read();
  let items: readonly WatchItem[] = initial.items;
  let persistence: WatchlistPersistence = storage && initial.writable ? "local" : "memory";
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  /**
   * The base a mutation must apply to: the fresh persisted items while
   * writing is safe; otherwise this tab's own list (and writing stops).
   */
  const mutationBase = (): readonly WatchItem[] => {
    if (persistence !== "local") return items;
    const fresh = read();
    if (!fresh.writable) {
      persistence = "memory";
      return items;
    }
    return fresh.items;
  };

  /** Adopt `next` as the list, persisting it only while writing is still safe. */
  const commit = (next: readonly WatchItem[], write: boolean) => {
    if (write && persistence === "local") {
      try {
        storage!.setItem(
          WATCHLIST_STORAGE_KEY,
          JSON.stringify({ version: WATCHLIST_VERSION, items: next }),
        );
      } catch {
        persistence = "memory";
      }
    }
    items = next;
    emit();
  };

  const onStorage = (e: Event) => {
    if ((e as StorageEvent).key !== WATCHLIST_STORAGE_KEY) return;
    if (persistence !== "local") return;
    const fresh = read();
    if (!fresh.writable) {
      // A newer (or unreadable) payload arrived: keep this tab's list, stop writing.
      persistence = "memory";
      emit();
      return;
    }
    items = fresh.items;
    emit();
  };

  return {
    list: () => items,
    add: ({ chainId, address }) => {
      const key = assetKey(chainId, address);
      const base = mutationBase();
      if (base.some((i) => i.key === key)) {
        if (base !== items) commit(base, false); // adopt what another tab wrote
        return true;
      }
      if (base.length >= WATCHLIST_MAX_ITEMS) {
        if (base !== items) commit(base, false);
        return false;
      }
      commit([{ key, chainId, address, addedAt: now() }, ...base], true);
      return true;
    },
    remove: (key) => {
      const base = mutationBase();
      if (!base.some((i) => i.key === key)) {
        if (base !== items) commit(base, false);
        return;
      }
      commit(
        base.filter((i) => i.key !== key),
        true,
      );
    },
    subscribe: (listener) => {
      if (listeners.size === 0) events?.addEventListener("storage", onStorage);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) events?.removeEventListener("storage", onStorage);
      };
    },
    persistence: () => persistence,
  };
}

/* ------------------------------------------------------------------ *
 * Resolution — live state from real data only
 * ------------------------------------------------------------------ */

/** Watchlist row state — the same temporal truth as Search and the Drawer. */
export type WatchState = "LIVE" | "DEGRADED" | "STALE" | "RETAINED" | "IDENTITY ONLY";

export type WatchSignal = "EARLY MOMENTUM" | "LIQ REMOVED" | "LIQ ADDED";

export type WatchRow = {
  item: WatchItem;
  /** Reference for the Token Drawer (entry point "watchlist"). */
  ref: TokenRef;
  state: WatchState;
  symbol: string | null;
  name: string | null;
  /** Real market fields from the latest observation; null when unknown. */
  priceUsd: number | null;
  changeM5: number | null;
  changeH1: number | null;
  liquidityUsd: number | null;
  observedAt: number | null;
  /** Signal of the CURRENT round (live / degraded only). */
  signal: WatchSignal | null;
  /** STALE only: the signal the last real round carried — history, not current. */
  lastSignal: WatchSignal | null;
};

function signalOf(model: DrawerModel): WatchSignal | null {
  if (model.kind !== "current") return null;
  if (model.intel.momentum) return "EARLY MOMENTUM";
  const risk = model.intel.risk;
  return risk ? (risk.direction === "REMOVED" ? "LIQ REMOVED" : "LIQ ADDED") : null;
}

/** Identity-only label: the feed's own record (enriched symbol/name), if the feed holds it. */
function feedIdentity(key: string, universe: PairUniverse | undefined): TokenRef | null {
  for (const b of (universe?.boosts?.data ?? []) as BoostToken[]) {
    const ref = refFromBoost(b);
    if (ref.key === key) return ref;
  }
  for (const a of (universe?.ads?.data ?? []) as AdToken[]) {
    const ref = refFromAd(a);
    if (ref.key === key) return ref;
  }
  return null;
}

/**
 * Resolve one watched item against the data MARCOVAULT holds right now.
 * `status` is the radar status (resolveRadarStatus); nothing is fetched.
 */
export function resolveWatchRow(
  item: WatchItem,
  universe: PairUniverse | undefined,
  status: RadarStatus | "loading",
  history: SnapshotHistory,
): WatchRow {
  const feed = feedIdentity(item.key, universe);
  const ref: TokenRef = {
    key: item.key,
    entry: "watchlist",
    chainId: item.chainId,
    address: item.address, // stored original — never rebuilt from the key
    symbol: feed?.symbol ?? null,
    name: feed?.name ?? null,
    url: feed?.url ?? null,
  };
  // Offline / loading: no round is current, so only retained history applies.
  const roundUsable = status === "live" || status === "degraded" || status === "stale";
  const model = resolveDrawerModel(
    ref,
    roundUsable ? universe : undefined,
    status === "loading" ? "offline" : status,
    history,
  );
  const s = model.kind === "identity" ? null : model.intel.snapshot;
  const state: WatchState =
    model.kind === "identity"
      ? "IDENTITY ONLY"
      : model.kind === "retained"
        ? "RETAINED"
        : status === "live"
          ? "LIVE"
          : status === "degraded"
            ? "DEGRADED"
            : "STALE";
  const signal = signalOf(model);
  return {
    item,
    ref: s ? { ...ref, symbol: s.baseSymbol, name: s.baseName, url: s.url ?? ref.url } : ref,
    state,
    symbol: s?.baseSymbol ?? ref.symbol,
    name: s?.baseName ?? ref.name,
    priceUsd: s?.priceUsd ?? null,
    changeM5: s?.priceChange.m5 ?? null,
    changeH1: s?.priceChange.h1 ?? null,
    liquidityUsd: s?.liquidityUsd ?? null,
    observedAt: s?.observedAt ?? null,
    signal: state === "LIVE" || state === "DEGRADED" ? signal : null,
    lastSignal: state === "STALE" ? signal : null,
  };
}
