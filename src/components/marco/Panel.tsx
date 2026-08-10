import { LucideIcon } from "lucide-react";

export function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="hairline bg-(--panel) p-5">
      <div className="hairline-b mb-3 flex items-center justify-between pb-3">
        <span className="mono-label flex items-center gap-2.5">
          <span className="size-1 rounded-full bg-(--gold)" />
          {title}
        </span>
        <Icon className="size-3.5 text-(--faint)" strokeWidth={1.8} />
      </div>
      <div className="space-y-2">{children}</div>
    </div>
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
