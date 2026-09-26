import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MemoryRecorderStore } from "@/lib/history/memoryStore";
import { runRound, type RecorderDeps } from "@/lib/history/recorder";
import type { RawHttp, RawResponse } from "@/lib/history/requests";

/**
 * Fixture-backed HTTP for recorder tests. Every payload is a RECORDED
 * DexScreener response from tests/fixtures; scenarios only select or edit
 * fields of those recordings to create the situation under test (a signal
 * firing, a pool draining, a token leaving the feeds, a provider failure).
 * No test touches the network.
 */

const fx = (n: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/${n}`, import.meta.url)), "utf8"));

const BOOSTS = fx("dexscreener.boosts.latest.json") as Array<{ tokenAddress: string }>;
const ADS = fx("dexscreener.ads.latest.json");
const PAIRS = fx("dexscreener.pairs.canonical.json") as Record<string, unknown>;
type TokenRow = {
  baseToken: { address: string };
  pairAddress: string;
  txns: { m5: { buys: number; sells: number } };
  liquidity: { usd: number };
};
const TOKENS = fx("dexscreener.tokens.solana.json") as TokenRow[];

export const HONSE = "46vV3ZpFNLZn1CDRYnAvqPsdW5ejEYn9GK9kPcZFpump";
export const HONSE_PAIR = "2pa3zgySbWDSeMmpp62VVfxtjWchpEg5yUmTVXK2wKv9";
export const HONSE_KEY = `solana:${HONSE}`;
export const HERBA = "4nLMnQ6pfXZxarab6F8h1ETUDceSzUcLEjWhqHLCpump";

/** 2026-09-26T00:00:00Z — after every fixture pair was created. */
export const T0 = Date.parse("2026-09-26T00:00:00Z");
export const MIN = 60_000;

export type Scenario = {
  /** signal: buyer-dominant m5 so EARLY MOMENTUM fires · negative: fully evaluable, does not fire (fixture as recorded) · lowsample: m5 too thin to evaluate */
  honse?: "signal" | "negative" | "lowsample";
  /** Replace honse liquidity (USD) — e.g. to make a pool drain. */
  honseLiquidity?: number;
  /** honse no longer boosted → leaves the discovery universe. */
  honseGone?: boolean;
  /** Due token batch returns honse's token but WITHOUT the captured pair. */
  tokenBatchOmitsPair?: boolean;
  /** Pair-address fallback also returns nothing. */
  fallbackEmpty?: boolean;
  /** Per-URL override: a response, or "throw" for a network error. */
  override?: (url: string) => RawResponse | "throw" | null;
};

function honseRow(s: Scenario) {
  const row = structuredClone(TOKENS[0]);
  if (s.honse === "signal") row.txns.m5 = { buys: 30, sells: 10 };
  if (s.honse === "lowsample") row.txns.m5 = { buys: 2, sells: 1 };
  if (s.honseLiquidity != null) row.liquidity.usd = s.honseLiquidity;
  return row;
}

export function fixtureHttp(scenario: () => Scenario, log: string[] = []): RawHttp {
  return async (url) => {
    log.push(url);
    const s = scenario();
    const o = s.override?.(url);
    if (o === "throw") throw new Error("socket hang up");
    if (o) return o;
    const ok = (body: unknown): RawResponse => ({ status: 200, retryAfter: null, body });
    if (url.includes("/token-boosts/")) {
      return ok(s.honseGone ? BOOSTS.filter((b) => b.tokenAddress !== HONSE) : BOOSTS);
    }
    if (url.includes("/ads/")) return ok(ADS);
    if (url.includes("/tokens/v1/")) {
      if (!url.includes("/solana/")) return ok([]);
      const rows = [honseRow(s), structuredClone(TOKENS[1])];
      const asked = decodeURIComponent(url.split("/tokens/v1/solana/")[1]).split(",");
      let out = rows.filter((r) => asked.includes(r.baseToken.address));
      if (s.tokenBatchOmitsPair) out = out.filter((r) => r.pairAddress !== HONSE_PAIR);
      return ok(out);
    }
    if (url.includes("/latest/dex/pairs/")) {
      const [chain, addrs] = url.split("/latest/dex/pairs/")[1].split("/");
      if (decodeURIComponent(addrs).split(",").includes(HONSE_PAIR)) {
        return ok({ pairs: s.fallbackEmpty ? [] : [honseRow(s)] });
      }
      return ok(PAIRS[chain] ?? { pairs: [] });
    }
    return { status: 404, retryAfter: null, body: null };
  };
}

/** A controllable clock. */
export function clock(start = T0) {
  let t = start;
  return {
    now: () => t,
    set: (ms: number) => {
      t = ms;
    },
    advance: (ms: number) => {
      t += ms;
    },
  };
}

export const noSleep = async () => {};

/** Recorder harness: in-memory store, fixture HTTP, controllable clock. */
export function harness(initial: Scenario = {}) {
  const store = new MemoryRecorderStore();
  const c = clock();
  let scenario: Scenario = initial;
  const log: string[] = [];
  let n = 0;
  const deps = (): RecorderDeps => ({
    store,
    http: fixtureHttp(() => scenario, log),
    now: c.now,
    owner: `w${++n}`,
    sleep: noSleep,
  });
  /** Run the round scheduled at minute m; the sample is taken `lagMs` into the minute (default 2 s). */
  const at = async (m: number, lagMs = 2_000) => {
    c.set(T0 + m * MIN + lagMs);
    return runRound(T0 + m * MIN, deps());
  };
  return { store, clock: c, log, deps, at, set: (s: Scenario) => (scenario = s) };
}
