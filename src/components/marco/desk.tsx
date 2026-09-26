import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRadar } from "@/hooks/usePairUniverse";
import { DUR, EASE } from "@/lib/motion";
import { UNIVERSE_HELP, known, universeLabel, type DeskState } from "@/lib/deskState";
import { changeTone, priceParts, signedPct } from "@/lib/format";

/**
 * DESK PRIMITIVES — the few shared pieces every dashboard module uses, so the
 * desk reads as one product: one segmented control, one status vocabulary,
 * one data-change feedback. No market logic lives here.
 */

/* ------------------------------------------------------------------ *
 * Segmented control (tabs / pills)
 * ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className = "",
}: {
  options: readonly { id: T; label?: string }[];
  value: T;
  onChange: (id: T) => void;
  /** Accessible group name. */
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`hairline inline-flex max-w-full gap-0.5 overflow-x-auto rounded-(--radius-md) p-0.5 ${className}`}
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            className={`min-h-9 shrink-0 cursor-pointer rounded-sm px-3 font-mono text-[10px] tracking-[0.14em] transition-[color,background-color] duration-(--dur-micro) ease-(--ease-snap) focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--gold) lg:min-h-8 ${
              active
                ? "chrome-fill"
                : "text-muted-foreground hover:bg-(--panel-2) hover:text-(--bone)"
            }`}
          >
            {o.label ?? o.id}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Localized data-change feedback
 * ------------------------------------------------------------------ */

/**
 * Renders `children`; when the underlying numeric `value` actually changes
 * (never on first render, never when unchanged, never from/to unknown), the
 * text briefly takes the direction color and decays back. Color only, only
 * this number — the component around it does not flash.
 */
