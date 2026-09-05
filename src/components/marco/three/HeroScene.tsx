import { Suspense, useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Center, Environment, Lightformer, Text3D } from "@react-three/drei";
import { SVGLoader } from "three-stdlib";
import { createChromeMaterial, createGoldMaterial, damp } from "./chrome";
import monogramSvgRaw from "@/assets/monogram.svg?raw";
import typeface from "@/assets/unbounded-bold.typeface.json";

/* ═══════════════════════════════════════════════════════════════
   VAULT JOURNEY — one persistent canvas for the whole page.
   The chrome monogram travels a keyframed path driven by global
   scroll progress (bidirectional by nature). Luxurious, quiet:
   low opacity behind content, center-stage only at hero/statement.
   ═══════════════════════════════════════════════════════════════ */

/* — materials: journey-owned clones so opacity can breathe — */
const matMono = createChromeMaterial();
matMono.transparent = true;
const matText = createChromeMaterial();
matText.transparent = true;
const matGold = createGoldMaterial();
matGold.transparent = true;

type Key = { p: number; pos: [number, number, number]; rot: [number, number, number]; s: number; o: number };

const KF: Key[] = [
  { p: 0.0, pos: [0, 0.22, -1.7], rot: [0, 0, 0], s: 3.0, o: 1 },
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

function useScrollProgress() {
  const ref = useRef(0);
  useEffect(() => {
    const calc = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      ref.current = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
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
    geo.scale(s, -s, s);
    return geo;
  }, []);
  return <mesh geometry={geometry} material={matMono} />;
}

function OrbitRing({ radius = 0.62 }: { radius?: number }) {
  const dot = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.28;
    if (dot.current) dot.current.position.set(Math.cos(t) * radius, 0, Math.sin(t) * radius);
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

function ChromeLine({ children, size, position }: { children: string; size: number; position: [number, number, number] }) {
  return (
    <Center position={position}>
      <Text3D
        font={typeface as never}
        size={size}
        height={size * 0.3}
        bevelEnabled
        bevelThickness={size * 0.03}
        bevelSize={size * 0.014}
        bevelSegments={3}
        curveSegments={8}
        material={matText}
      >
        {children}
      </Text3D>
    </Center>
  );
}

/* — the choreography rig — */
function Journey() {
  const mono = useRef<THREE.Group>(null);
  const textA = useRef<THREE.Group>(null);
  const textB = useRef<THREE.Group>(null);
  const { viewport, size } = useThree();
  const progress = useScrollProgress();

  const fit = Math.min(1, (viewport.width * 0.94) / 10.8) * (size.width < 900 ? 1.05 : 1);

  useFrame(({ pointer, clock }, dt) => {
    const p = progress.current;
    const k = sample(p);

    if (mono.current) {
      const g = mono.current;
      const idle = Math.sin(clock.elapsedTime * 0.12) * 0.04;
      g.position.set(k.pos[0] * fit, k.pos[1] * fit, k.pos[2]);
      g.scale.setScalar(k.s * fit);
      g.rotation.x = damp(g.rotation.x, k.rot[0] - pointer.y * 0.1, 3, dt);
      g.rotation.y = damp(g.rotation.y, k.rot[1] + pointer.x * 0.2 + idle, 3, dt);
      g.rotation.z = k.rot[2];
      matMono.opacity = damp(matMono.opacity, k.o, 4, dt);
      matGold.opacity = damp(matGold.opacity, Math.min(1, k.o + 0.15), 4, dt);
    }

    // hero type: gone before the manifesto arrives, parts like vault doors
    const t = Math.min(1, Math.max(0, (p - 0.015) / 0.07));
    const e = smooth(t);
    matText.opacity = 1 - e;
    if (textA.current) {
      textA.current.position.y = (1.18 + e * 2.6) * fit;
      textA.current.position.x = -e * 1.8 * fit;
      textA.current.visible = e < 0.999;
    }
    if (textB.current) {
      textB.current.position.y = (-0.95 - e * 2.6) * fit;
      textB.current.position.x = e * 1.8 * fit;
      textB.current.visible = e < 0.999;
    }
  });

  return (
    <>
      <group ref={mono}>
        <MonogramMesh />
        <OrbitRing />
      </group>
      <group ref={textA} scale={fit}>
        <ChromeLine size={0.98} position={[0, 0, 0.5]}>
          ENTER
        </ChromeLine>
      </group>
      <group ref={textB} scale={fit}>
        <ChromeLine size={0.98} position={[0, 0, 0.5]}>
          {"THE  VAULT"}
        </ChromeLine>
      </group>
    </>
  );
}

function Studio() {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" intensity={1.9} position={[0, 2.3, 8]} rotation-y={Math.PI} scale={[20, 4.6, 1]} color="#ffffff" />
      <Lightformer form="rect" intensity={0.03} position={[0, -1.7, 8]} rotation-y={Math.PI} scale={[20, 2.2, 1]} color="#0f0f0e" />
      <Lightformer form="rect" intensity={0.85} position={[0, -3.7, 8]} rotation-y={Math.PI} scale={[20, 2.4, 1]} color="#a3a29e" />
      <Lightformer form="rect" intensity={3.4} position={[0, 6, 1.5]} rotation-x={-Math.PI / 2} scale={[9, 5, 1]} />
      <Lightformer form="rect" intensity={1.5} position={[-8, 1, 1]} rotation-y={Math.PI / 2} scale={[9, 6, 1]} color="#dfe6ee" />
      <Lightformer form="rect" intensity={1.15} position={[8, 0.5, 1]} rotation-y={-Math.PI / 2} scale={[9, 6, 1]} color="#ceccc1" />
      <Lightformer form="rect" intensity={0.08} position={[0, -7, 0]} rotation-x={Math.PI / 2} scale={[18, 18, 1]} color="#0f0f0e" />
    </Environment>
  );
}

/** The persistent journey canvas — fixed behind all landing content. */
export default function HeroScene() {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const onVis = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[1]" aria-hidden>
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
          <Journey />
        </Suspense>
      </Canvas>
    </div>
  );
}
