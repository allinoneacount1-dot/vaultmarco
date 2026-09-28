import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * VAULT TRACE — "What moved first?" in a real browser.
 *
 * DexScreener is served from the REAL captured fixtures in tests/fixtures.
 * The fake clock creates a deterministic session: each 30 s tick is one
 * realtime round, and the SOL/USDC payload is varied per round (tests only)
 * to create real, rule-meeting observations. Every other provider is aborted.
 * Set SHOTS=<dir> to capture screenshots.
 */

const fx = (n: string) =>
  JSON.parse(readFileSync(new URL(`../tests/fixtures/${n}`, import.meta.url), "utf8"));
const BOOSTS = fx("dexscreener.boosts.latest.json");
const ADS = fx("dexscreener.ads.latest.json");
const PAIRS = fx("dexscreener.pairs.canonical.json") as Record<string, { pairs: Pair[] }>;
const TOKENS = fx("dexscreener.tokens.solana.json") as Pair[];

type Pair = Record<string, unknown> & {
  priceUsd?: string;
  pairAddress?: string;
  volume?: Record<string, number>;
  priceChange?: Record<string, number>;
  txns?: Record<string, { buys: number; sells: number }>;
  liquidity?: Record<string, number>;
};

const SOL = "So11111111111111111111111111111111111111112";
const HONSE = "46vV3ZpFNLZn1CDRYnAvqPsdW5ejEYn9GK9kPcZFpump";
const TRACE = `/dashboard/trace?chain=solana&address=${SOL}`;
const SHOTS = process.env.SHOTS;

/** What the SOL canonical request returns in a given round. */
type Variant = Partial<Pair> | "429" | "timeout" | "malformed" | "missing";
/** Other chains: fixture unless "429". */
type Plan = {
  sol: (round: number) => Variant;
  other?: (round: number) => "429" | null;
  /** /tokens/v1 solana payload (default: the real fixture). */
  tokens?: () => Pair[];
};

const CALM: Partial<Pair> = {
  priceUsd: "100.00",
  priceChange: { m5: 0.2, h1: 0.4, h6: 0.5, h24: 1.2 },
  txns: {
    m5: { buys: 120, sells: 100 },
    h1: { buys: 747, sells: 762 },
    h6: { buys: 4000, sells: 4100 },
    h24: { buys: 16000, sells: 16100 },
  },
};
const EXPAND: Partial<Pair> = {
  ...CALM,
  priceUsd: "104.10",
  priceChange: { m5: 4.1, h1: 4.4, h6: 4.5, h24: 5.2 },
};
const EXPAND_VA: Partial<Pair> = {
  ...EXPAND,
  priceUsd: "106.40",
  volume: { m5: 400_000, h1: 1_700_000, h6: 16_934_291.93, h24: 51_197_248.61 },
};

/** calm, calm, PRICE EXPANSION, then + VOLUME ACCELERATION. */
const MOVE: Plan = { sol: (r) => (r < 2 ? CALM : r === 2 ? EXPAND : EXPAND_VA) };

async function setup(page: Page, plan: Plan, path = TRACE) {
  const problems: string[] = [];
  /** `tick` = the fake-clock round the test is in; `sol` counts SOL requests. */
  const rounds = { sol: 0, tick: 0 };
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    if (/Failed to load resource|net::ERR/.test(m.text())) return;
    problems.push(`${m.type()}: ${m.text()}`);
  });
  await page.route("https://s3.tradingview.com/**", (r) => r.abort());
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
      return json(u.includes("/solana/") ? (plan.tokens?.() ?? TOKENS) : []);
    }
    if (u.includes("/latest/dex/pairs/")) {
      const chain = u.split("/latest/dex/pairs/")[1].split("/")[0];
      if (chain === "solana") {
        rounds.sol++;
        const v = plan.sol(rounds.tick);
        if (v === "429") return r.fulfill({ status: 429, body: "rate limited" });
        if (v === "timeout") return r.abort("timedout");
        if (v === "malformed")
          return r.fulfill({ contentType: "application/json", body: "{pairs:" });
        if (v === "missing") return json({ pairs: [] });
        return json({ pairs: [{ ...PAIRS.solana.pairs[0], ...v }] });
      }
      if (plan.other?.(rounds.tick) === "429") return r.fulfill({ status: 429, body: "" });
      return json(PAIRS[chain] ?? { pairs: [] });
    }
    return r.abort();
  });
  await page.clock.install();
  await page.goto(path);
  // Round 0 lands before the test drives the clock.
  await expect.poll(() => rounds.sol, { timeout: 15_000 }).toBeGreaterThan(0);
  await expect(page.getByTestId("desk-status")).toHaveAttribute("data-state", /live|degraded/, {
    timeout: 15_000,
  });
  return { problems, rounds };
}

