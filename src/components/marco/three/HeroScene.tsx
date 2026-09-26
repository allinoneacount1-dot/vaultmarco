import { Suspense, useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { FontLoader, SVGLoader, toCreasedNormals } from "three-stdlib";
import { createChromeMaterial, createGoldMaterial, damp } from "./chrome";
import monogramSvgRaw from "@/assets/monogram.svg?raw";
import typeface from "@/assets/unbounded-bold.typeface.json";

/* ═══════════════════════════════════════════════════════════════
   VAULT JOURNEY — one persistent canvas for the whole page.
   The chrome monogram travels a keyframed path driven by global
   scroll progress (bidirectional by nature). Luxurious, quiet:
   low opacity behind content, center-stage only at hero/statement.

   At the hero the monogram and ENTER / THE VAULT are ONE sculpture:
   one rig (pointer parallax, idle), one metal, one light, a shallow
   shared depth. On scroll the two lines part like vault doors while
   the monogram core recedes into its journey.
   ═══════════════════════════════════════════════════════════════ */

/* — materials: journey-owned clones so opacity can breathe — */
const matMono = createChromeMaterial();
matMono.transparent = true;
/* one material per door so each can fade on its own beat (same recipe) */
const matTextA = createChromeMaterial({ faceted: false });
matTextA.transparent = true;
const matTextB = createChromeMaterial({ faceted: false });
matTextB.transparent = true;
/* depth-only twin of the type: drawn just before it so a fading letter shows
   only its front surface (no x-ray of its own inner walls), yet still after
   the monogram so the monogram stays visible through the fading type */
const matTextDepth = new THREE.MeshBasicMaterial({ colorWrite: false });
const matGold = createGoldMaterial();
matGold.transparent = true;

const RO_TEXT_DEPTH = 1;
const RO_TEXT = 2;

type Key = {
  p: number;
  pos: [number, number, number];
  rot: [number, number, number];
  s: number;
  o: number;
};

/* hero rest pose (p = 0): the monogram sits just behind the type — a relief
   within one volume, not a logo on a far plane — as the keystone in the band
   between the lines, with clear black space above and below it: the T of
   ENTER and the V of THE VAULT each end in air, so no letter ever merges
   with or borrows the monogram's strokes. Tipped back ~1° so its flat caps catch the key light like a
   set crest instead of mirroring the dark horizon between the lines. Every
   later key is untouched. */
const KF: Key[] = [
  { p: 0.0, pos: [0, 0.0, -0.35], rot: [-0.02, 0, 0], s: 1.55, o: 1 },
  { p: 0.05, pos: [0.6, 0.24, -1.9], rot: [0.02, 0.5, 0.02], s: 2.5, o: 0.8 },
  { p: 0.14, pos: [3.5, -0.1, -2.6], rot: [0.1, 1.2, 0.05], s: 1.55, o: 0.26 },
  { p: 0.36, pos: [-3.5, 0.05, -2.6], rot: [-0.05, 2.4, -0.04], s: 1.45, o: 0.24 },
  { p: 0.52, pos: [0, -0.8, -3.2], rot: [0.12, 3.6, 0], s: 4.4, o: 0.52 },
  { p: 0.64, pos: [3.4, 0.05, -2.7], rot: [0.05, 4.7, 0.06], s: 1.5, o: 0.24 },
  { p: 0.78, pos: [-3.2, 0.0, -2.6], rot: [-0.04, 5.7, -0.05], s: 1.35, o: 0.22 },
  { p: 0.93, pos: [0, -0.15, -2.2], rot: [0, 6.28, 0], s: 2.2, o: 0.5 },
  { p: 1.0, pos: [0, -0.35, -2.0], rot: [0, 6.6, 0], s: 2.35, o: 0.55 },
];

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
/** heavy in/out — the doors start slow, glide, and settle */
const heavy = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function sample(p: number): Key {
  if (p <= KF[0].p) return KF[0];
  if (p >= KF[KF.length - 1].p) return KF[KF.length - 1];
  let i = 0;
  while (i < KF.length - 2 && KF[i + 1].p < p) i++;
  const a = KF[i];
  const b = KF[i + 1];
  const t = smooth((p - a.p) / (b.p - a.p));
  const L = (x: number, y: number) => x + (y - x) * t;
  return {
    p,
    pos: [L(a.pos[0], b.pos[0]), L(a.pos[1], b.pos[1]), L(a.pos[2], b.pos[2])],
    rot: [L(a.rot[0], b.rot[0]), L(a.rot[1], b.rot[1]), L(a.rot[2], b.rot[2])],
    s: L(a.s, b.s),
    o: L(a.o, b.o),
  };
}

/** Page progress (drives the monogram journey) + raw scroll (drives the hero exit). */
function useScroll() {
  const ref = useRef({ p: 0, y: 0 });
  useEffect(() => {
    const calc = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      ref.current.y = window.scrollY;
      ref.current.p = max > 0 ? clamp01(window.scrollY / max) : 0;
    };
    calc();
    window.addEventListener("scroll", calc, { passive: true });
    window.addEventListener("resize", calc);
    return () => {
      window.removeEventListener("scroll", calc);
      window.removeEventListener("resize", calc);
    };
  }, []);
  return ref;
}

