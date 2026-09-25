import { type PairSnapshot, pairAgeMinutes } from "./pairSnapshot";
import {
  MIN_PREVIOUS_TXNS,
  MIN_PREVIOUS_VOLUME_USD,
  MIN_SAFE_PREVIOUS_MINUTES,
  PREVIOUS_WINDOW_MINUTES_MATURE,
  RECENT_WINDOW_MINUTES,
} from "./thresholds";

/**
 * Recent-vs-previous pace comparison.
 *
 * The provider reports cumulative windows (m5 ⊂ h1). Comparing m5 against
 * h1/60 would compare the last five minutes against a baseline that already
 * contains them — and for a 10-minute-old pair, h1 only holds 10 minutes of
 * life, so dividing by 60 would manufacture acceleration. Instead:
 *
 *   previous        = max(h1 − m5, 0)
 *   previousMinutes = age ≥ 60 ? 55 : age − 5        (the time h1 − m5 actually covers)
 *   ratio           = (m5 / 5) / (previous / previousMinutes)
 *
 * MIN_SAFE_PREVIOUS_MINUTES is a qualification gate, never a duration: when
 * `age − 5` is shorter than it, the result is INSUFFICIENT_HISTORY. Stretching
 * the denominator instead would spread a few minutes of real activity over
 * time the pair did not exist, deflate the previous pace and inflate the
 * ratio. With the gate at 10 minutes, VA/TA become available at age 15.
 *
 * When there is not enough previous activity to compare against, the result
 * is INSUFFICIENT_HISTORY — never a forced number.
 */
export type PaceResult =
  | {
      ok: true;
      ratio: number;
      recent: number;
      recentPerMinute: number;
      previous: number;
      previousMinutes: number;
      previousPerMinute: number;
    }
  | { ok: false; reason: PaceInsufficientReason };

export type PaceInsufficientReason =
  | "NO_AGE"
  | "NO_RECENT_WINDOW"
  | "NO_PREVIOUS_WINDOW"
  | "INSUFFICIENT_HISTORY";

/**
 * Minutes actually covered by the previous window (h1 − m5) for a pair of the
 * given age, or null when that span is shorter than MIN_SAFE_PREVIOUS_MINUTES.
 */
export function previousWindowMinutes(ageMinutes: number): number | null {
  if (ageMinutes >= 60) return PREVIOUS_WINDOW_MINUTES_MATURE;
  const actual = ageMinutes - RECENT_WINDOW_MINUTES;
  return actual >= MIN_SAFE_PREVIOUS_MINUTES ? actual : null;
}

function compare(
  ageMinutes: number | null,
  recent: number | null,
  hour: number | null,
  minPrevious: number,
): PaceResult {
  if (ageMinutes == null) return { ok: false, reason: "NO_AGE" };
  if (recent == null) return { ok: false, reason: "NO_RECENT_WINDOW" };
  if (hour == null) return { ok: false, reason: "NO_PREVIOUS_WINDOW" };

  const previousMinutes = previousWindowMinutes(ageMinutes);
  if (previousMinutes == null) return { ok: false, reason: "INSUFFICIENT_HISTORY" };

  const previous = Math.max(hour - recent, 0);
  if (previous < minPrevious) return { ok: false, reason: "INSUFFICIENT_HISTORY" };

  const recentPerMinute = recent / RECENT_WINDOW_MINUTES;
  const previousPerMinute = previous / previousMinutes;
  return {
    ok: true,
    ratio: recentPerMinute / previousPerMinute,
    recent,
    recentPerMinute,
    previous,
    previousMinutes,
    previousPerMinute,
  };
}

/** VA — volume acceleration: m5 USD volume pace vs the previous window's pace. */
export function volumeAcceleration(s: PairSnapshot): PaceResult {
  return compare(pairAgeMinutes(s), s.volume.m5, s.volume.h1, MIN_PREVIOUS_VOLUME_USD);
}

/** TA — transaction acceleration: m5 (buys+sells) pace vs the previous window's pace. */
export function transactionAcceleration(s: PairSnapshot): PaceResult {
  const m5 = s.txns.m5 ? s.txns.m5.buys + s.txns.m5.sells : null;
  const h1 = s.txns.h1 ? s.txns.h1.buys + s.txns.h1.sells : null;
  return compare(pairAgeMinutes(s), m5, h1, MIN_PREVIOUS_TXNS);
}
