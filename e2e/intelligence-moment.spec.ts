import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * THE MOMENT — real app, real browser. DexScreener is served from the
 * recorded fixtures in tests/fixtures; rounds are advanced with the fake
 * clock, and ONLY in tests do the mocks vary provider numbers between rounds
 * so a deterministic session history exists. Every other provider is aborted.
 */

const fx = (n: string) =>
  JSON.parse(readFileSync(new URL(`../tests/fixtures/${n}`, import.meta.url), "utf8"));
const BOOSTS = fx("dexscreener.boosts.latest.json");
const ADS = fx("dexscreener.ads.latest.json");
const PAIRS = fx("dexscreener.pairs.canonical.json") as Record<string, { pairs: Pair[] }>;
const TOKENS = fx("dexscreener.tokens.solana.json") as Pair[];

type Pair = Record<string, unknown> & {
  priceChange?: Record<string, number>;
  volume?: Record<string, number>;
};

const SOL = "So11111111111111111111111111111111111111112";
const HONSE = "46vV3ZpFNLZn1CDRYnAvqPsdW5ejEYn9GK9kPcZFpump";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const UNOBSERVED = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const SOL_URL = `/dashboard/moment?chain=solana&address=${SOL}`;
const SHOTS = process.env.MOMENT_SHOTS;

const TV = `(()=>{const s=document.currentScript;const w=s.parentElement.querySelector(".tradingview-widget-container__widget");const f=document.createElement("iframe");f.srcdoc="<body></body>";w.appendChild(f);})();`;

/** How the provider mock answers, mutable between rounds. */
type Mock = {
  /** Round index per chain (counted per request). */
  round: Record<string, number>;
  /** Override one canonical pair for a round (tests only). */
  pair?: (chain: string, round: number, p: Pair) => Pair | null;
  /** Whole-pairs-request failure mode. */
  pairsFail?: "429" | "timeout" | "malformed" | null;
  tokens?: (list: Pair[]) => Pair[];
  /** Hold every DexScreener response until released. */
  hold?: Promise<void>;
  /** Abort every DexScreener request. */
  down?: boolean;
};

/** SOL: flat first round, then +4.2 % over M5 with faster M5 volume (tests only). */
const solMove: Mock["pair"] = (chain, round, p) =>
  chain === "solana" && round >= 1
    ? {
        ...p,
        priceChange: { ...p.priceChange, m5: 4.2 },
        volume: { ...p.volume, m5: 500_000 },
      }
    : p;

async function setup(page: Page, path: string, mock: Partial<Mock> = {}, wait = true) {
  const m: Mock = { round: {}, ...mock };
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error" && msg.type() !== "warning") return;
    if (/Failed to load resource|net::ERR/.test(msg.text())) return;
    problems.push(`${msg.type()}: ${msg.text()}`);
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
  await page.route("https://api.dexscreener.com/**", async (r) => {
    if (m.hold) await m.hold;
    if (m.down) return r.abort();
    const u = r.request().url();
    const json = (x: unknown) =>
      r.fulfill({ contentType: "application/json", body: JSON.stringify(x) });
    if (u.includes("/token-boosts/")) return json(BOOSTS);
    if (u.includes("/ads/")) return json(ADS);
    if (u.includes("/tokens/v1/")) {
      const list = u.includes("/solana/") ? TOKENS : [];
      return json(m.tokens ? m.tokens(list) : list);
    }
    if (u.includes("/latest/dex/pairs/")) {
      if (m.pairsFail === "429") return r.fulfill({ status: 429, body: "rate limited" });
      if (m.pairsFail === "timeout") return r.abort("timedout");
      if (m.pairsFail === "malformed") {
        return r.fulfill({ contentType: "application/json", body: '{"pairs":[{"chainId":' });
      }
      const chain = u.split("/latest/dex/pairs/")[1].split("/")[0];
      const n = (m.round[chain] = (m.round[chain] ?? -1) + 1);
      const base = PAIRS[chain]?.pairs[0];
      if (!base) return json({ pairs: [] });
      const p = m.pair ? m.pair(chain, n, base) : base;
      return json({ pairs: p ? [p] : [] });
    }
    return r.abort();
  });
  // A fixed, realistic session date (the fixtures' pools were created before it).
  await page.clock.install({ time: new Date("2026-09-27T12:00:00Z") });
  await page.goto(path);
  if (wait) {
    await expect(page.getByTestId("desk-status")).toHaveAttribute("data-state", /live|degraded/, {
      timeout: 15_000,
    });
  }
  return { problems, mock: m };
}

