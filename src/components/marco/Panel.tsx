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
    <div className="glass-strong border-glow rounded-2xl p-5 scanline">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
        <span className="text-[10px] font-mono tracking-[0.3em] text-muted-foreground">
          {title}
        </span>
        <Icon className="size-3.5 text-primary" />
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
    <div className="flex items-center justify-between text-[11px] font-mono">
      <span className="text-foreground">{label}</span>
      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">
        {mid}
      </span>
      <span className={ok === false ? "text-red-400" : "text-accent"}>{value}</span>
    </div>
  );
}
