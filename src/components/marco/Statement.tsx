import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

/** SCENE 05 — one colossal chrome breath. Light sweeps with the scroll. */
export function Statement() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const sweep = useTransform(scrollYProgress, [0, 1], ["120%", "-20%"]);

  return (
    <section
      ref={ref}
      className="relative grid min-h-[72vh] place-items-center overflow-hidden bg-(--void) py-24"
      aria-label="Wealth moves in silence"
    >
      {/* faint ring motif */}
      <svg
        aria-hidden
        viewBox="0 0 600 600"
        className="pointer-events-none absolute left-1/2 top-1/2 w-[min(78vmin,680px)] -translate-x-1/2 -translate-y-1/2 opacity-[0.16]"
      >
        <circle cx="300" cy="300" r="296" fill="none" stroke="#C2A878" strokeWidth="0.8" />
        <circle cx="300" cy="300" r="228" fill="none" stroke="#C2A878" strokeWidth="0.4" strokeDasharray="1 6" />
      </svg>

      <motion.h2
        className="chrome-text relative px-6 text-center font-display text-[clamp(40px,8.4vw,130px)] font-extrabold uppercase leading-[0.98] tracking-[0.01em]"
        style={{ "--sweep": sweep } as React.CSSProperties}
      >
        Wealth moves
        <br />
        in silence.
      </motion.h2>

      <div className="mono-label absolute bottom-10 left-1/2 -translate-x-1/2 tracking-[0.4em]!">
        MARCOVAULT
      </div>
    </section>
  );
}
