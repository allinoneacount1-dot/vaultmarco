import type { TraceWindowId, TraceWindowOption } from "@/lib/intelligence/trace";

/**
 * The trace window filter: the desk's segmented rail (same glass classes as
 * `Segmented`), plus a disabled state the shared control does not have. A
 * window the session history does not span is disabled and says why, in
 * visible text — never a window that would pretend to more history.
 */
export function WindowFilter({
  options,
  value,
  onChange,
}: {
  options: readonly TraceWindowOption[];
  value: TraceWindowId;
  onChange: (id: TraceWindowId) => void;
}) {
  const disabled = options.filter((o) => !o.enabled);
  const reasonId = "trace-window-reason";
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <div
        role="group"
        aria-label="Trace window"
        aria-describedby={disabled.length ? reasonId : undefined}
        className="mv-glass-rail inline-flex max-w-full gap-0.5 self-start p-0.5"
        data-testid="trace-windows"
      >
        {options.map((o) => {
          const active = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => o.enabled && onChange(o.id)}
              aria-pressed={active}
              disabled={!o.enabled}
              title={o.reason ? `${o.id} unavailable — ${o.reason.toLowerCase()}` : undefined}
              data-window={o.id}
              className="mv-glass-seg min-h-9 shrink-0 cursor-pointer px-3 font-mono text-[10px] tracking-[0.14em] disabled:cursor-not-allowed disabled:text-(--faint) disabled:line-through disabled:decoration-(--hairline-strong) lg:min-h-8"
            >
              {o.id}
            </button>
          );
        })}
      </div>
      {disabled.length > 0 && (
        <p
          id={reasonId}
          className="font-mono text-[9px] leading-relaxed tracking-[0.12em] text-(--faint)"
          data-testid="trace-window-reason"
        >
          {disabled.map((o) => o.id).join(" · ")} NOT SPANNED YET — {disabled[0].reason}
        </p>
      )}
    </div>
  );
}
