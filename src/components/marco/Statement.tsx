import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

/** SCENE 05 — pinned scroll-cinema: one colossal chrome breath.
 *  The section is 2.4 viewports tall; the type stays pinned while the reader
 *  scrolls "through" it — light sweeps across the metal, the ring turns. */
export function Statement() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const sweep = useTransform(scrollYProgress, [0.1, 0.9], ["135%", "-35%"]);
  const scale = useTransform(scrollYProgress, [0.15, 0.5, 0.85], [0.94, 1, 1.045]);
  const ringRotate = useTransform(scrollYProgress, [0, 1], [-14, 22]);
  const capOpacity = useTransform(scrollYProgress, [0.55, 0.72], [0, 1]);

  return (
    <section ref={ref} className="relative h-[240vh]" aria-label="Wealth moves in silence">
      <div className="sticky top-0 grid h-screen place-items-center overflow-hidden">
        {/* ring motif, slowly turning with the scroll */}
        <motion.svg
          aria-hidden
          viewBox="0 0 600 600"
          style={{ rotate: ringRotate }}
          className="pointer-events-none absolute left-1/2 top-1/2 w-[min(78vmin,680px)] -translate-x-1/2 -translate-y-1/2 opacity-[0.16]"
        >
          <circle cx="300" cy="300" r="296" fill="none" stroke="#C2A878" strokeWidth="0.8" />
          <circle cx="300" cy="300" r="228" fill="none" stroke="#C2A878" strokeWidth="0.4" strokeDasharray="1 6" />
          <circle cx="300" cy="4" r="3" fill="#C2A878" />
        </motion.svg>

        <motion.h2
          className="chrome-text relative px-6 text-center font-display text-[clamp(40px,8.4vw,130px)] font-extrabold uppercase leading-[0.98] tracking-[0.01em]"
          style={{ "--sweep": sweep, scale } as never}
        >
          Wealth moves
          <br />
          in silence.
        </motion.h2>

        <motion.div
          style={{ opacity: capOpacity }}
          className="mono-label absolute bottom-10 left-1/2 -translate-x-1/2 tracking-[0.4em]!"
        >
          MARCOVAULT
        </motion.div>
      </div>
    </section>
  );
}
