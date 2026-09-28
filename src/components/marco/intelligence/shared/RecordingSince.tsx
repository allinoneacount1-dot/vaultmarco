import { useSessionInfo } from "@/hooks/useIntelligence";
import { clockLabel } from "@/lib/intelligence/freshness";
import { ObservedTime } from "./ObservedTime";

const hm = (ms: number) => clockLabel(ms).slice(0, 5);

/**
 * "RECORDING SINCE hh:mm:ss" — when the recorder first mounted (the first
 * dashboard route opened), never app boot — plus every closed pause
 * ("PAUSED hh:mm–hh:mm") while no dashboard route was open. Nothing outside
 * these intervals was observed.
 */
export function RecordingSince({ className = "" }: { className?: string }) {
  const { startedAt, paused } = useSessionInfo();
  return (
    <span className={className} data-testid="recording-since">
      RECORDING SINCE <ObservedTime at={Number.isFinite(startedAt) ? startedAt : null} />
      {paused.map((p) => (
        <span key={p.from} data-testid="recording-paused">
          {" "}
          · PAUSED <time dateTime={new Date(p.from).toISOString()}>{hm(p.from)}</time>–
          <time dateTime={new Date(p.to).toISOString()}>{hm(p.to)}</time>
        </span>
      ))}
    </span>
  );
}
