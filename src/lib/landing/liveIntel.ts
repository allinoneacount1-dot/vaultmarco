import type { BoostToken } from "@/components/marco/shared/types";
import { assetKey } from "@/lib/assetIdentity";
import { type DeskState, known } from "@/lib/deskState";
import { CANONICAL_PAIRS, type RealtimeRow } from "@/lib/providers/dexPairs";
import type { DataEnvelope } from "@/lib/providers/envelope";

/**
 * LANDING · VAULT://INTELLIGENCE — pure truth rules for the landing preview.
 *
 * The preview reads the SAME query caches as the dashboard (DEX realtime fast
 * lane, pair universe, global stats); nothing here fetches. Every function is
 * pure and deterministic given `now`, so the rules are unit-tested directly.
 *
 * INVARIANT — NO_SYNTHETIC_MARKET_DATA: nothing below produces a market value.
 * It only selects, validates, counts and ages values a provider returned.
 */

/* ------------------------------------------------------------------ *
 * Freshness
 * ------------------------------------------------------------------ */

/**
 * Maximum age (ms since the last successful provider response) at which a
 * provider may still read LIVE on the landing. Older real data reads STALE.
 *   DEX realtime: 30 s cadence → 45 s.   60 s feeds / global stats → 90 s.
 */
export const LIVE_MAX_AGE_MS = {
  dexRealtime: 45_000,
  boostFeed: 90_000,
  adsFeed: 90_000,
  globalStats: 90_000,
} as const;

export type ProviderId = keyof typeof LIVE_MAX_AGE_MS;

/**
 * A provider's landing state: its own status, downgraded to `stale` once its
 * last real success is older than the LIVE window. An unknown status, or a
 * "live" without a success timestamp, can never read LIVE.
 */
export function agedState(
  status: unknown,
  lastSuccessfulAt: number | null | undefined,
  now: number,
  maxAgeMs: number,
): DeskState {
  const s = known(status);
  if (s == null) return "offline";
  if (s !== "live" && s !== "degraded") return s;
  if (lastSuccessfulAt == null || !Number.isFinite(lastSuccessfulAt)) return "stale";
  return now - lastSuccessfulAt > maxAgeMs ? "stale" : s;
}

/**
 * The section's one status word, from every provider it shows:
 *   loading  — nothing has answered yet and nothing has failed;
 *   live     — every provider live and fresh (and nothing else partial);
 *   offline  — every provider offline;
 *   stale    — nothing live, some last-known data shown;
 *   degraded — anything else (shown as PARTIAL).
 * It is never `live` unless everything shown is live and fresh.
 */
export function sectionState(states: readonly DeskState[], partial = false): DeskState {
  if (states.length === 0) return "offline";
  if (states.every((s) => s === "loading")) return "loading";
  if (states.every((s) => s === "offline")) return "offline";
  if (states.every((s) => s === "live")) return partial ? "degraded" : "live";
  // Some still connecting, the rest live: not live yet, not a failure either.
  if (states.every((s) => s === "loading" || s === "live")) return "loading";
  // Nothing current: last-known data where there is some, otherwise offline.
  if (states.every((s) => s === "stale" || s === "offline")) return "stale";
  // Any other mix (live beside failures, connecting beside failures, degraded).
  return "degraded";
}

/** Section status words — the deskState vocabulary, with `degraded` read as PARTIAL. */
export const SECTION_TEXT: Record<DeskState, string> = {
  loading: "CONNECTING",
  live: "LIVE",
  degraded: "PARTIAL",
  stale: "STALE",
  offline: "OFFLINE",
};

