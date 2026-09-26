import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { createChromeMaterial, damp } from "./chrome";
import { createChromeTypeGeometry } from "./type";
import { statementStage } from "./sceneStore";

/* ═══════════════════════════════════════════════════════════════
   WEALTH MOVES / IN SILENCE. — the statement as a cast-metal inscription.

   Same world as ENTER THE VAULT, second level of intensity: the same
   typeface, chamfer family, metal and studio, drawn in the same persistent
   canvas — but shallower, finer, darker and nearly still. It is anchored to
   the DOM section's pinned stage (the DOM keeps the real heading), so it
   rides the page in and out exactly like flat type would.

   Scroll: flat and quiet → depth revealed → one light travels across the
   letters → settles into silence. No per-letter motion.
   ═══════════════════════════════════════════════════════════════ */

const LINE_A = "WEALTH MOVES";
const LINE_B = "IN SILENCE.";

/* size-1 units: WEALTH MOVES is 14.74 wide, caps 1.09 high (incl. bevel) */
const SIZE = 1;
const WIDTH = 14.74;
const CAP = 1.09;
/** line centre to line centre — one installation, a breath of air between */
const PITCH = 1.42;
/** inscription plane: set back from the hero's so the perspective is flatter */
const PLANE_Z = -1.5;
const CAMERA_Z = 10;

/* finer member of the hero's chamfer family: a third of its depth, a crisp
   inset bevel under half its size, one segment fewer */
const SPEC = {
  size: SIZE,
  depth: SIZE * 0.1,
  curveSegments: 12,
  bevelThickness: SIZE * 0.016,
  bevelSize: SIZE * 0.01,
  bevelSegments: 3,
};

/* brushed dark silver: the hero recipe, lower exposure (hero: 1.35) */
const ENV_INTENSITY = 0.92;
const sweepUniforms = {
  uSweep: { value: -99 },
  uSweepAmt: { value: 0 },
  uSweepWidth: { value: 1 },
};

