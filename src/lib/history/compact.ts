import type { PairSnapshot } from "@/lib/signals/pairSnapshot";
import type { CompactSnapshot } from "./model";

/**
 * Selected real fields of one PairSnapshot. Every value is copied from the
 * provider-derived snapshot unchanged; nothing is computed, rounded or filled.
 * Identity (chain, base address, asset key) lives on the event itself.
 */
export function compactSnapshot(s: PairSnapshot): CompactSnapshot {
  return {
    observedAt: s.observedAt,
    pairAddress: s.pairAddress,
    dexId: s.dexId,
    priceUsd: s.priceUsd,
    liquidityUsd: s.liquidityUsd,
    fdv: s.fdv,
    marketCap: s.marketCap,
    volumeM5: s.volume.m5,
    volumeH1: s.volume.h1,
    volumeH24: s.volume.h24,
    txnsM5: s.txns.m5,
    txnsH1: s.txns.h1,
    priceChangeM5: s.priceChange.m5,
    priceChangeH1: s.priceChange.h1,
    pairCreatedAt: s.pairCreatedAt,
    boostsActive: s.boostsActive,
  };
}