export function Tick({
  value,
  children,
  className = "",
}: {
  value: number | null | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  const prev = useRef(value);
  const [flash, setFlash] = useState<{ dir: "up" | "down"; n: number } | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = value;
    if (p == null || value == null || p === value) return;
    setFlash((f) => ({ dir: value > p ? "up" : "down", n: (f?.n ?? 0) + 1 }));
  }, [value]);
  return (
    <span key={flash?.n ?? 0} className={`${className} ${flash ? `mv-flash-${flash.dir}` : ""}`}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Status vocabulary (shape + color + text — never color alone)
 * ------------------------------------------------------------------ */

/** Literal classes (Tailwind only emits classes it can read in source). */
const STATE_TONE: Record<DeskState, string> = {
  loading: "text-(--faint)!",
  live: "text-(--gold)!",
  degraded: "text-(--champagne)!",
  stale: "text-(--champagne)!",
  offline: "text-(--down)!",
};

/** solid = live · half = partial · ring = last known · hollow = connecting. */
export function StateDot({ state, className = "" }: { state: DeskState; className?: string }) {
  const shape =
    state === "live"
      ? "bg-current"
      : state === "degraded"
        ? "border border-current bg-[linear-gradient(90deg,currentColor_50%,transparent_50%)]"
        : state === "offline"
          ? "bg-current opacity-80"
          : "border border-current";
  return (
    <span aria-hidden className={`inline-block size-1.5 rounded-full ${shape} ${className}`} />
  );
}

/**
 * Persistent status in the topbar. Its scope is the PAIR UNIVERSE round
 * (DexScreener; the same temporal-truth rule as Alpha Radar) and the label says
 * so — "UNIVERSE LIVE" — because other panels (CoinGecko, Fear & Greed) report
 * their own state. No pulsing; a change of state is a short crossfade and is
 * announced.
 */
export function DeskStatus() {
  const { status } = useRadar();
  const state: DeskState = status;
  return (
    <DeskTip tip={UNIVERSE_HELP[known(state) ?? "loading"]}>
      <span
        role="status"
        aria-live="polite"
        tabIndex={0}
        className={`mono-label flex min-w-[128px] cursor-default items-center justify-end gap-2 text-[9px]! focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--gold) ${STATE_TONE[known(state) ?? "loading"]}`}
        data-testid="desk-status"
        data-state={state}
      >
        <span className="sr-only">Pair universe status: </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={state}
            className="flex items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.micro, ease: EASE.snap }}
          >
            <StateDot state={state} />
            {universeLabel(state)}
          </motion.span>
        </AnimatePresence>
      </span>
    </DeskTip>
  );
}

/* ------------------------------------------------------------------ *
 * Tooltip — one treatment: elevated surface, hairline, mono, short delay
 * ------------------------------------------------------------------ */

/**
 * CSS-only tooltip (no positioning library in the bundle): shown on hover or
 * keyboard focus after a short delay, anchored below-right of its trigger,
 * linked with aria-describedby.
 */
export function DeskTip({
  tip,
  children,
}: {
  tip: React.ReactNode;
  children: React.ReactElement<{ "aria-describedby"?: string }>;
}) {
  const id = useId();
  return (
    <span className="group/tip relative inline-flex">
      <span aria-describedby={id} className="inline-flex">
        {children}
      </span>
      <span
        id={id}
        role="tooltip"
        className="mv-motion pointer-events-none invisible absolute right-0 top-full z-[var(--z-toast)] mt-2 w-max max-w-[260px] rounded-sm border border-(--hairline-strong) bg-(--elevated) px-2.5 py-1.5 font-mono text-[10px] leading-relaxed tracking-[0.04em] text-(--bone) opacity-0 shadow-(--shadow-elevated) transition-[opacity,visibility] duration-(--dur-micro) group-focus-within/tip:visible group-focus-within/tip:opacity-100 group-hover/tip:visible group-hover/tip:opacity-100 group-hover/tip:delay-[250ms]"
      >
        {tip}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Numbers
 * ------------------------------------------------------------------ */

/** A price with crypto-native subscript zeros; unknown renders "—", never 0. */
export function Price({
  value,
  className = "",
}: {
  value: number | null | undefined;
  className?: string;
}) {
  const p = priceParts(value);
  return (
    <Tick value={value} className={`mono-data whitespace-nowrap ${className}`}>
      {p.kind === "subscript" ? (
        <span aria-label={p.text}>
          <span aria-hidden>
            {p.head}
            <sub className="relative -bottom-[0.15em] px-px text-[0.72em] text-(--muted-2)">
              {p.zeros}
            </sub>
            {p.tail}
          </span>
        </span>
      ) : (
        p.text
      )}
    </Tick>
  );
}

const PCT_TONE = {
  up: "text-(--up)",
  down: "text-(--down)",
  flat: "text-(--muted-2)",
  unknown: "text-(--faint)",
} as const;

/** A signed change with a typographic minus; direction color only when known. */
export function Pct({
  value,
  digits = 1,
  suffix,
  className = "",
}: {
  value: number | null | undefined;
  digits?: number;
  suffix?: string;
  className?: string;
}) {
  return (
    <span className={`mono-data whitespace-nowrap ${PCT_TONE[changeTone(value)]} ${className}`}>
      {signedPct(value, digits)}
      {suffix && value != null ? ` ${suffix}` : ""}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Composition — numbered desk zones (the recurring MARCOVAULT signature)
 * ------------------------------------------------------------------ */

/**
 * `01 — MARKET CONTEXT ─────────── COINGECKO · DEXSCREENER`
 * A gold index, a mono label, a hairline rule that runs to the edge, and
 * terminal metadata. It orders the page as context → change → signal → market.
 */
export function Zone({
  index,
  label,
  meta,
  id,
  children,
}: {
  index: string;
  label: string;
  meta?: React.ReactNode;
  id?: string;
  children: React.ReactNode;
}) {
  const headingId = `zone-${index}`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="scroll-mt-[72px] space-y-3 lg:space-y-4"
    >
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] tracking-[0.2em] text-(--gold)">{index}</span>
        <h2
          id={headingId}
          className="mono-label shrink-0 font-mono! text-[10px]! text-(--muted-2)!"
        >
          {label}
        </h2>
        <span aria-hidden className="h-px flex-1 bg-(--hairline)" />
        {meta && (
          <span className="hidden shrink-0 font-mono text-[9px] tracking-[0.18em] text-(--faint) sm:inline">
            {meta}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
