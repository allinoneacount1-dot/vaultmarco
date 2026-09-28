import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { FocusSearch } from "@/lib/intelligence/identityCodec";
import { clockLabel } from "@/lib/intelligence/freshness";
import { type IntelligenceFeature, featureById } from "../features";

/**
 * Small shared pieces of The Moment: a real <time> for observation
 * timestamps, a section heading in the desk's zone voice, and the link that
 * carries the focus identity (chain + address) to a full view.
 */

export function ObservedTime({
  at,
  className = "",
  prefix,
}: {
  at: number | null | undefined;
  className?: string;
  prefix?: string;
}) {
  if (at == null || !Number.isFinite(at)) {
    return <span className={className}>{prefix ? `${prefix} ` : ""}—</span>;
  }
  return (
    <time dateTime={new Date(at).toISOString()} className={className}>
      {prefix ? `${prefix} ` : ""}
      {clockLabel(at)}
    </time>
  );
}

export function SectionHead({
  id,
  label,
  meta,
}: {
  id: string;
  label: string;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span aria-hidden className="size-1 shrink-0 rounded-full bg-(--gold)" />
      <h2 id={id} className="mono-label shrink-0 font-mono! text-[10px]! text-(--muted-2)!">
        {label}
      </h2>
      <span aria-hidden className="hidden h-px min-w-6 flex-1 bg-(--hairline) sm:block" />
      {meta && (
        <span className="font-mono text-[9px] tracking-[0.16em] text-(--faint)">{meta}</span>
      )}
    </div>
  );
}

/** Link to a full intelligence view, preserving the selected asset in the URL. */
export function ViewLink({
  feature,
  search,
  testId,
}: {
  feature: IntelligenceFeature["id"];
  search: FocusSearch;
  testId: string;
}) {
  const f = featureById(feature);
  return (
    <Link
      to={f.path}
      search={search}
      data-testid={testId}
      className="group -my-1 inline-flex min-h-9 items-center gap-1.5 py-1 font-mono text-[9px] tracking-[0.18em] text-(--muted-2) transition-colors duration-(--dur-micro) hover:text-(--gold) focus-visible:text-(--gold) focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--gold)"
    >
      OPEN {f.label.toUpperCase()}
      <ArrowRight aria-hidden className="size-3" strokeWidth={1.8} />
    </Link>
  );
}
