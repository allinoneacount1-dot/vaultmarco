import { MAX_GAP_ROWS_PER_ROUND, ROUND_INTERVAL_MS, ROUND_LEASE_MS } from "./constants";
import { roundKey, roundStart } from "./ids";
import type { RoundRecord } from "./model";

/**
 * ROUND / LEASE STATE MACHINE (pure). Scheduling is treated as at-least-once:
 * the same minute may be invoked twice, concurrently, or after a crash.
 *
 *   (none) ──claim──▶ CLAIMED ──commit(owner, attempt)──▶ COMPLETED | FAILED
 *                        │
 *                        └─ lease expired ──takeover──▶ CLAIMED (attempt + 1, new owner)
 *
 *   A minute older than the newest finished round   → SUPERSEDED (does nothing)
 *   A minute that was never observed                → GAP (no values, never backfilled)
 *
 * Commits are accepted only from the current owner and attempt, so a stale
 * worker whose lease was taken over can never write.
 */

export type ClaimDecision =
  | { kind: "CLAIM"; record: RoundRecord }
  | { kind: "TAKEOVER"; record: RoundRecord }
  | { kind: "SKIP"; reason: "ALREADY_FINISHED" | "ACTIVE_LEASE" }
  | { kind: "SUPERSEDED"; record: RoundRecord };

const FINISHED = new Set(["COMPLETED", "FAILED", "SUPERSEDED", "GAP"]);

export function decideClaim(
  existing: RoundRecord | null,
  scheduledAt: number,
  owner: string,
  now: number,
  newestFinishedAt: number | null,
): ClaimDecision {
  const at = roundStart(scheduledAt);
  const key = roundKey(at);
  if (existing && FINISHED.has(existing.state)) return { kind: "SKIP", reason: "ALREADY_FINISHED" };
  if (newestFinishedAt != null && at < newestFinishedAt) {
    return { kind: "SUPERSEDED", record: blank(key, at, "SUPERSEDED", 1, null, null, now) };
  }
  if (!existing) {
    return {
      kind: "CLAIM",
      record: blank(key, at, "CLAIMED", 1, owner, now + ROUND_LEASE_MS, null),
    };
  }
  // existing is CLAIMED
  if (existing.leaseUntil != null && existing.leaseUntil > now) {
    return { kind: "SKIP", reason: "ACTIVE_LEASE" };
  }
  return {
    kind: "TAKEOVER",
    record: { ...existing, attempt: existing.attempt + 1, owner, leaseUntil: now + ROUND_LEASE_MS },
  };
}

/** A commit is valid only for the owner and attempt currently holding the claim. */
export function canCommit(current: RoundRecord | null, owner: string, attempt: number): boolean {
  return (
    current != null &&
    current.state === "CLAIMED" &&
    current.owner === owner &&
    current.attempt === attempt
  );
}

/**
 * Minutes strictly between the newest known round and this one that have no
 * record: they were never observed and become GAP rows (no values).
 */
export function gapKeys(
  newestKnownAt: number | null,
  scheduledAt: number,
  exists: (key: string) => boolean,
): string[] {
  if (newestKnownAt == null) return [];
  const out: string[] = [];
  const from = Math.max(
    newestKnownAt + ROUND_INTERVAL_MS,
    roundStart(scheduledAt) - MAX_GAP_ROWS_PER_ROUND * ROUND_INTERVAL_MS,
  );
  for (let t = from; t < roundStart(scheduledAt); t += ROUND_INTERVAL_MS) {
    const k = roundKey(t);
    if (!exists(k)) out.push(k);
  }
  return out;
}

export function gapRecord(key: string, now: number): RoundRecord {
  return blank(key, Date.parse(key), "GAP", 0, null, null, now);
}

function blank(
  key: string,
  at: number,
  state: RoundRecord["state"],
  attempt: number,
  owner: string | null,
  leaseUntil: number | null,
  finishedAt: number | null,
): RoundRecord {
  return {
    key,
    scheduledAt: at,
    state,
    attempt,
    owner,
    leaseUntil,
    dataStatus: null,
    rulesVersion: null,
    universeSize: null,
    issues: [],
    requests: null,
    finishedAt,
  };
}
