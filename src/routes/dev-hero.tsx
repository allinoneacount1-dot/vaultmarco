import { createFileRoute } from "@tanstack/react-router";
import { HeroSceneLazy } from "@/components/marco/three/HeroSceneLazy";

/** TEMP dev-only stage for tuning the 3D chrome (deleted in Task 8). */
function DevHero() {
  return (
    <div className="relative h-screen w-screen bg-void">
      <HeroSceneLazy />
    </div>
  );
}

export const Route = createFileRoute("/dev-hero")({ component: DevHero });
