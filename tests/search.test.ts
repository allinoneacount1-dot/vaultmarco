import { describe, expect, it } from "vitest";
import { assetKey } from "@/lib/assetIdentity";
import type { PairUniverse } from "@/lib/providers/universe";
import { SnapshotHistory } from "@/lib/signals/history";
import type { PairSnapshot } from "@/lib/signals/pairSnapshot";
import {
  TIER,
  buildSearchIndex,
  looksLikeFullAddress,
  searchIndex,
  shortAddress,
} from "@/lib/search";
import { resolveRadarStatus } from "@/hooks/usePairUniverse";
import { T0, snapshot } from "./signals/fixtures";

/** Recorded mixed-case Solana address — its case is identity. */
const HONSE = "46vV3ZpFNLZn1CDRYnAvqPsdW5ejEYn9GK9kPcZFpump";
/** Checksummed EVM address as a provider would send it. */
const EVM = "0x4200000000000000000000000000000000000006";
const EVM_MIXED = "0xAbCdEf0123456789aBcDeF0123456789AbCdEf01";

function pair(chainId: string, address: string, over: Partial<PairSnapshot> = {}): PairSnapshot {
  return snapshot({
    key: assetKey(chainId, address),
    chainId,
    baseAddress: address,
    pairAddress: `pair-${address.slice(-6)}`,
    ...over,
  });
}

const honse = pair("solana", HONSE, {
  baseSymbol: "HONSE",
  baseName: "Honse Coin",
  sources: ["boost-latest", "boost-top"],
  liquidityUsd: 250_000,
});
const weth = pair("base", EVM, {
  baseSymbol: "WETH",
  baseName: "Wrapped Ether",
  sources: ["realtime"],
  liquidityUsd: 9_000_000,
});
const mixed = pair("ethereum", EVM_MIXED, {
  baseSymbol: "MIXD",
  baseName: "Mixed Case Token",
  sources: ["ad"],
  liquidityUsd: 60_000,
});
// Two different assets sharing the symbol PEPE.
const pepeSol = pair("solana", "PePe1111111111111111111111111111111111111pump", {
  baseSymbol: "PEPE",
  baseName: "Pepe",
  sources: ["boost-latest"],
  liquidityUsd: 80_000,
});
const pepeEth = pair("ethereum", "0x6982508145454Ce325dDbE47a25d4ec3d2311933", {
  baseSymbol: "PEPE",
  baseName: "Pepe",
  sources: ["ad"],
  liquidityUsd: 5_000_000,
});
const honsePrefix = pair("base", "0x1111111111111111111111111111111111111111", {
  baseSymbol: "HONSEPUP",
  baseName: "Honse Pup",
  sources: ["boost-latest"],
  liquidityUsd: 40_000,
});

function universe(snapshots: PairSnapshot[], extra: Partial<PairUniverse> = {}): PairUniverse {
  return {
    boosts: null,
    ads: null,
    snapshots,
    radar: {
      momentum: [],
      risk: [],
      universeSize: snapshots.length,
      historySince: T0,
      observedAt: T0,
    },
    intelligence: {},
    radarInputs: {} as PairUniverse["radarInputs"],
    observedAt: T0,
    ...extra,
  } as PairUniverse;
}

const ALL = [honse, weth, mixed, pepeSol, pepeEth, honsePrefix];
const index = buildSearchIndex(universe(ALL), new SnapshotHistory(), "live");
const keys = (q: string) => searchIndex(index, q).results.map((r) => r.entry.key);

