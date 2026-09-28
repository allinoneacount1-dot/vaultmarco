import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * INTELLIGENCE SUITE — navigation skeleton, real app in a real browser.
 *
 * DexScreener is served from the recorded fixtures in tests/fixtures; every
 * other provider is aborted and TradingView gets a test-only loader.
 */

const fx = (n: string) =>
  JSON.parse(readFileSync(new URL(`../tests/fixtures/${n}`, import.meta.url), "utf8"));
const BOOSTS = fx("dexscreener.boosts.latest.json");
const ADS = fx("dexscreener.ads.latest.json");
const PAIRS = fx("dexscreener.pairs.canonical.json") as Record<string, unknown>;
const TOKENS = fx("dexscreener.tokens.solana.json");

const HONSE = "46vV3ZpFNLZn1CDRYnAvqPsdW5ejEYn9GK9kPcZFpump";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

const TV = `(()=>{const s=document.currentScript;const w=s.parentElement.querySelector(".tradingview-widget-container__widget");const f=document.createElement("iframe");f.srcdoc="<body></body>";w.appendChild(f);})();`;

const SOL = "So11111111111111111111111111111111111111112";

/**
 * Each built page: its question (the shell's h1), the page's own surface with
 * no asset selected, and the page's own evidence surface once a real
 * observation of the selected asset exists.
 */
const VIEWS = [
  {
    id: "moment",
    label: "The Moment",
    path: "/dashboard/moment",
    question: "What just changed?",
    empty: "moment-no-selection",
    body: "moment",
  },
  {
    id: "trace",
    label: "Vault Trace",
    path: "/dashboard/trace",
    question: "What moved first?",
    empty: "intel-empty",
    body: "trace-body",
  },
  {
    id: "edge-clock",
    label: "Edge Clock",
    path: "/dashboard/edge-clock",
    question: "How old is this move?",
    empty: "intel-empty",
    body: "clock-body",
  },
  {
    id: "divergence",
    label: "Divergence",
    path: "/dashboard/divergence",
    question: "What doesn't fit?",
    empty: "intel-empty",
    body: "divergence",
  },
  {
    id: "collision",
    label: "Collision",
    path: "/dashboard/collision",
    question: "What changed together?",
    empty: "intel-empty",
    body: "collision",
  },
  {
    id: "change-queue",
    label: "Change Queue",
    path: "/dashboard/change-queue",
    question: "What deserves attention now?",
    empty: "queue",
    body: "queue",
  },
];

