import { useMemo, useState } from "react";
import { Zone } from "@/components/marco/desk";
import { IntelligenceShell } from "@/components/marco/intelligence/IntelligenceShell";
import { shortAddress } from "@/lib/search";
import {
  type TraceModel,
  type TraceWindowId,
  buildTrace,
  factLabel,
  offsetText,
  valueText,
} from "@/lib/intelligence/trace";
import { type FocusEvidence, FocusGate } from "../shared/FocusGate";
import { FreshnessNote } from "../shared/FreshnessNote";
import { RelatedViews } from "../shared/links";
import { ObservedTime } from "../shared/ObservedTime";
import { RecordingSince } from "../shared/RecordingSince";
import { TraceTape } from "./TraceTape";
import { WindowFilter } from "./WindowFilter";

/** VAULT TRACE — "What moved first?" for the selected asset. */
export function VaultTracePage() {
  return (
    <IntelligenceShell feature="trace">
      <FocusGate what="its chronological evidence tape">{(ev) => <TraceBody ev={ev} />}</FocusGate>
    </IntelligenceShell>
  );
}

function TraceBody({ ev }: { ev: FocusEvidence }) {
  const [wanted, setWanted] = useState<TraceWindowId>("SESSION");
  const model = useMemo(
    () => buildTrace(ev.track, ev.events, wanted),
    [ev.track, ev.events, wanted],
  );
  const empty = model.rows.length === 0;
  return (
    <div className="flex flex-col gap-6 lg:gap-8" data-testid="trace-body">
      <FreshnessNote fresh={ev.fresh} what="The tape" />
      <Zone
        index="01"
        label="WHAT MOVED FIRST"
        meta="OBSERVED THIS SESSION · MARCOVAULT RECEIVE TIMES"
      >
        <FirstMoved model={model} />
      </Zone>
      <Zone index="02" label="EVIDENCE TAPE" meta="OLDEST FIRST · CHRONOLOGY, NOT CAUSE">
        <section aria-label="Evidence tape" className="mv-panel space-y-5 p-4 sm:p-5">
          <WindowFilter options={model.windows} value={model.window} onChange={setWanted} />
          {empty ? (
            <EmptyTape model={model} ev={ev} />
          ) : (
            <>
              <TraceTape rows={model.rows} />
              <TapeFooter model={model} ev={ev} />
            </>
          )}
        </section>
      </Zone>
      <RelatedViews search={ev.search} views={["moment", "edge-clock"]} />
    </div>
  );
}