describe("Global Search — matching", () => {
  it("exact full Solana address → that asset, top tier", () => {
    const { results, unknownAddress } = searchIndex(index, HONSE);
    expect(results[0].entry.key).toBe(honse.key);
    expect(results[0].tier).toBe(TIER.EXACT_ADDRESS);
    expect(unknownAddress).toBeNull();
  });

  it("Solana address is case-sensitive: a case-changed address is NOT that asset", () => {
    const lower = HONSE.toLowerCase();
    const upper = HONSE.toUpperCase();
    for (const q of [lower, upper]) {
      const out = searchIndex(index, q);
      expect(out.results.map((r) => r.entry.key)).not.toContain(honse.key);
      expect(out.unknownAddress).toBe(q);
      expect(out.results).toHaveLength(0);
    }
  });

  it("EVM address matches in any case (canonical hex rule)", () => {
    for (const q of [
      EVM_MIXED,
      EVM_MIXED.toLowerCase(),
      EVM_MIXED.toUpperCase().replace("0X", "0x"),
    ]) {
      const { results } = searchIndex(index, q);
      expect(results[0].entry.key).toBe(mixed.key);
      expect(results[0].tier).toBe(TIER.EXACT_ADDRESS);
    }
  });

  it("result keeps the provider's ORIGINAL address, never one rebuilt from the key", () => {
    const hit = searchIndex(index, EVM_MIXED.toLowerCase()).results[0].entry;
    expect(hit.address).toBe(EVM_MIXED);
    expect(hit.ref.address).toBe(EVM_MIXED);
    expect(hit.key).toBe(`ethereum:${EVM_MIXED.toLowerCase()}`);
    const sol = searchIndex(index, HONSE).results[0].entry;
    expect(sol.ref.address).toBe(HONSE);
    expect(sol.ref.entry).toBe("search");
  });

  it("exact symbol ranks above symbol prefix", () => {
    const { results } = searchIndex(index, "honse");
    expect(results.map((r) => r.entry.key)).toEqual([honse.key, honsePrefix.key]);
    expect(results.map((r) => r.tier)).toEqual([TIER.EXACT_SYMBOL, TIER.SYMBOL_PREFIX]);
    expect(keys("$HONSE")[0]).toBe(honse.key);
  });

  it("symbol prefix", () => {
    const { results } = searchIndex(index, "mix");
    expect(results[0].entry.key).toBe(mixed.key);
    expect(results[0].tier).toBe(TIER.SYMBOL_PREFIX);
  });

  it("name: exact, word prefix and substring, in that order", () => {
    expect(searchIndex(index, "wrapped ether").results[0]?.entry.key).toBe(weth.key);
    const exact = searchIndex(index, "Pepe").results;
    // "pepe" is an exact SYMBOL for both — name only breaks nothing here.
    expect(exact.every((r) => r.tier === TIER.EXACT_SYMBOL)).toBe(true);
    const word = searchIndex(index, "ether").results;
    expect(word[0].entry.key).toBe(weth.key);
    expect(word[0].tier).toBe(TIER.NAME_PREFIX);
    const sub = searchIndex(index, "rapp").results;
    expect(sub.map((r) => r.entry.key)).toEqual([weth.key]);
    expect(sub[0].tier).toBe(TIER.CONTAINS);
  });

  it("exact name outranks name prefix", () => {
    const a = pair("solana", "Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1", {
      baseSymbol: "AAA",
      baseName: "Moon",
      liquidityUsd: 1,
    });
    const b = pair("solana", "Bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb1", {
      baseSymbol: "BBB",
      baseName: "Moon Dog",
      liquidityUsd: 1_000_000,
    });
    const out = searchIndex(
      buildSearchIndex(universe([b, a]), new SnapshotHistory(), "live"),
      "moon",
    );
    expect(out.results.map((r) => [r.entry.key, r.tier])).toEqual([
      [a.key, TIER.EXACT_NAME],
      [b.key, TIER.NAME_PREFIX],
    ]);
  });

  it("short contract form and address fragments", () => {
    expect(keys(shortAddress(HONSE))).toEqual([honse.key]);
    expect(keys("46vV3...pump")).toEqual([honse.key]);
    expect(keys("ZpFNLZn1")).toEqual([honse.key]); // substring
    expect(keys("zpfnlzn1")).toEqual([]); // Base58 fragments are case-sensitive
    expect(keys("abcdef0123")[0]).toBe(mixed.key); // hex fragments are not
    expect(keys("46vV3")).toEqual([]); // too short to be an address fragment
  });

  it("duplicate symbols: both assets listed, flagged, distinguishable by chain + CA", () => {
    const out = searchIndex(index, "pepe");
    expect(out.results.map((r) => r.entry.key)).toEqual([pepeEth.key, pepeSol.key]);
    expect(out.duplicateSymbols.has("pepe")).toBe(true);
    const [a, b] = out.results.map((r) => r.entry);
    expect(a.chainId).not.toBe(b.chainId);
    expect(shortAddress(a.address)).not.toBe(shortAddress(b.address));
  });

  it("chain filter — alone, and narrowing another term", () => {
    expect(keys("solana").sort()).toEqual([honse.key, pepeSol.key].sort());
    expect(keys("sol").sort()).toEqual([honse.key, pepeSol.key].sort());
    expect(keys("base").sort()).toEqual([weth.key, honsePrefix.key].sort());
    expect(keys("ethereum").sort()).toEqual([mixed.key, pepeEth.key].sort());
    // "pepe solana" → only the Solana PEPE, ranked by the symbol term.
    const out = searchIndex(index, "pepe solana");
    expect(out.results.map((r) => r.entry.key)).toEqual([pepeSol.key]);
    expect(out.results[0].tier).toBe(TIER.EXACT_SYMBOL);
  });

  it("source filter: boost / ads / realtime / radar", () => {
    expect(keys("boost").sort()).toEqual([honse.key, pepeSol.key, honsePrefix.key].sort());
    expect(keys("ads").sort()).toEqual([mixed.key, pepeEth.key].sort());
    expect(keys("realtime")).toEqual([weth.key]);
    expect(keys("pepe ads")).toEqual([pepeEth.key]);
    const withSignal = buildSearchIndex(
      universe(ALL, {
        radar: {
          momentum: [{ key: honse.key } as never],
          risk: [],
          universeSize: ALL.length,
          historySince: T0,
          observedAt: T0,
        },
      }),
      new SnapshotHistory(),
      "live",
    );
    expect(searchIndex(withSignal, "radar").results.map((r) => r.entry.key)).toEqual([honse.key]);
    expect(searchIndex(withSignal, "radar").results[0].entry.signal).toBe("EARLY MOMENTUM");
  });

  it("unknown full address → honest empty state, no invented entry", () => {
    const sol = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
    const evm = "0x000000000000000000000000000000000000dEaD";
    for (const q of [sol, evm]) {
      expect(looksLikeFullAddress(q)).toBe(true);
      const out = searchIndex(index, q);
      expect(out.unknownAddress).toBe(q);
      expect(out.results).toEqual([]);
      expect(out.total).toBe(0);
    }
    expect(searchIndex(index, "zzzz").unknownAddress).toBeNull(); // not an address: plain no-match
  });

  it("deterministic: same input → same order, independent of index order", () => {
    const reversed = buildSearchIndex(universe([...ALL].reverse()), new SnapshotHistory(), "live");
    for (const q of ["", "pepe", "boost", "solana", "e"]) {
      const a = searchIndex(index, q).results.map((r) => r.entry.key);
      expect(searchIndex(index, q).results.map((r) => r.entry.key)).toEqual(a);
      expect(searchIndex(reversed, q).results.map((r) => r.entry.key)).toEqual(a);
    }
  });
});

