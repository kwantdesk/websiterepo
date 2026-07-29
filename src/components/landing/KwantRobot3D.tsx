"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const METAL = {
  color: "#090b0e",
  metalness: 0.96,
  roughness: 0.2,
  clearcoat: 1,
  clearcoatRoughness: 0.12,
} as const;

const DARK_METAL = {
  color: "#020304",
  metalness: 0.92,
  roughness: 0.28,
  clearcoat: 0.75,
  clearcoatRoughness: 0.18,
} as const;

const PANEL_METAL = {
  color: "#171b20",
  metalness: 0.9,
  roughness: 0.17,
  clearcoat: 1,
  clearcoatRoughness: 0.1,
} as const;

function Joint({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number | [number, number, number];
}) {
  return (
    <mesh position={position} scale={scale}>
      <sphereGeometry args={[0.29, 24, 18]} />
      <meshPhysicalMaterial {...DARK_METAL} />
    </mesh>
  );
}

function ArmorSegment({
  position,
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}) {
  return (
    <RoundedBox
      args={[0.68, 1.12, 0.62]}
      radius={0.18}
      smoothness={5}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      <meshPhysicalMaterial {...METAL} />
    </RoundedBox>
  );
}

function GlowRing({
  position,
  rotation = [0, 0, 0],
  radius = 0.34,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  radius?: number;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <torusGeometry args={[radius, 0.055, 12, 48]} />
        <meshStandardMaterial
          color="#d8fbff"
          emissive="#9ceeff"
          emissiveIntensity={5}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <torusGeometry args={[radius * 0.72, 0.018, 8, 40]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#dffbff"
          emissiveIntensity={8}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Helmet() {
  const visorRef = useRef<THREE.MeshPhysicalMaterial>(null);

  useFrame(({ clock }) => {
    if (!visorRef.current) return;
    const pulse = Math.sin(clock.elapsedTime * 1.7) * 0.16;
    visorRef.current.emissiveIntensity = 1.65 + pulse;
  });

  return (
    <group position={[0, 2.15, 0]}>
      <mesh scale={[1.32, 1.05, 1.04]}>
        <sphereGeometry args={[1, 56, 40]} />
        <meshPhysicalMaterial {...METAL} />
      </mesh>

      <RoundedBox
        args={[1.7, 0.82, 0.22]}
        radius={0.25}
        smoothness={8}
        position={[0, -0.08, 0.91]}
        rotation={[-0.08, 0, 0]}
      >
        <meshPhysicalMaterial
          ref={visorRef}
          color="#9befff"
          emissive="#74e9ff"
          emissiveIntensity={1.65}
          metalness={0.18}
          roughness={0.08}
          transmission={0.15}
          thickness={0.15}
          transparent
          opacity={0.9}
          clearcoat={1}
          clearcoatRoughness={0.04}
          toneMapped={false}
        />
      </RoundedBox>

      <RoundedBox
        args={[1.96, 0.14, 0.18]}
        radius={0.06}
        smoothness={4}
        position={[0, 0.45, 0.67]}
        rotation={[-0.22, 0, 0]}
      >
        <meshPhysicalMaterial {...PANEL_METAL} />
      </RoundedBox>
      <RoundedBox
        args={[1.55, 0.19, 0.24]}
        radius={0.08}
        smoothness={4}
        position={[0, 0.78, 0.37]}
        rotation={[-0.42, 0, 0]}
      >
        <meshPhysicalMaterial {...PANEL_METAL} />
      </RoundedBox>

      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.22, 0, 0.03]} rotation={[0, Math.PI / 2, 0]}>
          <mesh>
            <cylinderGeometry args={[0.38, 0.38, 0.19, 32]} />
            <meshPhysicalMaterial {...DARK_METAL} />
          </mesh>
          <GlowRing position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]} radius={0.23} />
        </group>
      ))}

      <mesh position={[0, -0.7, 0.71]} scale={[0.68, 0.22, 0.3]}>
        <sphereGeometry args={[1, 32, 18]} />
        <meshPhysicalMaterial {...DARK_METAL} />
      </mesh>
    </group>
  );
}

function Chest() {
  return (
    <group position={[0, 0.35, 0]}>
      <RoundedBox args={[2.14, 1.62, 0.9]} radius={0.3} smoothness={7}>
        <meshPhysicalMaterial {...METAL} />
      </RoundedBox>
      <RoundedBox
        args={[1.72, 0.52, 0.18]}
        radius={0.12}
        smoothness={5}
        position={[0, 0.48, 0.48]}
      >
        <meshPhysicalMaterial {...PANEL_METAL} />
      </RoundedBox>
      <mesh position={[0, -0.14, 0.54]}>
        <cylinderGeometry args={[0.38, 0.38, 0.16, 36]} />
        <meshPhysicalMaterial {...DARK_METAL} />
      </mesh>
      <GlowRing position={[0, -0.14, 0.64]} radius={0.29} />
      {[-0.67, 0.67].map((x) => (
        <mesh key={x} position={[x, -0.2, 0.5]} rotation={[0, 0, x * 0.24]}>
          <boxGeometry args={[0.34, 0.72, 0.08]} />
          <meshPhysicalMaterial {...PANEL_METAL} />
        </mesh>
      ))}
      <RoundedBox
        args={[1.35, 0.44, 0.62]}
        radius={0.16}
        smoothness={5}
        position={[0, -1.08, -0.03]}
      >
        <meshPhysicalMaterial {...DARK_METAL} />
      </RoundedBox>
      {[-0.49, 0, 0.49].map((x) => (
        <mesh key={x} position={[x, -0.84, 0.31]}>
          <boxGeometry args={[0.28, 0.08, 0.06]} />
          <meshStandardMaterial color="#737a82" metalness={0.9} roughness={0.24} />
        </mesh>
      ))}
    </group>
  );
}

