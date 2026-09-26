import type { DeskState } from "@/lib/deskState";
import type { AssetTrack, LaneTrack } from "./facts";
import { type Lane, staleAfterMs } from "./rules";

/**
 * PER-ASSET FRESHNESS — the desk's state vocabulary applied to one asset.
 *
 *   loading     CONNECTING: neither lane has finished a round yet.
 *   offline     OFFLINE: no observation of the asset, and every round so
 *               far has failed (nothing was ever received).
 *   unobserved  "—" / NOT IN OBSERVED UNIVERSE: lanes answer, but this asset
 *               has never been observed this session.
 *   stale       STALE: there IS a real observation, but
 *                 (a) any round of its lane failed after it, or
 *                 (b) its canonical slot came back unresolved after it, or
 *                 (c) it is older than staleAfterMs(lane).
 *   degraded    DEGRADED: the latest observation is recent and unchallenged,
 *               but came from a partial round.
 *   live        LIVE: the latest observation is recent, unchallenged and
 *               came from a complete round.
 *
 * Only a NEW observation can move a stale asset back to live: (a) and (b)
 * compare against the latest observation's own time, and the recorder never
 * re-stamps an observation (a cache re-read de-duplicates to the same
 * observedAt), so a lane recovering without this asset keeps it stale.
 */
export type FreshnessState = "loading" | "offline" | "unobserved" | "stale" | "degraded" | "live";

export type AssetFreshness = {
  state: FreshnessState;
  /** Latest real observation time, or null. */
  observedAt: number | null;
  /** now − observedAt, or null. */
  ageMs: number | null;
  lane: Lane | null;
  reason:
    | "NO_ROUND_YET"
    | "NO_DATA"
    | "NOT_OBSERVED"
    | "PROVIDER_FAILED"
    | "SLOT_UNRESOLVED"
    | "AGE"
    | "PARTIAL"
    | "OK";
};

/** The desk word for a freshness state; "unobserved" renders as an em dash. */
export const FRESHNESS_TEXT: Record<FreshnessState, string> = {
  loading: "CONNECTING",
  offline: "OFFLINE",
  unobserved: "—",
  stale: "STALE",
  degraded: "DEGRADED",
  live: "LIVE",
};

/** Map to the desk's DeskState for StateDot etc. ("unobserved" has no dot state → null). */
export function freshnessDeskState(state: FreshnessState): DeskState | null {
  return state === "unobserved" ? null : state;
}

export function assetFreshness(
  track: AssetTrack | null | undefined,
  lanes: Record<Lane, LaneTrack>,
  now: number,
): AssetFreshness {
  const latest = track?.observations[track.observations.length - 1];
  if (!track || !latest) {
    const all = [...lanes.realtime.points, ...lanes.universe.points];
    if (all.length === 0) return none("loading", "NO_ROUND_YET");
    if (lanes.realtime.firstOkAt == null && lanes.universe.firstOkAt == null) {
      return none("offline", "NO_DATA");
    }
    return none("unobserved", "NOT_OBSERVED");
  }

  const lane: Lane = latest.lanes.includes("realtime") ? "realtime" : "universe";
  const at = latest.observedAt;
  const ageMs = Math.max(0, now - at);
  const base = { observedAt: at, ageMs, lane };

  const failedAfter = latest.lanes.some((l) =>
    lanes[l].points.some((p) => p.state === "failed" && p.at > at),
  );
  if (failedAfter) return { ...base, state: "stale", reason: "PROVIDER_FAILED" };
  if (track.gaps.some((g) => g.at > at))
    return { ...base, state: "stale", reason: "SLOT_UNRESOLVED" };
  if (ageMs > staleAfterMs(lane)) return { ...base, state: "stale", reason: "AGE" };
  if (latest.providerStatus === "degraded")
    return { ...base, state: "degraded", reason: "PARTIAL" };
  return { ...base, state: "live", reason: "OK" };
}

function none(state: FreshnessState, reason: AssetFreshness["reason"]): AssetFreshness {
  return { state, observedAt: null, ageMs: null, lane: null, reason };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Exact age, e.g. "00m 42s", "07m 14s", "1h 07m", "2d 03h". Unknown,
 * negative or non-finite → "—" (never a fabricated zero).
 */
export function ageLabel(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3_600);
  const m = Math.floor((s % 3_600) / 60);
  if (d > 0) return `${d}d ${pad(h)}h`;
  if (h > 0) return `${h}h ${pad(m)}m`;
  return `${pad(m)}m ${pad(s % 60)}s`;
}

/** 24 h clock of a real timestamp, e.g. "14:03:27"; null → "—". */
export function clockLabel(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
