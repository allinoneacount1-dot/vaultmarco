import { describe, expect, it } from "vitest";
import {
  ONSET_TEXT,
  changesText,
  collisionView,
  collisionWindowText,
  eventTypeText,
  eventValueText,
  spanText,
} from "@/lib/intelligence/collisionView";
import { extractAssetEvents } from "@/lib/intelligence/events";
import { COLLISION_WINDOW_MS } from "@/lib/intelligence/rules";
import { createSessionState, ingest } from "@/lib/intelligence/sessionHistory";
import { MIN, SEC, SOL_KEY, SOL_PAIR, START, T0, batch, obs } from "./helpers";

type Over = Parameters<typeof obs>[2];

/** The captured m5 txns (120/68) are already a BUY-side imbalance; start balanced. */
const BALANCED = { buys: 60, sells: 60 };

/** Real SOL/USDC rounds on the realtime lane, one override set per round. */
function eventsOf(rounds: Array<{ at: number; over?: Over }>) {
  let s = createSessionState(START);
  for (const r of rounds) {
    const over = { ...r.over, txns: { m5: BALANCED, ...r.over?.txns } };
    s = ingest(s, batch("realtime", r.at, [obs(SOL_PAIR, r.at, over)]));
  }
  return extractAssetEvents(s.assets.get(SOL_KEY)!, s.lanes);
}

const OTHER_POOL = "SwitchPoo1111111111111111111111111111111111";

describe("collision page", () => {
  it("N = independent families; several events of one family are grouped under one family row", () => {
    const events = eventsOf([
      { at: T0 },
      // TRANSACTIONS twice (acceleration + imbalance), PRICE once.
      {
        at: T0 + 30 * SEC,
        over: {
          priceChange: { m5: 4 },
          txns: { m5: { buys: 900, sells: 100 } },
        },
      },
      {
        at: T0 + 90 * SEC,
        over: {
          priceChange: { m5: 4 },
          volume: { m5: 900_000 },
          txns: { m5: { buys: 900, sells: 100 } },
        },
      },
    ]);
    const v = collisionView(events);
    expect(v.isCollision).toBe(true);
    const fams = v.collision!.families.map((f) => f.family);
    expect(new Set(fams).size).toBe(fams.length);
    expect(v.collision!.count).toBe(fams.length);
    const tx = v.collision!.families.find((f) => f.family === "TRANSACTIONS")!;
    expect(tx.events.length).toBeGreaterThanOrEqual(2);
    expect(fams).toEqual(expect.arrayContaining(["PRICE", "TRANSACTIONS", "VOLUME"]));
  });

  it("the span is the real time between the first and last contributing family onsets", () => {
    const events = eventsOf([
      { at: T0 },
      { at: T0 + 30 * SEC, over: { priceChange: { m5: 4 } } },
      { at: T0 + 3 * MIN + 48 * SEC, over: { priceChange: { m5: 4 }, volume: { m5: 900_000 } } },
    ]);
    const v = collisionView(events);
    expect(v.collision!.spanMs).toBe(3 * MIN + 18 * SEC);
    expect(spanText(v.collision)).toBe("03m 18s");
    expect(changesText(v.collision!.count)).toBe("2 CHANGES");
  });

  it("fewer than 2 families is NOT a collision, but the single family is still listed", () => {
    const v = collisionView(
      eventsOf([{ at: T0 }, { at: T0 + 30 * SEC, over: { priceChange: { m5: 4 } } }]),
    );
    expect(v.isCollision).toBe(false);
    expect(v.collision!.families.map((f) => f.family)).toEqual(["PRICE"]);
    expect(changesText(1)).toBe("1 CHANGE");
  });

  it("no events → no collision, nothing synthesized", () => {
    const v = collisionView([]);
    expect(v).toMatchObject({ collision: null, isCollision: false, excluded: [] });
    expect(spanText(null)).toBe("—");
  });

  it("families whose onsets are further apart than the rules window never collide", () => {
    const events = eventsOf([
      { at: T0 },
      { at: T0 + 30 * SEC, over: { priceChange: { m5: 4 } } },
      { at: T0 + 60 * SEC },
      // new volume onset > COLLISION_WINDOW_MS after the price onset, runs contiguous every 60 s
      ...Array.from({ length: 6 }, (_, i) => ({ at: T0 + (2 + i) * MIN })),
      { at: T0 + 30 * SEC + COLLISION_WINDOW_MS + MIN, over: { volume: { m5: 900_000 } } },
    ]);
    const v = collisionView(events);
    expect(v.collision!.families.map((f) => f.family)).toEqual(["VOLUME"]);
    expect(v.isCollision).toBe(false);
  });

  it("pool switch inside the window: only the newest event's pool counts, and the page is told what was left out", () => {
    const events = eventsOf([
      { at: T0 },
      { at: T0 + 30 * SEC, over: { priceChange: { m5: 4 } } }, // pool A: PRICE
      { at: T0 + 60 * SEC, over: { pairAddress: OTHER_POOL } },
      { at: T0 + 90 * SEC, over: { pairAddress: OTHER_POOL, volume: { m5: 900_000 } } }, // pool B: VOLUME
    ]);
    const v = collisionView(events);
    expect(v.collision!.pairAddress).toBe(OTHER_POOL);
    expect(v.collision!.families.map((f) => f.family)).toEqual(["VOLUME"]);
    expect(v.isCollision).toBe(false);
    expect(v.excluded.map((e) => e.type)).toEqual(["PRICE_EXPANSION"]);
    expect(v.excludedPools).toEqual([SOL_PAIR.pairAddress]);
  });

  it("duplicate observations (same pool, same time) never add an event or a family", () => {
    const rounds = [{ at: T0 }, { at: T0 + 30 * SEC, over: { priceChange: { m5: 4 } } }];
    const once = collisionView(eventsOf(rounds));
    const dup = collisionView(eventsOf([...rounds, rounds[1]]));
    expect(dup.collision!.families).toEqual(once.collision!.families);
  });

  it("text: window from rules.ts, values in their unit, 0 stays 0, onset honesty", () => {
    expect(collisionWindowText()).toBe("05m 00s");
    const [e] = eventsOf([{ at: T0 }, { at: T0 + 30 * SEC, over: { priceChange: { m5: 4 } } }]);
    expect(eventTypeText(e)).toBe("PRICE EXPANSION");
    expect(eventValueText(e)).toBe("+4.00%");
    expect(eventValueText({ ...e, value: 0 })).toBe("0.00%");
    expect(eventValueText({ ...e, value: null })).toBe("—");
    expect(ONSET_TEXT.IN_PROGRESS_WHEN_OBSERVED).toMatch(/IN PROGRESS/);
  });
});
