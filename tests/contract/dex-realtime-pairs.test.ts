import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_PAIRS,
  dexToolsUrl,
  fetchRealtimePairs,
  validateCandidate,
  type CanonicalPair,
} from "@/lib/providers/dexPairs";
import { ProviderError, resolveEnvelope } from "@/lib/providers/envelope";
import { formatNumber } from "@/components/marco/shared/helpers";

const FIXTURES = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../fixtures/dexscreener.pairs.canonical.json", import.meta.url)),
    "utf8",
  ),
) as Record<string, { pairs: Array<Record<string, unknown>> }>;

const now = () => 1_700_000_000_000;
const want = (key: string): CanonicalPair => CANONICAL_PAIRS.find((p) => p.key === key)!;

/** Serve each canonical pair from its recorded real payload, with overrides. */
function deps(overrides: Record<string, unknown | (() => never)> = {}) {
  return {
    now,
    fetchJson: async (_s: string, url: string) => {
      const chain = CANONICAL_PAIRS.find((p) => url.includes(`/${p.chainId}/`))?.chainId;
      if (!chain) throw new Error(`unexpected url ${url}`);
      if (chain in overrides) {
        const o = overrides[chain];
        if (typeof o === "function") return (o as () => never)();
        return o;
      }
      return FIXTURES[chain];
    },
  };
}

/** A payload shaped exactly like the provider's, carrying one arbitrary pair. */
const payload = (pair: Record<string, unknown>) => ({ schemaVersion: "1.0.0", pairs: [pair] });

type MutablePair = Record<string, unknown> & {
  baseToken: { address: string; symbol?: string; name?: string };
  quoteToken: { address: string; symbol?: string };
};

const solPair = () => structuredClone(FIXTURES.solana.pairs[0]) as MutablePair;

