import { describe, expect, it } from "vitest";
import { assetKey } from "@/lib/assetIdentity";
import {
  SessionStore,
  createSessionState,
  ingest,
  observationCount,
  retainedSince,
} from "@/lib/intelligence/sessionHistory";
import { batchFromRealtime, batchFromUniverse, failureBatch } from "@/lib/intelligence/ingest";
import {
  SESSION_MAX_AGE_MS,
  SESSION_MAX_ASSETS,
  SESSION_MAX_OBSERVATIONS_PER_ASSET,
} from "@/lib/intelligence/rules";
import {
  AERO_PAIR,
  HYPE_PAIR,
  MIN,
  SEC,
  SOL_KEY,
  SOL_PAIR,
  START,
  T0,
  TOKEN_A,
  TOKEN_B,
  WETH_KEY,
  WETH_PAIR,
  batch,
  obs,
  realEnvelope,
  realUniverse,
} from "./helpers";

const fresh = () => createSessionState(START);

describe("session history — ingestion from the real lanes", () => {
  it("records every resolved canonical pair of a real realtime envelope at its fetchedAt", async () => {
    const env = await realEnvelope(T0);
    const s = ingest(fresh(), batchFromRealtime(env)!);
    expect(s.assets.size).toBe(4);
    const sol = s.assets.get(SOL_KEY)!;
    expect(sol.observations).toHaveLength(1);
    expect(sol.observations[0].observedAt).toBe(T0);
    expect(sol.observations[0].pairAddress).toBe(SOL_PAIR.pairAddress);
    expect(sol.observations[0].quoteAddress).toBe(SOL_PAIR.quoteToken!.address);
    expect(sol.observations[0].lanes).toEqual(["realtime"]);
    expect(s.lanes.realtime.firstOkAt).toBe(T0);
  });

  it("de-duplicates the same payload read twice (a cache re-read adds nothing)", async () => {
    const env = await realEnvelope(T0);
    const once = ingest(fresh(), batchFromRealtime(env)!);
    const twice = ingest(once, batchFromRealtime(env)!);
    expect(twice.assets.get(SOL_KEY)).toBe(once.assets.get(SOL_KEY));
    expect(observationCount(twice)).toBe(observationCount(once));
    expect(twice.rejected.duplicate).toBe(4);
  });

  it("merges the universe's copy of a canonical pair into the same observation (same pair + observedAt)", async () => {
    const env = await realEnvelope(T0);
    const u = await realUniverse(T0 + 20 * SEC, T0);
    let s = ingest(fresh(), batchFromRealtime(env)!);
    s = ingest(s, batchFromUniverse(u, T0 + 20 * SEC)!);
    const sol = s.assets.get(SOL_KEY)!;
    expect(sol.observations).toHaveLength(1);
    expect(sol.observations[0].lanes).toEqual(["realtime", "universe"]);
    expect(sol.observations[0].observedAt).toBe(T0);
  });

  it("an envelope without a fresh fetchedAt (failure / cache) is never ingested", async () => {
    const env = await realEnvelope(T0);
    expect(batchFromRealtime({ ...env, status: "stale", fetchedAt: null })).toBeNull();
    expect(batchFromRealtime(undefined)).toBeNull();
  });

  it("one canonical slot failing records a gap for that asset only, never borrowed data", async () => {
    const good = await realEnvelope(T0);
    const partial = await realEnvelope(T0 + 30 * SEC, ["ethereum"]);
    expect(partial.status).toBe("degraded");
    let s = ingest(fresh(), batchFromRealtime(good)!);
    s = ingest(s, batchFromRealtime(partial)!);
    const weth = s.assets.get(WETH_KEY)!;
    expect(weth.observations).toHaveLength(1);
    expect(weth.gaps).toEqual([{ at: T0 + 30 * SEC, lane: "realtime", reason: "PROVIDER_ERROR" }]);
    expect(s.assets.get(SOL_KEY)!.observations.map((o) => o.providerStatus)).toEqual([
      "live",
      "degraded",
    ]);
  });
});

