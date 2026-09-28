import type { ProviderStatus } from "@/lib/providers/envelope";
import type { PairSnapshot, UniverseSource } from "@/lib/signals/pairSnapshot";
import type { Lane } from "./rules";

/**
 * OBSERVATION MODEL — what the intelligence suite knows, and nothing more.
 *
 * An observation is one real provider response about one pair, received by
 * one of the two EXISTING DexScreener lanes. Its `observedAt` is the time
 * that response was received (the envelope's `fetchedAt` for the realtime
 * lane, `PairUniverse.observedAt` / the snapshot's own `observedAt` for the
 * universe lane) — never a render time and never a cache-read time.
 *
 * The provider fields are kept as the existing normalized `PairSnapshot`
 * (every value the provider's own, or `null` for "not reported"), so the
 * radar's signal functions run on it unchanged.
 */

export type { Lane } from "./rules";

export const PROVIDER = "dexscreener" as const;

export type AssetObservation = {
  /** Canonical assetKey(chainId, baseAddress) — lookup only. */
  assetKey: string;
  /** Provider's original chain id. */
  chainId: string;
  /** Provider's original base-token address (the asset). */
  address: string;
  /** The pair this observation describes; null only if the provider omitted it. */
  pairAddress: string | null;
  baseAddress: string;
  /** Null when the payload that produced the snapshot did not carry it. */
  quoteAddress: string | null;
  provider: typeof PROVIDER;
  /** Lanes that delivered this exact observation (same pair + same observedAt). */
  lanes: Lane[];
  /** Universe sources that referenced the pair (boost-latest / boost-top / ad / realtime). */
  sources: UniverseSource[];
  /** Epoch ms the provider response was received. */
  observedAt: number;
  /** Status of the envelope / round that delivered it: live, or degraded (partial). */
  providerStatus: Extract<ProviderStatus, "live" | "degraded">;
  /** The provider fields, unchanged. */
  snapshot: PairSnapshot;
};

/** A radar firing recorded from the round that produced it (never re-derived). */
export type RadarFiring = {
  kind: "MOMENTUM" | "RISK";
  /** The evaluated snapshot's observedAt (momentum) / comparison's currentObservedAt (risk). */
  observedAt: number;
  /** When the universe round that reported it completed. */
  roundAt: number;
  direction: "ADDED" | "REMOVED" | null;
  severity: "HIGH" | "MEDIUM" | null;
  /** VA ratio (momentum) or liquidity Δ USD (risk). */
  value: number;
  prior: number | null;
  priorObservedAt: number | null;
  reasons: string[];
};

/**
 * A canonical realtime slot that the provider answered for but did not
 * resolve (provider_error / not_found / identity_mismatch / schema_mismatch):
 * per-asset provider trouble while other slots are fine.
 */
export type SlotGap = { at: number; lane: Lane; reason: string };

/** One lane round's outcome, at the time it was recorded. */
export type LanePoint = {
  at: number;
  /** ok = live · partial = degraded · failed = error / stale fallback / offline. */
  state: "ok" | "partial" | "failed";
  code: string | null;
  issues: string[];
};

export type LaneTrack = {
  /** First ok/partial round this session, or null. */
  firstOkAt: number | null;
  points: LanePoint[];
};

export type AssetTrack = {
  assetKey: string;
  chainId: string;
  address: string;
  /** First retained observation's time for this asset in this session. */
  firstSeenAt: number;
  lastSeenAt: number;
  /**
   * observedAt of the asset's first observation when it ENTERED the observed
   * universe after the universe lane's first round — a real observed entry.
   * Null when the asset was already present in the first round (or canonical).
   */
  enteredAt: number | null;
  /** Oldest first, deduplicated by (pairAddress, observedAt). */
  observations: AssetObservation[];
  radar: RadarFiring[];
  gaps: SlotGap[];
};

/** One span during which the recorder was mounted (a dashboard route was open). */
export type RecordingInterval = { from: number; to: number | null };

export type SessionState = {
  /**
   * When the recorder first mounted (the first dashboard route opened) —
   * never app boot. Nothing older is ever recorded. +Infinity until then,
   * so every batch before the first mount is rejected as pre-session.
   */
  startedAt: number;
  /** Recorder mount spans, oldest first; the last is open (`to: null`) while recording. */
  recording: readonly RecordingInterval[];
  lanes: Record<Lane, LaneTrack>;
  assets: ReadonlyMap<string, AssetTrack>;
  /** Newest observedAt ever ingested — the recorder's clock for pruning. */
  newestAt: number | null;
  /** Counters for rejected input, surfaced for observability. */
  rejected: { preSession: number; paused: number; invalid: number; duplicate: number };
  /** Bumped on every state change. */
  revision: number;
};

/** One normalized ingestion input, produced by ./ingest from an existing query's state. */
export type IngestBatch = {
  lane: Lane;
  /** When the round/response was recorded (real time). */
  at: number;
  state: LanePoint["state"];
  code?: string | null;
  issues?: string[];
  observations: AssetObservation[];
  radar?: Array<{ assetKey: string } & RadarFiring>;
  gaps?: Array<{ assetKey: string; chainId: string; address: string } & SlotGap>;
};
