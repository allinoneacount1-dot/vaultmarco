import { useMemo } from "react";
import { Zone } from "@/components/marco/desk";
import { useNow } from "@/hooks/useIntelligence";
import type { CollisionFamily } from "@/lib/intelligence/collision";
import {
  ONSET_TEXT,
  changesText,
  collisionView,
  collisionWindowText,
  eventTypeText,
  eventValueText,
  spanText,
} from "@/lib/intelligence/collisionView";
import type { EvidenceEvent } from "@/lib/intelligence/events";
import { type AssetFreshness, ageLabel } from "@/lib/intelligence/freshness";
import { shortAddress } from "@/lib/search";
import { IntelligenceShell } from "../IntelligenceShell";
import { FocusGate } from "../shared/FocusGate";
import { useFocusLinkSearch } from "../shared/useFocusLinkSearch";
import { FreshnessNote } from "../shared/FreshnessNote";
import { RelatedViews } from "../shared/links";
import { ObservedTime } from "../shared/ObservedTime";

/**
 * COLLISION — "What changed together?"
 *
 * Main instrument: "N CHANGES / span" — N independent evidence FAMILIES whose
 * event onsets fall in one rules.ts window (collision.ts), span = first to
 * last contributing family onset. Supporting surface: each family with its
 * contributing events, observed times and observed pool. Co-occurrence only.
 */
export function CollisionPage() {
  const search = useFocusLinkSearch();
  return (
    <IntelligenceShell feature="collision">
      <FocusGate what="which evidence families changed together">
        {(ev) => (
          <CollisionBody
            events={ev.events}
            fresh={ev.fresh}
            observedAt={ev.track.observations[ev.track.observations.length - 1]?.observedAt ?? null}
          />
        )}
      </FocusGate>
      <RelatedViews search={search} views={["moment"]} />
    </IntelligenceShell>
  );
}

function CollisionBody({
  events,
  fresh,
  observedAt,
}: {
  events: EvidenceEvent[];
  fresh: AssetFreshness;
  observedAt: number | null;
}) {
  const view = useMemo(() => collisionView(events), [events]);
  const now = useNow();
  const c = view.collision;
  const windowText = collisionWindowText();
  const pool = c?.families
    .flatMap((f) => f.events)
    .find((e) => e.pairAddress != null && e.pairAddress === c.pairAddress);

  return (
    <div
      className="space-y-8"
      data-testid="collision"
      data-count={c?.count ?? 0}
      data-collision={view.isCollision}
      data-observed-at={observedAt ?? ""}
    >
      <FreshnessNote fresh={fresh} what="The collision" />
      <Zone index="01" label="CHANGED TOGETHER" meta="OBSERVED THIS SESSION">
        <div className="space-y-3">
          {view.isCollision && c ? (
            <p
              className="font-display text-[26px] font-semibold uppercase leading-none tracking-[0.02em] text-(--bone) lg:text-[34px]"
              data-testid="collision-headline"
            >
              {changesText(c.count)} <span className="text-(--faint)">/</span>{" "}
              <span className="text-(--gold) normal-case" data-testid="collision-span">
                {spanText(c)}
              </span>
            </p>
          ) : (
            <p
              className="font-display text-[18px] font-semibold uppercase tracking-[0.04em] text-(--muted-2) lg:text-[22px]"
              data-testid="collision-headline"
            >
              NO COLLISION IN THE LAST {windowText}
            </p>
          )}
          <p
            className="font-mono text-[10px] tracking-[0.16em] text-(--champagne)"
            data-testid="collision-disclaimer"
          >
            COINCIDENCE WINDOW · NOT CAUSALITY · NOT CONFIDENCE
          </p>
          <dl className="grid gap-x-8 gap-y-1 font-mono text-[10px] tracking-[0.1em] text-(--muted-2) sm:grid-cols-2">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-(--faint)">WINDOW</dt>
              <dd data-testid="collision-window">
                {windowText} · COLLISION_WINDOW_MS · EVENT ONSETS
              </dd>
            </div>
            {c && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-(--faint)">ONSETS</dt>
                <dd data-testid="collision-onsets">
                  FIRST <ObservedTime at={c.families[0].firstAt} /> → LAST{" "}
                  <ObservedTime at={c.families[c.families.length - 1].firstAt} /> · WINDOW ENDS AT
                  THE NEWEST OBSERVED CHANGE · {ageLabel(Math.max(0, now - c.windowEnd))} AGO
                </dd>
              </div>
            )}
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-(--faint)">COUNT</dt>
              <dd>INDEPENDENT FAMILIES, ONE VOTE EACH · NOT EVENTS</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-(--faint)">OBSERVED POOL</dt>
              <dd data-testid="collision-pool" title={c?.pairAddress ?? undefined}>
                {c?.pairAddress ? shortAddress(c.pairAddress) : "—"}
                {pool?.dexId ? ` · ${pool.dexId.toUpperCase()}` : ""} · ONLY THE NEWEST EVENT'S POOL
              </dd>
            </div>
          </dl>
          {view.excluded.length > 0 && (
            <p
              role="note"
              className="border-l border-(--champagne) pl-3 font-mono text-[10px] leading-relaxed tracking-[0.1em] text-(--champagne)"
              data-testid="collision-pool-switch"
            >
              POOL SWITCH · {view.excluded.length} {view.excluded.length === 1 ? "EVENT" : "EVENTS"}{" "}
              IN THIS WINDOW OBSERVED ON{" "}
              {view.excludedPools.map((p) => (p ? shortAddress(p) : "—")).join(", ")}{" "}
              {view.excludedPools.length === 1 ? "WAS" : "WERE"} LEFT OUT · CHANGES ON DIFFERENT
              POOLS ARE NEVER COMBINED
            </p>
          )}
        </div>
      </Zone>

      <Zone index="02" label="FAMILIES" meta={c ? `${changesText(c.count)} IN WINDOW` : undefined}>
        {c && c.families.length > 0 ? (
          <ol className="mv-tape hairline-t hairline-b" data-testid="collision-families">
            {c.families.map((f) => (
              <FamilyRow key={f.family} f={f} />
            ))}
          </ol>
        ) : (
          <p
            className="hairline-t hairline-b py-4 font-mono text-[11px] tracking-[0.12em] text-(--muted-2)"
            data-testid="collision-families-empty"
          >
            NO EVIDENCE EVENT OBSERVED FOR THIS ASSET THIS SESSION
          </p>
        )}
      </Zone>
    </div>
  );
}

