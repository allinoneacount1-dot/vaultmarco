import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * GLOBAL SEARCH / Cmd-K — real app in a real browser.
 *
 * DexScreener is served from the recorded fixtures in tests/fixtures (the
 * same payloads the unit tests use); every other provider is aborted and
 * TradingView gets a test-only loader. Nothing here is live market data.
 */

const fx = (n: string) =>
  JSON.parse(readFileSync(new URL(`../tests/fixtures/${n}`, import.meta.url), "utf8"));
const BOOSTS = fx("dexscreener.boosts.latest.json");
const ADS = fx("dexscreener.ads.latest.json");
const PAIRS = fx("dexscreener.pairs.canonical.json") as Record<string, unknown>;
const TOKENS = fx("dexscreener.tokens.solana.json") as Array<{ baseToken: { symbol: string } }>;

/** Recorded mixed-case Solana address — case is identity. */
const HONSE = "46vV3ZpFNLZn1CDRYnAvqPsdW5ejEYn9GK9kPcZFpump";
const HERBA = "4nLMnQ6pfXZxarab6F8h1ETUDceSzUcLEjWhqHLCpump";
/** Recorded checksummed EVM address (canonical WETH pair). */
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

const TV = `(()=>{const s=document.currentScript;const w=s.parentElement.querySelector(".tradingview-widget-container__widget");const f=document.createElement("iframe");f.srcdoc="<body></body>";w.appendChild(f);})();`;

type Setup = {
  duplicate?: boolean;
  /** honse gets a buyer-dominant 5-minute window, so the radar fires EARLY MOMENTUM. */
  signal?: boolean;
  /** Flip `down` to make every DexScreener endpoint fail (complete provider outage). */
  provider?: { down: boolean };
};

async function setup(page: Page, opts: Setup = {}) {
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

  let tokens = opts.duplicate
    ? TOKENS.map((p, i) => (i === 1 ? { ...p, baseToken: { ...p.baseToken, symbol: "honse" } } : p))
    : TOKENS;
  if (opts.signal) {
    tokens = structuredClone(tokens) as typeof TOKENS;
    (tokens[0] as unknown as { txns: { m5: unknown } }).txns.m5 = { buys: 30, sells: 10 };
  }
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
    if (opts.provider?.down) return r.fulfill({ status: 503, body: "down" });
    const json = (x: unknown) =>
      r.fulfill({ contentType: "application/json", body: JSON.stringify(x) });
    if (u.includes("/token-boosts/")) return json(BOOSTS);
    if (u.includes("/ads/")) return json(ADS);
    if (u.includes("/tokens/v1/")) return json(u.includes("/solana/") ? tokens : []);
    if (u.includes("/latest/dex/pairs/")) {
      const chain = u.split("/latest/dex/pairs/")[1].split("/")[0];
      return json(PAIRS[chain] ?? { pairs: [] });
    }
    return r.abort();
  });

  await page.clock.install();
  await page.goto("/dashboard");
  // The pair universe has landed once the radar reports its universe size.
  await expect(page.getByText(/UNIVERSE \d+/).first()).toBeVisible({ timeout: 15_000 });
  // ...and its enrichment requests have finished.
  await page.waitForLoadState("networkidle");
  return { problems, requests };
}

const palette = (page: Page) => page.getByTestId("global-search");
const input = (page: Page) => palette(page).getByRole("combobox");
const options = (page: Page) => palette(page).getByRole("option");
const drawer = (page: Page) => page.getByTestId("token-drawer");
const trigger = (page: Page) => page.getByRole("button", { name: /search/i }).first();

/**
 * Pause page timers (no poll can fire), let anything in flight settle, and
 * return the request count to measure from.
 */
