import type { Collision } from "@/lib/intelligence/collision";
import { DIVERGENCE_STATE_TEXT, pairLabel } from "@/lib/intelligence/divergenceView";
import type { EvidenceEvent } from "@/lib/intelligence/events";
import { ageLabel } from "@/lib/intelligence/freshness";
import type { FocusSearch } from "@/lib/intelligence/identityCodec";
import {
  type DivergenceSummary,
  type EdgeSummary,
  ONSET_TEXT,
  TYPE_TEXT,
  directionGlyph,
  directionText,
} from "@/lib/intelligence/moment";
import { ruleMeta } from "@/lib/intelligence/rules";
import { ViewLink } from "../shared/links";
import { ObservedTime } from "../shared/ObservedTime";
import { SectionHead } from "../shared/SectionHead";

/**
 * The supporting column: four compact answers, each a doorway to its full
 * view with the same asset. Every figure is the foundation's (edgeClock,
 * divergence, collision, events); nothing is recomputed here.
 */
export function Summaries({
  first,
  edge,
  divergence,
  collision,
  search,
}: {
  first: EvidenceEvent[];
  edge: EdgeSummary;
  divergence: DivergenceSummary;
  collision: Collision | null;
  search: FocusSearch;
}) {
  return (
    <aside
      aria-label="Supporting evidence"
      className="mv-panel mv-tape"
      data-testid="moment-support"
    >
      <FirstMoves first={first} search={search} />
      <EdgeAge edge={edge} search={search} />
      <Divergences d={divergence} search={search} />
      <CollisionSummary c={collision} search={search} />
    </aside>
  );
}

function Block({
  id,
  label,
  meta,
  testId,
  children,
  link,
}: {
  id: string;
  label: string;
  meta?: React.ReactNode;
  testId: string;
  children: React.ReactNode;
  link: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-3 p-4 sm:p-5" data-testid={testId}>
      <SectionHead id={id} label={label} meta={meta} />
      {children}
      <div className="flex justify-end">{link}</div>
    </section>
  );
}

const Empty = ({ children, testId }: { children: React.ReactNode; testId?: string }) => (
  <p className="font-mono text-[10.5px] tracking-[0.12em] text-(--muted-2)" data-testid={testId}>
    {children}
  </p>
);

