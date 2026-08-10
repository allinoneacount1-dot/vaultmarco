// Wiring & console audit (spec §10): crawls every route, collects console errors,
// verifies every anchor href resolves, and external links carry rel=noopener.
import { chromium } from "/tmp/node_modules/playwright/index.mjs";

const BASE = process.env.AUDIT_BASE || "http://127.0.0.1:3000";
const ROUTES = ["/", "/dashboard", "/dashboard/rug-scanner", "/auth"];
const KNOWN_INTERNAL = new Set(ROUTES);
// network errors expected inside the sandbox (no external egress)
const NET_NOISE = /net::ERR|Failed to fetch|Load failed|ERR_TUNNEL|CoinGecko|dexscreener|TypeError: Failed/i;

const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });

const problems = [];
for (const route of ROUTES) {
  const errors = [];
  const onConsole = (m) => {
    if (m.type() === "error" && !NET_NOISE.test(m.text())) errors.push(m.text().slice(0, 200));
  };
  const onPageError = (e) => {
    if (!NET_NOISE.test(String(e))) errors.push("pageerror: " + String(e).slice(0, 200));
  };
  p.on("console", onConsole);
  p.on("pageerror", onPageError);
  await p.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(3500);

  const links = await p.evaluate(() =>
    [...document.querySelectorAll("a[href]")].map((a) => ({
      href: a.getAttribute("href"),
      rel: a.getAttribute("rel") || "",
      target: a.getAttribute("target") || "",
    })),
  );
  const ids = await p.evaluate(() => [...document.querySelectorAll("[id]")].map((e) => e.id));
  const idSet = new Set(ids);

  for (const l of links) {
    if (!l.href) continue;
    if (l.href.startsWith("http")) {
      if (l.target === "_blank" && !/noopener/.test(l.rel))
        problems.push(`${route}: external ${l.href} missing rel=noopener`);
    } else if (l.href.startsWith("/")) {
      const path = l.href.split("#")[0].split("?")[0].replace(/\/$/, "") || "/";
      if (!KNOWN_INTERNAL.has(path)) problems.push(`${route}: internal href ${l.href} → unknown route`);
      const hash = l.href.includes("#") ? l.href.split("#")[1] : null;
      if (hash && route === "/" && !idSet.has(hash))
        problems.push(`${route}: anchor #${hash} has no matching [id]`);
    } else if (l.href.startsWith("#")) {
      const hash = l.href.slice(1);
      if (hash && !idSet.has(hash)) problems.push(`${route}: anchor ${l.href} has no [id]`);
    }
  }
  if (errors.length) problems.push(`${route}: console errors → ${errors.join(" | ")}`);
  p.off("console", onConsole);
  p.off("pageerror", onPageError);
  console.log(`checked ${route}: ${links.length} links, ${errors.length} console errors`);
}

await b.close();
if (problems.length) {
  console.error("\nAUDIT FAILURES:");
  for (const x of problems) console.error(" -", x);
  process.exit(1);
}
console.log("\nAUDIT PASS: all links wired, no unexpected console errors.");
