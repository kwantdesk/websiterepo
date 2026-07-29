"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import KwantRobot3D from "@/components/landing/KwantRobot3D";
import { terrainHeight } from "@/lib/simplexNoise";

const IS_DEV = process.env.NODE_ENV !== "production";
const GRID = IS_DEV ? 110 : 150;
const AREA = 34;
const STAR_COUNT = IS_DEV ? 900 : 1_400;
const TARGET_FRAME_SECONDS = 1 / 24;
const MAX_HEIGHT = 3.5;
const MAX_DIST = 18;
const C_WHITE = new THREE.Color("#ffffff");
const C_BRIGHT = new THREE.Color("#cccccc");
const C_MID = new THREE.Color("#888888");
const C_DIM = new THREE.Color("#444444");
const C_FAINT = new THREE.Color("#111111");

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function heightColor(h: number, out: THREE.Color): void {
  if (h > 2.5) out.copy(C_WHITE);
  else if (h > 1.5) out.lerpColors(C_BRIGHT, C_WHITE, (h - 1.5) / 1.0);
  else if (h > 0.8) out.lerpColors(C_MID, C_BRIGHT, (h - 0.8) / 0.7);
  else if (h > 0.2) out.lerpColors(C_DIM, C_MID, (h - 0.2) / 0.6);
  else out.lerpColors(C_FAINT, C_DIM, h / 0.2);
}

function extraCount(h: number): number {
  if (h > 2.5) return IS_DEV ? 2 : 3;
  if (h > 1.5) return IS_DEV ? 1 : 2;
  if (h > 0.5) return 1;
  return 0;
}

function particleSize(h: number): number {
  if (h > 2.5) return 0.01;
  if (h > 1.0) return 0.007;
  return 0.0045;
}

function computeAlpha(x: number, y: number, z: number): number {
  const dist = Math.sqrt((x / 23) ** 2 + (z / 15) ** 2);
  const edgeT = dist / MAX_DIST;
  const edgeFade = 1 - smoothstep(0.72, 1.0, edgeT);
  const normalizedHeight = y / MAX_HEIGHT;
  const heightFade = 0.55 + smoothstep(0.0, 0.3, normalizedHeight) * 0.45;
  return edgeFade * heightFade;
}

type ParticleSeed = { x: number; y: number; z: number; size: number };

type TerrainData = {
  count: number;
  positions: Float32Array;
  colors: Float32Array;
  alpha: Float32Array;
  sizes: Float32Array;
  baseColors: Float32Array;
  baseX: Float32Array;
  baseY: Float32Array;
  baseZ: Float32Array;
  breatheSpeed: Float32Array;
  breatheAmp: Float32Array;
  breatheOffset: Float32Array;
  driftAmp: Float32Array;
  driftSpeed: Float32Array;
  swayOffset: Float32Array;
};

function buildTerrain(): TerrainData {
  const rand = mulberry32(0x414c4550);
  const seeds: ParticleSeed[] = [];

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const x = (col / (GRID - 1) - 0.5) * AREA;
      const z = (row / (GRID - 1) - 0.5) * AREA;
      const y = terrainHeight(x, z);

      const addParticle = (px: number, py: number, pz: number) => {
        seeds.push({ x: px, y: py, z: pz, size: particleSize(py) });
      };

      addParticle(x, y, z);

      const extras = extraCount(y);
      for (let k = 0; k < extras; k++) {
        addParticle(
          x + (rand() - 0.5) * 0.14,
          y + (rand() - 0.5) * 0.12,
          z + (rand() - 0.5) * 0.14,
        );
      }
    }
  }

  const count = seeds.length;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const alpha = new Float32Array(count);
  const sizes = new Float32Array(count);
  const baseColors = new Float32Array(count * 3);
  const baseX = new Float32Array(count);
  const baseY = new Float32Array(count);
  const baseZ = new Float32Array(count);
  const breatheSpeed = new Float32Array(count);
  const breatheAmp = new Float32Array(count);
  const breatheOffset = new Float32Array(count);
  const driftAmp = new Float32Array(count);
  const driftSpeed = new Float32Array(count);
  const swayOffset = new Float32Array(count);
  const tmp = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const seed = seeds[i];
    positions[i * 3] = seed.x;
    positions[i * 3 + 1] = seed.y;
    positions[i * 3 + 2] = seed.z;
    baseX[i] = seed.x;
    baseY[i] = seed.y;
    baseZ[i] = seed.z;
    sizes[i] = seed.size;

    const particleAlpha = computeAlpha(seed.x, seed.y, seed.z);
    alpha[i] = particleAlpha;

    heightColor(seed.y, tmp);
    colors[i * 3] = tmp.r * particleAlpha;
    colors[i * 3 + 1] = tmp.g * particleAlpha;
    colors[i * 3 + 2] = tmp.b * particleAlpha;
    baseColors[i * 3] = colors[i * 3];
    baseColors[i * 3 + 1] = colors[i * 3 + 1];
    baseColors[i * 3 + 2] = colors[i * 3 + 2];

    breatheSpeed[i] = 0.15 + rand() * 0.25;
    breatheAmp[i] = 0.008 + rand() * 0.022;
    breatheOffset[i] = rand() * Math.PI * 2;
    driftAmp[i] = 0.012 + rand() * 0.05;
    driftSpeed[i] = 0.08 + rand() * 0.18;
    swayOffset[i] = rand() * Math.PI * 2;
  }

  return {
    count,
    positions,
    colors,
    alpha,
    sizes,
    baseColors,
    baseX,
    baseY,
    baseZ,
    breatheSpeed,
    breatheAmp,
    breatheOffset,
    driftAmp,
    driftSpeed,
    swayOffset,
  };
}

