import { lazy, Suspense, useEffect, useState } from "react";
import { HeroStatic } from "./HeroStatic";

const HeroScene = lazy(() => import("./HeroScene"));

/** Cheap, synchronous part of the gate: viewport + motion preference. */
function mayRun3D(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return window.innerWidth >= 768;
}

function canRun3D(): boolean {
  if (!mayRun3D()) return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Gate + lazy-load: 3D only where it earns its cost; static everywhere else.
 *
 * Where 3D is likely, nothing is drawn until the scene fades itself in (see
 * HeroScene) — showing the flat fallback first would flash one composition,
 * blank out while the canvas compiles, then pop in a different one. Where it
 * is not (small screen, reduced motion), the static hero renders immediately.
 */
export function HeroSceneLazy() {
  const [mode, setMode] = useState<"pending" | "3d" | "static">(() =>
    mayRun3D() ? "pending" : "static",
  );

  useEffect(() => {
    if (mode !== "pending") return;
    // probe WebGL after first paint so the page never waits on three.js
    const id = window.requestAnimationFrame(() => setMode(canRun3D() ? "3d" : "static"));
    return () => window.cancelAnimationFrame(id);
  }, [mode]);

  if (mode === "static") return <HeroStatic />;
  if (mode === "pending") return null;
  return (
    <Suspense fallback={null}>
      <HeroScene />
    </Suspense>
  );
}
