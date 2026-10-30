"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { AlgoMonteCarlo as MonteCarloResult } from "@/lib/algoWorkspace";

/** Demand-rendered: no idle animation loop or per-tick work while trading. */
export default function AlgoMonteCarlo({ result, capital }: { result: MonteCarloResult; capital: number }) {
  const host = useRef<HTMLDivElement>(null);
  const reset = useRef<() => void>(() => {});
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setFallback(true); return; }
    setFallback(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
    camera.position.set(7, 5, 14);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false; controls.enablePan = true;
    controls.minDistance = 5; controls.maxDistance = 90;
    const maxDelta = result.paths.reduce((max, path) => path.reduce((value, v) => Math.max(value, Math.abs(v - capital)), max), 1);
    const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
    const lines: THREE.Line[] = [];
    result.paths.forEach((path, index) => {
      const points = path.map((v, i) => new THREE.Vector3(i / Math.max(1, path.length - 1) * 24 - 12, (v - capital) / maxDelta * 4, index / Math.max(1, result.paths.length - 1) * 6 - 3));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: "#38bdf8", transparent: true, opacity: .35 });
      const line = new THREE.Line(geometry, material);
      geometries.push(geometry); materials.push(material); lines.push(line); scene.add(line);
    });
    const grid = new THREE.GridHelper(24, 12, "#444444", "#222222");
    grid.scale.z = .25;
    grid.position.y = -4.2; scene.add(grid);
    geometries.push(grid.geometry);
    materials.push(...(Array.isArray(grid.material) ? grid.material : [grid.material]));
    const labelNodes: { node: HTMLSpanElement; point: THREE.Vector3 }[] = [];
    const label = (text: string, point: THREE.Vector3) => {
      const node = document.createElement("span"); node.className = "algo-3d-label"; node.textContent = text;
      element.appendChild(node); labelNodes.push({ node, point });
    };
    const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
    label("0", new THREE.Vector3(-12, -4.2, 3.4));
    label(String(Math.max(0, (result.paths[0]?.length ?? 1) - 1)) + " trades", new THREE.Vector3(12, -4.2, 3.4));
    label("+" + money(maxDelta), new THREE.Vector3(-12.5, 4, -3));
    label("$0", new THREE.Vector3(-12.5, 0, -3));
    label("−" + money(maxDelta), new THREE.Vector3(-12.5, -4, -3));
    const render = () => {
      renderer.render(scene, camera);
      labelNodes.forEach(({ node, point }) => {
        const p = point.clone().project(camera);
        node.style.left = (p.x * .5 + .5) * element.clientWidth + "px";
        node.style.top = (-p.y * .5 + .5) * element.clientHeight + "px";
        node.style.visibility = p.z > 1 || Math.abs(p.x) > .97 || Math.abs(p.y) > .97 ? "hidden" : "visible";
      });
    };
    const fitView = () => {
      const direction = new THREE.Vector3(7, 5, 14).normalize();
      const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
      const up = new THREE.Vector3().crossVectors(direction, right).normalize();
      const vertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const horizontal = vertical * camera.aspect;
      let distance = 6;
      // Fit the complete scene, not only its centre. Wide and mobile canvases
      // must both show the terminal tails instead of clipping their outcomes.
      for (const x of [-12.5, 12]) for (const y of [-4.2, 4]) for (const z of [-3, 3.4]) {
        const point = new THREE.Vector3(x, y, z), depth = point.dot(direction);
        distance = Math.max(distance, depth + Math.abs(point.dot(right)) / horizontal, depth + Math.abs(point.dot(up)) / vertical);
      }
      camera.position.copy(direction).multiplyScalar(distance * 1.1);
      controls.target.set(0, 0, 0); controls.update(); render();
    };
    const theme = () => {
      const css = getComputedStyle(element);
      const primary = css.getPropertyValue("--primary").trim() || "#38bdf8";
      const foreground = css.getPropertyValue("--foreground").trim() || "#ffffff";
      lines.forEach((line, i) => {
        const color = new THREE.Color(primary).lerp(new THREE.Color(foreground), i / Math.max(1, lines.length - 1) * .55);
        (line.material as THREE.LineBasicMaterial).color.copy(color);
      });
      const border = css.getPropertyValue("--border").trim() || "#444444";
      for (const material of Array.isArray(grid.material) ? grid.material : [grid.material]) {
        material.color.set(border); material.transparent = true; material.opacity = .65;
      }
      render();
    };
    let firstSize = true;
    const resize = new ResizeObserver(() => {
      const width = element.clientWidth, height = element.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height; camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      if (firstSize) { firstSize = false; fitView(); } else render();
    });
    resize.observe(element);
    controls.addEventListener("change", render);
    window.addEventListener("kwantdesk:theme-change", theme);
    reset.current = fitView;
    theme();
    return () => {
      resize.disconnect(); controls.removeEventListener("change", render); controls.dispose();
      window.removeEventListener("kwantdesk:theme-change", theme);
      geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose());
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); labelNodes.forEach(({ node }) => node.remove()); reset.current = () => {};
    };
  }, [result, capital]);
  return <div className="algo-monte-wrap">
    <div className="algo-monte-top"><div><strong>Monte Carlo · 3D paths</strong><span>Drag to orbit · scroll to zoom · right-drag to pan</span></div>
      <button type="button" onClick={() => reset.current()}>Reset view</button></div>
    <div className="algo-monte-canvas" ref={host} aria-label="Interactive three-dimensional Monte Carlo equity paths">
      {fallback && <svg viewBox="0 0 800 300" role="img" aria-label="Monte Carlo projection">
        {result.paths.filter((_, i) => i % 3 === 0).map((path, p) => {
          const span = result.paths.reduce((max, values) => values.reduce((value, v) => Math.max(value, Math.abs(v - capital)), max), 1);
          return <polyline key={p} fill="none" stroke="var(--primary)" opacity=".35" points={path.map((v, i) => (65 + i / Math.max(1, path.length - 1) * 560 + p * 2) + "," + (160 - (v - capital) / span * 105 - p * 2)).join(" ")} />;
        })}
        <text x="30" y="285" fill="var(--muted)" fontSize="12">Static 3D projection · WebGL unavailable</text>
      </svg>}
    </div>
    <div className="algo-monte-axes"><span>X · Trade sequence</span><span>Y · Equity change</span><span>Z · Simulation</span></div>
  </div>;
}
