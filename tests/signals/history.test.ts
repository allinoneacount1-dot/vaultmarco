import { describe, expect, it } from "vitest";
import { SnapshotHistory } from "@/lib/signals/history";
import { computeRadar } from "@/lib/signals/radar";
import { T0, acceleratingPair, snapshot } from "./fixtures";

const MIN = 60_000;

describe("SnapshotHistory", () => {
  it("keeps one time-ordered list per pair and reports when it started", () => {
    const h = new SnapshotHistory(60);
    h.record([snapshot({ observedAt: T0 }), snapshot({ key: "base:other", observedAt: T0 })]);
    h.record([snapshot({ observedAt: T0 + MIN })]);
    expect(h.get("solana:tokenx").map((s) => s.observedAt)).toEqual([T0, T0 + MIN]);
    expect(h.get("base:other")).toHaveLength(1);
    expect(h.since).toBe(T0);
  });

  it("replaces a re-recorded observation instead of duplicating it", () => {
    const h = new SnapshotHistory(60);
    h.record([snapshot({ observedAt: T0, liquidityUsd: 1 })]);
    h.record([snapshot({ observedAt: T0, liquidityUsd: 2 })]);
    expect(h.get("solana:tokenx")).toHaveLength(1);
    expect(h.get("solana:tokenx")[0].liquidityUsd).toBe(2);
  });

  it("reports the earliest RETAINED observation as `since`, not the first ever seen", () => {
    const h = new SnapshotHistory(60);
    h.record([snapshot({ key: "a:1", observedAt: T0 })]);
    h.record([snapshot({ key: "a:1", observedAt: T0 + 30 * MIN })]);
    expect(h.since).toBe(T0);
    // Advance past the 60-minute window: T0 is pruned, T0+30m is still retained.
    h.record([snapshot({ key: "a:1", observedAt: T0 + 75 * MIN })]);
    expect(h.get("a:1").map((s) => s.observedAt)).toEqual([T0 + 30 * MIN, T0 + 75 * MIN]);
    expect(h.since).toBe(T0 + 30 * MIN);
    expect(h.since).not.toBe(T0);
  });

  it("reports null once everything has been pruned", () => {
    const h = new SnapshotHistory(60);
    h.record([snapshot({ key: "a:1", observedAt: T0 })]);
    h.record([]);
    expect(h.since).toBe(T0);
    const fresh = new SnapshotHistory(60);
    expect(fresh.since).toBeNull();
  });

  it("forgets observations older than its window and drops empty pairs", () => {
    const h = new SnapshotHistory(60);
    h.record([snapshot({ key: "a:1", observedAt: T0 })]);
    h.record([snapshot({ key: "b:2", observedAt: T0 + 61 * MIN })]);
    expect(h.get("a:1")).toHaveLength(0);
    expect(h.get("b:2")).toHaveLength(1);
  });
});

describe("computeRadar", () => {
  it("is pure: same snapshots and history give the same result, sorted deterministically", () => {
    const h = new SnapshotHistory();
    const fast = acceleratingPair();
    const faster = {
      ...acceleratingPair(),
      key: "solana:tokeny",
      volume: { m5: 9_000, h1: 25_800, h6: null, h24: null },
    };
    const flat = snapshot({ key: "solana:flat" });
    h.record([fast, faster, flat]);
    const a = computeRadar([fast, faster, flat], h, T0);
    const b = computeRadar([fast, faster, flat], h, T0);
    expect(a).toEqual(b);
    expect(a.momentum.map((m) => m.key)).toEqual(["solana:tokeny", "solana:tokenx"]);
    expect(a.risk).toEqual([]);
    expect(a.universeSize).toBe(3);
    expect(a.historySince).toBe(T0);
  });

  it("surfaces liquidity events from the pair's own history", () => {
    const h = new SnapshotHistory();
    const before = snapshot({ observedAt: T0 - 6 * MIN, liquidityUsd: 500_000 });
    const after = snapshot({ observedAt: T0, liquidityUsd: 150_000 });
    h.record([before]);
    h.record([after]);
    const r = computeRadar([after], h, T0);
    expect(r.risk).toHaveLength(1);
    expect(r.risk[0]).toMatchObject({
      key: "solana:tokenx",
      direction: "REMOVED",
      severity: "HIGH",
    });
  });
});
