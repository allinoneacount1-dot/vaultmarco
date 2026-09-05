import { useState } from "react";
import { Activity, ArrowUpRight } from "lucide-react";
import { Panel } from "./Panel";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "./SectionHeader";
import { formatNumber } from "./shared/helpers";
import {
  CANONICAL_PAIRS,
  DEXSCREENER_SOURCE,
  dexToolsUrl,
  fetchRealtimePairs,
  type RealtimeRow,
} from "@/lib/providers/dexPairs";
import { type DataEnvelope, type ProviderStatus, resolveEnvelope } from "@/lib/providers/envelope";

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

function price(n: number | null): string {
  if (n == null) return "—";
  return `$${n < 0.001 ? n.toFixed(8) : n < 1 ? n.toFixed(4) : n.toFixed(2)}`;
}

function changeText(n: number | null): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function useRealtimePairs() {
  const query = useQuery<DataEnvelope<RealtimeRow[]>>({
    queryKey: ["dexRealtime", "screener"],
    queryFn: () => fetchRealtimePairs(),
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
    // Surface provider failure as an error rather than a paused query, so a
    // stale payload can never keep a live label.
    networkMode: "always",
  });

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

export function DexRealtimeTab() {
  const [dexSource, setDexSource] = useState("screener"); // screener or dextools
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

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <button
          onClick={() => setDexSource("screener")}
          className={`px-4 py-2 rounded-full text-[11px] font-mono transition-all ${
            dexSource === "screener"
              ? "chrome-fill"
              : "hairline text-muted-foreground hover:text-foreground"
          }`}
        >
          DEXSCREENER
        </button>
        <button
          onClick={() => setDexSource("dextools")}
          className={`px-4 py-2 rounded-full text-[11px] font-mono transition-all ${
            dexSource === "dextools"
              ? "chrome-fill"
              : "hairline text-muted-foreground hover:text-foreground"
          }`}
        >
          DEXTOOLS
        </button>
      </div>

      <Panel title={`DEX REALTIME · ${dexSource.toUpperCase()}`} icon={Activity}>
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-md border border-(--hairline) p-3"
              >
                <div className="h-4 w-24 bg-(--panel-2) rounded animate-pulse mb-2" />
                <div className="h-3 w-48 bg-(--panel-2) rounded animate-pulse" />
              </motion.div>
            ))
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="whileInView"
              viewport={{ once: true, margin: "-100px" }}
              className="space-y-3"
            >
              {message && <div className="text-[11px] text-muted-foreground">{message}</div>}
              {data.map((p) => {
                const href = isDexTools ? dexToolsUrl(p) : (p.url ?? dexToolsUrl(p));
                return (
                  <motion.a
                    key={p.key}
                    variants={fadeUp}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-md border border-(--hairline) p-3 hover:bg-(--panel-2) hover:border-(--hairline-strong) transition-all group"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-[12px] font-mono text-foreground">
                        <span className="px-2 py-0.5 rounded-full border border-(--hairline-strong) text-(--gold)">
                          {p.chainId.toUpperCase()}
                        </span>
                        {p.baseSymbol}/{p.quoteSymbol}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        Vol: {money(p.volume24h)}• Liq: {money(p.liquidityUsd)}
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <div className="text-[12px] font-mono text-foreground">
                          {price(p.priceUsd)}
                        </div>
                        <div
                          className={`text-[11px] font-mono mt-1 ${
                            p.change24h != null && p.change24h < 0 ? "text-(--down)" : "text-(--up)"
                          }`}
                        >
                          {changeText(p.change24h)}
                        </div>
                      </div>
                      <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-(--gold) transition-all opacity-0 group-hover:opacity-100" />
                    </div>
                  </motion.a>
                );
              })}
            </motion.div>
          )}
        </div>
      </Panel>
    </div>
  );
}
