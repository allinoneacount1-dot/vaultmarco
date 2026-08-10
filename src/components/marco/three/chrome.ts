import * as THREE from "three";

/**
 * Single source of truth for the brand metal (spec §2.4):
 * one material shared by the 3D monogram AND the 3D display text,
 * lit by one studio rig — so nothing can read as "pasted on".
 */
export function createChromeMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color("#d6d8db"),
    metalness: 1,
    roughness: 0.16,
    envMapIntensity: 1.35,
    // machined facets: uniform normals per face — kills the smoothing seams
    // that showed on the big letter faces, and reads more like the logo's bevels
    flatShading: true,
  });
}

export function createGoldMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color("#c2a878"),
    metalness: 1,
    roughness: 0.25,
    envMapIntensity: 1.4,
    emissive: new THREE.Color("#c2a878"),
    emissiveIntensity: 0.32,
  });
}

/** Ease used by cursor-inertia (matches --ease-vault feel). */
export function damp(current: number, target: number, lambda: number, dt: number) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}
