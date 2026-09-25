import type { AdToken, BoostToken } from "@/components/marco/shared/types";
import { canonicalAddressForKey, isEvmHexAddress } from "@/lib/assetIdentity";
import { normalizeChain } from "@/lib/providers/dexscreener";
import type { PairUniverse } from "@/lib/providers/universe";
import type { PairSnapshot, UniverseSource } from "@/lib/signals/pairSnapshot";
import { type TokenRef, refFromAd, refFromBoost, refFromSnapshot } from "@/lib/tokenDrawer";

/**
 * GLOBAL SEARCH — a deterministic index over data MARCOVAULT already holds.
 *
 * The index is built from the shared Pair Universe cache and the retained
 * snapshot history; it never fetches, never invents entries, and uses the
 * canonical `assetKey` identity, so a search result opens exactly the same
 * Token Intelligence Drawer model as any other entry point.
 */

/** How much MARCOVAULT currently knows about an indexed token. */
export type SearchState = "current" | "retained" | "identity";

export type SearchEntry = {
  key: string;
  /** Reference handed to the Token Drawer (entry point "search"). */
  ref: TokenRef;
  state: SearchState;
  chainId: string;
  /** Provider's original address — used for matching, display and links. */
  address: string;
  symbol: string | null;
  name: string | null;
  sources: UniverseSource[];
  /** Latest real observation, when there is one (current or retained). */
  snapshot: PairSnapshot | null;
  /** The radar's own signal for this pair this round, if any. */
  signal: "EARLY MOMENTUM" | "LIQ REMOVED" | "LIQ ADDED" | null;
};

type HistoryReader = { latestAll(): PairSnapshot[] };

const STATE_ORDER: Record<SearchState, number> = { current: 0, retained: 1, identity: 2 };

/**
 * Build the search index: every pair in the current universe, every pair
 * still retained in history, and every feed record (boost / ad) whose token
 * has no observation yet — identity only. Deduplicated by `assetKey`, keeping
 * the most-informed state.
 */
export function buildSearchIndex(
  universe: PairUniverse | undefined,
  history: HistoryReader,
): SearchEntry[] {
  const out = new Map<string, SearchEntry>();
  const signalFor = (key: string): SearchEntry["signal"] => {
    if (universe?.radar.momentum.some((m) => m.key === key)) return "EARLY MOMENTUM";
    const risk = universe?.radar.risk.find((e) => e.key === key);
    return risk ? (risk.direction === "REMOVED" ? "LIQ REMOVED" : "LIQ ADDED") : null;
  };
  const fromSnapshot = (s: PairSnapshot, state: SearchState): SearchEntry => ({
    key: s.key,
    ref: refFromSnapshot(s, "search"),
    state,
    chainId: s.chainId,
    address: s.baseAddress,
    symbol: s.baseSymbol,
    name: s.baseName,
    sources: s.sources,
    snapshot: s,
    signal: state === "current" ? signalFor(s.key) : null,
  });

  for (const s of universe?.snapshots ?? []) out.set(s.key, fromSnapshot(s, "current"));
  for (const s of history.latestAll()) {
    if (!out.has(s.key)) out.set(s.key, fromSnapshot(s, "retained"));
  }
  const identity = (ref: TokenRef, source: UniverseSource) => {
    const existing = out.get(ref.key);
    if (existing) return;
    out.set(ref.key, {
      key: ref.key,
      ref: { ...ref, entry: "search" },
      state: "identity",
      chainId: ref.chainId,
      address: ref.address,
      symbol: ref.symbol,
      name: ref.name,
      sources: [source],
      snapshot: null,
      signal: null,
    });
  };
  for (const b of (universe?.boosts?.data ?? []) as BoostToken[])
    identity(refFromBoost(b), "boost-latest");
  for (const a of (universe?.ads?.data ?? []) as AdToken[]) identity(refFromAd(a), "ad");

  return [...out.values()];
}