/** The page's one question is its h1, inside the shell of that page. */
async function expectQuestion(page: Page, v: (typeof VIEWS)[number]) {
  await expect(
    page.getByRole("heading", { level: 1, name: v.question, exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("intel-shell")).toHaveAttribute("data-feature", v.id);
}

async function setup(page: Page, path = "/dashboard") {
  const problems: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    if (/Failed to load resource|net::ERR/.test(m.text())) return;
    problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("request", (r) => {
    if (r.url().startsWith("https://api.dexscreener.com/")) requests.push(r.url());
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
    if (u.includes("/tokens/v1/")) return json(u.includes("/solana/") ? TOKENS : []);
    if (u.includes("/latest/dex/pairs/")) {
      const chain = u.split("/latest/dex/pairs/")[1].split("/")[0];
      return json(PAIRS[chain] ?? { pairs: [] });
    }
    return r.abort();
  });
  await page.clock.install();
  await page.goto(path);
  await expect(page.getByTestId("desk-status")).toHaveAttribute("data-state", /live|degraded/, {
    timeout: 15_000,
  });
  return { problems, requests };
}

const nav = (page: Page) => page.getByRole("navigation", { name: "Dashboard" });
const navLink = (page: Page, label: string) =>
  nav(page).getByRole("link", { name: label, exact: true });

/** On narrow viewports the sidebar is a drawer: open it first. */
async function openNav(page: Page) {
  const trigger = page.getByRole("button", { name: "Open menu" });
  if (await trigger.isVisible()) {
    await trigger.click();
    await expect(page.getByRole("button", { name: "Close menu" }).first()).toBeVisible();
  }
}

async function expectOverview(page: Page) {
  await expect(page.getByRole("heading", { name: "Intelligence Desk" })).toBeVisible();
  for (const zone of ["MARKET CONTEXT", "FLOW", "SIGNAL", "MARKET"]) {
    await expect(page.getByRole("heading", { name: zone, exact: true })).toBeVisible();
  }
}

test.describe("Intelligence suite navigation", () => {
  test("sidebar lists OVERVIEW then the six views; each route loads its question; active state is exact", async ({
    page,
  }) => {
    const { problems } = await setup(page);
    await expectOverview(page);
    await openNav(page);
    const labels = await nav(page).getByRole("link").allInnerTexts();
    expect(labels.map((l) => l.trim().toUpperCase())).toEqual(
      ["Overview", ...VIEWS.map((v) => v.label)].map((l) => l.toUpperCase()),
    );
    await expect(navLink(page, "Overview")).toHaveAttribute("aria-current", "page");

    for (const v of VIEWS) {
      await openNav(page);
      await navLink(page, v.label).click();
      await expect(page).toHaveURL(new RegExp(`${v.path}$`));
      await expectQuestion(page, v);
      // No asset selected: the page's own honest surface, nothing presented as data.
      await expect(page.getByTestId(v.empty)).toBeVisible();
      if (v.empty === "intel-empty") {
        await expect(page.getByTestId("intel-empty")).toHaveAttribute("data-state", "none");
      }
      await openNav(page);
      await expect(navLink(page, v.label)).toHaveAttribute("aria-current", "page");
      await expect(navLink(page, "Overview")).not.toHaveAttribute("aria-current", "page");
      // Mobile: the drawer closes on navigation.
      if (await page.getByRole("button", { name: "Close menu" }).first().isVisible()) {
        await page.keyboard.press("Escape");
      }
    }

    await openNav(page);
    await navLink(page, "Overview").click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expectOverview(page);
    expect(problems).toEqual([]);
  });

  test("each built page renders its question and its own evidence surface for a selected asset", async ({
    page,
  }) => {
    const { problems } = await setup(page, `/dashboard/moment?chain=solana&address=${SOL}`);
    for (const v of VIEWS) {
      await openNav(page);
      await navLink(page, v.label).click();
      await expect(page).toHaveURL(new RegExp(`${v.path}(\\?|$)`));
      await expectQuestion(page, v);
      await expect(page.getByTestId(v.body)).toBeVisible();
      await expect(page.getByTestId("intel-empty")).toHaveCount(0);
      if (v.id !== "change-queue") {
        // The sidebar carries the focus identity (chain + address) between focused views.
        await expect(page.getByTestId("asset-bar")).toHaveAttribute("data-key", `solana:${SOL}`);
      }
      if (await page.getByRole("button", { name: "Close menu" }).first().isVisible()) {
        await page.keyboard.press("Escape");
      }
    }
    expect(problems).toEqual([]);
  });

  test("refresh on a nested route keeps the view and the asset; back/forward restore both", async ({
    page,
  }) => {
    const { problems } = await setup(page, `/dashboard/edge-clock?chain=solana&address=${HONSE}`);
    await expect(page.getByTestId("intel-question")).toHaveText("How old is this move?");
    await expect(page.getByTestId("asset-bar")).toHaveAttribute("data-key", `solana:${HONSE}`);
    await page.reload();
    await expect(page.getByTestId("intel-question")).toHaveText("How old is this move?");
    await expect(page.getByTestId("asset-bar")).toHaveAttribute("data-key", `solana:${HONSE}`);

    // The sidebar carries the asset to the next view.
    await openNav(page);
    await navLink(page, "Vault Trace").click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/trace\\?.*address=${HONSE}`));
    await expect(page.getByTestId("asset-bar")).toHaveAttribute("data-key", `solana:${HONSE}`);

    await page.goBack();
    await expect(page.getByTestId("intel-question")).toHaveText("How old is this move?");
    await page.goForward();
    await expect(page.getByTestId("intel-question")).toHaveText("What moved first?");
    expect(problems).toEqual([]);
  });

  test("Token Drawer → OPEN IN THE MOMENT navigates with canonical identity (Base58 case exact)", async ({
    page,
  }) => {
    const { problems } = await setup(page);
    await page.keyboard.press("ControlOrMeta+k");
    await page.getByTestId("global-search").getByRole("combobox").fill(HONSE);
    await page.keyboard.press("Enter");
    const drawer = page.getByTestId("token-drawer");
    await expect(drawer).toHaveAttribute("data-key", `solana:${HONSE}`);
    // Existing actions are all still there.
    for (const id of ["watch", "copy-ca", "open-dexscreener", "open-explorer"]) {
      await expect(drawer.getByTestId(id)).toBeVisible();
    }
    await drawer.getByTestId("open-moment").click();
    await expect(drawer).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/dashboard/moment\\?.*address=${HONSE}`));
    expect(page.url()).not.toContain("pair=");
    await expect(page.getByTestId("intel-question")).toHaveText("What just changed?");
    const bar = page.getByTestId("asset-bar");
    await expect(bar).toHaveAttribute("data-key", `solana:${HONSE}`);
    await expect(page.getByTestId("focus-freshness")).toHaveAttribute("data-state", "live");
    expect(problems).toEqual([]);
  });

  test("SELECT ASSET uses Global Search identity; EVM is lowercased in the URL", async ({
    page,
  }) => {
    const { problems } = await setup(page, "/dashboard/moment");
    await expect(page.getByTestId("focus-identity")).toHaveText("NO ASSET SELECTED");
    await page.getByTestId("select-asset").click();
    await page.getByRole("dialog").getByRole("combobox").fill(WETH);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/dashboard/moment\\?.*address=${WETH.toLowerCase()}`));
    await expect(page.getByTestId("asset-bar")).toHaveAttribute(
      "data-key",
      `ethereum:${WETH.toLowerCase()}`,
    );
    await expect(page.getByTestId("focus-identity")).toContainText("WETH");
    await page.getByTestId("clear-asset").click();
    await expect(page.getByTestId("focus-identity")).toHaveText("NO ASSET SELECTED");
    expect(problems).toEqual([]);
  });

  test("focus URL is chain + address only: a legacy pair param is ignored and dropped on navigation", async ({
    page,
  }) => {
    const { problems } = await setup(
      page,
      `/dashboard/moment?chain=ethereum&address=${WETH}&pair=0x11b815efB8f581194ae79006d24E0d814B7697F6`,
    );
    const bar = page.getByTestId("asset-bar");
    await expect(bar).toHaveAttribute("data-key", `ethereum:${WETH.toLowerCase()}`);
    // The pool is shown as evidence of the latest observation, not as URL scope.
    await expect(page.getByTestId("observed-pool")).toContainText("OBSERVED POOL");
    await openNav(page);
    await navLink(page, "Vault Trace").click();
    await expect(page).toHaveURL(/\/dashboard\/trace\?/);
    expect(page.url()).not.toContain("pair=");
    await expect(bar).toHaveAttribute("data-key", `ethereum:${WETH.toLowerCase()}`);
    expect(problems).toEqual([]);
  });

  test("a symbol in the URL is rejected; an unobserved address is NOT IN OBSERVED UNIVERSE", async ({
    page,
  }) => {
    const { problems } = await setup(page, "/dashboard/moment?chain=solana&address=SOL");
    await expect(page.getByTestId("focus-identity")).toContainText("ASSET IN URL REJECTED");
    await page.goto(
      "/dashboard/moment?chain=solana&address=9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    );
    await expect(page.getByTestId("focus-freshness")).toContainText("NOT IN OBSERVED UNIVERSE");
    expect(problems).toEqual([]);
  });

  test("request budget: no new/duplicate provider loop; intelligence routes keep the existing dashboard lanes active", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop", "measured once");
    test.setTimeout(300_000);
    const { requests } = await setup(page);
    const SOURCES = {
      pairs: "/latest/dex/pairs/",
      boosts: "/token-boosts/",
      ads: "/ads/",
      tokens: "/tokens/v1/",
    } as const;
    const kinds = (list: string[]) =>
      Object.fromEntries(
        Object.entries(SOURCES).map(([k, part]) => [
          k,
          list.filter((u) => u.includes(part)).length,
        ]),
      ) as Record<keyof typeof SOURCES, number>;
    /** Let in-flight work settle, then return the request count to measure from. */
    const settle = async () => {
      let seen = -1;
      while (seen !== requests.length) {
        seen = requests.length;
        await page.waitForTimeout(800);
      }
      return requests.length;
    };
    /**
     * A deterministic window: from a settled point, jump the fake clock in
     * whole 30 s ticks (the fast lane's cadence; the slow lane's is 2 ticks),
     * letting responses settle after each jump.
     */
    const window = async (ticks: number) => {
      const from = await settle();
      for (let i = 0; i < ticks; i++) {
        await page.clock.fastForward(30_000);
        await settle();
      }
      const list = requests.slice(from);
      return { counts: kinds(list), urls: new Set(list.map((u) => u.split("?")[0])) };
    };

    const overview = await window(6);
    const perView: Record<string, Record<string, number>> = {};
    const navRequests: Record<string, number> = {};
    for (const v of VIEWS) {
      const before = await settle();
      await openNav(page);
      await navLink(page, v.label).click();
      await expect(page.getByTestId("intel-question")).toHaveText(v.question);
      navRequests[v.path] = (await settle()) - before;
      const w = await window(6);
      perView[v.path] = w.counts;
      // No request unique to an intelligence route: every URL was already requested by the Overview.
      expect(
        [...w.urls].filter((u) => !overview.urls.has(u)),
        v.path,
      ).toEqual([]);
    }
    await openNav(page);
    await navLink(page, "Overview").click();
    await expectOverview(page);
    const back = await window(6);
    console.log(
      `REQUEST-BUDGET ${JSON.stringify({ overview: overview.counts, perView, navRequests, backOnOverview: back.counts })}`,
    );

    // Exact equality per source vs the Overview, and zero requests caused by entering a view.
    for (const v of VIEWS) {
      expect(perView[v.path], v.path).toEqual(overview.counts);
      expect(navRequests[v.path], `${v.path} navigation`).toBe(0);
    }
    expect(back.counts).toEqual(overview.counts);
  });
});