function DownArm() {
  return (
    <group>
      <Joint position={[-1.27, 0.72, 0]} scale={[1.22, 1.22, 1.22]} />
      <ArmorSegment position={[-1.42, -0.02, 0]} rotation={[0, 0, -0.08]} />
      <Joint position={[-1.52, -0.72, 0.02]} scale={0.86} />
      <ArmorSegment
        position={[-1.55, -1.32, 0.16]}
        rotation={[-0.08, 0.02, 0.04]}
        scale={[0.86, 0.92, 0.88]}
      />
      <RoundedBox
        args={[0.54, 0.45, 0.42]}
        radius={0.17}
        smoothness={5}
        position={[-1.53, -2.02, 0.27]}
        rotation={[0.12, 0, -0.04]}
      >
        <meshPhysicalMaterial {...DARK_METAL} />
      </RoundedBox>
      {[-0.19, -0.06, 0.07, 0.2].map((x, index) => (
        <mesh
          key={x}
          position={[-1.53 + x, -2.31 + Math.abs(index - 1.5) * 0.025, 0.31]}
          rotation={[0, 0, (index - 1.5) * -0.05]}
        >
          <capsuleGeometry args={[0.045, 0.29, 4, 10]} />
          <meshPhysicalMaterial {...PANEL_METAL} />
        </mesh>
      ))}
    </group>
  );
}

function RaisedArm() {
  return (
    <group>
      <Joint position={[1.27, 0.72, 0]} scale={[1.22, 1.22, 1.22]} />
      <ArmorSegment
        position={[1.67, 0.22, 0.03]}
        rotation={[0.08, 0, -0.65]}
        scale={[0.94, 0.96, 0.95]}
      />
      <Joint position={[2.12, -0.22, 0.05]} scale={0.9} />
      <ArmorSegment
        position={[2.53, 0.18, 0.18]}
        rotation={[0.12, 0, -0.83]}
        scale={[0.78, 0.96, 0.82]}
      />
      <RoundedBox
        args={[0.62, 0.24, 0.52]}
        radius={0.11}
        smoothness={5}
        position={[2.92, 0.55, 0.3]}
        rotation={[-0.18, 0, 0.06]}
      >
        <meshPhysicalMaterial {...DARK_METAL} />
      </RoundedBox>
      {[-0.23, -0.08, 0.08, 0.23].map((x, index) => (
        <mesh
          key={x}
          position={[2.92 + x, 0.83 + Math.abs(index - 1.5) * 0.08, 0.28]}
          rotation={[0.08, 0, (index - 1.5) * -0.1]}
        >
          <capsuleGeometry args={[0.045, 0.34, 4, 10]} />
          <meshPhysicalMaterial {...PANEL_METAL} />
        </mesh>
      ))}
    </group>
  );
}

