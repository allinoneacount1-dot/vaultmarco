import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fetchMarketPrices } from "@/lib/providers/coingecko";
import { ProviderError, resolveEnvelope } from "@/lib/providers/envelope";

const MARKETS = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../fixtures/coingecko.markets.json", import.meta.url)),
    "utf8",
  ),
) as Array<Record<string, unknown>>;

const now = () => 1_700_000_000_000;
const deps = (fn: () => unknown) => ({ now, fetchJson: async () => fn() });

describe("CoinGecko markets — actual API contract", () => {
  it("parses a real markets payload into live data", async () => {
    const env = await fetchMarketPrices(deps(() => MARKETS));
    expect(env.status).toBe("live");
    expect(env.source).toBe("coingecko");
    expect(env.lastSuccessfulAt).toBe(now());
    expect(env.data.length).toBe(MARKETS.length);

    const btc = env.data.find((c) => c.id === "bitcoin");
    expect(btc?.sym).toBe("BTC");
    expect(Number.isFinite(btc?.px ?? NaN)).toBe(true);
  });

  it("throws on rate limiting instead of substituting hardcoded prices", async () => {
    await expect(
      fetchMarketPrices(
        deps(() => {
          throw new ProviderError("coingecko", "RATE_LIMITED", "429");
        }),
      ),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("throws SCHEMA_MISMATCH when the payload is not an array", async () => {
    await expect(fetchMarketPrices(deps(() => ({ data: [] })))).rejects.toMatchObject({
      code: "SCHEMA_MISMATCH",
    });
  });

  it("drops malformed coins and reports degraded", async () => {
    const env = await fetchMarketPrices(deps(() => [...MARKETS, { id: "broken" }]));
    expect(env.status).toBe("degraded");
    expect(env.droppedItems).toBe(1);
    expect(env.data.length).toBe(MARKETS.length);
  });
});

describe("failure semantics — stale vs offline", () => {
  it("serves the last REAL response as stale when the provider fails", async () => {
    const previous = await fetchMarketPrices(deps(() => MARKETS));
    const resolved = resolveEnvelope({
      source: "coingecko",
      previous,
      isError: true,
      error: new ProviderError("coingecko", "RATE_LIMITED", "429"),
    });

    expect(resolved?.status).toBe("stale");
    // The payload is byte-for-byte the earlier successful response.
    expect(resolved?.data).toEqual(previous.data);
    expect(resolved?.fetchedAt).toBeNull();
    expect(resolved?.lastSuccessfulAt).toBe(now());
    expect(resolved?.error?.code).toBe("RATE_LIMITED");
  });

  it("treats a PAUSED failing query as stale, not live", async () => {
    // react-query's default networkMode pauses (rather than errors) when it
    // classifies a failure as offline. A paused, already-failed query must not
    // keep a live label — that is exactly how stale prices got shown as LIVE.
    const previous = await fetchMarketPrices(deps(() => MARKETS));
    const resolved = resolveEnvelope({
      source: "coingecko",
      previous,
      isError: false,
      error: null,
      fetchStatus: "paused",
      fetchFailureCount: 1,
      fetchFailureReason: new ProviderError("coingecko", "NETWORK_ERROR", "Failed to fetch"),
    });

    expect(resolved?.status).toBe("stale");
    expect(resolved?.error?.code).toBe("NETWORK_ERROR");
  });

  it("keeps a paused query with zero failures live (an ordinary idle pause)", async () => {
    const previous = await fetchMarketPrices(deps(() => MARKETS));
    const resolved = resolveEnvelope({
      source: "coingecko",
      previous,
      isError: false,
      error: null,
      fetchStatus: "paused",
      fetchFailureCount: 0,
    });
    expect(resolved?.status).toBe("live");
  });

  it("reports offline with no data when there has never been a success", () => {
    const resolved = resolveEnvelope({
      source: "coingecko",
      previous: undefined,
      isError: true,
      error: new ProviderError("coingecko", "NETWORK_ERROR", "dns"),
    });

    expect(resolved?.status).toBe("offline");
    expect(resolved?.data).toBeUndefined();
    expect(resolved?.lastSuccessfulAt).toBeNull();
  });
});