describe("session history — ordering, duplicates, timestamps", () => {
  it("keeps observations in observedAt order under timestamp inversion", () => {
    let s = ingest(fresh(), batch("realtime", T0 + 60 * SEC, [obs(SOL_PAIR, T0 + 60 * SEC)]));
    s = ingest(s, batch("universe", T0 + 30 * SEC, [obs(SOL_PAIR, T0 + 30 * SEC)]));
    expect(s.assets.get(SOL_KEY)!.observations.map((o) => o.observedAt)).toEqual([
      T0 + 30 * SEC,
      T0 + 60 * SEC,
    ]);
  });

  it("same timestamp, different pair → two observations; same pair + timestamp → one", () => {
    const a = obs(SOL_PAIR, T0);
    const b = obs(SOL_PAIR, T0, { pairAddress: "OtherPoo1111111111111111111111111111111111" });
    let s = ingest(fresh(), batch("realtime", T0, [a, b]));
    expect(s.assets.get(SOL_KEY)!.observations).toHaveLength(2);
    s = ingest(s, batch("realtime", T0, [a]));
    expect(s.assets.get(SOL_KEY)!.observations).toHaveLength(2);
  });

  it("rejects invalid and pre-session observations; history never predates the session", () => {
    const s = ingest(
      fresh(),
      batch("realtime", T0, [
        obs(SOL_PAIR, START - 1),
        obs(WETH_PAIR, Number.NaN),
        obs(AERO_PAIR, T0),
      ]),
    );
    expect(s.rejected.preSession).toBe(1);
    expect(s.rejected.invalid).toBe(1);
    expect([...s.assets.keys()]).toEqual([assetKey("base", AERO_PAIR.baseToken.address)]);
    expect(retainedSince(s)).toBeGreaterThanOrEqual(s.startedAt);
    expect(retainedSince(createSessionState(START))).toBeNull();
  });

  it("zero is data and missing stays missing", () => {
    const s = ingest(
      fresh(),
      batch("realtime", T0, [
        obs(SOL_PAIR, T0, { liquidityUsd: 0, volume: { m5: 0 } }),
        obs(HYPE_PAIR, T0),
      ]),
    );
    const sol = s.assets.get(SOL_KEY)!.observations[0].snapshot;
    expect(sol.liquidityUsd).toBe(0);
    expect(sol.volume.m5).toBe(0);
    const hype = s.assets.get(assetKey("hyperliquid", HYPE_PAIR.baseToken.address))!;
    expect(hype.observations[0].snapshot.liquidityUsd).toBeNull(); // real HYPE payload has no liquidity
  });
});

describe("session history — identity", () => {
  it("EVM mixed case collapses to one asset; Base58 case variants stay distinct", () => {
    const upper = obs(WETH_PAIR, T0, {
      key: assetKey("ethereum", WETH_PAIR.baseToken.address.toUpperCase().replace("0X", "0x")),
    });
    const lower = obs(WETH_PAIR, T0 + 30 * SEC);
    const b58 = obs(TOKEN_A, T0, {}, "universe");
    const b58Variant = obs(
      TOKEN_A,
      T0,
      {
        key: assetKey("solana", TOKEN_A.baseToken.address.toLowerCase()),
        baseAddress: TOKEN_A.baseToken.address.toLowerCase(),
      },
      "universe",
    );
    const s = ingest(fresh(), batch("universe", T0, [upper, lower, b58, b58Variant]));
    expect(s.assets.get(WETH_KEY)!.observations).toHaveLength(2);
    expect(s.assets.has(assetKey("solana", TOKEN_A.baseToken.address))).toBe(true);
    expect(s.assets.has(assetKey("solana", TOKEN_A.baseToken.address.toLowerCase()))).toBe(true);
  });

  it("the same symbol on different addresses is never merged (no symbol identity)", () => {
    const a = obs(TOKEN_A, T0, { baseSymbol: "SOL" }, "universe");
    const s = ingest(fresh(), batch("universe", T0, [a, obs(SOL_PAIR, T0)]));
    expect(s.assets.size).toBe(2);
    for (const t of s.assets.values()) expect(t.assetKey).not.toMatch(/^sol$|:SOL$/);
  });
});