function buildStars(): Float32Array {
  const rand = mulberry32(0x57415253);
  const positions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const radius = 50;
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = (rand() - 0.5) * 50;
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  return positions;
}

type StarData = {
  positions: Float32Array;
  basePositions: Float32Array;
  colors: Float32Array;
  twinkleSpeed: Float32Array;
  twinkleOffset: Float32Array;
  driftAmp: Float32Array;
};

function buildStarData(): StarData {
  const rand = mulberry32(0x53544152);
  const basePositions = buildStars();
  const positions = new Float32Array(basePositions);
  const colors = new Float32Array(STAR_COUNT * 3);
  const twinkleSpeed = new Float32Array(STAR_COUNT);
  const twinkleOffset = new Float32Array(STAR_COUNT);
  const driftAmp = new Float32Array(STAR_COUNT);

  for (let i = 0; i < STAR_COUNT; i++) {
    const brightness = 0.35 + rand() * 0.6;
    colors[i * 3] = brightness;
    colors[i * 3 + 1] = brightness;
    colors[i * 3 + 2] = brightness;
    twinkleSpeed[i] = 0.08 + rand() * 0.22;
    twinkleOffset[i] = rand() * Math.PI * 2;
    driftAmp[i] = 0.015 + rand() * 0.05;
  }

  return {
    positions,
    basePositions,
    colors,
    twinkleSpeed,
    twinkleOffset,
    driftAmp,
  };
}

const terrainVertexShader = /* glsl */ `
  attribute float size;
  attribute vec3 color;
  varying vec3 vColor;

  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (320.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const terrainFragmentShader = /* glsl */ `
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float soft = 1.0 - smoothstep(0.25, 0.5, d);
    gl_FragColor = vec4(vColor * soft, soft);
  }
