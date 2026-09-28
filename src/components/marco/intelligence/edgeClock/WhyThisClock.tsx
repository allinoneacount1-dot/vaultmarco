import { ChevronRight } from "lucide-react";
import { ObservedTime } from "@/components/marco/intelligence/shared/ObservedTime";
import { shortAddress } from "@/lib/search";
import type { EdgeClockModel } from "@/lib/intelligence/edgeClock";
import { eventRules, factLabel, priorText, valueText } from "@/lib/intelligence/trace";

/**
 * WHY THIS CLOCK STARTED — an inspectable disclosure of the origin: the
 * qualifying condition, the rule (threshold + horizon + origin of the rule),
 * the observed value, the prior observation and when each was observed.
 */
export function WhyThisClock({ model }: { model: EdgeClockModel }) {
  const o = model.origin;
  if (!o) return null;
  const rules = eventRules(o.type);
  const prior = priorText(o);
  const prev = model.previousObs;
  const delta = o.horizon.kind === "SESSION_DELTA";
  const rows: [string, React.ReactNode][] = [
    ["CONDITION", factLabel(o)],
    [
      "RULE",
      rules.length ? (
        <span className="block space-y-0.5">
          {rules.map((r) => (
            <span key={r.id} className="block" data-testid="why-rule">
              {r.text} · {r.horizon} · {r.source}
            </span>
          ))}
        </span>
      ) : (
        "ALPHA RADAR — ITS OWN DETERMINISTIC ROUND RULE, RECORDED AS IT FIRED"
      ),
    ],
    ["HORIZON", o.horizon.label],
    [
      "OBSERVED VALUE",
      <>
        {valueText(o)} · AT <ObservedTime at={o.observedAt} />
      </>,
    ],
    [
      delta ? "COMPARED WITH" : "PRIOR OBSERVATION",
      prior && o.priorObservedAt != null ? (
        <>
          {prior} · AT <ObservedTime at={o.priorObservedAt} />
          {delta ? "" : " · CONDITION NOT MET THERE (OR MET IN THE OTHER DIRECTION)"}
        </>
      ) : prev ? (
        <>
          OBSERVATION AT <ObservedTime at={prev.observedAt} /> · CONDITION NOT MET THERE · ITS VALUE
          WAS NOT EVALUABLE (—)
        </>
      ) : (
        "—"
      ),
    ],
    ["OBSERVED AT", <ObservedTime key="t" at={o.observedAt} prefix="OBSERVED" />],
    ["ONSET", "OBSERVED — THE CHANGE HAPPENED BETWEEN TWO REAL OBSERVATIONS OF THE SAME POOL"],
    [
      "OBSERVED POOL",
      o.pairAddress
        ? `${shortAddress(o.pairAddress)}${o.dexId ? ` · ${o.dexId.toUpperCase()}` : ""}`
        : "—",
    ],
    ["SOURCE", o.source],
    ["RULES VERSION", o.rulesVersion],
  ];
  if (o.caveat) rows.push(["CAVEAT", o.caveat]);
  return (
    <details className="group hairline" data-testid="why-clock">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 font-mono text-[10px] tracking-[0.16em] text-(--muted-2) hover:text-(--bone) [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="size-3.5 shrink-0 transition-transform duration-(--dur-micro) group-open:rotate-90 motion-reduce:transition-none"
          aria-hidden
        />
        WHY THIS CLOCK STARTED
      </summary>
      <dl className="hairline-t grid grid-cols-1 gap-x-4 gap-y-2 p-3 sm:grid-cols-[120px_minmax(0,1fr)]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-mono text-[9px] tracking-[0.18em] text-(--faint)">{k}</dt>
            <dd className="mono-data min-w-0 break-words text-[10.5px] leading-relaxed text-(--bone)">
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
