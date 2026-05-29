import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6 },
};

export function SectionHeader({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="max-w-3xl">
      <div className="inline-flex items-center gap-2 text-[10px] font-mono tracking-[0.35em] text-primary mb-4">
        <span className="size-1 rounded-full bg-primary animate-pulse-glow" />
        {kicker}
      </div>
      <h2 className="text-chrome font-display text-3xl sm:text-5xl font-semibold leading-tight">
        {title}
      </h2>
      {sub && <p className="mt-4 text-muted-foreground text-base sm:text-lg max-w-2xl">{sub}</p>}
    </div>
  );
}

export { fadeUp };
