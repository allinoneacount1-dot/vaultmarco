import logoDark from "@/assets/marcovault-logo-dark.png";

/** Static hero visual — WebGL-less / reduced-motion / small-screen fallback.
 *  Same composition as the 3D scene: type + monogram, one metal. */
export function HeroStatic() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
      <div className="relative flex flex-col items-center">
        <img
          src={logoDark}
          alt=""
          className="pointer-events-none select-none absolute top-1/2 left-1/2 w-[46vmin] max-w-[420px] -translate-x-1/2 -translate-y-1/2 opacity-90 drop-shadow-[0_30px_60px_rgba(0,0,0,0.85)]"
          loading="eager"
          decoding="async"
        />
        <span className="chrome-text relative font-display font-extrabold leading-[0.98] tracking-[0.01em] text-[clamp(52px,11vw,150px)] text-center">
          ENTER
          <br />
          THE&nbsp;VAULT
        </span>
      </div>
    </div>
  );
}
