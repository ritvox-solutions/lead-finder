"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Sparkles, Float, MeshDistortMaterial } from "@react-three/drei";
import { Suspense, useRef } from "react";
import type * as THREE from "three";
import { paletteFor } from "@/lib/site";
import { content } from "@/lib/content";

type SceneKind = string;

function accentColor(): string {
  return paletteFor(content.category).accent;
}

function CentralShape({ kind }: { kind: SceneKind }) {
  const ref = useRef<THREE.Mesh>(null);
  const color = accentColor();

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.x = t * 0.25;
    ref.current.rotation.y = t * 0.35;
    const s = 1 + Math.sin(t * 1.2) * 0.05;
    ref.current.scale.setScalar(s);
  });

  if (kind === "planet") {
    return (
      <mesh ref={ref}>
        <sphereGeometry args={[1.1, 64, 64]} />
        <MeshDistortMaterial color={color} distort={0.35} speed={1.4} roughness={0.2} metalness={0.1} />
      </mesh>
    );
  }
  if (kind === "rings") {
    return (
      <group position={[0, 0, 0]}>
        {[0, 1].map((i) => (
          <mesh key={i} rotation={[Math.PI / 2.6 * (i + 1), 0, 0]}>
            <torusGeometry args={[1.3 + i * 0.35, 0.05 + i * 0.03, 24, 100]} />
            <meshStandardMaterial color={color} roughness={0.3} metalness={0.4} wireframe={i === 1} />
          </mesh>
        ))}
      </group>
    );
  }
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1.15, 2]} />
      <MeshDistortMaterial
        color={color}
        distort={0.5}
        speed={2}
        roughness={0.15}
        metalness={0.2}
        flatShading
      />
    </mesh>
  );
}

function Orbiters() {
  return (
    <group>
      {[0, 1, 2].map((k) => (
        <Float key={k} speed={2 + k} rotationIntensity={1.2} floatIntensity={0.6}>
          <mesh position={[(k - 1) * 1.9, Math.sin(k * 3), -1.5 + k * 0.4]}>
            <icosahedronGeometry args={[0.18 + k * 0.06, 0]} />
            <meshStandardMaterial color={accentColor()} roughness={0.4} />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

export default function Hero3D({ scene }: { scene: string }) {
  const color = accentColor();
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0"
      style={{ background: `radial-gradient(circle at 70% 30%, ${color}22 0%, transparent 55%)` }}
    >
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 4.2], fov: 45 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[3, 4, 5]} intensity={1.4} color="#ffffff" />
          <pointLight position={[-4, -2, -3]} intensity={0.6} color={color} />
          <CentralShape kind={scene} />
          <Orbiters />
          <Sparkles count={70} scale={6} size={2} speed={0.4} color={color} />
        </Suspense>
      </Canvas>
    </div>
  );
}