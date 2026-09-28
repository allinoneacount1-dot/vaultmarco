/** A section heading in the desk's zone voice: gold dot, mono label, hairline, meta. */
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