describe("Global Search — index", () => {
  it("dedupes by assetKey; current beats retained beats identity-only", () => {
    const history = new SnapshotHistory();
    const gone = pair("solana", "Gone111111111111111111111111111111111111pump", {
      baseSymbol: "GONE",
      observedAt: T0 - 60_000,
    });
    history.record([gone, { ...honse, observedAt: T0 - 60_000, liquidityUsd: 1 }]);
    const boost = {
      id: "b1",
      chainId: "solana",
      tokenAddress: HONSE,
      symbol: "HONSE",
      name: "Honse Coin",
      enriched: true,
      url: "https://dexscreener.com/solana/x",
    };
    const idOnly = {
      ...boost,
      id: "b2",
      tokenAddress: "IdOnly1111111111111111111111111111111111pump",
      symbol: "IdOnl…pump",
      enriched: false,
      name: "",
    };
    const idx = buildSearchIndex(
      universe([honse], { boosts: { data: [boost, idOnly] } as never }),
      history,
      "live",
    );
    const byKey = new Map(idx.map((e) => [e.key, e]));
    expect(idx).toHaveLength(3);
    expect(byKey.get(honse.key)?.state).toBe("current");
    expect(byKey.get(honse.key)?.snapshot?.liquidityUsd).toBe(250_000); // current, not retained
    expect(byKey.get(gone.key)?.state).toBe("retained");
    const identity = byKey.get(assetKey("solana", idOnly.tokenAddress));
    expect(identity?.state).toBe("identity");
    expect(identity?.symbol).toBeNull(); // unenriched: no fabricated ticker
    expect(identity?.snapshot).toBeNull();
    expect(identity?.address).toBe(idOnly.tokenAddress);
  });

  it("empty universe and empty history → empty index, no results", () => {
    const idx = buildSearchIndex(undefined, new SnapshotHistory(), "offline");
    expect(idx).toEqual([]);
    expect(searchIndex(idx, "").results).toEqual([]);
  });
});

