import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Invariant: NO_SYNTHETIC_MARKET_DATA_IN_PRODUCTION
 *
 * This guard fails the build if simulated financial data can reach the
 * production bundle again. It is deliberately written against the source tree
 * rather than a mock, so it keeps holding as the code changes.
 */

const SRC = fileURLToPath(new URL("../../src", import.meta.url));
const ROOT = fileURLToPath(new URL("../..", import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const FILES = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f));
const rel = (f: string) => relative(ROOT, f).split(sep).join("/");
const read = (f: string) => readFileSync(f, "utf8");

/**
 * The single permitted `Math.random()` in the tree. It sets a CSS width for a
 * shadcn skeleton placeholder bar and touches no financial value. Listed here
 * explicitly so any new occurrence fails this test.
 */
const RANDOM_ALLOWLIST = new Set(["src/components/ui/sidebar.tsx"]);

describe("NO_SYNTHETIC_MARKET_DATA_IN_PRODUCTION", () => {
  it("no production source randomizes any value outside the documented allowlist", () => {
    const offenders = FILES.filter((f) => /Math\.random\s*\(/.test(read(f)))
      .map(rel)
      .filter((f) => !RANDOM_ALLOWLIST.has(f));
    expect(offenders).toEqual([]);
  });

  it("the allowlisted Math.random touches only a skeleton width, never market data", () => {
    for (const allowed of RANDOM_ALLOWLIST) {
      const body = read(join(ROOT, allowed));
      const lines = body.split("\n").filter((l) => /Math\.random\s*\(/.test(l));
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line).toMatch(/%`|width/i);
        expect(line).not.toMatch(/price|px\b|volume|mcap|market|liquidity|boost|change|gas/i);
      }
    }
  });

  it("no hardcoded market-data fallback constants survive in production source", () => {
    const banned = [
      "FALLBACK_MARKET_DATA",
      "FALLBACK_BOOSTS",
      "FALLBACK_ADS",
      "mockData",
      "FALLBACK_PAIRS",
      'simulate "live"',
      "simulate 'live'",
    ];
    const offenders: string[] = [];
    for (const file of FILES) {
      const body = read(file);
      for (const needle of banned) {
        if (body.includes(needle)) offenders.push(`${rel(file)} :: ${needle}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("production source never imports test fixtures", () => {
    const offenders = FILES.filter((f) => /from\s+["'].*(tests|fixtures)\//.test(read(f))).map(rel);
    expect(offenders).toEqual([]);
  });

  it("no hardcoded market price literals survive in the DEX realtime path", () => {
    // The values the DEXTOOLS tab used to serve as live market data.
    const priceLiterals = [/"178\.5"/, /"3620"/, /"0\.0245"/, /"12\.5"/, /priceUsd:\s*["']\d/];
    const dexFiles = FILES.filter(
      (f) => rel(f).includes("DexRealtimeTab") || rel(f).includes("providers/dexPairs"),
    );
    expect(dexFiles.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of dexFiles) {
      const body = read(file);
      for (const re of priceLiterals) {
        if (re.test(body)) offenders.push(`${rel(file)} :: ${re}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("pair selection never sorts candidates by liquidity to pick a winner", () => {
    // Sorting by liquidity is exactly how "AERO/USDC" resolved to SPX/USDC and
    // how a spoofed SOL with $2.16B of fake depth beat the real Orca pool.
    const dexFiles = FILES.filter(
      (f) => rel(f).includes("DexRealtimeTab") || rel(f).includes("providers/dexPairs"),
    );
    const offenders = dexFiles.filter((f) => /sort\([^)]*liquidity/s.test(read(f))).map(rel);
    expect(offenders).toEqual([]);
  });

  it("the provider layer never reads the wrapper fields the old parser assumed", () => {
    // The DexScreener boosts/ads endpoints return bare arrays. Reading
    // `data.boosts` / `data.ads` is what silently produced empty feeds.
    const providerFiles = FILES.filter((f) => rel(f).startsWith("src/lib/providers/"));
    expect(providerFiles.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of providerFiles) {
      const body = read(file);
      if (/\bdata\.(boosts|ads|takeovers|updates)\b/.test(body)) offenders.push(rel(file));
      if (/\bitem\.token\?\./.test(body)) offenders.push(`${rel(file)} :: item.token`);
    }
    expect(offenders).toEqual([]);
  });

  it("`memo` is imported from react, never from framer-motion", () => {
    // framer-motion exports a one-shot value cache also called `memo`; importing
    // it froze the dashboard on its first render.
    const offenders = FILES.filter((f) =>
      /import\s*\{[^}]*\bmemo\b[^}]*\}\s*from\s*["']framer-motion["']/.test(read(f)),
    ).map(rel);
    expect(offenders).toEqual([]);
  });
});
