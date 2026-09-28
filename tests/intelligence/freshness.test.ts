import { describe, expect, it } from "vitest";
import { FRESHNESS_TEXT, ageLabel, assetFreshness } from "@/lib/intelligence/freshness";
import { batchFromRealtime, failureBatch } from "@/lib/intelligence/ingest";
import { staleAfterMs } from "@/lib/intelligence/rules";
import { createSessionState, ingest } from "@/lib/intelligence/sessionHistory";
import { assetKey } from "@/lib/assetIdentity";
import {
  SEC,
  SOL_KEY,
  SOL_PAIR,
  START,
  T0,
  TOKEN_A,
  WETH_KEY,
  batch,
  obs,
  realEnvelope,
} from "./helpers";

const empty = () => createSessionState(START);

describe("freshness state machine", () => {
  it("CONNECTING before any round, OFFLINE when every round failed, — when not observed", () => {
    expect(assetFreshness(null, empty().lanes, T0).state).toBe("loading");
    const failed = ingest(empty(), failureBatch("realtime", T0, new Error("x"))!);
    expect(assetFreshness(null, failed.lanes, T0).state).toBe("offline");
    const ok = ingest(empty(), batch("realtime", T0, [obs(SOL_PAIR, T0)]));
    const f = assetFreshness(ok.assets.get("solana:unknown") ?? null, ok.lanes, T0);
    expect(f).toMatchObject({ state: "unobserved", observedAt: null, ageMs: null });
    expect(FRESHNESS_TEXT[f.state]).toBe("—");
  });

  it("LIVE while recent; STALE past the lane threshold (age from the observation, not render)", () => {
    const s = ingest(empty(), batch("realtime", T0, [obs(SOL_PAIR, T0)]));
    const track = s.assets.get(SOL_KEY)!;
    expect(assetFreshness(track, s.lanes, T0 + 10 * SEC)).toMatchObject({
      state: "live",
      observedAt: T0,
      ageMs: 10 * SEC,
    });
    const later = assetFreshness(track, s.lanes, T0 + staleAfterMs("realtime") + 1);
    expect(later).toMatchObject({ state: "stale", reason: "AGE", observedAt: T0 });
  });

  it("aligned with the landing: realtime LIVE at 45 s, STALE at 46 s; universe LIVE at 90 s, STALE at 91 s", () => {
    let s = ingest(empty(), batch("realtime", T0, [obs(SOL_PAIR, T0)]));
    const rt = s.assets.get(SOL_KEY)!;
    expect(assetFreshness(rt, s.lanes, T0 + 45 * SEC).state).toBe("live");
    expect(assetFreshness(rt, s.lanes, T0 + 45 * SEC + 1).state).toBe("stale");
    expect(assetFreshness(rt, s.lanes, T0 + 46 * SEC)).toMatchObject({
      state: "stale",
      reason: "AGE",
    });
    s = ingest(empty(), batch("universe", T0, [obs(TOKEN_A, T0, {}, "universe")]));
    const u = s.assets.get(assetKey("solana", TOKEN_A.baseToken.address))!;
    expect(assetFreshness(u, s.lanes, T0 + 90 * SEC).state).toBe("live");
    expect(assetFreshness(u, s.lanes, T0 + 91 * SEC)).toMatchObject({
      state: "stale",
      reason: "AGE",
    });
  });

  it("failure evidence after an observation keeps STALE even inside the age window, until a NEW observation", () => {
    let s = ingest(empty(), batch("realtime", T0, [obs(SOL_PAIR, T0)]));
    s = ingest(s, failureBatch("realtime", T0 + 5 * SEC, new Error("429"))!);
    s = ingest(s, batch("realtime", T0 + 10 * SEC, [])); // lane answers without this asset
    expect(assetFreshness(s.assets.get(SOL_KEY), s.lanes, T0 + 11 * SEC).state).toBe("stale");
    s = ingest(s, batch("realtime", T0 + 30 * SEC, [obs(SOL_PAIR, T0 + 30 * SEC)]));
    expect(assetFreshness(s.assets.get(SOL_KEY), s.lanes, T0 + 31 * SEC).state).toBe("live");
  });

  it("render time is never the observation time: advancing the clock never moves observedAt", () => {
    const s = ingest(empty(), batch("realtime", T0, [obs(SOL_PAIR, T0)]));
    const track = s.assets.get(SOL_KEY)!;
    for (const now of [T0, T0 + 5 * SEC, T0 + 10 * 60 * SEC]) {
      expect(assetFreshness(track, s.lanes, now).observedAt).toBe(T0);
    }
    expect(track.observations[0].observedAt).toBe(T0);
  });

  it("a failed refetch with prior data → STALE immediately; recovery WITHOUT this asset stays STALE", () => {
    let s = ingest(empty(), batch("universe", T0, [obs(SOL_PAIR, T0, {}, "universe")]));
    s = ingest(s, failureBatch("universe", T0 + 20 * SEC, new Error("503"))!);
    expect(assetFreshness(s.assets.get(SOL_KEY), s.lanes, T0 + 21 * SEC)).toMatchObject({
      state: "stale",
      reason: "PROVIDER_FAILED",
    });
    // Lane recovers, but the round no longer contains the asset.
    s = ingest(s, batch("universe", T0 + 60 * SEC, []));
    expect(assetFreshness(s.assets.get(SOL_KEY), s.lanes, T0 + 61 * SEC).state).toBe("stale");
    // A cached re-read of the old observation changes nothing.
    s = ingest(s, batch("universe", T0 + 60 * SEC, [obs(SOL_PAIR, T0, {}, "universe")]));
    expect(assetFreshness(s.assets.get(SOL_KEY), s.lanes, T0 + 61 * SEC).state).toBe("stale");
    // Only a NEW observation makes it live again.
    s = ingest(
      s,
      batch("universe", T0 + 120 * SEC, [obs(SOL_PAIR, T0 + 120 * SEC, {}, "universe")]),
    );
    expect(assetFreshness(s.assets.get(SOL_KEY), s.lanes, T0 + 121 * SEC).state).toBe("live");
  });

  it("a partial round → DEGRADED; an unresolved canonical slot → STALE for that asset only", async () => {
    let s = ingest(empty(), batchFromRealtime(await realEnvelope(T0))!);
    s = ingest(s, batchFromRealtime(await realEnvelope(T0 + 30 * SEC, ["ethereum"]))!);
    expect(assetFreshness(s.assets.get(SOL_KEY), s.lanes, T0 + 31 * SEC).state).toBe("degraded");
    expect(assetFreshness(s.assets.get(WETH_KEY), s.lanes, T0 + 31 * SEC)).toMatchObject({
      state: "stale",
      reason: "SLOT_UNRESOLVED",
      observedAt: T0,
    });
  });
});

describe("ageLabel", () => {
  it("formats exact ages and never fabricates zero", () => {
    expect(ageLabel(0)).toBe("00m 00s");
    expect(ageLabel(434_000)).toBe("07m 14s");
    expect(ageLabel(3_600_000 + 7 * 60_000)).toBe("1h 07m");
    expect(ageLabel(2 * 86_400_000 + 3 * 3_600_000)).toBe("2d 03h");
    expect(ageLabel(null)).toBe("—");
    expect(ageLabel(-1)).toBe("—");
    expect(ageLabel(Number.NaN)).toBe("—");
  });
});
