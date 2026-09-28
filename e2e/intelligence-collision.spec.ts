import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";

/**
 * COLLISION (/dashboard/collision) — real app, real browser.
 *
 * The focus asset is a real feed token (HONSE, solana) observed by the
 * universe lane (60 s) through /tokens/v1. Between rounds the TEST varies
 * individual provider fields of its captured payload — and, for the pool
 * switch, its reported pairAddress — then advances the fake clock one round,
 * so the page reads a deterministic session history.
 */

const fx = (n: string) =>
  JSON.parse(readFileSync(new URL(`../tests/fixtures/${n}`, import.meta.url), "utf8"));
const BOOSTS = fx("dexscreener.boosts.latest.json");
const ADS = fx("dexscreener.ads.latest.json");
const PAIRS = fx("dexscreener.pairs.canonical.json") as Record<string, unknown>;
const TOKENS = fx("dexscreener.tokens.solana.json") as Pair[];

type Pair = Record<string, unknown> & {
  baseToken: { address: string };
  pairAddress: string;
};

const HONSE = "46vV3ZpFNLZn1CDRYnAvqPsdW5ejEYn9GK9kPcZFpump";
const URL_HONSE = `/dashboard/collision?chain=solana&address=${HONSE}`;
const HONSE_PAIR = TOKENS.find((p) => p.baseToken.address === HONSE)!;
const POOL_A = HONSE_PAIR.pairAddress;
/** Test-only second pool for the same token (a pool switch between rounds). */
const POOL_B = "HoNSEpooLB1111111111111111111111111111111111";

const TV = `(()=>{const s=document.currentScript;const w=s.parentElement.querySelector(".tradingview-widget-container__widget");const f=document.createElement("iframe");f.srcdoc="<body></body>";w.appendChild(f);})();`;

/** Screenshots are written only when a directory is given (QA runs); layout checks always run. */
const SHOTS = process.env.INTEL_SHOTS_DIR;

type Over = {
  pairAddress?: string;
  priceChange?: Record<string, number>;
  volume?: Record<string, number>;
  txns?: Record<string, { buys: number; sells: number }>;
};

/** Calm HONSE: no price expansion, no acceleration, balanced m5 trades. */
const CALM: Over = {
  priceChange: { m5: 0.5 },
  volume: { m5: 50 },
  txns: { m5: { buys: 2, sells: 2 } },
};
const PRICE_UP: Over = { ...CALM, priceChange: { m5: 5 } };
const ACTIVITY: Over = {
  volume: { m5: 3_000 },
  txns: { m5: { buys: 30, sells: 10 } },
};

function honse(over: Over): Pair {
  const p = structuredClone(HONSE_PAIR) as Pair & Record<string, Record<string, unknown>>;
  if (over.pairAddress) p.pairAddress = over.pairAddress;
  for (const k of ["priceChange", "volume", "txns"] as const) {
    if (over[k]) p[k] = { ...p[k], ...over[k] };
  }
  return p;
}

type Mock = { honse: Pair | "429" };

async function setup(page: Page, path: string, mock: Mock) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    if (/Failed to load resource|net::ERR/.test(m.text())) return;
    problems.push(`${m.type()}: ${m.text()}`);
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
    const json = (x: unknown) =>
      r.fulfill({ contentType: "application/json", body: JSON.stringify(x) });
    if (u.includes("/token-boosts/")) return json(BOOSTS);
    if (u.includes("/ads/")) return json(ADS);
    if (u.includes("/tokens/v1/")) {
      if (!u.includes("/solana/")) return json([]);
      if (mock.honse === "429") return r.fulfill({ status: 429, body: "rate limited" });
      const h = mock.honse;
      return json(TOKENS.map((p) => (p.baseToken.address === HONSE ? h : p)));
    }
    if (u.includes("/latest/dex/pairs/")) {
      const chain = u.split("/latest/dex/pairs/")[1].split("/")[0];
      return json(PAIRS[chain] ?? { pairs: [] });
    }
    return r.abort();
  });
  // The once-per-session vault-door intro runs on timers the fake clock holds; skip it.
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("mv_seen", "1");
    } catch {
      /* storage blocked: the intro is skipped anyway */
    }
  });
  await page.clock.install();
  await page.goto(path);
  await expect(page.getByTestId("desk-status")).toHaveAttribute("data-state", /live|degraded/, {
    timeout: 15_000,
  });
  return { problems };
}

