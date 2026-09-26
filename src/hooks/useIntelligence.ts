import { useEffect, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RealtimeRow } from "@/lib/providers/dexPairs";
import type { DataEnvelope } from "@/lib/providers/envelope";
import type { PairUniverse } from "@/lib/providers/universe";
import type { AssetTrack, SessionState } from "@/lib/intelligence/facts";
import { type EvidenceEvent, assetEvents } from "@/lib/intelligence/events";
import { type AssetFreshness, assetFreshness } from "@/lib/intelligence/freshness";
import { batchFromRealtime, batchFromUniverse, failureBatch } from "@/lib/intelligence/ingest";
import { SessionStore, retainedSince } from "@/lib/intelligence/sessionHistory";
import {
  PAIR_UNIVERSE_KEY,
  REALTIME_QUERY_KEY,
  realtimeQueryOptions,
  usePairUniverseQuery,
} from "./usePairUniverse";

/**
 * INTELLIGENCE HOOKS — React access to the session history.
 *
 * One module-level store, created when the dashboard bundle loads: that
 * moment is the session start. It lives outside React on purpose (like
 * `radarHistory`), so route changes never reset it.
 *
 * Components read it through selector hooks built on useSyncExternalStore:
 * a component re-renders only when the slice it selected changes identity
 * (the reducer keeps untouched tracks and lanes referentially stable).
 */
export const intelligenceSession = new SessionStore(Date.now());

const EMPTY_EVENTS: EvidenceEvent[] = [];

/**
 * Select a slice of the session. The selector must return state it reads
 * (stable references) or a primitive — never a freshly built object.
 */
export function useSession<T>(selector: (s: SessionState) => T): T {
  return useSyncExternalStore(
    intelligenceSession.subscribe,
    () => selector(intelligenceSession.getState()),
    () => selector(intelligenceSession.getState()),
  );
}

export function useAssetTrack(key: string | null | undefined): AssetTrack | null {
  return useSession((s) => (key ? (s.assets.get(key) ?? null) : null));
}

export function useLanes(): SessionState["lanes"] {
  return useSession((s) => s.lanes);
}

/** Every asset tracked this session (Change Queue). Re-renders on every ingest. */
export function useAllTracks(): SessionState["assets"] {
  return useSession((s) => s.assets);
}

/** Evidence events for one asset, oldest onset first (memoized per track + lanes). */
export function useAssetEvents(key: string | null | undefined): EvidenceEvent[] {
  const track = useAssetTrack(key);
  const lanes = useLanes();
  return track ? assetEvents(track, lanes) : EMPTY_EVENTS;
}

/** Session start and the earliest observation still retained. */
export function useSessionInfo(): { startedAt: number; retainedSince: number | null } {
  const startedAt = useSession((s) => s.startedAt);
  const since = useSession(retainedSince);
  return { startedAt, retainedSince: since };
}

/* ------------------------------------------------------------------ *
 * Shared clock — for AGES only (now − observedAt), never an observation time
 * ------------------------------------------------------------------ */

let nowValue = Date.now();
let ticker: ReturnType<typeof setInterval> | null = null;
const tickListeners = new Set<() => void>();

function subscribeNow(listener: () => void) {
  tickListeners.add(listener);
  if (!ticker) {
    nowValue = Date.now();
    ticker = setInterval(() => {
      nowValue = Date.now();
      for (const l of tickListeners) l();
    }, 1_000);
  }
  return () => {
    tickListeners.delete(listener);
    if (tickListeners.size === 0 && ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  };
}

/** Wall clock, one shared 1 s ticker for every subscriber. Use only to compute ages. */
export function useNow(): number {
  return useSyncExternalStore(
    subscribeNow,
    () => nowValue,
    () => nowValue,
  );
}

export function useAssetFreshness(key: string | null | undefined): AssetFreshness {
  const track = useAssetTrack(key);
  const lanes = useLanes();
  const now = useNow();
  return assetFreshness(track, lanes, now);
}

/* ------------------------------------------------------------------ *
 * Recorder — mounted ONCE in the dashboard layout
 * ------------------------------------------------------------------ */

/**
 * Keeps the two EXISTING DexScreener lanes observed while any dashboard route
 * is open and folds every new result into the session store.
 *
 * Requests: none of its own. Both observers use the lanes' own query keys and
 * options, so react-query shares one fetch loop per key (every query update
 * restarts all observers' interval timers together). The realtime observer
 * never re-renders (`notifyOnChangeProps: []`); ingestion runs from a query
 * cache subscription, not from render.
 */
export function useIntelligenceRecorder(): void {
  const queryClient = useQueryClient();
  useQuery({ ...realtimeQueryOptions, notifyOnChangeProps: [] });
  usePairUniverseQuery();

  useEffect(() => {
    const seen = { rtData: 0, rtError: 0, uData: 0, uError: 0 };
    const read = () => {
      const rt = queryClient.getQueryState<DataEnvelope<RealtimeRow[]>>(REALTIME_QUERY_KEY);
      if (rt) {
        if (rt.dataUpdatedAt > seen.rtData) {
          seen.rtData = rt.dataUpdatedAt;
          const b = batchFromRealtime(rt.data);
          if (b) intelligenceSession.ingest(b);
        }
        if (rt.status === "error" && rt.errorUpdatedAt > seen.rtError) {
          seen.rtError = rt.errorUpdatedAt;
          const b = failureBatch("realtime", rt.errorUpdatedAt, rt.error);
          if (b) intelligenceSession.ingest(b);
        }
      }
      const u = queryClient.getQueryState<PairUniverse>(PAIR_UNIVERSE_KEY);
      if (u) {
        if (u.dataUpdatedAt > seen.uData) {
          seen.uData = u.dataUpdatedAt;
          const b = batchFromUniverse(u.data, u.dataUpdatedAt);
          if (b) intelligenceSession.ingest(b);
        }
        if (u.status === "error" && u.errorUpdatedAt > seen.uError) {
          seen.uError = u.errorUpdatedAt;
          const b = failureBatch("universe", u.errorUpdatedAt, u.error);
          if (b) intelligenceSession.ingest(b);
        }
      }
    };
    read();
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated") return;
      const k = event.query.queryKey[0];
      if (k === REALTIME_QUERY_KEY[0] || k === PAIR_UNIVERSE_KEY[0]) read();
    });
  }, [queryClient]);
}

/** Renders nothing; exists so the recorder's observers never re-render the layout. */
export function IntelligenceRecorder(): null {
  useIntelligenceRecorder();
  return null;
}
