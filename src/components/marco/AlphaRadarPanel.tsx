import { useState } from "react";
import { Radar } from "lucide-react";
import { Panel } from "./Panel";
import { TapeSkeleton } from "./Skeleton";
import { Price, Segmented, StateDot } from "./desk";
import { useArrivals } from "@/hooks/useArrivals";
import { type DeskState } from "@/lib/deskState";
import { formatNumber } from "./shared/helpers";
import { useIsMobile } from "@/hooks/use-mobile";
import { radarHistory, useRadar } from "@/hooks/usePairUniverse";
import { useTokenDrawerActions } from "@/hooks/useTokenDrawer";
import { useWatchlist } from "@/hooks/useWatchlist";
import { type TokenRef, refFromSnapshot } from "@/lib/tokenDrawer";
import { shortAddress } from "@/lib/search";
import { type WatchRow, type WatchState, resolveWatchRow } from "@/lib/watchlist";
import { normalizeChain } from "@/lib/providers/dexscreener";
import type { LiquidityEvent } from "@/lib/signals/liquidity";
import type { MomentumSignal } from "@/lib/signals/momentum";
import type { PairSnapshot } from "@/lib/signals/pairSnapshot";
import type { RadarStatus } from "@/lib/providers/universe";

type Mode = "momentum" | "risk" | "watchlist";

const ROWS_DESKTOP = 8;
const ROWS_MOBILE = 5;

