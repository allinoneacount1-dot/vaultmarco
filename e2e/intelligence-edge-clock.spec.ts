import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * EDGE CLOCK — "How old is this move?" in a real browser.
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
const CLOCK = `/dashboard/edge-clock?chain=solana&address=${SOL}`;
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

async function setup(page: Page, plan: Plan, path = CLOCK) {
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

const ageSeconds = (t: string) => {
  const m = /^(\d\d)m (\d\d)s$/.exec(t.trim());
  if (!m) throw new Error(`unexpected age "${t}"`);
  return Number(m[1]) * 60 + Number(m[2]);
};

test.describe("Edge Clock", () => {
  test("active: the age runs from a fixed, real origin; WHY THIS CLOCK STARTED is inspectable", async ({
    page,
  }, info) => {
    const { problems, rounds } = await setup(page, MOVE);
    await expect(page.getByTestId("intel-question")).toHaveText("How old is this move?");
    await expect(page.getByTestId("edge-clock")).toHaveAttribute("data-state", "none");
    await expect(page.getByTestId("edge-none")).toHaveText(
      "NO STRUCTURAL CHANGE OBSERVED THIS SESSION",
    );
    await tick(page, rounds, 4);

    const clock = page.getByTestId("edge-clock");
    await expect(clock).toHaveAttribute("data-state", "active");
    const age = page.getByTestId("edge-age");
    const origin = Number(await age.getAttribute("data-origin"));
    // The origin is the round-2 observation (the first PRICE EXPANSION), not load / session start.
    const originTime = await clock.locator("time").first().getAttribute("datetime");
    expect(Date.parse(originTime!)).toBe(origin);
    const a1 = ageSeconds(await age.innerText());
    expect(a1).toBeGreaterThanOrEqual(60);
    expect(a1).toBeLessThan(75);
    await page.clock.fastForward(5_000);
    await expect.poll(async () => ageSeconds(await age.innerText())).toBeGreaterThanOrEqual(a1 + 5);
    expect(Number(await age.getAttribute("data-origin"))).toBe(origin);

    // WHY THIS CLOCK STARTED
    const why = page.getByTestId("why-clock");
    await why.locator("summary").click();
    await expect(why).toHaveAttribute("open", "");
    await expect(why).toContainText("PRICE EXPANSION · UP");
    await expect(why.getByTestId("why-rule")).toContainText(
      "|PRICE M5| ≥ 3% · M5 (PROVIDER WINDOW)",
    );
    await expect(why).toContainText("+4.10% M5");
    await expect(why).toContainText("+0.20% M5");
    await expect(why).toContainText("OBSERVED");
    await expect(why).toContainText("intel-2");

    // Evidence since the origin: real deltas, "—" where a side is missing.
    const price = page.locator('[data-testid="since-metric"][data-metric="PRICE"]');
    await expect(price).toContainText("+2.21%");
    await expect(page.locator('[data-testid="since-metric"][data-metric="BOOSTS"]')).toContainText(
      "—",
    );
    await expect(page.getByTestId("since-families")).toHaveAttribute("data-count", "2");
    await expect(page.getByTestId("since-families")).toContainText("2 INDEPENDENT FAMILIES");
    const body = (await page.getByTestId("clock-body").innerText()).toUpperCase();
    expect(body).not.toMatch(/CAUSED|BECAUSE|LED TO|BULLISH|BEARISH|PREDICT|CONFIDENCE|SCORE/);
    if (info.project.name === "desktop") {
      await shot(page, "edge-clock-1440", 1440);
      await shot(page, "edge-clock-375", 375);
    }
    expect(problems).toEqual([]);
  });

  test("no qualifying change: honest none state, never page load or first observation", async ({
    page,
  }, info) => {
    const { problems, rounds } = await setup(page, { sol: () => CALM });
    await tick(page, rounds, 3);
    await expect(page.getByTestId("edge-clock")).toHaveAttribute("data-state", "none");
    await expect(page.getByTestId("edge-none")).toHaveText(
      "NO STRUCTURAL CHANGE OBSERVED THIS SESSION",
    );
    await expect(page.getByTestId("edge-age")).toHaveCount(0);
    await expect(page.getByTestId("edge-clock")).toContainText("session started");
    if (info.project.name === "desktop") await shot(page, "edge-clock-none", 1440);
    expect(problems).toEqual([]);
  });

  test("a condition already true at first observation is listed as in progress, never an origin", async ({
    page,
  }) => {
    const { problems, rounds } = await setup(page, { sol: () => EXPAND });
    await tick(page, rounds, 2);
    await expect(page.getByTestId("edge-clock")).toHaveAttribute("data-state", "none");
    await expect(page.getByTestId("edge-in-progress")).toContainText("PRICE EXPANSION · UP");
    expect(problems).toEqual([]);
  });

  test("an ended move is secondary context; a new move restarts the clock at its own onset", async ({
    page,
  }) => {
    const DOWN: Partial<Pair> = { ...CALM, priceChange: { m5: -4.2, h1: -4, h6: -4, h24: -4 } };
    const seq = [CALM, EXPAND, CALM, CALM];
    const { problems, rounds } = await setup(page, { sol: (r) => seq[r] ?? DOWN });
    await tick(page, rounds, 3);
    await expect(page.getByTestId("edge-clock")).toHaveAttribute("data-state", "ended");
    await expect(page.getByTestId("edge-none")).toHaveText(
      "NO ACTIVE STRUCTURAL CHANGE AT THE LATEST OBSERVATION",
    );
    await expect(page.getByTestId("edge-earlier")).toContainText("PRICE EXPANSION · UP");
    await tick(page, rounds, 2);
    await expect(page.getByTestId("edge-clock")).toHaveAttribute("data-state", "active");
    await expect(page.getByTestId("edge-clock")).toContainText("PRICE EXPANSION · DOWN");
    await expect(page.getByTestId("edge-earlier")).toContainText("NO LONGER ACTIVE");
    expect(problems).toEqual([]);
  });

  test("stale: the origin and its evidence stay, labelled STALE; no delta invented after the last observation", async ({
    page,
  }, info) => {
    let down = false;
    const { problems, rounds } = await setup(page, {
      sol: (r) => (down ? "429" : MOVE.sol(r)),
      other: () => (down ? "429" : null),
    });
    await tick(page, rounds, 4);
    const latest = await page
      .locator('[data-testid="since-metric"][data-metric="PRICE"]')
      .innerText();
    down = true;
    await tick(page, rounds, 2);
    await expect(page.getByTestId("focus-freshness")).toHaveAttribute("data-state", "stale");
    await expect(page.getByTestId("freshness-note")).toContainText("STALE");
    await expect(page.getByTestId("edge-clock")).toContainText("ACTIVITY AFTER IT IS UNKNOWN");
    expect(
      await page.locator('[data-testid="since-metric"][data-metric="PRICE"]').innerText(),
    ).toBe(latest);
    if (info.project.name === "desktop") await shot(page, "edge-clock-stale", 1440);
    expect(problems).toEqual([]);
  });

  test("degraded: a partial round is labelled DEGRADED; the clock is kept", async ({
    page,
  }, info) => {
    const { problems, rounds } = await setup(page, {
      ...MOVE,
      other: (r) => (r >= 3 ? "429" : null),
    });
    await tick(page, rounds, 4);
    await expect(page.getByTestId("focus-freshness")).toHaveAttribute("data-state", "degraded");
    await expect(page.getByTestId("freshness-note")).toContainText("DEGRADED");
    await expect(page.getByTestId("edge-clock")).toHaveAttribute("data-state", "active");
    if (info.project.name === "desktop") await shot(page, "edge-clock-degraded", 1440);
    expect(problems).toEqual([]);
  });

  test("adversarial: zero values are data, missing windows are —, no crash", async ({ page }) => {
    const ZERO_VOL: Partial<Pair> = {
      ...EXPAND,
      volume: { m5: 0, h1: 0, h6: 0, h24: 0 },
      liquidity: { usd: 0, base: 0, quote: 0 },
    };
    const seq: Variant[] = [CALM, CALM, ZERO_VOL, "malformed", ZERO_VOL];
    const { problems, rounds } = await setup(page, {
      sol: (r) => seq[Math.min(r, seq.length - 1)],
    });
    await tick(page, rounds, 4);
    await expect(page.getByTestId("edge-clock")).toHaveAttribute("data-state", "active");
    const vol = page.locator('[data-testid="since-metric"][data-metric="VOLUME_M5"]');
    await expect(vol).toHaveAttribute("data-delta", "0");
    await expect(
      page.locator('[data-testid="since-metric"][data-metric="VOLUME_PACE"]'),
    ).toHaveAttribute("data-delta", "");
    const text = await page.getByTestId("since-metrics").innerText();
    expect(text).not.toMatch(/NaN|undefined|Infinity/);
    expect(problems).toEqual([]);
  });

  test("no selection / not in universe; links back to THE MOMENT with the same identity", async ({
    page,
  }) => {
    const { problems, rounds } = await setup(page, MOVE, "/dashboard/edge-clock");
    await expect(page.getByTestId("intel-empty")).toContainText("NO ASSET SELECTED");
    await page.goto(`/dashboard/edge-clock?chain=ethereum&address=0x${"1".repeat(40)}`);
    await expect(page.getByTestId("intel-unavailable")).toContainText("NOT IN OBSERVED UNIVERSE");
    await page.goto(CLOCK);
    await expect(page.getByTestId("clock-body")).toBeVisible();
    void rounds;
    await page.getByTestId("to-moment").click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/moment\\?.*address=${SOL}`));
    await expect(page.getByTestId("asset-bar")).toHaveAttribute("data-key", `solana:${SOL}`);
    await page.goBack();
    await expect(page.getByTestId("intel-question")).toHaveText("How old is this move?");
    expect(problems).toEqual([]);
  });

  test("layout: no horizontal overflow from 375 to 1920", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "viewport sweep once");
    const { problems, rounds } = await setup(page, MOVE);
    await tick(page, rounds, 4);
    await page.getByTestId("why-clock").locator("summary").click();
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
