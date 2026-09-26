import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assetFreshness } from "@/lib/intelligence/freshness";
import { batchFromUniverse, failureBatch } from "@/lib/intelligence/ingest";
import { createSessionState, ingest, observationCount } from "@/lib/intelligence/sessionHistory";
import { START, T0, realUniverse } from "./helpers";

const DIR = fileURLToPath(new URL("../../src/lib/intelligence/", import.meta.url));
const FILES = readdirSync(DIR).filter((f) => f.endsWith(".ts"));

describe("intelligence core — no clock, no randomness, no synthetic fallback", () => {
  it("pure modules never read the clock or randomness (observation time only comes from payloads)", () => {
    expect(FILES.length).toBeGreaterThan(5);
    for (const f of FILES) {
      const body = readFileSync(DIR + f, "utf8");
      expect(body, f).not.toMatch(/Date\.now\s*\(|new Date\(\s*\)|Math\.random|performance\.now/);
    }
  });

  it("no score / confidence / prediction vocabulary in the core types", () => {
    for (const f of FILES) {
      const body = readFileSync(DIR + f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(body, f).not.toMatch(/\bscore\b|confidence|probabilit|bullish|bearish|prediction/i);
    }
  });

  it("a failure with no prior data yields no observation — OFFLINE, never a placeholder", () => {
    const s = ingest(createSessionState(START), failureBatch("universe", T0, new Error("503"))!);
    expect(observationCount(s)).toBe(0);
    expect(assetFreshness(null, s.lanes, T0).state).toBe("offline");
  });

  it("an offline universe round contributes nothing", async () => {
    const u = await realUniverse(T0, T0);
    const offline = { ...u, radarInputs: { ...u.radarInputs, status: "offline" as const } };
    const s = ingest(createSessionState(START), batchFromUniverse(offline, T0)!);
    expect(observationCount(s)).toBe(0);
  });
});
