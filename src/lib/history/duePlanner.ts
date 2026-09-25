import { ENDPOINT_CAP_PER_ROUND, MAX_ADDRESSES_PER_REQUEST } from "./constants";
import { acceptSample, expireIfElapsed, isDue } from "./outcomes";
import type { OutcomeObservation, SignalEvent } from "./model";
import { canonicalAddressForKey, sameAddress } from "@/lib/assetIdentity";
import type { DexPair } from "@/lib/providers/schemas";
import type { PairSnapshot } from "@/lib/signals/pairSnapshot";
import { toPairSnapshot } from "@/lib/signals/pairSnapshot";

/**
 * DUE OUTCOME PLANNER (pure — no network). It tells the runtime adapter what
 * to fetch; the adapter fetches; the resolvers below turn real responses into
 * observations. Outcome capture never depends on the token still being in the
 * discovery universe.
 *
 * Order of preference for a due outcome:
 *   1. the event's exact pair is in THIS round's snapshots  → reuse (no request)
 *   2. otherwise: multi-token batch  /tokens/v1/{chain}/{≤30 token addresses}
 *      and select the EXACT captured pairAddress from the returned pairs
 *   3. pair not in that response: /latest/dex/pairs/{chain}/{≤30 pair addresses}
 *   4. still not observed when the window closes → UNAVAILABLE
 * A different pool of the same token is never substituted.
 */

export type DueWant = { eventId: string; horizonMinutes: number; pairAddress: string };

export type TokenBatch = { chainId: string; tokenAddresses: string[]; wants: DueWant[] };
export type PairBatch = { chainId: string; pairAddresses: string[]; wants: DueWant[] };

export type DuePlan = {
  /** Resolved from this round's own snapshots — no request needed. */
  fromRound: OutcomeObservation[];
  tokenBatches: TokenBatch[];
  /** Due outcomes beyond this round's batch cap; retried next round while the window lasts. */
  deferred: DueWant[];
  /** Window elapsed without an accepted sample. */
  expired: OutcomeObservation[];
  /** Target not reached yet. */
  notYetDue: number;
};

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function planDue(args: {
  now: number;
  pending: readonly OutcomeObservation[];
  events: ReadonlyMap<string, SignalEvent>;
  /** This round's snapshots; pass [] when the round is not usable. */
  roundSnapshots: readonly PairSnapshot[];
  roundKey: string | null;
  maxTokenBatches?: number;
}): DuePlan {
  const { now, events } = args;
  const plan: DuePlan = {
    fromRound: [],
    tokenBatches: [],
    deferred: [],
    expired: [],
    notYetDue: 0,
  };
  const byPair = new Map<string, PairSnapshot>();
  for (const s of args.roundSnapshots) {
    if (s.pairAddress) byPair.set(`${s.chainId}|${canonicalAddressForKey(s.pairAddress)}`, s);
  }

  // Deterministic order: by target time, then event id, then horizon.
  const pending = [...args.pending].sort(
    (a, b) =>
      a.targetAt - b.targetAt || cmp(a.eventId, b.eventId) || a.horizonMinutes - b.horizonMinutes,
  );

  const needByChain = new Map<string, Map<string, DueWant[]>>(); // chain → token address → wants
  for (const o of pending) {
    const expired = expireIfElapsed(o, now);
    if (expired) {
      plan.expired.push(expired);
      continue;
    }
    if (!isDue(o, now)) {
      plan.notYetDue++;
      continue;
    }
    const ev = events.get(o.eventId);
    if (!ev) continue;
    const own = byPair.get(`${ev.chainId}|${canonicalAddressForKey(ev.pairAddress)}`);
    const reused = own ? acceptSample(o, ev, own, "ROUND", args.roundKey) : null;
    if (reused) {
      plan.fromRound.push(reused);
      continue;
    }
    const tokens = needByChain.get(ev.chainId) ?? new Map<string, DueWant[]>();
    // Dedupe token addresses by identity (EVM case-folded, Base58 exact).
    const tokenKey = canonicalAddressForKey(ev.address);
    const existing = [...tokens.keys()].find((t) => canonicalAddressForKey(t) === tokenKey);
    const want: DueWant = {
      eventId: o.eventId,
      horizonMinutes: o.horizonMinutes,
      pairAddress: ev.pairAddress,
    };
    if (existing) tokens.get(existing)!.push(want);
    else tokens.set(ev.address, [want]);
    needByChain.set(ev.chainId, tokens);
  }

  const cap = args.maxTokenBatches ?? ENDPOINT_CAP_PER_ROUND.DUE_TOKEN_BATCH;
  for (const chainId of [...needByChain.keys()].sort(cmp)) {
    const tokens = needByChain.get(chainId)!;
    const addresses = [...tokens.keys()].sort(cmp);
    for (let i = 0; i < addresses.length; i += MAX_ADDRESSES_PER_REQUEST) {
      const slice = addresses.slice(i, i + MAX_ADDRESSES_PER_REQUEST);
      const wants = slice.flatMap((a) => tokens.get(a)!);
      if (plan.tokenBatches.length < cap)
        plan.tokenBatches.push({ chainId, tokenAddresses: slice, wants });
      else plan.deferred.push(...wants);
    }
  }
  return plan;
}

