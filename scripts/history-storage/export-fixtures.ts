/**
 * LOCAL BENCHMARK ONLY. Produces the payloads the storage replay writes, using
 * the REAL engine and the REAL recorder helpers over the recorded DexScreener
 * fixtures in tests/fixtures. Nothing here reaches production.
 *
 *   npx vite-node scripts/history-storage/export-fixtures.ts <outDir>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compactSnapshot } from "../../src/lib/history/compact";
import { fetchRealtimePairs } from "../../src/lib/providers/dexPairs";
import { fetchPairUniverse } from "../../src/lib/providers/universe";
import { SnapshotHistory } from "../../src/lib/signals/history";

const out = process.argv[2] ?? "/tmp/history-storage";
mkdirSync(out, { recursive: true });
const fx = (n: string) => JSON.parse(readFileSync(join("tests/fixtures", n), "utf8"));
const PAIRS = fx("dexscreener.pairs.canonical.json");
const TOKENS = fx("dexscreener.tokens.solana.json");

async function round(t: number, tokens: unknown[], history: SnapshotHistory) {
  const deps = {
    now: () => t,
    fetchJson: async (_s: string, url: string) => {
      if (url.includes("/token-boosts/")) return fx("dexscreener.boosts.latest.json");
      if (url.includes("/ads/")) return fx("dexscreener.ads.latest.json");
      if (url.includes("/tokens/v1/")) return url.includes("/solana/") ? tokens : [];
      return PAIRS[url.split("/latest/dex/pairs/")[1].split("/")[0]] ?? { pairs: [] };
    },
  };
  const rt = await fetchRealtimePairs(deps);
  return fetchPairUniverse(undefined, history, { ok: true, rows: rt.data, observedAt: t }, deps);
}

const T0 = Date.parse("2026-09-26T00:00:00Z");
const history = new SnapshotHistory();
// Round 1: buyer-dominant m5 on the recorded honse pool → the engine fires EARLY MOMENTUM.
const signal = structuredClone(TOKENS);
signal[0].txns.m5 = { buys: 30, sells: 10 };
const u1 = await round(T0, signal, history);
// Round 2 (+6 min): the recorded pool drains → the engine fires LIQUIDITY_REMOVED.
const drained = structuredClone(TOKENS);
drained[0].liquidity.usd = 12_000;
const u2 = await round(T0 + 6 * 60_000, drained, history);

const momentum = u1.radar.momentum[0];
const liquidity = u2.radar.risk[0];
if (!momentum || !liquidity) throw new Error("engine did not produce the expected signals");

// Production cardinality: ~40 pairs per round. The recorded snapshots are
// re-keyed (TEST-ONLY) to reach it; values are the recorded ones.
const snaps = u1.snapshots;
const scaled = Array.from({ length: 42 }, (_, i) => {
  const s = structuredClone(snaps[i % snaps.length]);
  s.key = `${s.key}#${i}`;
  return s;
});

writeFileSync(join(out, "engine_round.json"), JSON.stringify(scaled));
writeFileSync(
  join(out, "momentum_evidence.json"),
  JSON.stringify({ type: "EARLY_MOMENTUM", rule: momentum }),
);
writeFileSync(
  join(out, "liquidity_evidence.json"),
  JSON.stringify({ type: "LIQUIDITY_REMOVED", rule: liquidity }),
);
const honse = u1.snapshots.find((s) => s.key === momentum.key)!;
writeFileSync(join(out, "compact_snapshot.json"), JSON.stringify(compactSnapshot(honse)));

const bytes = (f: string) => readFileSync(join(out, f)).length;
console.log(
  JSON.stringify({
    out,
    pairsPerRound: scaled.length,
    engineRoundJsonBytes: bytes("engine_round.json"),
    momentumEvidenceBytes: bytes("momentum_evidence.json"),
    liquidityEvidenceBytes: bytes("liquidity_evidence.json"),
    compactSnapshotBytes: bytes("compact_snapshot.json"),
  }),
);