describe("NO_SILENT_PAIR_SUBSTITUTION — canonical identity", () => {
  it("1. accepts the exact canonical pair", async () => {
    const env = await fetchRealtimePairs(deps());
    expect(env.status).toBe("live");
    expect(env.data).toHaveLength(CANONICAL_PAIRS.length);
    for (const row of env.data) {
      expect(row.resolved).toBe(true);
      expect(row.priceUsd).toBeGreaterThan(0);
    }
    const sol = env.data.find((r) => r.key === "SOL/USDC")!;
    expect(sol.baseSymbol).toBe("SOL");
    expect(sol.chainId).toBe("solana");
  });

  it("2. rejects the right symbols on the WRONG CHAIN", () => {
    const p = solPair();
    p.chainId = "ethereum"; // same SOL/USDC symbols, different chain
    expect(validateCandidate(want("SOL/USDC"), p as never)).toBe(false);
  });

  it("3. rejects a spoofed base token carrying the same symbol", () => {
    const p = solPair();
    // The exact impostor production was showing: symbol "SOL", different mint.
    p.baseToken = { ...p.baseToken, address: "CkH8iAKJhdAvLj9EijKdYwpbhrq6wjmFRZLSu5Rgsjrp" };
    expect(p.baseToken.symbol).toBe("SOL");
    expect(validateCandidate(want("SOL/USDC"), p as never)).toBe(false);
  });

  it("4. rejects a wrong quote token", () => {
    const p = solPair();
    p.quoteToken = { ...p.quoteToken, address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" };
    expect(validateCandidate(want("SOL/USDC"), p as never)).toBe(false);
  });

  it("5. rejects a wrong pair even when it carries far MORE liquidity", async () => {
    const impostor = solPair();
    impostor.baseToken = {
      address: "CkH8iAKJhdAvLj9EijKdYwpbhrq6wjmFRZLSu5Rgsjrp",
      symbol: "SOL",
      name: "SOL",
    };
    impostor.liquidity = { usd: 2_159_225_098 }; // ~85x the real pool
    impostor.priceUsd = "102.83";

    const env = await fetchRealtimePairs(deps({ solana: payload(impostor) }));
    const sol = env.data.find((r) => r.key === "SOL/USDC")!;

    expect(sol.resolved).toBe(false);
    expect(sol.reason).toBe("identity_mismatch");
    expect(sol.priceUsd).toBeNull();
    expect(sol.liquidityUsd).toBeNull();
    expect(env.status).toBe("degraded");
  });

  it("6. reports the slot unresolved when the expected pair is missing", async () => {
    const env = await fetchRealtimePairs(deps({ base: { schemaVersion: "1.0.0", pairs: [] } }));
    const aero = env.data.find((r) => r.key === "AERO/USDC")!;
    expect(aero.resolved).toBe(false);
    expect(aero.reason).toBe("not_found");
    expect(aero.priceUsd).toBeNull();
    expect(env.status).toBe("degraded");
    // The other slots are untouched — one bad pair never poisons the rest.
    expect(env.data.filter((r) => r.resolved)).toHaveLength(CANONICAL_PAIRS.length - 1);
  });

  it("7. produces no values when the provider fails with HTTP error", async () => {
    const boom = () => {
      throw new ProviderError("dexscreener", "HTTP_ERROR", "503");
    };
    const env = await fetchRealtimePairs(deps({ solana: boom }));
    const sol = env.data.find((r) => r.key === "SOL/USDC")!;
    expect(sol.resolved).toBe(false);
    expect(sol.reason).toBe("provider_error");
    expect(sol.priceUsd).toBeNull();

    // Every provider down => throw, so react-query keeps the last real payload.
    await expect(
      fetchRealtimePairs(deps({ solana: boom, ethereum: boom, hyperliquid: boom, base: boom })),
    ).rejects.toMatchObject({ code: "HTTP_ERROR" });
  });

  it("8. produces no values on a malformed response", async () => {
    const env = await fetchRealtimePairs(deps({ ethereum: { totally: "wrong" } }));
    const weth = env.data.find((r) => r.key === "WETH/USDT")!;
    expect(weth.resolved).toBe(false);
    expect(weth.priceUsd).toBeNull();
    expect(weth.volume24h).toBeNull();
  });

  it("9. last-known-good is reported STALE, never LIVE", async () => {
    const previous = await fetchRealtimePairs(deps());
    expect(previous.status).toBe("live");

    const resolved = resolveEnvelope({
      source: "dexscreener",
      previous,
      isError: true,
      error: new ProviderError("dexscreener", "NETWORK_ERROR", "down"),
    });

    expect(resolved?.status).toBe("stale");
    expect(resolved?.data).toEqual(previous.data); // identical real payload
    expect(resolved?.fetchedAt).toBeNull();
  });

  it("10. the DexTools tab exposes a real explorer link and claims no market data", () => {
    for (const p of CANONICAL_PAIRS) {
      const url = dexToolsUrl(p);
      // The old build linked to an address-less page that could not show a pair.
      expect(url).toContain(p.pairAddress);
      expect(url).toMatch(/^https:\/\/www\.dextools\.io\/app\//);
    }
  });

  it("12. no hardcoded fallback pair prices exist in the module", async () => {
    const src = readFileSync(
      fileURLToPath(new URL("../../src/lib/providers/dexPairs.ts", import.meta.url)),
      "utf8",
    );
    expect(src).not.toMatch(/FALLBACK_PAIRS/);
    // Identity constants are addresses; no price/volume literals may appear.
    expect(src).not.toMatch(/priceUsd:\s*["']?\d/);
    expect(src).not.toMatch(/178\.5|3620|0\.0245|12\.5\b/);
  });
});

describe("11. financial formatter — K / M / B / T", () => {
  it("scales every magnitude and fixes the $2159225K defect", () => {
    expect(formatNumber(2_159_225_098)).toBe("$2.16B");
    expect(formatNumber(1_756_143_000)).toBe("$1.76B");
    expect(formatNumber(30_660_924)).toBe("$30.7M");
    expect(formatNumber(8_437_392)).toBe("$8.4M");
    expect(formatNumber(51_197)).toBe("$51.2K");
    expect(formatNumber(2_720_912_791_013)).toBe("$2.72T");
  });

  it("handles boundaries without rounding into the wrong tier", () => {
    expect(formatNumber(999)).toBe("$999");
    expect(formatNumber(1_000)).toBe("$1K");
    expect(formatNumber(999_999)).toBe("$1M"); // must not be "$1000K"
    expect(formatNumber(999_999_999)).toBe("$1B"); // must not be "$1000M"
  });

  it("handles zero, negatives and non-finite input", () => {
    expect(formatNumber(0)).toBe("$0");
    expect(formatNumber(-2_500_000)).toBe("-$2.5M");
    expect(formatNumber(Number.NaN)).toBe("—");
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("—");
  });
});