/**
 * Cursor position in [-1, 1] (y up), read from the window: the canvas is
 * pointer-events: none (see HeroScene), so R3F's own `pointer` never updates.
 * Mouse / pen only — touch drags are scrolls, not a viewer moving around.
 */
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

function MonogramMesh() {
  const geometry = useMemo(() => {
    const svg = new SVGLoader().parse(monogramSvgRaw);
    const shapes = svg.paths.flatMap((p) => SVGLoader.createShapes(p as never));
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: 90,
      bevelEnabled: true,
      bevelThickness: 16,
      bevelSize: 12,
      bevelSegments: 5,
      curveSegments: 8,
    });
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const size = new THREE.Vector3();
    bb.getSize(size);
    const s = 1 / Math.max(size.x, size.y);
    geo.translate(-(bb.min.x + size.x / 2), -(bb.min.y + size.y / 2), -(bb.min.z + size.z / 2));
    // SVG y points down. Flip it with a half-turn about X rather than a negative
    // scale: a mirror reverses triangle winding, which culled the front of the
    // monogram and showed its back faces from inside. The extrusion is
    // symmetric in z, so the half-turn gives the same silhouette, faces intact.
    geo.scale(s, s, s);
    geo.rotateX(Math.PI);
    return geo;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={matMono} />;
}

function OrbitRing({ radius = 0.62 }: { radius?: number }) {
  const dot = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.28;
    // the torus lies in this group's XY plane — the dot must ride that plane.
    // (It used XZ, which the group's tilt turns near-vertical: the dot left the
    // ring and swept down through THE VAULT like a stray full stop.)
    if (dot.current) dot.current.position.set(Math.cos(t) * radius, Math.sin(t) * radius, 0);
  });
  return (
    <group rotation={[1.47, 0, -0.14]}>
      <mesh material={matGold}>
        <torusGeometry args={[radius, 0.004, 12, 160]} />
      </mesh>
      <mesh ref={dot} material={matGold}>
        <sphereGeometry args={[0.012, 16, 16]} />
      </mesh>
    </group>
  );
}

const font = new FontLoader().parse(typeface as never);

/* display type: same cap height on both lines, one inscription */
const TYPE_SIZE = 0.98;
/**
 * One line of extruded chrome type, built once and centred in the geometry
 * itself (no layout-effect centring, so the very first frame is already in
 * place). The bevel is inset by its own size (bevelOffset), so a heavier,
 * rounder chamfer — closer to the monogram's edge language — does not
 * embolden the letters or close their spacing. Crease-angle normals: hard at
 * the cap/bevel/wall breaks, smooth along curves.
 */
function useTypeGeometry(text: string) {
  return useMemo(() => {
    const size = TYPE_SIZE;
    const bevelSize = size * 0.024;
    const raw = new THREE.ExtrudeGeometry(font.generateShapes(text, size), {
      depth: size * 0.3,
      curveSegments: 12,
      bevelEnabled: true,
      bevelThickness: size * 0.04,
      bevelSize,
      bevelOffset: -bevelSize,
      bevelSegments: 4,
    });
    const geo = toCreasedNormals(raw, THREE.MathUtils.degToRad(15));
    raw.dispose();
    geo.computeBoundingBox();
    const c = new THREE.Vector3();
    geo.boundingBox!.getCenter(c);
    geo.translate(-c.x, -c.y, -c.z);
    return geo;
  }, [text]);
}

