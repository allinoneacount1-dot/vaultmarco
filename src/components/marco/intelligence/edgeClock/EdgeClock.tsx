import { useMemo } from "react";
import { Zone } from "@/components/marco/desk";
import { IntelligenceShell } from "@/components/marco/intelligence/IntelligenceShell";
import { type FocusEvidence, FocusGate } from "@/components/marco/intelligence/shared/FocusGate";
import { FreshnessNote } from "@/components/marco/intelligence/shared/FreshnessNote";
import { RelatedViews } from "@/components/marco/intelligence/shared/links";
import { ObservedTime } from "@/components/marco/intelligence/shared/ObservedTime";
import { RecordingSince } from "@/components/marco/intelligence/shared/RecordingSince";
import { useNow } from "@/hooks/useIntelligence";
import type { EvidenceEvent } from "@/lib/intelligence/events";
import { ageLabel } from "@/lib/intelligence/freshness";
import { shortAddress } from "@/lib/search";
import { type EdgeClockModel, edgeClockModel } from "@/lib/intelligence/edgeClock";
import { factLabel, valueText } from "@/lib/intelligence/trace";
import { SinceOrigin } from "./SinceOrigin";
import { WhyThisClock } from "./WhyThisClock";

/** EDGE CLOCK — "How old is this move?" for the selected asset. */
export function EdgeClockPage() {
  return (
    <IntelligenceShell feature="edge-clock">
      <FocusGate what="how old its current move is">{(ev) => <ClockBody ev={ev} />}</FocusGate>
    </IntelligenceShell>
  );
}

function ClockBody({ ev }: { ev: FocusEvidence }) {
  // Derived from events only — the origin never depends on render time.
  const model = useMemo(() => edgeClockModel(ev.track, ev.events), [ev.track, ev.events]);
  return (
    <div className="flex flex-col gap-6 lg:gap-8" data-testid="clock-body">
      <div className="order-last lg:order-first">
        <RelatedViews search={ev.search} views={["moment", "trace"]} />
      </div>
      <FreshnessNote fresh={ev.fresh} what="The clock's evidence" />
      {model.origin ? <ActiveClock model={model} ev={ev} /> : <NoClock model={model} ev={ev} />}
      {model.earlier && <EarlierChange e={model.earlier} />}
    </div>
  );
}

/** Age since the origin — the only thing that ticks (display only). */
function Age({ from }: { from: number }) {
  const now = useNow();
  return (
    <span
      role="timer"
      aria-live="off"
      className="mono-data block text-[52px] leading-none font-medium tracking-[-0.01em] text-(--bone) sm:text-[68px] lg:text-[84px]"
      data-testid="edge-age"
      data-origin={from}
    >
      {ageLabel(now - from)}
    </span>
  );
}

function ActiveClock({ model, ev }: { model: EdgeClockModel; ev: FocusEvidence }) {
  const o = model.origin!;
  const stale = ev.fresh.state === "stale";
  return (
    <>
      <Zone index="01" label="EDGE AGE" meta="OBSERVED THIS SESSION · MARCOVAULT RECEIVE TIMES">
        <section
          aria-label="Edge clock"
          className="mv-panel grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10"
          data-testid="edge-clock"
          data-state="active"
        >
          <div className="min-w-0 space-y-4">
            <p className="mono-label text-[9px]!">
              FIRST OBSERVED STRUCTURAL CHANGE · <span className="text-(--gold)">ACTIVE</span>
            </p>
            <Age from={o.observedAt} />
            <p className="font-mono text-[10px] tracking-[0.14em] text-(--muted-2)">
              SINCE <ObservedTime at={o.observedAt} className="text-(--gold)" /> OBSERVED · AGE
              UPDATES EVERY SECOND FROM A FIXED ORIGIN
            </p>
            <div className="hairline-t space-y-1.5 pt-4">
              <p className="font-display text-[15px] font-semibold uppercase tracking-[0.04em] text-(--bone) lg:text-[17px]">
                {factLabel(o)}
              </p>
              <p className="mono-data text-[12px] text-(--muted-2)">{valueText(o)}</p>
              <p className="font-mono text-[9.5px] leading-relaxed text-(--faint)">
                OBSERVED POOL {o.pairAddress ? shortAddress(o.pairAddress) : "—"}
                {o.dexId ? ` · ${o.dexId.toUpperCase()}` : ""} · {o.source}
              </p>
              <p className="font-mono text-[9.5px] leading-relaxed text-(--faint)">
                STILL HELD AT THE LATEST OBSERVATION <ObservedTime at={o.lastObservedAt} /> ·{" "}
                {ageLabel(model.observedActiveMs)} OF OBSERVATIONS
                {stale ? " · LATEST OBSERVATION IS STALE — ACTIVITY AFTER IT IS UNKNOWN" : ""}
              </p>
            </div>
          </div>
          <div className="min-w-0">
            <WhyThisClock model={model} />
          </div>
        </section>
      </Zone>
      <InProgressNote list={model.inProgress} />
      <Zone
        index="02"
        label="EVIDENCE SINCE THE ORIGIN"
        meta="SAME OBSERVED POOL · TWO REAL OBSERVATIONS"
      >
        <SinceOrigin model={model} />
      </Zone>
    </>
  );
}

