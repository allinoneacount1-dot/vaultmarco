import { shortAddress } from "@/lib/search";
import {
  type TraceEventRow,
  type TracePoolRow,
  type TraceRow,
  eventRules,
  factLabel,
  offsetText,
  priorText,
  valueText,
} from "@/lib/intelligence/trace";
import { ObservedTime } from "../shared/ObservedTime";
import { RuleTip } from "../shared/RuleTip";

/**
 * THE EVIDENCE TAPE — one row per observed onset, oldest first:
 *   OBSERVED time │ rail │ fact label (RULE tip: rule · source · pool) · onset │ number
 * Source and pool are stated once in the tape footer; each row keeps its own
 * in the RULE tip (a pool switch is also a visible break).
 * Gold marks temporal anchors only (first in view, Edge Clock origin), always
 * with a word. Provider lane rows are context: smaller, fainter, hollow dot.
 * A pool switch is a dashed break across the tape.
 */
export function TraceTape({ rows }: { rows: readonly TraceRow[] }) {
  return (
    <div className="min-w-0">
      <div
        aria-hidden
        className="hidden grid-cols-[84px_16px_minmax(0,1fr)] gap-x-3 pb-2 font-mono text-[9px] tracking-[0.2em] text-(--faint) lg:grid"
      >
        <span>OBSERVED</span>
        <span />
        <span className="grid grid-cols-[minmax(0,1fr)_200px] gap-x-4">
          <span>FACT</span>
          <span className="text-right">EVIDENCE</span>
        </span>
      </div>
      <ol aria-label="Evidence tape, oldest first" className="relative" data-testid="trace-tape">
        {rows.map((r, i) =>
          r.kind === "pool" ? (
            <PoolBreakRow key={r.key} row={r} />
          ) : (
            <EventRow key={r.key} row={r} last={i === rows.length - 1} />
          ),
        )}
      </ol>
    </div>
  );
}

function Rail({ tone, last }: { tone: "anchor" | "event" | "lane"; last: boolean }) {
  return (
    <span aria-hidden className="relative flex justify-center">
      <span
        className={`absolute top-0 w-px bg-(--hairline-strong) ${last ? "h-[14px]" : "bottom-0"}`}
      />
      <span
        className={`relative mt-[10px] block rounded-full ${
          tone === "anchor"
            ? "size-[9px] border border-(--gold) bg-(--gold)"
            : tone === "lane"
              ? "size-[7px] border border-(--faint) bg-(--void)"
              : "size-[7px] border border-(--bone) bg-(--panel)"
        }`}
      />
    </span>
  );
}

const ANCHOR_TEXT = { FIRST_IN_VIEW: "FIRST IN VIEW", EDGE_CLOCK_ORIGIN: "EDGE CLOCK ORIGIN" };