/** The dominant answer: the first observed onset in view and the observed order of families. */
function FirstMoved({ model }: { model: TraceModel }) {
  const first = model.first;
  if (!first) {
    return (
      <div className="hairline-b pb-4" data-testid="trace-first" data-state="none">
        <p className="font-display text-[15px] font-semibold uppercase tracking-[0.04em] text-(--muted-2) lg:text-[17px]">
          No structural onset observed {model.window === "SESSION" ? "this session" : "in view"}
        </p>
        <p className="mt-2 max-w-[70ch] font-mono text-[10px] leading-relaxed text-(--faint)">
          {model.inProgress > 0
            ? `${model.inProgress} condition${model.inProgress === 1 ? " was" : "s were"} already in progress when first observed — the start was not seen, so no order is claimed.`
            : "An onset needs a real earlier observation showing the condition not met; none is in view yet."}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4" data-testid="trace-first" data-state="observed">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <ObservedTime at={first.observedAt} className="text-[22px] text-(--gold) lg:text-[26px]" />
        <p className="font-display text-[15px] font-semibold uppercase tracking-[0.04em] text-(--bone) lg:text-[18px]">
          {factLabel(first)}
        </p>
        <p className="mono-data text-[12px] text-(--muted-2)">{valueText(first)}</p>
      </div>
      <p className="font-mono text-[10px] tracking-[0.12em] text-(--faint)">
        FIRST OBSERVED ONSET IN VIEW · OBSERVED POOL{" "}
        {first.pairAddress ? shortAddress(first.pairAddress) : "—"}
        {model.origin && model.origin.id === first.id ? " · ALSO THE EDGE CLOCK ORIGIN" : ""}
      </p>
      {model.sequence.length > 1 && (
        <div>
          <ol
            aria-label="Order in which families were first observed"
            className="flex flex-wrap items-center gap-x-2 gap-y-2"
            data-testid="trace-sequence"
          >
            {model.sequence.map((s, i) => (
              <li key={s.family} className="flex items-center gap-2">
                {i > 0 && (
                  <span className="font-mono text-[9px] tracking-[0.14em] text-(--faint)">
                    {s.sameObservation ? "SAME OBSERVATION AS" : "OBSERVED BEFORE"}
                  </span>
                )}
                <span className="hairline inline-flex items-baseline gap-1.5 px-2 py-1 font-mono text-[10px] tracking-[0.1em]">
                  <span className={i === 0 ? "text-(--gold)" : "text-(--bone)"}>{s.family}</span>
                  <span className="text-(--faint)">
                    {i === 0 ? "FIRST" : s.sameObservation ? "SAME TIME" : offsetText(s.offsetMs)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-2 font-mono text-[9px] leading-relaxed tracking-[0.1em] text-(--faint)">
            FIRST OBSERVED ONSET PER FAMILY ON OBSERVED POOL{" "}
            {model.sequencePool ? shortAddress(model.sequencePool) : "—"} · ORDER OF OBSERVATION
            ONLY
            {model.poolSwitches > 0
              ? " · EARLIER POOLS ARE SHOWN IN THE TAPE, NOT IN THIS ORDER"
              : ""}
          </p>
        </div>
      )}
      {model.inProgress > 0 && (
        <p className="font-mono text-[9.5px] text-(--faint)">
          + {model.inProgress} IN PROGRESS WHEN FIRST OBSERVED — START NOT SEEN, NOT ORDERED
        </p>
      )}
    </div>
  );
}

function EmptyTape({ model, ev }: { model: TraceModel; ev: FocusEvidence }) {
  const session = model.window === "SESSION";
  return (
    <div className="py-6" data-testid="trace-empty">
      <p className="font-display text-[15px] font-semibold uppercase tracking-[0.04em] text-(--muted-2)">
        {session
          ? "NO EVIDENCE OBSERVED THIS SESSION"
          : `NO EVIDENCE OBSERVED IN THE LAST ${model.window}`}
      </p>
      <p className="mt-2 font-mono text-[10px] leading-relaxed text-(--faint)">
        <RecordingSince /> · {ev.track.observations.length} OBSERVATION
        {ev.track.observations.length === 1 ? "" : "S"} OF THIS ASSET SINCE{" "}
        <ObservedTime at={ev.track.observations[0].observedAt} /> · NO RULE WAS MET AND NO PROVIDER
        EVENT OCCURRED{session ? "" : " IN THIS WINDOW"}
      </p>
    </div>
  );
}

function TapeFooter({ model, ev }: { model: TraceModel; ev: FocusEvidence }) {
  const latest = ev.track.observations[ev.track.observations.length - 1];
  return (
    <p className="hairline-t pt-3 font-mono text-[9px] leading-relaxed tracking-[0.12em] text-(--faint)">
      <span data-testid="trace-source" title={latest.pairAddress ?? undefined}>
        {latest.provider.toUpperCase()} · {latest.lanes.map((l) => l.toUpperCase()).join(" + ")} ·
        POOL {latest.pairAddress ? shortAddress(latest.pairAddress) : "—"}
        {latest.snapshot.dexId ? ` · ${latest.snapshot.dexId.toUpperCase()}` : ""}
      </span>{" "}
      · {model.marketEvents} MARKET EVENT{model.marketEvents === 1 ? "" : "S"} · {model.laneEvents}{" "}
      LANE CONTEXT · {model.poolSwitches} POOL SWITCH{model.poolSwitches === 1 ? "" : "ES"} ·{" "}
      {model.window === "SESSION" ? (
        <>
          SESSION HISTORY SINCE <ObservedTime at={model.span?.from} />
        </>
      ) : (
        <>
          FROM <ObservedTime at={model.windowStart} /> TO <ObservedTime at={model.end} />
        </>
      )}{" "}
      · <RecordingSince /> · NOTHING OUTSIDE RECORDING IS KNOWN
    </p>
  );
}
