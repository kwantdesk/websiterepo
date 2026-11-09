"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Drawing } from "@/lib/chartDrawTools";

/** Selection UI stays in screen pixels, outside the transformed SVG layer. */
export default function ChartDrawingTextEditor({ drawing, width, height, top, bottom, toX, toY, subscribeViewport, onUpdate }: {
  drawing: Drawing;
  width: number;
  height: number;
  top: number;
  bottom: number;
  toX: (time: number) => number | null;
  toY: (price: number) => number | null;
  subscribeViewport: (callback: () => void) => (() => void);
  onUpdate: (drawing: Drawing) => void;
}) {
  const [value, setValue] = useState(drawing.text ?? "");
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const latest = useRef(drawing);
  latest.current = drawing;
  const cancelled = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const positioned = position !== null;
  // Save before the chart's native pointer handler deselects/unmounts us.
  useLayoutEffect(() => {
    const element = root.current;
    const document = element?.ownerDocument;
    if (!element || !document) return;
    const blurOutside = (event: PointerEvent) => {
      if (!element.contains(event.target as Node)) element.querySelector("input")?.blur();
    };
    document.addEventListener("pointerdown", blurOutside, true);
    return () => document.removeEventListener("pointerdown", blurOutside, true);
  }, [positioned]);
  useLayoutEffect(() => { setValue(drawing.text ?? ""); }, [drawing.text]);
  useLayoutEffect(() => {
    const place = () => {
      const points = drawing.points.map(point => ({ x: toX(point.time), y: toY(point.price) }))
        .filter((point): point is { x: number; y: number } => point.x != null && point.y != null && Number.isFinite(point.x) && Number.isFinite(point.y));
      const anchor = points[0];
      if (!anchor) { setPosition(null); return; }
      const left = Math.max(6, Math.min(width - 190, anchor.x));
      const y = Math.min(...points.map(point => point.y));
      const next = { left, top: Math.max(top + 6, Math.min(height - bottom - 40, y - 42)) };
      setPosition(old => old?.left === next.left && old?.top === next.top ? old : next);
    };
    place();
    return subscribeViewport(place);
  }, [drawing.points, width, height, top, bottom, toX, toY, subscribeViewport]);
  const save = () => {
    if (cancelled.current) { cancelled.current = false; return; }
    const text = value.replace(/\s+/g, " ").trim();
    if (text !== (latest.current.text ?? "")) {
      onUpdate({ ...latest.current, text, style: { ...latest.current.style, showLabels: true } });
    }
  };
  if (!position) return null;
  return <div ref={root} data-draw-hit="text-editor" data-drawing-text-editor="" style={{
    position: "absolute", ...position, zIndex: 26, width: Math.max(80, Math.min(184, width - 12)),
    border: "1px solid var(--border)", borderRadius: 10, background: "var(--panel)",
    color: "var(--foreground)", padding: "6px 9px", pointerEvents: "auto",
  }} onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
    <input aria-label="Drawing text" placeholder="Add text…" value={value} maxLength={500}
      onChange={event => setValue(event.target.value)} onBlur={save}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
        if (event.key === "Escape") {
          event.preventDefault(); cancelled.current = true; setValue(latest.current.text ?? ""); event.currentTarget.blur();
        }
      }} style={{ width: "100%", background: "transparent", border: 0, outline: "none", color: "inherit", font: "inherit", fontSize: 12 }} />
  </div>;
}
