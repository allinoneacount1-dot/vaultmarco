import { test, expect, type Page } from "@playwright/test";

/**
 * THE VAULT INDEX — CTA clickability.
 *
 * These tests exist because of a bug where every href was correct but no click
 * ever reached the link: @react-three/fiber sets `pointerEvents: "auto"` on its
 * canvas container, overriding the `pointer-events-none` wrapper around the
 * decorative hero scene. Since that wrapper is `fixed inset-0`, the canvas
 * covered the viewport at every scroll position and swallowed the clicks.
 *
 * Asserting on `href` therefore proves nothing. Every test below performs a real
 * mouse click at the CTA's own centre and asserts on the URL that actually opens.
 */

const CTAS = [
  { label: "DEPLOY THE BOT", expected: "https://t.me/achilles_trojanbot?start=r-oxjackpot" },
  { label: "ENTER THE TERMINAL", expected: "https://trade.padre.gg/rk/dexmultichain" },
  { label: "Elite Access", expected: "https://t.me/+LXLE9HVc8sA0YWQ8" },
  { label: "Community Group", expected: "https://t.me/DxmZone" },
  { label: "Alpha Channel", expected: "https://t.me/DexMultichain" },
] as const;

/** Centre point of the CTA's own label, plus whatever the browser hit-tests there. */
async function probe(page: Page, label: string) {
  return page.evaluate((name) => {
    const eco = document.getElementById("ecosystem");
    if (!eco) throw new Error("#ecosystem not found");
    const el = [...eco.querySelectorAll("span,h3,div")].find(
      (e) =>
        e.textContent?.replace(/\s+/g, " ").trim().startsWith(name) &&
        e.querySelector("a") === null,
    );
    if (!el) throw new Error(`CTA label "${name}" not found`);
    const anchor = el.closest("a");
    if (!anchor) throw new Error(`CTA "${name}" has no ancestor <a>`);

    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    const cx = Math.round(r.x + r.width / 2);
    const cy = Math.round(r.y + r.height / 2);

    const stack = document.elementsFromPoint(cx, cy);
    const idx = stack.indexOf(anchor);
    // Anything painted above the anchor that is not one of its own descendants
    // is a genuine interception.
    const blockers = stack
      .slice(0, idx < 0 ? stack.length : idx)
      .filter((n) => !anchor.contains(n))
      .map((n) => `${n.tagName}.${String((n as HTMLElement).className || "").split(" ")[0]}`);

    return {
      cx,
      cy,
      href: anchor.getAttribute("href"),
      target: anchor.target,
      rel: anchor.rel,
      blockers,
    };
  }, label);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });
  // Let the lazy 3D hero mount; the bug only appears once the canvas exists.
  await page.waitForTimeout(5000);
  await page.evaluate(() => document.getElementById("ecosystem")?.scrollIntoView());
  await page.waitForTimeout(800);
});

for (const cta of CTAS) {
  test(`vault-index CTA "${cta.label}" is clickable and opens the correct destination`, async ({
    page,
  }) => {
    const info = await probe(page, cta.label);

    // Wiring is intact...
    expect(info.href, "href").toBe(cta.expected);
    expect(info.target, "opens in a new tab").toBe("_blank");
    expect(info.rel, "external link safety").toContain("noopener");

    // ...and nothing is painted over the link.
    expect(info.blockers, `pointer interception at (${info.cx},${info.cy})`).toEqual([]);

    // The assertion that actually matters: a real click reaches the link.
    const [popup] = await Promise.all([
      page.waitForEvent("popup", { timeout: 10_000 }),
      page.mouse.click(info.cx, info.cy),
    ]);

    expect(popup, "a real mouse click must open the destination").toBeTruthy();
    const opened = popup.url();
    await popup.close();

    expect(opened, "opened URL").toContain(cta.expected);
  });
}

test("the decorative hero canvas never intercepts pointer events", async ({ page }) => {
  const canvasPE = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return null; // no 3D on this device — nothing to intercept
    const chain: string[] = [];
    for (let n: Element | null = c; n && n !== document.documentElement; n = n.parentElement) {
      chain.push(getComputedStyle(n).pointerEvents);
    }
    return chain;
  });

  if (canvasPE === null) test.skip(true, "no WebGL canvas on this viewport");
  // The canvas and every wrapper R3F puts around it must stay non-interactive.
  expect(canvasPE!.slice(0, 4).every((pe) => pe === "none")).toBe(true);
});

test("referral parameters survive on the two revenue links", async ({ page }) => {
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll("#ecosystem a")].map((a) => a.getAttribute("href")),
  );
  expect(hrefs).toContain("https://t.me/achilles_trojanbot?start=r-oxjackpot");
  expect(hrefs).toContain("https://trade.padre.gg/rk/dexmultichain");
});
