import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { EASE_VAULT } from "./Reveal";
import { stopScroll } from "./SmoothScroll";
import logoDark from "@/assets/marcovault-logo-dark.png";

const SEEN_KEY = "mv_seen";
const COUNT_MS = 1500;
const DOORS_MS = 1050;

/** Vault-door reveal, once per session (spec §2.3). */
export function Preloader() {
  const [show, setShow] = useState(false);
  const [count, setCount] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = true;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
      if (!seen) sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      seen = true;
    }
    if (!reduced && !seen) setShow(true);
  }, []);

  useEffect(() => {
    if (!show) return;
    stopScroll(true);
    document.documentElement.style.overflow = "hidden";
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / COUNT_MS);
      setCount(Math.round(100 * (1 - Math.pow(1 - p, 3)))); // decelerating, heavy
      if (p < 1) raf = requestAnimationFrame(tick);
      else setExiting(true);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.style.overflow = "";
      stopScroll(false);
    };
  }, [show]);

  useEffect(() => {
    if (!exiting) return;
    const t = setTimeout(() => setShow(false), DOORS_MS);
    return () => clearTimeout(t);
  }, [exiting]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[120] flex" aria-hidden>
      {/* vault doors */}
      <motion.div
        className="h-full w-1/2 bg-[--void]"
        style={{ borderRight: "1px solid rgba(194,168,120,0.35)" }}
        animate={{ x: exiting ? "-100%" : 0 }}
        transition={{ duration: DOORS_MS / 1000, ease: EASE_VAULT }}
      />
      <motion.div
        className="h-full w-1/2 bg-[--void]"
        animate={{ x: exiting ? "100%" : 0 }}
        transition={{ duration: DOORS_MS / 1000, ease: EASE_VAULT }}
      />
      {/* center emblem */}
      <motion.div
        className="pointer-events-none absolute inset-0 grid place-items-center"
        animate={{ opacity: exiting ? 0 : 1 }}
        transition={{ duration: 0.35 }}
      >
        <div className="relative flex flex-col items-center">
          <svg width="200" height="200" viewBox="0 0 200 200" className="absolute -top-12">
            <motion.circle
              cx="100"
              cy="100"
              r="96"
              fill="none"
              stroke="#C2A878"
              strokeOpacity="0.65"
              strokeWidth="1"
              strokeDasharray={2 * Math.PI * 96}
              initial={{ strokeDashoffset: 2 * Math.PI * 96 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 1.4, ease: EASE_VAULT }}
            />
          </svg>
          <motion.img
            src={logoDark}
            alt=""
            className="w-24"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, ease: EASE_VAULT }}
          />
          <div className="mono-data mt-16 text-[11px] tracking-[0.3em] text-[--faint]">
            {String(count).padStart(3, "0")} <span className="text-[--gold]">/</span> 100
          </div>
        </div>
      </motion.div>
    </div>
  );
}
