import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * SMART WATCHLIST — real app in a real browser.
 *
 * DexScreener is served from the recorded fixtures in tests/fixtures; every
 * other provider is aborted and TradingView gets a test-only loader. The
 * provider's behaviour can be switched mid-test (`provider.mode`).
 */

const fx = (n: string) =>
  JSON.parse(readFileSync(new URL(`../tests/fixtures/${n}`, import.meta.url), "utf8"));
const BOOSTS = fx("dexscreener.boosts.latest.json") as Array<{ tokenAddress: string }>;
const ADS = fx("dexscreener.ads.latest.json");
const PAIRS = fx("dexscreener.pairs.canonical.json") as Record<string, unknown>;
const TOKENS = fx("dexscreener.tokens.solana.json") as Array<{ baseToken: { address: string } }>;

const HONSE = "46vV3ZpFNLZn1CDRYnAvqPsdW5ejEYn9GK9kPcZFpump";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const STORAGE_KEY = "marcovault:watchlist";

const TV = `(()=>{const s=document.currentScript;const w=s.parentElement.querySelector(".tradingview-widget-container__widget");const f=document.createElement("iframe");f.srcdoc="<body></body>";w.appendChild(f);})();`;

/** ok: fixtures · honse-gone: honse no longer boosted/enriched · down: every endpoint fails. */
type Provider = { mode: "ok" | "honse-gone" | "down" };

async function setup(page: Page, provider: Provider = { mode: "ok" }) {
  const problems: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    if (/Failed to load resource|net::ERR/.test(m.text())) return; // aborted non-DEX providers
    problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1")) requests.push(r.url());
  });
  await page.route("https://s3.tradingview.com/**", (r) =>
    r.fulfill({ contentType: "application/javascript", body: TV }),
  );
  for (const host of [
    "https://api.coingecko.com/**",
    "https://api.alternative.me/**",
    "https://beaconcha.in/**",
  ]) {
    await page.route(host, (r) => r.abort());
  }
  await page.route("https://api.dexscreener.com/**", (r) => {
    const u = r.request().url();
    if (provider.mode === "down") return r.fulfill({ status: 503, body: "down" });
    const gone = provider.mode === "honse-gone";
    const json = (x: unknown) =>
      r.fulfill({ contentType: "application/json", body: JSON.stringify(x) });
    if (u.includes("/token-boosts/"))
      return json(gone ? BOOSTS.filter((b) => b.tokenAddress !== HONSE) : BOOSTS);
    if (u.includes("/ads/")) return json(ADS);
    if (u.includes("/tokens/v1/")) {
      if (!u.includes("/solana/")) return json([]);
      return json(gone ? TOKENS.filter((p) => p.baseToken.address !== HONSE) : TOKENS);
    }
    if (u.includes("/latest/dex/pairs/")) {
      const chain = u.split("/latest/dex/pairs/")[1].split("/")[0];
      return json(PAIRS[chain] ?? { pairs: [] });
    }
    return r.abort();
  });
  await page.clock.install();
  await page.goto("/dashboard");
  await expect(page.getByText(/UNIVERSE \d+/).first()).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
  return { problems, requests };
}

/** Pause page timers and wait until no request is in flight; returns the count to measure from. */
async function freeze(page: Page, requests: string[]) {
  for (const ahead of [1_000, 10_000, 60_000]) {
    try {
      await page.clock.pauseAt(await page.evaluate((a) => Date.now() + a, ahead));
      break;
    } catch (e) {
      if (!/past/.test(String(e)) || ahead === 60_000) throw e;
    }
  }
  let seen = -1;
  while (seen !== requests.length) {
    seen = requests.length;
    await page.waitForTimeout(1_500);
  }
  return requests.length;
}

const drawer = (page: Page) => page.getByTestId("token-drawer");
const watchButton = (page: Page) => drawer(page).getByTestId("watch");
const watchlistMode = (page: Page) => page.getByRole("button", { name: "WATCHLIST", exact: true });
const watchRow = (page: Page, key: string) =>
  page.locator(`[data-testid="watch-row"][data-key="${key}"]`);
const stored = (page: Page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), STORAGE_KEY);

/** Open a token's drawer through Global Search. */
async function openViaSearch(page: Page, query: string, key: string) {
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByTestId("global-search").getByRole("combobox").fill(query);
  await page.keyboard.press("Enter");
  await expect(drawer(page)).toHaveAttribute("data-key", key);
}

async function closeDrawer(page: Page) {
  await page.keyboard.press("Escape");
  await expect(drawer(page)).toHaveCount(0);
}

