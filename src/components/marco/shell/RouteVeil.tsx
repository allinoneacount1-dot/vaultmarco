import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { EASE_VAULT } from "./Reveal";

/** Route transition veil (spec §2.3): pathname changes pass through the void
 *  with a 1px gold hairline — no hard cuts. Hash-only changes are ignored. */
export function RouteVeil() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const prev = useRef(pathname);
  const [veil, setVeil] = useState(false);

  useEffect(() => {
    if (prev.current === pathname) return;
    prev.current = pathname;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setVeil(true);
    const t = setTimeout(() => setVeil(false), 520);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <AnimatePresence>
      {veil && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[120] grid place-items-center bg-(--void)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.12 } }}
          exit={{ opacity: 0, transition: { duration: 0.42, ease: EASE_VAULT } }}
        >
          <motion.span
            className="block h-px bg-(--gold)"
            initial={{ width: 0, opacity: 0.9 }}
            animate={{ width: "34vw", transition: { duration: 0.5, ease: EASE_VAULT } }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
