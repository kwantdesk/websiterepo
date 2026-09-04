"use client";

import { Suspense, useMemo, useRef } from "react";
import Link from "next/link";
import { Canvas, useFrame, useLoader, type ThreeElements } from "@react-three/fiber";
import { Environment, Float, RoundedBox, Text } from "@react-three/drei";
import { motion } from "framer-motion";
import { ArrowRight, Check, Play } from "lucide-react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

function BrandMark3D() {
  const group = useRef<THREE.Group>(null);
  const svg = useLoader(SVGLoader, "/brand/kwantify-logo-traced.svg");
  const logoGeometry = useMemo(() => {
    const shapes = svg.paths.flatMap((path) => SVGLoader.createShapes(path));
    return shapes.map((shape) =>
      new THREE.ExtrudeGeometry(shape, {
        depth: 160,
        bevelEnabled: true,
        bevelSegments: 8,
        bevelSize: 18,
        bevelThickness: 22,
      }),
    );
  }, [svg]);
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#2962FF",
        emissive: "#102E7A",
        emissiveIntensity: 0.45,
        metalness: 0.72,
        roughness: 0.18,
        clearcoat: 0.9,
        clearcoatRoughness: 0.18,
      }),
    [],
  );

  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.45) * 0.22;
    group.current.rotation.x = -0.12 + Math.sin(clock.elapsedTime * 0.35) * 0.05;
  });

  return (
    <Float speed={1.4} rotationIntensity={0.18} floatIntensity={0.45}>
      <group ref={group as unknown as ThreeElements["group"]["ref"]} position={[0, 0.08, -0.08]} scale={[0.00146, -0.00146, 0.00146]}>
        {logoGeometry.map((geometry, index) => (
          <mesh
            key={index}
            geometry={geometry as unknown as ThreeElements["mesh"]["geometry"]}
            material={material as unknown as ThreeElements["mesh"]["material"]}
            position={[-2250, -2146, -80]}
          />
        ))}
      </group>
    </Float>
  );
}

function Wordmark3D() {
  const group = useRef<THREE.Group>(null);
  const svg = useLoader(SVGLoader, "/brand/kwantify-wordmark-traced.svg");
  const wordmarkGeometry = useMemo(() => {
    const shapes = svg.paths.flatMap((path) => SVGLoader.createShapes(path));
    return shapes.map((shape) =>
      new THREE.ExtrudeGeometry(shape, {
        depth: 105,
        bevelEnabled: true,
        bevelSegments: 6,
        bevelSize: 10,
        bevelThickness: 14,
      }),
    );
  }, [svg]);
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#2962FF",
        emissive: "#1E53E5",
        emissiveIntensity: 0.45,
        metalness: 0.72,
        roughness: 0.13,
        clearcoat: 0.95,
        clearcoatRoughness: 0.14,
      }),
    [],
  );

  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.rotation.y = -0.11 + Math.sin(clock.elapsedTime * 0.7) * 0.026;
    group.current.rotation.x = 0.06 + Math.cos(clock.elapsedTime * 0.6) * 0.018;
  });

  return (
    <group ref={group as unknown as ThreeElements["group"]["ref"]} position={[0.02, -0.02, 0]} scale={[0.00112, -0.00112, 0.00112]}>
      {wordmarkGeometry.map((geometry, index) => (
        <mesh
          key={index}
          geometry={geometry as unknown as ThreeElements["mesh"]["geometry"]}
          material={material as unknown as ThreeElements["mesh"]["material"]}
          position={[-2117, -2133, -52]}
        />
      ))}
    </group>
  );
}

function HeaderWordmarkScene() {
  return (
    <Canvas orthographic camera={{ position: [0, 0, 8], zoom: 50 }} gl={{ antialias: true, alpha: true }} dpr={[1, 1.75]}>
      <ambientLight intensity={1.05} />
      <directionalLight position={[3, 3, 4]} intensity={4.2} color="#eef3ff" />
      <pointLight position={[-2, -1, 3]} intensity={5.1} color="#2962FF" />
      <pointLight position={[2, 0.6, 2.5]} intensity={2.2} color="#afc6ff" />
      <Suspense fallback={null}>
        <Wordmark3D />
      </Suspense>
    </Canvas>
  );
}

