import { ObservedTime } from "@/components/marco/intelligence/shared/ObservedTime";
import { ageLabel } from "@/lib/intelligence/freshness";
import { type EdgeClockModel, PAIR_HORIZON } from "@/lib/intelligence/edgeClock";
import { factLabel, sinceText } from "@/lib/intelligence/trace";

/**
 * EVIDENCE SINCE THE ORIGIN — each metric at the origin observation and at
 * the latest observation of the SAME pool; a delta only when both are real.
 * Then the independent families whose onsets were observed since the origin.
 */
export function SinceOrigin({ model }: { model: EdgeClockModel }) {
  const origin = model.origin!;
  const latest = model.latestObs;
  const fam = model.families;
  return (
    <section aria-label="Evidence since the origin" className="mv-panel space-y-5 p-4 sm:p-5">
      <p className="font-mono text-[9.5px] leading-relaxed tracking-[0.1em] text-(--faint)">
        ORIGIN <ObservedTime at={origin.observedAt} /> → LATEST{" "}
        <ObservedTime at={latest?.observedAt} /> ·{" "}
        {latest ? ageLabel(latest.observedAt - origin.observedAt) : "—"} BETWEEN THEM
        {model.sinceBlocked ? ` · NO CHANGE COMPUTED — ${model.sinceBlocked}` : ""}
      </p>
      <ul
        className="mv-tape"
        aria-label="Metrics at the origin and at the latest observation"
        data-testid="since-metrics"
      >
        <li
          aria-hidden
          className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)] gap-x-4 pb-2 font-mono text-[9px] tracking-[0.2em] text-(--faint) sm:grid"
        >
          <span>METRIC</span>
          <span className="-mr-[0.2em] text-right">AT ORIGIN</span>
          <span className="-mr-[0.2em] text-right">LATEST</span>
          <span className="-mr-[0.2em] text-right">CHANGE</span>
        </li>
        {model.since.map((m) => {
          const t = sinceText(m);
          return (
            <li
              key={m.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 py-2.5 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)] sm:items-baseline"
              data-testid="since-metric"
              data-metric={m.id}
              data-delta={m.delta == null ? "" : String(m.delta)}
            >
              <span className="min-w-0">
                <span className="block font-mono text-[10.5px] tracking-[0.1em] text-(--bone)">
                  {m.label}
                </span>
                <span className="block font-mono text-[8.5px] leading-relaxed tracking-[0.06em] text-(--faint)">
                  {[
                    m.horizon === PAIR_HORIZON ? null : m.horizon,
                    m.missing && !model.sinceBlocked ? `— ${m.missing}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="mono-data col-start-1 row-start-2 text-[10.5px] text-(--muted-2) sm:col-start-2 sm:row-start-1 sm:text-right">
                <span className="sr-only">At origin </span>
                {t.from}
                <span className="sm:hidden"> → {t.to}</span>
              </span>
              <span className="mono-data hidden text-right text-[10.5px] text-(--muted-2) sm:block">
                <span className="sr-only">Latest </span>
                {t.to}
              </span>
              <span className="mono-data col-start-2 row-span-2 row-start-1 self-center text-right text-[11.5px] text-(--bone) sm:col-start-4 sm:row-span-1 sm:self-baseline">
                <span className="sr-only">Change </span>
                {t.delta}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="hairline-t pt-4" data-testid="since-families" data-count={fam?.count ?? 0}>
        <p className="font-mono text-[10.5px] tracking-[0.12em] text-(--bone)">
          {fam ? fam.count : 0} INDEPENDENT FAMIL{fam?.count === 1 ? "Y" : "IES"} OBSERVED CHANGING
          SINCE THE ORIGIN
        </p>
        <p className="mt-1 font-mono text-[9px] leading-relaxed tracking-[0.08em] text-(--faint)">
          ONE VOTE PER FAMILY · SAME OBSERVED POOL · ONSETS AT OR AFTER THE ORIGIN · CO-OCCURRENCE
          IN TIME, NOT CAUSE
        </p>
        {fam && (
          <ol className="mt-3 space-y-1.5" aria-label="Families observed since the origin">
            {fam.families.map((f) => (
              <li
                key={f.family}
                className="grid grid-cols-[76px_minmax(0,1fr)] gap-x-3 font-mono text-[10px] sm:grid-cols-[84px_120px_minmax(0,1fr)]"
              >
                <ObservedTime at={f.firstAt} className="text-(--muted-2)" />
                <span className="text-(--bone)">{f.family}</span>
                <span className="col-start-2 truncate text-(--faint) sm:col-start-3">
                  {f.events.map((e) => factLabel(e)).join(" · ")}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
