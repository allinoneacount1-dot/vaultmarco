import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { AssetTrack } from "@/lib/intelligence/facts";
import { type AssetFreshness, clockLabel } from "@/lib/intelligence/freshness";
import type { FocusSearch } from "@/lib/intelligence/identityCodec";

const EMPTY_TEXT: Record<string, { head: string; body: string }> = {
  none: {
    head: "NO ASSET SELECTED",
    body: "Select an asset above, or open one from THE MOMENT or the CHANGE QUEUE. Nothing is evaluated without one.",
  },
  loading: {
    head: "CONNECTING",
    body: "Waiting for the first DexScreener round of this session. Nothing is evaluated yet.",
  },
  offline: {
    head: "OFFLINE",
    body: "No DexScreener round has succeeded this session, so there is no observation to evaluate.",
  },
  unobserved: {
    head: "NOT IN OBSERVED UNIVERSE",
    body: "MARCOVAULT has not observed this asset this session. Nothing is evaluated and nothing is substituted.",
  },
};

/**
 * Renders `children` only when the focus asset has at least one real session
 * observation; otherwise the state that explains why there is nothing.
 */
export function FocusGate({
  hasFocus,
  track,
  fresh,
  children,
}: {
  hasFocus: boolean;
  track: AssetTrack | null;
  fresh: AssetFreshness;
  children: React.ReactNode;
}) {
  const kind = !hasFocus
    ? "none"
    : track && track.observations.length > 0
      ? null
      : fresh.state === "loading" || fresh.state === "offline"
        ? fresh.state
        : "unobserved";
  if (!kind) return <>{children}</>;
  const t = EMPTY_TEXT[kind];
  return (
    <section
      className="hairline-t hairline-b py-6"
      aria-label="Evidence"
      data-testid="intel-empty"
      data-state={kind}
    >
      <p className="mono-data text-[20px] text-(--faint)">
        <span aria-hidden>—</span>
      </p>
      <p className="mono-label mt-3 text-[10px]! text-(--muted-2)!">{t.head}</p>
      <p className="mt-2 max-w-[56ch] text-[13px] leading-relaxed text-(--muted-2)">{t.body}</p>
    </section>
  );
}

const STALE_REASON: Record<string, string> = {
  PROVIDER_FAILED: "A LATER PROVIDER ROUND FAILED",
  SLOT_UNRESOLVED: "ITS PAIR WAS MISSING FROM A LATER ROUND",
  AGE: "OLDER THAN ITS LANE'S LIVE WINDOW",
};

/**
 * When the evidence is not LIVE, say so next to it: the page still shows the
 * last real observation, labelled as such, never as current.
 */
export function EvidenceStatus({ fresh }: { fresh: AssetFreshness }) {
  if (fresh.state !== "stale" && fresh.state !== "degraded") return null;
  const text =
    fresh.state === "stale"
      ? `STALE · SHOWN FROM THE LAST OBSERVATION ${clockLabel(fresh.observedAt)} · ${STALE_REASON[fresh.reason] ?? fresh.reason} · NO NEWER OBSERVATION`
      : `DEGRADED · THE LATEST OBSERVATION ${clockLabel(fresh.observedAt)} CAME FROM A PARTIAL PROVIDER ROUND`;
  return (
    <p
      role="status"
      className="border-l border-(--champagne) pl-3 font-mono text-[10px] leading-relaxed tracking-[0.12em] text-(--champagne)"
      data-testid="evidence-status"
      data-state={fresh.state}
    >
      {text}
    </p>
  );
}

/** Link back to THE MOMENT, carrying the focus asset (chain + address). */
export function MomentLink({ search }: { search: FocusSearch }) {
  return (
    <Link
      to="/dashboard/moment"
      search={search}
      className="mv-glass inline-flex h-9 items-center gap-2 px-3 text-(--muted-2)"
      data-testid="back-to-moment"
    >
      <ArrowLeft className="size-3.5" aria-hidden />
      <span className="mono-label text-[9px]!">THE MOMENT</span>
    </Link>
  );
}
