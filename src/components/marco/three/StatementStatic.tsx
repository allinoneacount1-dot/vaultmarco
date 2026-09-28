import logoDark from "@/assets/marcovault-logo-dark.png";

/** Static statement hallmark — WebGL-less / reduced-motion / small-screen
 *  fallback for the 3D inscription's monogram and opened-out orbit. Set below
 *  the flat chrome heading exactly where the sculpture sits: centred, clear of
 *  IN SILENCE., the orbit a hairline ellipse as wide as that line. Sizes are
 *  in em of the display type, so the proportions hold at every width. */
export function StatementStatic() {
  return (
    <div aria-hidden className="relative mt-[0.4em] h-[0.9em] w-[7.3em] max-w-full">
      <span className="absolute inset-x-0 top-1/2 h-[0.09em] -translate-y-1/2 rounded-[50%] border border-[rgba(194,168,120,0.5)]" />
      <img
        src={logoDark}
        alt=""
        // the logo file carries a pin-and-arc crown the 3D monogram does not —
        // clipped off, as in the static hero
        className="pointer-events-none absolute top-1/2 left-1/2 w-[1.15em] max-w-none -translate-x-1/2 -translate-y-[54%] select-none [clip-path:inset(27%_0_0_0)] drop-shadow-[0_18px_30px_rgba(0,0,0,0.85)]"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
