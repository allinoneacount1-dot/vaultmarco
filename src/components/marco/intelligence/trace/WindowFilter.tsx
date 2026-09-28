import { Segmented } from "@/components/marco/desk";
import type { TraceWindowId, TraceWindowOption } from "@/lib/intelligence/trace";

/**
 * The trace window filter: the desk's `Segmented` rail with its disabled
 * state. A window the session history does not span is a native disabled
 * button whose reason is its accessible description, and is also stated in
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
  return (
    <div
      className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3"
      data-testid="trace-windows"
    >
      <Segmented
        label="Trace window"
        options={options.map((o) => ({
          id: o.id,
          disabled: !o.enabled,
          reason: o.reason ? `${o.id} unavailable — ${o.reason.toLowerCase()}` : undefined,
        }))}
        value={value}
        onChange={onChange}
        className="self-start"
      />
      {disabled.length > 0 && (
        <p
          className="font-mono text-[9px] leading-relaxed tracking-[0.12em] text-(--faint)"
          data-testid="trace-window-reason"
        >
          {disabled.map((o) => o.id).join(" · ")} NOT SPANNED YET — {disabled[0].reason}
        </p>
      )}
    </div>
  );
}
