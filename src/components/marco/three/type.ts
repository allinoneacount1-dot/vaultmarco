import * as THREE from "three";
import { FontLoader, toCreasedNormals } from "three-stdlib";
import typeface from "@/assets/unbounded-bold.typeface.json";

/** Unbounded Bold, overlap-free outlines (scripts/woff2-to-ttf.py) — parsed once for every scene. */
export const font = new FontLoader().parse(typeface as never);

export type ChromeTypeSpec = {
  size: number;
  depth: number;
  bevelThickness: number;
  bevelSize: number;
  bevelSegments: number;
  curveSegments: number;
};

/**
 * One line of extruded chrome type, centred in the geometry itself (no
 * layout-effect centring, so the very first frame is already in place). The
 * bevel is inset by its own size (bevelOffset), so the chamfer never
 * emboldens the letters or closes their spacing. Crease-angle normals: hard at
 * the cap/bevel/wall breaks, smooth along curves.
 */
export function createChromeTypeGeometry(text: string, spec: ChromeTypeSpec) {
  const raw = new THREE.ExtrudeGeometry(font.generateShapes(text, spec.size), {
    depth: spec.depth,
    curveSegments: spec.curveSegments,
    bevelEnabled: true,
    bevelThickness: spec.bevelThickness,
    bevelSize: spec.bevelSize,
    bevelOffset: -spec.bevelSize,
    bevelSegments: spec.bevelSegments,
  });
  const geo = toCreasedNormals(raw, THREE.MathUtils.degToRad(15));
  raw.dispose();
  geo.computeBoundingBox();
  const c = new THREE.Vector3();
  geo.boundingBox!.getCenter(c);
  geo.translate(-c.x, -c.y, -c.z);
  return geo;
}
