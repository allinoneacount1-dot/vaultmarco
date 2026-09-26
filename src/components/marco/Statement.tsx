import { useEffect, useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { statementStage, useSceneMode } from "./three/sceneStore";
import { StatementStatic } from "./three/StatementStatic";

/** SCENE 05 — WEALTH MOVES IN SILENCE.
 *  The section is 2.4 viewports tall; the stage stays pinned while the reader
 *  scrolls "through" it. Where the landing runs its 3D canvas, the statement
 *  is a cast-metal inscription drawn in that same canvas (StatementInscription)
 *  and anchored to this stage; everywhere else it is the flat chrome version.
 *  Either way the heading below is the real text — the 3D is decoration. */
export function Statement() {
  const ref = useRef<HTMLElement>(null);
  const mode = useSceneMode();
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  // flat version: one slow light across the metal, then still
  const sweep = useTransform(scrollYProgress, [0.3, 0.75], ["120%", "-20%"]);
  const capOpacity = useTransform(scrollYProgress, [0.55, 0.72], [0, 1]);

  useEffect(() => {
    statementStage.section = ref.current;
    return () => {
      statementStage.section = null;
    };
  }, []);

  const flat = mode === "static";

  return (
    <section ref={ref} className="relative h-[240vh]" aria-labelledby="statement-heading">
      <div className="sticky top-0 grid h-screen place-items-center overflow-hidden">
        <div className="flex flex-col items-center px-4 font-display text-[length:min(8.4vw,calc((100vw-32px)/11),130px)]">
          <motion.h2
            id="statement-heading"
            className={`relative text-center font-extrabold uppercase leading-[0.98] tracking-[0.01em] transition-opacity duration-700 ${
              flat ? "chrome-text" : "text-transparent opacity-0"
            }`}
            style={flat && !reduced ? ({ "--sweep": sweep } as never) : undefined}
          >
            <span className="block whitespace-nowrap">Wealth moves</span>
            <span className="block whitespace-nowrap">in silence.</span>
          </motion.h2>
          {flat && <StatementStatic />}
        </div>

        <motion.div
          style={{ opacity: reduced ? 1 : capOpacity }}
          className="mono-label absolute bottom-10 left-1/2 -translate-x-1/2 tracking-[0.4em]!"
        >
          MARCOVAULT
        </motion.div>
      </div>
    </section>
  );
}
