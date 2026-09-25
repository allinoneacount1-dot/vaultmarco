import { useEffect, useState } from "react";
import { formatNumber, formatPrice2 } from "./shared/helpers";
import { useIsMobile } from "@/hooks/use-mobile";
import { radarHistory, useRadar } from "@/hooks/usePairUniverse";
import { useOpenTokenRef, useTokenDrawerActions } from "@/hooks/useTokenDrawer";
import { normalizeChain } from "@/lib/providers/dexscreener";
import type { PairIntelligence } from "@/lib/signals/intelligence";
import type { Evidence } from "@/lib/signals/momentum";
import type { PairSnapshot, TxnWindow, UniverseSource } from "@/lib/signals/pairSnapshot";
import {
  type DrawerModel,
  type EntryPoint,
  type SourceDetail,
  type TokenRef,
  dexScreenerUrl,
  explorerUrl,
  resolveDrawerModel,
} from "@/lib/tokenDrawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/* ------------------------------------------------------------------ *
 * Formatting only — no signal logic lives in this file.
 * ------------------------------------------------------------------ */

const usd = (n: number | null) => (n == null ? "—" : formatNumber(n));
const priceText = (n: number | null) => (n == null ? "—" : formatPrice2(n));
const pctText = (n: number | null) => (n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`);
const mins = (n: number) => (n < 60 ? `${Math.round(n)}m` : `${(n / 60).toFixed(1)}h`);
const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
const utc = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC";

const SOURCE_LABEL: Record<UniverseSource, string> = {
  "boost-latest": "BOOST LATEST",
  "boost-top": "BOOST TOP",
  ad: "ADS",
  realtime: "REALTIME",
};
const ENTRY_LABEL: Record<EntryPoint, string> = {
  radar: "ALPHA RADAR",
  boost: "BOOST FEED",
  ad: "ADS FEED",
  realtime: "DEX REALTIME",
};

/* ------------------------------------------------------------------ *
 * Drawer
 * ------------------------------------------------------------------ */

/**
 * TOKEN INTELLIGENCE DRAWER — one shared investigation surface.
 *
 * Mounted once with the dashboard (not on open), so opening it adds no query
 * observer and therefore no request. It renders `resolveDrawerModel(...)`
 * over the Pair Universe cache and the retained snapshot history; every
 * number is a snapshot field or a PairIntelligence field.
 */
export function TokenDrawer() {
  const ref = useOpenTokenRef();
  const { close } = useTokenDrawerActions();
  const isMobile = useIsMobile();
  const { status, universe } = useRadar();

  const model: DrawerModel | null = ref
    ? resolveDrawerModel(ref, universe, status === "loading" ? "offline" : status, radarHistory)
    : null;

  return (
    <Sheet open={ref != null} onOpenChange={(o) => !o && close()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        data-testid="token-drawer"
        data-key={ref?.key}
        data-kind={model?.kind}
        className={`bg-(--graphite) border-(--hairline) p-0 overflow-y-auto overscroll-contain ${
          isMobile ? "h-[85vh]" : "w-full sm:max-w-md"
        }`}
      >
        {model && <DrawerBody model={model} />}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ model }: { model: DrawerModel }) {
  const { ref } = model;
  const snapshot = model.kind === "identity" ? null : model.intel.snapshot;
  const symbol = snapshot?.baseSymbol ?? ref.symbol;
  const name = snapshot?.baseName ?? ref.name;

  return (
    <>
      <SheetHeader className="hairline-b px-5 pt-5 pb-4 text-left space-y-2">
        <div className="flex items-center gap-2 flex-wrap pr-8">
          <span className="px-1.5 py-0.5 rounded-full border border-(--hairline-strong) text-(--gold) text-[10px] font-mono">
            {normalizeChain(ref.chainId).toUpperCase()}
          </span>
          <SheetTitle className="font-mono text-[15px] font-semibold text-(--bone) break-all">
            {symbol ?? shortAddress(ref.address)}
          </SheetTitle>
          {name && <span className="text-[12px] text-muted-foreground truncate">{name}</span>}
        </div>
        <SheetDescription asChild>
          <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono tracking-[0.12em] uppercase">
            <StatusLabel model={model} />
            {snapshot && (
              <span className="text-muted-foreground" data-testid="observed">
                OBSERVED {clock(snapshot.observedAt)}
              </span>
            )}
          </div>
        </SheetDescription>
      </SheetHeader>

      <div className="px-5 py-4 space-y-5">
        <SignalSection model={model} />
        {model.kind === "identity" ? (
          <Section title="MARKET DATA">
            <p className="text-[11px] text-muted-foreground">
              No retained market data for this token — it has not been observed in the pair universe
              during the last 60 minutes. Only its verified identity is shown.
            </p>
          </Section>
        ) : (
          <>
            <EvidenceSection intel={model.intel} />
            <ActivitySection s={model.intel.snapshot} />
            <MarketSection intel={model.intel} />
          </>
        )}
        <IdentitySection ref_={ref} intel={model.kind === "identity" ? null : model.intel} />
        <SourcesSection model={model} />
        <ActionsSection ref_={ref} snapshot={snapshot} />
      </div>
    </>
  );
}

function StatusLabel({ model }: { model: DrawerModel }) {
  if (model.kind === "identity") {
    return (
      <span className="text-muted-foreground" data-testid="status">
        IDENTITY ONLY
      </span>
    );
  }
  if (model.kind === "retained") {
    return (
      <span className="text-(--champagne)" data-testid="status">
        NOT IN CURRENT UNIVERSE
      </span>
    );
  }
  const color =
    model.status === "live"
      ? "text-(--gold)"
      : model.status === "offline"
        ? "text-(--down)"
        : "text-(--champagne)";
  return (
    <span className={`flex items-center gap-1.5 ${color}`} data-testid="status">
      {model.status === "live" && <span className="size-1 rounded-full bg-(--gold)" />}
      {model.status.toUpperCase()}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Sections
 * ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="hairline-b pb-2">
        <span className="mono-label flex items-center gap-2.5">
          <span className="size-1 rounded-full bg-(--gold)" />
          {title}
        </span>
      </div>
      {children}
    </section>
  );
}

function SignalSection({ model }: { model: DrawerModel }) {
  if (model.kind !== "current") {
    return (
      <Section title="SIGNAL">
        <p className="text-[11px] text-muted-foreground">
          No current signal — this token is not in the current universe.
        </p>
      </Section>
    );
  }
  const { momentum, risk } = model.intel;
  return (
    <Section title="SIGNAL">
      {!momentum && !risk && (
        <p className="text-[11px] text-muted-foreground">No signal on this pair this round.</p>
      )}
      {momentum && (
        <div className="space-y-1" data-testid="signal-momentum">
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
            <span className="px-1.5 py-0.5 rounded-full border border-(--hairline-strong) text-(--champagne) text-[10px]">
              {momentum.label}
            </span>
            <span className="text-(--bone)">
              EVIDENCE {momentum.evidence.passed}/{momentum.evidence.total}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">{momentum.reasons.join(" · ")}</p>
        </div>
      )}
      {risk && (
        <div className="space-y-1" data-testid="signal-risk">
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
            <span
              className={`px-1.5 py-0.5 rounded-full border border-(--hairline-strong) text-[10px] ${
                risk.direction === "REMOVED" ? "text-(--down)" : "text-(--up)"
              }`}
            >
              LIQ {risk.direction}
            </span>
            <span className={risk.severity === "HIGH" ? "text-(--down)" : "text-(--champagne)"}>
              {risk.severity}
            </span>
          </div>
          <p className="text-[11px] font-mono text-muted-foreground">
            {pctText(risk.change.deltaRel * 100)} · {usd(risk.change.previousUsd)} →{" "}
            {usd(risk.change.currentUsd)} · over {mins(risk.change.spanMinutes)}
          </p>
        </div>
      )}
    </Section>
  );
}

const DIMENSION_LABEL: Record<Evidence["dimension"], string> = {
  volume: "VOLUME",
  transactions: "TRANSACTIONS",
  buyers: "BUYERS",
  liquidity: "LIQUIDITY",
  attention: "ATTENTION",
};

/** Raw inputs and judged value for one evidence dimension, from the intelligence model. */
function evidenceDetail(
  e: Evidence,
  intel: PairIntelligence,
): { inputs: string; value: string; threshold: string } {
  switch (e.dimension) {
    case "volume": {
      const va = intel.va;
      return {
        inputs: va.ok
          ? `m5 ${usd(va.recent)} vs prev ${usd(va.previous)} / ${va.previousMinutes}m`
          : (e.unavailable ?? ""),
        value: va.ok ? `${va.ratio.toFixed(1)}×` : "—",
        threshold: `≥ ${e.threshold.toFixed(1)}×`,
      };
    }
    case "transactions": {
      const ta = intel.ta;
      return {
        inputs: ta.ok
          ? `m5 ${ta.recent} vs prev ${ta.previous} / ${ta.previousMinutes}m`
          : (e.unavailable ?? ""),
        value: ta.ok ? `${ta.ratio.toFixed(1)}×` : "—",
        threshold: `≥ ${e.threshold.toFixed(1)}×`,
      };
    }
    case "buyers": {
      const bp = intel.bp;
      return {
        inputs: bp.ok
          ? `m5 ${bp.buys} buys : ${bp.sells} sells (n=${bp.sample})`
          : `${bp.reason}${bp.reason === "INSUFFICIENT_SAMPLE" ? ` (n=${bp.sample})` : ""}`,
        value: bp.ok ? `${bp.ratio.toFixed(1)}:1` : "—",
        threshold: `≥ ${e.threshold.toFixed(1)}:1`,
      };
    }
    case "liquidity": {
      const lc = intel.liquidityChange;
      return {
        inputs: lc
          ? `${usd(lc.previousUsd)} → ${usd(lc.currentUsd)} over ${mins(lc.spanMinutes)}`
          : (e.unavailable ?? ""),
        value: lc ? pctText(lc.deltaRel * 100) : "—",
        threshold: `≥ ${pctText(e.threshold * 100).replace(".0", "")}`,
      };
    }
    case "attention":
      return {
        inputs:
          intel.boostDelta != null ? "active boosts over retained history" : (e.unavailable ?? ""),
        value:
          intel.boostDelta != null ? `${intel.boostDelta >= 0 ? "+" : ""}${intel.boostDelta}` : "—",
        threshold: `≥ +${e.threshold}`,
      };
  }
}

function EvidenceSection({ intel }: { intel: PairIntelligence }) {
  const { liquidity, age } = intel.gates;
  return (
    <Section title="EVIDENCE">
      <div className="space-y-2" data-testid="evidence">
        {intel.evidence.map((e) => {
          const d = evidenceDetail(e, intel);
          const mark = !e.available ? "–" : e.passed ? "✓" : "✗";
          const markColor = !e.available
            ? "text-(--faint)"
            : e.passed
              ? "text-(--up)"
              : "text-(--down)";
          return (
            <div
              key={e.dimension}
              className="flex items-start justify-between gap-3 text-[11px] font-mono"
              data-dimension={e.dimension}
            >
              <div className="min-w-0">
                <span className={`${markColor} mr-2`}>{mark}</span>
                <span className="text-(--bone)">{DIMENSION_LABEL[e.dimension]}</span>
                <div className="text-[10px] text-muted-foreground mt-0.5 pl-4 break-words">
                  {d.inputs}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-(--bone)">{d.value}</div>
                <div className="text-[10px] text-(--faint)">{d.threshold}</div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] font-mono text-muted-foreground">
        GATES · LIQ ≥ {usd(liquidity.min)} {liquidity.passed ? "✓" : "✗"} · AGE ≥ {age.min}m{" "}
        {age.passed ? "✓" : "✗"}
      </p>
    </Section>
  );
}

const WINDOWS = ["m5", "h1", "h6", "h24"] as const;

function ActivitySection({ s }: { s: PairSnapshot }) {
  const txns = (w: TxnWindow | null) => (w ? String(w.buys + w.sells) : "—");
  const rows: Array<{ label: string; cell: (w: (typeof WINDOWS)[number]) => React.ReactNode }> = [
    { label: "VOLUME", cell: (w) => usd(s.volume[w]) },
    { label: "BUYS", cell: (w) => (s.txns[w] ? String(s.txns[w]!.buys) : "—") },
    { label: "SELLS", cell: (w) => (s.txns[w] ? String(s.txns[w]!.sells) : "—") },
    { label: "TXNS", cell: (w) => txns(s.txns[w]) },
    {
      label: "PRICE Δ",
      cell: (w) => {
        const v = s.priceChange[w];
        return (
          <span className={v == null ? "" : v >= 0 ? "text-(--up)" : "text-(--down)"}>
            {pctText(v)}
          </span>
        );
      },
    },
  ];
  return (
    <Section title="ACTIVITY">
      {/* ≥ 640px: one row per metric, one column per window. */}
      <div
        className="hidden sm:grid grid-cols-[auto_repeat(4,minmax(0,1fr))] gap-x-3 gap-y-1.5 text-[11px] font-mono"
        data-testid="activity-table"
      >
        <span />
        {WINDOWS.map((w) => (
          <span key={w} className="text-right text-(--faint) uppercase">
            {w}
          </span>
        ))}
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <span className="text-muted-foreground">{r.label}</span>
            {WINDOWS.map((w) => (
              <span key={w} className="text-right text-(--bone)">
                {r.cell(w)}
              </span>
            ))}
          </div>
        ))}
      </div>
      {/* Small mobile: a readable 2×2 of windows. */}
      <div className="grid sm:hidden grid-cols-2 gap-2" data-testid="activity-cards">
        {WINDOWS.map((w) => (
          <div key={w} className="rounded-md border border-(--hairline) p-2.5 space-y-1">
            <div className="text-[10px] font-mono text-(--faint) uppercase">{w}</div>
            {rows.map((r) => (
              <div key={r.label} className="flex justify-between gap-2 text-[11px] font-mono">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="text-(--bone)">{r.cell(w)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Section>
  );
}

function KV({
  label,
  children,
  mono = true,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-[11px]">
      <span className="font-mono text-muted-foreground shrink-0">{label}</span>
      <span className={`text-right text-(--bone) min-w-0 break-all ${mono ? "font-mono" : ""}`}>
        {children}
      </span>
    </div>
  );
}

function MarketSection({ intel }: { intel: PairIntelligence }) {
  const s = intel.snapshot;
  return (
    <Section title="MARKET">
      <div className="space-y-1.5">
        <KV label="PRICE">{priceText(s.priceUsd)}</KV>
        <KV label="LIQUIDITY">{usd(s.liquidityUsd)}</KV>
        <KV label="MARKET CAP">{usd(s.marketCap)}</KV>
        <KV label="FDV">{usd(s.fdv)}</KV>
        <KV label="ACTIVE BOOSTS">{s.boostsActive ?? "—"}</KV>
      </div>
    </Section>
  );
}

function IdentitySection({ ref_, intel }: { ref_: TokenRef; intel: PairIntelligence | null }) {
  const s = intel?.snapshot ?? null;
  return (
    <Section title="IDENTITY">
      <div className="space-y-1.5">
        <KV label="CHAIN">{ref_.chainId}</KV>
        {s && <KV label="DEX">{s.dexId ?? "—"}</KV>}
        {s && (
          <KV label="PAIR">
            {s.baseSymbol ?? "—"}/{s.quoteSymbol ?? "—"}
          </KV>
        )}
        <KV label="CONTRACT">
          <span data-testid="contract-address" className="select-all">
            {ref_.address}
          </span>
        </KV>
        {s?.pairAddress && (
          <KV label="PAIR ADDRESS">
            <span className="select-all">{s.pairAddress}</span>
          </KV>
        )}
        {intel && (
          <KV label="AGE">
            {intel.ageMinutes != null ? `${mins(intel.ageMinutes)} at observation` : "—"}
          </KV>
        )}
        {s?.pairCreatedAt != null && <KV label="CREATED">{utc(s.pairCreatedAt)}</KV>}
      </div>
    </Section>
  );
}

function SourcesSection({ model }: { model: DrawerModel }) {
  const sources: SourceDetail[] = model.kind === "identity" ? [] : model.sources;
  return (
    <Section title="IN UNIVERSE VIA">
      {sources.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Not in the current universe. Opened from {ENTRY_LABEL[model.ref.entry]}.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2" data-testid="sources">
          {sources.map((src) => (
            <span
              key={src.source}
              className="px-2 py-0.5 rounded-full border border-(--hairline-strong) text-(--gold) text-[10px] font-mono"
            >
              {SOURCE_LABEL[src.source]}
              {src.detail && <span className="text-muted-foreground"> · {src.detail}</span>}
            </span>
          ))}
        </div>
      )}
    </Section>
  );
}

const ACTION =
  "px-4 py-2 rounded-full text-[11px] font-mono transition-all hairline text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--gold)";

function ActionsSection({ ref_, snapshot }: { ref_: TokenRef; snapshot: PairSnapshot | null }) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (copy === "idle") return;
    const t = window.setTimeout(() => setCopy("idle"), 2000);
    return () => window.clearTimeout(t);
  }, [copy]);

  const explorer = explorerUrl(ref_.chainId, ref_.address);
  const onCopy = async () => {
    try {
      // The provider's original address — never the lowercase lookup key.
      await navigator.clipboard.writeText(ref_.address);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  };

  return (
    <Section title="ACTIONS">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onCopy} className={ACTION} data-testid="copy-ca">
          {copy === "copied" ? "COPIED" : "COPY CA"}
        </button>
        <a
          href={dexScreenerUrl(ref_, snapshot)}
          target="_blank"
          rel="noopener noreferrer"
          className={ACTION}
          data-testid="open-dexscreener"
        >
          OPEN DEXSCREENER
        </a>
        {explorer && (
          <a
            href={explorer}
            target="_blank"
            rel="noopener noreferrer"
            className={ACTION}
            data-testid="open-explorer"
          >
            EXPLORER
          </a>
        )}
      </div>
      {copy === "failed" && (
        <p className="text-[10px] text-muted-foreground">
          Copy failed — select the contract address above.
        </p>
      )}
    </Section>
  );
}

function shortAddress(a: string) {
  return a.length <= 11 ? a : `${a.slice(0, 5)}…${a.slice(-4)}`;
}
