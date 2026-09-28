import type {
  AssetObservation,
  AssetTrack,
  IngestBatch,
  LanePoint,
  LaneTrack,
  SessionState,
} from "./facts";
import {
  type Lane,
  SESSION_MAX_AGE_MS,
  SESSION_MAX_ASSETS,
  SESSION_MAX_GAPS_PER_ASSET,
  SESSION_MAX_LANE_POINTS,
  SESSION_MAX_OBSERVATIONS_PER_ASSET,
  SESSION_MAX_RADAR_PER_ASSET,
} from "./rules";

/**
 * SESSION HISTORY — a bounded, in-memory record of real observations made
 * while a dashboard route is open. "OBSERVED THIS SESSION", never more.
 *
 *   Source      the two EXISTING DexScreener lanes (realtime 30 s, universe 60 s);
 *               the recorder adds no request.
 *   Session     starts when the recorder FIRST MOUNTS (the first dashboard
 *               route opens: `startRecording`), never at app boot; nothing
 *               observed before it is ever recorded, so it can never imply
 *               history that predates the session. Unmounts / remounts are
 *               kept as `recording` intervals so pages can say
 *               "RECORDING SINCE … · PAUSED …".
 *   Duration    rolling SESSION_MAX_AGE_MS (60 min) behind the newest
 *               observation; the session itself lasts as long as the page.
 *   Bounds      SESSION_MAX_OBSERVATIONS_PER_ASSET (150) per asset,
 *               SESSION_MAX_ASSETS (96) assets → ≤ 14,400 observations; lane
 *               status SESSION_MAX_LANE_POINTS (240) per lane.
 *   Memory      measured ≈ 1.2 KB per observation (observation + its
 *               PairSnapshot, V8 heap). Typical: 4 canonical × 120 + ~36
 *               universe × 60 ≈ 2,600 obs ≈ 3 MB. Reachable worst case at the
 *               real cadences (4 × 120 + 92 × 60 in 60 min) ≈ 6,000 obs ≈
 *               7.5 MB. Theoretical hard cap 14,400 obs ≈ 17 MB.
 *   Eviction    on every ingest, in this order: (1) anything older than
 *               newest − max age; (2) the oldest observations of an asset
 *               beyond its cap; (3) assets with no observation left;
 *               (4) least-recently-observed assets beyond the asset cap
 *               (ties: assetKey order).
 *
 * The reducer is pure (same state + batch → same state); `SessionStore`
 * wraps it for React's useSyncExternalStore. A later durable history can
 * replace the store behind the same `SessionState` shape.
 */

const LANES: readonly Lane[] = ["realtime", "universe"];

export function createSessionState(startedAt: number): SessionState {
  return {
    startedAt,
    recording: Number.isFinite(startedAt) ? [{ from: startedAt, to: null }] : [],
    lanes: { realtime: { firstOkAt: null, points: [] }, universe: { firstOkAt: null, points: [] } },
    assets: new Map(),
    newestAt: null,
    rejected: { preSession: 0, paused: 0, invalid: 0, duplicate: 0 },
    revision: 0,
  };
}

const validTime = (t: unknown): t is number => typeof t === "number" && Number.isFinite(t) && t > 0;

/** Identity of one observation inside an asset: the same pair at the same receive time. */
export function observationId(o: Pick<AssetObservation, "pairAddress" | "observedAt">): string {
  return `${o.pairAddress ?? "∅"}@${o.observedAt}`;
}

/** Insert keeping observedAt order (timestamp inversion tolerated); merge duplicates. */
function insertObservation(
  list: AssetObservation[],
  o: AssetObservation,
): { list: AssetObservation[]; duplicate: boolean } {
  const id = observationId(o);
  const at = list.findIndex((x) => observationId(x) === id);
  if (at >= 0) {
    const prev = list[at];
    const lanes = LANES.filter((l) => prev.lanes.includes(l) || o.lanes.includes(l));
    const sources = [...prev.sources];
    for (const s of o.sources) if (!sources.includes(s)) sources.push(s);
    if (lanes.length === prev.lanes.length && sources.length === prev.sources.length) {
      return { list, duplicate: true };
    }
    const next = list.slice();
    next[at] = { ...prev, lanes, sources, quoteAddress: prev.quoteAddress ?? o.quoteAddress };
    return { list: next, duplicate: true };
  }
  const next = list.slice();
  let i = next.length;
  while (i > 0 && next[i - 1].observedAt > o.observedAt) i--;
  next.splice(i, 0, o);
  return { list: next, duplicate: false };
}

function pushBounded<T>(list: readonly T[], item: T, max: number): T[] {
  const next = [...list, item];
  return next.length > max ? next.slice(next.length - max) : next;
}

/**
 * Inside a CLOSED pause (after one recording interval ended and before the
 * next began): no dashboard route was open, so nothing dated there counts as
 * observed — even a cached query result read on remount. Keeps
 * "RECORDING SINCE … · PAUSED …" literally true.
 */
