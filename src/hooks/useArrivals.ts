import { useRef } from "react";

const ARRIVAL_MS = 1400;

/**
 * Keys that appeared after the list's first real render within `scope`
 * (e.g. a radar mode). The first render of a scope marks nothing — loading a
 * list or switching tabs is not "new data".
 */
export function useArrivals(keys: readonly string[], ready: boolean, scope = ""): Set<string> {
  const seen = useRef<{ scope: string; at: Map<string, number> } | null>(null);
  const now = Date.now();
  if (ready) {
    if (!seen.current || seen.current.scope !== scope) {
      seen.current = { scope, at: new Map(keys.map((k) => [k, 0])) };
    } else {
      for (const k of keys) if (!seen.current.at.has(k)) seen.current.at.set(k, now);
    }
  }
  const fresh = new Set<string>();
  if (seen.current && seen.current.scope === scope) {
    for (const k of keys) {
      const t = seen.current.at.get(k) ?? 0;
      if (t > 0 && now - t < ARRIVAL_MS) fresh.add(k);
    }
  }
  return fresh;
}