function GlassPanel({
  position,
  rotation,
  scale,
  label,
  variant,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  label: string;
  variant: "strategy" | "feeds" | "backtest" | "journal";
}) {
  const group = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const curveGeometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.78, -0.1, 0.08),
      new THREE.Vector3(-0.42, 0.08, 0.08),
      new THREE.Vector3(-0.12, -0.03, 0.08),
      new THREE.Vector3(0.18, 0.24, 0.08),
      new THREE.Vector3(0.68, 0.02, 0.08),
    ]);
    return new THREE.TubeGeometry(curve, 28, 0.018, 8, false);
  }, []);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.position.x = position[0] + Math.sin(t * 0.55 + position[0]) * 0.06;
    group.current.position.y = position[1] + Math.cos(t * 0.48 + position[1]) * 0.055;
    group.current.rotation.x = rotation[0] + Math.sin(t * 0.62 + position[2]) * 0.035;
    group.current.rotation.y = rotation[1] + Math.cos(t * 0.52 + position[0]) * 0.04;
    group.current.rotation.z = rotation[2] + Math.sin(t * 0.44 + position[1]) * 0.025;
    if (glow.current) {
      glow.current.emissiveIntensity = 0.42 + Math.sin(t * 8.5 + position[0]) * 0.08 + Math.sin(t * 19.5) * 0.035;
    }
  });

  const renderDesign = () => {
    if (variant === "strategy") {
      return (
        <>
          {[-0.45, 0, 0.45].map((x, index) => (
            <mesh key={x} position={[x, 0.05 + index * 0.06, 0.08]}>
              <boxGeometry args={[0.34, 0.1, 0.035]} />
              <meshStandardMaterial color={index === 1 ? "#2962FF" : "#D1D4DC"} emissive={index === 1 ? "#2962FF" : "#232A3C"} emissiveIntensity={0.3} transparent opacity={0.82} />
            </mesh>
          ))}
          <mesh position={[0, -0.19, 0.08]}>
            <boxGeometry args={[1.18, 0.045, 0.025]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.35} />
          </mesh>
        </>
      );
    }

    if (variant === "feeds") {
      return (
        <>
          {[-0.56, -0.18, 0.2, 0.58].map((x, index) => (
            <mesh key={x} position={[x, -0.05 + Math.sin(index) * 0.08, 0.08]}>
              <sphereGeometry args={[0.075, 18, 18]} />
              <meshStandardMaterial color="#2962FF" emissive="#2962FF" emissiveIntensity={0.35} />
            </mesh>
          ))}
          <mesh position={[0.02, 0.01, 0.08]} geometry={curveGeometry as unknown as ThreeElements["mesh"]["geometry"]}>
            <meshStandardMaterial color="#D1D4DC" emissive="#2962FF" emissiveIntensity={0.3} />
          </mesh>
        </>
      );
    }

    if (variant === "backtest") {
      return (
        <>
          <mesh position={[0.02, 0.08, 0.08]} geometry={curveGeometry as unknown as ThreeElements["mesh"]["geometry"]}>
            <meshStandardMaterial color="#089981" emissive="#089981" emissiveIntensity={0.55} />
          </mesh>
          {[-0.66, -0.28, 0.1, 0.48].map((x, index) => (
            <mesh key={x} position={[x, -0.21, 0.08]}>
              <boxGeometry args={[0.09, 0.16 + index * 0.055, 0.03]} />
              <meshStandardMaterial color="#D1D4DC" emissive="#232A3C" emissiveIntensity={0.18} transparent opacity={0.75} />
            </mesh>
          ))}
        </>
      );
    }

    return (
      <>
        {[
          [-0.55, 0.12, 0.34],
          [-0.12, -0.02, 0.52],
          [0.32, 0.09, 0.38],
          [0.63, -0.11, 0.24],
        ].map(([x, y, h]) => (
          <mesh key={`${x}-${y}`} position={[x, y, 0.08]}>
            <boxGeometry args={[0.13, h, 0.035]} />
            <meshStandardMaterial color={h > 0.45 ? "#089981" : "#D1D4DC"} emissive="#089981" emissiveIntensity={h > 0.45 ? 0.34 : 0.14} transparent opacity={0.78} />
          </mesh>
        ))}
        <mesh position={[0, -0.31, 0.08]}>
          <boxGeometry args={[1.36, 0.04, 0.025]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.32} />
        </mesh>
      </>
    );
  };

  return (
    <Float speed={1.35} rotationIntensity={0.1} floatIntensity={0.32}>
      <group ref={group as unknown as ThreeElements["group"]["ref"]} position={position} rotation={rotation} scale={scale}>
        <RoundedBox args={[2.35, 1.32, 0.12]} radius={0.1} smoothness={10}>
          <meshPhysicalMaterial color="#D1D4DC" transparent opacity={0.18} roughness={0.06} metalness={0.08} transmission={0.52} thickness={0.55} clearcoat={0.95} clearcoatRoughness={0.12} />
        </RoundedBox>
        <RoundedBox args={[2.08, 1.04, 0.08]} radius={0.07} smoothness={8} position={[0, 0, 0.045]}>
          <meshStandardMaterial color="#171B26" transparent opacity={0.42} roughness={0.2} metalness={0.1} />
        </RoundedBox>
        <mesh position={[0, 0.43, 0.11]}>
          <boxGeometry args={[1.45, 0.035, 0.025]} />
          <meshStandardMaterial ref={glow as unknown as ThreeElements["meshStandardMaterial"]["ref"]} color="#2962FF" emissive="#2962FF" emissiveIntensity={0.5} />
        </mesh>
        {renderDesign()}
        <Text position={[0, -0.47, 0.11]} fontSize={0.105} color="#D1D4DC" anchorX="center" anchorY="middle">
          {label}
        </Text>
      </group>
    </Float>
  );
}

