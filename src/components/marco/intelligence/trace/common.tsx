import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { StateDot } from "@/components/marco/desk";
import { useFocusAsset } from "@/hooks/useFocusAsset";
import {
  useAssetEvents,
  useAssetFreshness,
  useAssetTrack,
  useSessionInfo,
} from "@/hooks/useIntelligence";
import type { EvidenceEvent } from "@/lib/intelligence/events";
import type { AssetTrack } from "@/lib/intelligence/facts";
import type { FocusAsset, FocusSearch } from "@/lib/intelligence/identityCodec";
import {
  type AssetFreshness,
  FRESHNESS_TEXT,
  ageLabel,
  clockLabel,
  freshnessDeskState,
} from "@/lib/intelligence/freshness";

/**
 * Shared pieces of VAULT TRACE and EDGE CLOCK: the focus asset's evidence
 * (foundation hooks only), the honest non-data states, a real <time>, and
 * the cross-links that keep the same identity (chain + address).
 */

export type FocusEvidence = {
  focus: FocusAsset;
  search: FocusSearch;
  track: AssetTrack;
  events: EvidenceEvent[];
  fresh: AssetFreshness;
  startedAt: number;
};

/** A real observation time: `<time dateTime>` + 24 h clock. Unknown → "—". */
export function Time({
  at,
  className = "",
  prefix,
}: {
  at: number | null | undefined;
  className?: string;
  prefix?: string;
}) {
  if (at == null || !Number.isFinite(at)) return <span className={className}>—</span>;
  return (
    <time dateTime={new Date(at).toISOString()} className={`mono-data ${className}`}>
      {prefix ? `${prefix} ` : ""}
      {clockLabel(at)}
    </time>
  );
}

function StateBody({
  testId,
  state,
  title,
  lines,
}: {
  testId: string;
  state: AssetFreshness["state"] | "none";
  title: string;
  lines: React.ReactNode[];
}) {
  return (
    <section
      className="mv-panel p-4 sm:p-6"
      aria-label="Evidence"
      data-testid={testId}
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

/**
 * Renders `children(evidence)` only when the focus asset has at least one
 * real observation this session; otherwise the honest state: no selection,
 * CONNECTING, OFFLINE or NOT IN OBSERVED UNIVERSE. Nothing is shown as data.
 */
export function FocusGate({
  what,
  children,
}: {
  /** e.g. "THE EVIDENCE TAPE" — what would be shown. */
  what: string;
  children: (ev: FocusEvidence) => React.ReactNode;
}) {
  const { focus, search } = useFocusAsset();
  const track = useAssetTrack(focus?.assetKey);
  const events = useAssetEvents(focus?.assetKey);
  const fresh = useAssetFreshness(focus?.assetKey);
  const { startedAt } = useSessionInfo();

  if (!focus) {
    return (
      <StateBody
        testId="intel-empty"
        state="none"
        title="NO ASSET SELECTED"
        lines={[
          `Select an asset to see ${what}. Identity is chain + contract address, never a symbol.`,
        ]}
      />
    );
  }
  if (!track || track.observations.length === 0) {
    const title =
      fresh.state === "loading"
        ? "CONNECTING — WAITING FOR THE FIRST PROVIDER ROUND"
        : fresh.state === "offline"
          ? "OFFLINE — NO PROVIDER ROUND HAS SUCCEEDED THIS SESSION"
          : "NOT IN OBSERVED UNIVERSE";
    return (
      <StateBody
        testId="intel-unavailable"
        state={fresh.state}
        title={title}
        lines={[
          fresh.state === "unobserved"
            ? "MARCOVAULT has not observed this asset this session. No focus fetch is made; every metric stays —."
            : "Nothing has been received for this asset; no value is shown until a real observation arrives.",
          <>
            SESSION STARTED <Time at={startedAt} />
          </>,
        ]}
      />
    );
  }
  return <>{children({ focus, search, track, events, fresh, startedAt })}</>;
}

/**
 * STALE / DEGRADED note above the evidence: the evidence stays, labelled as
 * last known. LIVE shows nothing extra (the asset bar already says LIVE).
 */
export function FreshnessNote({ fresh, what }: { fresh: AssetFreshness; what: string }) {
  if (fresh.state !== "stale" && fresh.state !== "degraded") return null;
  const dot = freshnessDeskState(fresh.state);
  const reason =
    fresh.reason === "PROVIDER_FAILED"
      ? "a provider round failed after the latest observation"
      : fresh.reason === "SLOT_UNRESOLVED"
        ? "this pair was missing from a later provider round"
        : fresh.reason === "AGE"
          ? `the latest observation is ${ageLabel(fresh.ageMs)} old`
          : "the latest observation came from a partial provider round";
  return (
    <p
      role="note"
      className="hairline flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 font-mono text-[10px] tracking-[0.1em] text-(--champagne)"
      data-testid="freshness-note"
      data-state={fresh.state}
    >
      {dot && <StateDot state={dot} className="text-(--champagne)" />}
      <span className="font-semibold">{FRESHNESS_TEXT[fresh.state]}</span>
      <span className="text-(--muted-2)">
        — {reason}. {what} ends at the last real observation (
        <Time at={fresh.observedAt} />
        ); nothing after it is inferred.
      </span>
    </p>
  );
}

const LINK =
  "mv-glass inline-flex min-h-9 items-center gap-2 px-3 font-mono text-[10px] tracking-[0.14em] text-(--muted-2)";

/** Back to THE MOMENT (and the sibling view) with the same identity. */
export function CrossLinks({
  search,
  sibling,
}: {
  search: FocusSearch;
  sibling: "trace" | "edge-clock";
}) {
  return (
    <nav
      aria-label="Related views for this asset"
      className="flex flex-wrap items-center gap-2"
      data-testid="cross-links"
    >
      <Link to="/dashboard/moment" search={search} className={LINK} data-testid="to-moment">
        OPEN IN THE MOMENT
        <ArrowRight className="size-3" aria-hidden />
      </Link>
      {sibling === "edge-clock" ? (
        <Link
          to="/dashboard/edge-clock"
          search={search}
          className={LINK}
          data-testid="to-edge-clock"
        >
          EDGE CLOCK
          <ArrowRight className="size-3" aria-hidden />
        </Link>
      ) : (
        <Link to="/dashboard/trace" search={search} className={LINK} data-testid="to-trace">
          VAULT TRACE
          <ArrowRight className="size-3" aria-hidden />
        </Link>
      )}
    </nav>
  );
}
