import { ROUND_DEADLINE_MS } from "./constants";
import { classify, isUsableRound, type RoundView } from "./classify";
import {
  outcomeKey,
  planDue,
  planPairFallback,
  resolveWithPairs,
  type DueWant,
} from "./duePlanner";
import { applyRound, type FiredSignal } from "./episodes";
import { roundKey, roundStart, rulesVersion } from "./ids";
import type {
  OutcomeObservation,
  RoundDataStatus,
  RoundRecord,
  SignalEvent,
  UnavailableReason,
} from "./model";
import { noteFailure, scheduleOutcomes } from "./outcomes";
import type { RecorderStore } from "./ports";
import { RequestLedger, type RawHttp } from "./requests";
import { engineCutoff, roundLogCutoff } from "./retention";
import { decideClaim, gapKeys, gapRecord } from "./rounds";
import { fetchRealtimePairs } from "@/lib/providers/dexPairs";
import { ProviderError } from "@/lib/providers/envelope";
import { DexPairSchema, parseItems } from "@/lib/providers/schemas";
import { fetchPairUniverse, type PairUniverse, type RealtimeInput } from "@/lib/providers/universe";
import { SnapshotHistory } from "@/lib/signals/history";

/**
 * THE RECORDER — one scheduled round, end to end, with no platform code.
 *
 *   1. claim the scheduled minute (short compare-and-set write)
 *   2. load temporary engine state → rebuild SnapshotHistory (existing code)
 *   3. provider I/O through the budgeted ledger — NO transaction open
 *   4. existing engine: fetchRealtimePairs → fetchPairUniverse → radar
 *   5. classify every open episode / fired signal; apply the state machine
 *   6. due outcomes: reuse this round, else targeted batches for the exact pair
 *   7. ONE atomic commit that re-verifies the claim
 *
 * Time model: the scheduled minute (`roundStart`) is the round's IDENTITY
 * (round key, `openedRound`, claim/gap log, round-order guard). Every signal
 * time — `openedAt`, `lastFiredAt`, `lastValidAt`, negative continuity, exit
 * time, and therefore outcome targets — is the REAL `observedAt` of the
 * snapshot the engine evaluated.
 */

const API = "https://api.dexscreener.com";
const SOURCE = "dexscreener";

export type RecorderDeps = {
  store: RecorderStore;
  http: RawHttp;
  now: () => number;
  /** Unique per invocation. */
  owner: string;
  sleep?: (ms: number) => Promise<void>;
  jitter?: () => number;
};

export type RoundReport = {
  key: string;
  result: "COMPLETED" | "FAILED" | "SKIPPED" | "SUPERSEDED" | "LOST_CLAIM";
  dataStatus: RoundDataStatus | null;
  opened: number;
  closed: Record<"SIGNAL_EXIT" | "TRACKING_LOST" | "RULES_CHANGED", number>;
  outcomesObserved: number;
  outcomesUnavailable: number;
  gaps: number;
  requests: number;
  accounting: RequestLedger["accounting"] | null;
};

const empty = (key: string, result: RoundReport["result"]): RoundReport => ({
  key,
  result,
  dataStatus: null,
  opened: 0,
  closed: { SIGNAL_EXIT: 0, TRACKING_LOST: 0, RULES_CHANGED: 0 },
  outcomesObserved: 0,
  outcomesUnavailable: 0,
  gaps: 0,
  requests: 0,
  accounting: null,
});

function failureReason(err: unknown): UnavailableReason {
  return err instanceof ProviderError && err.code === "RATE_LIMITED"
    ? "RATE_LIMITED"
    : "PROVIDER_ERROR";
}

function firedSignals(u: PairUniverse): FiredSignal[] {
  const byKey = new Map(u.snapshots.map((s) => [s.key, s]));
  const out: FiredSignal[] = [];
  for (const m of u.radar.momentum) {
    const snapshot = byKey.get(m.key);
    if (!snapshot) continue;
    out.push({
      assetKey: m.key,
      type: "EARLY_MOMENTUM",
      severity: null,
      snapshot,
      evidence: { type: "EARLY_MOMENTUM", rule: m },
      vaRatio: m.va.ratio,
      absLiquidityDeltaUsd: null,
    });
  }
  for (const e of u.radar.risk) {
    const snapshot = byKey.get(e.key);
    if (!snapshot) continue;
    const type = e.direction === "ADDED" ? "LIQUIDITY_ADDED" : "LIQUIDITY_REMOVED";
    out.push({
      assetKey: e.key,
      type,
      severity: e.severity,
      snapshot,
      evidence: { type, rule: e },
      vaRatio: null,
      absLiquidityDeltaUsd: Math.abs(e.change.deltaUsd),
    });
  }
  return out;
}

