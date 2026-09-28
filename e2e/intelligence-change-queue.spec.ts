import { test, expect, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * CHANGE QUEUE — real app, real browser, deterministic session history.
 *
 * DexScreener is served from payloads built on the REAL captured fixtures in
 * tests/fixtures (canonical /pairs, /tokens/v1, boosts, ads); only numeric
 * provider fields vary between rounds, and only here in the test. The fake
 * clock advances the existing lanes (realtime 30 s, universe 60 s); the page
 * adds no requests of its own.
 */

const fx = (n: string) =>
  JSON.parse(readFileSync(new URL(`../tests/fixtures/${n}`, import.meta.url), "utf8"));
const BOOSTS = fx("dexscreener.boosts.latest.json") as Array<Record<string, unknown>>;
const ADS = fx("dexscreener.ads.latest.json") as Array<Record<string, unknown>>;
const PAIRS = fx("dexscreener.pairs.canonical.json") as Record<string, { pairs: Pair[] }>;
const TOKENS = fx("dexscreener.tokens.solana.json") as Pair[];

type Pair = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Over = { m5?: number; vol?: [number, number]; tx?: [number, number]; liq?: number };

const TV = `(()=>{const s=document.currentScript;const w=s.parentElement.querySelector(".tradingview-widget-container__widget");const f=document.createElement("iframe");f.srcdoc="<body></body>";w.appendChild(f);})();`;
const SHOTS = process.env.QUEUE_SHOTS;

/* ------------------------------------------------------------------ *
 * The deterministic world
 * ------------------------------------------------------------------ */

const B58 = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const addr = (tag: string) => `Mv${tag}`.padEnd(44, "q");
const pool = (tag: string) => `Pq${tag}`.padEnd(44, "w");

type Token = { tag: string; sym: string; at: (r: number) => Over };

/** Six feed tokens with scripted changes by universe round r (0 = first round). */
const A: Token = {
  tag: "A",
  sym: "ALPHA",
  at: (r) => (r >= 2 ? { m5: 6, vol: [600, 1200] } : {}),
};
const B: Token = { tag: "B", sym: "BRAVO", at: (r) => (r >= 3 ? { vol: [300, 1200] } : {}) };
const C: Token = { tag: "T", sym: "CHARLIE", at: (r) => (r >= 6 ? { liq: 50_000 } : {}) };
const D: Token = { tag: "S", sym: "DELTA", at: (r) => (r >= 6 ? { liq: 130_000 } : {}) };
const E: Token = {
  tag: "E",
  sym: "ECHO",
  at: (r) => ({ ...(r >= 1 ? { m5: -5 } : {}), ...(r >= 4 ? { tx: [30, 5] } : {}) }),
};
const F: Token = { tag: "F", sym: "FOXTROT", at: () => ({}) };
const SCRIPTED = [A, B, C, D, E, F];
const CALM = SCRIPTED.map((t) => ({ ...t, at: () => ({}) }));

type World = {
  feed: Token[];
  /** Feed tokens no longer listed from this universe round on (vanishing). */
  vanish?: { tag: string; from: number };
  /** Canonical SOL price expansion from this realtime round on. */
  solFrom?: number;
  /** Canonical WETH price expansion from this realtime round on. */
  wethFrom?: number;
  fail?: { realtime?: "429" | "timeout"; universe?: "500" | "timeout"; ads?: "500" };
  uRound: number;
  rtRound: number;
};

function feedPair(t: Token, r: number): Pair {
  const o = t.at(r);
  const p = structuredClone(TOKENS[0]);
  p.baseToken = { ...p.baseToken, address: addr(t.tag), symbol: t.sym, name: t.sym };
  p.pairAddress = pool(t.tag);
  p.url = `https://dexscreener.com/solana/${pool(t.tag).toLowerCase()}`;
  p.priceUsd = "0.0001234";
  p.priceChange = { ...p.priceChange, m5: o.m5 ?? 0.1 };
  p.volume = { ...p.volume, m5: o.vol?.[0] ?? 100, h1: o.vol?.[1] ?? 1200 };
  p.txns = {
    ...p.txns,
    m5: { buys: o.tx?.[0] ?? 5, sells: o.tx?.[1] ?? 5 },
    h1: { buys: 40, sells: 40 },
  };
  p.liquidity = { ...p.liquidity, usd: o.liq ?? 100_000 };
  p.boosts = { active: 10 };
  return p;
}

function canonical(chain: string, w: World): { pairs: Pair[] } {
  const p = structuredClone(PAIRS[chain].pairs[0]);
  // Calm (no rule fires) unless scripted: balanced m5 txns, flat m5 price.
  p.txns = { ...p.txns, m5: { buys: 5, sells: 5 } };
  p.priceChange = { ...p.priceChange, m5: 0.1 };
  if (chain === "solana" && w.solFrom != null && w.rtRound >= w.solFrom) p.priceChange.m5 = 4.5;
  if (chain === "ethereum" && w.wethFrom != null && w.rtRound >= w.wethFrom)
    p.priceChange.m5 = -3.5;
  return { pairs: [p] };
}

const listed = (w: World) =>
  w.feed.filter((t) => !(w.vanish && t.tag === w.vanish.tag && w.uRound >= w.vanish.from));

async function install(page: Page, w: World) {
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
  const hang = (_r: Route) => new Promise<void>(() => {}); // never answers → client TIMEOUT
  await page.route("https://api.dexscreener.com/**", (r) => {
    const u = r.request().url();
    const json = (x: unknown) =>
      r.fulfill({ contentType: "application/json", body: JSON.stringify(x) });
    const uFail = w.fail?.universe;
    if (u.includes("/token-boosts/latest/")) {
      w.uRound++;
      if (uFail === "timeout") return hang(r);
      if (uFail === "500") return r.fulfill({ status: 500, body: "" });
      return json(
        listed(w).map((t, i) => ({
          ...BOOSTS[0],
          url: `https://dexscreener.com/solana/${addr(t.tag).toLowerCase()}`,
          chainId: "solana",
          tokenAddress: addr(t.tag),
          amount: 10,
          totalAmount: 1000 - i,
        })),
      );
    }
    if (u.includes("/token-boosts/top/")) {
      if (uFail === "timeout") return hang(r);
      if (uFail === "500") return r.fulfill({ status: 500, body: "" });
      return json([]);
    }
    if (u.includes("/ads/")) {
      if (uFail === "timeout") return hang(r);
      if (uFail === "500" || w.fail?.ads === "500") return r.fulfill({ status: 500, body: "" });
      return json([]);
    }
    if (u.includes("/tokens/v1/")) {
      if (uFail === "timeout") return hang(r);
      if (uFail === "500") return r.fulfill({ status: 500, body: "" });
      if (!u.includes("/tokens/v1/solana/")) return json([]);
      const asked = decodeURIComponent(u.split("/tokens/v1/solana/")[1]).split(",");
      const r0 = Math.max(0, w.uRound - 1);
      return json(w.feed.filter((t) => asked.includes(addr(t.tag))).map((t) => feedPair(t, r0)));
    }
    if (u.includes("/latest/dex/pairs/")) {
      const chain = u.split("/latest/dex/pairs/")[1].split("/")[0];
      if (chain === "solana") w.rtRound++;
      if (w.fail?.realtime === "429") return r.fulfill({ status: 429, body: "" });
      if (w.fail?.realtime === "timeout") return hang(r);
      return json(PAIRS[chain] ? canonical(chain, w) : { pairs: [] });
    }
    return r.abort();
  });
  await page.clock.install();
  return problems;
}

function world(over: Partial<World> = {}): World {
  return { feed: SCRIPTED, uRound: 0, rtRound: 0, ...over };
}

/** Let in-flight work settle (real time), with the fake clock paused-by-default flowing. */
async function settle(page: Page) {
  await page.waitForTimeout(600);
}

/** Advance until the universe lane has served `round` + 1 rounds (round index `round`). */
async function toRound(page: Page, w: World, round: number) {
  for (let guard = 0; w.uRound < round + 1 && guard < 40; guard++) {
    await page.clock.fastForward(30_000);
    await settle(page);
  }
  expect(w.uRound).toBeGreaterThanOrEqual(round + 1);
  await settle(page);
}

async function open(page: Page, w: World, path = "/dashboard/change-queue") {
  await page.goto(path);
  await expect(page.getByTestId("intel-question")).toHaveText("What deserves attention now?");
  await expect(page.getByTestId("queue-state")).not.toHaveAttribute("data-state", "loading", {
    timeout: 15_000,
  });
  await expect.poll(() => w.uRound, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
  await settle(page);
}

const rows = (page: Page) => page.getByTestId("queue-row");
const rowKeys = (page: Page) =>
  rows(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-key")));
const key = (t: Token) => `solana:${addr(t.tag)}`;
const row = (page: Page, t: Token) =>
  page.locator(`[data-testid="queue-row"][data-key="${key(t)}"]`);
async function sortBy(page: Page, label: string) {
  const b = page.getByRole("group", { name: "Queue order" }).getByRole("button", {
    name: label,
    exact: true,
  });
  await b.click();
  await expect(b).toHaveAttribute("aria-pressed", "true");
}
async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}
async function noOverflow(page: Page) {
  const o = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    w: window.innerWidth,
  }));
  expect(o.sw).toBeLessThanOrEqual(o.w);
}

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