async function freeze(page: Page, requests: string[]) {
  // The page's Date.now() can trail the fake clock right after runFor(), so
  // step the pause target forward until it lands in the future. Anything a
  // fast-forward triggers settles below, before counting starts.
  for (const ahead of [1_000, 10_000, 60_000]) {
    try {
      await page.clock.pauseAt(await page.evaluate((a) => Date.now() + a, ahead));
      break;
    } catch (e) {
      if (!/past/.test(String(e)) || ahead === 60_000) throw e;
    }
  }
  // Startup retries of the (aborted) non-DEX providers may still be in
  // flight: wait until no new request has appeared for 1.5 s of real time.
  let seen = -1;
  while (seen !== requests.length) {
    seen = requests.length;
    await page.waitForTimeout(1_500);
  }
  return requests.length;
}

async function openPalette(page: Page) {
  await page.keyboard.press("ControlOrMeta+k");
  await expect(palette(page)).toBeVisible();
  await expect(input(page)).toBeFocused();
}

test.describe("Global Search / Cmd-K", () => {
  test("Ctrl+K and Cmd+K open, Esc closes, focus returns, no route change", async ({ page }) => {
    const { problems } = await setup(page);
    for (const combo of ["Control+k", "Meta+k"]) {
      await page.keyboard.press(combo);
      await expect(palette(page)).toBeVisible();
      await expect(input(page)).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(palette(page)).toHaveCount(0);
    }
    await trigger(page).click();
    await expect(input(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger(page)).toBeFocused();
    expect(new URL(page.url()).pathname).toBe("/dashboard");
    expect(problems).toEqual([]);
  });

  test("typing filters; Up/Down move the active option; Enter opens that token", async ({
    page,
  }) => {
    const { problems } = await setup(page);
    await openPalette(page);
    const all = await options(page).count();
    expect(all).toBeGreaterThan(3);

    await input(page).fill("honse");
    await expect(options(page)).toHaveCount(1);
    await expect(options(page).first()).toHaveAttribute("data-key", `solana:${HONSE}`);

    await input(page).fill("solana");
    const solana = await options(page).count();
    expect(solana).toBeGreaterThan(1);
    expect(solana).toBeLessThan(all);

    // Active option is exposed through aria-activedescendant and aria-selected.
    const active = () =>
      input(page).evaluate((el) => {
        const id = el.getAttribute("aria-activedescendant");
        return id ? document.getElementById(id)?.getAttribute("data-key") : null;
      });
    const keys = await options(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-key")),
    );
    expect(await active()).toBe(keys[0]);
    await page.keyboard.press("ArrowDown");
    expect(await active()).toBe(keys[1]);
    await expect(options(page).nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowUp");
    expect(await active()).toBe(keys[0]);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await expect(palette(page)).toHaveCount(0);
    await expect(drawer(page)).toHaveAttribute("data-key", keys[1]!);
    expect(new URL(page.url()).pathname).toBe("/dashboard");

    // Closing the drawer returns focus to the SEARCH control.
    await page.keyboard.press("Escape");
    await expect(drawer(page)).toHaveCount(0);
    await expect(trigger(page)).toBeFocused();
    expect(problems).toEqual([]);
  });

  test("Solana CA (exact case) → drawer shows the original CA; case-changed CA is unknown", async ({
    page,
  }) => {
    const { problems } = await setup(page);
    await openPalette(page);
    await input(page).fill(HONSE.toLowerCase());
    await expect(palette(page)).toContainText("NOT IN CURRENT MARCOVAULT UNIVERSE");
    await expect(options(page)).toHaveCount(0);

    await input(page).fill(HONSE);
    await expect(options(page)).toHaveCount(1);
    await options(page).first().click();
    await expect(drawer(page)).toHaveAttribute("data-key", `solana:${HONSE}`);
    await expect(drawer(page).getByTestId("contract-address")).toHaveText(HONSE);
    expect(problems).toEqual([]);
  });

  test("EVM CA in lower case → canonical match; drawer keeps the checksummed original", async ({
    page,
  }) => {
    const { problems } = await setup(page);
    await openPalette(page);
    await input(page).fill(WETH.toLowerCase());
    await expect(options(page)).toHaveCount(1);
    await expect(options(page).first()).toHaveAttribute(
      "data-key",
      `ethereum:${WETH.toLowerCase()}`,
    );
    await page.keyboard.press("Enter");
    await expect(drawer(page).getByTestId("contract-address")).toHaveText(WETH);
    expect(problems).toEqual([]);
  });

  test("duplicate symbols: both listed with chain + short CA, each opens its own asset", async ({
    page,
  }) => {
    const { problems } = await setup(page, { duplicate: true });
    for (const [address, n] of [
      [HONSE, 0],
      [HERBA, 1],
    ] as const) {
      await openPalette(page);
      await input(page).fill("honse");
      await expect(options(page)).toHaveCount(2);
      const row = palette(page).locator(`[data-key="solana:${address}"]`);
      await expect(row).toContainText(`${address.slice(0, 5)}…${address.slice(-4)}`);
      await expect(row).toContainText("SOL");
      await row.click();
      await expect(drawer(page)).toHaveAttribute("data-key", `solana:${address}`);
      await expect(drawer(page).getByTestId("contract-address")).toHaveText(address);
      await page.keyboard.press("Escape");
      await expect(drawer(page)).toHaveCount(0);
      expect(n).toBeGreaterThanOrEqual(0);
    }
    expect(problems).toEqual([]);
  });

  test("fast Enter: query A → immediately query B → Enter opens B, never A", async ({ page }) => {
    const { problems } = await setup(page);
    await openPalette(page);
    await input(page).fill("honse");
    await expect(options(page)).toHaveCount(1); // A is on screen
    await input(page).fill("herba");
    await page.keyboard.press("Enter"); // no wait between B and Enter
    await expect(drawer(page)).toHaveAttribute("data-key", `solana:${HERBA}`);
    await page.keyboard.press("Escape");
    await expect(drawer(page)).toHaveCount(0);

    // Harsher: replace the text and press Enter inside ONE task, before React
    // can re-render — Enter must still follow the text the input holds.
    await openPalette(page);
    await input(page).fill("herba");
    await expect(options(page)).toHaveCount(1); // A (herba) is on screen
    await input(page).evaluate((el: HTMLInputElement) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      set.call(el, "honse");
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    });
    await expect(drawer(page)).toHaveAttribute("data-key", `solana:${HONSE}`);
    expect(problems).toEqual([]);
  });

  test("unknown full address → immediate Enter opens nothing from the previous query", async ({
    page,
  }) => {
    const { problems, requests } = await setup(page);
    const before = await freeze(page, requests);
    await openPalette(page);
    await input(page).fill("honse");
    await expect(options(page)).toHaveCount(1);
    await input(page).fill("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin");
    await page.keyboard.press("Enter");
    await expect(drawer(page)).toHaveCount(0);
    // Same-task variant: "honse" is rendered, then the address replaces it and
    // Enter fires before React re-renders.
    await input(page).fill("honse");
    await expect(options(page)).toHaveCount(1);
    await input(page).evaluate((el: HTMLInputElement) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      set.call(el, "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin");
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    });
    await expect(palette(page)).toContainText("NOT IN CURRENT MARCOVAULT UNIVERSE");
    await expect(palette(page)).toBeVisible();
    await expect(drawer(page)).toHaveCount(0);
    expect(requests.slice(before)).toEqual([]);
    expect(problems).toEqual([]);
  });

  test("LIVE → complete provider failure → STALE while Search is open", async ({ page }) => {
    test.setTimeout(240_000); // fake-clock rounds are slow to simulate
    const provider = { down: false };
    const { problems, requests } = await setup(page, { signal: true, provider });
    await openPalette(page);
    await input(page).fill("honse");
    const row = palette(page).locator(`[data-key="solana:${HONSE}"]`);
    await expect(palette(page).getByTestId("search-status")).toHaveText("UNIVERSE LIVE");
    await expect(row).toBeVisible();
    await expect(row.getByTestId("temporal")).toHaveCount(0); // current, live
    await expect(row.getByText("EARLY MOMENTUM", { exact: true })).toBeVisible(); // fresh signal

    // Every DexScreener endpoint fails from now on; let the normal polls run.
    provider.down = true;
    await expect
      .poll(
        async () => {
          await page.clock.runFor(60_000); // one slow-lane round
          return palette(page).getByTestId("search-status").textContent();
        },
        { timeout: 150_000 },
      )
      .toBe("UNIVERSE STALE");

    // Still searchable, now visibly non-current; the old signal is history.
    await expect(row).toBeVisible();
    await expect(row.getByTestId("temporal")).toHaveText("STALE");
    await expect(row.getByText("EARLY MOMENTUM", { exact: true })).toHaveCount(0);
    await expect(row.getByTestId("last-signal")).toHaveText("LAST SIGNAL EARLY MOMENTUM");
    await expect(row).toContainText("LIQ"); // last real market data kept
    await input(page).fill("radar"); // radar = signals of the CURRENT round only
    await expect(options(page)).toHaveCount(0);

    // Typing while stale issues no request.
    const before = await freeze(page, requests);
    for (const q of ["h", "hon", "honse", HONSE, "solana", "boost"]) await input(page).fill(q);
    expect(requests.slice(before)).toEqual([]);

    // Search and Token Drawer agree.
    await page.clock.resume();
    await input(page).fill("honse");
    await page.keyboard.press("Enter");
    await expect(drawer(page)).toHaveAttribute("data-key", `solana:${HONSE}`);
    await expect(drawer(page).getByTestId("status")).toHaveText("STALE");
    await expect(drawer(page).getByTestId("signal-stale")).toBeVisible();
    await expect(drawer(page).getByTestId("contract-address")).toHaveText(HONSE);
    expect(problems).toEqual([]);
  });

  test("unknown full address → honest empty state, no request", async ({ page }) => {
    const { requests } = await setup(page);
    const before = await freeze(page, requests);
    await openPalette(page);
    await input(page).fill("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin");
    await expect(palette(page)).toContainText("NOT IN CURRENT MARCOVAULT UNIVERSE");
    await expect(options(page)).toHaveCount(0);
    expect(requests.slice(before)).toEqual([]);
  });

  test("open / type / close cycles issue zero network requests", async ({ page }) => {
    const { requests, problems } = await setup(page);
    // Freeze page timers so no scheduled poll can land inside the window.
    const before = await freeze(page, requests);
    for (let i = 0; i < 5; i++) {
      await openPalette(page);
      for (const q of [
        "h",
        "ho",
        "honse",
        "solana",
        "boost",
        "ads",
        "realtime",
        "radar",
        WETH,
        "",
      ]) {
        await input(page).fill(q);
      }
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Escape");
      await expect(palette(page)).toHaveCount(0);
    }
    expect(requests.slice(before)).toEqual([]);
    expect(problems).toEqual([]);
  });

  for (const [w, h] of [
    [1440, 900],
    [768, 1024],
    [375, 812],
  ] as const) {
    test(`layout ${w}: fits the viewport, readable rows, tap/click opens drawer`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: w, height: h });
      const { problems } = await setup(page);
      await trigger(page).click();
      await expect(input(page)).toBeFocused();
      const box = (await palette(page).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(w + 0.5);
      const overflow = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth - window.innerWidth,
        dialog: (() => {
          const d = document.querySelector('[data-testid="global-search"]')!;
          return d.scrollWidth - d.clientWidth;
        })(),
      }));
      expect(overflow).toEqual({ doc: 0, dialog: 0 });
      const rows = await options(page).evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return { h: r.height, right: r.right };
        }),
      );
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect(r.h).toBeGreaterThanOrEqual(44);
        expect(r.right).toBeLessThanOrEqual(w);
      }
      await input(page).fill("herba");
      await options(page).first().click();
      await expect(drawer(page)).toHaveAttribute("data-key", `solana:${HERBA}`);
      expect(new URL(page.url()).pathname).toBe("/dashboard");
      expect(problems).toEqual([]);
    });
  }
});
