import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fetchTokenBoosts, boostTierFor, tokenKey } from "@/lib/providers/dexscreener";
import { ProviderError } from "@/lib/providers/envelope";

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8"),
  ) as unknown;

const BOOSTS = fixture("dexscreener.boosts.latest.json") as Array<Record<string, unknown>>;
const PAIRS = fixture("dexscreener.tokens.solana.json");

const now = () => 1_700_000_000_000;

/** Route the boosts URL and the enrichment URL to separate canned responses. */
function deps(handlers: {
  boosts?: () => unknown | Promise<unknown>;
  tokens?: () => unknown | Promise<unknown>;
}) {
  return {
    now,
    fetchJson: async (_source: string, url: string) => {
      if (url.includes("/token-boosts/")) {
        if (!handlers.boosts) throw new Error("unexpected boosts call");
        return handlers.boosts();
      }
      if (url.includes("/tokens/v1/")) {
        return handlers.tokens ? handlers.tokens() : [];
      }
      throw new Error(`unexpected url ${url}`);
    },
  };
}

describe("DexScreener boosts — actual API contract", () => {
  it("parses the real bare-array payload (regression: code used to read `data.boosts`)", async () => {
    // The recorded payload is an array at the root with no `boosts` wrapper and
    // no nested `token` object. Both were assumed by the previous parser.
    expect(Array.isArray(BOOSTS)).toBe(true);
    expect(BOOSTS[0]).not.toHaveProperty("boosts");
    expect(BOOSTS[0]).not.toHaveProperty("token");
    expect(BOOSTS[0]).toHaveProperty("tokenAddress");
    expect(BOOSTS[0]).toHaveProperty("chainId");

    const env = await fetchTokenBoosts(
      "latest",
      deps({ boosts: () => BOOSTS, tokens: () => PAIRS }),
    );

    expect(env.status).toBe("live");
    expect(env.source).toBe("dexscreener");
    expect(env.fetchedAt).toBe(now());
    expect(env.data).toHaveLength(BOOSTS.length);
  });

  it("uses chain+address identity, never symbol", async () => {
    const env = await fetchTokenBoosts(
      "latest",
      deps({ boosts: () => BOOSTS, tokens: () => PAIRS }),
    );
    for (const row of env.data) {
      expect(row.id).toBe(tokenKey(row.chainId, row.tokenAddress));
      expect(row.chainId).toBeTruthy();
      expect(row.tokenAddress).toBeTruthy();
    }
    expect(new Set(env.data.map((r) => r.id)).size).toBe(env.data.length);
  });

  it("enriches symbol and price from the pairs endpoint, and never invents them", async () => {
    const env = await fetchTokenBoosts(
      "latest",
      deps({ boosts: () => BOOSTS, tokens: () => PAIRS }),
    );

    const enriched = env.data.filter((r) => r.enriched);
    expect(enriched.length).toBeGreaterThan(0);
    for (const row of enriched) {
      expect(row.symbol).toBeTruthy();
      // An enriched row's price is a real number parsed from the provider.
      if (row.price !== null) expect(Number.isFinite(row.price)).toBe(true);
    }

    // Unenriched rows must NOT carry a fabricated ticker or a fake zero price.
    for (const row of env.data.filter((r) => !r.enriched)) {
      expect(row.price).toBeNull();
      expect(row.change24h).toBeNull();
      expect(row.volume24h).toBeNull();
      expect(row.symbol).not.toBe("UNKNOWN");
      expect(row.name).not.toBe("Unknown Token");
    }
  });

  it("reports a genuinely empty provider response as an empty live result", async () => {
    const env = await fetchTokenBoosts("latest", deps({ boosts: () => [] }));
    expect(env.status).toBe("live");
    expect(env.data).toEqual([]);
  });

  it("throws on HTTP error instead of returning a fake empty list", async () => {
    await expect(
      fetchTokenBoosts(
        "latest",
        deps({
          boosts: () => {
            throw new ProviderError("dexscreener", "HTTP_ERROR", "500");
          },
        }),
      ),
    ).rejects.toMatchObject({ code: "HTTP_ERROR" });
  });

  it("throws SCHEMA_MISMATCH when the root is not an array", async () => {
    await expect(
      fetchTokenBoosts("latest", deps({ boosts: () => ({ boosts: [] }) })),
    ).rejects.toMatchObject({ code: "SCHEMA_MISMATCH" });
  });

  it("drops malformed items and marks the response degraded", async () => {
    const mixed = [...BOOSTS, { chainId: "solana" /* missing url/tokenAddress/amounts */ }];
    const env = await fetchTokenBoosts(
      "latest",
      deps({ boosts: () => mixed, tokens: () => PAIRS }),
    );
    expect(env.status).toBe("degraded");
    expect(env.droppedItems).toBe(1);
    expect(env.data).toHaveLength(BOOSTS.length);
  });

  it("survives enrichment failure without fabricating market data", async () => {
    const env = await fetchTokenBoosts(
      "latest",
      deps({
        boosts: () => BOOSTS,
        tokens: () => {
          throw new ProviderError("dexscreener", "RATE_LIMITED", "429");
        },
      }),
    );
    expect(env.data).toHaveLength(BOOSTS.length);
    for (const row of env.data) {
      expect(row.enriched).toBe(false);
      expect(row.price).toBeNull();
    }
  });

  it("derives boost tier from the provider's real totalAmount", () => {
    expect(boostTierFor(0)).toBe("Low Boost");
    expect(boostTierFor(100)).toBe("Mid Boost");
    expect(boostTierFor(500)).toBe("High Boost");
    expect(boostTierFor(1000)).toBe("Whale Boost");
  });
});