`;

function MountainPoints({ data }: { data: TerrainData }) {
  const pointsRef = useRef<THREE.Points>(null);
  const posAttrRef = useRef<THREE.BufferAttribute | null>(null);
  const colorAttrRef = useRef<THREE.BufferAttribute | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const lastFrameRef = useRef(0);

  const geometry = useMemo(() => {
    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    nextGeometry.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
    nextGeometry.setAttribute("size", new THREE.BufferAttribute(data.sizes, 1));
    return nextGeometry;
  }, [data]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: terrainVertexShader,
        fragmentShader: terrainFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        fog: false,
      }),
    [],
  );

  useLayoutEffect(() => {
    const points = pointsRef.current;
    if (!points) return;
    posAttrRef.current = points.geometry.getAttribute("position") as THREE.BufferAttribute;
    colorAttrRef.current = points.geometry.getAttribute("color") as THREE.BufferAttribute;
    points.frustumCulled = false;
    points.geometry.computeBoundingSphere();
  }, []);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (time - lastFrameRef.current < TARGET_FRAME_SECONDS) return;
    lastFrameRef.current = time;

    const positionAttribute = posAttrRef.current;
    const colorAttribute = colorAttrRef.current;
    const group = groupRef.current;
    if (!positionAttribute || !colorAttribute || !group) return;

    const positions = positionAttribute.array as Float32Array;
    const colors = colorAttribute.array as Float32Array;

    for (let i = 0; i < data.count; i++) {
      const index = i * 3;
      const breeze =
        Math.sin(time * data.breatheSpeed[i] + data.breatheOffset[i]) * data.breatheAmp[i];
      const cross =
        Math.cos(
          time * data.driftSpeed[i]
            + data.swayOffset[i]
            + data.baseX[i] * 0.12
            + data.baseZ[i] * 0.06,
        ) * data.driftAmp[i];
      const shimmer =
        0.92
        + Math.max(
          0,
          Math.sin(
            time * 0.42
              + data.swayOffset[i]
              + data.baseX[i] * 0.08
              + data.baseZ[i] * 0.035,
          ),
        ) * 0.16;

      positions[index] = data.baseX[i] + cross * 0.34;
      positions[index + 1] = data.baseY[i] + breeze + cross * 0.72;
      positions[index + 2] = data.baseZ[i] + cross * 0.22;

      colors[index] = Math.min(1, data.baseColors[index] * shimmer);
      colors[index + 1] = Math.min(1, data.baseColors[index + 1] * shimmer);
      colors[index + 2] = Math.min(1, data.baseColors[index + 2] * shimmer);
    }

    positionAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
  });

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  return (
    <group
      ref={groupRef}
      position={[0, -10.1, -1.2]}
      rotation={[-0.34, -0.08, 0]}
      scale={[1.42, 0.48, 1]}
    >
      <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}

function StarField({ data }: { data: StarData }) {
  const pointsRef = useRef<THREE.Points>(null);
  const posAttrRef = useRef<THREE.BufferAttribute | null>(null);
  const colorAttrRef = useRef<THREE.BufferAttribute | null>(null);
  const lastFrameRef = useRef(0);

  const geometry = useMemo(() => {
    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    nextGeometry.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
    return nextGeometry;
  }, [data]);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        vertexColors: true,
        size: 0.004,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    [],
  );

  useLayoutEffect(() => {
    const points = pointsRef.current;
    if (!points) return;
    posAttrRef.current = points.geometry.getAttribute("position") as THREE.BufferAttribute;
    colorAttrRef.current = points.geometry.getAttribute("color") as THREE.BufferAttribute;
    points.frustumCulled = false;
    points.geometry.computeBoundingSphere();
  }, []);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (time - lastFrameRef.current < TARGET_FRAME_SECONDS) return;
    lastFrameRef.current = time;

    const positionAttribute = posAttrRef.current;
    const colorAttribute = colorAttrRef.current;
    if (!positionAttribute || !colorAttribute) return;

    const positions = positionAttribute.array as Float32Array;
    const colors = colorAttribute.array as Float32Array;

    for (let i = 0; i < STAR_COUNT; i++) {
      const index = i * 3;
      const twinkle =
        0.4
        + Math.max(0, Math.sin(time * data.twinkleSpeed[i] + data.twinkleOffset[i])) * 0.55;
      const drift =
        Math.sin(
          time * 0.05 + data.twinkleOffset[i] + data.basePositions[index + 2] * 0.02,
        ) * data.driftAmp[i];

      positions[index] = data.basePositions[index] + drift;
      positions[index + 1] = data.basePositions[index + 1] + drift * 0.2;
      positions[index + 2] = data.basePositions[index + 2];

      colors[index] = twinkle;
      colors[index + 1] = twinkle;
      colors[index + 2] = twinkle;
    }

    positionAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
  });

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />;
}

function Scene({ terrain, stars }: { terrain: TerrainData; stars: StarData }) {
  return (
    <>
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[-5, 7, 10]} intensity={3.5} color="#ffffff" />
      <directionalLight position={[6, 1, 7]} intensity={1.4} color="#d9f9ff" />
      <pointLight position={[-3, -2, 8]} intensity={15} distance={18} decay={2} color="#a8f2ff" />
      <StarField data={stars} />
      <MountainPoints data={terrain} />
      <KwantRobot3D />
    </>
  );
}

export default function ParticleTerrain() {
  const [terrain, setTerrain] = useState<TerrainData | null>(null);
  const stars = useMemo(() => buildStarData(), []);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) setTerrain(buildTerrain());
    };
    const idleId =
      typeof window.requestIdleCallback !== "undefined"
        ? window.requestIdleCallback(run, { timeout: 200 })
        : window.setTimeout(run, 0);

    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback !== "undefined") window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
    };
  }, []);

  return (
    <div className="absolute inset-0 h-full w-full bg-black">
      {terrain ? (
        <Canvas
          dpr={0.8}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
          }}
          camera={{
            position: [0, 2.6, 19],
            fov: 58,
            near: 0.1,
            far: 120,
          }}
          style={{ width: "100%", height: "100%", display: "block" }}
          onCreated={({ gl, camera }) => {
            gl.setPixelRatio(Math.min(window.devicePixelRatio, 1));
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.08;
            camera.position.set(0, 2.6, 19);
            camera.lookAt(0, -8.1, 1.4);
          }}
        >
          <Scene terrain={terrain} stars={stars} />
        </Canvas>
      ) : null}
    </div>
  );
}
