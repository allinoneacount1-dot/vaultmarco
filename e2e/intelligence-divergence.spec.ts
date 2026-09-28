import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";

/**
 * DIVERGENCE (/dashboard/divergence) — real app, real browser.
 *
 * DexScreener is served from the recorded fixtures in tests/fixtures. Between
 * rounds the TEST varies individual provider fields of the real WETH/USDT
 * payload (the focus asset, realtime lane, 30 s) and advances the fake clock,
 * so the page evaluates a deterministic session history. Every other provider
 * is aborted; TradingView gets a test-only loader.
 */

const fx = (n: string) =>
  JSON.parse(readFileSync(new URL(`../tests/fixtures/${n}`, import.meta.url), "utf8"));
const BOOSTS = fx("dexscreener.boosts.latest.json");
const ADS = fx("dexscreener.ads.latest.json");
const PAIRS = fx("dexscreener.pairs.canonical.json") as Record<string, { pairs: Pair[] }>;
const TOKENS = fx("dexscreener.tokens.solana.json");

type Pair = Record<string, unknown> & {
  volume: Record<string, number>;
  priceChange: Record<string, number>;
  txns: Record<string, { buys: number; sells: number }>;
};

const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const WETH_POOL = "0x11b815efB8f581194ae79006d24E0d814B7697F6";
const URL_WETH = `/dashboard/divergence?chain=ethereum&address=${WETH}`;
const WETH_PAIR = PAIRS.ethereum.pairs[0];

const TV = `(()=>{const s=document.currentScript;const w=s.parentElement.querySelector(".tradingview-widget-container__widget");const f=document.createElement("iframe");f.srcdoc="<body></body>";w.appendChild(f);})();`;

/** Screenshots are written only when a directory is given (QA runs); layout checks always run. */
const SHOTS = process.env.INTEL_SHOTS_DIR;

/** What each chain's pair endpoint answers this round (test-controlled). */
type Answer = { pairs: Pair[] } | "429" | "malformed" | "abort";
type Mock = { chains: Record<string, Answer>; all?: "abort" };

/** The real WETH/USDT payload with individual provider fields overridden. */
function weth(over: {
  volume?: Record<string, number | undefined>;
  priceChange?: Record<string, number | undefined>;
  txns?: Record<string, { buys: number; sells: number } | undefined>;
  liquidity?: unknown;
}): { pairs: Pair[] } {
  const strip = <T extends Record<string, unknown>>(o: T) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  const p = structuredClone(WETH_PAIR);
  if (over.volume) p.volume = strip({ ...p.volume, ...over.volume }) as Pair["volume"];
  if (over.priceChange)
    p.priceChange = strip({ ...p.priceChange, ...over.priceChange }) as Pair["priceChange"];
  if (over.txns) p.txns = strip({ ...p.txns, ...over.txns }) as Pair["txns"];
  if ("liquidity" in over) p.liquidity = over.liquidity;
  return { pairs: [p] };
}