export function inClosedPause(recording: SessionState["recording"], t: number): boolean {
  for (let i = 1; i < recording.length; i++) {
    const end = recording[i - 1].to;
    if (end != null && t > end && t < recording[i].from) return true;
  }
  return false;
}

/** Pure reducer: fold one normalized batch into the session. */
export function ingest(state: SessionState, batch: IngestBatch): SessionState {
  if (!validTime(batch.at)) {
    return { ...state, rejected: { ...state.rejected, invalid: state.rejected.invalid + 1 } };
  }
  const rejected = { ...state.rejected };
  const assets = new Map(state.assets);
  const touched = new Set<string>();
  let newestAt = state.newestAt;

  // Lane status point (deduplicated: the same round is never recorded twice).
  const lane: LaneTrack = state.lanes[batch.lane];
  // A round recorded before the session began (e.g. a cached pre-session
  // query error) is NOT session evidence: it never becomes a lane point, so
  // it can never be the "before" of an in-session transition.
  const preSessionPoint = batch.at < state.startedAt;
  if (preSessionPoint) rejected.preSession++;
  // A round dated inside a closed pause was not observed by this session either.
  const pausedPoint = !preSessionPoint && inClosedPause(state.recording, batch.at);
  if (pausedPoint) rejected.paused++;
  const samePoint =
    preSessionPoint ||
    pausedPoint ||
    lane.points.some((p) => p.at === batch.at && p.state === batch.state);
  const firstRoundOfLane = lane.firstOkAt == null && batch.state !== "failed";
  const nextLane: LaneTrack = samePoint
    ? lane
    : {
        firstOkAt: lane.firstOkAt ?? (batch.state !== "failed" ? batch.at : null),
        points: pushBounded(
          lane.points,
          {
            at: batch.at,
            state: batch.state,
            code: batch.code ?? null,
            issues: batch.issues ?? [],
          },
          SESSION_MAX_LANE_POINTS,
        ).sort((a, b) => a.at - b.at),
      };

  for (const o of batch.observations) {
    if (!validTime(o.observedAt) || !o.assetKey) {
      rejected.invalid++;
      continue;
    }
    if (o.observedAt < state.startedAt) {
      rejected.preSession++;
      continue;
    }
    if (inClosedPause(state.recording, o.observedAt)) {
      rejected.paused++;
      continue;
    }
    const prev = assets.get(o.assetKey);
    if (!prev) {
      const entered =
        batch.lane === "universe" && !firstRoundOfLane && !o.sources.includes("realtime");
      assets.set(o.assetKey, {
        assetKey: o.assetKey,
        chainId: o.chainId,
        address: o.address,
        firstSeenAt: o.observedAt,
        lastSeenAt: o.observedAt,
        enteredAt: entered ? o.observedAt : null,
        observations: [o],
        radar: [],
        gaps: [],
      });
      touched.add(o.assetKey);
    } else {
      const { list, duplicate } = insertObservation(prev.observations, o);
      if (duplicate) rejected.duplicate++;
      if (list !== prev.observations) {
        assets.set(o.assetKey, {
          ...prev,
          observations: list,
          firstSeenAt: Math.min(prev.firstSeenAt, o.observedAt),
          lastSeenAt: Math.max(prev.lastSeenAt, o.observedAt),
        });
        touched.add(o.assetKey);
      }
    }
    newestAt = newestAt == null ? o.observedAt : Math.max(newestAt, o.observedAt);
  }

  for (const r of batch.radar ?? []) {
    const track = assets.get(r.assetKey);
    if (!track || !validTime(r.observedAt) || r.observedAt < state.startedAt) continue;
    if (inClosedPause(state.recording, r.observedAt)) continue;
    if (track.radar.some((x) => x.kind === r.kind && x.observedAt === r.observedAt)) continue;
    const { assetKey: _k, ...firing } = r;
    const radar = pushBounded(track.radar, firing, SESSION_MAX_RADAR_PER_ASSET).sort(
      (a, b) => a.observedAt - b.observedAt,
    );
    assets.set(r.assetKey, { ...track, radar });
    touched.add(r.assetKey);
  }

  for (const g of batch.gaps ?? []) {
    const track = assets.get(g.assetKey);
    // Never observed: nothing to mark stale. Pre-session gaps are not session evidence.
    if (!track || !validTime(g.at) || g.at < state.startedAt) continue;
    if (inClosedPause(state.recording, g.at)) continue;
    if (track.gaps.some((x) => x.at === g.at && x.lane === g.lane)) continue;
    const gaps = pushBounded(
      track.gaps,
      { at: g.at, lane: g.lane, reason: g.reason },
      SESSION_MAX_GAPS_PER_ASSET,
    ).sort((a, b) => a.at - b.at);
    assets.set(g.assetKey, { ...track, gaps });
    touched.add(g.assetKey);
  }

  const laneChanged = nextLane !== lane;
  const rejectedChanged =
    rejected.invalid !== state.rejected.invalid ||
    rejected.preSession !== state.rejected.preSession ||
    rejected.paused !== state.rejected.paused ||
    rejected.duplicate !== state.rejected.duplicate;
  if (touched.size === 0 && !laneChanged && !rejectedChanged) return state;

  const lanes = laneChanged ? { ...state.lanes, [batch.lane]: nextLane } : state.lanes;
  const pruned = touched.size > 0 || newestAt !== state.newestAt ? prune(assets, newestAt) : assets;
  return {
    ...state,
    lanes,
    assets: pruned,
    newestAt,
    rejected: rejectedChanged ? rejected : state.rejected,
    revision: state.revision + 1,
  };
}

