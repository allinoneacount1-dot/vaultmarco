import type { AdToken, BoostToken } from "@/components/marco/shared/types";
import { CANONICAL_PAIRS, type RealtimeRow } from "@/lib/providers/dexPairs";
import { assetKey } from "@/lib/assetIdentity";
import type { PairUniverse, RadarStatus } from "@/lib/providers/universe";
import type { SnapshotHistory } from "@/lib/signals/history";
import { type PairIntelligence, pairIntelligence } from "@/lib/signals/intelligence";
import type { PairSnapshot, UniverseSource } from "@/lib/signals/pairSnapshot";

/* ------------------------------------------------------------------ *
 * Identity
 * ------------------------------------------------------------------ */

/** Where the user opened the drawer from. */
export type EntryPoint = "radar" | "boost" | "ad" | "realtime";

/**
 * A reference to one token, built at the entry point from the record the row
 * already renders.
 *
 * `key` is the canonical asset key (lib/assetIdentity) used ONLY for lookup.
 * Every address that is displayed, copied or put in a link comes from
 * `address` — the provider's original value — never from the key.
 */
export type TokenRef = {
  key: string;
  entry: EntryPoint;
  chainId: string;
  /** Provider's original base-token address. */
  address: string;
  symbol: string | null;
  name: string | null;
  /** Provider's own link for this token or pair, if the row carries one. */
  url: string | null;
};

export function refFromSnapshot(s: PairSnapshot): TokenRef {
  return {
    key: s.key,
    entry: "radar",
    chainId: s.chainId,
    address: s.baseAddress,
    symbol: s.baseSymbol,
    name: s.baseName,
    url: s.url,
  };
}

export function refFromBoost(t: BoostToken): TokenRef {
  return {
    key: assetKey(t.chainId, t.tokenAddress),
    entry: "boost",
    chainId: t.chainId,
    address: t.tokenAddress,
    symbol: t.enriched ? t.symbol : null,
    name: t.name || null,
    url: t.url,
  };
}

export function refFromAd(t: AdToken): TokenRef {
  return {
    key: assetKey(t.chainId, t.tokenAddress),
    entry: "ad",
    chainId: t.chainId,
    address: t.tokenAddress,
    symbol: t.enriched ? t.symbol : null,
    name: t.name || null,
    url: t.url,
  };
}

/**
 * DEX Realtime rows are canonical pairs; their identity is the canonical
 * entry's verified base address, which exists even when the row did not
 * resolve this round.
 */
export function refFromRealtime(row: RealtimeRow): TokenRef {
  const canonical = CANONICAL_PAIRS.find((p) => p.key === row.key);
  const chainId = canonical?.chainId ?? row.chainId;
  const address = canonical?.baseAddress ?? row.pair?.baseToken.address ?? row.pairAddress;
  return {
    key: assetKey(chainId, address),
    entry: "realtime",
    chainId,
    address,
    symbol: row.baseSymbol,
    name: row.pair?.baseToken.name ?? null,
    url: row.url,
  };
}

/* ------------------------------------------------------------------ *
 * Drawer model
 * ------------------------------------------------------------------ */

export type SourceDetail = {
  source: UniverseSource;
  /** Extra facts from the feed record that referenced the token, when there is one. */
  detail: string | null;
};

/**
 * What the drawer shows for a reference, in order of preference:
 *
 *   current   the pair is in the current universe; `status` is the radar's
 *             aggregate status, so a stale round is never labelled LIVE.
 *   retained  the pair left the current universe but a real snapshot is
 *             still in history; labelled NOT IN CURRENT UNIVERSE with its
 *             observation time. No current signal is attached.
 *   identity  no retained snapshot: only the verified identity from the
 *             entry point. No market field is synthesized.
 */
export type DrawerModel =
  | {
      kind: "current";
      ref: TokenRef;
      status: RadarStatus;
      intel: PairIntelligence;
      sources: SourceDetail[];
    }
  | {
      kind: "retained";
      ref: TokenRef;
      intel: PairIntelligence;
      sources: SourceDetail[];
    }
  | { kind: "identity"; ref: TokenRef };

function sourceDetails(
  sources: readonly UniverseSource[],
  key: string,
  universe: PairUniverse | undefined,
): SourceDetail[] {
  const boost = universe?.boosts?.data.find((b) => assetKey(b.chainId, b.tokenAddress) === key);
  const ad = universe?.ads?.data.find((a) => assetKey(a.chainId, a.tokenAddress) === key);
  return sources.map((source) => {
    if (source === "boost-latest" && boost) {
      // Boost units as the provider reports them (not USD).
      return { source, detail: `+${boost.boostAmount} · total ${boost.boostTotal}` };
    }
    if (source === "ad" && ad) {
      const at =
        ad.timestamp != null
          ? new Date(ad.timestamp).toISOString().slice(0, 16).replace("T", " ") + " UTC"
          : null;
      return { source, detail: [ad.providerType, at].filter(Boolean).join(" · ") };
    }
    return { source, detail: null };
  });
}

/**
 * Resolve a reference against the current universe and the retained history.
 * Pure: the same inputs always give the same model.
 */
export function resolveDrawerModel(
  ref: TokenRef,
  universe: PairUniverse | undefined,
  status: RadarStatus,
  history: SnapshotHistory,
): DrawerModel {
  const current = universe?.intelligence[ref.key];
  if (current) {
    return {
      kind: "current",
      ref,
      status,
      intel: current,
      sources: sourceDetails(current.snapshot.sources, ref.key, universe),
    };
  }
  const retained = history.get(ref.key);
  if (retained.length > 0) {
    const last = retained[retained.length - 1];
    return {
      kind: "retained",
      ref,
      intel: pairIntelligence(last, retained, null),
      sources: sourceDetails(last.sources, ref.key, undefined),
    };
  }
  return { kind: "identity", ref };
}

/* ------------------------------------------------------------------ *
 * Links — always built from original, provider-supplied values
 * ------------------------------------------------------------------ */

const EXPLORERS: Record<string, string> = {
  solana: "https://solscan.io/token/",
  ethereum: "https://etherscan.io/token/",
  base: "https://basescan.org/token/",
  bsc: "https://bscscan.com/token/",
};

/** Block-explorer page for a token, or null for chains without a known explorer. */
export function explorerUrl(chainId: string, originalAddress: string): string | null {
  const base = EXPLORERS[chainId.toLowerCase()];
  return base ? `${base}${originalAddress}` : null;
}

/**
 * DexScreener page: the provider's own URL when there is one (pair page),
 * otherwise the token page built from the original chain id and address.
 */
export function dexScreenerUrl(ref: TokenRef, snapshot: PairSnapshot | null): string {
  if (snapshot?.url) return snapshot.url;
  if (ref.url && ref.url.startsWith("https://dexscreener.com/")) return ref.url;
  return `https://dexscreener.com/${ref.chainId}/${ref.address}`;
}
