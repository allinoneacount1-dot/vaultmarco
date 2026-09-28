import { StateDot } from "@/components/marco/desk";
import { useAssetTrack, useLanes, useNow } from "@/hooks/useIntelligence";
import { pageLaneState } from "@/lib/intelligence/changeQueueView";
import {
  FRESHNESS_TEXT,
  ageLabel,
  assetFreshness,
  clockLabel,
  freshnessDeskState,
} from "@/lib/intelligence/freshness";
import { STATE_TEXT, type DeskState } from "@/lib/deskState";

/**
 * The only parts of the Change Queue that follow the 1 s clock. Each is a
 * leaf that subscribes to the shared ticker itself, so a second passing
 * re-renders a few text nodes per row — never the list or a row.
 */

/** Literal classes (Tailwind only emits classes it can read in source). */
const DOT_TONE: Record<DeskState, string> = {
  loading: "text-(--faint)",
  live: "text-(--gold)",
  degraded: "text-(--champagne)",
  stale: "text-(--champagne)",
  offline: "text-(--down)",
};

/** now − at as an exact age ("07m 14s"); an unknown or future time renders "—". */
export function Age({ at }: { at: number }) {
  const now = useNow();
  return <>{ageLabel(now - at)}</>;
}

const REASON_TEXT: Record<string, string> = {
  PROVIDER_FAILED: "LANE FAILED SINCE",
  SLOT_UNRESOLVED: "PAIR SLOT UNRESOLVED",
  AGE: "NO NEW OBSERVATION",
  PARTIAL: "PARTIAL ROUND",
};

/**
 * One asset's provider state + freshness (the foundation's assetFreshness):
 * a stale asset reads STALE with its reason and is never shown LIVE.
 */
export function RowFreshness({ assetKey }: { assetKey: string }) {
  const track = useAssetTrack(assetKey);
  const lanes = useLanes();
  const now = useNow();
  const f = assetFreshness(track, lanes, now);
  const dot = freshnessDeskState(f.state);
  const reason = f.state === "stale" || f.state === "degraded" ? REASON_TEXT[f.reason] : null;
  return (
    <span
      className="flex min-w-0 flex-col gap-0.5 font-mono text-[10px] tracking-[0.12em]"
      data-testid="row-state"
      data-state={f.state}
      data-reason={f.reason}
    >
      <span className="flex items-center gap-1.5 text-(--bone)">
        {dot && <StateDot state={dot} className={DOT_TONE[dot]} />}
        {FRESHNESS_TEXT[f.state]}
      </span>
      <span className="text-(--faint)">
        {f.observedAt == null ? (
          "—"
        ) : (
          <>
            OBS <time dateTime={new Date(f.observedAt).toISOString()}>{ageLabel(f.ageMs)} AGO</time>
          </>
        )}
        {reason ? ` · ${reason}` : ""}
      </span>
    </span>
  );
}

const LANE_TEXT = { realtime: "REALTIME", universe: "UNIVERSE" } as const;

/** Page-level state of the two existing DexScreener lanes the queue is built from. */
export function QueueLaneState() {
  const lanes = useLanes();
  const now = useNow();
  const { state, lanes: views } = pageLaneState(lanes, now);
  return (
    <p
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-[0.14em] text-(--muted-2)"
      data-testid="queue-state"
      data-state={state}
    >
      <span className="flex items-center gap-2 text-(--bone)">
        <StateDot state={state} className={DOT_TONE[state]} />
        LANES {STATE_TEXT[state]}
      </span>
      {views.map((v) => (
        <span key={v.lane} data-testid={`lane-${v.lane}`} data-state={v.state}>
          DEXSCREENER {LANE_TEXT[v.lane]} {STATE_TEXT[v.state]}
          {v.at != null && (
            <>
              {" · "}
              <time dateTime={new Date(v.at).toISOString()}>{clockLabel(v.at)}</time>
            </>
          )}
          {v.code && v.state !== "live" ? ` · ${v.code}` : ""}
        </span>
      ))}
    </p>
  );
}
