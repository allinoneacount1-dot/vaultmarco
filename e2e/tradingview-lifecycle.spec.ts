import { test, expect, type Page } from "@playwright/test";

/**
 * TradingView chart load lifecycle — real component in a real browser.
 *
 * TradingView's CDN is replaced by a TEST-ONLY loader that follows the
 * official embed contract (reads its config from the script tag, renders an
 * iframe into the inner `.tradingview-widget-container__widget`). Its
 * behaviour is chosen per test through `window.__TV_MODE`:
 *   load  — insert an iframe that loads normally
 *   none  — insert nothing (network/CDN never responds)
 *   error — insert an iframe that reports an error
 *
 * Page timers are faked with `page.clock`, so the 20 s load timeout is
 * crossed explicitly rather than waited out.
 */

const LOADER = `(() => {
  const s = document.currentScript;
  const cfg = JSON.parse(s.innerHTML);
  const widget = s.parentElement.querySelector(".tradingview-widget-container__widget");
  const mode = window.__TV_MODE || "load";
  if (mode === "none") return;
  const f = document.createElement("iframe");
  f.dataset.symbol = cfg.symbol;
  f.style.cssText = "width:100%;height:100%;border:0;display:block";
  if (mode === "error") {
    widget.appendChild(f);
    // After the component's MutationObserver has attached its listeners.
    Promise.resolve().then(() => Promise.resolve()).then(() => f.dispatchEvent(new Event("error")));
    return;
  }
  f.srcdoc = '<body style="margin:0;background:' + cfg.backgroundColor + '"></body>';
  widget.appendChild(f);
})();`;

const OVER_TIMEOUT_MS = 25_000; // LOAD_TIMEOUT_MS is 20 000

async function setup(page: Page, mode: "load" | "none" | "error") {
  await page.addInitScript((m) => {
    (window as unknown as { __TV_MODE: string }).__TV_MODE = m;
  }, mode);
  await page.route("https://s3.tradingview.com/**", (r) =>
    r.fulfill({ contentType: "application/javascript", body: LOADER }),
  );
  // No live providers in this test: the chart lifecycle is the subject.
  for (const host of [
    "https://api.dexscreener.com/**",
    "https://api.coingecko.com/**",
    "https://api.alternative.me/**",
    "https://beaconcha.in/**",
  ]) {
    await page.route(host, (r) => r.abort());
  }
  await page.clock.install();
  await page.goto("/dashboard");
}

const chart = (page: Page) =>
  page.locator("[data-status]").filter({
    has: page.locator(".tradingview-widget-container"),
  });
const status = (page: Page) => chart(page).getAttribute("data-status");
const fallback = (page: Page) => chart(page).locator('[role="alert"]');
const counts = (page: Page) =>
  page.evaluate(() => ({
    scripts: document.querySelectorAll('script[src*="embed-widget-advanced-chart"]').length,
    iframes: document.querySelectorAll(".tradingview-widget-container iframe").length,
    symbol:
      (document.querySelector(".tradingview-widget-container iframe") as HTMLIFrameElement | null)
        ?.dataset.symbol ?? null,
  }));
const assetButton = (page: Page, id: string) =>
  page.getByRole("group", { name: "Select asset" }).getByRole("button", { name: id, exact: true });

test.describe("TradingView load lifecycle", () => {
  test("READY survives past the 20 s timeout, across BTC → ETH → SOL → BNB → BTC", async ({
    page,
  }) => {
    test.setTimeout(180_000); // five symbols × 25 s of fake page time
    await setup(page, "load");
    for (const id of ["BTC", "ETH", "SOL", "BNB", "BTC"]) {
      if (id !== "BTC" || (await status(page)) !== null) await assetButton(page, id).click();
      await expect.poll(() => status(page)).toBe("ready");
      const before = await counts(page);
      expect(before).toEqual({ scripts: 1, iframes: 1, symbol: `BINANCE:${id}USDT` });

      await page.clock.runFor(OVER_TIMEOUT_MS);

      expect(await status(page)).toBe("ready");
      await expect(fallback(page)).toHaveCount(0);
      expect(await counts(page)).toEqual(before);
      await expect(page.getByText("Track all markets on TradingView")).toBeVisible();
    }
  });

  test("no iframe → ERROR at the timeout, fallback shown, attribution kept", async ({ page }) => {
    await setup(page, "none");
    await page.clock.runFor(19_000);
    expect(await status(page)).toBe("loading");
    await page.clock.runFor(1_500);
    await expect.poll(() => status(page)).toBe("error");
    await expect(fallback(page)).toBeVisible();
    await expect(page.getByText("Track all markets on TradingView")).toBeVisible();
    await page.clock.runFor(OVER_TIMEOUT_MS);
    expect(await status(page)).toBe("error");
  });

  test("iframe error → ERROR, and it stays ERROR past the timeout", async ({ page }) => {
    await setup(page, "error");
    await expect.poll(() => status(page)).toBe("error");
    await page.clock.runFor(OVER_TIMEOUT_MS);
    expect(await status(page)).toBe("error");
    await expect(fallback(page)).toBeVisible();
  });

  test("late iframe load after the timeout cannot overwrite ERROR", async ({ page }) => {
    await setup(page, "none");
    await page.clock.runFor(OVER_TIMEOUT_MS);
    await expect.poll(() => status(page)).toBe("error");
    // The iframe finally arrives and loads.
    await page.evaluate(() => {
      const w = document.querySelector(".tradingview-widget-container__widget")!;
      const f = document.createElement("iframe");
      f.srcdoc = "<body></body>";
      w.appendChild(f);
    });
    await page.waitForFunction(() => {
      const f = document.querySelector(".tradingview-widget-container iframe") as HTMLIFrameElement;
      return f?.contentDocument?.readyState === "complete";
    });
    expect(await status(page)).toBe("error");
    await expect(fallback(page)).toBeVisible();
  });

  test("switching away from a chart that is still loading clears its timeout", async ({ page }) => {
    await setup(page, "none"); // BTC never loads
    await page.clock.runFor(10_000);
    await page.evaluate(() => {
      (window as unknown as { __TV_MODE: string }).__TV_MODE = "load";
    });
    await assetButton(page, "ETH").click(); // BTC unmounts
    await expect.poll(() => status(page)).toBe("ready");
    await page.clock.runFor(OVER_TIMEOUT_MS); // BTC's original 20 s deadline passes
    expect(await status(page)).toBe("ready");
    await expect(fallback(page)).toHaveCount(0);
    expect(await counts(page)).toEqual({ scripts: 1, iframes: 1, symbol: "BINANCE:ETHUSDT" });
  });
});
