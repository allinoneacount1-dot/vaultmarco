import type { PairSnapshot } from "@/lib/signals/pairSnapshot";

export const T0 = 1_700_000_000_000;
const MIN = 60_000;

/**
 * Build a snapshot with explicit windows. Defaults describe a healthy, mature
 * pair with flat activity so each test overrides only what it is about.
 */
export function snapshot(over: Partial<PairSnapshot> & { ageMinutes?: number } = {}): PairSnapshot {
  const { ageMinutes = 120, ...rest } = over;
  const observedAt = rest.observedAt ?? T0;
  return {
    key: "solana:tokenx",
    chainId: "solana",
    dexId: "raydium",
    pairAddress: "pairx",
    url: "https://dexscreener.com/solana/pairx",
    baseSymbol: "TOKENX",
    baseName: "Token X",
    baseAddress: "tokenx",
    quoteSymbol: "SOL",
    sources: ["boost-latest"],
    observedAt,
    pairCreatedAt: observedAt - ageMinutes * MIN,
    priceUsd: 0.01,
    liquidityUsd: 410_000,
    fdv: 1_000_000,
    marketCap: 1_000_000,
    boostsActive: 12,
    // Flat: 5-minute share of the hour is exactly 5/60.
    volume: { m5: 1_000, h1: 12_000, h6: 72_000, h24: 288_000 },
    txns: {
      m5: { buys: 10, sells: 10 },
      h1: { buys: 120, sells: 120 },
      h6: { buys: 720, sells: 720 },
      h24: { buys: 2880, sells: 2880 },
    },
    priceChange: { m5: 0, h1: 0, h6: 0, h24: 0 },
    ...rest,
  };
}

/** The worked example from the spec: a 47-minute-old pair that is accelerating. */
export function acceleratingPair(observedAt = T0): PairSnapshot {
  return snapshot({
    observedAt,
    ageMinutes: 47,
    liquidityUsd: 410_000,
    boostsActive: 38,
    // previous window = 42 minutes; previous volume 16,800 → 400/min; recent 6,800/5 = 1,360/min → VA 3.4
    volume: { m5: 6_800, h1: 23_600, h6: null, h24: null },
    // previous txns = 210 over 42 min → 5/min; recent 52/5 = 10.4/min → TA 2.08; buys 38 : sells 14 → 2.7
    txns: { m5: { buys: 38, sells: 14 }, h1: { buys: 150, sells: 112 }, h6: null, h24: null },
    priceChange: { m5: 11.7, h1: 30, h6: null, h24: null },
  });
}