export async function runRound(scheduledAt: number, deps: RecorderDeps): Promise<RoundReport> {
  const { store, now, owner } = deps;
  const at = roundStart(scheduledAt);
  const key = roundKey(at);
  const started = now();

  // ---- 1. claim -------------------------------------------------------------
  const previousKnownAt = await store.newestKnownAt();
  const existing = await store.getRound(key);
  const decision = decideClaim(existing, at, owner, now(), await store.newestFinishedAt());
  if (decision.kind === "SKIP") return empty(key, "SKIPPED");
  if (decision.kind === "SUPERSEDED") {
    await store.tryClaim(decision.record, existing);
    return empty(key, "SUPERSEDED");
  }
  if (!(await store.tryClaim(decision.record, existing))) return empty(key, "SKIPPED");
  const claim = decision.record;

  const report = empty(key, "COMPLETED");
  try {
    // ---- 2. temporary engine state → SnapshotHistory (existing code path) ----
    const history = new SnapshotHistory();
    for (const r of await store.loadEngineRounds(engineCutoff(at))) history.record(r.snapshots);
    const open = await store.openEpisodes();
    const pending = await store.pendingOutcomes();
    const ledger = new RequestLedger(
      deps.http,
      now,
      await store.cooldowns(),
      deps.sleep,
      deps.jitter,
    );
    const engineDeps = { fetchJson: ledger.fetchJson, now };

    // ---- 3–4. provider I/O + existing engine (no transaction open) ----------
    let realtime: RealtimeInput;
    try {
      const rt = await fetchRealtimePairs(engineDeps);
      realtime = { ok: true, rows: rt.data, observedAt: rt.fetchedAt ?? now() };
    } catch (error) {
      realtime = { ok: false, error };
    }
    let universe: PairUniverse | null = null;
    let dataStatus: RoundDataStatus = "offline";
    try {
      universe = await fetchPairUniverse(undefined, history, realtime, engineDeps);
      dataStatus = universe.radarInputs.status;
    } catch {
      universe = null;
    }
    const usable = isUsableRound(dataStatus) && universe != null;
    report.dataStatus = dataStatus;

    // ---- 5. classify + episode transitions ----------------------------------
    const rules = rulesVersion();
    const view: RoundView = { status: dataStatus, universe, history };
    const transitions = applyRound(open, {
      key,
      at,
      rulesVersion: rules,
      observe: (asset, type) => classify(view, asset, type),
      fired: usable && universe ? firedSignals(universe) : [],
    });
    const newEvents = transitions.opened.map((o) => o.event);
    report.opened = newEvents.length;
    for (const u of transitions.updated) {
      if (u.episode.closeReason) report.closed[u.episode.closeReason]++;
    }

    // ---- 6. outcomes ---------------------------------------------------------
    const outcomeInserts = newEvents.flatMap(scheduleOutcomes);
    const pendingIds = [...new Set(pending.map((o) => o.eventId))];
    const events = new Map<string, SignalEvent>(
      (await store.events(pendingIds)).map((e) => [e.id, e]),
    );
    const updates = new Map<string, OutcomeObservation>();
    const current = (w: DueWant) =>
      updates.get(outcomeKey(w.eventId, w.horizonMinutes)) ??
      pending.find((o) => o.eventId === w.eventId && o.horizonMinutes === w.horizonMinutes);
    const put = (o: OutcomeObservation) => updates.set(outcomeKey(o.eventId, o.horizonMinutes), o);
    const fail = (w: DueWant, reason: UnavailableReason) => {
      const o = current(w);
      if (o && o.availability === "PENDING") put(noteFailure(o, reason));
    };

    const plan = planDue({
      now: now(),
      pending,
      events,
      roundSnapshots: usable && universe ? universe.snapshots : [],
      roundKey: key,
    });
    plan.fromRound.forEach(put);
    plan.expired.forEach(put);
    plan.deferred.forEach((w) => fail(w, "BUDGET_DEFERRED"));

    if (now() - started <= ROUND_DEADLINE_MS) {
      ledger.phase = "DUE";
      const pendingMap = new Map(pending.map((o) => [outcomeKey(o.eventId, o.horizonMinutes), o]));
      const missing: DueWant[] = [];
      for (const b of plan.tokenBatches) {
        try {
          const raw = await ledger.fetchJson(
            SOURCE,
            `${API}/tokens/v1/${encodeURIComponent(b.chainId)}/${b.tokenAddresses.map(encodeURIComponent).join(",")}`,
          );
          const { items } = parseItems(SOURCE, raw, DexPairSchema);
          const r = resolveWithPairs(
            b.wants,
            b.chainId,
            items,
            now(),
            pendingMap,
            events,
            "DUE_TOKEN_BATCH",
          );
          r.observed.forEach(put);
          missing.push(...r.missing);
        } catch (err) {
          b.wants.forEach((w) => fail(w, failureReason(err)));
        }
      }
      const fb = planPairFallback(missing, (id) => events.get(id)?.chainId);
      fb.deferred.forEach((w) => fail(w, "BUDGET_DEFERRED"));
      for (const b of fb.batches) {
        try {
          const raw = (await ledger.fetchJson(
            SOURCE,
            `${API}/latest/dex/pairs/${encodeURIComponent(b.chainId)}/${b.pairAddresses.map(encodeURIComponent).join(",")}`,
          )) as { pairs?: unknown; pair?: unknown } | null;
          const list = Array.isArray(raw?.pairs) ? raw!.pairs : raw?.pair ? [raw.pair] : [];
          const { items } = parseItems(SOURCE, list, DexPairSchema);
          const r = resolveWithPairs(
            b.wants,
            b.chainId,
            items,
            now(),
            pendingMap,
            events,
            "PAIR_FALLBACK",
          );
          r.observed.forEach(put);
          r.missing.forEach((w) => fail(w, "PAIR_NOT_RETURNED"));
        } catch (err) {
          b.wants.forEach((w) => fail(w, failureReason(err)));
        }
      }
    }
    for (const o of updates.values()) {
      if (o.availability === "OBSERVED") report.outcomesObserved++;
      if (o.availability === "UNAVAILABLE") report.outcomesUnavailable++;
    }

    // ---- 7. one atomic commit -----------------------------------------------
    const gaps = gapKeys(previousKnownAt, at, () => false).map((k) => gapRecord(k, now()));
    report.gaps = gaps.length;
    report.accounting = ledger.accounting;
    report.requests = ledger.totalAttempts();
    const finalRound: RoundRecord = {
      ...claim,
      state: "COMPLETED",
      leaseUntil: null,
      dataStatus,
      rulesVersion: rules,
      universeSize: universe?.snapshots.length ?? 0,
      issues: universe?.radarInputs.issues ?? ["every DexScreener source failed"],
      requests: ledger.accounting,
      finishedAt: now(),
    };
    const result = await store.commit({
      round: finalRound,
      owner,
      attempt: claim.attempt,
      gaps,
      engine: {
        put: usable && universe ? { key, observedAt: at, snapshots: universe.snapshots } : null,
        pruneBefore: engineCutoff(at),
      },
      events: newEvents,
      episodes: [
        ...transitions.opened.map((o) => ({ episode: o.episode, expectedLastEvaluatedAt: null })),
        ...transitions.updated,
      ],
      outcomeInserts,
      outcomeUpdates: [...updates.values()],
      cooldowns: ledger.cooldownUpdates(),
      pruneRoundLogBefore: roundLogCutoff(at),
    });
    if (!result.ok) return { ...report, result: "LOST_CLAIM" };
    return report;
  } catch {
    // Recorder logic failed: record the round as FAILED with no transitions.
    await store.commit({
      round: { ...claim, state: "FAILED", leaseUntil: null, finishedAt: now() },
      owner,
      attempt: claim.attempt,
      gaps: [],
      engine: { put: null, pruneBefore: engineCutoff(at) },
      events: [],
      episodes: [],
      outcomeInserts: [],
      outcomeUpdates: [],
      cooldowns: [],
      pruneRoundLogBefore: roundLogCutoff(at),
    });
    return { ...report, result: "FAILED" };
  }
}