async function setup(page: Page, path: string, mock: Mock, waitLive = true) {
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
    if (mock.all === "abort") return r.abort();
    const u = r.request().url();
    const json = (x: unknown) =>
      r.fulfill({ contentType: "application/json", body: JSON.stringify(x) });
    if (u.includes("/token-boosts/")) return json(BOOSTS);
    if (u.includes("/ads/")) return json(ADS);
    if (u.includes("/tokens/v1/")) return json(u.includes("/solana/") ? TOKENS : []);
    if (u.includes("/latest/dex/pairs/")) {
      const chain = u.split("/latest/dex/pairs/")[1].split("/")[0];
      const a = mock.chains[chain] ?? PAIRS[chain] ?? { pairs: [] };
      if (a === "429") return r.fulfill({ status: 429, body: "rate limited" });
      if (a === "malformed")
        return r.fulfill({ contentType: "application/json", body: '{"pairs":[{"chainId":' });
      if (a === "abort") return r.abort("timedout");
      return json(a);
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
  if (waitLive) {
    await expect(page.getByTestId("desk-status")).toHaveAttribute("data-state", /live|degraded/, {
      timeout: 15_000,
    });
  }
  return { problems };
}

/** Advance one realtime round (30 s) and wait until the page shows a NEWER observation. */
async function round(page: Page) {
  const box = page.getByTestId("divergence");
  const before = Number(await box.getAttribute("data-observed-at"));
  await page.clock.fastForward(30_000);
  await expect
    .poll(async () => Number(await box.getAttribute("data-observed-at")), { timeout: 10_000 })
    .toBeGreaterThan(before);
}

async function shot(page: Page, info: TestInfo, name: string, width = 1440) {
  if (info.project.name !== "desktop") return;
  await page.setViewportSize({ width, height: width < 600 ? 812 : 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  // Settles after the resize (the layout may take a frame to reflow).
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

const rows = (page: Page) => page.getByTestId("divergence-row");

test.describe("Divergence — what doesn't fit?", () => {
  test("active: a DIVERGED predicate leads, with values + horizons, rule thresholds, observed time, source and pool", async ({
    page,
  }, info) => {
    // m5 volume far above the (h1 − m5) pace while the m5 price stays flat.
    const mock: Mock = { chains: { ethereum: weth({ volume: { m5: 40_000, h1: 100_000 } }) } };
    const { problems } = await setup(page, URL_WETH, mock);
    await expect(page.getByTestId("intel-question")).toHaveText("What doesn't fit?");
    await expect(page.getByTestId("divergence-headline")).toHaveText(/^1 OF 6 DIVERGED$/);

    const first = rows(page).first();
    await expect(first).toHaveAttribute("data-id", "PRICE_VS_VOLUME");
    await expect(first).toHaveAttribute("data-state", "DIVERGED");
    await expect(first.getByRole("heading")).toHaveText("PRICE / VOLUME");
    await expect(first.getByTestId("divergence-state")).toHaveText(/DIVERGED/);
    const metrics = first.getByTestId("divergence-metric");
    await expect(metrics.nth(0)).toContainText("PRICE CHANGE");
    await expect(metrics.nth(0)).toContainText("−0.02% · M5");
    await expect(metrics.nth(1)).toContainText(
      /VOLUME ACCELERATION\s*7\.\d{2}× · PACE · M5 VS H1−M5/,
    );
    const thresholds = first.getByTestId("divergence-thresholds");
    await expect(thresholds).toContainText("VA ≥ 3.0×");
    await expect(thresholds).toContainText("|PRICE M5| < 0.5%");
    await expect(first).toContainText("m5 ⊂ h1");
    await expect(first).toContainText("DEXSCREENER · REALTIME");
    await expect(first).toContainText(`OBSERVED POOL ${WETH_POOL.slice(0, 4)}`);
    await expect(first.locator("time").first()).toHaveAttribute("datetime", /Z$/);

    // Group order: DIVERGED, then ALIGNED, then NOT EVALUABLE.
    const states = await rows(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-state")),
    );
    expect(states).toHaveLength(6);
    const rank = { DIVERGED: 0, NOT_DIVERGED: 1, NOT_EVALUABLE: 2 } as Record<string, number>;
    expect(states.map((s) => rank[s!])).toEqual([...states.map((s) => rank[s!])].sort());
    // Canonical payloads carry no boosts.active: named, never guessed.
    const boost = page.locator('[data-testid="divergence-row"][data-id="BOOST_VS_ACTIVITY"]');
    await expect(boost).toHaveAttribute("data-state", "NOT_EVALUABLE");
    await expect(boost.getByTestId("divergence-missing")).toContainText("boosts.active");

    // Supporting surface: the raw fields, real values.
    const raw = page.getByTestId("raw-metrics");
    await expect(
      raw.locator('[data-field="volume.m5"] [data-testid="raw-metric-value"]'),
    ).toHaveText("$40.0K");
    await expect(
      raw.locator('[data-field="boosts.active"] [data-testid="raw-metric-value"]'),
    ).toHaveText("—");
    // No interpretation vocabulary.
    await expect(page.getByTestId("divergence")).not.toContainText(
      /accumulat|distribut|bull|bear/i,
    );

    await shot(page, info, "divergence-active-1440");
    await shot(page, info, "divergence-active-375", 375);
    expect(problems).toEqual([]);
  });

  test("none: the captured payload as-is → NO DIVERGENCE IN CURRENT OBSERVATION; duplicate rounds change nothing", async ({
    page,
  }, info) => {
    const { problems } = await setup(page, URL_WETH, { chains: {} });
    await expect(page.getByTestId("divergence-headline")).toHaveText(
      "NO DIVERGENCE IN CURRENT OBSERVATION",
    );
    await expect(page.locator('[data-testid="divergence-row"][data-state="DIVERGED"]')).toHaveCount(
      0,
    );
    await shot(page, info, "divergence-none-1440");
    // Identical payloads for two more rounds (and the universe lane re-delivering the
    // same canonical observation): same states, still no divergence.
    const before = await rows(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-state")),
    );
    await round(page);
    await round(page);
    const after = await rows(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-state")),
    );
    expect(after).toEqual(before);
    expect(problems).toEqual([]);
  });

  test("zero values are data: 0 % price, 0 volume, 0 txns render as 0 — never —", async ({
    page,
  }) => {
    const mock: Mock = {
      chains: {
        ethereum: weth({
          priceChange: { m5: 0 },
          volume: { m5: 0 },
          txns: { m5: { buys: 0, sells: 0 } },
        }),
      },
    };
    const { problems } = await setup(page, URL_WETH, mock);
    const raw = page.getByTestId("raw-metrics");
    const val = (f: string) => raw.locator(`[data-field="${f}"] [data-testid="raw-metric-value"]`);
    await expect(val("priceChange.m5")).toHaveText("0.00%");
    await expect(val("volume.m5")).toHaveText("$0.00");
    await expect(val("txns.m5.buys")).toHaveText("0");
    const pv = page.locator('[data-testid="divergence-row"][data-id="PRICE_VS_VOLUME"]');
    await expect(pv).toHaveAttribute("data-state", "NOT_DIVERGED");
    await expect(pv.getByTestId("divergence-state")).toHaveText(/ALIGNED/);
    await expect(pv.getByTestId("metric-value").first()).toHaveText("0.00%");
    // 0 m5 txns is below the sample guard: named, not "balanced".
    const bal = page.locator('[data-testid="divergence-row"][data-id="BALANCE_VS_PRICE"]');
    await expect(bal.getByTestId("divergence-missing")).toContainText("sample < 8");
    expect(problems).toEqual([]);
  });

  test("not evaluable: missing m5 / h1 fields are named and shown as —", async ({ page }, info) => {
    const mock: Mock = {
      chains: {
        ethereum: weth({
          volume: { m5: undefined, h1: undefined },
          priceChange: { m5: undefined },
          txns: { m5: undefined, h1: undefined },
        }),
      },
    };
    const { problems } = await setup(page, URL_WETH, mock);
    await expect(page.getByTestId("divergence-headline")).toHaveText(
      "NOTHING EVALUABLE IN CURRENT OBSERVATION",
    );
    await expect(
      page.locator('[data-testid="divergence-row"][data-state="NOT_EVALUABLE"]'),
    ).toHaveCount(6);
    const pv = page.locator('[data-testid="divergence-row"][data-id="PRICE_VS_VOLUME"]');
    await expect(pv.getByTestId("divergence-missing")).toHaveText("MISSING · priceChange.m5");
    await expect(pv.getByTestId("metric-value").first()).toHaveText("—");
    const raw = page.getByTestId("raw-metrics");
    for (const f of ["volume.m5", "volume.h1", "priceChange.m5", "txns.m5.buys", "txns.h1.sells"]) {
      await expect(raw.locator(`[data-field="${f}"] [data-testid="raw-metric-value"]`)).toHaveText(
        "—",
      );
    }
    await shot(page, info, "divergence-not-evaluable-1440");
    expect(problems).toEqual([]);
  });

  test("stale: a 429 on the focus pair keeps the last observation, labelled STALE; recovery needs a NEW observation", async ({
    page,
  }, info) => {
    const mock: Mock = { chains: { ethereum: weth({ volume: { m5: 40_000, h1: 100_000 } }) } };
    const { problems } = await setup(page, URL_WETH, mock);
    await expect(page.getByTestId("divergence-headline")).toHaveText(/DIVERGED/);
    const observed = await page.getByTestId("divergence").getAttribute("data-observed-at");
    mock.chains.ethereum = "429";
    await page.clock.fastForward(30_000);
    await expect(page.getByTestId("freshness-note")).toHaveAttribute("data-state", "stale");
    await expect(page.getByTestId("freshness-note")).toContainText(
      /^STALE · .+ · FRESHNESS WINDOW 45 S\. The evaluation is as of OBSERVATION \d\d:\d\d:\d\d, not now/,
    );
    await expect(page.getByTestId("focus-freshness")).toHaveAttribute("data-state", "stale");
    // The evidence itself is unchanged: never refreshed by a failed round.
    await expect(page.getByTestId("divergence")).toHaveAttribute("data-observed-at", observed!);
    await expect(rows(page).first()).toHaveAttribute("data-state", "DIVERGED");
    await shot(page, info, "divergence-stale-1440");

    // Malformed / timed-out answers: still STALE, still no crash, still the same evidence.
    mock.chains.ethereum = "malformed";
    await page.clock.fastForward(30_000);
    mock.chains.ethereum = "abort";
    await page.clock.fastForward(30_000);
    await expect(page.getByTestId("freshness-note")).toHaveAttribute("data-state", "stale");
    await expect(page.getByTestId("divergence")).toHaveAttribute("data-observed-at", observed!);

    mock.chains.ethereum = weth({});
    await round(page);
    await expect(page.getByTestId("freshness-note")).toHaveCount(0);
    await expect(page.getByTestId("divergence-headline")).toHaveText(
      "NO DIVERGENCE IN CURRENT OBSERVATION",
    );
    expect(problems).toEqual([]);
  });

  test("degraded: the focus observation came from a partial round (another canonical pair missing)", async ({
    page,
  }, info) => {
    const mock: Mock = {
      chains: { ethereum: weth({ volume: { m5: 40_000, h1: 100_000 } }), solana: { pairs: [] } },
    };
    const { problems } = await setup(page, URL_WETH, mock);
    await expect(page.getByTestId("freshness-note")).toHaveAttribute("data-state", "degraded");
    await expect(page.getByTestId("focus-freshness")).toHaveAttribute("data-state", "degraded");
    await expect(rows(page).first()).toHaveAttribute("data-state", "DIVERGED");
    await shot(page, info, "divergence-degraded-1440");
    expect(problems).toEqual([]);
  });

  test("no selection, rejected symbol and not-in-universe states never show evidence", async ({
    page,
  }) => {
    const { problems } = await setup(page, "/dashboard/divergence", { chains: {} });
    await expect(page.getByTestId("intel-empty")).toHaveAttribute("data-state", "none");
    await expect(page.getByTestId("intel-empty")).toContainText("NO ASSET SELECTED");
    await expect(page.getByTestId("divergence")).toHaveCount(0);
    await page.goto(
      "/dashboard/divergence?chain=solana&address=9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    );
    await expect(page.getByTestId("desk-status")).toHaveAttribute("data-state", /live|degraded/, {
      timeout: 15_000,
    });
    await expect(page.getByTestId("intel-empty")).toHaveAttribute("data-state", "unobserved");
    await expect(page.getByTestId("intel-empty")).toContainText("NOT IN OBSERVED UNIVERSE");
    await page.goto("/dashboard/divergence?chain=solana&address=SOL");
    await expect(page.getByTestId("focus-identity")).toContainText("ASSET IN URL REJECTED");
    await expect(page.getByTestId("intel-empty")).toHaveAttribute("data-state", "none");
    expect(problems).toEqual([]);
  });

  test("offline: every DexScreener request fails → OFFLINE, nothing evaluated", async ({
    page,
  }) => {
    const { problems } = await setup(page, URL_WETH, { chains: {}, all: "abort" }, false);
    // Let the lanes exhaust their retries on the fake clock.
    for (let i = 0; i < 4; i++) await page.clock.fastForward(30_000);
    await expect(page.getByTestId("intel-empty")).toHaveAttribute("data-state", "offline", {
      timeout: 15_000,
    });
    await expect(page.getByTestId("divergence")).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test("asset vanishes from the round: the last evaluation stays, STALE (slot unresolved)", async ({
    page,
  }) => {
    const mock: Mock = { chains: {} };
    const { problems } = await setup(page, URL_WETH, mock);
    await expect(rows(page)).toHaveCount(6);
    mock.chains.ethereum = { pairs: [] };
    await page.clock.fastForward(30_000);
    await expect(page.getByTestId("freshness-note")).toHaveAttribute("data-state", "stale");
    await expect(rows(page)).toHaveCount(6);
    expect(problems).toEqual([]);
  });

  test("THE MOMENT link carries the asset; refresh and back/forward keep the view and the asset", async ({
    page,
  }) => {
    const { problems } = await setup(page, URL_WETH, { chains: {} });
    await expect(rows(page)).toHaveCount(6);
    await page.reload();
    await expect(page.getByTestId("intel-question")).toHaveText("What doesn't fit?");
    await expect(page.getByTestId("asset-bar")).toHaveAttribute(
      "data-key",
      `ethereum:${WETH.toLowerCase()}`,
    );
    await page.getByTestId("to-moment").click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/moment\\?.*address=${WETH.toLowerCase()}`));
    await expect(page.getByTestId("intel-question")).toHaveText("What just changed?");
    await page.goBack();
    await expect(page.getByTestId("intel-question")).toHaveText("What doesn't fit?");
    await expect(rows(page)).toHaveCount(6);
    await page.goForward();
    await expect(page.getByTestId("intel-question")).toHaveText("What just changed?");
    expect(problems).toEqual([]);
  });
});
