import type { EvidenceEvent } from "@/lib/intelligence/events";
import { ageLabel } from "@/lib/intelligence/freshness";
import {
  ONSET_TEXT,
  TYPE_TEXT,
  directionGlyph,
  directionText,
  eventRules,
  eventValueText,
  evidenceLines,
  ruleThresholdText,
} from "@/lib/intelligence/moment";
import { INTELLIGENCE_RULES_VERSION } from "@/lib/intelligence/rules";
import { shortAddress } from "@/lib/search";
import { ObservedTime, SectionHead } from "./parts";

/**
 * WHAT CHANGED — the main instrument. The asset's currently active evidence
 * events, newest onset first, each with its number, the rule (threshold +
 * horizon) that produced it, how much of its start was actually seen, and
 * when it was observed. Presentation only: every value comes from the event.
 */
export function WhatChanged({
  changes,
  now,
  asOf,
}: {
  changes: EvidenceEvent[];
  now: number;
  /** Latest observation of the asset: "active" means true at this time. */
  asOf: number | null;
}) {
  return (
    <section
      aria-labelledby="moment-what-changed"
      className="mv-panel p-4 sm:p-5"
      data-testid="moment-changes"
      data-count={changes.length}
    >
      <SectionHead
        id="moment-what-changed"
        label="WHAT CHANGED"
        meta={
          <>
            ACTIVE AT <ObservedTime at={asOf} prefix="OBSERVATION" /> · RULES{" "}
            {INTELLIGENCE_RULES_VERSION.toUpperCase()}
          </>
        }
      />
      {changes.length === 0 ? (
        <div className="py-8 sm:py-10" data-testid="moment-no-change">
          <p className="font-mono text-[12px] tracking-[0.14em] text-(--bone)">
            NO QUALIFYING CHANGE OBSERVED THIS SESSION
          </p>
          <p className="mt-2 max-w-[62ch] text-[12px] leading-relaxed text-(--muted-2)">
            No price, volume, transaction, liquidity, boost or radar rule holds at the latest
            observation. Nothing is inferred between observations.
          </p>
        </div>
      ) : (
        <ol className="mv-tape mt-3" aria-label="Active changes, newest first">
          {changes.map((e) => (
            <ChangeRow key={e.id} e={e} now={now} />
          ))}
        </ol>
      )}
    </section>
  );
}

function ChangeRow({ e, now }: { e: EvidenceEvent; now: number }) {
  const rules = eventRules(e.type);
  const lines = evidenceLines(e);
  const observed = e.onset === "OBSERVED";
  return (
    <li
      className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 py-4 sm:grid-cols-[84px_minmax(0,1fr)] sm:gap-x-5"
      data-testid="moment-change"
      data-type={e.type}
      data-onset={e.onset}
    >
      {/* Temporal anchor: the onset observation */}
      <div className="border-r border-(--hairline) pr-3">
        <ObservedTime at={e.observedAt} className="mono-data block text-[11px] text-(--gold)" />
        <span className="mt-1 block font-mono text-[9px] tracking-[0.12em] text-(--faint)">
          {ageLabel(now - e.observedAt)} AGO
        </span>
      </div>

      <div className="min-w-0 space-y-2.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="mv-chip text-(--muted-2)">{e.family}</span>
          <h3 className="font-mono text-[12px] font-semibold tracking-[0.1em] text-(--bone)">
            {TYPE_TEXT[e.type]}
          </h3>
          <span className="font-mono text-[10px] tracking-[0.12em] text-(--champagne)">
            <span aria-hidden>{directionGlyph(e.direction)} </span>
            {directionText(e.type, e.direction)}
          </span>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span
            className="mono-data text-[22px] leading-none text-(--bone) sm:text-[26px]"
            data-testid="change-value"
          >
            {eventValueText(e)}
          </span>
          <span className="font-mono text-[9px] tracking-[0.16em] text-(--faint)">
            {e.horizon.label}
          </span>
        </div>

        {lines.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
            {lines.map((l) => (
              <div key={l.key} className="min-w-0">
                <dt className="truncate font-mono text-[8.5px] tracking-[0.16em] text-(--faint)">
                  {l.label}
                </dt>
                <dd className="mono-data truncate text-[11px] text-(--muted-2)">{l.text}</dd>
              </div>
            ))}
          </dl>
        )}

        <p
          className="font-mono text-[9.5px] leading-relaxed tracking-[0.08em] text-(--muted-2) [overflow-wrap:anywhere]"
          data-testid="change-rule"
        >
          <span className="text-(--faint)">RULE </span>
          {rules.length > 0
            ? rules.map((r, i) => (
                <span key={r.id}>
                  {i > 0 && <span className="text-(--faint)"> · </span>}
                  {r.id} {ruleThresholdText(r)}
                </span>
              ))
            : "ALPHA RADAR OWN DETERMINISTIC RULE (RECORDED AS FIRED)"}
          <span className="text-(--faint)"> · HORIZON </span>
          {rules[0]?.horizon.toUpperCase() ?? e.horizon.label}
          {rules[0] && (
            <span className="text-(--faint)"> · {rules[0].source.replace("_", " ")}</span>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9.5px] tracking-[0.1em] [overflow-wrap:anywhere]">
          <span
            className={`mv-chip whitespace-normal! ${observed ? "text-(--gold)" : "text-(--champagne)"}`}
            data-testid="change-onset"
          >
            <span aria-hidden>{observed ? "◆" : "◇"}</span>
            {ONSET_TEXT[e.onset]}
          </span>
          {e.prior != null && (
            <span className="text-(--muted-2)">
              PRIOR {eventValueText({ unit: e.unit, value: e.prior })}{" "}
              <ObservedTime at={e.priorObservedAt} prefix="OBSERVED" />
            </span>
          )}
          {e.lastObservedAt !== e.observedAt && (
            <span className="text-(--faint)">
              <ObservedTime at={e.lastObservedAt} prefix="STILL HOLDS AT" />
            </span>
          )}
        </div>

        <p className="truncate font-mono text-[9px] tracking-[0.12em] text-(--faint)">
          {e.source}
          {e.pairAddress && (
            <span title={e.pairAddress}>
              {" "}
              · OBSERVED POOL {shortAddress(e.pairAddress)}
              {e.dexId ? ` · ${e.dexId.toUpperCase()}` : ""}
            </span>
          )}
        </p>
        {e.caveat && <p className="text-[11px] leading-relaxed text-(--faint)">{e.caveat}</p>}
      </div>
    </li>
  );
}
