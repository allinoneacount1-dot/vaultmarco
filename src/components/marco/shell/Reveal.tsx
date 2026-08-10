import { motion } from "framer-motion";
import type { ReactNode } from "react";

export const EASE_VAULT = [0.16, 1, 0.3, 1] as const;

/** Line-mask reveal: content rises out of its own baseline. Fires once (spec §7). */
export function Reveal({
  children,
  delay = 0,
  y = "110%",
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: string | number;
  className?: string;
}) {
  return (
    <span className={`block overflow-hidden ${className ?? ""}`}>
      <motion.span
        className="block will-change-transform"
        initial={{ y }}
        whileInView={{ y: 0 }}
        viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
        transition={{ duration: 0.9, delay, ease: EASE_VAULT }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/** Quiet fade-up for blocks (no scale pops). Fires once. */
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
      transition={{ duration: 0.9, delay, ease: EASE_VAULT }}
    >
      {children}
    </motion.div>
  );
}

/** Hairline that draws itself in. */
export function DrawnLine({ delay = 0, className }: { delay?: number; className?: string }) {
  return (
    <span className={`block overflow-hidden ${className ?? ""}`}>
      <motion.span
        className="block h-px w-full origin-left bg-[--hairline-strong]"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{ duration: 1.1, delay, ease: EASE_VAULT }}
      />
    </span>
  );
}
