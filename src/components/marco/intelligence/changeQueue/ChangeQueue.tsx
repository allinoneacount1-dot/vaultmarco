import { memo, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Price, Segmented } from "@/components/marco/desk";
import { useArrivals } from "@/hooks/useArrivals";
import { useAllTracks, useLanes, useSessionInfo } from "@/hooks/useIntelligence";
import { QUEUE_SORTS, type QueueSort } from "@/lib/intelligence/changeQueue";
import {
  QUEUE_SORT_META,
  type QueueEntry,
  changeText,
  hasSortKey,
  queueEntries,
  sortKeyText,
} from "@/lib/intelligence/changeQueueView";
import { clockLabel } from "@/lib/intelligence/freshness";
import { encodeFocus } from "@/lib/intelligence/identityCodec";
import { EVENT_RULE_IDS } from "@/lib/intelligence/ruleRefs";
import {
  COLLISION_WINDOW_MS,
  INTELLIGENCE_RULES_VERSION,
  SESSION_MAX_AGE_MS,
  SESSION_MAX_ASSETS,
  ruleMeta,
} from "@/lib/intelligence/rules";
import { normalizeChain } from "@/lib/providers/dexscreener";
import { shortAddress } from "@/lib/search";
import { RecordingSince } from "../shared/RecordingSince";
import { Age, QueueLaneState, RowFreshness } from "./QueueCells";

/**
 * CHANGE QUEUE — "what deserves attention now?" as an EVENT QUEUE.
 *
 * One row per observed asset with at least one qualifying change this
 * session, ordered by the foundation's deterministic comparators (never a
 * score). The list re-renders only when the session changes (a lane round);
 * ages and freshness tick in leaf cells (./QueueCells).
 */

const SORT_OPTIONS = QUEUE_SORTS.map((id) => ({ id, label: QUEUE_SORT_META[id].label }));
const WINDOW_MIN = Math.round(COLLISION_WINDOW_MS / 60_000);
const iso = (ms: number) => new Date(ms).toISOString();

export function ChangeQueue() {
  const [sort, setSort] = useState<QueueSort>("NEWEST");
  const assets = useAllTracks();
  const lanes = useLanes();
  const { startedAt } = useSessionInfo();
  const entries = useMemo(() => queueEntries(assets, lanes, sort), [assets, lanes, sort]);
  const keys = useMemo(() => entries.map((e) => e.row.assetKey), [entries]);
  const answered = lanes.realtime.points.length + lanes.universe.points.length > 0;
  const arrivals = useArrivals(keys, answered, sort);
  const meta = QUEUE_SORT_META[sort];

  return (
    <div className="space-y-6 lg:space-y-8">
      <QueueLaneState />

      <section aria-labelledby="queue-heading" className="mv-panel p-4 sm:p-5" data-testid="queue">
        <div className="hairline-b mb-3 flex flex-col gap-3 pb-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="queue-heading" className="mono-label flex items-center gap-2.5">
              <span aria-hidden className="size-1 shrink-0 rounded-full bg-(--gold)" />
              CHANGE QUEUE · OBSERVED THIS SESSION
            </h2>
            <p
              className="font-mono text-[10px] tracking-[0.14em] text-(--faint)"
              data-testid="queue-count"
            >
              {entries.length} OF {assets.size} OBSERVED ASSETS WITH A QUALIFYING CHANGE
            </p>
          </div>
          <Segmented
            label="Queue order"
            options={SORT_OPTIONS}
            value={sort}
            onChange={setSort}
            className="self-start"
          />
          <p
            className="max-w-[92ch] font-mono text-[10px] leading-relaxed tracking-[0.06em] text-(--muted-2)"
            data-testid="sort-caption"
            aria-live="polite"
          >
            {meta.caption}
          </p>
        </div>

        {entries.length === 0 ? (
          <div className="py-6" data-testid="queue-empty">
            <p className="font-mono text-[12px] tracking-[0.14em] text-(--bone)">
              NO QUALIFYING CHANGE OBSERVED THIS SESSION
            </p>
            <p className="mt-2 font-mono text-[10px] tracking-[0.14em] text-(--faint)">
              <RecordingSince /> · <span data-testid="assets-observed">{assets.size}</span> ASSETS
              OBSERVED
            </p>
          </div>
        ) : (
          <>
            <div
              aria-hidden
              className="-mx-2 hidden gap-3 px-2 pb-2 font-mono text-[9px] tracking-[0.16em] text-(--faint) xl:grid xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1.7fr)_72px_96px_84px_minmax(0,0.9fr)_minmax(0,1.2fr)_196px]"
            >
              <span>ASSET · CHAIN</span>
              <span>NEWEST CHANGE</span>
              <span>AGE</span>
              <span>FAMILIES · {WINDOW_MIN}M</span>
              <span>{meta.keyLabel ?? "EVENTS"}</span>
              <span>PRICE</span>
              <span>STATE · FRESHNESS</span>
              <span />
            </div>
            <ol
              className="mv-tape -mx-2"
              aria-label={`Change queue, ordered by ${meta.label.toLowerCase()}`}
              data-testid="queue-list"
              data-sort={sort}
            >
              {entries.map((e) => (
                <QueueRowItem
                  key={e.row.assetKey}
                  entry={e}
                  sort={sort}
                  arrived={arrivals.has(e.row.assetKey)}
                />
              ))}
            </ol>
          </>
        )}
      </section>

      <QueueRules startedAt={startedAt} observed={assets.size} queued={entries.length} />
    </div>
  );
}

