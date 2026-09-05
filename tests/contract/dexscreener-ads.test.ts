import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fetchAds, tokenKey } from "@/lib/providers/dexscreener";
import { ProviderError } from "@/lib/providers/envelope";

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8"),
  ) as unknown;

const ADS = fixture("dexscreener.ads.latest.json") as Array<Record<string, unknown>>;
const PAIRS = fixture("dexscreener.tokens.solana.json");

const now = () => 1_700_000_000_000;

function deps(handlers: { ads?: () => unknown; tokens?: () => unknown }) {
  return {
    now,
    fetchJson: async (_source: string, url: string) => {
      if (url.includes("/ads/")) {
        if (!handlers.ads) throw new Error("unexpected ads call");
        return handlers.ads();
      }
      if (url.includes("/tokens/v1/")) return handlers.tokens ? handlers.tokens() : [];
      throw new Error(`unexpected url ${url}`);
    },
  };
}

describe("DexScreener ads — actual API contract", () => {
  it("parses the real bare-array payload (regression: code used to read `data.ads`)", async () => {
    expect(Array.isArray(ADS)).toBe(true);
    expect(ADS[0]).not.toHaveProperty("ads");
    expect(ADS[0]).not.toHaveProperty("token");
    // Verified fields on the live endpoint.
    expect(ADS[0]).toHaveProperty("chainId");
    expect(ADS[0]).toHaveProperty("tokenAddress");
    expect(ADS[0]).toHaveProperty("date");
    expect(ADS[0]).toHaveProperty("type");

    const env = await fetchAds(deps({ ads: () => ADS, tokens: () => PAIRS }));
    expect(env.status).toBe("live");
    expect(env.data).toHaveLength(ADS.length);
  });

  it("maps provider ad types onto display categories and keeps the raw value", async () => {
    const env = await fetchAds(deps({ ads: () => ADS, tokens: () => PAIRS }));
    for (const row of env.data) {
      expect(row.providerType).toBeTruthy();
      expect(["Profile", "Ad", "Trending", "Takeover"]).toContain(row.type);
    }
    const tokenAd = env.data.find((r) => r.providerType === "tokenAd");
    if (tokenAd) expect(tokenAd.type).toBe("Ad");
  });

  it("uses chain+address identity and parses the real timestamp", async () => {
    const env = await fetchAds(deps({ ads: () => ADS, tokens: () => PAIRS }));
    for (const row of env.data) {
      expect(row.id.startsWith(tokenKey(row.chainId, row.tokenAddress))).toBe(true);
      expect(row.timestamp).not.toBeNull();
      expect(Number.isFinite(row.timestamp as number)).toBe(true);
    }
  });

  it("reports a genuinely empty provider response as an empty live result", async () => {
    const env = await fetchAds(deps({ ads: () => [] }));
    expect(env.status).toBe("live");
    expect(env.data).toEqual([]);
  });

  it("throws on HTTP error rather than rendering a fake empty list", async () => {
    await expect(
      fetchAds(
        deps({
          ads: () => {
            throw new ProviderError("dexscreener", "HTTP_ERROR", "503");
          },
        }),
      ),
    ).rejects.toMatchObject({ code: "HTTP_ERROR" });
  });

  it("throws SCHEMA_MISMATCH when the root is the old wrapper object", async () => {
    await expect(fetchAds(deps({ ads: () => ({ ads: [] }) }))).rejects.toMatchObject({
      code: "SCHEMA_MISMATCH",
    });
  });

  it("drops malformed items and marks the response degraded", async () => {
    const mixed = [...ADS, { chainId: "solana", type: "tokenAd" /* no url/address/date */ }];
    const env = await fetchAds(deps({ ads: () => mixed, tokens: () => PAIRS }));
    expect(env.status).toBe("degraded");
    expect(env.droppedItems).toBe(1);
    expect(env.data).toHaveLength(ADS.length);
  });

  it("never invents symbol or price for unenriched rows", async () => {
    const env = await fetchAds(deps({ ads: () => ADS, tokens: () => [] }));
    for (const row of env.data) {
      expect(row.enriched).toBe(false);
      expect(row.price).toBeNull();
      expect(row.liquidity).toBeNull();
      expect(row.volume).toBeNull();
      expect(row.symbol).not.toBe("UNKNOWN");
    }
  });
});