function createInscriptionMaterial() {
  const m = createChromeMaterial({ faceted: false });
  m.color.set("#c3c6ca");
  m.roughness = 0.26;
  m.envMapIntensity = ENV_INTENSITY;
  // the caps look up the studio's upper gradient (key falling to silver),
  // not the dark horizon band the hero parts its lines around
  m.envMapRotation.x = 0.12;
  m.transparent = true;
  /* the one travelling light: a soft band that crosses both lines as one
     plane, caught mostly by the chamfers (grazing normals), barely by caps */
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, sweepUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vSweepXY;")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvSweepXY = (modelMatrix * vec4(transformed, 1.0)).xy;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uSweep;\nuniform float uSweepAmt;\nuniform float uSweepWidth;\nvarying vec2 vSweepXY;",
      )
      .replace(
        "#include <opaque_fragment>",
        `{
          float band = exp(-pow((vSweepXY.x + 0.35 * vSweepXY.y - uSweep) / uSweepWidth, 2.0));
          float graze = 1.0 - saturate(dot(normal, normalize(vViewPosition)));
          outgoingLight += vec3(1.0, 0.97, 0.9) * uSweepAmt * band * (0.18 + 1.6 * graze);
        }
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => "statement-inscription";
  return m;
}

const matInscription = createInscriptionMaterial();
/* depth-only twin, as in the hero: a fading letter shows only its front */
const matDepth = new THREE.MeshBasicMaterial({ colorWrite: false });
const RO_DEPTH = 1;
const RO_TYPE = 2;

type Pose = {
  pos: [number, number, number];
  rot: [number, number, number];
  s: number;
  o: number;
  ring: number;
  ringZ: number;
};

/**
 * Where the journey monogram settles while the statement holds the stage, in
 * inscription units (x, y at the text's scale; z from the inscription plane).
 *
 * Set below the inscription as its hallmark, a little behind the plane, with
 * the gold orbit opened out in its own plane to the width of IN SILENCE. — a
 * hairline horizon that passes around the composition, never across a letter
 * face. Measured against the alternatives (rendered glyph / monogram masks at
 * 1440): behind the words through the negative space, and a large sculpture
 * far behind, both overlap glyphs; crossing the plane in the pocket before IN
 * stays clear but reads as a leading glyph.
 */
const POSE: Pose = {
  pos: [0, -2.5, -2.5],
  rot: [0, 0, 0],
  s: 1.25,
  o: 0.85,
  ring: 7.5,
  ringZ: 2.2,
};

/* OrbitRing's own tilt (HeroScene) and how far the statement lets it open */
const ORBIT_TILT_X = 1.47;
const ORBIT_OPEN = 0.03;

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Cursor in [-1, 1] from the window (the canvas takes no pointer events). */
function usePointer() {
  const ref = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      ref.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      ref.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  return ref;
}

function Line({ text }: { text: string }) {
  const geometry = useMemo(() => createChromeTypeGeometry(text, SPEC), [text]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <>
      <mesh geometry={geometry} material={matDepth} renderOrder={RO_DEPTH} />
      <mesh geometry={geometry} material={matInscription} renderOrder={RO_TYPE} />
    </>
  );
}

export function StatementInscription() {
  const root = useRef<THREE.Group>(null);
  const relief = useRef<THREE.Group>(null);
  const { viewport, size, gl, camera, scene } = useThree();
  const pointer = usePointer();

  /* world units per CSS px on the inscription plane, and the fit that sets
     WEALTH MOVES to the editorial measure (height-bound on short screens) */
  const depthK = (CAMERA_Z - PLANE_Z) / CAMERA_Z;
  const pxToWorld = (viewport.height * depthK) / size.height;
  const viewW = viewport.width * depthK;
  const viewH = viewport.height * depthK;
  const share = size.width < size.height ? 0.86 : 0.8;
  const fit = Math.min((viewW * share) / WIDTH, (viewH * 0.34) / (PITCH + CAP));

  /* compile the inscription's program ahead of time (once the hero is up), so
     the first scroll into the statement never stalls on a shader build */
  useEffect(() => {
    const g = root.current;
    if (!g) return;
    // compile() walks hidden objects too; the studio environment is baked by now
    const id = window.setTimeout(() => {
      void gl.compileAsync(g, camera, scene).catch(() => {});
    }, 1500);
    return () => window.clearTimeout(id);
  }, [gl, camera, scene]);

  useFrame(({ clock }, dt) => {
    const g = root.current;
    const r = relief.current;
    const sec = statementStage.section;
    if (!g || !r || !sec) {
      if (g) g.visible = false;
      statementStage.w = 0;
      return;
    }
    const vh = size.height;
    // one layout read per frame: the pinned stage follows from the section
    const s = sec.getBoundingClientRect();
    // section progress, framer-style ["start end", "end start"]
    const t = clamp01((vh - s.top) / (s.height + vh));
    // pinned span of the stage, and progress through it
    const t0 = vh / (s.height + vh);
    const t1 = s.height / (s.height + vh);
    const u = (t - t0) / Math.max(1e-3, t1 - t0);

    // the journey monogram hands over while the text is still below the fold
    // and is released once it has left the top
    statementStage.w = smooth(clamp01((t - 0.03) / 0.12)) * (1 - smooth(clamp01((t - 0.8) / 0.12)));

    // centre of the sticky, one-viewport stage: rides in, holds, rides out
    const centre = s.top + Math.min(Math.max(-s.top, 0), s.height - vh) + vh / 2;
    const onScreen = centre > -vh * 0.6 && centre < vh * 1.6;
    g.visible = onScreen;

    const pose = POSE;
    const cy = -(centre - vh / 2) * pxToWorld;
    // the core sits deeper than the type: scale its ride by its own depth so
    // the pair keeps its on-screen spacing while riding in and out (plain
    // parallax would lift it into IN SILENCE. on the way in)
    const mz = PLANE_Z + pose.pos[2] * fit;
    const my = (cy * (CAMERA_Z - mz)) / (CAMERA_Z - PLANE_Z) + pose.pos[1] * fit;
    statementStage.pos = [pose.pos[0] * fit, my, mz];
    /* the orbit, opened out, is a wide flat ellipse: how open it looks depends
       on how far below the eye it sits. Pitch the core so the ring is always
       seen from the same shallow angle above — a hairline horizon while the
       stage is pinned, never a hoop swinging up into the letters on the way
       in or out. */
    const elevation = Math.atan2(my, CAMERA_Z - mz);
    statementStage.rot = [
      Math.PI / 2 + elevation + ORBIT_OPEN - ORBIT_TILT_X + pose.rot[0],
      pose.rot[1],
      pose.rot[2],
    ];
    statementStage.s = pose.s * fit;
    statementStage.o = pose.o;
    statementStage.ring = pose.ring;
    statementStage.ringZ = pose.ringZ;
    if (!onScreen) return;

    // own reference to the studio environment, so envMapRotation applies to
    // this material only (with none, three uses the scene-wide rotation)
    if (matInscription.envMap !== scene.environment) {
      matInscription.envMap = scene.environment;
      matInscription.needsUpdate = true;
    }

    /* FLAT / QUIET → DEPTH REVEALED: the relief grows out of the plate as the
       stage pins, with a tiny approach in Z */
    const reveal = smooth(clamp01((u + 0.15) / 0.45));
    r.scale.set(1, 1, 0.3 + 0.7 * reveal);
    g.position.set(0, cy, PLANE_Z - 0.4 * fit * (1 - reveal));

    /* LIGHT TRAVELS ACROSS THE LETTERS, then SETTLES INTO SILENCE */
    const sw = clamp01((u - 0.28) / 0.47);
    sweepUniforms.uSweep.value = (smooth(sw) * 1.5 - 0.75) * WIDTH * fit;
    sweepUniforms.uSweepAmt.value = Math.sin(Math.PI * sw) * 0.8;
    sweepUniforms.uSweepWidth.value = 1.6 * fit;
    matInscription.envMapIntensity = ENV_INTENSITY * (1 - 0.1 * smooth(clamp01((u - 0.75) / 0.25)));

    // minimal opacity: in as it rises into view, out as it leaves
    const fadeIn = smooth(clamp01((vh * 1.02 - centre) / (vh * 0.42)));
    const fadeOut = smooth(clamp01((centre + vh * 0.02) / (vh * 0.42)));
    matInscription.opacity = Math.min(fadeIn, fadeOut);

    /* near-still: a slow drift and a micro parallax, a fifth of the hero's */
    const drift = Math.sin(clock.elapsedTime * 0.07) * 0.004;
    g.rotation.y = damp(g.rotation.y, pointer.current.x * 0.012 + drift, 1.2, dt);
    g.rotation.x = damp(g.rotation.x, -pointer.current.y * 0.006, 1.2, dt);
  });

  return (
    <group ref={root} visible={false}>
      <group ref={relief} scale={[1, 1, 0.3]}>
        <group scale={fit}>
          <group position={[0, PITCH / 2, 0]}>
            <Line text={LINE_A} />
          </group>
          <group position={[0, -PITCH / 2, 0]}>
            <Line text={LINE_B} />
          </group>
        </group>
      </group>
    </group>
  );
}
