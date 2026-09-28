import { useSyncExternalStore } from "react";

/**
 * Tiny bridge between the DOM landing sections and the one persistent
 * journey canvas (HeroScene). No React context: the canvas is mounted inside
 * the hero, the statement lives far below it, and both only need a few
 * numbers — so a module-level store it is.
 */

export type SceneMode = "pending" | "3d" | "static";
type SceneState = { mode: SceneMode; ready: boolean };

let state: SceneState = { mode: "pending", ready: false };
const listeners = new Set<() => void>();

export function setSceneState(patch: Partial<SceneState>) {
  const next = { ...state, ...patch };
  if (next.mode === state.mode && next.ready === state.ready) return;
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** "3d" once the canvas has drawn real frames; "static" for the flat fallback. */
export function useSceneMode(): SceneMode {
  return useSyncExternalStore(
    subscribe,
    () => (state.mode === "3d" && !state.ready ? "pending" : state.mode),
    () => "pending" as SceneMode,
  );
}

/**
 * The WEALTH MOVES IN SILENCE statement. The DOM section registers itself
 * here; the canvas reads its live rect every frame to anchor the 3D
 * inscription to it, and publishes back where the inscription sits so the
 * journey monogram can take its place beside it.
 */
export const statementStage = {
  /** the 2.4-viewport section whose sticky stage the inscription is pinned to */
  section: null as HTMLElement | null,
  /** 0 → 1 blend of the journey monogram onto its statement pose */
  w: 0,
  /** statement monogram pose (world units), valid while w > 0 */
  pos: [0, 0, 0] as [number, number, number],
  rot: [0, 0, 0] as [number, number, number],
  s: 1,
  o: 0,
  /** orbit ring scale in its own plane, and across it (tube weight) */
  ring: 1,
  ringZ: 1,
};
