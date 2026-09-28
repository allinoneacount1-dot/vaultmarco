import { useMemo } from "react";
import { Zone } from "@/components/marco/desk";
import { type DivergenceResult, evaluateDivergences } from "@/lib/intelligence/divergence";
import {
  DIVERGENCE_STATE_TEXT,
  type RawMetricRow,
  metricText,
  orderDivergences,
  overlapNote,
  pairLabel,
  rawFieldLabel,
  rawMetricRows,
  summarizeDivergences,
  thresholdLines,
} from "@/lib/intelligence/divergenceView";
import type { AssetTrack } from "@/lib/intelligence/facts";
import type { AssetFreshness } from "@/lib/intelligence/freshness";
import { INTELLIGENCE_RULES_VERSION } from "@/lib/intelligence/rules";
import { shortAddress } from "@/lib/search";
import { IntelligenceShell } from "../IntelligenceShell";
import { FocusGate } from "../shared/FocusGate";
import { useFocusLinkSearch } from "../shared/useFocusLinkSearch";
import { FreshnessNote } from "../shared/FreshnessNote";
import { RelatedViews } from "../shared/links";
import { ObservedTime } from "../shared/ObservedTime";
import { RuleTip } from "../shared/RuleTip";

/**
 * DIVERGENCE — "What doesn't fit?"
 *
 * Main instrument: every central divergence predicate (rules.ts
 * DIVERGENCE_RULES, evaluated by divergence.ts) on the focus asset's latest
 * real observation, DIVERGED first. Supporting surface: the raw provider
 * fields those predicates read. No interpretation is attached to a state.
 */
export function DivergencePage() {
  const search = useFocusLinkSearch();
  return (
    <IntelligenceShell feature="divergence">
      <FocusGate what="which of its metrics disagree">
        {(ev) => <DivergenceBody track={ev.track} fresh={ev.fresh} />}
      </FocusGate>
      <RelatedViews search={search} views={["moment"]} />
    </IntelligenceShell>
  );
}