test.describe("Change Queue", () => {
  test("populated: one row per asset with a qualifying change; each row carries its evidence", async ({
    page,
  }) => {
    const w = world();
    const problems = await install(page, w);
    await open(page, w);
    await toRound(page, w, 6);

    // F (calm) and the four calm canonical pairs are observed but never queued.
    await expect(rows(page)).toHaveCount(5);
    await expect(row(page, F)).toHaveCount(0);
    await expect(page.getByTestId("queue-count")).toContainText("5 OF 10 OBSERVED ASSETS");

    const a = row(page, A);
    await expect(a.getByTestId("row-change")).toHaveAttribute(
      "data-type",
      /PRICE_EXPANSION|VOLUME_ACCELERATION/,
    );
    await expect(a).toContainText("ALPHA");
    await expect(a.locator(".mv-chip")).toHaveText("SOL");
    await expect(a.getByTestId("row-pool")).toContainText(`OBSERVED POOL ${pool("A").slice(0, 5)}`);
    await expect(a.getByTestId("row-age")).toHaveText(/^\d\dm \d\ds$/);
    await expect(a.getByTestId("row-age")).toHaveAttribute("datetime", /Z$/);
    await expect(a.getByTestId("row-families")).toHaveText("2");
    await expect(a.getByTestId("row-state")).toHaveAttribute("data-state", "live");
    await expect(a).toContainText("$0.0");
    const link = a.getByRole("link", { name: /OPEN IN THE MOMENT/ });
    await expect(link).toHaveAttribute(
      "href",
      new RegExp(`/dashboard/moment\\?.*address=${addr("A")}`),
    );

    // Direction in words, never by colour alone.
    // C's liquidity drop is observed twice in the same round (session delta + the radar's
    // risk firing); the queue shows the one queueRow picks, direction in words.
    await expect(row(page, C).getByTestId("row-change")).toHaveText(
      /^(LIQUIDITY CHANGE|RADAR RISK FIRED) · REMOVED$/,
    );
    await expect(row(page, D).getByTestId("row-change")).toHaveText(
      /^(LIQUIDITY CHANGE|RADAR RISK FIRED) · ADDED$/,
    );
    await expect(row(page, E).getByTestId("row-change")).toHaveText("TXN ACCELERATION · UP"); // same round as its BUY imbalance

    // No merit language, no rank numbers, no score column.
    const text = (await page.getByTestId("queue").innerText()).toUpperCase();
    expect(text).not.toMatch(/TOP PICK|BEST|SCORE|RANK|#1|CONFIDENCE|BULLISH|BEARISH/);
    await expect(page.getByTestId("queue-state")).toHaveAttribute("data-state", "live");
    await shot(page, `populated-${page.viewportSize()!.width}`);
    expect(problems).toEqual([]);
  });

  test("each sort order is deterministic with an honest caption; rows lacking the key go last as —", async ({
    page,
  }) => {
    const w = world();
    const problems = await install(page, w);
    await open(page, w);
    await toRound(page, w, 6);
    await expect(rows(page)).toHaveCount(5);

    // Default: NEWEST. C and D changed in the same round → assetKey ascending (S < T).
    const group = page.getByRole("group", { name: "Queue order" });
    await expect(group.getByRole("button")).toHaveText([
      "NEWEST",
      "MOST EVENTS",
      "LARGEST VOLUME ACCELERATION",
      "LARGEST LIQUIDITY CHANGE",
    ]);
    await expect(group.getByRole("button", { name: "NEWEST" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await rowKeys(page)).toEqual([key(D), key(C), key(E), key(B), key(A)]);
    await expect(page.getByTestId("sort-caption")).toContainText("newest qualifying change");
    await shot(page, "sort-newest");

    await sortBy(page, "MOST EVENTS");
    const counts = await rows(page).evaluateAll((els) =>
      els.map((e) => Number(e.querySelector('[data-testid="row-key"]')!.textContent)),
    );
    expect([...counts].sort((x, y) => y - x)).toEqual(counts);
    await expect(page.getByTestId("sort-caption")).toContainText(
      "qualifying events observed this session",
    );
    await shot(page, "sort-most-events");

    await sortBy(page, "LARGEST VOLUME ACCELERATION");
    await expect(page.getByTestId("sort-caption")).toContainText(
      "volume-acceleration ratio, M5 vs H1 pace",
    );
    expect(await rowKeys(page)).toEqual([key(A), key(B), key(D), key(C), key(E)]);
    await expect(row(page, A).getByTestId("row-key")).toHaveText("11.00×");
    await expect(row(page, B).getByTestId("row-key")).toHaveText("3.67×");
    for (const t of [C, D, E]) {
      await expect(row(page, t).getByTestId("row-key")).toHaveText("—");
      await expect(row(page, t).getByTestId("row-key")).toHaveAttribute("data-missing", "true");
    }
    await shot(page, "sort-volume-acceleration");

    await sortBy(page, "LARGEST LIQUIDITY CHANGE");
    await expect(page.getByTestId("sort-caption")).toContainText("same observed pool");
    expect(await rowKeys(page)).toEqual([key(C), key(D), key(E), key(B), key(A)]);
    await expect(row(page, C).getByTestId("row-key")).toHaveText("−$50.0K");
    await expect(row(page, D).getByTestId("row-key")).toHaveText("+$30.0K");
    await shot(page, "sort-liquidity-change");
    expect(problems).toEqual([]);
  });

  test("tie-break stability: same-round changes keep assetKey order across re-sorts and new rounds", async ({
    page,
  }) => {
    const w = world();
    const problems = await install(page, w);
    await open(page, w);
    await toRound(page, w, 6);
    const first = await rowKeys(page);
    expect(first.slice(0, 2)).toEqual([key(D), key(C)]);
    // C and D share the exact observed onset.
    const at = await page
      .locator(`[data-key="${key(C)}"], [data-key="${key(D)}"]`)
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-newest-at")));
    expect(at[0]).toBe(at[1]);
    for (const s of ["MOST EVENTS", "LARGEST VOLUME ACCELERATION", "NEWEST"]) await sortBy(page, s);
    expect(await rowKeys(page)).toEqual(first);
    // Two more rounds with no new onset: nothing reorders.
    await toRound(page, w, 8);
    expect(await rowKeys(page)).toEqual(first);
    expect(problems).toEqual([]);
  });

  test("empty: NO QUALIFYING CHANGE OBSERVED THIS SESSION, with session start and assets observed", async ({
    page,
  }) => {
    const w = world({ feed: CALM });
    const problems = await install(page, w);
    await open(page, w);
    await toRound(page, w, 2);
    const empty = page.getByTestId("queue-empty");
    await expect(empty).toContainText("NO QUALIFYING CHANGE OBSERVED THIS SESSION");
    await expect(empty).toContainText("SESSION STARTED");
    await expect(empty.locator("time")).toHaveAttribute("datetime", /Z$/);
    await expect(page.getByTestId("assets-observed")).toHaveText("10");
    await expect(rows(page)).toHaveCount(0);
    await shot(page, "empty");
    expect(problems).toEqual([]);
  });

  test("stale: every lane fails after data → page STALE, rows stay, each marked STALE (never LIVE)", async ({
    page,
  }) => {
    const w = world({ solFrom: 2 });
    const problems = await install(page, w);
    await open(page, w);
    await toRound(page, w, 3);
    const before = await rowKeys(page);
    expect(before.length).toBeGreaterThan(0);
    w.fail = { realtime: "429", universe: "500" };
    for (let i = 0; i < 6; i++) {
      await page.clock.fastForward(30_000);
      await settle(page);
    }
    await expect(page.getByTestId("queue-state")).toHaveAttribute("data-state", "stale");
    expect(await rowKeys(page)).toEqual(before);
    const states = await rows(page).evaluateAll((els) =>
      els.map((e) => e.querySelector('[data-testid="row-state"]')!.getAttribute("data-state")),
    );
    expect(new Set(states)).toEqual(new Set(["stale"]));
    await expect(page.getByTestId("queue")).not.toContainText(/\bLIVE\b/);
    await shot(page, "stale");
    expect(problems).toEqual([]);
  });

  test("degraded: a partial universe round → page DEGRADED and feed rows DEGRADED; rows remain", async ({
    page,
  }) => {
    const w = world();
    const problems = await install(page, w);
    await open(page, w);
    await toRound(page, w, 3);
    w.fail = { ads: "500" };
    await toRound(page, w, 5);
    await expect(page.getByTestId("queue-state")).toHaveAttribute("data-state", "degraded");
    await expect(page.getByTestId("lane-universe")).toHaveAttribute("data-state", "degraded");
    await expect(row(page, A).getByTestId("row-state")).toHaveAttribute("data-state", "degraded");
    await expect(row(page, A).getByTestId("row-state")).toContainText("PARTIAL ROUND");
    await expect(rows(page)).toHaveCount(3); // A, B, E by round 5
    await shot(page, "degraded");
    expect(problems).toEqual([]);
  });

  test("429 on the realtime lane: canonical rows go STALE, universe rows stay LIVE (partial rows remain)", async ({
    page,
  }) => {
    const w = world({ solFrom: 2 });
    const problems = await install(page, w);
    await open(page, w);
    await toRound(page, w, 3);
    const sol = page.locator('[data-testid="queue-row"][data-key^="solana:So111"]');
    await expect(sol).toHaveCount(1);
    await expect(sol.getByTestId("row-state")).toHaveAttribute("data-state", "live");
    w.fail = { realtime: "429" };
    for (let i = 0; i < 3; i++) {
      await page.clock.fastForward(30_000);
      await settle(page);
    }
    await expect(page.getByTestId("lane-realtime")).toHaveAttribute("data-state", "stale");
    await expect(page.getByTestId("lane-realtime")).toContainText(/RATE_LIMITED|HTTP_ERROR/);
    await expect(page.getByTestId("queue-state")).toHaveAttribute("data-state", "degraded");
    await expect(sol).toHaveCount(1);
    await expect(sol.getByTestId("row-state")).toHaveAttribute("data-state", "stale");
    await expect(row(page, A).getByTestId("row-state")).toHaveAttribute(
      "data-state",
      /live|degraded/,
    );
    expect(problems).toEqual([]);
  });

  test("timeout on the universe lane: feed rows age to STALE, canonical rows stay LIVE", async ({
    page,
  }) => {
    const w = world({ solFrom: 2 });
    const problems = await install(page, w);
    await open(page, w);
    await toRound(page, w, 3);
    w.fail = { universe: "timeout" };
    for (let i = 0; i < 8; i++) {
      await page.clock.fastForward(30_000);
      await settle(page);
    }
    await expect(row(page, A)).toHaveCount(1);
    await expect(row(page, A).getByTestId("row-state")).toHaveAttribute("data-state", "stale");
    const sol = page.locator('[data-testid="queue-row"][data-key^="solana:So111"]');
    await expect(sol.getByTestId("row-state")).toHaveAttribute("data-state", /live|degraded/);
    await expect(page.getByTestId("queue-state")).not.toHaveAttribute("data-state", "live");
    expect(problems).toEqual([]);
  });

  test("an asset vanishing from the universe keeps its row, marked STALE — never faked LIVE", async ({
    page,
  }) => {
    const w = world({ vanish: { tag: "A", from: 4 } });
    const problems = await install(page, w);
    await open(page, w);
    await toRound(page, w, 3);
    await expect(row(page, A).getByTestId("row-state")).toHaveAttribute("data-state", "live");
    await toRound(page, w, 6);
    await expect(row(page, A)).toHaveCount(1);
    const st = row(page, A).getByTestId("row-state");
    await expect(st).toHaveAttribute("data-state", "stale");
    await expect(st).toHaveAttribute("data-reason", "AGE");
    await expect(st).toContainText("NO NEW OBSERVATION");
    // The rest of the page is still live.
    await expect(page.getByTestId("queue-state")).toHaveAttribute("data-state", "live");
    await expect(row(page, B).getByTestId("row-state")).toHaveAttribute("data-state", "live");
    expect(problems).toEqual([]);
  });

  test("Change Queue → Moment carries chain + address (Base58 exact, EVM lowercase); keyboard reachable", async ({
    page,
  }) => {
    const w = world({ wethFrom: 2 });
    const problems = await install(page, w);
    await open(page, w);
    await toRound(page, w, 3);

    // Keyboard: Tab reaches a row's real link; Enter follows it.
    const link = row(page, A).getByRole("link", { name: /OPEN IN THE MOMENT/ });
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      new RegExp(`/dashboard/moment\\?chain=solana&address=${addr("A")}$`),
    );
    expect(page.url()).not.toContain("pair=");
    await expect(page.getByTestId("asset-bar")).toHaveAttribute("data-key", key(A));

    await page.goBack();
    await expect(page.getByTestId("intel-question")).toHaveText("What deserves attention now?");
    const weth = page.locator('[data-testid="queue-row"][data-key^="ethereum:"]');
    await weth.getByRole("link", { name: /OPEN IN THE MOMENT/ }).click();
    await expect(page).toHaveURL(
      /\/dashboard\/moment\?chain=ethereum&address=0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2$/,
    );
    await expect(page.getByTestId("asset-bar")).toHaveAttribute(
      "data-key",
      "ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    );
    expect(problems).toEqual([]);
  });

  test("mobile layout: 375 px, no horizontal overflow; asset → evidence → action per row", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const w = world();
    const problems = await install(page, w);
    await open(page, w);
    await toRound(page, w, 6);
    await expect(rows(page)).toHaveCount(5);
    await noOverflow(page);
    const a = row(page, A);
    const box = async (id: string) => (await a.getByTestId(id).boundingBox())!;
    const link = (await a.getByRole("link", { name: /OPEN IN THE MOMENT/ }).boundingBox())!;
    const pool_ = await box("row-pool");
    const change = await box("row-change");
    expect(pool_.y).toBeLessThan(change.y);
    expect(change.y).toBeLessThan(link.y);
    expect(link.height).toBeGreaterThanOrEqual(36); // hit target
    await shot(page, "populated-375");
    await sortBy(page, "LARGEST LIQUIDITY CHANGE");
    await noOverflow(page);
    expect(problems).toEqual([]);
  });

  test("performance: ~96 assets (recorder max) — list render and per-second tick cost", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop", "measured once");
    test.setTimeout(180_000);
    const many: Token[] = Array.from({ length: 100 }, (_, i) => ({
      tag: B58[Math.floor(i / B58.length)] + B58[i % B58.length] + "x",
      sym: `Q${i}`,
      at: () => ({ m5: 4 + (i % 7) }),
    }));
    const w: World = { feed: [], uRound: 0, rtRound: 0 };
    // Rotate 36 tokens per universe round (12 per list × 3) so the session fills to the cap.
    const problems = await install(page, w);
    await page.unroute("https://api.dexscreener.com/**");
    await page.route("https://api.dexscreener.com/**", (r) => {
      const u = r.request().url();
      const json = (x: unknown) =>
        r.fulfill({ contentType: "application/json", body: JSON.stringify(x) });
      const slice = (k: number) => {
        const base = ((w.uRound - 1) * 36 + k * 12) % many.length;
        return Array.from({ length: 12 }, (_, j) => many[(base + j) % many.length]);
      };
      const item = (t: Token, i: number) => ({
        ...BOOSTS[0],
        url: `https://dexscreener.com/solana/${addr(t.tag).toLowerCase()}`,
        chainId: "solana",
        tokenAddress: addr(t.tag),
        amount: 10,
        totalAmount: 1000 - i,
      });
      if (u.includes("/token-boosts/latest/")) {
        w.uRound++;
        return json(slice(0).map(item));
      }
      if (u.includes("/token-boosts/top/")) return json(slice(1).map(item));
      if (u.includes("/ads/"))
        return json(
          slice(2).map((t) => ({
            ...ADS[0],
            url: `https://dexscreener.com/solana/${addr(t.tag).toLowerCase()}`,
            chainId: "solana",
            tokenAddress: addr(t.tag),
          })),
        );
      if (u.includes("/tokens/v1/solana/")) {
        const asked = decodeURIComponent(u.split("/tokens/v1/solana/")[1]).split(",");
        return json(many.filter((t) => asked.includes(addr(t.tag))).map((t) => feedPair(t, 0)));
      }
      if (u.includes("/tokens/v1/")) return json([]);
      if (u.includes("/latest/dex/pairs/")) {
        const chain = u.split("/latest/dex/pairs/")[1].split("/")[0];
        const p = canonical(chain, w).pairs[0];
        p.priceChange.m5 = 3.2;
        return json({ pairs: [p] });
      }
      return r.abort();
    });
    // Fill the session on the Overview, then enter the queue with a full list.
    await page.goto("/dashboard");
    await expect.poll(() => w.uRound, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
    await toRound(page, w, 3);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const metrics = async () => {
      const { metrics: m } = await cdp.send("Performance.getMetrics");
      const g = (n: string) => m.find((x) => x.name === n)?.value ?? 0;
      return {
        script: g("ScriptDuration"),
        layout: g("LayoutDuration"),
        style: g("RecalcStyleDuration"),
      };
    };
    const cost = (a: Awaited<ReturnType<typeof metrics>>, b: typeof a) =>
      Math.round((b.script - a.script + b.layout - a.layout + b.style - a.style) * 1000 * 10) / 10;

    const m0 = await metrics();
    const t0 = Date.now();
    await page
      .getByRole("navigation", { name: "Dashboard" })
      .getByRole("link", { name: "Change Queue", exact: true })
      .click();
    await expect(rows(page).first()).toBeVisible({ timeout: 15_000 });
    const mount = Date.now() - t0;
    const m1 = await metrics();
    const n = await rows(page).count();
    expect(n).toBeGreaterThanOrEqual(90);
    expect(n).toBeLessThanOrEqual(96);

    // Per-second tick: only age / freshness text changes; no row is added, removed or replaced.
    await page.evaluate(() => {
      const w = window as unknown as { __mut: { added: number; removed: number; text: number } };
      w.__mut = { added: 0, removed: 0, text: 0 };
      new MutationObserver((list) => {
        for (const m of list) {
          if (m.type === "characterData") w.__mut.text++;
          for (const x of m.addedNodes) if ((x as Element).tagName === "LI") w.__mut.added++;
          for (const x of m.removedNodes) if ((x as Element).tagName === "LI") w.__mut.removed++;
        }
      }).observe(document.querySelector('[data-testid="queue-list"]')!, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    });
    const m2 = await metrics();
    for (let i = 0; i < 10; i++) await page.clock.runFor(1_000);
    await page.waitForTimeout(300);
    const m3 = await metrics();
    const mut = await page.evaluate(
      () => (window as unknown as { __mut: Record<string, number> }).__mut,
    );
    expect(mut.added).toBe(0);
    expect(mut.removed).toBe(0);
    expect(mut.text).toBeGreaterThan(0);

    // One lane round re-renders the list once.
    const m4 = await metrics();
    await page.clock.fastForward(30_000);
    await settle(page);
    const m5 = await metrics();

    console.log(
      `CHANGE-QUEUE-PERF ${JSON.stringify({
        rows: n,
        mountWallMs: mount,
        mountCpuMs: cost(m0, m1),
        tickCpuMsPerSecond: Math.round((cost(m2, m3) / 10) * 10) / 10,
        textMutationsPer10s: mut.text,
        laneRoundCpuMs: cost(m4, m5),
      })}`,
    );
    await shot(page, "perf-96");
    expect(problems).toEqual([]);
  });
});
