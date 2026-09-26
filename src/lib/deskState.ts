import type { ProviderStatus } from "@/lib/providers/envelope";

/**
 * The desk's status vocabulary: one word per provider state, everywhere.
 *
 * Every mapping below is an exhaustive Record over the finite state union, and
 * every lookup goes through `known()`: a value outside the union (a bad cast,
 * a new provider state) renders as UNKNOWN — it can never fall through to LIVE.
 */
export type DeskState = "loading" | ProviderStatus;
/** A single provider feed's state (same union as the hooks' FeedStatus). */
export type FeedStatus = DeskState;

export const STATE_TEXT: Record<DeskState, string> = {
  loading: "CONNECTING",
  live: "LIVE",
  degraded: "DEGRADED",
  stale: "STALE",
  offline: "OFFLINE",
};

const STATES = Object.keys(STATE_TEXT) as DeskState[];

/** Narrow an arbitrary runtime value to a known state, or null. */
export function known(state: unknown): DeskState | null {
  return STATES.includes(state as DeskState) ? (state as DeskState) : null;
}

/** "BOOST FEED · LIVE" — the title states the feed's real provider status. */
export function feedState(status: FeedStatus): string {
  const s = known(status);
  return s ? STATE_TEXT[s] : "UNKNOWN";
}

/**
 * The topbar status is the PAIR UNIVERSE (DexScreener) round — not every
 * provider on the desk — so its visible label names that scope.
 */
export function universeLabel(state: DeskState): string {
  const s = known(state);
  return `UNIVERSE ${s ? STATE_TEXT[s] : "UNKNOWN"}`;
}

export const UNIVERSE_HELP: Record<DeskState, string> = {
  loading: "Pair universe (DexScreener): waiting for the first round.",
  live: "Pair universe (DexScreener): every source answered this round. Other panels (CoinGecko, Fear & Greed) report their own state.",
  degraded: "Pair universe (DexScreener): some sources failed this round — partial universe.",
  stale: "Pair universe (DexScreener): not responding — showing the last verified round.",
  offline: "Pair universe (DexScreener): could not be reached — no current round.",
};

export type Tone = "neutral" | "warn" | "down";

const LINE: Record<FeedStatus, { word: string; tone: Tone }> = {
  loading: { word: "CONNECTING", tone: "neutral" },
  live: { word: "LIVE", tone: "neutral" },
  degraded: { word: "PARTIAL", tone: "warn" },
  stale: { word: "LAST KNOWN", tone: "warn" },
  offline: { word: "UNAVAILABLE", tone: "down" },
};

/** KPI source line, e.g. "LAST KNOWN · COINGECKO". Unknown input → "UNKNOWN", never LIVE. */
export function providerLine(status: FeedStatus, source: string): { text: string; tone: Tone } {
  const s = known(status);
  const l = s ? LINE[s] : { word: "UNKNOWN", tone: "warn" as const };
  return { text: `${l.word} · ${source}`, tone: l.tone };
}

/* ------------------------------------------------------------------ *
 * Quick Stats: two independent providers behind one panel
 * ------------------------------------------------------------------ */

export type QuickStatsInput = {
  btcDominance: number | null;
  totalMcap: number | null;
  mcapChange24h: number | null;
  fearGreed: number | null;
} | null;

export type QuickStatsState = {
  /** loading = first request in flight; live = every figure real; partial = some; offline = none. */
  state: "loading" | "live" | "partial" | "offline";
  /** Sources that returned no figure this round. */
  missing: ("CoinGecko" | "alternative.me")[];
};

/**
 * CoinGecko (dominance, market cap, 24h change) and alternative.me (Fear &
 * Greed) are fetched with Promise.allSettled, so either may answer alone.
 * Partial truth is stated as PARTIAL; unknown figures stay unknown.
 */
export function quickStatsState(gs: QuickStatsInput, pending: boolean): QuickStatsState {
  if (pending && !gs) return { state: "loading", missing: [] };
  const gecko = [gs?.btcDominance, gs?.totalMcap, gs?.mcapChange24h];
  const geckoCount = gecko.filter((v) => v != null).length;
  const fng = gs?.fearGreed != null;
  const missing: QuickStatsState["missing"] = [];
  if (geckoCount < gecko.length) missing.push("CoinGecko");
  if (!fng) missing.push("alternative.me");
  const present = geckoCount + (fng ? 1 : 0);
  return {
    state: present === 4 ? "live" : present === 0 ? "offline" : "partial",
    missing,
  };
}

export const QUICK_STATS_WORD: Record<QuickStatsState["state"], string | null> = {
  loading: null,
  live: "LIVE",
  partial: "PARTIAL",
  offline: "OFFLINE",
};