test.describe("Smart Watchlist", () => {
  test("WATCH in the drawer → WATCHLIST row → drawer; persists identity only; UNWATCH", async ({
    page,
  }) => {
    const { problems } = await setup(page);
    await watchlistMode(page).click();
    await expect(
      page.getByText("No watched tokens. Open any token and press WATCH."),
    ).toBeVisible();

    await openViaSearch(page, HONSE, `solana:${HONSE}`);
    await expect(watchButton(page)).toHaveText("WATCH");
    await expect(watchButton(page)).toHaveAttribute("aria-pressed", "false");
    await watchButton(page).click();
    await expect(watchButton(page)).toHaveText("UNWATCH");
    await expect(watchButton(page)).toHaveAttribute("aria-pressed", "true");
    await closeDrawer(page);

    const row = watchRow(page, `solana:${HONSE}`);
    await expect(row).toBeVisible();
    await expect(row.getByTestId("watch-state")).toHaveText("LIVE");
    await expect(row).toContainText("honse");
    await expect(row).toContainText("LIQ $");
    await expect(page.getByText("WATCHLIST · 1 TOKEN")).toBeVisible();

    // Stored: identity only — no market value.
    const saved = await stored(page);
    expect(saved.version).toBe(1);
    expect(saved.items).toHaveLength(1);
    expect(Object.keys(saved.items[0]).sort()).toEqual(["addedAt", "address", "chainId", "key"]);
    expect(saved.items[0]).toMatchObject({
      key: `solana:${HONSE}`,
      chainId: "solana",
      address: HONSE,
    });

    // Row → the same drawer, from the WATCHLIST entry point.
    await row.click();
    await expect(drawer(page)).toHaveAttribute("data-key", `solana:${HONSE}`);
    await expect(drawer(page).getByTestId("contract-address")).toHaveText(HONSE);
    await watchButton(page).click(); // UNWATCH
    await expect(watchButton(page)).toHaveText("WATCH");
    await closeDrawer(page);
    await expect(row).toHaveCount(0);
    await expect(
      page.getByText("No watched tokens. Open any token and press WATCH."),
    ).toBeVisible();
    expect((await stored(page)).items).toEqual([]);
    expect(problems).toEqual([]);
  });

  test("survives a reload; EVM original address kept; unknown token → IDENTITY ONLY", async ({
    page,
  }) => {
    const unknown = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
    await page.addInitScript(
      ([k, v]) => {
        if (!localStorage.getItem(k)) localStorage.setItem(k, v);
      },
      [
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          items: [{ key: `solana:${unknown}`, chainId: "solana", address: unknown, addedAt: 1 }],
        }),
      ],
    );
    const { problems } = await setup(page);
    await openViaSearch(page, WETH.toLowerCase(), `ethereum:${WETH.toLowerCase()}`);
    await watchButton(page).click();
    await closeDrawer(page);

    await page.reload();
    await expect(page.getByText(/UNIVERSE \d+/).first()).toBeVisible({ timeout: 15_000 });
    await watchlistMode(page).click();
    await expect(page.getByText("WATCHLIST · 2 TOKENS")).toBeVisible();

    const weth = watchRow(page, `ethereum:${WETH.toLowerCase()}`);
    await expect(weth.getByTestId("watch-state")).toHaveText("LIVE");
    await expect(weth).toContainText("WETH");
    const saved = await stored(page);
    expect(saved.items.map((i: { address: string }) => i.address)).toEqual([WETH, unknown]);

    const id = watchRow(page, `solana:${unknown}`);
    await expect(id.getByTestId("watch-state")).toHaveText("IDENTITY ONLY");
    await expect(id).toContainText("no market observation");
    await expect(id).not.toContainText("LIQ $");
    await id.click();
    await expect(drawer(page)).toHaveAttribute("data-kind", "identity");
    await expect(drawer(page).getByTestId("contract-address")).toHaveText(unknown);
    await expect(watchButton(page)).toHaveText("UNWATCH");
    expect(problems).toEqual([]);
  });

  test("token leaves the universe → RETAINED; full provider outage → STALE; no new requests", async ({
    page,
  }) => {
    test.setTimeout(300_000); // fake-clock rounds are slow to simulate
    const provider: Provider = { mode: "ok" };
    const { problems, requests } = await setup(page, provider);
    for (const [q, key] of [
      [HONSE, `solana:${HONSE}`],
      [WETH, `ethereum:${WETH.toLowerCase()}`],
    ] as const) {
      await openViaSearch(page, q, key);
      await watchButton(page).click();
      await closeDrawer(page);
    }
    await watchlistMode(page).click();
    const honse = watchRow(page, `solana:${HONSE}`);
    const weth = watchRow(page, `ethereum:${WETH.toLowerCase()}`);
    await expect(honse.getByTestId("watch-state")).toHaveText("LIVE");

    // Honse is no longer boosted, so it leaves the universe; its last real
    // observation is retained. The watchlist never fetches it on its own.
    provider.mode = "honse-gone";
    await expect
      .poll(
        async () => {
          await page.clock.runFor(60_000);
          return honse.getByTestId("watch-state").textContent();
        },
        { timeout: 120_000 },
      )
      .toBe("RETAINED");
    expect(requests.some((u) => u.includes(HONSE) && u.includes("/tokens/"))).toBe(true); // before
    await expect(honse).toContainText("LIQ $"); // last real observation, labelled RETAINED
    await expect(weth.getByTestId("watch-state")).toHaveText("LIVE");

    provider.mode = "down";
    await expect
      .poll(
        async () => {
          await page.clock.runFor(60_000);
          return weth.getByTestId("watch-state").textContent();
        },
        { timeout: 150_000 },
      )
      .toBe("STALE");
    await expect(weth).toContainText("LIQ $"); // last real data kept, labelled STALE

    // Watch / unwatch / mode switches issue no request.
    const before = await freeze(page, requests);
    for (const m of ["MOMENTUM", "RISK", "WATCHLIST", "MOMENTUM", "WATCHLIST"]) {
      await page.getByRole("button", { name: m, exact: true }).click();
    }
    expect(requests.slice(before)).toEqual([]);
    expect(problems).toEqual([]);
  });

  for (const [w, h] of [
    [1440, 900],
    [768, 1024],
    [375, 812],
  ] as const) {
    test(`layout ${w}: watchlist rows fit, no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      const { problems } = await setup(page);
      await openViaSearch(page, HONSE, `solana:${HONSE}`);
      await watchButton(page).click();
      await closeDrawer(page);
      await watchlistMode(page).click();
      const row = watchRow(page, `solana:${HONSE}`);
      await expect(row).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBe(0);
      const box = (await row.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(w);
      expect(problems).toEqual([]);
    });
  }
});
