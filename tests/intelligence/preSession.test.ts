import { describe, expect, it } from "vitest";
import { assetKey } from "@/lib/assetIdentity";
import type { AssetObservation, IngestBatch, RadarFiring } from "@/lib/intelligence/facts";
import { extractAssetEvents } from "@/lib/intelligence/events";
import { failureBatch } from "@/lib/intelligence/ingest";
import { createSessionState, ingest } from "@/lib/intelligence/sessionHistory";
import { MIN, SEC, SOL_KEY, SOL_PAIR, START, T0, TOKEN_A, WETH_PAIR, batch, obs } from "./helpers";

/**
 * Nothing observed or recorded before the session began may become session
 * evidence — not an observation, not a lane point, not a gap, not a radar
 * firing, and not the "before" state of an in-session transition.
 */
describe("pre-session state is rejected everywhere", () => {
  it("a cached pre-session failed query + the first successful session round does NOT emit PROVIDER_RECOVERED", () => {
    let s = createSessionState(START);
    s = ingest(s, failureBatch("realtime", START - 20 * SEC, { code: "TIMEOUT" })!);
    s = ingest(s, failureBatch("universe", START - 5 * SEC, { code: "HTTP_ERROR" })!);
    expect(s.lanes.realtime.points).toEqual([]);
    expect(s.lanes.universe.points).toEqual([]);
    expect(s.rejected.preSession).toBe(2);
    s = ingest(s, batch("realtime", T0, [obs(SOL_PAIR, T0)]));
    s = ingest(s, batch("universe", T0 + 10 * SEC, [obs(SOL_PAIR, T0, {}, "universe")]));
    const ev = extractAssetEvents(s.assets.get(SOL_KEY)!, s.lanes);
    expect(ev.filter((e) => e.family === "PROVIDER")).toEqual([]);
  });

  it("a pre-session gap does not produce PROVIDER_STALE", () => {
    let s = createSessionState(START);
    s = ingest(s, batch("realtime", T0, [obs(SOL_PAIR, T0)]));
    s = ingest(
      s,
      batch("realtime", T0 + 30 * SEC, [], {
        gaps: [
          {
            assetKey: SOL_KEY,
            chainId: "solana",
            address: SOL_PAIR.baseToken.address,
            at: START - SEC,
            lane: "realtime",
            reason: "PROVIDER_ERROR",
          },
        ],
      }),
    );
    expect(s.assets.get(SOL_KEY)!.gaps).toEqual([]);
    const ev = extractAssetEvents(s.assets.get(SOL_KEY)!, s.lanes);
    expect(ev.some((e) => e.type === "PROVIDER_STALE")).toBe(false);
  });

  it("the radar guard rejects pre-session firings", () => {
    let s = createSessionState(START);
    s = ingest(s, batch("universe", T0, [obs(SOL_PAIR, T0, {}, "universe")]));
    const firing: { assetKey: string } & RadarFiring = {
      assetKey: SOL_KEY,
      kind: "MOMENTUM",
      observedAt: START - MIN,
      roundAt: T0,
      direction: null,
      severity: null,
      value: 4,
      prior: null,
      priorObservedAt: null,
      reasons: [],
    };
    s = ingest(s, batch("universe", T0 + MIN, [], { radar: [firing] }));
    expect(s.assets.get(SOL_KEY)!.radar).toEqual([]);
  });

  it("property: every extracted EvidenceEvent.observedAt (and priorObservedAt) ≥ session.startedAt over mixed inputs", () => {
    // Deterministic LCG — reproducible "random" sequences, no Math.random.
    let seed = 20260927;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
    const pairs = [SOL_PAIR, WETH_PAIR, TOKEN_A];
    const keyOf = (p: typeof SOL_PAIR) => assetKey(p.chainId, p.baseToken.address);
    for (let run = 0; run < 150; run++) {
      let s = createSessionState(START);
      for (let step = 0; step < 40; step++) {
        // Times from 10 min before the session to 40 min into it, out of order.
        const at = START - 10 * MIN + Math.floor(rnd() * 50 * MIN);
        const lane = pick(["realtime", "universe"] as const);
        const kind = rnd();
        let b: IngestBatch;
        if (kind < 0.2) {
          b = failureBatch(lane, at, { code: "RATE_LIMITED" })!;
        } else {
          const p = pick(pairs);
          const o: AssetObservation = obs(
            p,
            at - Math.floor(rnd() * 20 * SEC),
            {
              priceChange: { m5: pick([-6, -4, 0, 1, 4, 6, null]) },
              liquidityUsd: pick([0, 40_000, 100_000, 60_000, null]),
              boostsActive: pick([null, 5, 10, 12]),
              txns: {
                m5: pick([
                  { buys: 30, sells: 10 },
                  { buys: 10, sells: 30 },
                  { buys: 5, sells: 5 },
                ]),
              },
              pairAddress: pick([
                p.pairAddress ?? null,
                "OtherPoo1111111111111111111111111111111111",
              ]),
            },
            lane,
            pick(["live", "degraded"] as const),
          );
          b = batch(lane, at, [o], {
            state: pick(["ok", "partial"] as const),
            gaps:
              rnd() < 0.3
                ? [
                    {
                      assetKey: keyOf(p),
                      chainId: p.chainId,
                      address: p.baseToken.address,
                      at: at - Math.floor(rnd() * 5 * MIN),
                      lane,
                      reason: "NOT_FOUND",
                    },
                  ]
                : [],
            radar:
              rnd() < 0.3
                ? [
                    {
                      assetKey: keyOf(p),
                      kind: pick(["MOMENTUM", "RISK"] as const),
                      observedAt: o.observedAt - pick([0, 0, 15 * MIN]),
                      roundAt: at,
                      direction: pick([null, "ADDED", "REMOVED"] as const),
                      severity: null,
                      value: 1,
                      prior: null,
                      priorObservedAt: null,
                      reasons: [],
                    },
                  ]
                : [],
          });
        }
        s = ingest(s, b);
      }
      for (const lane of Object.values(s.lanes)) {
        for (const p of lane.points) expect(p.at).toBeGreaterThanOrEqual(START);
      }
      for (const t of s.assets.values()) {
        for (const e of extractAssetEvents(t, s.lanes)) {
          expect(e.observedAt).toBeGreaterThanOrEqual(START);
          if (e.priorObservedAt != null) expect(e.priorObservedAt).toBeGreaterThanOrEqual(START);
        }
      }
    }
  });
});