const CELL_LABEL = "font-mono text-[9px] tracking-[0.16em] text-(--faint) xl:sr-only";

/** One queued asset. Memoized: re-renders only when its entry, the sort or its arrival changes. */
const QueueRowItem = memo(function QueueRowItem({
  entry,
  sort,
  arrived,
}: {
  entry: QueueEntry;
  sort: QueueSort;
  arrived: boolean;
}) {
  const { row, newest } = entry;
  const chain = normalizeChain(row.chainId).toUpperCase();
  const name = entry.symbol ?? shortAddress(row.address);
  const keyText = sortKeyText(row, sort) ?? String(row.eventCount);
  const keyMissing = !hasSortKey(row, sort);
  const keyLabel = QUEUE_SORT_META[sort].keyLabel ?? "EVENTS";
  return (
    <li
      className={`mv-row grid grid-cols-2 items-start gap-x-3 gap-y-2 rounded-sm px-2 py-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1.7fr)_72px_96px_84px_minmax(0,0.9fr)_minmax(0,1.2fr)_196px] xl:items-center xl:py-2.5 ${
        arrived ? "mv-row-new" : ""
      }`}
      data-testid="queue-row"
      data-key={row.assetKey}
      data-newest-at={row.newestAt}
    >
      {/* Asset · chain · observed pool */}
      <div className="order-1 min-w-0 xl:order-1">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-mono text-[12px] font-semibold text-(--bone)">{name}</span>
          <span className="mv-chip shrink-0 text-(--gold)">{chain}</span>
          <span className="font-mono text-[10px] text-(--faint)" title={row.address}>
            {shortAddress(row.address)}
          </span>
        </p>
        <p
          className="mt-1 truncate font-mono text-[9px] tracking-[0.12em] text-(--faint)"
          title={
            entry.pairAddress
              ? `Observed pool ${entry.pairAddress} — the provider's pool in the latest observation; it may change between rounds.`
              : undefined
          }
          data-testid="row-pool"
        >
          OBSERVED POOL {entry.pairAddress ? shortAddress(entry.pairAddress) : "—"}
          {entry.dexId ? ` · ${entry.dexId.toUpperCase()}` : ""}
        </p>
      </div>

      {/* Provider state + freshness (ticks in its own leaf) */}
      <div className="order-2 flex justify-end xl:order-7 xl:justify-start">
        <span className="sr-only">State · freshness </span>
        <RowFreshness assetKey={row.assetKey} />
      </div>

      {/* Newest qualifying change: type + direction, observed onset */}
      <div className="order-3 col-span-2 min-w-0 xl:order-2 xl:col-span-1">
        <span className={CELL_LABEL}>NEWEST CHANGE </span>
        <p
          className="font-mono text-[11px] tracking-[0.1em] text-(--bone)"
          data-testid="row-change"
          data-type={newest.type}
          data-direction={newest.direction ?? ""}
        >
          {changeText(newest.type, newest.direction)}
        </p>
        <p className="mt-0.5 font-mono text-[9px] tracking-[0.12em] text-(--faint)">
          OBSERVED{" "}
          <time dateTime={iso(newest.observedAt)} className="text-(--gold)">
            {clockLabel(newest.observedAt)}
          </time>
          {newest.onset === "IN_PROGRESS_WHEN_OBSERVED" ? " · IN PROGRESS WHEN OBSERVED" : ""}
        </p>
      </div>

      {/* Exact age of the newest change */}
      <div className="order-4 xl:order-3">
        <span className={CELL_LABEL}>AGE </span>
        <time
          dateTime={iso(newest.observedAt)}
          className="mono-data text-[12px] text-(--bone)"
          data-testid="row-age"
        >
          <Age at={newest.observedAt} />
        </time>
      </div>

      {/* Price of the latest observation */}
      <div className="order-5 text-right xl:order-6 xl:text-left">
        <span className={CELL_LABEL}>PRICE </span>
        <Price value={entry.priceUsd} className="text-[12px] text-(--bone)" />
      </div>

      {/* Independent families in the rules window */}
      <div className="order-6 xl:order-4">
        <span className={CELL_LABEL}>FAMILIES · {WINDOW_MIN}M </span>
        <span
          className="mono-data text-[12px] text-(--bone)"
          data-testid="row-families"
          title={
            entry.windowStart != null && entry.windowEnd != null
              ? `Distinct evidence families with an onset from ${clockLabel(entry.windowStart)} to ${clockLabel(entry.windowEnd)} on one observed pool (COLLISION_WINDOW_MS).`
              : undefined
          }
        >
          {entry.familiesInWindow ?? "—"}
        </span>
      </div>

      {/* The active sort's key (events for NEWEST / MOST EVENTS) */}
      <div className="order-7 text-right xl:order-5 xl:text-left">
        <span className={CELL_LABEL}>{keyLabel} </span>
        <span
          className={`mono-data text-[12px] ${keyMissing ? "text-(--faint)" : "text-(--bone)"}`}
          data-testid="row-key"
          data-missing={keyMissing ? "true" : "false"}
        >
          {keyText}
        </span>
      </div>

      {/* Action: a real link carrying chain + address */}
      <div className="order-8 col-span-2 flex justify-end xl:order-8 xl:col-span-1">
        <Link
          to="/dashboard/moment"
          search={encodeFocus({ chainId: row.chainId, address: row.address })}
          className="mv-glass flex h-9 w-full items-center justify-center gap-2 whitespace-nowrap px-3 text-(--muted-2) sm:w-auto xl:w-full"
          aria-label={`OPEN IN THE MOMENT — ${name} on ${chain}`}
          data-testid="open-moment"
        >
          <span className="mono-label text-[9px]!">OPEN IN THE MOMENT</span>
          <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={1.8} />
        </Link>
      </div>
    </li>
  );
});