/** Advance one universe round (60 s) and wait until the page holds a NEWER observation. */
async function round(page: Page) {
  const box = page.getByTestId("collision");
  const before = Number(await box.getAttribute("data-observed-at"));
  await page.clock.fastForward(60_000);
  await expect
    .poll(async () => Number(await box.getAttribute("data-observed-at")), { timeout: 10_000 })
    .toBeGreaterThan(before);
}

async function shot(page: Page, info: TestInfo, name: string, width = 1440) {
  if (info.project.name !== "desktop") return;
  await page.setViewportSize({ width, height: width < 600 ? 812 : 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      { message: `${name}: no horizontal overflow`, timeout: 5_000 },
    )
    .toBeLessThanOrEqual(0);
  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

const family = (page: Page, f: string) =>
  page.locator(`[data-testid="collision-family"][data-family="${f}"]`);

test.describe("Collision — what changed together?", () => {
  test("active: N independent families / real span; one family row per family; coincidence, not causality", async ({
    page,
  }, info) => {
    const mock: Mock = { honse: honse(CALM) };
    const { problems } = await setup(page, URL_HONSE, mock);
    await expect(page.getByTestId("intel-question")).toHaveText("What changed together?");
    await expect(page.getByTestId("collision")).toBeVisible();
    mock.honse = honse(PRICE_UP);
    await round(page);
    mock.honse = honse({ ...PRICE_UP, ...ACTIVITY });
    await round(page);

    const box = page.getByTestId("collision");
    await expect(box).toHaveAttribute("data-collision", "true");
    const n = Number(await box.getAttribute("data-count"));
    expect(n).toBeGreaterThanOrEqual(3);
    // Span = first family onset (PRICE, round 1) → last family onset (round 2): one round.
    await expect(page.getByTestId("collision-headline")).toHaveText(
      new RegExp(`^${n} CHANGES / 01m 0\\ds$`),
    );
    await expect(page.getByTestId("collision-disclaimer")).toHaveText(
      "COINCIDENCE WINDOW · NOT CAUSALITY · NOT CONFIDENCE",
    );
    await expect(page.getByTestId("collision-window")).toContainText("05m 00s");
    await expect(page.getByTestId("collision-pool")).toContainText(POOL_A.slice(0, 4));

    // Families are distinct; several events of one family sit under ONE row.
    const fams = await page
      .getByTestId("collision-family")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-family")));
    expect(new Set(fams).size).toBe(fams.length);
    expect(fams.length).toBe(n);
    expect(fams).toEqual(expect.arrayContaining(["PRICE", "VOLUME", "TRANSACTIONS"]));
    const tx = family(page, "TRANSACTIONS");
    await expect(tx.getByTestId("collision-event")).toHaveCount(2);
    await expect(tx).toContainText("2 EVENTS · ONE FAMILY");
    await expect(family(page, "PRICE")).toContainText("PRICE EXPANSION");
    await expect(family(page, "PRICE")).toContainText("+5.00%");
    await expect(family(page, "PRICE")).toContainText("ONSET OBSERVED");
    await expect(family(page, "PRICE").locator("time").first()).toHaveAttribute("datetime", /Z$/);
    await expect(page.getByTestId("collision-pool-switch")).toHaveCount(0);
    await expect(box).not.toContainText(/caused|bull|bear|predict/i);

    await shot(page, info, "collision-active-1440");
    await shot(page, info, "collision-active-375", 375);

    // Duplicate rounds (identical payload): the collision does not grow.
    await round(page);
    await expect(box).toHaveAttribute("data-count", String(n));
    expect(problems).toEqual([]);
  });

  test("none: calm rounds → NO COLLISION IN THE LAST 05m 00s; a single family is still listed", async ({
    page,
  }, info) => {
    const mock: Mock = { honse: honse(CALM) };
    const { problems } = await setup(page, URL_HONSE, mock);
    await round(page);
    await expect(page.getByTestId("collision-headline")).toHaveText(
      "NO COLLISION IN THE LAST 05m 00s",
    );
    await expect(page.getByTestId("collision-families-empty")).toBeVisible();

    mock.honse = honse(PRICE_UP);
    await round(page);
    await expect(page.getByTestId("collision-headline")).toHaveText(
      "NO COLLISION IN THE LAST 05m 00s",
    );
    await expect(page.getByTestId("collision")).toHaveAttribute("data-collision", "false");
    await expect(page.getByTestId("collision-family")).toHaveCount(1);
    await expect(family(page, "PRICE")).toBeVisible();
    await expect(page.getByTestId("collision-disclaimer")).toBeVisible();
    await shot(page, info, "collision-none-1440");
    expect(problems).toEqual([]);
  });

  test("pool switch inside the window: pools are never combined, and the page says what was left out", async ({
    page,
  }) => {
    const mock: Mock = { honse: honse(CALM) };
    const { problems } = await setup(page, URL_HONSE, mock);
    mock.honse = honse(PRICE_UP); // pool A: PRICE
    await round(page);
    mock.honse = honse({ ...CALM, pairAddress: POOL_B }); // switch, calm
    await round(page);
    mock.honse = honse({ ...CALM, ...ACTIVITY, pairAddress: POOL_B }); // pool B: VOLUME + TXNS
    await round(page);

    await expect(page.getByTestId("collision-pool")).toContainText(POOL_B.slice(0, 4));
    await expect(family(page, "PRICE")).toHaveCount(0);
    await expect(family(page, "VOLUME")).toBeVisible();
    const note = page.getByTestId("collision-pool-switch");
    await expect(note).toContainText("POOL SWITCH · 1 EVENT IN THIS WINDOW OBSERVED ON");
    await expect(note).toContainText(POOL_A.slice(0, 4));
    await expect(note).toContainText("NEVER COMBINED");
    // Every listed event is on pool B.
    const pools = await page
      .getByTestId("collision-event")
      .evaluateAll((els) => els.map((e) => e.textContent ?? ""));
    for (const t of pools) expect(t).not.toContain(POOL_A.slice(0, 4));
    expect(problems).toEqual([]);
  });

  test("stale: the feed stops delivering the asset (429 on enrichment) → STALE, evidence kept, never refreshed", async ({
    page,
  }, info) => {
    const mock: Mock = { honse: honse(CALM) };
    const { problems } = await setup(page, URL_HONSE, mock);
    mock.honse = honse({ ...PRICE_UP, ...ACTIVITY });
    await round(page);
    const box = page.getByTestId("collision");
    const observed = await box.getAttribute("data-observed-at");
    const count = await box.getAttribute("data-count");
    mock.honse = "429";
    await page.clock.fastForward(60_000);
    await page.clock.fastForward(60_000);
    await expect(page.getByTestId("evidence-status")).toHaveAttribute("data-state", "stale");
    await expect(page.getByTestId("focus-freshness")).toHaveAttribute("data-state", "stale");
    await expect(box).toHaveAttribute("data-observed-at", observed!);
    await expect(box).toHaveAttribute("data-count", count!);
    await shot(page, info, "collision-stale-1440");
    expect(problems).toEqual([]);
  });

  test("no selection and not-in-universe never show evidence; THE MOMENT link carries the asset", async ({
    page,
  }) => {
    const { problems } = await setup(page, "/dashboard/collision", { honse: honse(CALM) });
    await expect(page.getByTestId("intel-empty")).toHaveAttribute("data-state", "none");
    await expect(page.getByTestId("collision")).toHaveCount(0);
    await page.goto(
      "/dashboard/collision?chain=solana&address=9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    );
    await expect(page.getByTestId("desk-status")).toHaveAttribute("data-state", /live|degraded/, {
      timeout: 15_000,
    });
    await expect(page.getByTestId("intel-empty")).toHaveAttribute("data-state", "unobserved");

    await page.goto(URL_HONSE);
    await expect(page.getByTestId("collision")).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.getByTestId("asset-bar")).toHaveAttribute("data-key", `solana:${HONSE}`);
    await page.getByTestId("back-to-moment").click();
    // Base58 case is kept exactly.
    await expect(page).toHaveURL(new RegExp(`/dashboard/moment\\?.*address=${HONSE}`));
    await page.goBack();
    await expect(page.getByTestId("intel-question")).toHaveText("What changed together?");
    expect(problems).toEqual([]);
  });
});
