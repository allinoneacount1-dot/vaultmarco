import { StateDot } from "@/components/marco/desk";
import { type AssetFreshness, FRESHNESS_TEXT } from "@/lib/intelligence/freshness";
import { staleAfterMs } from "@/lib/intelligence/rules";
import { ObservedTime } from "./ObservedTime";

const STALE_REASON: Record<string, string> = {
  PROVIDER_FAILED: "A LATER PROVIDER ROUND FAILED",
  SLOT_UNRESOLVED: "THE PROVIDER DID NOT RESOLVE THIS PAIR IN A LATER ROUND",
  AGE: "NO NEW OBSERVATION WITHIN THE FRESHNESS WINDOW",
};

/**
 * STALE / DEGRADED note above an intelligence view's evidence. The evidence
 * stays, labelled as of its last real observation, never as current. LIVE
 * (and the no-evidence states) render nothing: the asset bar already says it.
 */
export function FreshnessNote({ fresh, what }: { fresh: AssetFreshness; what: string }) {
  if (fresh.state !== "stale" && fresh.state !== "degraded") return null;
  const window = fresh.lane ? `${staleAfterMs(fresh.lane) / 1000} S` : "—";
  return (
    <p
      role="status"
      className="hairline flex flex-wrap items-baseline gap-x-2 gap-y-1 border-l-2! border-l-(--champagne)! px-3 py-2.5 font-mono text-[10px] leading-relaxed tracking-[0.1em] text-(--champagne)"
      data-testid="freshness-note"
      data-state={fresh.state}
    >
      <span className="flex items-center gap-2 font-semibold">
        <StateDot state={fresh.state} className="text-(--champagne)" />
        {FRESHNESS_TEXT[fresh.state]}
      </span>
      {fresh.state === "stale" ? (
        <span>
          {" "}
          · {STALE_REASON[fresh.reason] ?? fresh.reason} · FRESHNESS WINDOW {window}. {what} is as
          of <ObservedTime at={fresh.observedAt} prefix="OBSERVATION" />, not now; nothing after it
          is inferred.
        </span>
      ) : (
        <span>
          {" "}
          · THE LATEST OBSERVATION CAME FROM A PARTIAL PROVIDER ROUND. Missing slots show as “—”,
          never as zero.
        </span>
      )}
    </p>
  );
}
