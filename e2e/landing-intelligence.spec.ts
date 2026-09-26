import { test, expect, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * LANDING · VAULT://INTELLIGENCE — the preview shows provider data or its
 * truthful absence, never a sample frame.
 *
 * DexScreener is served from the recorded fixtures in tests/fixtures. CoinGecko
 * `/global` and alternative.me are served SCHEMA-SHAPED TEST DATA (hand-written,
 * not captured — egress to those providers is blocked in development). Nothing
 * here is live market data.
 */

const fx = (n: string) =>
  JSON.parse(readFileSync(new URL(`../tests/fixtures/${n}`, import.meta.url), "utf8"));
const BOOSTS = fx("dexscreener.boosts.latest.json") as unknown[];
const ADS = fx("dexscreener.ads.latest.json");
const PAIRS = fx("dexscreener.pairs.canonical.json") as Record<string, unknown>;
const TOKENS = fx("dexscreener.tokens.solana.json");

/** Schema-shaped test data, NOT a captured provider response. */
const GLOBAL_TEST_BODY = {
  data: {
    total_market_cap: { usd: 3_000_000_000_000 },
    total_volume: { usd: 100_000_000_000 },
    market_cap_percentage: { btc: 50 },
    market_cap_change_percentage_24h_usd: -1.5,
    updated_at: 1_700_000_000,
  },
};
const FNG_TEST_BODY = { data: [{ value: "40", value_classification: "Fear" }] };

/** The sample values the preview used to render as live data. */
const SAMPLES = [
  "124.5",
  "18.2%",
  "127",
  "12.5%",
  "2.4T",
  "3.1%",
  "176.26",
  "4.05",
  "3,620",
  "1.90",
  "1.2140",
  "2.31",
  "0.8620",
  "6.42",
  "JUP",
  "14+",
  "ACTIVE BOOSTS",
];

const CANONICAL = [
  {
    chain: "solana",
    pair: "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE",
    base: "So11111111111111111111111111111111111111112",
    quote: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  },
  {
    chain: "ethereum",
    pair: "0x11b815efB8f581194ae79006d24E0d814B7697F6",
    base: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    quote: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  },
  {
    chain: "hyperliquid",
    pair: "0x13ba5fea7078ab3798fbce53b4d0721c",
    base: "0x0d01dc56dcaaca66ad901c959b4011ec",
    quote: "0x6d1e7cde53ba9467b783cb7c530ce054",
  },
  {
    chain: "base",
    pair: "0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d",
    base: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    quote: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
];

type Mode = "live" | "down" | "hang" | "429";
type Providers = { dex: Mode; gecko: Mode; fng: Mode; dropPair?: string };

async function setup(page: Page, p: Providers) {
  const requests: string[] = [];
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(e.message));
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1")) requests.push(r.url());
  });
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("mv_seen", "1"); // skip the one-time preloader
    } catch {
      /* ignore */
    }
  });
  await page.route("https://beaconcha.in/**", (r) => r.abort());
  await page.route("https://s3.tradingview.com/**", (r) => r.abort());
  // Hero market tape (CoinGecko /coins/markets) is not part of this section.
  await page.route("https://api.coingecko.com/api/v3/coins/**", (r) => r.abort());

  const fail = (r: Route, mode: Mode) =>
    mode === "429"
      ? r.fulfill({ status: 429, body: "rate limited" })
      : mode === "hang"
        ? new Promise<void>(() => {}) // never answers: stays in flight
        : r.fulfill({ status: 503, body: "down" });
  const json = (r: Route, x: unknown) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify(x) });

  await page.route("https://api.coingecko.com/api/v3/global", (r) =>
    p.gecko === "live" ? json(r, GLOBAL_TEST_BODY) : fail(r, p.gecko),
  );
  await page.route("https://api.alternative.me/**", (r) =>
    p.fng === "live" ? json(r, FNG_TEST_BODY) : fail(r, p.fng),
  );
  await page.route("https://api.dexscreener.com/**", (r) => {
    if (p.dex !== "live") return fail(r, p.dex);
    const u = r.request().url();
    if (u.includes("/token-boosts/")) return json(r, BOOSTS);
    if (u.includes("/ads/")) return json(r, ADS);
    if (u.includes("/tokens/v1/")) return json(r, u.includes("/solana/") ? TOKENS : []);
    if (u.includes("/latest/dex/pairs/")) {
      const chain = u.split("/latest/dex/pairs/")[1].split("/")[0];
      if (chain === p.dropPair) return json(r, { pairs: [] });
      return json(r, PAIRS[chain] ?? { pairs: [] });
    }
    return r.abort();
  });
  return { requests, problems };
}