const pct = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(0)}%`;
const mins = (n: number) => (n < 60 ? `${Math.round(n)}m` : `${(n / 60).toFixed(1)}h`);
const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

const detail = (issues: string[]) => (issues.length > 0 ? issues.join(" · ") : null);

/**
 * Status line for the radar's own aggregate status. Only a LIVE radar may say
 * the universe is empty; failures are always named, never shown as "no pairs".
 */
function statusNotice(status: RadarStatus, issues: string[]): string | null {
  switch (status) {
    case "offline":
      return `Radar unavailable — ${detail(issues) ?? "DexScreener could not be reached"}.`;
    case "stale":
      return `Showing last known radar — ${detail(issues) ?? "DexScreener is not responding"}.`;
    case "degraded":
      return `Partial universe — ${detail(issues)}.`;
    default:
      return null;
  }
}

function emptyNotice(mode: Mode, universeSize: number): string {
  if (universeSize === 0) return "No pairs in the universe right now.";
  return mode === "momentum"
    ? `No EARLY MOMENTUM signal across ${universeSize} pairs right now.`
    : `No liquidity event across ${universeSize} pairs in the last hour.`;
}

/**
 * ALPHA RADAR — deterministic signals over the shared pair universe.
 *
 * This component renders what `computeRadar` produced during the poll; no
 * signal logic runs here. Every number shown is a field of the signal object,
 * which in turn points at the raw snapshot fields and the named thresholds
 * that produced it.
 */
export function AlphaRadarPanel() {
  const [mode, setMode] = useState<Mode>("momentum");
  const isMobile = useIsMobile();
  // Radar status is derived from the inputs that built this radar (see RadarStatus).
  const { status, universe, inputs } = useRadar();

  const radar = universe?.radar;
  const byKey = new Map<string, PairSnapshot>((universe?.snapshots ?? []).map((s) => [s.key, s]));
  const limit = isMobile ? ROWS_MOBILE : ROWS_DESKTOP;
  const isLoading = status === "loading";
  const statusLine = status === "loading" ? null : statusNotice(status, inputs?.issues ?? []);

  const momentum = radar?.momentum.slice(0, limit) ?? [];
  const risk = radar?.risk.slice(0, limit) ?? [];
  const rows = mode === "momentum" ? momentum.length : risk.length;

  // Watchlist: identities from local storage, market state resolved from the
  // same universe + history this panel already reads — no extra observer.
  const { items: watched } = useWatchlist();
  const [showAll, setShowAll] = useState(false);
  const watchRows =
    mode === "watchlist"
      ? watched.map((item) => resolveWatchRow(item, universe, status, radarHistory))
      : [];

  const listKeys =
    mode === "watchlist"
      ? watchRows.map((r) => r.item.key)
      : mode === "momentum"
        ? momentum.map((m) => m.key)
        : risk.map((e) => e.key);
  const fresh = useArrivals(listKeys, !isLoading, mode);

  return (
    <Panel
      title={
        mode === "watchlist"
          ? `WATCHLIST · ${watched.length} ${watched.length === 1 ? "TOKEN" : "TOKENS"}`
          : `ALPHA RADAR · ${mode.toUpperCase()}`
      }
      icon={Radar}
      aside={<Segmented label="Radar mode" options={MODES} value={mode} onChange={setMode} />}
    >
      {/* Stable container: switching modes swaps rows (one short group fade),
          it never collapses the module. */}
      <div key={mode} className="mv-group-in min-h-[96px] space-y-2 lg:min-h-[112px]">
        {statusLine && (
          <div className="text-[11px] lg:text-[12px] text-muted-foreground">{statusLine}</div>
        )}
        {mode === "watchlist" ? (
          watchRows.length === 0 ? (
            <div className="text-[11px] lg:text-[12px] text-muted-foreground">
              No watched tokens. Open any token and press WATCH.
            </div>
          ) : (
            <>
              <div className="mv-tape -mx-2">
                {(showAll ? watchRows : watchRows.slice(0, limit)).map((r) => (
                  <WatchlistRow key={r.item.key} row={r} fresh={fresh.has(r.item.key)} />
                ))}
              </div>
              {watchRows.length > limit && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  aria-expanded={showAll}
                  className="min-h-8 font-mono text-[10px] tracking-[0.14em] text-(--faint) transition-colors duration-(--dur-micro) hover:text-foreground"
                >
                  {showAll ? "SHOW FEWER" : `SHOW ALL ${watchRows.length}`}
                </button>
              )}
            </>
          )
        ) : isLoading ? (
          <TapeSkeleton rows={3} label="Loading Alpha Radar" />
        ) : status === "offline" ? null : rows === 0 ? (
          <div className="text-[11px] lg:text-[12px] text-muted-foreground">
            {emptyNotice(mode, radar?.universeSize ?? 0)}
          </div>
        ) : (
          <div className="mv-tape -mx-2">
            {mode === "momentum"
              ? momentum.map((m) => (
                  <MomentumRow
                    key={m.key}
                    signal={m}
                    snapshot={byKey.get(m.key)}
                    fresh={fresh.has(m.key)}
                  />
                ))
              : risk.map((e) => (
                  <RiskRow
                    key={e.key}
                    event={e}
                    snapshot={byKey.get(e.key)}
                    fresh={fresh.has(e.key)}
                  />
                ))}
          </div>
        )}

        {radar && !isLoading && status !== "offline" && mode !== "watchlist" && (
          <div className="pt-1 text-[10px] font-mono text-(--faint)">
            UNIVERSE {radar.universeSize} PAIRS · HISTORY SINCE{" "}
            {radar.historySince != null ? clock(radar.historySince) : "—"} · RULES: VA≥3 TA≥2
            B/S≥1.5 LIQ≥$25K AGE≥10M
          </div>
        )}
      </div>
    </Panel>
  );
}

const MODES = [
  { id: "momentum", label: "MOMENTUM" },
  { id: "risk", label: "RISK" },
  { id: "watchlist", label: "WATCHLIST" },
] as const;

function ChainChip({ chainId }: { chainId: string }) {
  return <span className="mv-chip text-(--gold)">{normalizeChain(chainId).toUpperCase()}</span>;
}

/** A radar row opens the Token Intelligence Drawer; provider links live inside it. */
function RowShell({
  tokenRef,
  fresh = false,
  children,
}: {
  tokenRef?: TokenRef;
  /** Arrived after the list's first render: a brief tint that decays. */
  fresh?: boolean;
  children: React.ReactNode;
}) {
  const { open } = useTokenDrawerActions();
  const className = `mv-row flex w-full items-center justify-between gap-3 rounded-sm px-2 py-2.5 text-left ${
    fresh ? "mv-row-new" : ""
  }`;
  return tokenRef ? (
    <button
      type="button"
      onClick={(e) => open(tokenRef, e.currentTarget)}
      className={`${className} cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--gold)`}
    >
      {children}
    </button>
  ) : (
    <div className={className}>{children}</div>
  );
}

function MomentumRow({
  signal,
  snapshot,
  fresh,
}: {
  signal: MomentumSignal;
  snapshot?: PairSnapshot;
  fresh?: boolean;
}) {
  const symbol = snapshot?.baseSymbol ?? signal.key;
  const priceM5 = snapshot?.priceChange.m5 ?? null;
  return (
    <RowShell tokenRef={snapshot ? refFromSnapshot(snapshot) : undefined} fresh={fresh}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[12px] font-mono text-(--bone) truncate">{symbol}</span>
          <ChainChip chainId={snapshot?.chainId ?? signal.key.split(":")[0]} />
          <span className="mv-chip text-(--champagne)">{signal.label}</span>
        </div>
        <div className="text-[10px] lg:text-[11px] font-mono text-muted-foreground mt-1">
          VA {signal.va.ratio.toFixed(1)}× · TX {signal.ta.ratio.toFixed(1)}× · B/S{" "}
          {signal.bp.ratio.toFixed(1)}:1 · LIQ {formatNumber(signal.gates.liquidityUsd)} · AGE{" "}
          {mins(signal.gates.ageMinutes)}
        </div>
        <div className="text-[10px] lg:text-[11px] text-muted-foreground mt-1">
          {signal.reasons.join(" · ")}
        </div>
      </div>
      <div className="text-right flex-shrink-0 pl-3">
        <div className="text-[11px] lg:text-[12px] font-mono text-(--bone)">
          EVIDENCE {signal.evidence.passed}/{signal.evidence.total}
        </div>
        {priceM5 != null && (
          <div
            className={`text-[10px] lg:text-[11px] font-mono mt-1 ${priceM5 >= 0 ? "text-(--up)" : "text-(--down)"}`}
          >
            {priceM5 >= 0 ? "+" : ""}
            {priceM5.toFixed(1)}% 5m
          </div>
        )}
      </div>
    </RowShell>
  );
}

function RiskRow({
  event,
  snapshot,
  fresh,
}: {
  event: LiquidityEvent;
  snapshot?: PairSnapshot;
  fresh?: boolean;
}) {
  const symbol = snapshot?.baseSymbol ?? event.key;
  const c = event.change;
  return (
    <RowShell tokenRef={snapshot ? refFromSnapshot(snapshot) : undefined} fresh={fresh}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[12px] font-mono text-(--bone) truncate">{symbol}</span>
          <ChainChip chainId={snapshot?.chainId ?? event.key.split(":")[0]} />
          <span
            className={`mv-chip ${event.direction === "REMOVED" ? "text-(--down)" : "text-(--up)"}`}
          >
            LIQ {event.direction}
          </span>
        </div>
        <div className="text-[10px] lg:text-[11px] font-mono text-muted-foreground mt-1">
          {pct(c.deltaRel)} · {formatNumber(c.previousUsd)} → {formatNumber(c.currentUsd)} · over{" "}
          {mins(c.spanMinutes)}
        </div>
      </div>
      <div className="text-right flex-shrink-0 pl-3">
        {/* Severity reads by weight and word, not color alone. */}
        <div
          data-severity={event.severity}
          className={`text-[11px] lg:text-[12px] font-mono tracking-[0.08em] ${
            event.severity === "HIGH" ? "font-semibold text-(--down)" : "text-(--champagne)"
          }`}
        >
          {event.severity}
        </div>
        <div className="text-[10px] lg:text-[11px] font-mono text-muted-foreground mt-1">
          {formatNumber(c.deltaUsd)}
        </div>
      </div>
    </RowShell>
  );
}

const STATE_TONE: Record<WatchState, string> = {
  LIVE: "text-(--gold)",
  DEGRADED: "text-(--champagne)",
  STALE: "text-(--champagne)",
  RETAINED: "text-muted-foreground",
  "IDENTITY ONLY": "text-muted-foreground",
};

const SIGNAL_TONE = {
  "EARLY MOMENTUM": "text-(--champagne)",
  "LIQ REMOVED": "text-(--down)",
  "LIQ ADDED": "text-(--up)",
} as const;

const changeText = (n: number | null, window: string) =>
  n == null ? null : (
    <span className={n >= 0 ? "text-(--up)" : "text-(--down)"}>
      {n >= 0 ? "+" : ""}
      {n.toFixed(1)}% {window}
    </span>
  );

/**
 * A watched token: identity from the watchlist, every market field from the
 * latest real observation (or none). State uses the drawer's temporal truth.
 */
const STATE_DOT: Record<WatchState, DeskState> = {
  LIVE: "live",
  DEGRADED: "degraded",
  STALE: "stale",
  RETAINED: "stale",
  "IDENTITY ONLY": "loading",
};

function WatchlistRow({ row, fresh }: { row: WatchRow; fresh?: boolean }) {
  const m5 = changeText(row.changeM5, "5m");
  const h1 = changeText(row.changeH1, "1h");
  return (
    <RowShell tokenRef={row.ref} fresh={fresh}>
      <div className="min-w-0" data-testid="watch-row" data-key={row.item.key}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[12px] font-mono text-(--bone) truncate">
            {row.symbol ?? shortAddress(row.item.address)}
          </span>
          <ChainChip chainId={row.item.chainId} />
          <span
            className={`flex items-center gap-1.5 text-[9px] lg:text-[10px] font-mono tracking-[0.12em] ${STATE_TONE[row.state]}`}
          >
            <StateDot state={STATE_DOT[row.state]} />
            <span data-testid="watch-state">{row.state}</span>
          </span>
        </div>
        <div className="text-[10px] lg:text-[11px] font-mono text-muted-foreground mt-1 flex flex-wrap gap-x-2">
          {row.priceUsd != null ? (
            <>
              <Price value={row.priceUsd} className="text-(--bone)" />
              {m5}
              {h1}
              <span>LIQ {row.liquidityUsd == null ? "—" : formatNumber(row.liquidityUsd)}</span>
            </>
          ) : (
            <span>
              {shortAddress(row.item.address)} · no market observation in the current universe or
              retained history
            </span>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0 pl-3 text-[10px] lg:text-[11px] font-mono">
        {row.signal && <span className={`mv-chip ${SIGNAL_TONE[row.signal]}`}>{row.signal}</span>}
        {row.lastSignal && (
          <span className="text-(--faint)" data-testid="watch-last-signal">
            LAST SIGNAL {row.lastSignal}
          </span>
        )}
      </div>
    </RowShell>
  );
}
