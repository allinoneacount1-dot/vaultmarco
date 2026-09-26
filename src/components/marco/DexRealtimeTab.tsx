import { useState } from "react";
import { ArrowUpRight, Eye } from "lucide-react";
import { Panel } from "./Panel";
import { TapeSkeleton } from "./Skeleton";
import { Pct, Price, Segmented } from "./desk";
import { useArrivals } from "@/hooks/useArrivals";
import { feedState } from "@/lib/deskState";
import { formatNumber } from "./shared/helpers";
import {
  CANONICAL_PAIRS,
  DEXSCREENER_SOURCE,
  dexToolsUrl,
  type RealtimeRow,
} from "@/lib/providers/dexPairs";
import { type ProviderStatus, resolveEnvelope } from "@/lib/providers/envelope";
import { useRealtimeQuery } from "@/hooks/usePairUniverse";
import { useTokenDrawerActions } from "@/hooks/useTokenDrawer";
import { refFromRealtime } from "@/lib/tokenDrawer";

type FeedStatus = "loading" | ProviderStatus;

/** Identity-only rows: real pair identity, no market values claimed. */
const IDENTITY_ROWS: RealtimeRow[] = CANONICAL_PAIRS.map((p) => ({
  key: p.key,
  chainId: p.chainId,
  pairAddress: p.pairAddress,
  baseSymbol: p.baseSymbol,
  quoteSymbol: p.quoteSymbol,
  resolved: false,
  priceUsd: null,
  change24h: null,
  volume24h: null,
  liquidityUsd: null,
  url: null,
}));

const money = (n: number | null) => (n == null ? "—" : formatNumber(n));

function useRealtimePairs() {
  // Fast lane (30 s); the pair universe reads the same cache entry.
  const query = useRealtimeQuery();

  const envelope = resolveEnvelope({
    source: DEXSCREENER_SOURCE,
    previous: query.data,
    isError: query.isError,
    error: query.error,
    fetchStatus: query.fetchStatus,
    fetchFailureCount: query.failureCount,
    fetchFailureReason: query.failureReason,
  });

  const status: FeedStatus =
    query.isPending && !envelope ? "loading" : (envelope?.status ?? "offline");

  return { rows: envelope?.data, status };
}

function notice(status: FeedStatus, unresolved: number): string | null {
  if (status === "offline") return "Feed unavailable — DexScreener could not be reached.";
  if (status === "stale") return "Showing last known data — DexScreener is not responding.";
  if (unresolved > 0)
    return `${unresolved} of ${CANONICAL_PAIRS.length} pairs could not be verified and are not priced.`;
  return null;
}

const SOURCES = [
  { id: "screener", label: "DEXSCREENER" },
  { id: "dextools", label: "DEXTOOLS" },
] as const;

/**
 * DEX REALTIME — one module: the source switch lives in its header, rows are
 * market tape (hairline-separated), and every row is visible at first paint.
 */
export function DexRealtimeTab() {
  const [dexSource, setDexSource] = useState<"screener" | "dextools">("screener");
  const { open: openToken } = useTokenDrawerActions();
  const { rows, status } = useRealtimePairs();

  const isDexTools = dexSource === "dextools";
  const isLoading = !isDexTools && status === "loading";
  // DexTools publishes no free market API, so that tab shows pair identity and a
  // working explorer link — never market values attributed to DexTools.
  const data: RealtimeRow[] = isDexTools ? IDENTITY_ROWS : (rows ?? IDENTITY_ROWS);
  const unresolved = isDexTools ? 0 : data.filter((r) => !r.resolved).length;
  const message = isDexTools
    ? "DexTools publishes no public market API — open the explorer for live values."
    : notice(status, unresolved);
  const fresh = useArrivals(
    data.map((r) => r.key),
    !isLoading,
    dexSource,
  );

  return (
    <Panel
      title={
        isDexTools ? "DEX REALTIME · DEXTOOLS · IDENTITY" : `DEX REALTIME · ${feedState(status)}`
      }
      icon={Eye}
      aside={
        <Segmented
          label="Select DEX source"
          options={SOURCES}
          value={dexSource}
          onChange={setDexSource}
        />
      }
    >
      {isLoading ? (
        <TapeSkeleton rows={4} label="Loading DEX realtime pairs" />
      ) : (
        <div className="space-y-2">
          {message && <div className="text-[11px] text-muted-foreground">{message}</div>}
          <div className="mv-tape -mx-2">
            {data.map((p) => {
              const rowClass = `mv-row group flex w-full items-center justify-between gap-3 rounded-sm px-2 py-2.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--gold) ${
                fresh.has(p.key) ? "mv-row-new" : ""
              }`;
              const content = (
                <>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-mono text-[12px] text-(--bone)">
                      <span className="truncate">
                        {p.baseSymbol}/{p.quoteSymbol}
                      </span>
                      <span className="mv-chip text-(--gold)">{p.chainId.toUpperCase()}</span>
                    </div>
                    <div className="mono-data mt-1 truncate text-[10px] text-muted-foreground lg:text-[11px]">
                      VOL {money(p.volume24h)} · LIQ {money(p.liquidityUsd)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-right">
                    <div>
                      <Price value={p.priceUsd} className="block text-[12px] text-(--bone)" />
                      <Pct value={p.change24h} className="mt-1 block text-[10px] lg:text-[11px]" />
                    </div>
                    {isDexTools && (
                      <ArrowUpRight
                        aria-hidden
                        className="size-3.5 text-(--faint) transition-colors duration-(--dur-micro) group-hover:text-(--gold)"
                      />
                    )}
                  </div>
                </>
              );
              // DEXTOOLS has no market API: its rows stay external explorer links.
              if (isDexTools) {
                return (
                  <a
                    key={p.key}
                    href={dexToolsUrl(p)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={rowClass}
                  >
                    {content}
                    <span className="sr-only">(opens DexTools in a new tab)</span>
                  </a>
                );
              }
              // DEXSCREENER rows open the Token Intelligence Drawer; the
              // provider link is one tap away inside it.
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={(e) => openToken(refFromRealtime(p), e.currentTarget)}
                  className={`${rowClass} cursor-pointer`}
                >
                  {content}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}