/** "12S AGO" / "3M AGO" / "2H AGO" from a real timestamp; null when unknown. */
export function ageLabel(at: number | null | undefined, now: number): string | null {
  if (at == null || !Number.isFinite(at)) return null;
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 60) return `${s}S AGO`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}M AGO`;
  return `${Math.floor(m / 60)}H AGO`;
}

/** "$1.23T" / "$98.4B" / "$12.3M" / "$0" — a real value re-presented; unknown is "—". */
export function compactUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  return `${sign}$${Math.round(a).toLocaleString("en-US")}`;
}

/** The OLDEST success among the data shown — "updated" never overstates freshness. */
export function oldestSuccess(times: ReadonlyArray<number | null | undefined>): number | null {
  const real = times.filter((t): t is number => t != null && Number.isFinite(t));
  return real.length ? Math.min(...real) : null;
}

/* ------------------------------------------------------------------ *
 * LATEST BOOSTS
 * ------------------------------------------------------------------ */

/**
 * Count of genuine records in DexScreener's latest-boosts response.
 *
 * Records that failed schema validation were already dropped by the provider
 * layer (and made the feed `degraded`), so they are not counted. Two records
 * are TRUE DUPLICATES — counted once — only when they are the same asset
 * (assetKey of chain + token address) AND carry the same `amount`,
 * `totalAmount` and `url`. The same token boosted twice with different amounts
 * is two records.
 */
export function latestBoostCount(tokens: readonly BoostToken[] | null | undefined): number | null {
  if (!tokens) return null;
  const seen = new Set<string>();
  for (const t of tokens) {
    seen.add(
      [assetKey(t.chainId, t.tokenAddress), t.boostAmount, t.boostTotal, t.url].join("\u0000"),
    );
  }
  return seen.size;
}

/* ------------------------------------------------------------------ *
 * Ticker rows — the canonical DEX Realtime pairs, identity first
 * ------------------------------------------------------------------ */

/** Horizon of every % in the ticker. Never mixed. */
export const TICKER_HORIZON = "24H";

export type TickerRow = {
  /** Stable key: the canonical pair address on its chain. */
  key: string;
  chainId: string;
  chainLabel: string;
  pairAddress: string;
  baseAddress: string;
  quoteAddress: string;
  pairLabel: string;
  resolved: boolean;
  priceUsd: number | null;
  /** DexScreener `priceChange.h24`; null when the provider did not send it. */
  change24h: number | null;
};

const CHAIN_LABEL: Record<string, string> = {
  solana: "SOL",
  ethereum: "ETH",
  base: "BASE",
  hyperliquid: "HL",
};

export function chainLabel(chainId: string): string {
  return CHAIN_LABEL[chainId.toLowerCase()] ?? chainId.toUpperCase();
}

/**
 * One row per CANONICAL pair, in canonical order. Values come only from a row
 * the provider layer resolved on an exact chain + base + quote match for the
 * same pair address; anything else is identity with no values ("—").
 */
export function tickerRows(rows: readonly RealtimeRow[] | null | undefined): TickerRow[] {
  return CANONICAL_PAIRS.map((c) => {
    const r = rows?.find(
      (x) =>
        x.resolved &&
        x.chainId.toLowerCase() === c.chainId.toLowerCase() &&
        assetKey(c.chainId, x.pairAddress) === assetKey(c.chainId, c.pairAddress),
    );
    return {
      key: assetKey(c.chainId, c.pairAddress),
      chainId: c.chainId,
      chainLabel: chainLabel(c.chainId),
      pairAddress: c.pairAddress,
      baseAddress: c.baseAddress,
      quoteAddress: c.quoteAddress,
      pairLabel: `${r?.baseSymbol ?? c.baseSymbol} / ${r?.quoteSymbol ?? c.quoteSymbol}`,
      resolved: Boolean(r),
      priceUsd: r ? r.priceUsd : null,
      change24h: r ? r.change24h : null,
    };
  });
}

/**
 * A row is incomplete when it is unresolved OR any value it displays is
 * unknown — a resolved pair can still lack priceUsd or priceChange.h24 (both
 * optional at the provider). A real 0 is a value, not a gap.
 */
export function rowIncomplete(r: TickerRow): boolean {
  return !r.resolved || r.priceUsd == null || r.change24h == null;
}

/* ------------------------------------------------------------------ *
 * The whole preview model
 * ------------------------------------------------------------------ */

type Env<T> = DataEnvelope<T> | undefined | null;

export type FeedInput<T> = { status: DeskState; envelope: Env<T> };

export type PreviewInput = {
  now: number;
  realtime: FeedInput<RealtimeRow[]>;
  boosts: FeedInput<BoostToken[]>;
  ads: FeedInput<unknown>;
  global: FeedInput<{
    totalMcapUsd: number | null;
    totalVolumeUsd: number | null;
    mcapChange24hPct: number | null;
  } | null>;
};

export type MetricCell = {
  key: "vol" | "boosts" | "mcap";
  label: string;
  value: number | null;
  /** 24h change where a real one exists (MARKET CAP only); otherwise absent. */
  change?: number | null;
  source: string;
  state: DeskState;
};

export type PreviewModel = {
  state: DeskState;
  updatedAt: number | null;
  feeds: {
    dexRealtime: DeskState;
    boostFeed: DeskState;
    adsFeed: DeskState;
    globalStats: DeskState;
  };
  metrics: MetricCell[];
  rows: TickerRow[];
};

/** Data is only readable from an envelope that is not `offline`. */
function dataOf<T>(f: FeedInput<T>): T | undefined {
  return f.envelope && f.envelope.status !== "offline" ? (f.envelope.data ?? undefined) : undefined;
}

export function previewModel(i: PreviewInput): PreviewModel {
  const age = (id: ProviderId, f: FeedInput<unknown>) =>
    agedState(f.status, f.envelope?.lastSuccessfulAt, i.now, LIVE_MAX_AGE_MS[id]);

  const feeds = {
    dexRealtime: age("dexRealtime", i.realtime),
    boostFeed: age("boostFeed", i.boosts),
    adsFeed: age("adsFeed", i.ads),
    globalStats: age("globalStats", i.global),
  };

  const g = dataOf(i.global) ?? null;
  const boosts = dataOf(i.boosts);
  const rows = tickerRows(dataOf(i.realtime));

  const metrics: MetricCell[] = [
    {
      key: "vol",
      label: "GLOBAL VOL 24H",
      value: g?.totalVolumeUsd ?? null,
      source: "COINGECKO",
      state: feeds.globalStats,
    },
    {
      key: "boosts",
      label: "LATEST BOOSTS",
      value: latestBoostCount(boosts),
      source: "DEXSCREENER",
      state: feeds.boostFeed,
    },
    {
      key: "mcap",
      label: "GLOBAL MCAP",
      value: g?.totalMcapUsd ?? null,
      change: g?.mcapChange24hPct ?? null,
      source: "COINGECKO",
      state: feeds.globalStats,
    },
  ];

  // Anything shown as "—" after its provider answered makes the section partial.
  const answered = (s: DeskState) => s !== "loading" && s !== "offline";
  const missingValue =
    metrics.some((m) => answered(m.state) && (m.value == null || m.change === null)) ||
    (answered(feeds.dexRealtime) && rows.some(rowIncomplete));

  const shown = [i.realtime, i.boosts, i.ads, i.global].map((f) =>
    f.envelope && f.envelope.status !== "offline" ? f.envelope.lastSuccessfulAt : null,
  );

  return {
    state: sectionState(Object.values(feeds), missingValue),
    updatedAt: oldestSuccess(shown),
    feeds,
    metrics,
    rows,
  };
}

/** The idle frame rendered before the section scrolls into view: identity only. */
export function idleModel(): PreviewModel {
  const loading = { status: "loading" as const, envelope: undefined };
  return previewModel({
    now: 0,
    realtime: loading,
    boosts: loading,
    ads: loading,
    global: loading,
  });
}