function ChromeLine({ text, material }: { text: string; material: THREE.Material }) {
  const geometry = useTypeGeometry(text);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <>
      <mesh geometry={geometry} material={matTextDepth} renderOrder={RO_TEXT_DEPTH} />
      <mesh geometry={geometry} material={material} renderOrder={RO_TEXT} />
    </>
  );
}

/* hero composition (units at fit = 1) */
const LINE_Y_A = 1.3; // ENTER centre
const LINE_Y_B = -1.3; // THE VAULT centre
const TYPE_Z = 0.35; // type centre; monogram rests at KF[0].z just behind
const SCULPTURE_W = 9.7; // THE VAULT, the widest element
const SCULPTURE_H = 3.75; // ENTER cap top → THE VAULT baseline

/* safe area around the sculpture, in CSS px (kicker above, CTA bar + ticker below) */
const SAFE_TOP = 128;
const SAFE_BOTTOM = 190;

/* hero exit: complete after this fraction of one viewport height of scroll */
const EXIT_VH = 0.7;
/* page-speed share the monogram core and the lower door ride during the exit */
const CORE_RIDE = 0.5;

/** Scale of the hero sculpture: it fits the stage between the kicker and the
 *  CTA bar — width-bound on most screens, height-bound on short ones — and
 *  may run a little wider on portrait tablets, where height is plentiful. */
function useStageFit() {
  const { viewport, size } = useThree();
  const stageH = Math.max(1, size.height - SAFE_TOP - SAFE_BOTTOM);
  const widthShare = size.width < size.height ? 0.84 : 0.74;
  const fitW = (viewport.width * widthShare) / SCULPTURE_W;
  const fitH = ((stageH / size.height) * viewport.height * 0.96) / SCULPTURE_H;
  return Math.min(1, fitW, fitH);
}

/* fit at which the backdrop gradient below was composed (1440 × 1000) */
const FIT_REF = 0.7;