/** Advance whole fast-lane rounds (30 s each) and let each round land. */
async function rounds(page: Page, m: Mock, n: number) {
  for (let i = 0; i < n; i++) {
    const before = m.round.solana ?? -1;
    // The lane's next timer starts when the previous response lands, so a
    // jump taken before that can fall short: jump again until a request goes out.
    for (let tries = 0; (m.round.solana ?? -1) <= before; tries++) {
      expect(tries, "fast-lane round did not start").toBeLessThan(5);
      await page.clock.fastForward(30_000);
      const deadline = Date.now() + 3_000;
      while ((m.round.solana ?? -1) <= before && Date.now() < deadline) {
        await page.waitForTimeout(100);
      }
    }
    await page.waitForTimeout(600); // let the round's responses land and render
  }
}

const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  // The app's first-visit preloader overlays the page: wait until it has left.
  await expect(page.locator("div.fixed.inset-0[aria-hidden]")).toHaveCount(0, { timeout: 15_000 });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};

async function noHorizontalOverflow(page: Page) {
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (over > 0) {
    const offenders = await page.evaluate(() =>
      [...document.querySelectorAll("*")]
        .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
        .slice(0, 12)
        .map(
          (el) =>
            `${el.tagName}.${String(el.className).slice(0, 80)} r=${Math.round(el.getBoundingClientRect().right)} :: ${(el.textContent ?? "").slice(0, 50)}`,
        ),
    );
    console.log(offenders.join("\n"));
  }
  expect(over).toBeLessThanOrEqual(0);
}