/* ------------------------------------------------------------------ *
 * Matching
 * ------------------------------------------------------------------ */

/**
 * Match tiers, best first — the whole ranking rule, no hidden score.
 * An entry must match EVERY query term; its tier is its worst term's tier,
 * so "pepe solana" ranks by how well both terms match.
 */
export const TIER = {
  EXACT_ADDRESS: 0, // full contract address (identity rule: hex any case, Base58 exact)
  EXACT_SYMBOL: 1, // "honse", "$HONSE"
  SYMBOL_PREFIX: 2, // "hon"
  EXACT_NAME: 3, // the full token name
  NAME_PREFIX: 4, // the name, or any word of it, starts with the term
  PARTIAL_ADDRESS: 5, // "46vV3…pump", or ≥ 6 characters of the address
  CONTAINS: 6, // symbol or name contains the term (≥ 2 characters)
  CHAIN: 7, // "solana" / "sol", "base", "ethereum" / "eth", "bsc" / "bnb"
  SOURCE: 8, // "boost", "ads", "realtime", "radar"
} as const;

export const TIER_LABEL: Record<number, string> = {
  [TIER.EXACT_ADDRESS]: "CA",
  [TIER.EXACT_SYMBOL]: "SYMBOL",
  [TIER.SYMBOL_PREFIX]: "SYMBOL",
  [TIER.EXACT_NAME]: "NAME",
  [TIER.NAME_PREFIX]: "NAME",
  [TIER.PARTIAL_ADDRESS]: "CA",
  [TIER.CONTAINS]: "TEXT",
  [TIER.CHAIN]: "CHAIN",
  [TIER.SOURCE]: "SOURCE",
};

const NO_MATCH = Number.POSITIVE_INFINITY;

/** Minimum length for a bare address fragment, so short words never match addresses. */
const MIN_ADDRESS_FRAGMENT = 6;

/**
 * Address fragment comparison honouring the identity rule: 0x-hex compares
 * case-insensitively, everything else (Solana/Base58) exactly.
 */
function addressFold(address: string, fragment: string): [string, string] {
  return isEvmHexAddress(address)
    ? [address.toLowerCase(), fragment.toLowerCase()]
    : [address, fragment];
}

/** "46vV3…pump" / "46vV3...pump" → prefix + suffix of one address. */
const SHORT_ADDRESS = /^([0-9A-Za-z]{2,})(?:…|\.{2,3})([0-9A-Za-z]{2,})$/;

function matchesPartialAddress(address: string, term: string): boolean {
  const short = SHORT_ADDRESS.exec(term);
  if (short) {
    const [a, p] = addressFold(address, short[1]);
    const [, x] = addressFold(address, short[2]);
    return a.startsWith(p) && a.endsWith(x) && a.length > p.length + x.length;
  }
  if (term.length < MIN_ADDRESS_FRAGMENT) return false;
  const [a, t] = addressFold(address, term);
  return a.includes(t);
}

const SOURCE_WORDS: Record<string, UniverseSource[]> = {
  boost: ["boost-latest", "boost-top"],
  boosts: ["boost-latest", "boost-top"],
  ad: ["ad"],
  ads: ["ad"],
  realtime: ["realtime"],
};