function FirstMoves({ first, search }: { first: EvidenceEvent[]; search: FocusSearch }) {
  return (
    <Block
      id="moment-first"
      label="WHAT MOVED FIRST"
      meta="OBSERVED THIS SESSION"
      testId="moment-first"
      link={<ViewLink feature="trace" search={search} testId="moment-link-trace" />}
    >
      {first.length === 0 ? (
        <Empty>NO MARKET EVENT OBSERVED THIS SESSION</Empty>
      ) : (
        <ol className="relative space-y-2 border-l border-(--hairline) pl-3">
          {first.map((e) => (
            <li key={e.id} className="relative min-w-0">
              <span
                aria-hidden
                className="absolute -left-[15.5px] top-1.5 size-1.5 rounded-full bg-(--gold)"
              />
              <div className="flex min-w-0 items-baseline gap-2">
                <ObservedTime
                  at={e.observedAt}
                  className="mono-data shrink-0 text-[10.5px] text-(--gold)"
                />
                <span className="truncate font-mono text-[10.5px] tracking-[0.06em] text-(--bone)">
                  {TYPE_TEXT[e.type]}
                </span>
                <span className="shrink-0 font-mono text-[9px] text-(--muted-2)">
                  <span aria-hidden>{directionGlyph(e.direction)} </span>
                  {e.direction ? directionText(e.type, e.direction) : ""}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Block>
  );
}

function EdgeAge({ edge, search }: { edge: EdgeSummary; search: FocusSearch }) {
  return (
    <Block
      id="moment-edge"
      label="EDGE AGE"
      meta="FIRST OBSERVED STRUCTURAL CHANGE"
      testId="moment-edge"
      link={<ViewLink feature="edge-clock" search={search} testId="moment-link-edge-clock" />}
    >
      {edge.kind === "NONE" ? (
        <Empty testId="moment-edge-none">NO STRUCTURAL CHANGE OBSERVED THIS SESSION</Empty>
      ) : (
        <div className="space-y-1.5">
          <p
            className="mono-data text-[26px] leading-none text-(--bone)"
            data-testid="moment-edge-age"
          >
            {ageLabel(edge.ageMs)}
          </p>
          <p className="font-mono text-[9.5px] tracking-[0.1em] text-(--muted-2)">
            SINCE {TYPE_TEXT[edge.origin.type]}{" "}
            {edge.origin.direction ? directionText(edge.origin.type, edge.origin.direction) : ""} ·{" "}
            <ObservedTime at={edge.origin.observedAt} prefix="OBSERVED" /> ·{" "}
            {ONSET_TEXT[edge.origin.onset]}
          </p>
        </div>
      )}
    </Block>
  );
}

function Divergences({ d, search }: { d: DivergenceSummary; search: FocusSearch }) {
  const { counts } = d;
  return (
    <Block
      id="moment-divergence"
      label="DIVERGENCES"
      meta="LATEST OBSERVATION · SAME POOL"
      testId="moment-divergence"
      link={<ViewLink feature="divergence" search={search} testId="moment-link-divergence" />}
    >
      {d.rows.length === 0 ? (
        <Empty>—</Empty>
      ) : (
        <>
          <p
            className="font-mono text-[10.5px] tracking-[0.1em] text-(--bone)"
            data-testid="moment-divergence-counts"
          >
            {counts.DIVERGED} {DIVERGENCE_STATE_TEXT.DIVERGED} · {counts.NOT_DIVERGED}{" "}
            {DIVERGENCE_STATE_TEXT.NOT_DIVERGED} · {counts.NOT_EVALUABLE}{" "}
            {DIVERGENCE_STATE_TEXT.NOT_EVALUABLE}
          </p>
          <ul className="space-y-1">
            {d.rows.map((r) => (
              <li
                key={r.id}
                className="flex min-w-0 items-baseline justify-between gap-3"
                data-state={r.state}
                title={r.missing ? `Missing: ${r.missing}` : undefined}
              >
                <span className="truncate font-mono text-[9.5px] tracking-[0.06em] text-(--muted-2)">
                  {pairLabel(r.label)}
                </span>
                <span
                  className={`shrink-0 font-mono text-[9px] tracking-[0.12em] ${
                    r.state === "DIVERGED"
                      ? "text-(--gold)"
                      : r.state === "NOT_EVALUABLE"
                        ? "text-(--faint)"
                        : "text-(--muted-2)"
                  }`}
                >
                  {r.state === "DIVERGED" && <span aria-hidden>◆ </span>}
                  {DIVERGENCE_STATE_TEXT[r.state]}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Block>
  );
}

function CollisionSummary({ c, search }: { c: Collision | null; search: FocusSearch }) {
  const rule = ruleMeta("COLLISION_WINDOW_MS");
  return (
    <Block
      id="moment-collision"
      label="COLLISION"
      meta={rule ? `WINDOW ${ageLabel(rule.value)} · ${rule.horizon.toUpperCase()}` : undefined}
      testId="moment-collision"
      link={<ViewLink feature="collision" search={search} testId="moment-link-collision" />}
    >
      {c == null ? (
        <Empty>NO EVENTS IN WINDOW</Empty>
      ) : (
        <div className="space-y-2">
          <p
            className="mono-data text-[20px] leading-none text-(--bone)"
            data-testid="moment-collision-count"
          >
            {c.count} {c.count === 1 ? "FAMILY" : "FAMILIES"} / {ageLabel(c.spanMs)}
          </p>
          <p className="font-mono text-[9.5px] tracking-[0.1em] text-(--muted-2)">
            {c.families.map((f) => f.family).join(" · ")}
          </p>
          <p className="font-mono text-[9px] tracking-[0.1em] text-(--faint)">
            WINDOW ENDS AT NEWEST ONSET <ObservedTime at={c.windowEnd} />
            {rule ? ` · RULE ${rule.id}` : ""} · CO-OCCURRENCE ONLY
          </p>
        </div>
      )}
    </Block>
  );
}