describe("Global Search — temporal truth (same rule as radar + drawer)", () => {
  const signalled = (status: PairUniverse["radarInputs"]["status"]) =>
    universe(ALL, {
      radar: {
        momentum: [{ key: honse.key } as never],
        risk: [],
        universeSize: ALL.length,
        historySince: T0,
        observedAt: T0,
      },
      radarInputs: { status } as PairUniverse["radarInputs"],
    });
  const entry = (idx: ReturnType<typeof buildSearchIndex>, key: string) =>
    idx.find((e) => e.key === key)!;

  it("LIVE → current, fresh signal", () => {
    const idx = buildSearchIndex(signalled("live"), new SnapshotHistory(), "live");
    const e = entry(idx, honse.key);
    expect([e.state, e.round, e.signal, e.lastSignal]).toEqual([
      "current",
      "live",
      "EARLY MOMENTUM",
      null,
    ]);
  });

  it("DEGRADED → still the current round, labelled degraded", () => {
    const idx = buildSearchIndex(signalled("degraded"), new SnapshotHistory(), "degraded");
    const e = entry(idx, honse.key);
    expect([e.state, e.round, e.signal]).toEqual(["current", "degraded", "EARLY MOMENTUM"]);
  });

  it("STALE → last real data stays searchable, non-current; carried signal is NOT a current signal", () => {
    const idx = buildSearchIndex(signalled("stale"), new SnapshotHistory(), "stale");
    const e = entry(idx, honse.key);
    expect(e.state).toBe("stale");
    expect(e.round).toBeNull();
    expect(e.signal).toBeNull(); // not presented as fired this round
    expect(e.lastSignal).toBe("EARLY MOMENTUM"); // kept, relabelled as history
    expect(e.snapshot?.liquidityUsd).toBe(250_000); // last real data kept
    expect(searchIndex(idx, "honse").results[0].entry.key).toBe(honse.key);
    // "radar" finds only signals of the current round.
    expect(searchIndex(idx, "radar").results).toEqual([]);
  });

  it("OFFLINE / LOADING → nothing is current; history is retained, never current", () => {
    const history = new SnapshotHistory();
    history.record([honse]);
    for (const status of ["offline", "loading"] as const) {
      const idx = buildSearchIndex(signalled("live"), history, status);
      expect(idx.some((e) => e.state === "current" || e.state === "stale")).toBe(false);
      expect(entry(idx, honse.key).state).toBe("retained");
      expect(entry(idx, honse.key).signal).toBeNull();
    }
  });

  it("stale entries rank below current ones, above retained", () => {
    const history = new SnapshotHistory();
    const gone = pair("solana", "Honz111111111111111111111111111111111111pump", {
      baseSymbol: "HONSE",
      observedAt: T0 - 60_000,
    });
    history.record([gone]);
    const idx = buildSearchIndex(universe([honse]), history, "stale");
    expect(searchIndex(idx, "honse").results.map((r) => r.entry.state)).toEqual([
      "stale",
      "retained",
    ]);
  });
});

describe("resolveRadarStatus — one rule for radar, drawer and search", () => {
  const data = (status: PairUniverse["radarInputs"]["status"], n = 1) =>
    universe(ALL.slice(0, n), { radarInputs: { status } as PairUniverse["radarInputs"] });
  const q = (over: Partial<Parameters<typeof resolveRadarStatus>[0]>) =>
    resolveRadarStatus({
      data: undefined,
      isPending: false,
      isError: false,
      fetchStatus: "idle",
      failureCount: 0,
      ...over,
    });

  it("round status passes through when the query is healthy", () => {
    for (const s of ["live", "degraded", "stale", "offline"] as const)
      expect(q({ data: data(s) })).toBe(s);
  });
  it("whole round failing keeps previous data as STALE, or OFFLINE if it had none", () => {
    expect(q({ data: data("live"), isError: true })).toBe("stale");
    expect(q({ data: data("live", 0), isError: true })).toBe("offline");
    expect(q({ data: data("live"), fetchStatus: "paused", failureCount: 1 })).toBe("stale");
  });
  it("loading before any data; offline with no data", () => {
    expect(q({ isPending: true })).toBe("loading");
    expect(q({})).toBe("offline");
  });
});
