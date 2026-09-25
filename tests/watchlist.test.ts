import { describe, expect, it, vi } from "vitest";
import { assetKey } from "@/lib/assetIdentity";
import type { PairUniverse, RadarStatus } from "@/lib/providers/universe";
import { SnapshotHistory } from "@/lib/signals/history";
import { pairIntelligence } from "@/lib/signals/intelligence";
import type { PairSnapshot } from "@/lib/signals/pairSnapshot";
import {
  WATCHLIST_MAX_ITEMS,
  WATCHLIST_STORAGE_KEY,
  createLocalWatchlistRepository,
  parseStoredWatchlist,
  resolveWatchRow,
} from "@/lib/watchlist";
import { T0, snapshot } from "./signals/fixtures";

const HONSE = "46vV3ZpFNLZn1CDRYnAvqPsdW5ejEYn9GK9kPcZFpump";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

function memoryStorage(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

function eventBus() {
  const target = new EventTarget();
  return {
    addEventListener: target.addEventListener.bind(target) as Window["addEventListener"],
    removeEventListener: target.removeEventListener.bind(target) as Window["removeEventListener"],
    fire: (key: string) => {
      const e = new Event("storage") as Event & { key: string };
      Object.defineProperty(e, "key", { value: key });
      target.dispatchEvent(e);
    },
  };
}

const stored = (s: ReturnType<typeof memoryStorage>) =>
  JSON.parse(s.data.get(WATCHLIST_STORAGE_KEY)!) as { version: number; items: unknown[] };

describe("local watchlist repository", () => {
  it("stores ONLY identity — key, original chain, original address, date added", () => {
    const s = memoryStorage();
    const repo = createLocalWatchlistRepository(s, undefined, () => T0);
    repo.add({ chainId: "solana", address: HONSE });
    expect(stored(s)).toEqual({
      version: 1,
      items: [{ key: `solana:${HONSE}`, chainId: "solana", address: HONSE, addedAt: T0 }],
    });
    // No market field can be persisted: the item type has none.
    expect(JSON.stringify(stored(s))).not.toMatch(/price|liquidity|volume|signal|symbol/i);
  });

  it("add is idempotent by canonical key; remove; newest first", () => {
    let t = T0;
    const repo = createLocalWatchlistRepository(memoryStorage(), undefined, () => (t += 1000));
    repo.add({ chainId: "solana", address: HONSE });
    repo.add({ chainId: "ethereum", address: WETH });
    repo.add({ chainId: "solana", address: HONSE });
    expect(repo.list().map((i) => i.key)).toEqual([assetKey("ethereum", WETH), `solana:${HONSE}`]);
    repo.remove(`solana:${HONSE}`);
    expect(repo.list().map((i) => i.key)).toEqual([assetKey("ethereum", WETH)]);
  });

  it("identity: Solana case is exact (two assets); EVM case folds (one asset, original kept)", () => {
    const repo = createLocalWatchlistRepository(memoryStorage());
    repo.add({ chainId: "solana", address: HONSE });
    repo.add({ chainId: "solana", address: HONSE.toLowerCase() });
    expect(repo.list()).toHaveLength(2);

    const evm = createLocalWatchlistRepository(memoryStorage());
    evm.add({ chainId: "ethereum", address: WETH });
    evm.add({ chainId: "ethereum", address: WETH.toLowerCase() });
    expect(evm.list()).toHaveLength(1);
    expect(evm.list()[0].address).toBe(WETH); // provider original, not the key form
    expect(evm.list()[0].key).toBe(`ethereum:${WETH.toLowerCase()}`);
  });

  it("survives a reload (new repository over the same storage)", () => {
    const s = memoryStorage();
    createLocalWatchlistRepository(s).add({ chainId: "solana", address: HONSE });
    const reloaded = createLocalWatchlistRepository(s);
    expect(reloaded.list().map((i) => i.address)).toEqual([HONSE]);
    expect(reloaded.persistence()).toBe("local");
  });

  it("list() keeps its reference until the list changes (safe for useSyncExternalStore)", () => {
    const repo = createLocalWatchlistRepository(memoryStorage());
    const a = repo.list();
    expect(repo.list()).toBe(a);
    repo.add({ chainId: "solana", address: HONSE });
    expect(repo.list()).not.toBe(a);
  });

  it("notifies subscribers; another tab's change arrives through the storage event", () => {
    const s = memoryStorage();
    const bus = eventBus();
    const repo = createLocalWatchlistRepository(s, bus);
    const listener = vi.fn();
    const off = repo.subscribe(listener);
    repo.add({ chainId: "solana", address: HONSE });
    expect(listener).toHaveBeenCalledTimes(1);

    // Another tab writes the same key.
    createLocalWatchlistRepository(s).remove(`solana:${HONSE}`);
    bus.fire(WATCHLIST_STORAGE_KEY);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(repo.list()).toEqual([]);
    bus.fire("some-other-key");
    expect(listener).toHaveBeenCalledTimes(2);
    off();
  });

  it(`is capped at ${WATCHLIST_MAX_ITEMS}; add reports a full list`, () => {
    const repo = createLocalWatchlistRepository(memoryStorage());
    for (let i = 0; i < WATCHLIST_MAX_ITEMS; i++) {
      expect(repo.add({ chainId: "base", address: `0x${i.toString(16).padStart(40, "0")}` })).toBe(
        true,
      );
    }
    expect(repo.add({ chainId: "solana", address: HONSE })).toBe(false);
    expect(repo.list()).toHaveLength(WATCHLIST_MAX_ITEMS);
  });

  it("storage that throws → memory mode, the list still works", () => {
    const repo = createLocalWatchlistRepository({
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    repo.add({ chainId: "solana", address: HONSE });
    expect(repo.list()).toHaveLength(1);
    expect(repo.persistence()).toBe("memory");
    expect(createLocalWatchlistRepository(null).persistence()).toBe("memory");
  });
});

describe("stored payload parsing (versioned)", () => {
  it("corrupt JSON or wrong shape → empty and writable", () => {
    expect(parseStoredWatchlist("{not json")).toEqual({ items: [], writable: true });
    expect(parseStoredWatchlist(JSON.stringify({ items: 3 }))).toEqual({
      items: [],
      writable: true,
    });
  });

  it("a payload from a NEWER version is never overwritten", () => {
    const newer = JSON.stringify({ version: 2, items: [{ anything: true }] });
    expect(parseStoredWatchlist(newer)).toEqual({ items: [], writable: false });
    const s = memoryStorage({ [WATCHLIST_STORAGE_KEY]: newer });
    const repo = createLocalWatchlistRepository(s);
    expect(repo.persistence()).toBe("memory");
    repo.add({ chainId: "solana", address: HONSE });
    expect(s.data.get(WATCHLIST_STORAGE_KEY)).toBe(newer);
  });

  it("drops invalid entries, re-derives every key with assetKey, dedupes", () => {
    const raw = JSON.stringify({
      version: 1,
      items: [
        { key: "tampered", chainId: "Ethereum", address: WETH, addedAt: 2 },
        { key: "x", chainId: "ethereum", address: WETH.toLowerCase(), addedAt: 1 },
        { chainId: "solana", address: HONSE }, // no key / addedAt
        { key: "k", chainId: "", address: "a", addedAt: 3 },
        "junk",
      ],
    });
    const { items } = parseStoredWatchlist(raw);
    expect(items).toEqual([
      { key: `ethereum:${WETH.toLowerCase()}`, chainId: "Ethereum", address: WETH, addedAt: 2 },
    ]);
  });
});

/* ------------------------------------------------------------------ */

const honse = snapshot({
  key: `solana:${HONSE}`,
  chainId: "solana",
  baseAddress: HONSE,
  baseSymbol: "honse",
  baseName: "honse",
  priceUsd: 0.00005702,
  liquidityUsd: 25_500,
  priceChange: { m5: 1.2, h1: -3.4, h6: null, h24: 44.5 },
  url: "https://dexscreener.com/solana/honsepair",
});

function universeWith(
  snaps: PairSnapshot[],
  status: RadarStatus,
  opts: { momentumKey?: string; boosts?: unknown[] } = {},
): PairUniverse {
  const radar = {
    momentum: opts.momentumKey ? [{ key: opts.momentumKey } as never] : [],
    risk: [],
    universeSize: snaps.length,
    historySince: T0,
    observedAt: T0,
  };
  return {
    boosts: opts.boosts ? ({ data: opts.boosts } as never) : null,
    ads: null,
    snapshots: snaps,
    radar,
    intelligence: Object.fromEntries(snaps.map((s) => [s.key, pairIntelligence(s, [s], radar)])),
    radarInputs: { status } as PairUniverse["radarInputs"],
    observedAt: T0,
  } as PairUniverse;
}

const item = (address = HONSE, chainId = "solana") => ({
  key: assetKey(chainId, address),
  chainId,
  address,
  addedAt: T0 - 1,
});

describe("resolveWatchRow — live state from real data only", () => {
  it("LIVE: market fields come from the current observation, with the current signal", () => {
    const u = universeWith([honse], "live", { momentumKey: honse.key });
    const r = resolveWatchRow(item(), u, "live", new SnapshotHistory());
    expect(r).toMatchObject({
      state: "LIVE",
      symbol: "honse",
      priceUsd: 0.00005702,
      changeM5: 1.2,
      changeH1: -3.4,
      liquidityUsd: 25_500,
      signal: "EARLY MOMENTUM",
      lastSignal: null,
    });
    expect(r.ref).toMatchObject({ key: honse.key, entry: "watchlist", address: HONSE });
  });

  it("DEGRADED: still current, honestly labelled", () => {
    const u = universeWith([honse], "degraded", { momentumKey: honse.key });
    const r = resolveWatchRow(item(), u, "degraded", new SnapshotHistory());
    expect([r.state, r.signal]).toEqual(["DEGRADED", "EARLY MOMENTUM"]);
  });

  it("STALE: last real data kept, signal only as LAST SIGNAL", () => {
    const u = universeWith([honse], "live", { momentumKey: honse.key });
    const r = resolveWatchRow(item(), u, "stale", new SnapshotHistory());
    expect(r.state).toBe("STALE");
    expect(r.signal).toBeNull();
    expect(r.lastSignal).toBe("EARLY MOMENTUM");
    expect(r.priceUsd).toBe(0.00005702);
  });

  it("left the universe → RETAINED from history (no current signal)", () => {
    const h = new SnapshotHistory();
    h.record([honse]);
    const r = resolveWatchRow(item(), universeWith([], "live"), "live", h);
    expect(r.state).toBe("RETAINED");
    expect(r.signal).toBeNull();
    expect(r.observedAt).toBe(honse.observedAt);
  });

  it("OFFLINE / loading → nothing current; history only", () => {
    const h = new SnapshotHistory();
    h.record([honse]);
    const u = universeWith([honse], "live", { momentumKey: honse.key });
    for (const status of ["offline", "loading"] as const) {
      const r = resolveWatchRow(item(), u, status, h);
      expect(r.state).toBe("RETAINED");
      expect(r.signal).toBeNull();
    }
  });

  it("never observed → IDENTITY ONLY: no market field, no invented symbol", () => {
    const r = resolveWatchRow(
      item(WETH, "ethereum"),
      universeWith([honse], "live"),
      "live",
      new SnapshotHistory(),
    );
    expect(r).toMatchObject({
      state: "IDENTITY ONLY",
      symbol: null,
      priceUsd: null,
      changeM5: null,
      liquidityUsd: null,
      signal: null,
    });
    expect(r.ref.address).toBe(WETH);
  });

  it("identity only, but the boost feed knows the token → its enriched symbol is used", () => {
    const boost = {
      id: "b",
      chainId: "robinhood",
      tokenAddress: "0xbB7F043A2239a1a3cc507a38fFbB54ec1d1d1e18",
      symbol: "RBN",
      name: "Robin",
      enriched: true,
      url: "https://dexscreener.com/robinhood/x",
    };
    const it_ = item(boost.tokenAddress, "robinhood");
    const r = resolveWatchRow(
      it_,
      universeWith([], "live", { boosts: [boost] }),
      "live",
      new SnapshotHistory(),
    );
    expect([r.state, r.symbol, r.priceUsd]).toEqual(["IDENTITY ONLY", "RBN", null]);
    const unenriched = resolveWatchRow(
      it_,
      universeWith([], "live", { boosts: [{ ...boost, enriched: false, symbol: "0xbB7…1e18" }] }),
      "live",
      new SnapshotHistory(),
    );
    expect(unenriched.symbol).toBeNull(); // a truncated address is not a ticker
  });
});
