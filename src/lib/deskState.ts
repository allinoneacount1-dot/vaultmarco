/** The desk's status vocabulary: one word per provider state, everywhere. */
export type DeskState = "loading" | "live" | "degraded" | "stale" | "offline";

export const STATE_TEXT: Record<DeskState, string> = {
  loading: "CONNECTING",
  live: "LIVE",
  degraded: "DEGRADED",
  stale: "STALE",
  offline: "OFFLINE",
};

/** "BOOST FEED · LIVE" — the title states the feed's real provider status. */
export function feedState(status: DeskState): string {
  return STATE_TEXT[status];
}
