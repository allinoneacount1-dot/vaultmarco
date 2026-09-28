import { useFocusAsset } from "@/hooks/useFocusAsset";
import {
  useAssetEvents,
  useAssetFreshness,
  useAssetTrack,
  useSessionInfo,
} from "@/hooks/useIntelligence";
import type { EvidenceEvent } from "@/lib/intelligence/events";
import type { AssetTrack } from "@/lib/intelligence/facts";
import type { AssetFreshness } from "@/lib/intelligence/freshness";
import type { FocusAsset, FocusSearch } from "@/lib/intelligence/identityCodec";
import { useFocusLinkSearch } from "./useFocusLinkSearch";
import { ObservedTime } from "./ObservedTime";

/**
 * The focus asset's evidence (foundation hooks only) and the honest states
 * before any exists. Shared by VAULT TRACE, EDGE CLOCK, DIVERGENCE and
 * COLLISION; THE MOMENT keeps its own richer no-selection composition.
 * No market logic lives here.
 */

export type FocusEvidence = {
  focus: FocusAsset;
  search: FocusSearch;
  track: AssetTrack;
  events: EvidenceEvent[];
  fresh: AssetFreshness;
  startedAt: number;
};

function StateBody({
  state,
  title,
  lines,
}: {
  state: AssetFreshness["state"] | "none";
  title: string;
  lines: React.ReactNode[];
}) {
  return (
    <section
      className="mv-panel p-4 sm:p-6"
      aria-label="Evidence"
      data-testid="intel-empty"
      data-state={state}
    >
      <p className="mono-label text-[9px]!">EVIDENCE</p>
      <p className="mono-data mt-3 text-[20px] text-(--faint)">
        <span aria-hidden>—</span>
        <span className="sr-only">No evidence shown.</span>
      </p>
      <p className="mt-3 font-mono text-[11px] tracking-[0.14em] text-(--muted-2)">{title}</p>
      {lines.map((l, i) => (
        <p key={i} className="mt-1.5 font-mono text-[10px] leading-relaxed text-(--faint)">
          {l}
        </p>
      ))}
    </section>
  );
}

const TITLE: Record<string, string> = {
  loading: "CONNECTING — WAITING FOR THE FIRST PROVIDER ROUND",
  offline: "OFFLINE — NO PROVIDER ROUND HAS SUCCEEDED THIS SESSION",
  unobserved: "NOT IN OBSERVED UNIVERSE",
};

/**
 * Renders `children(evidence)` only when the focus asset has at least one
 * real observation this session; otherwise the honest state (data-state):
 * none (no selection), loading (CONNECTING), offline (OFFLINE) or
 * unobserved (NOT IN OBSERVED UNIVERSE). Nothing is shown as data.
 */
export function FocusGate({
  what,
  children,
}: {
  /** e.g. "its chronological evidence tape" — what would be shown. */
  what: string;
  children: (ev: FocusEvidence) => React.ReactNode;
}) {
  const { focus } = useFocusAsset();
  const search = useFocusLinkSearch();
  const track = useAssetTrack(focus?.assetKey);
  const events = useAssetEvents(focus?.assetKey);
  const fresh = useAssetFreshness(focus?.assetKey);
  const { startedAt } = useSessionInfo();

  if (!focus) {
    return (
      <StateBody
        state="none"
        title="NO ASSET SELECTED"
        lines={[
          `Select an asset above, or open one from THE MOMENT or the CHANGE QUEUE, to see ${what}. Identity is chain + contract address, never a symbol.`,
        ]}
      />
    );
  }
  if (!track || track.observations.length === 0) {
    const state =
      fresh.state === "loading" || fresh.state === "offline" ? fresh.state : "unobserved";
    return (
      <StateBody
        state={state}
        title={TITLE[state]}
        lines={[
          state === "unobserved"
            ? "MARCOVAULT has not observed this asset this session. No focus fetch is made and nothing is substituted; every metric stays —."
            : "Nothing has been received for this asset; no value is shown until a real observation arrives.",
          <>
            SESSION STARTED <ObservedTime at={startedAt} />
          </>,
        ]}
      />
    );
  }
  return <>{children({ focus, search, track, events, fresh, startedAt })}</>;
}
