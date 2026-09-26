import { describe, expect, it, vi } from "vitest";
import { applyRound, type FiredSignal } from "@/lib/history/episodes";
import { roundKey, rulesVersion } from "@/lib/history/ids";
import { runRound } from "@/lib/history/recorder";
import { snapshot } from "../signals/fixtures";
import { HONSE, HONSE_KEY, HONSE_PAIR, MIN, T0, harness } from "./helpers";

/**
 * The semantic revision is a real module constant; here it is switched
 * between rounds so the recorder itself computes the new rulesVersion
 * (nothing is injected into the recorder).
 */
const revision = vi.hoisted(() => ({ value: 1 }));
vi.mock("@/lib/history/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/history/constants")>();
  return {
    ...actual,
    get HISTORY_RULESET_REVISION() {
      return revision.value;
    },
  };
});

describe("semantic ruleset revision → RULES_CHANGED lifecycle", () => {
  it("a revision bump alone (identical thresholds) changes rulesVersion", () => {
    revision.value = 1;
    const v1 = rulesVersion();
    revision.value = 2;
    const v2 = rulesVersion();
    revision.value = 1;
    expect(v2).not.toBe(v1);
    expect(rulesVersion()).toBe(v1);
  });

  it("pure: old-version episode closes RULES_CHANGED; a FIRED signal opens exactly one new episode under the new version", () => {
    revision.value = 1;
    const v1 = rulesVersion();
    revision.value = 2;
    const v2 = rulesVersion();
    revision.value = 1;
    const fired = (m: number): FiredSignal => ({
      assetKey: HONSE_KEY,
      type: "EARLY_MOMENTUM",
      severity: null,
      snapshot: snapshot({
        key: HONSE_KEY,
        baseAddress: HONSE,
        pairAddress: HONSE_PAIR,
        observedAt: T0 + m * MIN + 2_000,
      }),
      evidence: { type: "EARLY_MOMENTUM", rule: {} as never },
      vaRatio: 4,
      absLiquidityDeltaUsd: null,
    });
    const round = (m: number, rules: string) => ({
      key: roundKey(T0 + m * MIN),
      at: T0 + m * MIN,
      rulesVersion: rules,
      observe: () => ({ class: "FIRED" as const, observedAt: T0 + m * MIN + 2_000 }),
      fired: [fired(m)],
    });
    const first = applyRound([], round(0, v1)).opened[0];
    const r = applyRound([first.episode], round(1, v2));
    expect(r.updated).toHaveLength(1);
    expect(r.updated[0].episode).toMatchObject({
      eventId: first.event.id,
      rulesVersion: v1,
      status: "CLOSED",
      closeReason: "RULES_CHANGED",
      closedAt: T0 + MIN,
      // the new observation is NOT attached to the old episode
      roundsFired: 1,
      lastFiredAt: T0 + 2_000,
      lastValidAt: T0 + 2_000,
    });
    expect(r.opened).toHaveLength(1);
    expect(r.opened[0].event).toMatchObject({ rulesVersion: v2, openedRound: roundKey(T0 + MIN) });
    expect(r.opened[0].episode).toMatchObject({ rulesVersion: v2, status: "OPEN" });
    expect(r.opened[0].event.id).not.toBe(first.event.id);
    // Replaying the same new-version round against the resulting state: no-op.
    const again = applyRound([r.opened[0].episode], round(1, v2));
    expect(again).toEqual({ opened: [], updated: [] });
  });

  it("recorder: bump between rounds → RULES_CHANGED (not SIGNAL_EXIT), one new event, old event immutable, replay harmless", async () => {
    revision.value = 1;
    const h = harness({ honse: "signal" });
    await h.at(0);
    const [oldEp] = [...h.store.episodes.values()].filter((e) => e.type === "EARLY_MOMENTUM");
    const oldEvent = structuredClone(h.store.eventsById.get(oldEp.eventId)!);
    const v1 = oldEvent.rulesVersion;

    revision.value = 2;
    try {
      const r = await h.at(1);
      expect(r).toMatchObject({ result: "COMPLETED", opened: 1 });
      expect(r.closed).toEqual({ SIGNAL_EXIT: 0, TRACKING_LOST: 0, RULES_CHANGED: 1 });
      const v2 = rulesVersion();
      expect(v2).not.toBe(v1);
      expect(h.store.episodes.get(oldEp.eventId)).toMatchObject({
        status: "CLOSED",
        closeReason: "RULES_CHANGED",
        rulesVersion: v1,
        roundsFired: 1,
      });
      expect(h.store.eventsById.get(oldEp.eventId)).toEqual(oldEvent); // immutable
      const momentum = [...h.store.episodes.values()].filter((e) => e.type === "EARLY_MOMENTUM");
      const fresh = momentum.filter((e) => e.status === "OPEN");
      expect(momentum).toHaveLength(2);
      expect(fresh).toHaveLength(1);
      expect(fresh[0].rulesVersion).toBe(v2);
      expect(h.store.eventsById.get(fresh[0].eventId)).toMatchObject({
        rulesVersion: v2,
        openedRound: roundKey(T0 + MIN),
      });
      expect(fresh[0].eventId).not.toBe(oldEp.eventId);

      // Retry / replay of the same new-version round: no duplicate event.
      const events = h.store.eventsById.size;
      const commits = h.store.commits;
      expect((await runRound(T0 + MIN, h.deps())).result).toBe("SKIPPED");
      expect(h.store.eventsById.size).toBe(events);
      expect(h.store.commits).toBe(commits);

      // The next round under the same new version continues the new episode.
      await h.at(2);
      expect(h.store.episodes.get(fresh[0].eventId)).toMatchObject({
        status: "OPEN",
        roundsFired: 2,
      });
      expect(h.store.eventsById.size).toBe(events);
    } finally {
      revision.value = 1;
    }
  });
});
