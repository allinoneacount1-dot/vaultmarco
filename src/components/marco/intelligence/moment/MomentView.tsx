import { useMemo } from "react";
import { Pct, Price, StateDot } from "@/components/marco/desk";
import { useFocusAsset } from "@/hooks/useFocusAsset";
import {
  useAllTracks,
  useAssetEvents,
  useAssetFreshness,
  useAssetTrack,
  useLanes,
  useNow,
} from "@/hooks/useIntelligence";
import { evaluateDivergences } from "@/lib/intelligence/divergence";
import type { AssetObservation } from "@/lib/intelligence/facts";
import {
  type AssetFreshness,
  FRESHNESS_TEXT,
  ageLabel,
  freshnessDeskState,
} from "@/lib/intelligence/freshness";
import {
  TYPE_TEXT,
  activeChanges,
  collisionSummary,
  divergenceSummary,
  edgeSummary,
  firstMoves,
  pickerRows,
} from "@/lib/intelligence/moment";
import { normalizeChain } from "@/lib/providers/dexscreener";
import { shortAddress } from "@/lib/search";
import { IntelligenceShell } from "../IntelligenceShell";
import { FreshnessNote } from "../shared/FreshnessNote";
import { useFocusLinkSearch } from "../shared/useFocusLinkSearch";
import { ObservedTime } from "../shared/ObservedTime";
import { SectionHead } from "../shared/SectionHead";
import { Summaries } from "./Summaries";
import { WhatChanged } from "./WhatChanged";

/**
 * THE MOMENT — "what just changed?" for ONE selected asset.
 *
 *   header strip   price + provider windows + freshness of the latest observation
 *   main           WHAT CHANGED: active evidence events, each with its rule
 *   supporting     WHAT MOVED FIRST · EDGE AGE · DIVERGENCES · COLLISION → full views
 *
 * States (in order): no/invalid selection → CONNECTING → OFFLINE → NOT IN
 * OBSERVED UNIVERSE → evidence (LIVE / DEGRADED / STALE, stated above it).
 */
export function MomentView() {
  return (
    <IntelligenceShell feature="moment">
      <MomentBody />
    </IntelligenceShell>
  );
}

function MomentBody() {
  const { focus } = useFocusAsset();
  const track = useAssetTrack(focus?.assetKey);
  const fresh = useAssetFreshness(focus?.assetKey);

  if (!focus) return <NoSelection />;
  if (!track || track.observations.length === 0) return <NoObservation fresh={fresh} />;
  return <Evidence assetKey={focus.assetKey} fresh={fresh} />;
}

/* ------------------------------------------------------------------ *
 * Evidence (the asset has real observations this session)
 * ------------------------------------------------------------------ */

function Evidence({ assetKey, fresh }: { assetKey: string; fresh: AssetFreshness }) {
  const search = useFocusLinkSearch();
  const track = useAssetTrack(assetKey)!;
  const events = useAssetEvents(assetKey);
  const now = useNow();
  const latest = track.observations[track.observations.length - 1];

  const changes = useMemo(() => activeChanges(events), [events]);
  const first = useMemo(() => firstMoves(events, latest.pairAddress), [events, latest.pairAddress]);
  const divergence = useMemo(
    () => divergenceSummary(evaluateDivergences(track.observations)),
    [track.observations],
  );
  const collision = useMemo(() => collisionSummary(events), [events]);
  const edge = edgeSummary(events, now);

  return (
    <div className="space-y-4 lg:space-y-5" data-testid="moment" data-state={fresh.state}>
      <HeaderStrip latest={latest} />
      <FreshnessNote fresh={fresh} what="The evidence below" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <WhatChanged
          changes={changes}
          now={now}
          asOf={latest.observedAt}
          source={`${latest.provider.toUpperCase()} · ${latest.lanes.map((l) => l.toUpperCase()).join(" + ")}`}
          pool={latest.pairAddress}
          dex={latest.snapshot.dexId}
        />
        <Summaries
          first={first}
          edge={edge}
          divergence={divergence}
          collision={collision}
          search={search}
        />
      </div>
    </div>
  );
}

/** Price + the provider's M5/H1 windows. Freshness lives in the asset bar above (once). */
function HeaderStrip({ latest }: { latest: AssetObservation }) {
  const s = latest.snapshot;
  return (
    <section
      aria-label="Price"
      className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-x-6 gap-y-4 sm:grid-cols-[auto_auto_auto] sm:items-end sm:justify-start sm:gap-x-10"
      data-testid="moment-header"
    >
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <p className="mono-label text-[9px]!">
          PRICE USD
          {s.baseSymbol ? (
            <span className="normal-case tracking-[0.08em]"> · {s.baseSymbol} </span>
          ) : null}
          {s.baseSymbol ? <span className="text-[8px]!">(AS PROVIDER-REPORTED)</span> : null}
        </p>
        <Price
          value={s.priceUsd}
          className="mt-1 block text-[28px] leading-none text-(--bone) sm:text-[34px]"
        />
      </div>
      <Window label="Δ M5" value={s.priceChange.m5} />
      <Window label="Δ H1" value={s.priceChange.h1} />
    </section>
  );
}

