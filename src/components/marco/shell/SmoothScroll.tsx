import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";

let lenis: Lenis | null = null;

/** Weighted smooth scroll (spec §2.3). No-ops under prefers-reduced-motion. */
export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    lenis = new Lenis({ lerp: 0.08, wheelMultiplier: 0.95 });
    let raf = 0;
    const loop = (t: number) => {
      lenis?.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis?.destroy();
      lenis = null;
    };
  }, []);
  return <>{children}</>;
}

/** Smooth-scroll to an anchored section; safe fallback everywhere. */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -88, duration: 1.4 });
  else el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function stopScroll(stopped: boolean) {
  if (!lenis) return;
  if (stopped) lenis.stop();
  else lenis.start();
}
