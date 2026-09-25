import { ENGINE_RETENTION_MS, ROUND_LOG_RETENTION_MS } from "./constants";

/**
 * RETENTION PLANNER. Only temporary/operational data is ever pruned:
 *   engine snapshots  → after ENGINE_RETENTION_MS (engine state, not history)
 *   round / gap log   → after ROUND_LOG_RETENTION_MS
 * Signal events, episodes and outcomes are durable product data and are never
 * pruned here.
 */
export function engineCutoff(now: number): number {
  return now - ENGINE_RETENTION_MS;
}

export function roundLogCutoff(now: number): number {
  return now - ROUND_LOG_RETENTION_MS;
}
