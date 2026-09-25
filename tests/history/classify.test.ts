import { describe, expect, it } from "vitest";
import { classify } from "@/lib/history/classify";
import { RequestLedger } from "@/lib/history/requests";
import { fetchRealtimePairs } from "@/lib/providers/dexPairs";
import { fetchPairUniverse, type PairUniverse } from "@/lib/providers/universe";
import { SnapshotHistory } from "@/lib/signals/history";
import { HERBA, HONSE_KEY, MIN, T0, fixtureHttp, noSleep, type Scenario } from "./helpers";

/** One real engine round over the recorded fixtures. */
async function engineRound(
  t: number,
  s: Scenario,
  history: SnapshotHistory,
): Promise<PairUniverse> {
  const ledger = new RequestLedger(
    fixtureHttp(() => s),
    () => t,
    [],
    noSleep,
  );
  const deps = { fetchJson: ledger.fetchJson, now: () => t };
  const rt = await fetchRealtimePairs(deps);
  return fetchPairUniverse(undefined, history, { ok: true, rows: rt.data, observedAt: t }, deps);
}

describe("classifier — FIRED / VALID_NEGATIVE / NO_DATA from engine output only", () => {
  it("FIRED only when the engine's radar emitted the signal", async () => {
    const h = new SnapshotHistory();
    const u = await engineRound(T0, { honse: "signal" }, h);
    expect(u.radar.momentum.map((m) => m.key)).toContain(HONSE_KEY);
    expect(classify({ status: "live", universe: u, history: h }, HONSE_KEY, "EARLY_MOMENTUM")).toBe(
      "FIRED",
    );
  });

  it("recorded pool (20 buys : 20 sells, all inputs computable) → VALID_NEGATIVE", async () => {
    const h = new SnapshotHistory();
    const u = await engineRound(T0, { honse: "negative" }, h);
    expect(u.radar.momentum).toEqual([]);
    expect(classify({ status: "live", universe: u, history: h }, HONSE_KEY, "EARLY_MOMENTUM")).toBe(
      "VALID_NEGATIVE",
    );
  });

  it("a gate that fails on a REAL value is a decided negative ($HERBA liquidity $9.8K < $25K)", async () => {
    const h = new SnapshotHistory();
    const u = await engineRound(T0, { honse: "negative" }, h);
    expect(
      classify({ status: "live", universe: u, history: h }, `solana:${HERBA}`, "EARLY_MOMENTUM"),
    ).toBe("VALID_NEGATIVE");
  });

  it("m5 sample too thin for the engine's buy-pressure rule → NO_DATA (not a negative)", async () => {
    const h = new SnapshotHistory();
    const u = await engineRound(T0, { honse: "lowsample" }, h);
    expect(u.intelligence[HONSE_KEY].bp.ok).toBe(false);
    expect(classify({ status: "live", universe: u, history: h }, HONSE_KEY, "EARLY_MOMENTUM")).toBe(
      "NO_DATA",
    );
  });

  it("stale / offline / failed rounds and absent pairs are NO_DATA", async () => {
    const h = new SnapshotHistory();
    const u = await engineRound(T0, { honse: "signal" }, h);
    for (const status of ["stale", "offline", "failed"] as const) {
      expect(classify({ status, universe: u, history: h }, HONSE_KEY, "EARLY_MOMENTUM")).toBe(
        "NO_DATA",
      );
    }
    expect(
      classify(
        { status: "live", universe: u, history: h },
        "solana:NotInThisRound",
        "EARLY_MOMENTUM",
      ),
    ).toBe("NO_DATA");
    expect(
      classify({ status: "live", universe: null, history: h }, HONSE_KEY, "EARLY_MOMENTUM"),
    ).toBe("NO_DATA");
  });

  it("liquidity events: NO_DATA until the engine has a 5-minute comparison, then VALID_NEGATIVE / FIRED", async () => {
    const h = new SnapshotHistory();
    const first = await engineRound(T0, { honse: "negative" }, h);
    expect(
      classify({ status: "live", universe: first, history: h }, HONSE_KEY, "LIQUIDITY_REMOVED"),
    ).toBe("NO_DATA");
    for (let m = 1; m <= 5; m++) await engineRound(T0 + m * MIN, { honse: "negative" }, h);
    const steady = await engineRound(T0 + 6 * MIN, { honse: "negative" }, h);
    expect(
      classify({ status: "live", universe: steady, history: h }, HONSE_KEY, "LIQUIDITY_REMOVED"),
    ).toBe("VALID_NEGATIVE");
    expect(
      classify({ status: "live", universe: steady, history: h }, HONSE_KEY, "LIQUIDITY_ADDED"),
    ).toBe("VALID_NEGATIVE");
    const drained = await engineRound(
      T0 + 7 * MIN,
      { honse: "negative", honseLiquidity: 12_000 },
      h,
    );
    expect(
      classify({ status: "live", universe: drained, history: h }, HONSE_KEY, "LIQUIDITY_REMOVED"),
    ).toBe("FIRED");
    expect(
      classify({ status: "live", universe: drained, history: h }, HONSE_KEY, "LIQUIDITY_ADDED"),
    ).toBe("VALID_NEGATIVE");
  });
});