async function openSection(page: Page) {
  await page.goto("/", { waitUntil: "load" });
  await page.evaluate(() => document.getElementById("intelligence")?.scrollIntoView());
  const preview = page.getByTestId("intel-preview");
  await expect(preview).toBeVisible();
  return preview;
}

async function expectNoSamples(page: Page) {
  const text = (await page.locator("#intelligence").innerText()).replace(/\s+/g, " ");
  for (const s of SAMPLES) expect(text, `sample value "${s}" leaked`).not.toContain(s);
}

test.describe("landing intelligence preview", () => {
  test("all providers live → LIVE with provider values, identities and 24H horizon", async ({
    page,
  }) => {
    const { requests, problems } = await setup(page, { dex: "live", gecko: "live", fng: "live" });
    const preview = await openSection(page);
    await expect(preview).toHaveAttribute("data-state", "live", { timeout: 15_000 });
    const status = page.getByTestId("intel-status");
    await expect(status).toContainText("LIVE");
    await expect(status).toContainText(/UPDATED \d+S AGO/);

    await expect(page.getByTestId("intel-metric-vol")).toContainText("$100.0B");
    await expect(page.getByTestId("intel-metric-mcap")).toContainText("$3.00T");
    await expect(page.getByTestId("intel-metric-mcap")).toContainText("−1.5% 24H");
    await expect(page.getByTestId("intel-metric-boosts")).toContainText("LATEST BOOSTS");
    await expect(page.getByTestId("intel-metric-boosts")).toContainText(String(BOOSTS.length));

    // Rows: the canonical pairs, keyed by chain + pair + base + quote address.
    const rows = page.getByTestId("intel-row");
    await expect(rows).toHaveCount(CANONICAL.length);
    for (const [i, c] of CANONICAL.entries()) {
      const row = rows.nth(i);
      await expect(row).toHaveAttribute("data-chain-id", c.chain);
      await expect(row).toHaveAttribute("data-pair-address", c.pair);
      await expect(row).toHaveAttribute("data-base-address", c.base);
      await expect(row).toHaveAttribute("data-quote-address", c.quote);
      await expect(row).toHaveAttribute("data-resolved", "true");
    }
    // SOL/USDC: priceUsd 103.27 and h24 1.29 in the recorded fixture.
    await expect(rows.nth(0)).toContainText("$103.27");
    await expect(rows.nth(0)).toContainText("+1.29%");
    await expect(page.locator("#intelligence")).toContainText("24H");

    for (const f of await page.getByTestId("intel-feed").all()) {
      await expect(f).toHaveAttribute("data-state", "live");
    }
    await expect(page.locator("#intelligence")).toContainText("MULTI-CHAIN");
    await expectNoSamples(page);

    // One loop per query: each canonical pair and /global requested once per round.
    for (const c of CANONICAL) {
      expect(requests.filter((u) => u.includes(`/latest/dex/pairs/${c.chain}/`))).toHaveLength(1);
    }
    expect(requests.filter((u) => u.endsWith("/api/v3/global"))).toHaveLength(1);
    expect(requests.filter((u) => u.includes("/token-boosts/latest/"))).toHaveLength(1);
    expect(problems).toEqual([]);
  });

  test("loading → CONNECTING, every value —, no sample frame", async ({ page }) => {
    await setup(page, { dex: "hang", gecko: "hang", fng: "hang" });
    const preview = await openSection(page);
    await expect(preview).toHaveAttribute("data-state", "loading");
    await expect(page.getByTestId("intel-status")).toHaveText(/CONNECTING/);
    for (const k of ["vol", "boosts", "mcap"]) {
      await expect(page.getByTestId(`intel-metric-${k}`)).toContainText("—");
    }
    const rowsText = await page.getByTestId("intel-row").allInnerTexts();
    expect(rowsText.join(" ")).not.toMatch(/\$\d/);
    await expectNoSamples(page);
  });

  test("CoinGecko down → PARTIAL; its cells —, DexScreener values still shown", async ({
    page,
  }) => {
    await setup(page, { dex: "live", gecko: "down", fng: "live" });
    const preview = await openSection(page);
    await expect(preview).toHaveAttribute("data-state", "degraded", { timeout: 15_000 });
    await expect(page.getByTestId("intel-status")).toContainText("PARTIAL");
    await expect(page.getByTestId("intel-metric-vol")).toContainText("—");
    await expect(page.getByTestId("intel-metric-mcap")).toContainText("—");
    await expect(page.getByTestId("intel-row").nth(0)).toContainText("$103.27");
    await expectNoSamples(page);
  });

  test("partial ticker: one pair unresolved → that row —, section PARTIAL", async ({ page }) => {
    await setup(page, { dex: "live", gecko: "live", fng: "live", dropPair: "base" });
    const preview = await openSection(page);
    await expect(preview).toHaveAttribute("data-state", "degraded", { timeout: 15_000 });
    const base = page.locator('[data-testid="intel-row"][data-chain-id="base"]');
    await expect(base).toHaveAttribute("data-resolved", "false");
    expect(await base.innerText()).not.toMatch(/\$\d/);
    const dexFeed = page.locator('[data-testid="intel-feed"][data-feed="DEX REALTIME"]');
    await expect(dexFeed).toHaveAttribute("data-state", "degraded");
    await expectNoSamples(page);
  });

  test("429 from CoinGecko → not retried aggressively, never LIVE", async ({ page }) => {
    const { requests } = await setup(page, { dex: "live", gecko: "429", fng: "live" });
    const preview = await openSection(page);
    await expect(preview).toHaveAttribute("data-state", "degraded", { timeout: 15_000 });
    await page.waitForTimeout(3000);
    // One attempt per 60 s round — no in-round retry on a 429.
    expect(requests.filter((u) => u.endsWith("/api/v3/global")).length).toBe(1);
    await expect(page.getByTestId("intel-metric-mcap")).toContainText("—");
  });

  test("every provider down from the start → OFFLINE, no values", async ({ page }) => {
    await setup(page, { dex: "down", gecko: "down", fng: "down" });
    const preview = await openSection(page);
    await expect(preview).toHaveAttribute("data-state", "offline", { timeout: 20_000 });
    await expect(page.getByTestId("intel-status")).toContainText("OFFLINE");
    await expect(page.getByTestId("intel-status")).not.toContainText("UPDATED");
    for (const k of ["vol", "boosts", "mcap"]) {
      await expect(page.getByTestId(`intel-metric-${k}`)).toContainText("—");
    }
    await expectNoSamples(page);
  });

  test("stale: real data ages past its window → STALE; recovery → LIVE again", async ({ page }) => {
    test.setTimeout(120_000);
    const providers: Providers = { dex: "live", gecko: "live", fng: "live" };
    // The fake clock steps every animation frame; keep the decorative 3D hero
    // (which honours reduced motion) out of this timing test.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.install();
    await setup(page, providers);
    const preview = await openSection(page);
    await expect(preview).toHaveAttribute("data-state", "live", { timeout: 15_000 });

    // Every provider stops answering; cached real data remains.
    providers.dex = "down";
    providers.gecko = "down";
    providers.fng = "down";
    await page.clock.fastForward("02:00");
    await page.clock.runFor(10_000);
    await expect(preview).toHaveAttribute("data-state", "stale", { timeout: 20_000 });
    await expect(page.getByTestId("intel-status")).toContainText("STALE");
    await expect(page.getByTestId("intel-status")).toContainText(/UPDATED \dM AGO/);
    // Last-known values stay on screen; nothing resets to zero or a sample.
    await expect(page.getByTestId("intel-row").nth(0)).toContainText("$103.27");
    await expectNoSamples(page);

    // Providers recover: the next rounds restore LIVE with a fresh age.
    providers.dex = "live";
    providers.gecko = "live";
    providers.fng = "live";
    await page.clock.fastForward("01:05");
    await page.clock.runFor(5_000);
    await expect(preview).toHaveAttribute("data-state", "live", { timeout: 20_000 });
    await expect(page.getByTestId("intel-status")).toContainText(/UPDATED \d+S AGO/);
  });
});