describe("session history — discovery and provider state", () => {
  it("assets in the first universe round are present, not discovered; later entrants are", () => {
    let s = ingest(fresh(), batch("universe", T0, [obs(TOKEN_A, T0, {}, "universe")]));
    expect(s.assets.get(assetKey("solana", TOKEN_A.baseToken.address))!.enteredAt).toBeNull();
    s = ingest(s, batch("universe", T0 + MIN, [obs(TOKEN_B, T0 + MIN, {}, "universe")]));
    expect(s.assets.get(assetKey("solana", TOKEN_B.baseToken.address))!.enteredAt).toBe(T0 + MIN);
  });

  it("a failure point changes the lane only; tracks keep their identity", () => {
    const s1 = ingest(fresh(), batch("realtime", T0, [obs(SOL_PAIR, T0)]));
    const s2 = ingest(s1, failureBatch("realtime", T0 + 45 * SEC, new Error("x"))!);
    expect(s2.assets.get(SOL_KEY)).toBe(s1.assets.get(SOL_KEY));
    expect(s2.lanes.realtime.points.at(-1)).toMatchObject({ state: "failed", at: T0 + 45 * SEC });
    expect(s2.lanes.universe).toBe(s1.lanes.universe);
  });

  it("a stale-fallback universe round is a failure point and contributes no observation", async () => {
    const u = await realUniverse(T0, T0);
    const stale = { ...u, radarInputs: { ...u.radarInputs, status: "stale" as const } };
    const b = batchFromUniverse(stale, T0 + MIN)!;
    expect(b.state).toBe("failed");
    expect(b.observations).toEqual([]);
    expect(b.at).toBe(T0 + MIN);
  });
});

describe("session history — bounds and eviction", () => {
  it("evicts observations older than the max age behind the newest observation", () => {
    let s = ingest(fresh(), batch("realtime", T0, [obs(SOL_PAIR, T0)]));
    s = ingest(
      s,
      batch("realtime", T0 + SESSION_MAX_AGE_MS + SEC, [
        obs(SOL_PAIR, T0 + SESSION_MAX_AGE_MS + SEC),
      ]),
    );
    const sol = s.assets.get(SOL_KEY)!;
    expect(sol.observations.map((o) => o.observedAt)).toEqual([T0 + SESSION_MAX_AGE_MS + SEC]);
    expect(sol.firstSeenAt).toBe(T0 + SESSION_MAX_AGE_MS + SEC);
  });

  it("caps observations per asset, dropping the oldest", () => {
    let s = fresh();
    for (let i = 0; i < SESSION_MAX_OBSERVATIONS_PER_ASSET + 10; i++) {
      s = ingest(s, batch("realtime", T0 + i * SEC, [obs(SOL_PAIR, T0 + i * SEC)]));
    }
    const list = s.assets.get(SOL_KEY)!.observations;
    expect(list).toHaveLength(SESSION_MAX_OBSERVATIONS_PER_ASSET);
    expect(list[0].observedAt).toBe(T0 + 10 * SEC);
  });

  it("caps assets, evicting the least recently observed first", () => {
    let s = fresh();
    for (let i = 0; i < SESSION_MAX_ASSETS + 3; i++) {
      const address = `0x${i.toString(16).padStart(40, "0")}`;
      const o = obs(WETH_PAIR, T0 + i * SEC, {
        key: assetKey("ethereum", address),
        baseAddress: address,
      });
      s = ingest(s, batch("universe", T0 + i * SEC, [o]));
    }
    expect(s.assets.size).toBe(SESSION_MAX_ASSETS);
    expect(s.assets.has(assetKey("ethereum", `0x${"0".repeat(40)}`))).toBe(false);
    expect(
      s.assets.has(
        assetKey("ethereum", `0x${(SESSION_MAX_ASSETS + 2).toString(16).padStart(40, "0")}`),
      ),
    ).toBe(true);
    expect(observationCount(s)).toBeLessThanOrEqual(
      SESSION_MAX_ASSETS * SESSION_MAX_OBSERVATIONS_PER_ASSET,
    );
  });
});

describe("SessionStore", () => {
  it("notifies only when state changes", () => {
    const store = new SessionStore(START);
    let calls = 0;
    store.subscribe(() => calls++);
    store.ingest(batch("realtime", T0, [obs(SOL_PAIR, T0)]));
    const after = store.getState();
    expect(calls).toBe(1);
    store.ingest(batch("realtime", T0, [], { state: "ok" })); // same lane point again
    expect(store.getState()).toBe(after);
    expect(calls).toBe(1);
  });
});
