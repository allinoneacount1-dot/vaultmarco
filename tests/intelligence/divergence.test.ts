import { describe, expect, it } from "vitest";
import { assetKey } from "@/lib/assetIdentity";
import { type DivergenceResult, evaluateDivergences } from "@/lib/intelligence/divergence";
import type { AssetObservation } from "@/lib/intelligence/facts";
import { INTELLIGENCE_RULES_VERSION } from "@/lib/intelligence/rules";
import { HYPE_PAIR, MIN, SOL_PAIR, T0, TOKEN_A, obs } from "./helpers";

const by = (r: DivergenceResult[], id: DivergenceResult["id"]) => r.find((x) => x.id === id)!;
/** Mature pool (2 h): pace = (m5/5) / ((h1 − m5)/55). */
const mature = (at: number) => ({ pairCreatedAt: at - 120 * MIN });
// m5 = 1,100 vs h1 = 2,200 → (220/min) / (20/min) = 11×; flat 55/5 vs 605/55 → 1×.
const fastVol = { m5: 1_100, h1: 2_200 };
const flatVol = { m5: 100, h1: 1_200 };
const fastTx = { m5: { buys: 50, sells: 50 }, h1: { buys: 100, sells: 100 } };
const flatTx = { m5: { buys: 5, sells: 5 }, h1: { buys: 60, sells: 60 } };

function run(list: AssetObservation[]) {
  return evaluateDivergences(list);
}

