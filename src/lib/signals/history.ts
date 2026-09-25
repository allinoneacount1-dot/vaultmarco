import type { PairSnapshot } from "./pairSnapshot";
import { HISTORY_MAX_AGE_MINUTES } from "./thresholds";

/**
 * In-memory snapshot history, one time-ordered list per pair.
 *
 * Holds real observations only (one per provider poll) and forgets anything
 * older than `maxAgeMinutes`. It has no React or DOM dependency so the same
 * store can back a browser session now and a worker later. State lives only
 * as long as the page: the UI states when history began rather than
 * pretending to know more than it has seen.
 */
export class SnapshotHistory {
  private readonly byKey = new Map<string, PairSnapshot[]>();

  constructor(private readonly maxAgeMinutes: number = HISTORY_MAX_AGE_MINUTES) {}

  /** Record one poll's worth of observations. Later observations must not be older than earlier ones. */
  record(snapshots: readonly PairSnapshot[]): void {
    for (const s of snapshots) {
      const list = this.byKey.get(s.key) ?? [];
      const last = list[list.length - 1];
      // One entry per observation time; a re-run of the same poll replaces it.
      if (last && last.observedAt === s.observedAt) list[list.length - 1] = s;
      else list.push(s);
      this.byKey.set(s.key, list);
    }
    this.prune(Math.max(...snapshots.map((s) => s.observedAt), 0));
  }

  /** Time-ordered observations of one pair (oldest first). */
  get(key: string): readonly PairSnapshot[] {
    return this.byKey.get(key) ?? [];
  }

  /**
   * Epoch ms of the earliest observation still RETAINED, or null when empty.
   * Computed from what is held, so after pruning it never claims history the
   * signal functions can no longer see.
   */
  get since(): number | null {
    let earliest: number | null = null;
    for (const list of this.byKey.values()) {
      const first = list[0]?.observedAt;
      if (first != null && (earliest == null || first < earliest)) earliest = first;
    }
    return earliest;
  }

  private prune(now: number): void {
    const cutoff = now - this.maxAgeMinutes * 60_000;
    for (const [key, list] of this.byKey) {
      const kept = list.filter((s) => s.observedAt >= cutoff);
      if (kept.length === 0) this.byKey.delete(key);
      else this.byKey.set(key, kept);
    }
  }
}
