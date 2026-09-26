import { LucideIcon } from "lucide-react";

/**
 * A desk module. Panels are containers, not controls: they never take hover
 * treatment — only the interactive rows inside them do.
 */
export function Panel({
  title,
  icon: Icon,
  aside,
  children,
}: {
  title: string;
  icon: LucideIcon;
  /** Header controls (e.g. a segmented source / mode switch), right-aligned. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mv-panel p-4 sm:p-5" aria-label={title}>
      <div
        className={`hairline-b mb-3 flex min-h-8 items-center justify-between gap-x-4 gap-y-2 pb-3 ${
          aside ? "flex-wrap" : ""
        }`}
      >
        <span className="mono-label flex min-w-0 items-center gap-2.5">
          <span className="size-1 shrink-0 rounded-full bg-(--gold)" />
          <span className="truncate">{title}</span>
        </span>
        {aside ?? <Icon className="size-3.5 shrink-0 text-(--faint)" strokeWidth={1.8} />}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function Row({
  label,
  mid,
  value,
  ok,
}: {
  label: string;
  mid: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="mono-data flex items-center justify-between text-[11px]">
      <span className="text-(--bone)">{label}</span>
      <span className="hairline px-1.5 py-0.5 text-[9px] text-(--faint)">{mid}</span>
      <span className={ok === false ? "text-(--down)" : "text-(--up)"}>{value}</span>
    </div>
  );
}
