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
  rawMetricRows,
  summarizeDivergences,
  thresholdLines,
} from "@/lib/intelligence/divergenceView";
import type { AssetTrack } from "@/lib/intelligence/facts";
import { type AssetFreshness, clockLabel } from "@/lib/intelligence/freshness";
import { INTELLIGENCE_RULES_VERSION } from "@/lib/intelligence/rules";
import { shortAddress } from "@/lib/search";
import { useFocusEvidence } from "./useFocusEvidence";
import { IntelligenceShell } from "../IntelligenceShell";
import { EvidenceStatus, FocusGate, MomentLink } from "./FocusGate";

/**
 * DIVERGENCE — "What doesn't fit?"
 *
 * Main instrument: every central divergence predicate (rules.ts
 * DIVERGENCE_RULES, evaluated by divergence.ts) on the focus asset's latest
 * real observation, DIVERGED first. Supporting surface: the raw provider
 * fields those predicates read. No interpretation is attached to a state.
 */
export function DivergencePage() {
  const { assetKey, track, fresh, search } = useFocusEvidence();
  return (
    <IntelligenceShell feature="divergence">
      <FocusGate hasFocus={assetKey != null} track={track} fresh={fresh}>
        {track && <DivergenceBody track={track} fresh={fresh} />}
      </FocusGate>
      <nav aria-label="Related views" className="flex flex-wrap items-center gap-2">
        <MomentLink search={search} />
      </nav>
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

  return (
    <div className="space-y-8" data-testid="divergence" data-observed-at={latest.observedAt}>
      <EvidenceStatus fresh={fresh} />
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
            NOT EVALUABLE · LATEST OBSERVATION{" "}
            <time dateTime={new Date(latest.observedAt).toISOString()}>
              {clockLabel(latest.observedAt)}
            </time>{" "}
            · OBSERVED THIS SESSION
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
 * Predicate row
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
      className="grid gap-x-6 gap-y-2.5 py-3.5 lg:grid-cols-[124px_minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.85fr)]"
      data-testid="divergence-row"
      data-id={r.id}
      data-state={r.state}
      aria-label={`${label}: ${DIVERGENCE_STATE_TEXT[r.state]}`}
    >
      <div>
        <StateMark state={r.state} />
      </div>

      <div className="min-w-0 space-y-1.5">
        <h3 className="font-mono text-[12px] font-semibold tracking-[0.1em] text-(--bone)">
          {label}
        </h3>
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

      <div className="min-w-0 space-y-1">
        <p className="mono-label text-[8px]!">RULE</p>
        <ul className="space-y-0.5" data-testid="divergence-thresholds">
          {thresholds.map((t) => (
            <li
              key={t.ruleId}
              className="font-mono text-[10px] tracking-[0.06em] text-(--muted-2)"
              title={`${t.ruleId} · ${t.source.replace(/_/g, " ")}`}
            >
              <span className="text-(--bone)">{t.text}</span>
              <span className="text-(--faint)"> · {t.horizon}</span>
            </li>
          ))}
        </ul>
        <p className="font-mono text-[9px] leading-relaxed tracking-[0.04em] text-(--faint)">
          WINDOWS · {overlapNote(r.id)}
        </p>
      </div>

      <div className="min-w-0 space-y-0.5 font-mono text-[10px] tracking-[0.08em] text-(--muted-2)">
        <p>
          OBSERVED{" "}
          <time dateTime={new Date(r.observedAt).toISOString()} className="text-(--gold)">
            {clockLabel(r.observedAt)}
          </time>
        </p>
        {r.priorObservedAt != null && (
          <p>
            COMPARED WITH{" "}
            <time dateTime={new Date(r.priorObservedAt).toISOString()}>
              {clockLabel(r.priorObservedAt)}
            </time>
          </p>
        )}
        <p className="text-(--faint)">{r.source}</p>
        <p className="break-all text-(--faint)" title={r.pairAddress ?? undefined}>
          OBSERVED POOL {r.pairAddress ? shortAddress(r.pairAddress) : "—"}
          {r.dexId ? ` · ${r.dexId.toUpperCase()}` : ""}
        </p>
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
        Provider fields the divergence predicates read, with their window and observation time
      </caption>
      <thead>
        <tr className="hairline-b text-left text-(--faint)">
          <th scope="col" className="w-[38%] py-2 pr-2 font-normal sm:w-[26%]">
            FIELD
          </th>
          <th scope="col" className="w-[24%] py-2 pr-2 text-right font-normal sm:w-[16%]">
            VALUE
          </th>
          <th scope="col" className="py-2 pr-2 pl-4 font-normal">
            WINDOW
          </th>
          <th scope="col" className="hidden py-2 pr-2 font-normal sm:table-cell sm:w-[14%]">
            OBSERVED
          </th>
          <th scope="col" className="hidden py-2 font-normal lg:table-cell lg:w-[16%]">
            OBSERVED POOL
          </th>
        </tr>
      </thead>
      <tbody className="mv-tape">
        {rows.map((r) => (
          <tr key={r.field} data-testid="raw-metric" data-field={r.field}>
            <th
              scope="row"
              className="py-1.5 pr-2 text-left font-normal break-words text-(--muted-2)"
            >
              {r.field}
            </th>
            <td
              className={`mono-data py-1.5 pr-2 text-right ${r.raw == null ? "text-(--faint)" : "text-(--bone)"}`}
              data-testid="raw-metric-value"
            >
              {r.value}
            </td>
            <td className="py-1.5 pr-2 pl-4 break-words text-(--faint)">{r.horizon}</td>
            <td className="hidden py-1.5 pr-2 text-(--muted-2) sm:table-cell">
              <time dateTime={new Date(r.observedAt).toISOString()}>
                {clockLabel(r.observedAt)}
              </time>
            </td>
            <td
              className="hidden py-1.5 text-(--faint) lg:table-cell"
              title={r.pairAddress ?? undefined}
            >
              {r.pairAddress ? shortAddress(r.pairAddress) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
