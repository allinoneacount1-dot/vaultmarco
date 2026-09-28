import { clockLabel } from "@/lib/intelligence/freshness";

/**
 * A real observation time: `<time dateTime>` + 24 h clock, in the desk's
 * tabular mono. Unknown → "—" (with the prefix, so the sentence still reads).
 * Shared by every intelligence view.
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
  const lead = prefix ? `${prefix} ` : "";
  if (at == null || !Number.isFinite(at)) {
    return <span className={`mono-data ${className}`}>{lead}—</span>;
  }
  return (
    <time dateTime={new Date(at).toISOString()} className={`mono-data ${className}`}>
      {lead}
      {clockLabel(at)}
    </time>
  );
}