function termTier(e: SearchEntry, term: string): number {
  const t = term.toLowerCase();
  const bare = t.replace(/^\$/, "");
  const symbol = e.symbol?.toLowerCase() ?? null;
  const name = e.name?.toLowerCase() ?? null;

  if (canonicalAddressForKey(term) === canonicalAddressForKey(e.address)) return TIER.EXACT_ADDRESS;
  if (symbol != null && bare && symbol === bare) return TIER.EXACT_SYMBOL;
  if (symbol != null && bare && symbol.startsWith(bare)) return TIER.SYMBOL_PREFIX;
  if (name != null && name === t) return TIER.EXACT_NAME;
  if (name != null && (name.startsWith(t) || name.split(/\s+/).some((w) => w.startsWith(t)))) {
    return TIER.NAME_PREFIX;
  }
  if (matchesPartialAddress(e.address, term)) return TIER.PARTIAL_ADDRESS;
  if (t.length >= 2 && (symbol?.includes(t) || name?.includes(t))) return TIER.CONTAINS;
  if (t === e.chainId.toLowerCase() || normalizeChain(t) === normalizeChain(e.chainId)) {
    return TIER.CHAIN;
  }
  const sources = SOURCE_WORDS[t];
  if (sources && e.sources.some((s) => sources.includes(s))) return TIER.SOURCE;
  if (t === "radar" && e.signal) return TIER.SOURCE;
  return NO_MATCH;
}

/**
 * A complete address as pasted: 0x + 40 hex, or a 32–44 character
 * alphanumeric run (Solana-style). Deliberately looser than strict Base58, so
 * a case-mangled Solana address is still reported as an unknown address
 * rather than silently matching nothing.
 */
export function looksLikeFullAddress(q: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(q) || /^[0-9A-Za-z]{32,44}$/.test(q);
}

export type SearchResult = { entry: SearchEntry; tier: number };

export type SearchOutcome = {
  results: SearchResult[];
  /** Total matches before the display limit. */
  total: number;
  /** A pasted full address that matches nothing MARCOVAULT holds. */
  unknownAddress: string | null;
  /** Lower-cased symbols shared by more than one result (shown with extra context). */
  duplicateSymbols: Set<string>;
};

const liq = (e: SearchEntry) => e.snapshot?.liquidityUsd ?? -1;

function compare(a: SearchResult, b: SearchResult): number {
  return (
    a.tier - b.tier ||
    STATE_ORDER[a.entry.state] - STATE_ORDER[b.entry.state] ||
    Number(b.entry.signal != null) - Number(a.entry.signal != null) ||
    liq(b.entry) - liq(a.entry) ||
    (a.entry.key < b.entry.key ? -1 : a.entry.key > b.entry.key ? 1 : 0)
  );
}

/** Deterministic search over the index. Same index + query → same results, same order. */
export function searchIndex(
  entries: readonly SearchEntry[],
  query: string,
  limit = 20,
): SearchOutcome {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  const matched: SearchResult[] = [];
  for (const entry of entries) {
    // Rank = worst TEXT term (symbol / name / address). Chain and source terms
    // only narrow the results ("pepe solana" ranks by "pepe"), unless the
    // query has nothing else. Empty query: browse everything, tier 0.
    let text = -1;
    let filter = -1;
    for (const term of terms) {
      const t = termTier(entry, term);
      if (t === NO_MATCH) {
        text = NO_MATCH;
        break;
      }
      if (t >= TIER.CHAIN) filter = Math.max(filter, t);
      else text = Math.max(text, t);
    }
    if (text === NO_MATCH) continue;
    matched.push({ entry, tier: text >= 0 ? text : Math.max(filter, 0) });
  }
  matched.sort(compare);

  // A pasted complete address MARCOVAULT does not hold: say so, list nothing.
  const single = terms.length === 1 ? terms[0] : null;
  const unknownAddress =
    single && looksLikeFullAddress(single) && !matched.some((r) => r.tier === TIER.EXACT_ADDRESS)
      ? single
      : null;
  if (unknownAddress) matched.length = 0;

  const results = matched.slice(0, limit);
  const counts = new Map<string, number>();
  for (const r of results) {
    const s = r.entry.symbol?.toLowerCase();
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const duplicateSymbols = new Set([...counts].filter(([, n]) => n > 1).map(([s]) => s));
  return { results, total: matched.length, unknownAddress, duplicateSymbols };
}

/** Short form of an original address for display: first 5 … last 4. */
export function shortAddress(a: string): string {
  return a.length <= 11 ? a : `${a.slice(0, 5)}…${a.slice(-4)}`;
}