function EventRow({ row, last }: { row: TraceEventRow; last: boolean }) {
  const e = row.event;
  const anchor = row.anchors.length > 0;
  const lane = row.laneContext;
  const prior = priorText(e);
  const rules = eventRules(e.type);
  return (
    <li
      className="grid grid-cols-[64px_14px_minmax(0,1fr)] gap-x-2.5 sm:grid-cols-[84px_16px_minmax(0,1fr)] sm:gap-x-3"
      data-testid="trace-row"
      data-type={e.type}
      data-anchor={row.anchors.join(" ") || undefined}
      data-lane={lane ? "true" : undefined}
    >
      <div className="pt-1.5 text-right">
        <ObservedTime
          at={row.at}
          className={`block text-[11px] ${anchor ? "text-(--gold)" : lane ? "text-(--faint)" : "text-(--bone)"}`}
        />
        {row.offsetMs != null && row.offsetMs !== 0 && (
          <span className="mono-data block text-[9px] text-(--faint)">
            {offsetText(row.offsetMs)}
          </span>
        )}
      </div>
      <Rail tone={anchor ? "anchor" : lane ? "lane" : "event"} last={last} />
      <div
        className={`grid min-w-0 grid-cols-1 gap-y-1 pb-4 pt-1.5 lg:grid-cols-[minmax(0,1fr)_200px] lg:gap-x-4 ${
          lane ? "opacity-80" : ""
        }`}
      >
        <div className="min-w-0 space-y-1 lg:col-start-1 lg:row-start-1">
          {lane && (
            <span className="font-mono text-[8.5px] tracking-[0.2em] text-(--faint)">
              LANE CONTEXT
            </span>
          )}
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span
              className={`font-mono tracking-[0.08em] ${
                lane ? "text-[10px] text-(--muted-2)" : "text-[11.5px] font-semibold text-(--bone)"
              }`}
            >
              {factLabel(e)}
            </span>
            <RuleTip>
              {rules.map((r) => (
                <span key={r.id} className="block" data-testid="trace-rule">
                  RULE {r.text} · {r.horizon}
                </span>
              ))}
              {rules.length === 0 && !lane && e.type !== "PAIR_DISCOVERED" && (
                <span className="block">RULE ALPHA RADAR · ITS OWN DETERMINISTIC ROUND RULE</span>
              )}
              {e.type === "PAIR_DISCOVERED" && <span className="block">{e.horizon.label}</span>}
              <span className="block text-(--muted-2)">{e.source}</span>
              {e.pairAddress && (
                <span className="block text-(--muted-2)">
                  OBSERVED POOL {shortAddress(e.pairAddress)}
                  {e.dexId ? ` · ${e.dexId.toUpperCase()}` : ""}
                </span>
              )}
            </RuleTip>
          </p>
        </div>
        <p
          className={`mono-data text-[11px] lg:col-start-2 lg:row-start-1 lg:text-right ${
            lane ? "text-(--faint)" : "text-(--bone)"
          }`}
          data-testid="trace-value"
        >
          {valueText(e)}
        </p>
        <div className="min-w-0 space-y-1 lg:col-start-1 lg:row-start-2">
          {anchor && (
            <p className="flex flex-wrap gap-1.5">
              {row.anchors.map((a) => (
                <span key={a} className="mv-chip text-(--gold)">
                  {ANCHOR_TEXT[a]}
                </span>
              ))}
            </p>
          )}
          {!lane && (
            <p className="font-mono text-[9.5px] leading-relaxed text-(--faint)">
              {e.onset === "OBSERVED" ? "ONSET OBSERVED" : "IN PROGRESS WHEN FIRST OBSERVED"}
              {" · "}
              {e.active ? (
                "HOLDS AT LATEST OBSERVATION"
              ) : (
                <>
                  LAST HELD <ObservedTime at={e.lastObservedAt} />
                </>
              )}
              {prior && e.priorObservedAt != null && (
                <>
                  {" · "}PRIOR {prior} @ <ObservedTime at={e.priorObservedAt} />
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function PoolBreakRow({ row }: { row: TracePoolRow }) {
  const p = row.pool;
  const side = (pair: string | null, dex: string | null) =>
    pair ? `${shortAddress(pair)}${dex ? ` · ${dex.toUpperCase()}` : ""}` : "—";
  return (
    <li
      className="grid grid-cols-[64px_14px_minmax(0,1fr)] gap-x-2.5 sm:grid-cols-[84px_16px_minmax(0,1fr)] sm:gap-x-3"
      data-testid="trace-pool-break"
    >
      <div className="pt-2 text-right">
        <ObservedTime at={row.at} className="block text-[11px] text-(--champagne)" />
      </div>
      <span aria-hidden className="relative flex justify-center">
        <span className="absolute inset-y-0 w-px border-l border-dashed border-(--champagne)" />
      </span>
      <div className="min-w-0 pb-4 pt-2">
        <p className="border-y border-dashed border-(--hairline-strong) py-1.5 font-mono text-[10px] tracking-[0.1em] text-(--champagne)">
          OBSERVED POOL SWITCHED · {side(p.fromPair, p.fromDex)} → {side(p.toPair, p.toDex)}
          <span className="mt-0.5 block text-[9px] tracking-[0.08em] text-(--faint)">
            CONTINUITY BREAKS HERE — NO EVENT OR DELTA SPANS THE SWITCH
          </span>
        </p>
      </div>
    </li>
  );
}