/* — the choreography rig — */
function Journey({ onFirstFrame }: { onFirstFrame?: () => void }) {
  const rig = useRef<THREE.Group>(null);
  const mono = useRef<THREE.Group>(null);
  const doors = useRef<THREE.Group>(null);
  const textA = useRef<THREE.Group>(null);
  const textB = useRef<THREE.Group>(null);
  const { viewport, size } = useThree();
  const scroll = useScroll();
  const pointer = usePointer();
  const frames = useRef(0);

  const fit = useStageFit();
  // optical centre of the stage (px above the viewport centre → world units)
  const stageLift = ((SAFE_BOTTOM - SAFE_TOP) / 2) * (viewport.height / size.height);
  const pxToWorld = viewport.height / size.height;

  useFrame(({ clock }, dt) => {
    const { p, y } = scroll.current;
    const k = sample(p);
    const first = frames.current === 0;
    // first frame snaps to the pose — nothing eases in from a default transform
    const d = (cur: number, target: number, lambda: number) =>
      first ? target : damp(cur, target, lambda, dt);

    const exit = clamp01(y / (size.height * EXIT_VH));
    const e = heavy(exit);
    // page travel in world units: the hero pieces ride up with the section at
    // their own rates (1 = glued to the page)
    const ride = (rate: number) => y * pxToWorld * rate;
    // the core rides with the lower door until that door has cleared, then
    // eases back onto its journey path (every keyframe is left as authored)
    const coreRide = ride(CORE_RIDE) * (1 - smooth(clamp01((exit - 0.3) / 0.7)));
    const t = clock.elapsedTime;

    /* shared rig: the viewer moves around one installation. Strongest at the
       hero, settling to a quieter residue once the monogram travels alone. */
    if (rig.current) {
      const g = rig.current;
      const w = 1 - 0.6 * e;
      const idle = Math.sin(t * 0.12) * 0.012;
      g.rotation.y = d(g.rotation.y, (pointer.current.x * 0.06 + idle) * w, 1.8);
      // pitch stays small: flat caps mirror a band 2× the tilt, so more than
      // ~1.3° sweeps ENTER into blown-out white or THE VAULT into mud
      g.rotation.x = d(g.rotation.x, -pointer.current.y * 0.022 * w, 1.8);
      g.position.y = stageLift * (1 - e);
    }

    if (mono.current) {
      const g = mono.current;
      g.position.set(k.pos[0] * fit, k.pos[1] * fit + coreRide, k.pos[2]);
      g.scale.setScalar(k.s * fit);
      // a whisper of secondary motion so the core feels set in, not glued on
      g.rotation.x = d(g.rotation.x, k.rot[0] - pointer.current.y * 0.008, 1.8);
      g.rotation.y = d(g.rotation.y, k.rot[1] + pointer.current.x * 0.025, 1.8);
      g.rotation.z = k.rot[2];
      matMono.opacity = d(matMono.opacity, k.o, 4);
      matGold.opacity = d(matGold.opacity, Math.min(1, k.o + 0.15), 4);
    }

    /* vault doors: ENTER and THE VAULT part laterally and swing inward a few
       degrees while the monogram core recedes into its journey. Both doors
       ride up with the hero (anchored, not floating over it). The lower door
       rides at the core's rate and sinks away from it, so the gap between them
       holds and then widens — it reveals the core instead of sliding across
       it — and it has faded before the hero copy and CTAs (which it closes on
       at half speed) could reach it. ENTER rises faster, away from the core, and fades last.
       Opacity trails the motion so the parting reads first. */
    // the lower door runs its whole move inside its own short window, so it
    // visibly parts, swings and sinks while still solid, then fades
    const eB = heavy(clamp01(exit / 0.32));
    const fadeB = 1 - smooth(clamp01((exit - 0.04) / 0.23));
    const fadeA = 1 - smooth(clamp01((exit - 0.25) / 0.55));
    matTextA.opacity = fadeA;
    matTextB.opacity = fadeB;
    if (doors.current) doors.current.visible = fadeA > 0.001;
    if (textA.current) {
      const g = textA.current;
      g.position.set(
        -1.3 * e * fit,
        (LINE_Y_A + 0.25 * e) * fit + ride(0.8),
        (TYPE_Z - 0.3 * e) * fit,
      );
      g.rotation.y = 0.18 * e;
    }
    if (textB.current) {
      const g = textB.current;
      g.position.set(
        1.3 * eB * fit,
        (LINE_Y_B - 0.3 * eB) * fit + ride(CORE_RIDE),
        (TYPE_Z - 0.3 * eB) * fit,
      );
      g.rotation.y = -0.18 * eB;
      g.visible = fadeB > 0.001;
    }

    frames.current++;
    // two frames: the first one compiles programs and may stall; the second is
    // what the reveal fades in on
    if (frames.current === 2) onFirstFrame?.();
  });

  return (
    <group ref={rig}>
      <group ref={mono}>
        <MonogramMesh />
        <OrbitRing />
      </group>
      <group ref={doors}>
        <group ref={textA} scale={fit}>
          <ChromeLine text="ENTER" material={matTextA} />
        </group>
        <group ref={textB} scale={fit}>
          <ChromeLine text="THE VAULT" material={matTextB} />
        </group>
      </group>
    </group>
  );
}

/**
 * Backdrop reflection for the camera-facing faces. Flat metal caps mirror a
 * single elevation band of the environment, so one uniform white strip made
 * ENTER a blown-out white decal and a black gap made THE VAULT near-black —
 * two different-looking metals. One continuous gradient instead: bright key
 * falling to a dark horizon between the lines, then a silver ground bounce
 * with only a breath of champagne rising under THE VAULT (the gold ring stays
 * the one clear warm accent) — every letter carries a chrome gradient.
 * Rows map to height on a 16-unit-tall plane 8 units out (y = 8 − 16·row/H).
 * The lines' reflected band scales with the sculpture, so the inner stops
 * scale with it too (`k` = fit / FIT_REF): same chrome on every screen.
 */
