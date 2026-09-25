import { useState } from "react";
import { Radar } from "lucide-react";
import { Panel } from "./Panel";
import { formatNumber } from "./shared/helpers";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRadar } from "@/hooks/usePairUniverse";
import { normalizeChain } from "@/lib/providers/dexscreener";
import type { LiquidityEvent } from "@/lib/signals/liquidity";
import type { MomentumSignal } from "@/lib/signals/momentum";
import type { PairSnapshot } from "@/lib/signals/pairSnapshot";
import type { RadarStatus } from "@/lib/providers/universe";

type Mode = "momentum" | "risk";

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

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {(["momentum", "risk"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`px-4 py-2 rounded-full text-[11px] font-mono transition-all ${
              mode === m ? "chrome-fill" : "hairline text-muted-foreground hover:text-foreground"
            }`}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      <Panel title={`ALPHA RADAR · ${mode.toUpperCase()}`} icon={Radar}>
        <div className="space-y-2 lg:space-y-3">
          {statusLine && (
            <div className="text-[11px] lg:text-[12px] text-muted-foreground">{statusLine}</div>
          )}
          {isLoading ? (
            <div className="rounded-md border border-(--hairline) p-3">
              <div className="h-4 w-24 bg-(--panel-2) rounded animate-pulse mb-2" />
              <div className="h-3 w-48 bg-(--panel-2) rounded animate-pulse" />
            </div>
          ) : status === "offline" ? null : rows === 0 ? (
            <div className="text-[11px] lg:text-[12px] text-muted-foreground">
              {emptyNotice(mode, radar?.universeSize ?? 0)}
            </div>
          ) : mode === "momentum" ? (
            momentum.map((m) => <MomentumRow key={m.key} signal={m} snapshot={byKey.get(m.key)} />)
          ) : (
            risk.map((e) => <RiskRow key={e.key} event={e} snapshot={byKey.get(e.key)} />)
          )}

          {radar && !isLoading && status !== "offline" && (
            <div className="pt-1 text-[10px] font-mono text-(--faint)">
              UNIVERSE {radar.universeSize} PAIRS · HISTORY SINCE{" "}
              {radar.historySince != null ? clock(radar.historySince) : "—"} · RULES: VA≥3 TA≥2
              B/S≥1.5 LIQ≥$25K AGE≥10M
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function ChainChip({ chainId }: { chainId: string }) {
  return (
    <span className="px-1.5 py-0.5 rounded-full border border-(--hairline-strong) text-(--gold) text-[9px] lg:text-[10px] font-mono">
      {normalizeChain(chainId).toUpperCase()}
    </span>
  );
}

function RowShell({ href, children }: { href: string | null; children: React.ReactNode }) {
  const className =
    "flex items-center justify-between rounded-md border border-(--hairline) p-2 lg:p-3 hover:bg-(--panel-2) hover:border-(--hairline-strong) transition-all";
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <div className={className}>{children}</div>
  );
}

function MomentumRow({ signal, snapshot }: { signal: MomentumSignal; snapshot?: PairSnapshot }) {
  const symbol = snapshot?.baseSymbol ?? signal.key;
  const priceM5 = snapshot?.priceChange.m5 ?? null;
  return (
    <RowShell href={snapshot?.url ?? null}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ChainChip chainId={snapshot?.chainId ?? signal.key.split(":")[0]} />
          <span className="px-1.5 py-0.5 rounded-full border border-(--hairline-strong) text-(--champagne) text-[9px] lg:text-[10px] font-mono">
            {signal.label}
          </span>
          <span className="text-[11px] lg:text-[12px] font-mono text-foreground truncate">
            {symbol}
          </span>
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

function RiskRow({ event, snapshot }: { event: LiquidityEvent; snapshot?: PairSnapshot }) {
  const symbol = snapshot?.baseSymbol ?? event.key;
  const c = event.change;
  return (
    <RowShell href={snapshot?.url ?? null}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ChainChip chainId={snapshot?.chainId ?? event.key.split(":")[0]} />
          <span
            className={`px-1.5 py-0.5 rounded-full border border-(--hairline-strong) text-[9px] lg:text-[10px] font-mono ${
              event.direction === "REMOVED" ? "text-(--down)" : "text-(--up)"
            }`}
          >
            LIQ {event.direction}
          </span>
          <span className="text-[11px] lg:text-[12px] font-mono text-foreground truncate">
            {symbol}
          </span>
        </div>
        <div className="text-[10px] lg:text-[11px] font-mono text-muted-foreground mt-1">
          {pct(c.deltaRel)} · {formatNumber(c.previousUsd)} → {formatNumber(c.currentUsd)} · over{" "}
          {mins(c.spanMinutes)}
        </div>
      </div>
      <div className="text-right flex-shrink-0 pl-3">
        <div
          className={`text-[11px] lg:text-[12px] font-mono ${
            event.severity === "HIGH" ? "text-(--down)" : "text-(--champagne)"
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