function Legs() {
  return (
    <group>
      {[-0.62, 0.62].map((x) => (
        <group key={x}>
          <Joint position={[x, -1.07, 0]} scale={[1.08, 1.08, 1.08]} />
          <ArmorSegment
            position={[x, -1.75, 0.02]}
            scale={[1, 1.02, 1.04]}
            rotation={[0.02, 0, x * -0.03]}
          />
          <Joint position={[x, -2.42, 0.03]} scale={0.87} />
          <ArmorSegment
            position={[x, -3.02, 0.08]}
            scale={[0.95, 0.92, 1.02]}
            rotation={[0.02, 0, x * 0.018]}
          />
          <RoundedBox
            args={[0.92, 0.46, 1.1]}
            radius={0.18}
            smoothness={6}
            position={[x, -3.7, 0.3]}
          >
            <meshPhysicalMaterial {...DARK_METAL} />
          </RoundedBox>
          <mesh position={[x, -3.54, 0.87]}>
            <boxGeometry args={[0.6, 0.1, 0.12]} />
            <meshStandardMaterial color="#505860" metalness={0.95} roughness={0.22} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function buildDissolveData() {
  const random = (() => {
    let seed = 0x4b57414e;
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  })();
  const count = 460;
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);

  for (let index = 0; index < count; index++) {
    const upper = index < count * 0.66;
    const x = upper ? 0.45 + random() * 2.25 : 0.55 + random() * 1.7;
    const y = upper ? 1.35 + random() * 1.9 : -0.55 + random() * 2.0;
    const radius = upper ? 1.05 : 0.82;
    const z = (random() - 0.5) * radius * 1.4 + 0.1;
    positions[index * 3] = x;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = z;
    phases[index] = random() * Math.PI * 2;
  }

  return { count, positions, base: new Float32Array(positions), phases };
}

function DissolveParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const data = useMemo(() => buildDissolveData(), []);
  const geometry = useMemo(() => {
    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    return nextGeometry;
  }, [data]);

  useFrame(({ clock }) => {
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    const values = position.array as Float32Array;
    const time = clock.elapsedTime;
    for (let index = 0; index < data.count; index++) {
      const offset = index * 3;
      const drift = Math.sin(time * 0.55 + data.phases[index]) * 0.04;
      values[offset] = data.base[offset] + drift;
      values[offset + 1] = data.base[offset + 1] + Math.cos(time * 0.42 + data.phases[index]) * 0.035;
      values[offset + 2] = data.base[offset + 2] + drift * 0.55;
    }
    position.needsUpdate = true;
    if (pointsRef.current) pointsRef.current.rotation.y = Math.sin(time * 0.16) * 0.045;
  });

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#dffcff"
        size={0.025}
        sizeAttenuation
        transparent
        opacity={0.7}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

function HologramChart() {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.MeshStandardMaterial>(null);
  const curveGeometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.9, -0.25, 0),
      new THREE.Vector3(-0.62, 0.02, 0),
      new THREE.Vector3(-0.35, -0.12, 0),
      new THREE.Vector3(-0.08, 0.32, 0),
      new THREE.Vector3(0.18, 0.08, 0),
      new THREE.Vector3(0.47, 0.56, 0),
      new THREE.Vector3(0.83, 0.23, 0),
    ]);
    return new THREE.TubeGeometry(curve, 48, 0.018, 8, false);
  }, []);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.position.y = 1.55 + Math.sin(time * 1.15) * 0.045;
      groupRef.current.rotation.y = -0.16 + Math.sin(time * 0.48) * 0.08;
    }
    if (glowRef.current) glowRef.current.emissiveIntensity = 4.5 + Math.sin(time * 2.6) * 0.75;
  });

  useEffect(() => () => curveGeometry.dispose(), [curveGeometry]);

  return (
    <group ref={groupRef} position={[2.95, 1.55, 0.54]} rotation={[0.1, -0.16, -0.06]}>
      <mesh geometry={curveGeometry}>
        <meshStandardMaterial
          ref={glowRef}
          color="#ecfeff"
          emissive="#9ceeff"
          emissiveIntensity={4.5}
          transparent
          opacity={0.92}
          toneMapped={false}
        />
      </mesh>
      {[
        [-0.9, -0.25],
        [-0.62, 0.02],
        [-0.35, -0.12],
        [-0.08, 0.32],
        [0.18, 0.08],
        [0.47, 0.56],
        [0.83, 0.23],
      ].map(([x, y]) => (
        <mesh key={`${x}-${y}`} position={[x, y, 0]}>
          <sphereGeometry args={[0.045, 12, 10]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ))}
      {[-0.72, -0.43, -0.12, 0.2, 0.5, 0.76].map((x, index) => (
        <mesh key={x} position={[x, -0.44 + index * 0.025, -0.04]}>
          <boxGeometry args={[0.06, 0.18 + (index % 3) * 0.13, 0.025]} />
          <meshBasicMaterial color="#b8f7ff" transparent opacity={0.56} toneMapped={false} />
        </mesh>
      ))}
      <pointLight color="#a9f3ff" intensity={3.2} distance={3.5} decay={2} />
    </group>
  );
}

export default function KwantRobot3D() {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const { size } = useThree();
  const responsiveScale = size.width < 520 ? 0.72 : size.width < 860 ? 0.88 : 1;

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const group = groupRef.current;
    if (!group) return;

    group.position.y = -5.05 + Math.sin(time * 0.62) * 0.07;
    group.rotation.y = THREE.MathUtils.lerp(
      group.rotation.y,
      state.pointer.x * 0.09 + Math.sin(time * 0.22) * 0.025,
      0.035,
    );
    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, state.pointer.y * -0.025, 0.035);

    if (headRef.current) {
      headRef.current.rotation.y = THREE.MathUtils.lerp(
        headRef.current.rotation.y,
        state.pointer.x * 0.11,
        0.045,
      );
      headRef.current.rotation.x = THREE.MathUtils.lerp(
        headRef.current.rotation.x,
        state.pointer.y * -0.06,
        0.045,
      );
    }
  });

  return (
    <group
      ref={groupRef}
      position={[0, -5.05, 4.5]}
      scale={responsiveScale}
      rotation={[0, 0, 0]}
    >
      <group ref={headRef}>
        <Helmet />
      </group>
      <Chest />
      <DownArm />
      <RaisedArm />
      <Legs />
      <DissolveParticles />
      <HologramChart />
    </group>
  );
}