function Window({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="min-w-0">
      <p className="mono-label text-[9px]!">{label}</p>
      <Pct value={value} digits={2} className="mt-1.5 block text-[15px]" />
      <p className="mt-1 font-mono text-[8.5px] tracking-[0.14em] text-(--faint)">
        PROVIDER WINDOW
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * No observation of the focus asset
 * ------------------------------------------------------------------ */

const NO_OBS: Record<string, { word: string; body: string }> = {
  loading: {
    word: "CONNECTING",
    body: "Waiting for the first DexScreener round of this session. Nothing is shown as data until it arrives.",
  },
  offline: {
    word: "OFFLINE",
    body: "No DexScreener round has succeeded this session. There is no observation to show and no fallback is used.",
  },
  unobserved: {
    word: "NOT IN OBSERVED UNIVERSE",
    body: "MARCOVAULT observes the canonical pairs and the boost / ads universe. This asset has not been observed this session, and no extra request is made for it. Every metric stays “—”.",
  },
};

function NoObservation({ fresh }: { fresh: AssetFreshness }) {
  const s = NO_OBS[fresh.state] ?? NO_OBS.unobserved;
  return (
    <section
      aria-labelledby="moment-no-obs"
      className="mv-panel p-4 sm:p-6"
      data-testid="moment-no-observation"
      data-state={fresh.state}
    >
      <SectionHead id="moment-no-obs" label="WHAT CHANGED" />
      <p
        className="mt-5 flex items-center gap-2 font-mono text-[13px] tracking-[0.14em] text-(--bone)"
        data-testid="moment-no-observation-word"
      >
        {freshnessDeskState(fresh.state) && (
          <StateDot
            state={freshnessDeskState(fresh.state)!}
            className={fresh.state === "offline" ? "text-(--down)" : "text-(--faint)"}
          />
        )}
        {s.word}
      </p>
      <p className="mt-2 max-w-[62ch] text-[12px] leading-relaxed text-(--muted-2)">{s.body}</p>
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {["PRICE USD", "Δ M5", "ACTIVE CHANGES", "EDGE AGE"].map((k) => (
          <div key={k}>
            <dt className="mono-label text-[9px]!">{k}</dt>
            <dd className="mono-data mt-1 text-[16px] text-(--faint)">—</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * No selection: a prompt, plus observed assets with real events
 * ------------------------------------------------------------------ */

function NoSelection() {
  const { invalid, setFocus } = useFocusAsset();
  const tracks = useAllTracks();
  const lanes = useLanes();
  const now = useNow();
  const rows = useMemo(() => pickerRows(tracks, lanes), [tracks, lanes]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-5">
      <section
        aria-labelledby="moment-prompt"
        className="mv-panel p-4 sm:p-6"
        data-testid="moment-no-selection"
      >
        <SectionHead id="moment-prompt" label="WHAT CHANGED" />
        <p
          className="mono-data mt-5 text-[22px] text-(--faint)"
          data-testid="intel-empty"
          aria-label="No asset selected: no evidence shown"
        >
          —
        </p>
        <p className="mt-3 font-mono text-[12px] tracking-[0.14em] text-(--bone)">
          {invalid ? "THE ASSET IN THE ADDRESS WAS REJECTED" : "SELECT AN ASSET"}
        </p>
        <p className="mt-2 max-w-[60ch] text-[12px] leading-relaxed text-(--muted-2)">
          Use SELECT ASSET above (by contract, name, symbol or chain), or open a token from the
          Overview and choose OPEN IN THE MOMENT. The asset is kept in the page address by chain and
          contract, never by symbol.
        </p>
      </section>

      <section
        aria-labelledby="moment-picker"
        className="mv-panel p-4 sm:p-5"
        data-testid="moment-picker"
      >
        <SectionHead id="moment-picker" label="OBSERVED WITH EVENTS" meta="NEWEST EVENT FIRST" />
        {rows.length === 0 ? (
          <p className="mt-4 font-mono text-[10.5px] tracking-[0.12em] text-(--muted-2)">
            NO OBSERVED ASSET HAS A QUALIFYING EVENT THIS SESSION
          </p>
        ) : (
          <>
            <ul className="mv-tape -mx-2 mt-3">
              {rows.map((r) => (
                <li key={r.assetKey}>
                  <button
                    type="button"
                    onClick={() => setFocus({ chainId: r.chainId, address: r.address })}
                    className="mv-row flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-sm px-2 py-2.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--gold)"
                    data-testid="moment-pick"
                    data-key={r.assetKey}
                  >
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="mv-chip shrink-0 text-(--bone)">
                          {normalizeChain(r.chainId).toUpperCase()}
                        </span>
                        <span className="truncate font-mono text-[12px] text-(--bone)">
                          {r.symbol ?? shortAddress(r.address)}
                        </span>
                        <span className="hidden shrink-0 font-mono text-[9.5px] text-(--faint) sm:inline">
                          {shortAddress(r.address)}
                        </span>
                      </span>
                      <span className="mt-1 block truncate font-mono text-[9.5px] tracking-[0.08em] text-(--muted-2)">
                        {TYPE_TEXT[r.newestType]} · {r.familyCount}{" "}
                        {r.familyCount === 1 ? "FAMILY" : "FAMILIES"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right font-mono text-[10px] text-(--muted-2)">
                      <ObservedTime at={r.newestAt} className="block text-(--muted-2)" />
                      <span className="block text-[9px] text-(--faint)">
                        {ageLabel(now - r.newestAt)} AGO
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 font-mono text-[9px] tracking-[0.12em] text-(--faint)">
              ORDERED BY NEWEST OBSERVED EVENT · NOT A RANKING · OBSERVED THIS SESSION
            </p>
          </>
        )}
      </section>
    </div>
  );
}
