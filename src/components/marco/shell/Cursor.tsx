import { useEffect, useRef } from "react";

/** Signature cursor: a small gold ring with weighted follow.
 *  Grows over interactive elements; desktop fine-pointer only; honors reduced-motion. */
export function Cursor() {
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ring.current;
    if (!el) return;

    document.documentElement.classList.add("has-mv-cursor");

    let x = innerWidth / 2;
    let y = innerHeight / 2;
    let tx = x;
    let ty = y;
    let scale = 1;
    let tScale = 1;
    let visible = false;
    let raf = 0;

    const isInteractive = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest("a, button, [role='button'], input, select, textarea, [data-cursor]");

    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      tScale = isInteractive(e.target) ? 2.1 : 1;
      if (!visible) {
        visible = true;
        el.style.opacity = "1";
      }
    };
    const onLeave = () => {
      visible = false;
      el.style.opacity = "0";
    };
    const loop = () => {
      x += (tx - x) * 0.16;
      y += (ty - y) * 0.16;
      scale += (tScale - scale) * 0.14;
      el.style.transform = `translate3d(${x - 14}px, ${y - 14}px, 0) scale(${scale})`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.documentElement.classList.remove("has-mv-cursor");
    };
  }, []);

  return (
    <div
      ref={ring}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[125] size-7 rounded-full opacity-0 transition-opacity duration-300"
      style={{ border: "1px solid rgba(194,168,120,0.85)", willChange: "transform" }}
    />
  );
}