function DivergenceBody({ track, fresh }: { track: AssetTrack; fresh: AssetFreshness }) {
  const results = useMemo(() => evaluateDivergences(track.observations), [track.observations]);
  const ordered = useMemo(() => orderDivergences(results), [results]);
  const summary = summarizeDivergences(results);
  const raw = useMemo(
    () => rawMetricRows(track.observations, results),
    [track.observations, results],
  );
  const latest = track.observations[track.observations.length - 1];
  const evaluable = summary.DIVERGED + summary.NOT_DIVERGED;
  const headline =
    summary.DIVERGED > 0
      ? `${summary.DIVERGED} OF ${summary.total} DIVERGED`
      : evaluable > 0
        ? "NO DIVERGENCE IN CURRENT OBSERVATION"
        : "NOTHING EVALUABLE IN CURRENT OBSERVATION";

  const pool = latest.pairAddress;
  const dex = latest.snapshot.dexId;
  const source = results[0]?.source ?? "DEXSCREENER";

  return (
    <div className="space-y-8" data-testid="divergence" data-observed-at={latest.observedAt}>
      <FreshnessNote fresh={fresh} what="The evaluation" />
      <Zone
        index="01"
        label="PREDICATES"
        meta={`RULES ${INTELLIGENCE_RULES_VERSION.toUpperCase()}`}
      >
        <div className="space-y-1.5">
          <p
            className={`font-display text-[18px] font-semibold uppercase tracking-[0.04em] lg:text-[22px] ${
              summary.DIVERGED > 0 ? "text-(--bone)" : "text-(--muted-2)"
            }`}
            data-testid="divergence-headline"
            data-diverged={summary.DIVERGED}
          >
            {headline}
          </p>
          <p className="font-mono text-[10px] tracking-[0.14em] text-(--faint)">
            {summary.DIVERGED} DIVERGED · {summary.NOT_DIVERGED} ALIGNED · {summary.NOT_EVALUABLE}{" "}
            NOT EVALUABLE · OBSERVED THIS SESSION
          </p>
          <p
            className="font-mono text-[10px] tracking-[0.12em] break-words text-(--faint)"
            data-testid="divergence-meta"
            title={pool ?? undefined}
          >
            OBSERVED <ObservedTime at={latest.observedAt} /> · {source} · POOL{" "}
            {pool ? shortAddress(pool) : "—"}
            {dex ? ` · ${dex.toUpperCase()}` : ""}
          </p>
        </div>
        <ol className="mv-tape hairline-t hairline-b" data-testid="divergence-list">
          {ordered.map((r) => (
            <PredicateRow key={r.id} r={r} />
          ))}
        </ol>
      </Zone>

      <Zone index="02" label="RAW METRICS READ" meta="DEXSCREENER · PROVIDER VALUES">
        <RawMetricsTable rows={raw} />
      </Zone>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Predicate row: state · pair · the two metrics (rule behind RULE)
 * ------------------------------------------------------------------ */

const STATE_MARK: Record<DivergenceResult["state"], { glyph: string; cls: string }> = {
  DIVERGED: { glyph: "◆", cls: "text-(--gold) border-(--gold)" },
  NOT_DIVERGED: { glyph: "◇", cls: "text-(--muted-2) border-(--hairline-strong)" },
  NOT_EVALUABLE: { glyph: "○", cls: "text-(--faint) border-dashed border-(--hairline-strong)" },
};

function StateMark({ state }: { state: DivergenceResult["state"] }) {
  const m = STATE_MARK[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-1.5 py-px font-mono text-[9px] tracking-[0.14em] whitespace-nowrap lg:text-[10px] ${m.cls}`}
      data-testid="divergence-state"
    >
      <span aria-hidden>{m.glyph}</span>
      {DIVERGENCE_STATE_TEXT[state]}
    </span>
  );
}

function PredicateRow({ r }: { r: DivergenceResult }) {
  const thresholds = thresholdLines(r.id);
  const label = pairLabel(r.label);
  return (
    <li
      className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-2 py-3.5 lg:grid-cols-[124px_minmax(0,1fr)_minmax(0,1.2fr)_auto] lg:items-baseline"
      data-testid="divergence-row"
      data-id={r.id}
      data-state={r.state}
      aria-label={`${label}: ${DIVERGENCE_STATE_TEXT[r.state]}`}
    >
      <div className="col-span-2 lg:col-span-1">
        <StateMark state={r.state} />
      </div>
      <h3 className="min-w-0 font-mono text-[12px] font-semibold tracking-[0.1em] text-(--bone)">
        {label}
      </h3>
      <div className="col-span-2 min-w-0 space-y-0.5 lg:col-span-1">
        <dl className="space-y-0.5">
          {r.metrics.map((m) => {
            const t = metricText(m);
            return (
              <div
                key={m.name}
                className="flex flex-wrap items-baseline gap-x-2 font-mono text-[10px] tracking-[0.08em]"
                data-testid="divergence-metric"
              >
                <dt className="text-(--faint)">{t.name}</dt>
                <dd className="mono-data text-(--bone)" title={t.fullHorizon}>
                  <span data-testid="metric-value">{t.value}</span>
                  <span className="text-(--muted-2)"> · {t.horizon}</span>
                </dd>
              </div>
            );
          })}
        </dl>
        {r.state === "NOT_EVALUABLE" && r.missing && (
          <p
            className="font-mono text-[10px] tracking-[0.08em] text-(--champagne)"
            data-testid="divergence-missing"
          >
            MISSING · {r.missing}
          </p>
        )}
      </div>
      <div className="col-start-2 row-start-2 justify-self-end lg:col-start-auto lg:row-start-auto">
        <RuleTip testId="divergence-rule">
          <span className="block" data-testid="divergence-thresholds">
            {thresholds.map((t) => (
              <span key={t.ruleId} className="block">
                {t.text} <span className="text-(--muted-2)">· {t.horizon}</span>
              </span>
            ))}
          </span>
          <span className="block text-(--muted-2)">WINDOWS · {overlapNote(r.id)}</span>
          {r.priorObservedAt != null && (
            <span className="block text-(--muted-2)">
              COMPARED WITH <ObservedTime at={r.priorObservedAt} />
            </span>
          )}
        </RuleTip>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ *
 * Supporting surface
 * ------------------------------------------------------------------ */

function RawMetricsTable({ rows }: { rows: RawMetricRow[] }) {
  return (
    <table
      className="w-full table-fixed border-collapse font-mono text-[10px] tracking-[0.06em]"
      data-testid="raw-metrics"
    >
      <caption className="sr-only">
        Provider values the divergence predicates read, from the latest observation
      </caption>
      <thead>
        <tr className="hairline-b text-left text-(--faint)">
          <th scope="col" className="w-[46%] py-2 pr-2 font-normal sm:w-[36%]">
            METRIC
          </th>
          <th scope="col" className="w-[26%] py-2 pr-2 text-right font-normal sm:w-[18%]">
            VALUE
          </th>
          <th scope="col" className="py-2 pl-4 font-normal">
            WINDOW
          </th>
        </tr>
      </thead>
      <tbody className="mv-tape">
        {rows.map((r) => (
          <tr key={r.field} data-testid="raw-metric" data-field={r.field} title={r.field}>
            <th
              scope="row"
              className="py-1.5 pr-2 text-left font-normal break-words text-(--muted-2)"
            >
              {rawFieldLabel(r.field)}
              {r.field.includes("(earlier") && (
                <>
                  {" "}
                  <ObservedTime at={r.observedAt} className="text-(--faint)" />
                </>
              )}
            </th>
            <td
              className={`mono-data py-1.5 pr-2 text-right ${r.raw == null ? "text-(--faint)" : "text-(--bone)"}`}
              data-testid="raw-metric-value"
            >
              {r.value}
            </td>
            <td className="py-1.5 pl-4 break-words text-(--faint)">{r.horizon}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
