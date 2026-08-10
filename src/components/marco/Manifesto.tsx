import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { FadeIn } from "./shell/Reveal";

const SENTENCE =
  "The market screams. The Vault does not. We move on signal — multi-chain alpha, curated research, sniper-grade execution — kept behind machined steel.";

const STATS = [
  { k: "CHAINS COVERED", v: "14+" },
  { k: "OPERATOR DESK", v: "24/7" },
  { k: "ESTABLISHED", v: "2024" },
];

function Word({
  progress,
  range,
  children,
}: {
  progress: MotionValue<number>;
  range: [number, number];
  children: string;
}) {
  const opacity = useTransform(progress, range, [0.13, 1]);
  return (
    <motion.span style={{ opacity }} className="mr-[0.32em] inline-block">
      {children}
    </motion.span>
  );
}

/** SCENE 02 — manifesto: words illuminate as the reader descends. */
export function Manifesto() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.82", "end 0.42"],
  });
  const words = SENTENCE.split(" ");

  return (
    <section id="manifesto" className="relative bg-[rgba(11,12,14,0.9)]">
      <div className="u-container py-28 md:py-40">
        <div className="mono-label mb-10 flex items-center gap-4 text-(--gold)!">
          <span>01</span>
          <span className="inline-block h-px w-10 bg-(--gold)" />
          <span className="text-(--faint)!">THE MANIFESTO</span>
        </div>

        <div ref={ref}>
          <p className="max-w-[24ch] font-display text-[clamp(28px,4.6vw,58px)] font-medium uppercase leading-[1.18] tracking-[0.015em] text-(--bone) md:max-w-[26ch]">
            {words.map((w, i) => (
              <Word
                key={i}
                progress={scrollYProgress}
                range={[i / words.length, Math.min(1, (i + 1.6) / words.length)]}
              >
                {w}
              </Word>
            ))}
          </p>
        </div>

        <FadeIn delay={0.1} className="mt-20 md:mt-28">
          <div className="hairline-t grid grid-cols-1 sm:grid-cols-3">
            {STATS.map((s) => (
              <div key={s.k} className="hairline-b flex items-baseline justify-between gap-6 py-7 sm:block sm:border-b-0 sm:py-8 sm:pr-10">
                <div className="mono-data text-[clamp(28px,3vw,40px)] font-medium text-(--bone)">
                  {s.v}
                </div>
                <div className="mono-label mt-2">{s.k}</div>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