function FamilyRow({ f }: { f: CollisionFamily }) {
  return (
    <li
      className="grid gap-x-6 gap-y-2 py-3.5 md:grid-cols-[160px_minmax(0,1fr)]"
      data-testid="collision-family"
      data-family={f.family}
      data-events={f.events.length}
    >
      <div className="space-y-0.5">
        <h3 className="font-mono text-[12px] font-semibold tracking-[0.14em] text-(--bone)">
          {f.family}
        </h3>
        <p className="font-mono text-[10px] tracking-[0.1em] text-(--muted-2)">
          FIRST <ObservedTime at={f.firstAt} className="text-(--gold)" />
        </p>
        {f.events.length > 1 && (
          <p className="font-mono text-[9px] tracking-[0.1em] text-(--faint)">
            {f.events.length} EVENTS · ONE FAMILY
          </p>
        )}
      </div>
      <ul className="space-y-2">
        {f.events.map((e) => (
          <EventLine key={e.id} e={e} />
        ))}
      </ul>
    </li>
  );
}

function EventLine({ e }: { e: EvidenceEvent }) {
  return (
    <li className="min-w-0 space-y-0.5" data-testid="collision-event" data-type={e.type}>
      <p className="flex flex-wrap items-baseline gap-x-2 font-mono text-[11px] tracking-[0.08em]">
        <span className="text-(--bone)">{eventTypeText(e)}</span>
        {e.direction && <span className="text-(--muted-2)">{e.direction}</span>}
        <span className="mono-data text-(--bone)">{eventValueText(e)}</span>
        <span className="text-(--faint)">· {e.horizon.label}</span>
      </p>
      <p className="flex flex-wrap gap-x-2 font-mono text-[10px] tracking-[0.08em] text-(--muted-2)">
        <span>
          OBSERVED <ObservedTime at={e.observedAt} />
        </span>
        <span className="text-(--faint)">· {ONSET_TEXT[e.onset]}</span>
        <span className="text-(--faint)">· {e.source}</span>
        <span className="break-all text-(--faint)" title={e.pairAddress ?? undefined}>
          · OBSERVED POOL {e.pairAddress ? shortAddress(e.pairAddress) : "— (LANE-LEVEL)"}
          {e.dexId ? ` · ${e.dexId.toUpperCase()}` : ""}
        </span>
      </p>
    </li>
  );
}