function LandingScene() {
  return (
    <Canvas camera={{ position: [0, 0, 7], fov: 43 }} gl={{ antialias: true, alpha: true }} dpr={[1, 1.75]}>
      <color attach="background" args={["#131722"]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 5, 6]} intensity={2.6} color="#e6ecf8" />
      <pointLight position={[-4, -2, 3]} intensity={4.2} color="#2962FF" />
      <pointLight position={[3, 2, 2]} intensity={1.4} color="#7fa0ff" />
      <Suspense fallback={null}>
        <BrandMark3D />
        <GlassPanel position={[-3.15, 1.4, -1.1]} rotation={[0.05, 0.34, -0.18]} scale={[0.84, 0.84, 0.84]} label="Live Data & Charts" variant="feeds" />
        <GlassPanel position={[3.05, 1.15, -1.2]} rotation={[0.02, -0.38, 0.14]} scale={[0.78, 0.78, 0.78]} label="Automated Trading" variant="backtest" />
        <GlassPanel position={[-2.7, -1.65, -1.25]} rotation={[-0.08, 0.4, 0.2]} scale={[0.72, 0.72, 0.72]} label="Journal & Coach" variant="journal" />
        <GlassPanel position={[2.8, -1.45, -1.1]} rotation={[-0.04, -0.34, -0.18]} scale={[0.74, 0.74, 0.74]} label="AI Strategy Builder" variant="strategy" />
        <Environment preset="city" />
      </Suspense>
    </Canvas>
  );
}

const conceptCards = [
  {
    title: "Live Data Feeds & Charting",
    body: "Broker-aware charts, live market context, alerts, and clean multi-chart workflows.",
    variant: "charting",
  },
  {
    title: "Automated Trading",
    body: "Turn alerts and strategies into controlled execution workflows across connected brokers.",
    variant: "backtests",
  },
  {
    title: "Journaling & Trading Assistant",
    body: "Review trades, track discipline, and trade alongside a coach that understands your plan.",
    variant: "journal",
  },
  {
    title: "AI Strategy Builder",
    body: "Describe an idea, generate code, test versions, and improve the system with feedback.",
    variant: "strategy",
  },
];