/** Advance the fake clock one realtime round (30 s) and let the responses land. */
async function tick(page: Page, rounds: { sol: number; tick: number }, n = 1) {
  for (let i = 0; i < n; i++) {
    const before = rounds.sol;
    rounds.tick++;
    await page.clock.fastForward(30_000);
    await expect.poll(() => rounds.sol, { timeout: 10_000 }).toBeGreaterThan(before);
    await page.waitForTimeout(250);
  }
}

async function shot(page: Page, name: string, width?: number) {
  if (!SHOTS) return;
  if (width) await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

const rows = (page: Page) => page.getByTestId("trace-row");

test.describe("Vault Trace", () => {
  test("populated: chronological tape, gold anchor on the first observed onset, chronology wording only", async ({
    page,
  }, info) => {
    const { problems, rounds } = await setup(page, MOVE);
    await expect(page.getByTestId("intel-question")).toHaveText("What moved first?");
    await expect(page.getByTestId("asset-bar")).toHaveAttribute("data-key", `solana:${SOL}`);
    await tick(page, rounds, 4);

    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).nth(0)).toHaveAttribute("data-type", "PRICE_EXPANSION");
    await expect(rows(page).nth(0)).toHaveAttribute("data-anchor", /FIRST_IN_VIEW/);
    await expect(rows(page).nth(0)).toContainText("EDGE CLOCK ORIGIN");
    await expect(rows(page).nth(1)).toHaveAttribute("data-type", "VOLUME_ACCELERATION");
    await expect(rows(page).nth(0)).toContainText("+4.10% M5");
    await expect(rows(page).nth(0)).toContainText("RULE |PRICE M5| ≥ 3% · M5 (PROVIDER WINDOW)");
    await expect(rows(page).nth(0)).toContainText("OBSERVED POOL Czfq3…44zE · ORCA");
    // Real <time> elements, ascending.
    const stamps = await rows(page).evaluateAll((els) =>
      els.map((e) => Date.parse(e.querySelector("time")!.getAttribute("datetime")!)),
    );
    expect(stamps.length).toBeGreaterThanOrEqual(2);
    expect([...stamps].sort((a, b) => a - b)).toEqual(stamps);
    await expect(page.getByTestId("trace-sequence")).toContainText("OBSERVED BEFORE");
    const body = (await page.getByTestId("trace-body").innerText()).toUpperCase();
    expect(body).not.toMatch(/CAUSED|BECAUSE|LED TO|BULLISH|BEARISH|PREDICT|CONFIDENCE|SCORE/);

    // Windows: only SESSION is spanned so far; the reason is measured, not generic.
    const win = page.getByTestId("trace-windows");
    await expect(win.getByRole("button", { name: "SESSION", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(win.getByRole("button", { name: "5M", exact: true })).toBeDisabled();
    await expect(page.getByTestId("trace-window-reason")).toContainText(
      /5M · 15M · 1H NOT SPANNED YET — OBSERVED HISTORY OF THIS ASSET SPANS 02m 0\ds/,
    );
    // Shared Segmented disabled state: native disabled button, reason as its description + title.
    await expect(win.getByRole("button", { name: "5M", exact: true })).toHaveAccessibleDescription(
      /^5M unavailable — observed history of this asset spans 02m 0\ds$/,
    );
    await expect(win.getByRole("button", { name: "5M", exact: true })).toHaveAttribute(
      "title",
      /^5M unavailable/,
    );
    if (info.project.name === "desktop") {
      await shot(page, "trace-1440", 1440);
      await shot(page, "trace-375", 375);
      await page.setViewportSize({ width: 1440, height: 900 });
    }

    // After ≥ 5 min of history the 5M window becomes available.
    await tick(page, rounds, 7);
    await expect(win.getByRole("button", { name: "5M", exact: true })).toBeEnabled();
    await expect(win.getByRole("button", { name: "15M", exact: true })).toBeDisabled();
    await win.getByRole("button", { name: "5M", exact: true }).click();
    await expect(win.getByRole("button", { name: "5M", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(problems).toEqual([]);
  });

  test("empty: NO EVIDENCE OBSERVED THIS SESSION with the session start time", async ({
    page,
  }, info) => {
    const { problems, rounds } = await setup(page, { sol: () => CALM });
    await tick(page, rounds, 2);
    const empty = page.getByTestId("trace-empty");
    await expect(empty).toContainText("NO EVIDENCE OBSERVED THIS SESSION");
    await expect(empty).toContainText("SESSION STARTED");
    await expect(empty.locator("time").first()).toHaveAttribute("datetime", /T/);
    await expect(page.getByTestId("trace-first")).toHaveAttribute("data-state", "none");
    if (info.project.name === "desktop") await shot(page, "trace-empty", 1440);
    expect(problems).toEqual([]);
  });

  test("no selection and not-in-universe are honest states", async ({ page }) => {
    const { problems } = await setup(page, MOVE, "/dashboard/trace");
    await expect(page.getByTestId("intel-empty")).toContainText("NO ASSET SELECTED");
    await expect(page.getByTestId("intel-empty")).toContainText("—");
    await page.goto(
      "/dashboard/trace?chain=solana&address=9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    );
    await expect(page.getByTestId("intel-empty")).toContainText("NOT IN OBSERVED UNIVERSE");
    await expect(page.getByTestId("trace-tape")).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test("provider 429 on the pair: PROVIDER STALE / RECOVERED are subordinate lane rows; the asset is STALE until a new observation", async ({
    page,
  }) => {
    const { problems, rounds } = await setup(page, {
      sol: (r) => (r === 3 ? "429" : r < 2 ? CALM : EXPAND),
    });
    await tick(page, rounds, 3);
    await expect(page.getByTestId("focus-freshness")).toHaveAttribute("data-state", "stale");
    await expect(page.getByTestId("freshness-note")).toContainText("STALE");
    await expect(
      page.locator('[data-testid="trace-row"][data-type="PROVIDER_STALE"]'),
    ).toHaveAttribute("data-lane", "true");
    await tick(page, rounds);
    await expect(
      page.locator('[data-testid="trace-row"][data-type="PROVIDER_RECOVERED"]'),
    ).toHaveCount(1);
    await expect(page.getByTestId("focus-freshness")).toHaveAttribute("data-state", "live");
    // Lane context never becomes the anchor.
    await expect(page.locator('[data-lane="true"][data-anchor]')).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test("stale: every provider round failing keeps the tape as last known, labelled STALE", async ({
    page,
  }, info) => {
    let down = false;
    const { problems, rounds } = await setup(page, {
      sol: (r) => (down ? "timeout" : MOVE.sol(r)),
      other: () => (down ? "429" : null),
    });
    await tick(page, rounds, 4);
    await expect(rows(page)).toHaveCount(2);
    down = true;
    await tick(page, rounds, 2);
    await expect(page.getByTestId("focus-freshness")).toHaveAttribute("data-state", "stale");
    await expect(page.getByTestId("freshness-note")).toHaveAttribute("data-state", "stale");
    await expect(rows(page).first()).toHaveAttribute("data-type", "PRICE_EXPANSION");
    if (info.project.name === "desktop") await shot(page, "trace-stale", 1440);
    expect(problems).toEqual([]);
  });

  test("degraded: another canonical slot failing makes the round partial — DEGRADED, evidence kept", async ({
    page,
  }, info) => {
    const { problems, rounds } = await setup(page, {
      ...MOVE,
      other: (r) => (r >= 3 ? "429" : null),
    });
    await tick(page, rounds, 4);
    await expect(page.getByTestId("focus-freshness")).toHaveAttribute("data-state", "degraded");
    await expect(page.getByTestId("freshness-note")).toContainText("DEGRADED");
    await expect(rows(page).first()).toHaveAttribute("data-type", "PRICE_EXPANSION");
    if (info.project.name === "desktop") await shot(page, "trace-degraded", 1440);
    expect(problems).toEqual([]);
  });

  test("adversarial payloads: malformed, timeout, missing pair, zero values, missing m5/h1 — no crash, no invented values", async ({
    page,
  }) => {
    const ZERO: Partial<Pair> = {
      ...CALM,
      volume: { m5: 0, h1: 0, h6: 0, h24: 0 },
      txns: {
        m5: { buys: 0, sells: 0 },
        h1: { buys: 0, sells: 0 },
        h6: { buys: 0, sells: 0 },
        h24: { buys: 0, sells: 0 },
      },
      liquidity: { usd: 0, base: 0, quote: 0 },
    };
    const NO_WINDOWS: Partial<Pair> = {
      ...CALM,
      priceChange: { h6: 0.5, h24: 1.2 },
      volume: { h6: 1, h24: 2 },
    };
    const seq: Variant[] = [
      CALM,
      "malformed",
      "timeout",
      "missing",
      ZERO,
      NO_WINDOWS,
      CALM,
      EXPAND,
    ];
    const { problems, rounds } = await setup(page, {
      sol: (r) => seq[Math.min(r, seq.length - 1)],
    });
    await tick(page, rounds, seq.length - 1);
    await expect(page.getByTestId("trace-body")).toBeVisible();
    // The unresolved slots produced a lane-context stale row; nothing else was invented.
    await expect(
      page.locator('[data-testid="trace-row"][data-type="PROVIDER_STALE"]').first(),
    ).toBeVisible();
    const values = await page.getByTestId("trace-value").allInnerTexts();
    for (const v of values) expect(v).not.toMatch(/NaN|undefined|Infinity/);
    expect(problems).toEqual([]);
  });

  test("the asset vanishing from the universe keeps its retained evidence, STALE", async ({
    page,
  }) => {
    const { problems, rounds } = await setup(page, {
      sol: (r) => (r >= 4 ? "missing" : MOVE.sol(r)),
    });
    await tick(page, rounds, 5);
    await expect(rows(page).filter({ hasText: "PRICE EXPANSION" })).toHaveCount(1);
    await expect(page.getByTestId("focus-freshness")).toHaveAttribute("data-state", "stale");
    expect(problems).toEqual([]);
  });

  test("a pool switch of a feed asset is a visible break in the tape", async ({ page }) => {
    let switched = false;
    const { problems, rounds } = await setup(
      page,
      {
        ...MOVE,
        tokens: () =>
          TOKENS.map((p, i) =>
            i === 0 && switched
              ? {
                  ...p,
                  pairAddress: "SwitchedPoo1111111111111111111111111111111",
                  dexId: "raydium",
                }
              : p,
          ),
      },
      `/dashboard/trace?chain=solana&address=${HONSE}`,
    );
    await expect(page.getByTestId("asset-bar")).toHaveAttribute("data-key", `solana:${HONSE}`);
    await tick(page, rounds, 3);
    switched = true;
    await tick(page, rounds, 4);
    const brk = page.getByTestId("trace-pool-break");
    await expect(brk).toHaveCount(1);
    await expect(brk).toContainText("OBSERVED POOL SWITCHED");
    await expect(brk).toContainText("RAYDIUM");
    await expect(page.getByTestId("observed-pool")).toContainText("RAYDIUM");
    expect(problems).toEqual([]);
  });

  test("cross-flow: THE MOMENT and EDGE CLOCK keep the identity; refresh resets only the session; back/forward", async ({
    page,
  }) => {
    const { problems, rounds } = await setup(page, MOVE);
    await tick(page, rounds, 3);
    const toMoment = page.getByTestId("to-moment");
    await expect(toMoment).toHaveAttribute(
      "href",
      new RegExp(`/dashboard/moment\\?.*address=${SOL}`),
    );
    await page.getByTestId("to-edge-clock").click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/edge-clock\\?.*address=${SOL}`));
    await expect(page.getByTestId("intel-question")).toHaveText("How old is this move?");
    await page.getByTestId("to-trace").click();
    await expect(page.getByTestId("intel-question")).toHaveText("What moved first?");
    await page.getByTestId("to-moment").click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/moment\\?.*address=${SOL}`));
    expect(page.url()).not.toContain("pair=");
    await page.goBack();
    await expect(page.getByTestId("intel-question")).toHaveText("What moved first?");
    await expect(rows(page).first()).toHaveAttribute("data-type", "PRICE_EXPANSION");
    await page.goForward();
    await expect(page.getByTestId("intel-question")).toHaveText("What just changed?");
    await page.goBack();
    // Refresh: identity from the URL survives; the session (and so the tape) starts again.
    await page.reload();
    await expect(page.getByTestId("asset-bar")).toHaveAttribute("data-key", `solana:${SOL}`);
    await expect(page.getByTestId("trace-body")).toBeVisible();
    await expect(page.getByTestId("trace-first")).toHaveAttribute("data-state", "none");
    expect(problems).toEqual([]);
  });

  test("layout: no horizontal overflow from 375 to 1920", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "viewport sweep once");
    const { problems, rounds } = await setup(page, MOVE);
    await tick(page, rounds, 4);
    for (const width of [375, 430, 768, 834, 900, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      // Let the sidebar's structural transition settle before measuring.
      await expect
        .poll(
          () =>
            page.evaluate(
              () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
            ),
          { message: `width ${width}` },
        )
        .toBeLessThanOrEqual(0);
    }
    expect(problems).toEqual([]);
  });
});
