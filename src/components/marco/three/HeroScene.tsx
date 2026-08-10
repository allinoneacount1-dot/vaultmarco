import { Suspense, useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Center, Environment, Lightformer, Text3D } from "@react-three/drei";
import { SVGLoader } from "three-stdlib";
import { createChromeMaterial, createGoldMaterial, damp } from "./chrome";
import monogramSvgRaw from "@/assets/monogram.svg?raw";
import typeface from "@/assets/unbounded-bold.typeface.json";

/* ————— shared materials (one metal, spec §2.4) ————— */
const chromeMat = createChromeMaterial();
const goldMat = createGoldMaterial();

/* ————— monogram: traced SVG → beveled extrusion ————— */
function MonogramMesh(props: { scale?: number; position?: [number, number, number] }) {
  const geometry = useMemo(() => {
    const svg = new SVGLoader().parse(monogramSvgRaw);
    const shapes = svg.paths.flatMap((p) => SVGLoader.createShapes(p));
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
    geo.scale(s, -s, s); // SVG is y-down → flip
    return geo;
  }, []);
  return <mesh geometry={geometry} material={chromeMat} {...props} />;
}

/* ————— gold orbit ring + dot ————— */
function OrbitRing({ radius = 1.55 }: { radius?: number }) {
  const dot = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.28; // slow, sanctioned perpetual motion
    if (dot.current) {
      dot.current.position.set(Math.cos(t) * radius, 0, Math.sin(t) * radius);
    }
  });
  return (
    <group rotation={[1.47, 0, -0.14]}>
      <mesh material={goldMat}>
        <torusGeometry args={[radius, 0.008, 12, 160]} />
      </mesh>
      <mesh ref={dot} material={goldMat}>
        <sphereGeometry args={[0.028, 16, 16]} />
      </mesh>
    </group>
  );
}

/* ————— 3D display text (real rendered type, owner requirement) ————— */
function ChromeLine({
  children,
  size,
  position,
}: {
  children: string;
  size: number;
  position: [number, number, number];
}) {
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
        material={chromeMat}
      >
        {children}
      </Text3D>
    </Center>
  );
}

/* ————— composition rig: cursor inertia + scroll tilt + idle drift ————— */
function Rig({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const { viewport, size } = useThree();
  const scrollRef = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      scrollRef.current = Math.min(1.4, window.scrollY / window.innerHeight);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useFrame(({ pointer, clock }, dt) => {
    if (!group.current) return;
    const idle = Math.sin(clock.elapsedTime * 0.12) * 0.05;
    const targetY = pointer.x * 0.24 + idle;
    const targetX = -pointer.y * 0.12 + scrollRef.current * -0.3;
    group.current.rotation.y = damp(group.current.rotation.y, targetY, 2.2, dt);
    group.current.rotation.x = damp(group.current.rotation.x, targetX, 2.2, dt);
    group.current.position.y = damp(group.current.position.y, scrollRef.current * 1.6, 2.5, dt);
  });

  // responsive: fit composition ("THE VAULT" ≈ 9.4 units wide) into viewport
  const s = Math.min(1, (viewport.width * 0.94) / 10.8) * (size.width < 900 ? 1.05 : 1);
  return (
    <group ref={group} scale={s}>
      {children}
    </group>
  );
}

/* ————— studio: analytic lightformers only (zero network, spec §6) ————— */
function Studio() {
  // Soft-box studio: large area sources so the chrome carries broad bright bands
  // (like the logo render) with a dark band across the middle for the gunmetal core.
  return (
    <Environment resolution={256} frames={1}>
      {/* classic chrome horizon: bright sky above, hard dark band, gray low bounce.
          Camera-facing faces reflect the wall BEHIND the viewer (z+): */}
      <Lightformer form="rect" intensity={1.9} position={[0, 2.3, 8]} rotation-y={Math.PI} scale={[20, 4.6, 1]} color="#ffffff" />
      <Lightformer form="rect" intensity={0.03} position={[0, -1.7, 8]} rotation-y={Math.PI} scale={[20, 2.2, 1]} color="#0f0f0e" />
      <Lightformer form="rect" intensity={0.85} position={[0, -3.7, 8]} rotation-y={Math.PI} scale={[20, 2.4, 1]} color="#a3a29e" />
      {/* overhead hot key — bevels catch the specular line */}
      <Lightformer form="rect" intensity={3.4} position={[0, 6, 1.5]} rotation-x={-Math.PI / 2} scale={[9, 5, 1]} />
      {/* cool left wall / champagne right wall (ring warmth, spec §2.4) */}
      <Lightformer form="rect" intensity={1.5} position={[-8, 1, 1]} rotation-y={Math.PI / 2} scale={[9, 6, 1]} color="#dfe6ee" />
      <Lightformer form="rect" intensity={1.15} position={[8, 0.5, 1]} rotation-y={-Math.PI / 2} scale={[9, 6, 1]} color="#ceccc1" />
      {/* deep dark floor — gunmetal core */}
      <Lightformer form="rect" intensity={0.08} position={[0, -7, 0]} rotation-x={Math.PI / 2} scale={[18, 18, 1]} color="#0f0f0e" />
    </Environment>
  );
}

export default function HeroScene() {
  const [active, setActive] = useState(true);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), {
      rootMargin: "20% 0px 20% 0px",
    });
    io.observe(el);
    const onVis = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div ref={wrap} className="absolute inset-0" aria-hidden>
      <Canvas
        dpr={[1, 2]}
        frameloop={active ? "always" : "never"}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ fov: 35, position: [0, 0, 10] }}
      >
        <Suspense fallback={null}>
          <Studio />
          <Rig>
            {/* monogram peeks between the two lines, ring orbits it */}
            <group position={[0, 0.22, -1.7]}>
              <MonogramMesh scale={3.0} />
              <OrbitRing radius={1.95} />
            </group>
            <ChromeLine size={0.98} position={[0, 1.18, 0.5]}>
              ENTER
            </ChromeLine>
            <ChromeLine size={0.98} position={[0, -0.95, 0.5]}>
              {"THE  VAULT"}
            </ChromeLine>
          </Rig>
        </Suspense>
      </Canvas>
    </div>
  );
}
