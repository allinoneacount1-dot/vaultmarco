import { createContext, useContext, useSyncExternalStore } from "react";
import {
  type WatchItem,
  type WatchlistPersistence,
  type WatchlistRepository,
  createLocalWatchlistRepository,
} from "@/lib/watchlist";

/**
 * The repository the UI talks to. Defaults to the browser-local one; a
 * provider can inject another (tests today, a cloud-synced one later)
 * without any UI change.
 */
export const WatchlistRepositoryContext = createContext<WatchlistRepository | null>(null);

let localRepository: WatchlistRepository | null = null;

function browserStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null; // storage access itself can throw (blocked cookies / sandboxed frames)
  }
}

function defaultRepository(): WatchlistRepository {
  localRepository ??= createLocalWatchlistRepository(
    browserStorage(),
    typeof window !== "undefined" ? window : undefined,
  );
  return localRepository;
}

const EMPTY: readonly WatchItem[] = [];

export function useWatchlist(): {
  items: readonly WatchItem[];
  persistence: WatchlistPersistence;
  isWatched: (key: string) => boolean;
  watch: (token: { chainId: string; address: string }) => boolean;
  unwatch: (key: string) => void;
} {
  const repo = useContext(WatchlistRepositoryContext) ?? defaultRepository();
  const items = useSyncExternalStore(repo.subscribe, repo.list, () => EMPTY);
  return {
    items,
    persistence: repo.persistence(),
    isWatched: (key) => items.some((i) => i.key === key),
    watch: repo.add,
    unwatch: repo.remove,
  };
}