/** Apply the documented bounds. Untouched tracks keep their object identity. */
function prune(assets: Map<string, AssetTrack>, newestAt: number | null): Map<string, AssetTrack> {
  if (newestAt == null) return assets;
  const cutoff = newestAt - SESSION_MAX_AGE_MS;
  for (const [key, t] of assets) {
    let obs = t.observations;
    if (obs.length > 0 && obs[0].observedAt < cutoff)
      obs = obs.filter((o) => o.observedAt >= cutoff);
    if (obs.length > SESSION_MAX_OBSERVATIONS_PER_ASSET) {
      obs = obs.slice(obs.length - SESSION_MAX_OBSERVATIONS_PER_ASSET);
    }
    if (obs.length === 0) {
      assets.delete(key);
      continue;
    }
    if (obs === t.observations) continue;
    const firstSeenAt = obs[0].observedAt;
    assets.set(key, {
      ...t,
      observations: obs,
      firstSeenAt,
      enteredAt: t.enteredAt != null && t.enteredAt >= firstSeenAt ? t.enteredAt : null,
      radar: t.radar.filter((r) => r.observedAt >= firstSeenAt),
      gaps: t.gaps.filter((g) => g.at >= firstSeenAt),
    });
  }
  if (assets.size > SESSION_MAX_ASSETS) {
    const order = [...assets.values()].sort(
      (a, b) => a.lastSeenAt - b.lastSeenAt || (a.assetKey < b.assetKey ? -1 : 1),
    );
    for (const t of order.slice(0, assets.size - SESSION_MAX_ASSETS)) assets.delete(t.assetKey);
  }
  return assets;
}

/** Total observations held (for the documented bound). */
export function observationCount(state: SessionState): number {
  let n = 0;
  for (const t of state.assets.values()) n += t.observations.length;
  return n;
}

/**
 * Earliest observation still retained, or null. Pages say "SESSION HISTORY
 * SINCE …" from this, not from `startedAt`, once pruning has begun.
 */
export function retainedSince(state: SessionState): number | null {
  let earliest: number | null = null;
  for (const t of state.assets.values()) {
    if (earliest == null || t.firstSeenAt < earliest) earliest = t.firstSeenAt;
  }
  return earliest;
}

/**
 * The recorder mounted at `now`. The first call starts the session
 * (`startedAt = now`); later calls reopen recording after a pause. Idempotent
 * while recording.
 */
export function startRecording(state: SessionState, now: number): SessionState {
  if (!validTime(now)) return state;
  if (!Number.isFinite(state.startedAt)) {
    return {
      ...state,
      startedAt: now,
      recording: [{ from: now, to: null }],
      revision: state.revision + 1,
    };
  }
  const last = state.recording[state.recording.length - 1];
  if (last && last.to == null) return state;
  return {
    ...state,
    recording: [...state.recording, { from: Math.max(now, last?.to ?? now), to: null }],
    revision: state.revision + 1,
  };
}

/** The recorder unmounted at `now` (no dashboard route open). */
export function pauseRecording(state: SessionState, now: number): SessionState {
  const last = state.recording[state.recording.length - 1];
  if (!last || last.to != null || !validTime(now)) return state;
  return {
    ...state,
    recording: [...state.recording.slice(0, -1), { from: last.from, to: Math.max(now, last.from) }],
    revision: state.revision + 1,
  };
}

/** Closed gaps between recording intervals ("PAUSED from–to"), oldest first. */
export function recordingGaps(
  recording: SessionState["recording"],
): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = [];
  for (let i = 1; i < recording.length; i++) {
    const prev = recording[i - 1];
    if (prev.to != null && recording[i].from > prev.to) {
      out.push({ from: prev.to, to: recording[i].from });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Store — useSyncExternalStore-compatible, selector-friendly
 * ------------------------------------------------------------------ */

export class SessionStore {
  private state: SessionState;
  private readonly listeners = new Set<() => void>();

  /** Omit `startedAt` to create a store that starts on the first `start()`. */
  constructor(startedAt: number = Number.POSITIVE_INFINITY) {
    this.state = createSessionState(startedAt);
  }

  private set(next: SessionState): void {
    if (next === this.state) return;
    this.state = next;
    for (const l of this.listeners) l();
  }

  start = (now: number): void => this.set(startRecording(this.state, now));

  pause = (now: number): void => this.set(pauseRecording(this.state, now));

  getState = (): SessionState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  ingest(batch: IngestBatch): void {
    this.set(ingest(this.state, batch));
  }
}