function TokenVisual({ variant }: { variant: string }) {
  if (variant === "charting" || variant === "backtests") {
    return (
      <div className="token-visual token-chart">
        <span />
        <span />
        <span />
        <span />
        <svg viewBox="0 0 120 56" aria-hidden>
          <path d="M4 42 C 20 33, 28 48, 43 34 S 66 16, 82 25 S 101 33, 116 11" />
        </svg>
      </div>
    );
  }

  if (variant === "strategy") {
    return (
      <div className="token-visual token-code">
        <span />
        <span />
        <span />
        <i />
      </div>
    );
  }

  return (
    <div className="token-visual token-bars">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#131722] text-[#D1D4DC]">
      <div className="absolute inset-0">
        <LandingScene />
      </div>
      <div className="scene-sweep absolute inset-0" />
      <div className="scene-grid absolute inset-0" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#131722] to-transparent" />

      <header className="relative z-10 flex w-full items-center justify-between px-5 py-7 md:px-8 xl:px-10">
        <Link href="/landing" aria-label="Kwantify home" className="brand-wordmark">
          <HeaderWordmarkScene />
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-[#787B86] md:flex">
          <a href="#platform" className="hover:text-white">Platform</a>
          <a href="#workflow" className="hover:text-white">Workflow</a>
          <a href="#pricing" className="hover:text-white">Pricing</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login?returnTo=/" className="rounded-md border border-[#2A2E39] bg-transparent px-4 py-2 text-sm text-[#D1D4DC] backdrop-blur transition-colors hover:bg-[#2A2E39]">
            Sign In
          </Link>
          <Link href="/login?returnTo=/" className="rounded-md bg-[#2962FF] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1E53E5]">
            Start Free
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-[1520px] items-center px-6 pb-20 md:px-10 xl:px-16">
        <div className="max-w-[740px] pt-10">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="mb-6 inline-flex rounded-full border border-[#2A2E39] bg-[#131722]/70 px-4 py-2 text-xs font-medium uppercase tracking-wide text-[#787B86] backdrop-blur"
          >
            AI trading platform for builders
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.65 }}
            className="text-balance text-5xl font-semibold leading-[0.95] text-white md:text-7xl xl:text-[92px]"
          >
            Kwantify
            <span className="block text-[#D1D4DC]">Strategy OS.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.65 }}
            className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-[#D1D4DC] md:text-xl"
          >
            A custom trading workspace for strategy creation, live broker feeds, chart-driven decisions, backtesting, and disciplined review.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.65 }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <Link href="/login?returnTo=/" className="inline-flex items-center gap-2 rounded-md bg-[#2962FF] px-5 py-3 font-medium text-white transition-colors hover:bg-[#1E53E5]">
              Enter Platform <ArrowRight className="h-4 w-4" />
            </Link>
            <button className="inline-flex items-center gap-2 rounded-md border border-[#2A2E39] bg-transparent px-5 py-3 font-medium text-[#D1D4DC] backdrop-blur transition-colors hover:bg-[#2A2E39]">
              <Play className="h-4 w-4" /> Watch Concept
            </button>
          </motion.div>
          <motion.div
            id="platform"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.65 }}
            className="mt-12 grid max-w-3xl gap-3 md:grid-cols-3"
          >
            {conceptCards.map((item, index) => (
              <motion.div
                key={item.title}
                className="token-card"
                animate={{
                  y: [0, -8, 0],
                  rotateX: [5, 9, 5],
                  rotateY: [-8, -4, -8],
                }}
                transition={{
                  duration: 5.5 + index * 0.45,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: index * 0.18,
                }}
              >
                <div className="token-shine" />
                <Check className="relative z-10 mb-3 h-4 w-4 text-[#2962FF]" />
                <TokenVisual variant={item.variant} />
                <h3 className="relative z-10 mt-4 text-sm font-semibold text-white">{item.title}</h3>
                <p className="relative z-10 mt-2 text-sm leading-6 text-[#787B86]">{item.body}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <style jsx global>{`
        .scene-sweep {
          background:
            linear-gradient(115deg, transparent 0%, rgba(41, 98, 255, 0.06) 38%, transparent 62%),
            radial-gradient(circle at 72% 34%, rgba(41, 98, 255, 0.08), transparent 30%);
          animation: sweep 8s ease-in-out infinite alternate;
        }

        .scene-grid {
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 72px 72px;
          mask-image: radial-gradient(circle at 62% 40%, black 0%, transparent 72%);
          animation: gridPulse 7s ease-in-out infinite;
        }

        .brand-wordmark {
          position: relative;
          display: block;
          width: clamp(292px, 27vw, 430px);
          height: clamp(66px, 6vw, 96px);
          transform: perspective(780px) rotateX(6deg) rotateY(-7deg) translateZ(0);
          transform-style: preserve-3d;
          isolation: isolate;
        }

        .brand-wordmark canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none !important;
          filter: drop-shadow(0 12px 16px rgba(0, 0, 0, 0.35));
        }

        .token-card {
          position: relative;
          min-height: 214px;
          overflow: hidden;
          border: 1px solid #2a2e39;
          border-radius: 8px;
          background: #1e222d;
          padding: 18px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
          transform-style: preserve-3d;
          transition: border-color 0.2s ease, background-color 0.2s ease;
        }

        .token-card:hover {
          border-color: #363a45;
          background: #232838;
        }

        .token-shine {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 68% 12%, rgba(41, 98, 255, 0.08), transparent 40%);
        }

        .token-visual {
          position: relative;
          z-index: 1;
          height: 76px;
          border-radius: 8px;
          border: 1px solid #2a2e39;
          background: #171b26;
          transform: perspective(500px) rotateX(13deg) rotateY(-12deg) translateZ(18px);
        }

        .token-chart span {
          position: absolute;
          bottom: 12px;
          width: 9px;
          border-radius: 2px 2px 1px 1px;
          background: rgba(209, 212, 220, 0.28);
        }

        .token-chart span:nth-child(1) { left: 16px; height: 18px; }
        .token-chart span:nth-child(2) { left: 34px; height: 29px; }
        .token-chart span:nth-child(3) { left: 52px; height: 23px; }
        .token-chart span:nth-child(4) { left: 70px; height: 39px; background: #089981; }

        .token-chart svg {
          position: absolute;
          inset: 10px 10px 8px 10px;
          width: calc(100% - 20px);
          height: calc(100% - 18px);
          overflow: visible;
        }

        .token-chart path {
          fill: none;
          stroke: #089981;
          stroke-width: 2.5;
          stroke-linecap: round;
        }

        .token-code span,
        .token-code i {
          position: absolute;
          left: 16px;
          height: 8px;
          border-radius: 999px;
          background: rgba(209, 212, 220, 0.28);
        }

        .token-code span:nth-child(1) { top: 18px; width: 72%; }
        .token-code span:nth-child(2) { top: 34px; width: 48%; background: #2962ff; }
        .token-code span:nth-child(3) { top: 50px; width: 62%; }
        .token-code i { top: 34px; left: auto; right: 16px; width: 11px; height: 11px; }

        .token-bars {
          display: flex;
          align-items: end;
          justify-content: center;
          gap: 10px;
          padding: 14px;
        }

        .token-bars span {
          width: 15px;
          border-radius: 2px 2px 1px 1px;
          background: rgba(209, 212, 220, 0.28);
        }

        .token-bars span:nth-child(1) { height: 28px; }
        .token-bars span:nth-child(2) { height: 44px; background: #089981; }
        .token-bars span:nth-child(3) { height: 34px; }
        .token-bars span:nth-child(4) { height: 54px; background: rgba(8, 153, 129, 0.72); }

        @keyframes sweep {
          from {
            transform: translateX(-3%);
            opacity: 0.75;
          }
          to {
            transform: translateX(3%);
            opacity: 1;
          }
        }

        @keyframes gridPulse {
          0%,
          100% {
            opacity: 0.22;
          }
          50% {
            opacity: 0.38;
          }
        }

      `}</style>
    </main>
  );
}