/** The rules each qualifying event type is evaluated with (ruleRefs.ts), plus the families window. */
const RULE_ROWS: Array<{ label: string; ids: readonly string[] }> = [
  ...(
    [
      ["PRICE EXPANSION", "PRICE_EXPANSION"],
      ["VOLUME ACCELERATION", "VOLUME_ACCELERATION"],
      ["TXN ACCELERATION", "TXN_ACCELERATION"],
      ["BUY/SELL IMBALANCE", "BUY_SELL_IMBALANCE"],
      ["LIQUIDITY CHANGE", "LIQUIDITY_CHANGE"],
      ["BOOST CHANGE", "BOOST_CHANGE"],
    ] as const
  ).map(([label, type]) => ({ label, ids: EVENT_RULE_IDS[type] })),
  { label: "FAMILIES WINDOW", ids: ["COLLISION_WINDOW_MS"] },
];

const UNIT_TEXT: Record<string, (v: number) => string> = {
  PCT: (v) => `${v}%`,
  RATIO: (v) => `${v}×`,
  USD: (v) => `$${v.toLocaleString("en-US")}`,
  FRACTION: (v) => `${v * 100}%`,
  COUNT: (v) => `${v}`,
  TXNS: (v) => `${v} txns`,
  MINUTES: (v) => `${v} min`,
  MS: (v) => `${Math.round(v / 60_000)} min`,
  MULTIPLE: (v) => `${v}×`,
};

/** Each rule's threshold, then the distinct horizons they apply over. */
function ruleText(ids: readonly string[]): string {
  const metas = ids.map((id) => ruleMeta(id));
  if (metas.some((m) => m == null)) return "—";
  const values = metas.map((m) => UNIT_TEXT[m!.unit]?.(m!.value) ?? String(m!.value));
  const horizons = [...new Set(metas.map((m) => m!.horizon))];
  return `${values.join(" · ")} — ${horizons.join(" · ")}`;
}

/** Supporting evidence: what qualifies a row, with each rule's threshold + horizon. */
function QueueRules({
  startedAt,
  observed,
  queued,
}: {
  startedAt: number;
  observed: number;
  queued: number;
}) {
  return (
    <section
      aria-labelledby="queue-rules-heading"
      className="hairline-t space-y-3 pt-4"
      data-testid="queue-rules"
    >
      <h2 id="queue-rules-heading" className="mono-label text-[9px]!">
        WHAT QUALIFIES A ROW · RULES {INTELLIGENCE_RULES_VERSION}
      </h2>
      <p className="max-w-[92ch] font-mono text-[10px] leading-relaxed tracking-[0.06em] text-(--muted-2)">
        A row is an observed asset with at least one market-structure event this session (or a radar
        firing / observed pair discovery). Provider-state events (PROVIDER STALE / RECOVERED) never
        qualify a row. No score, no rank: the order is the selected sort only.
      </p>
      <dl className="grid gap-x-6 gap-y-1.5 font-mono text-[10px] tracking-[0.08em] sm:grid-cols-2 xl:grid-cols-3">
        {RULE_ROWS.map((r) => (
          <div key={r.label} className="flex min-w-0 flex-col">
            <dt className="text-(--bone)">{r.label}</dt>
            <dd className="text-(--faint)">{ruleText(r.ids)}</dd>
          </div>
        ))}
      </dl>
      <p
        className="font-mono text-[9px] tracking-[0.14em] text-(--faint)"
        data-testid="queue-session"
      >
        <RecordingSince /> · {observed} ASSETS OBSERVED · {queued} QUEUED · RETAINED{" "}
        {Math.round(SESSION_MAX_AGE_MS / 60_000)} MIN, MAX {SESSION_MAX_ASSETS} ASSETS · DEXSCREENER
        REALTIME + UNIVERSE
      </p>
    </section>
  );
}
