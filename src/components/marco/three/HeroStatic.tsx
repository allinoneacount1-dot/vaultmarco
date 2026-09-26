import logoDark from "@/assets/marcovault-logo-dark.png";

/** Static hero visual — WebGL-less / reduced-motion / small-screen fallback.
 *  Same composition as the 3D scene, drawn flat: two lines of one inscription
 *  with the monogram set in the open band between them, clear of both lines.
 *  Sizes are in em of the display type, so the proportions hold at every width
 *  (monogram ≈ 1em wide, ≈ one cap-height tall, in a band ≈ 1.4 caps high). */
export function HeroStatic() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
      <div className="relative flex flex-col items-center gap-[1.05em] font-display font-extrabold leading-[0.8] tracking-[0.01em] text-[clamp(44px,11vw,150px)]">
        <img
          src={logoDark}
          alt=""
          // the logo file carries a pin-and-arc crown the 3D monogram does not
          // (there the gold orbit ring plays that part) — clip it off so the
          // flat composition matches the sculpture instead of sprouting a spike
          className="pointer-events-none select-none absolute top-1/2 left-1/2 w-[1.6em] max-w-none -translate-x-1/2 -translate-y-[54%] [clip-path:inset(27%_0_0_0)] drop-shadow-[0_30px_60px_rgba(0,0,0,0.85)]"
          loading="eager"
          decoding="async"
        />
        <span className="chrome-text relative text-center">ENTER</span>
        <span className="chrome-text relative text-center">THE&nbsp;VAULT</span>
      </div>
    </div>
  );
}