function useBackdropGradient(k: number) {
  const tex = useMemo(() => {
    const H = 256;
    const c = document.createElement("canvas");
    c.width = 2;
    c.height = H;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 0, H);
    // [world y on the plane, rgb]
    const stops: [number, string][] = [
      [8, "rgb(150,150,150)"],
      [2.6, "rgb(255,255,255)"],
      [1.5, "rgb(236,238,240)"],
      [0.85, "rgb(150,152,156)"],
      [0.32, "rgb(52,53,55)"],
      [0.04, "rgb(9,9,9)"],
      [-0.14, "rgb(22,22,22)"],
      [-0.4, "rgb(82,82,82)"],
      [-0.8, "rgb(134,133,131)"],
      [-1.2, "rgb(160,158,154)"],
      [-2.2, "rgb(104,103,101)"],
      [-8, "rgb(40,40,40)"],
    ];
    for (const [y, col] of stops) {
      const ys = Math.abs(y) >= 8 ? y : y * k;
      grad.addColorStop((8 - ys) / 16, col);
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, 2, H);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [k]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

function Studio() {
  const fit = useStageFit();
  // quantised so a resize re-bakes the (one-shot) environment only on a real change
  const k = Math.min(1.3, Math.max(0.45, Math.round((fit / FIT_REF) * 20) / 20));
  const backdrop = useBackdropGradient(k);
  return (
    <Environment key={k} resolution={256} frames={1}>
      <Lightformer
        form="rect"
        intensity={1.9}
        map={backdrop}
        position={[0, 0, 8]}
        rotation-y={Math.PI}
        scale={[20, 16, 1]}
      />
      <Lightformer
        form="rect"
        intensity={3.4}
        position={[0, 6, 1.5]}
        rotation-x={-Math.PI / 2}
        scale={[9, 5, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.5}
        position={[-8, 1, 1]}
        rotation-y={Math.PI / 2}
        scale={[9, 6, 1]}
        color="#dfe6ee"
      />
      <Lightformer
        form="rect"
        intensity={1.15}
        position={[8, 0.5, 1]}
        rotation-y={-Math.PI / 2}
        scale={[9, 6, 1]}
        color="#ceccc1"
      />
      {/*
        Rear panel: the side walls of the type (and monogram) mirror the space
        behind the sculpture. With nothing there they rendered black, and a dark
        wall band plus the back arris read as a doubled outline beside E / THE.
        A dim neutral panel gives the walls a dark-metal midtone: depth, not a
        second edge.
      */}
      <Lightformer
        form="rect"
        intensity={0.55}
        position={[0, 1, -7]}
        scale={[22, 10, 1]}
        color="#b9bbbe"
      />
      <Lightformer
        form="rect"
        intensity={0.08}
        position={[0, -7, 0]}
        rotation-x={Math.PI / 2}
        scale={[18, 18, 1]}
        color="#0f0f0e"
      />
    </Environment>
  );
}

/** The persistent journey canvas — fixed behind all landing content. */
export default function HeroScene() {
  const [active, setActive] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onVis = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[1] transition-opacity duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{ opacity: ready ? 1 : 0 }}
      aria-hidden
    >
      {/*
        The wrapper above opts out of pointer events because this scene is purely
        decorative (note aria-hidden, and no pointer handlers anywhere in it).
        That alone is not enough: react-three-fiber sets pointerEvents to "auto"
        on its own wrapper so its event system can work, which overrides the
        intent declared above. Since that wrapper is pinned across the viewport,
        the canvas then sits over every scroll position and swallows clicks on
        everything in main that does not out-stack it — the Vault Index calls to
        action, the Registry cards, the FAQ accordions and the footer.

        Passing the style explicitly restores the declared intent. Pointer
        handling has no effect on painting, so the scene renders identically.
        (Parallax therefore reads the cursor from the window — see usePointer.)

        The wrapper stays transparent until the scene has drawn real frames, then
        fades in: no empty-canvas frame, no pop, no half-compiled first frame.
      */}
      <Canvas
        style={{ pointerEvents: "none" }}
        dpr={[1, 2]}
        frameloop={active ? "always" : "never"}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ fov: 35, position: [0, 0, 10] }}
      >
        <Suspense fallback={null}>
          <Studio />
          <Journey onFirstFrame={() => setReady(true)} />
        </Suspense>
      </Canvas>
    </div>
  );
}
