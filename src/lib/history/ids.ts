import * as thresholds from "@/lib/signals/thresholds";
import { HISTORY_RULESET_REVISION, ROUND_INTERVAL_MS } from "./constants";
import type { SignalType } from "./model";
import { sha256Hex } from "./sha256";

/**
 * Deterministic identities. The same inputs always give the same id, so a
 * retried or duplicated round cannot mint a second event or round.
 */

/** Floor to the scheduled minute. */
export function roundStart(ms: number): number {
  return Math.floor(ms / ROUND_INTERVAL_MS) * ROUND_INTERVAL_MS;
}

/** Round identity: the scheduled minute in UTC, e.g. "2026-09-26T00:07Z". */
export function roundKey(ms: number): string {
  return new Date(roundStart(ms)).toISOString().slice(0, 16) + "Z";
}

/**
 * Persisted rules version: hash of the explicit semantic revision
 * (`HISTORY_RULESET_REVISION`, bumped by hand when a rule's MEANING changes)
 * and every exported numeric threshold constant (sorted by name, so any
 * change to a rule's numbers also counts). Events and episodes from different
 * rule sets are never merged.
 */
export function rulesVersion(): string {
  return rulesVersionOf(thresholds);
}

/** Version of an arbitrary set of numeric rule constants under a semantic revision. */
export function rulesVersionOf(
  constants: Record<string, unknown>,
  revision: number = HISTORY_RULESET_REVISION,
): string {
  const entries = Object.entries(constants)
    .filter(([, v]) => typeof v === "number")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return "rv_" + sha256Hex(JSON.stringify({ revision, thresholds: entries })).slice(0, 16);
}

/** Event id: sha256(rulesVersion | assetKey | type | openedRound). */
export function eventId(
  rules: string,
  assetKey: string,
  type: SignalType,
  openedRound: string,
): string {
  return "evt_" + sha256Hex(`${rules}|${assetKey}|${type}|${openedRound}`).slice(0, 32);
}