function NoClock({ model, ev }: { model: EdgeClockModel; ev: FocusEvidence }) {
  const ended = model.earlier != null;
  return (
    <>
      <Zone index="01" label="EDGE AGE" meta="OBSERVED THIS SESSION · MARCOVAULT RECEIVE TIMES">
        <section
          aria-label="Edge clock"
          className="mv-panel p-4 sm:p-6"
          data-testid="edge-clock"
          data-state={ended ? "ended" : "none"}
        >
          <p className="mono-label text-[9px]!">FIRST OBSERVED STRUCTURAL CHANGE</p>
          <p className="mono-data mt-4 text-[40px] leading-none text-(--faint) sm:text-[52px]">
            <span aria-hidden>—</span>
            <span className="sr-only">No clock.</span>
          </p>
          <p
            className="font-display mt-4 text-[15px] font-semibold uppercase tracking-[0.04em] text-(--muted-2) lg:text-[18px]"
            data-testid="edge-none"
          >
            {ended
              ? "NO ACTIVE STRUCTURAL CHANGE AT THE LATEST OBSERVATION"
              : "NO STRUCTURAL CHANGE OBSERVED THIS SESSION"}
          </p>
          <p className="mt-3 max-w-[72ch] font-mono text-[10px] leading-relaxed text-(--faint)">
            The clock starts only at a real, observed structural change — a later observation of the
            same pool meeting a rule an earlier one did not. It never starts at page load, session
            start or an asset's first observation. Observing this asset since{" "}
            <ObservedTime at={ev.track.observations[0].observedAt} /> · <RecordingSince /> ·{" "}
            {ev.track.observations.length} observation
            {ev.track.observations.length === 1 ? "" : "s"}.
          </p>
        </section>
      </Zone>
      <InProgressNote list={model.inProgress} />
    </>
  );
}

function InProgressNote({ list }: { list: EvidenceEvent[] }) {
  if (list.length === 0) return null;
  return (
    <p
      className="hairline px-3 py-2 font-mono text-[9.5px] leading-relaxed text-(--faint)"
      data-testid="edge-in-progress"
    >
      ALREADY IN PROGRESS WHEN FIRST OBSERVED (START NOT SEEN — NEVER AN ORIGIN):{" "}
      {list.map((e) => factLabel(e)).join(" · ")}
    </p>
  );
}

/** An earlier OBSERVED structural change that is no longer active — secondary context. */
function EarlierChange({ e }: { e: EvidenceEvent }) {
  return (
    <section
      aria-label="Earlier observed structural change"
      className="hairline-t pt-4"
      data-testid="edge-earlier"
    >
      <p className="mono-label text-[9px]!">
        EARLIER OBSERVED STRUCTURAL CHANGE · NO LONGER ACTIVE · CONTEXT ONLY
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <ObservedTime at={e.observedAt} className="text-[13px] text-(--muted-2)" />
        <span className="font-mono text-[11px] font-semibold tracking-[0.08em] text-(--muted-2)">
          {factLabel(e)}
        </span>
        <span className="mono-data text-[11px] text-(--faint)">{valueText(e)}</span>
      </div>
      <p className="mt-1 font-mono text-[9.5px] text-(--faint)">
        LAST HELD <ObservedTime at={e.lastObservedAt} /> · OBSERVED POOL{" "}
        {e.pairAddress ? shortAddress(e.pairAddress) : "—"} · NOT THE CLOCK'S ORIGIN
      </p>
    </section>
  );
}
