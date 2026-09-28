import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * INTELLIGENCE SUITE — adversarial inputs across ALL SIX views in one live
 * session. DexScreener is served from the recorded fixtures in tests/fixtures;
 * each scenario corrupts them only here, in the test. The session is kept
 * (in-app sidebar navigation), so every view reads the same recorded history.
 *
 * Invariants on every view in every scenario: no page error or console error,
 * no NaN / Infinity / undefined / negative age on screen, the view's own
 * question, and freshness that never claims LIVE for evidence a failed round
 * could not refresh.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pair = Record<string, any>;
const fx = (n: string) =>
  JSON.parse(readFileSync(new URL(`../tests/fixtures/${n}`, import.meta.url), "utf8"));
const BOOSTS = fx("dexscreener.boosts.latest.json");
const ADS = fx("dexscreener.ads.latest.json");
const PAIRS = fx("dexscreener.pairs.canonical.json") as Record<string, { pairs: Pair[] }>;
const TOKENS = fx("dexscreener.tokens.solana.json");

const SOL = "So11111111111111111111111111111111111111112";
const WETH_MIXED = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

const TV = `(()=>{const s=document.currentScript;const w=s.parentElement.querySelector(".tradingview-widget-container__widget");const f=document.createElement("iframe");f.srcdoc="<body></body>";w.appendChild(f);})();`;

type Mode = "ok" | "429" | "timeout" | "malformed" | "missing-sol" | "zeros" | "no-windows";

const VIEWS = [
  { id: "moment", label: "The Moment", question: "What just changed?", body: "moment" },
  { id: "trace", label: "Vault Trace", question: "What moved first?", body: "trace-body" },
  { id: "edge-clock", label: "Edge Clock", question: "How old is this move?", body: "clock-body" },
  { id: "divergence", label: "Divergence", question: "What doesn't fit?", body: "divergence" },
  { id: "collision", label: "Collision", question: "What changed together?", body: "collision" },
  {
    id: "change-queue",
    label: "Change Queue",
    question: "What deserves attention now?",
    body: "queue",
  },
] as const;
type View = (typeof VIEWS)[number];

function corrupt(p: Pair, mode: Mode): Pair {
  const q = structuredClone(p);
  if (mode === "zeros") {
    q.liquidity = { ...q.liquidity, usd: 0 };
    q.volume = { m5: 0, h1: 0, h6: 0, h24: 0 };
    q.priceChange = { m5: 0, h1: 0, h6: 0, h24: 0 };
    const z = { buys: 0, sells: 0 };
    q.txns = { m5: z, h1: z, h6: z, h24: z };
  }
  if (mode === "no-windows") {
    delete q.volume.m5;
    delete q.volume.h1;
    delete q.priceChange.m5;
    delete q.priceChange.h1;
    delete q.txns.m5;
    delete q.txns.h1;
  }
  return q;
}

async function setup(page: Page, path: string, world: { mode: Mode }) {
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
    const mode = world.mode;
    if (mode === "429") return r.fulfill({ status: 429, body: "" });
    if (mode === "timeout") return new Promise<void>(() => {}); // never answers → client TIMEOUT
    if (mode === "malformed") {
      return r.fulfill({ contentType: "application/json", body: '{"pairs": [{"chainId": ' });
    }
    const json = (x: unknown) =>
      r.fulfill({ contentType: "application/json", body: JSON.stringify(x) });
    if (u.includes("/token-boosts/")) return json(BOOSTS);
    if (u.includes("/ads/")) return json(ADS);
    if (u.includes("/tokens/v1/")) return json(u.includes("/solana/") ? TOKENS : []);
    if (u.includes("/latest/dex/pairs/")) {
      const chain = u.split("/latest/dex/pairs/")[1].split("/")[0];
      if (mode === "missing-sol" && chain === "solana") return json({ pairs: [] });
      const src = PAIRS[chain];
      if (!src) return json({ pairs: [] });
      return json({ pairs: src.pairs.map((p) => corrupt(p, mode)) });
    }
    return r.abort();
  });
  await page.clock.install();
  await page.goto(path);
  await expect(page.getByTestId("desk-status")).toHaveAttribute("data-state", /live|degraded/, {
    timeout: 15_000,
  });
  return problems;
}

const settle = (page: Page) => page.waitForTimeout(500);

/** n provider rounds (30 s each), then let retries and client timeouts run out. */
async function rounds(page: Page, n: number) {
  for (let i = 0; i < n; i++) {
    await page.clock.fastForward(30_000);
    await settle(page);
  }
  for (let i = 0; i < 4; i++) {
    await page.clock.runFor(3_000);
    await settle(page);
  }
}

