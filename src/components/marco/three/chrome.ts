import * as THREE from "three";

/**
 * Single source of truth for the brand metal (spec §2.4):
 * one material recipe shared by the 3D monogram AND the 3D display text,
 * lit by one studio rig — so nothing can read as "pasted on".
 *
 * `faceted` (default) shades every face with its own normal — machined facets
 * that suit the monogram's flat chamfers. The display type passes `false`: its
 * geometry carries crease-angle normals instead (hard cap/bevel edges, smooth
 * along curves), so the O-U-R bowls stop reading as polygons. Colour,
 * metalness, roughness and environment response are identical either way.
 */
export function createChromeMaterial({ faceted = true } = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color("#d6d8db"),
    metalness: 1,
    roughness: 0.16,
    envMapIntensity: 1.35,
    flatShading: faceted,
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
