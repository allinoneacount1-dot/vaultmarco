import { lazy, Suspense, useEffect, useState } from "react";
import { HeroStatic } from "./HeroStatic";

const HeroScene = lazy(() => import("./HeroScene"));

const WIDE = "(min-width: 768px)";
const REDUCED = "(prefers-reduced-motion: reduce)";

/** Cheap, synchronous part of the gate: viewport + motion preference. */
function mayRun3D(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(WIDE).matches && !window.matchMedia(REDUCED).matches;
}

/* WebGL support does not change during a visit: probe once, on first need */
let webgl: boolean | undefined;
function hasWebGL(): boolean {
  if (webgl === undefined) {
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webgl = false;
    }
  }
  return webgl;
}

/**
 * Gate + lazy-load: 3D only where it earns its cost; static everywhere else.
 *
 * Where 3D is likely, nothing is drawn until the scene fades itself in (see
 * HeroScene) — showing the flat fallback first would flash one composition,
 * blank out while the canvas compiles, then pop in a different one. Where it
 * is not (small screen, reduced motion), the static hero renders immediately.
 *
 * The gate stays truthful for the whole visit: it listens to the width
 * breakpoint and the motion preference (change events fire only when a query
 * flips — no resize polling), so rotating a tablet, resizing across 768px or
 * turning on reduced motion swaps modes without a reload.
 */
export function HeroSceneLazy() {
  const [mode, setMode] = useState<"pending" | "3d" | "static">(() =>
    mayRun3D() ? "pending" : "static",
  );

  useEffect(() => {
    const wide = window.matchMedia(WIDE);
    const reduced = window.matchMedia(REDUCED);
    const decide = () => setMode(mayRun3D() && hasWebGL() ? "3d" : "static");
    // first decision after first paint so the page never waits on the probe
    const id = window.requestAnimationFrame(decide);
    wide.addEventListener("change", decide);
    reduced.addEventListener("change", decide);
    return () => {
      window.cancelAnimationFrame(id);
      wide.removeEventListener("change", decide);
      reduced.removeEventListener("change", decide);
    };
  }, []);

  if (mode === "static") return <HeroStatic />;
  if (mode === "pending") return null;
  return (
    <Suspense fallback={null}>
      <HeroScene />
    </Suspense>
  );
}