describe("divergence predicates (intel-2)", () => {
  it("PRICE / VOLUME · DIVERGED: volume accelerates while price is flat; carries metrics, horizons, identity", () => {
    const r = run([
      obs(SOL_PAIR, T0, { ...mature(T0), volume: fastVol, priceChange: { m5: 0.1 } }),
    ]);
    const d = by(r, "PRICE_VS_VOLUME");
    expect(d.state).toBe("DIVERGED");
    expect(d.label).toBe("PRICE / VOLUME · DIVERGED");
    expect(d.metrics.map((m) => [m.name, m.horizon])).toEqual([
      ["PRICE CHANGE", "M5 (provider window)"],
      ["VOLUME ACCELERATION", "M5 PACE VS (H1 − M5) PACE"],
    ]);
    expect(d.metrics[1].value).toBeCloseTo(11, 6);
    expect(d).toMatchObject({
      pairAddress: SOL_PAIR.pairAddress,
      dexId: "orca",
      observedAt: T0,
      rulesVersion: INTELLIGENCE_RULES_VERSION,
    });
    const moving = by(
      run([obs(SOL_PAIR, T0, { ...mature(T0), volume: fastVol, priceChange: { m5: 2 } })]),
      "PRICE_VS_VOLUME",
    );
    expect(moving.state).toBe("NOT_DIVERGED");
  });

  it("any required field null → NOT_EVALUABLE (never false, never zero)", () => {
    const r = run([
      obs(SOL_PAIR, T0, { ...mature(T0), volume: fastVol, priceChange: { m5: null } }),
    ]);
    expect(by(r, "PRICE_VS_VOLUME")).toMatchObject({
      state: "NOT_EVALUABLE",
      missing: "priceChange.m5",
    });
    const noAge = run([
      obs(SOL_PAIR, T0, { pairCreatedAt: null, volume: fastVol, priceChange: { m5: 0 } }),
    ]);
    expect(by(noAge, "PRICE_VS_VOLUME").state).toBe("NOT_EVALUABLE");
    expect(by(noAge, "PRICE_VS_VOLUME").metrics[1].value).toBeNull();
    // Zero price change is data: flat → DIVERGED when volume accelerates.
    const zero = run([
      obs(SOL_PAIR, T0, { ...mature(T0), volume: fastVol, priceChange: { m5: 0 } }),
    ]);
    expect(by(zero, "PRICE_VS_VOLUME").state).toBe("DIVERGED");
  });

  it("PRICE / TRANSACTIONS and PRICE EXPANSION / VOLUME", () => {
    const tx = run([obs(SOL_PAIR, T0, { ...mature(T0), txns: fastTx, priceChange: { m5: -0.2 } })]);
    expect(by(tx, "PRICE_VS_TXNS").state).toBe("DIVERGED");
    const px = run([
      obs(SOL_PAIR, T0, { ...mature(T0), volume: flatVol, priceChange: { m5: -4 } }),
    ]);
    expect(by(px, "PRICE_EXPANSION_WITHOUT_VOLUME").state).toBe("DIVERGED");
    const pxVol = run([
      obs(SOL_PAIR, T0, { ...mature(T0), volume: fastVol, priceChange: { m5: 4 } }),
    ]);
    expect(by(pxVol, "PRICE_EXPANSION_WITHOUT_VOLUME").state).toBe("NOT_DIVERGED");
  });

  it("BUY/SELL BALANCE / PRICE: buy-side balance with falling price, or sell-side with rising price; sample guard", () => {
    expect(
      by(
        run([
          obs(SOL_PAIR, T0, { txns: { m5: { buys: 30, sells: 10 } }, priceChange: { m5: -1 } }),
        ]),
        "BALANCE_VS_PRICE",
      ).state,
    ).toBe("DIVERGED");
    expect(
      by(
        run([obs(SOL_PAIR, T0, { txns: { m5: { buys: 10, sells: 30 } }, priceChange: { m5: 1 } })]),
        "BALANCE_VS_PRICE",
      ).state,
    ).toBe("DIVERGED");
    expect(
      by(
        run([obs(SOL_PAIR, T0, { txns: { m5: { buys: 30, sells: 10 } }, priceChange: { m5: 1 } })]),
        "BALANCE_VS_PRICE",
      ).state,
    ).toBe("NOT_DIVERGED");
    // Real SOL fixture m5 120/68 with −0.07 %: not beyond the flat band → NOT_DIVERGED.
    expect(by(run([obs(SOL_PAIR, T0)]), "BALANCE_VS_PRICE").state).toBe("NOT_DIVERGED");
    expect(
      by(
        run([obs(SOL_PAIR, T0, { txns: { m5: { buys: 5, sells: 1 } }, priceChange: { m5: -1 } })]),
        "BALANCE_VS_PRICE",
      ).state,
    ).toBe("NOT_EVALUABLE");
  });

  it("VOLUME / LIQUIDITY needs two same-pool observations; HYPE (no liquidity) is NOT_EVALUABLE", () => {
    const first = obs(SOL_PAIR, T0, { ...mature(T0), volume: fastVol, liquidityUsd: 100_000 });
    expect(by(run([first]), "VOLUME_VS_LIQUIDITY").state).toBe("NOT_EVALUABLE");
    const later = obs(SOL_PAIR, T0 + 6 * MIN, {
      ...mature(T0 + 6 * MIN),
      volume: fastVol,
      liquidityUsd: 80_000,
    });
    const d = by(run([first, later]), "VOLUME_VS_LIQUIDITY");
    expect(d).toMatchObject({ state: "DIVERGED", priorObservedAt: T0 });
    expect(d.metrics[1].value).toBeCloseTo(-0.2, 6);
    const switched = obs(SOL_PAIR, T0 + 6 * MIN, {
      ...mature(T0 + 6 * MIN),
      volume: fastVol,
      liquidityUsd: 80_000,
      pairAddress: "OtherPoo1111111111111111111111111111111111",
    });
    expect(by(run([first, switched]), "VOLUME_VS_LIQUIDITY").state).toBe("NOT_EVALUABLE");
    const hype = run([obs(HYPE_PAIR, T0), obs(HYPE_PAIR, T0 + 6 * MIN)]);
    expect(by(hype, "VOLUME_VS_LIQUIDITY").state).toBe("NOT_EVALUABLE");
  });

  it("BOOST / ACTIVITY: feed pools only; canonical pools (no boosts.active) are NOT_EVALUABLE", () => {
    const a = obs(TOKEN_A, T0, { ...mature(T0), txns: flatTx }, "universe");
    const b = obs(
      TOKEN_A,
      T0 + MIN,
      { ...mature(T0 + MIN), txns: flatTx, boostsActive: 20 },
      "universe",
    );
    const d = by(run([a, b]), "BOOST_VS_ACTIVITY");
    expect(d).toMatchObject({
      state: "DIVERGED",
      assetKey: assetKey("solana", TOKEN_A.baseToken.address),
    });
    expect(d.metrics[0].value).toBe(10);
    expect(
      by(run([obs(SOL_PAIR, T0), obs(SOL_PAIR, T0 + MIN)]), "BOOST_VS_ACTIVITY"),
    ).toMatchObject({ state: "NOT_EVALUABLE", missing: "boosts.active" });
  });

  it("no input, no result — nothing is synthesized", () => {
    expect(evaluateDivergences([])).toEqual([]);
  });
});