test.describe("The Moment", () => {
  test("populated: active changes with rule, onset and time; summaries link out with the same identity", async ({
    page,
  }, info) => {
    const { problems, mock } = await setup(page, SOL_URL, { pair: solMove });
    await rounds(page, mock, 3);

    const header = page.getByTestId("moment-header");
    await expect(header).toContainText("PRICE USD");
    await expect(header).toContainText("+4.20%");
    await expect(page.getByTestId("moment-state")).toContainText("LIVE");
    await expect(page.getByTestId("moment-state")).toContainText("OBSERVED");
    await expect(header).toContainText("OBSERVED POOL");

    const priceRow = page.locator('[data-testid="moment-change"][data-type="PRICE_EXPANSION"]');
    await expect(priceRow).toHaveAttribute("data-onset", "OBSERVED");
    await expect(priceRow.getByTestId("change-value")).toHaveText("+4.20%");
    await expect(priceRow.getByTestId("change-rule")).toContainText("PRICE_EXPANSION_M5_PCT ≥ 3%");
    await expect(priceRow.getByTestId("change-rule")).toContainText("HORIZON");
    await expect(priceRow.getByTestId("change-onset")).toHaveText(/ONSET OBSERVED/);
    await expect(priceRow.locator("time").first()).toHaveAttribute("datetime", /T/);
    const va = page.locator('[data-testid="moment-change"][data-type="VOLUME_ACCELERATION"]');
    await expect(va.getByTestId("change-rule")).toContainText("VOLUME_ACCELERATION_MIN ≥ 3×");
    // Buys > sells already held at the first observation: its start was not seen.
    const bp = page.locator('[data-testid="moment-change"][data-type="BUY_SELL_IMBALANCE"]');
    await expect(bp).toHaveAttribute("data-onset", "IN_PROGRESS_WHEN_OBSERVED");
    await expect(bp).toContainText("BUYS > SELLS");

    await expect(page.getByTestId("moment-first").locator("li")).not.toHaveCount(0);
    await expect(page.getByTestId("moment-edge-age")).toHaveText(/^\d\dm \d\ds$/);
    await expect(page.getByTestId("moment-divergence-counts")).toContainText("NOT EVALUABLE");
    await expect(page.getByTestId("moment-collision-count")).toHaveText(/\d FAMIL(Y|IES) \/ /);

    // No score / prediction vocabulary anywhere on the page.
    const text = await page.getByTestId("moment").innerText();
    expect(text).not.toMatch(/bullish|bearish|confidence|score|prediction|top pick/i);
    await noHorizontalOverflow(page);

    if (info.project.name === "desktop") {
      await shot(page, "moment-1440-populated");
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(400);
      await noHorizontalOverflow(page);
      await shot(page, "moment-375-populated");
      await page.setViewportSize({ width: 1440, height: 900 });
    }

    // Cross-flow: each summary opens its view with the same chain + address (and no pair).
    for (const [id, path] of [
      ["moment-link-trace", "/dashboard/trace"],
      ["moment-link-edge-clock", "/dashboard/edge-clock"],
      ["moment-link-divergence", "/dashboard/divergence"],
      ["moment-link-collision", "/dashboard/collision"],
    ] as const) {
      await page.getByTestId(id).click();
      await expect(page).toHaveURL(new RegExp(`${path}\\?`));
      const url = new URL(page.url());
      expect(url.searchParams.get("chain")).toBe("solana");
      expect(url.searchParams.get("address")).toBe(SOL);
      expect(url.searchParams.has("pair")).toBe(false);
      await page.goBack();
      await expect(page.getByTestId("moment")).toBeVisible();
    }
    expect(problems).toEqual([]);
  });

  test("Token Drawer → OPEN IN THE MOMENT lands on the asset's evidence", async ({ page }) => {
    const { problems } = await setup(page, "/dashboard");
    await page.keyboard.press("ControlOrMeta+k");
    await page.getByTestId("global-search").getByRole("combobox").fill(HONSE);
    await page.keyboard.press("Enter");
    const drawer = page.getByTestId("token-drawer");
    await expect(drawer).toHaveAttribute("data-key", `solana:${HONSE}`);
    await drawer.getByTestId("open-moment").click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/moment\\?.*address=${HONSE}`));
    expect(page.url()).not.toContain("pair=");
    await expect(page.getByTestId("asset-bar")).toHaveAttribute("data-key", `solana:${HONSE}`);
    await expect(page.getByTestId("moment")).toBeVisible();
    await expect(page.getByTestId("moment-header")).toContainText("honse");
    await expect(page.getByTestId("moment-changes")).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("no selection: a prompt and observed assets with events, newest first; picking sets the URL identity", async ({
    page,
  }, info) => {
    const { problems, mock } = await setup(page, "/dashboard/moment", { pair: solMove });
    await expect(page.getByTestId("moment-no-selection")).toContainText("SELECT AN ASSET");
    await expect(page.getByTestId("intel-empty")).toHaveText("—");
    await rounds(page, mock, 2);
    const picks = page.getByTestId("moment-pick");
    await expect(picks.first()).toBeVisible();
    await expect(page.getByTestId("moment-picker")).toContainText("NOT A RANKING");
    if (info.project.name === "desktop") await shot(page, "moment-no-selection");
    const key = await picks.first().getAttribute("data-key");
    await picks.first().click();
    await expect(page.getByTestId("asset-bar")).toHaveAttribute("data-key", key!);
    const url = new URL(page.url());
    expect(
      `${url.searchParams.get("chain")}:${url.searchParams.get("address")}`.toLowerCase(),
    ).toBe(key!.toLowerCase());
    await expect(page.getByTestId("moment")).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("an unobserved address is NOT IN OBSERVED UNIVERSE with every metric —; a symbol is rejected", async ({
    page,
  }, info) => {
    const { problems } = await setup(page, `/dashboard/moment?chain=solana&address=${UNOBSERVED}`);
    const box = page.getByTestId("moment-no-observation");
    await expect(box).toHaveAttribute("data-state", "unobserved");
    await expect(box).toContainText("NOT IN OBSERVED UNIVERSE");
    await expect(box.locator("dd")).toHaveText(["—", "—", "—", "—"]);
    if (info.project.name === "desktop") await shot(page, "moment-not-in-universe");
    await page.goto("/dashboard/moment?chain=solana&address=SOL");
    await expect(page.getByTestId("focus-identity")).toContainText("ASSET IN URL REJECTED");
    await expect(page.getByTestId("moment-no-selection")).toContainText("REJECTED");
    expect(problems).toEqual([]);
  });

  test("CONNECTING before the first round, then evidence", async ({ page }) => {
    let release!: () => void;
    const hold = new Promise<void>((r) => (release = r));
    const { mock } = await setup(page, SOL_URL, { hold }, false);
    const box = page.getByTestId("moment-no-observation");
    await expect(box).toHaveAttribute("data-state", "loading");
    await expect(box).toContainText("CONNECTING");
    release();
    mock.hold = undefined;
    await expect(page.getByTestId("moment")).toBeVisible({ timeout: 15_000 });
  });

  test("OFFLINE when no provider round ever succeeds (no fallback)", async ({ page }) => {
    await setup(page, SOL_URL, { down: true }, false);
    for (let i = 0; i < 4; i++) await page.clock.fastForward(5_000);
    const box = page.getByTestId("moment-no-observation");
    await expect(box).toHaveAttribute("data-state", "offline", { timeout: 15_000 });
    await expect(box).toContainText("OFFLINE");
    await expect(page.getByTestId("moment-header")).toHaveCount(0);
  });

  test("429 / timeout / malformed make the asset STALE (last known, labelled); a new observation recovers it", async ({
    page,
  }, info) => {
    const { problems, mock } = await setup(page, SOL_URL, { pair: solMove });
    await rounds(page, mock, 2);
    await expect(page.getByTestId("moment-state")).toContainText("LIVE");
    for (const mode of ["429", "timeout", "malformed"] as const) {
      mock.pairsFail = mode;
      await page.clock.fastForward(30_000);
      await page.clock.fastForward(5_000); // the query's one retry
      await expect(page.getByTestId("moment")).toHaveAttribute("data-state", "stale", {
        timeout: 10_000,
      });
      await expect(page.getByTestId("moment-notice")).toContainText("STALE");
      // The last real price stays, labelled STALE — never blanked, never relabelled fresh.
      await expect(page.getByTestId("moment-header")).toContainText("+4.20%");
      if (mode === "429" && info.project.name === "desktop") await shot(page, "moment-stale");
      // Only a NEW observation brings it back.
      mock.pairsFail = null;
      await rounds(page, mock, 1);
      await expect(page.getByTestId("moment")).toHaveAttribute("data-state", "live", {
        timeout: 10_000,
      });
    }
    expect(problems).toEqual([]);
  });

  test("one canonical pair missing: the others are DEGRADED, the missing one is STALE", async ({
    page,
  }, info) => {
    const { problems, mock } = await setup(page, SOL_URL, {
      pair: (chain, round, p) => (chain === "ethereum" && round >= 1 ? null : p),
    });
    await rounds(page, mock, 1);
    await expect(page.getByTestId("moment")).toHaveAttribute("data-state", "degraded", {
      timeout: 10_000,
    });
    await expect(page.getByTestId("moment-notice")).toContainText("DEGRADED");
    if (info.project.name === "desktop") await shot(page, "moment-degraded");
    // In-app selection (same session): the pair the provider stopped resolving.
    await page.getByTestId("select-asset").click();
    await page.getByRole("dialog").getByRole("combobox").fill(WETH);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("asset-bar")).toHaveAttribute(
      "data-key",
      `ethereum:${WETH.toLowerCase()}`,
    );
    await expect(page.getByTestId("moment")).toHaveAttribute("data-state", "stale", {
      timeout: 10_000,
    });
    await expect(page.getByTestId("moment-notice")).toContainText("DID NOT RESOLVE");
    expect(problems).toEqual([]);
  });

  test("zeros are data, missing windows are —", async ({ page }) => {
    const { problems, mock } = await setup(page, SOL_URL, {
      pair: (chain, round, p) =>
        chain !== "solana"
          ? p
          : round === 0
            ? { ...p, priceChange: { h1: 0, h6: 0, h24: 0, m5: 0 } }
            : { ...p, priceChange: { h24: 1 } },
    });
    const header = page.getByTestId("moment-header");
    await expect(header).toContainText("0.00%");
    await rounds(page, mock, 1);
    await expect(header.getByText("—").first()).toBeVisible();
    await expect(header).not.toContainText("0.00%");
    expect(problems).toEqual([]);
  });

  test("an asset that vanishes from the universe goes STALE on its retained evidence", async ({
    page,
  }) => {
    const { problems, mock } = await setup(page, `/dashboard/moment?chain=solana&address=${HONSE}`);
    await expect(page.getByTestId("moment")).toHaveAttribute("data-state", "live");
    mock.tokens = (list) =>
      list.filter((p) => (p.baseToken as { address: string }).address !== HONSE);
    await rounds(page, mock, 4);
    await expect(page.getByTestId("moment")).toHaveAttribute("data-state", "stale", {
      timeout: 10_000,
    });
    await expect(page.getByTestId("moment-header")).toContainText("honse");
    expect(problems).toEqual([]);
  });

  test("refresh keeps the asset; back/forward restore selection and no-selection", async ({
    page,
  }) => {
    const { problems } = await setup(page, "/dashboard/moment");
    await expect(page.getByTestId("moment-no-selection")).toBeVisible();
    await page.goto(SOL_URL);
    await expect(page.getByTestId("moment")).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.getByTestId("asset-bar")).toHaveAttribute("data-key", `solana:${SOL}`);
    await expect(page.getByTestId("moment")).toBeVisible({ timeout: 15_000 });
    await page.goBack();
    await expect(page.getByTestId("moment-no-selection")).toBeVisible();
    await page.goForward();
    await expect(page.getByTestId("asset-bar")).toHaveAttribute("data-key", `solana:${SOL}`);
    expect(problems).toEqual([]);
  });
});
