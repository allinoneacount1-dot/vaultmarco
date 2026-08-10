import { lazy, Suspense, useEffect, useState } from "react";
import { HeroStatic } from "./HeroStatic";

const HeroScene = lazy(() => import("./HeroScene"));

function canRun3D(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (window.innerWidth < 768) return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Gate + lazy-load: 3D only where it earns its cost; static everywhere else. */
export function HeroSceneLazy() {
  const [mode, setMode] = useState<"pending" | "3d" | "static">("pending");

  useEffect(() => {
    // decide after first paint so the page never waits on three.js
    const id = window.requestAnimationFrame(() => setMode(canRun3D() ? "3d" : "static"));
    return () => window.cancelAnimationFrame(id);
  }, []);

  if (mode !== "3d") return <HeroStatic />;
  return (
    <Suspense fallback={<HeroStatic />}>
      <HeroScene />
    </Suspense>
  );
}