export type BatchResolution = {
  observed: OutcomeObservation[];
  /** Wants whose exact pair was not in the response → pair-address fallback. */
  missing: DueWant[];
};

/** Match returned pairs to wants by EXACT chain + pairAddress. */
export function resolveWithPairs(
  wants: readonly DueWant[],
  chainId: string,
  pairs: readonly DexPair[],
  observedAt: number,
  pending: ReadonlyMap<string, OutcomeObservation>,
  events: ReadonlyMap<string, SignalEvent>,
  source: "DUE_TOKEN_BATCH" | "PAIR_FALLBACK",
): BatchResolution {
  const out: BatchResolution = { observed: [], missing: [] };
  for (const w of wants) {
    const pair = pairs.find(
      (p) => p.chainId === chainId && !!p.pairAddress && sameAddress(p.pairAddress, w.pairAddress),
    );
    const o = pending.get(outcomeKey(w.eventId, w.horizonMinutes));
    const ev = events.get(w.eventId);
    if (!o || !ev) continue;
    if (!pair) {
      out.missing.push(w);
      continue;
    }
    const snap = toPairSnapshot(pair, observedAt, []);
    const accepted = acceptSample(o, ev, snap, source, null);
    if (accepted) out.observed.push(accepted);
    else out.missing.push(w);
  }
  return out;
}

/** Group fallback wants into ≤30-pair requests per chain, deterministically. */
export function planPairFallback(
  missing: readonly DueWant[],
  chainOf: (eventId: string) => string | undefined,
  maxBatches = ENDPOINT_CAP_PER_ROUND.PAIR_FALLBACK,
): { batches: PairBatch[]; deferred: DueWant[] } {
  const byChain = new Map<string, Map<string, DueWant[]>>();
  for (const w of missing) {
    const chainId = chainOf(w.eventId);
    if (!chainId) continue;
    const pairs = byChain.get(chainId) ?? new Map<string, DueWant[]>();
    const k = canonicalAddressForKey(w.pairAddress);
    const found = [...pairs.keys()].find((p) => canonicalAddressForKey(p) === k);
    if (found) pairs.get(found)!.push(w);
    else pairs.set(w.pairAddress, [w]);
    byChain.set(chainId, pairs);
  }
  const batches: PairBatch[] = [];
  const deferred: DueWant[] = [];
  for (const chainId of [...byChain.keys()].sort(cmp)) {
    const pairs = byChain.get(chainId)!;
    const addrs = [...pairs.keys()].sort(cmp);
    for (let i = 0; i < addrs.length; i += MAX_ADDRESSES_PER_REQUEST) {
      const slice = addrs.slice(i, i + MAX_ADDRESSES_PER_REQUEST);
      const wants = slice.flatMap((a) => pairs.get(a)!);
      if (batches.length < maxBatches) batches.push({ chainId, pairAddresses: slice, wants });
      else deferred.push(...wants);
    }
  }
  return { batches, deferred };
}

export const outcomeKey = (eventId: string, horizon: number) => `${eventId}|${horizon}`;