const nav = (page: Page) => page.getByRole("navigation", { name: "Dashboard" });

async function go(page: Page, v: View) {
  const trigger = page.getByRole("button", { name: "Open menu" });
  if (await trigger.isVisible()) await trigger.click();
  await nav(page).getByRole("link", { name: v.label, exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: v.question, exact: true }),
  ).toBeVisible();
  if (await page.getByRole("button", { name: "Close menu" }).first().isVisible()) {
    await page.keyboard.press("Escape");
  }
}

async function invariants(page: Page, v: View) {
  const text = await page.locator("main").innerText();
  expect(text, v.id).not.toMatch(/\bNaN\b|Infinity|undefined|\[object Object\]/);
  // An age is never negative (ageLabel renders "—" for a future time).
  expect(text, v.id).not.toMatch(/[−-]\d{2}m \d{2}s AGO/);
}

/** Visit every view in the same session and run `check` on each. */
async function everyView(page: Page, check: (v: View) => Promise<void>) {
  for (const v of VIEWS) {
    await go(page, v);
    await invariants(page, v);
    await check(v);
  }
}

const focused = (v: View) => v.id !== "change-queue";

test.describe("Intelligence suite — adversarial, all six views", () => {
  for (const mode of ["429", "timeout", "malformed"] as const) {
    test(`provider ${mode} after real data: every view keeps the last observation, STALE, never LIVE`, async ({
      page,
    }) => {
      const world = { mode: "ok" as Mode };
      const problems = await setup(page, `/dashboard/moment?chain=solana&address=${SOL}`, world);
      await rounds(page, 2);
      await expect(page.getByTestId("moment")).toBeVisible();
      world.mode = mode;
      await rounds(page, 3);
      await everyView(page, async (v) => {
        if (focused(v)) {
          await expect(page.getByTestId(v.body)).toBeVisible();
          await expect(page.getByTestId("focus-freshness")).toHaveAttribute("data-state", "stale");
          await expect(page.getByTestId("freshness-note")).toHaveAttribute("data-state", "stale");
        } else {
          // Page level: never LIVE (a universe round that ran on the realtime lane's
          // still-cached payload is recorded as partial → DEGRADED, then STALE).
          await expect(page.getByTestId("queue-state")).toHaveAttribute(
            "data-state",
            /stale|degraded/,
          );
          // The row of the failed asset itself is STALE.
          const sol = page.locator(`[data-testid="queue-row"][data-key="solana:${SOL}"]`);
          await expect(sol.getByTestId("row-state")).toHaveAttribute("data-state", "stale");
        }
      });
      // Recovery needs a NEW observation.
      world.mode = "ok";
      await rounds(page, 2);
      await go(page, VIEWS[0]);
      await expect(page.getByTestId("focus-freshness")).toHaveAttribute("data-state", /live/);
      expect(problems).toEqual([]);
    });
  }

  test("one canonical pair missing (the selected asset vanishes): STALE on every view, evidence retained", async ({
    page,
  }) => {
    const world = { mode: "ok" as Mode };
    const problems = await setup(page, `/dashboard/moment?chain=solana&address=${SOL}`, world);
    await rounds(page, 2);
    world.mode = "missing-sol";
    await rounds(page, 2);
    await everyView(page, async (v) => {
      if (focused(v)) {
        await expect(page.getByTestId(v.body)).toBeVisible();
        await expect(page.getByTestId("focus-freshness")).toHaveAttribute("data-state", "stale");
        await expect(page.getByTestId("freshness-note")).toContainText("DID NOT RESOLVE THIS PAIR");
      } else {
        await expect(page.getByTestId("queue-state")).not.toHaveAttribute("data-state", "live");
      }
    });
    expect(problems).toEqual([]);
  });

  test("zero liquidity / volume / txns are data on every view (0, never — and never NaN)", async ({
    page,
  }) => {
    const world = { mode: "zeros" as Mode };
    const problems = await setup(page, `/dashboard/moment?chain=solana&address=${SOL}`, world);
    await rounds(page, 2);
    await everyView(page, async (v) => {
      if (focused(v)) await expect(page.getByTestId(v.body)).toBeVisible();
      if (v.id === "divergence") {
        const value = (field: string) =>
          page
            .locator(`[data-testid="raw-metric"][data-field="${field}"]`)
            .getByTestId("raw-metric-value");
        await expect(value("volume.m5")).toHaveText("$0.00");
        await expect(value("liquidity.usd")).toHaveText("$0.00");
        await expect(value("txns.m5.buys")).toHaveText("0");
        await expect(value("priceChange.m5")).toHaveText("0.00%");
      }
    });
    expect(problems).toEqual([]);
  });

  test("missing m5 / h1 windows render — and are NOT EVALUABLE, never 0", async ({ page }) => {
    const world = { mode: "no-windows" as Mode };
    const problems = await setup(page, `/dashboard/moment?chain=solana&address=${SOL}`, world);
    await rounds(page, 2);
    await everyView(page, async (v) => {
      if (focused(v)) await expect(page.getByTestId(v.body)).toBeVisible();
      if (v.id === "divergence") {
        await expect(
          page
            .locator('[data-testid="raw-metric"][data-field="volume.m5"]')
            .getByTestId("raw-metric-value"),
        ).toHaveText("—");
        await expect(
          page.locator('[data-testid="divergence-row"][data-state="NOT_EVALUABLE"]'),
        ).toHaveCount(6);
      }
    });
    expect(problems).toEqual([]);
  });

  test("timestamp inversion (receive clock moves backwards): no crash, no negative age on any view", async ({
    page,
  }) => {
    const world = { mode: "ok" as Mode };
    const problems = await setup(page, `/dashboard/moment?chain=solana&address=${SOL}`, world);
    await rounds(page, 2);
    const now = await page.evaluate(() => Date.now());
    await page.clock.setSystemTime(now - 5 * 60_000);
    await rounds(page, 2);
    await everyView(page, async (v) => {
      if (focused(v)) await expect(page.getByTestId(v.body)).toBeVisible();
    });
    expect(problems).toEqual([]);
  });

  test("duplicate observations (identical payload every round) change no view's evidence", async ({
    page,
  }) => {
    const world = { mode: "ok" as Mode };
    const problems = await setup(page, `/dashboard/moment?chain=solana&address=${SOL}`, world);
    await rounds(page, 2);
    const signature = async (v: View) => {
      switch (v.id) {
        case "moment":
          return `changes=${await page.getByTestId("moment-change").count()}`;
        case "trace":
          return `rows=${await page.getByTestId("trace-row").count()}`;
        case "edge-clock":
          return `clock=${await page.getByTestId("edge-clock").getAttribute("data-state")}`;
        case "divergence":
          return `diverged=${await page.getByTestId("divergence-headline").getAttribute("data-diverged")}`;
        case "collision":
          return `count=${await page.getByTestId("collision").getAttribute("data-count")}`;
        case "change-queue":
          return `rows=${await page.getByTestId("queue-row").count()}`;
      }
    };
    const before: Record<string, string> = {};
    await everyView(page, async (v) => {
      before[v.id] = await signature(v);
    });
    await rounds(page, 4);
    const after: Record<string, string> = {};
    await everyView(page, async (v) => {
      after[v.id] = await signature(v);
    });
    expect(after).toEqual(before);
    expect(problems).toEqual([]);
  });

  test("identity: EVM mixed case resolves to the lowercase asset on every focused view", async ({
    page,
  }) => {
    const world = { mode: "ok" as Mode };
    const problems = await setup(
      page,
      `/dashboard/moment?chain=ethereum&address=${WETH_MIXED}`,
      world,
    );
    await rounds(page, 1);
    await everyView(page, async (v) => {
      if (!focused(v)) return;
      await expect(page.getByTestId("asset-bar")).toHaveAttribute(
        "data-key",
        `ethereum:${WETH_MIXED.toLowerCase()}`,
      );
      await expect(page.getByTestId(v.body)).toBeVisible();
    });
    expect(problems).toEqual([]);
  });

  test("identity: a Base58 case variant is a different asset — NOT IN OBSERVED UNIVERSE, never SOL", async ({
    page,
  }) => {
    const world = { mode: "ok" as Mode };
    const variant = SOL.toLowerCase();
    const problems = await setup(page, `/dashboard/moment?chain=solana&address=${variant}`, world);
    await rounds(page, 1);
    await everyView(page, async (v) => {
      if (!focused(v)) return;
      await expect(page.getByTestId("asset-bar")).toHaveAttribute("data-key", `solana:${variant}`);
      await expect(page.getByTestId("focus-freshness")).toHaveAttribute("data-state", "unobserved");
      await expect(page.getByTestId(v.body)).toHaveCount(0);
      // SOL's observed price is never substituted for the variant.
      await expect(page.locator("main")).not.toContainText("103.27");
    });
    expect(problems).toEqual([]);
  });
});
