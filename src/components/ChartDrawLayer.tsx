"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";
import {
  DRAW_TOOL_SPECS,
  FIB_LEVELS,
  createDrawing,
  type DrawLineStyle,
  type DrawPoint,
  type DrawToolId,
  type Drawing,
} from "@/lib/chartDrawTools";

// Self-contained SVG overlay that owns the new charting tools end to end:
// point placement, live preview, rendering per tool geometry, selection
// handles and dragging. Chart coordinate conversion is supplied by the host
// (the only thing shared with the chart — its coordinate system).
type Props = {
  width: number;
  height: number;
  activeTool: DrawToolId;
  keepDrawing: boolean;
  drawings: Drawing[];
  selectedId: string | null;
  toX: (time: number) => number | null;
  toY: (price: number) => number | null;
  fromXY: (x: number, y: number) => DrawPoint | null;
  onCommit: (drawing: Drawing) => void;
  onUpdate: (drawing: Drawing) => void;
  onSelect: (id: string | null) => void;
  onToolConsumed: () => void;
  onRequestText: (point: DrawPoint) => void;
};

const dashFor = (style: DrawLineStyle, width: number) =>
  style === "dashed" ? `${width * 3} ${width * 2}` : style === "dotted" ? `${width} ${width * 2}` : undefined;

export default function ChartDrawLayer({
  width,
  height,
  activeTool,
  keepDrawing,
  drawings,
  selectedId,
  toX,
  toY,
  fromXY,
  onCommit,
  onUpdate,
  onSelect,
  onToolConsumed,
  onRequestText,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pending, setPending] = useState<{ tool: DrawToolId; points: DrawPoint[] } | null>(null);
  const [cursor, setCursor] = useState<DrawPoint | null>(null);
  const dragRef = useRef<
    | { kind: "move"; id: string; start: DrawPoint; origin: DrawPoint[] }
    | { kind: "handle"; id: string; index: number }
    | null
  >(null);

  const active = activeTool !== "cursor";
  const localPoint = (event: ReactPointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return fromXY(event.clientX - rect.left, event.clientY - rect.top);
  };

  const finishPending = (tool: DrawToolId, points: DrawPoint[]) => {
    onCommit(createDrawing(tool, points));
    setPending(null);
    if (!keepDrawing) onToolConsumed();
  };

  const handlePointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    const point = localPoint(event);
    if (!point) return;

    if (!active) {
      // Cursor mode: hit-test drawings for selection / drag.
      const hit = hitTest(point);
      if (hit) {
        onSelect(hit.id);
        svgRef.current?.setPointerCapture(event.pointerId);
        if (hit.handleIndex != null) {
          dragRef.current = { kind: "handle", id: hit.id, index: hit.handleIndex };
        } else {
          const drawing = drawings.find((d) => d.id === hit.id)!;
          dragRef.current = { kind: "move", id: hit.id, start: point, origin: drawing.points.map((p) => ({ ...p })) };
        }
      } else {
        onSelect(null);
      }
      return;
    }

    const spec = DRAW_TOOL_SPECS[activeTool];
    if (activeTool === "text") { onRequestText(point); onToolConsumed(); return; }
    if (spec.points === 1) { finishPending(activeTool, [point]); return; }

    if (!pending) {
      setPending({ tool: activeTool, points: [point] });
      svgRef.current?.setPointerCapture(event.pointerId);
    } else {
      finishPending(pending.tool, [...pending.points, point]);
    }
  };

  const handlePointerMove = (event: ReactPointerEvent) => {
    const point = localPoint(event);
    if (!point) return;
    setCursor(point);

    const drag = dragRef.current;
    if (drag) {
      const drawing = drawings.find((d) => d.id === drag.id);
      if (!drawing) return;
      if (drag.kind === "handle") {
        const points = drawing.points.map((p, i) => (i === drag.index ? point : p));
        onUpdate({ ...drawing, points });
      } else {
        const dt = point.time - drag.start.time;
        const dp = point.price - drag.start.price;
        onUpdate({ ...drawing, points: drag.origin.map((p) => ({ time: p.time + dt, price: p.price + dp })) });
      }
    }
  };

  const handlePointerUp = () => { dragRef.current = null; };

  // ---- hit testing (screen space) ----
  const hitTest = (point: DrawPoint): { id: string; handleIndex: number | null } | null => {
    const px = toX(point.time);
    const py = toY(point.price);
    if (px == null || py == null) return null;
    for (let i = drawings.length - 1; i >= 0; i -= 1) {
      const drawing = drawings[i];
      const coords = drawing.points.map((p) => ({ x: toX(p.time), y: toY(p.price) }));
      for (let h = 0; h < coords.length; h += 1) {
        const c = coords[h];
        if (c.x != null && c.y != null && Math.hypot(c.x - px, c.y - py) <= 8) return { id: drawing.id, handleIndex: h };
      }
      if (bodyHit(drawing, px, py)) return { id: drawing.id, handleIndex: null };
    }
    return null;
  };

  const bodyHit = (drawing: Drawing, px: number, py: number): boolean => {
    const [a, b] = drawing.points;
    const ax = a ? toX(a.time) : null;
    const ay = a ? toY(a.price) : null;
    if (ax == null || ay == null) return false;
    switch (drawing.tool) {
      case "horizontalLine":
      case "horizontalRay":
        return Math.abs(py - ay) <= 6 && (drawing.tool === "horizontalLine" || px >= ax);
      case "verticalLine":
        return Math.abs(px - ax) <= 6;
      case "rectangle": {
        if (!b) return false;
        const bx = toX(b.time); const by = toY(b.price);
        if (bx == null || by == null) return false;
        return px >= Math.min(ax, bx) && px <= Math.max(ax, bx) && py >= Math.min(ay, by) && py <= Math.max(ay, by);
      }
      case "fibRetracement": {
        if (!b) return false;
        const bx = toX(b.time); const by = toY(b.price);
        if (bx == null || by == null) return false;
        return px >= Math.min(ax, bx) - 4 && px <= Math.max(ax, bx) + 4 && py >= Math.min(ay, by) && py <= Math.max(ay, by);
      }
      default: {
        if (!b) return false;
        const bx = toX(b.time); const by = toY(b.price);
        if (bx == null || by == null) return false;
        return pointToSegment(px, py, ax, ay, bx, by) <= 6;
      }
    }
  };

  // ---- rendering ----
  const renderDrawing = (drawing: Drawing, preview = false): ReactElement | null => {
    const { style } = drawing;
    const dash = dashFor(style.lineStyle, style.width);
    const stroke = style.color;
    const selected = drawing.id === selectedId;
    const coords = drawing.points.map((p) => ({ x: toX(p.time), y: toY(p.price) }));
    const [a, b] = coords;
    const opacityWrap = preview ? 0.75 : 1;

    const handles = !preview && selected
      ? coords.filter((c) => c.x != null && c.y != null).map((c, i) => (
        <circle key={`h${i}`} cx={c.x!} cy={c.y!} r={4} fill="#fff" stroke={stroke} strokeWidth={1.5} />
      ))
      : null;

    const body = (() => {
      switch (drawing.tool) {
        case "trendLine":
          if (!a || !b || a.x == null || b.x == null) return null;
          return <line x1={a.x} y1={a.y!} x2={b.x} y2={b.y!} stroke={stroke} strokeWidth={style.width} strokeDasharray={dash} />;
        case "ray": {
          if (!a || !b || a.x == null || b.x == null) return null;
          const end = extend(a.x, a.y!, b.x, b.y!, width, height);
          return <line x1={a.x} y1={a.y!} x2={end.x} y2={end.y} stroke={stroke} strokeWidth={style.width} strokeDasharray={dash} />;
        }
        case "extendedLine": {
          if (!a || !b || a.x == null || b.x == null) return null;
          const f = extend(b.x, b.y!, a.x, a.y!, width, height);
          const g = extend(a.x, a.y!, b.x, b.y!, width, height);
          return <line x1={f.x} y1={f.y} x2={g.x} y2={g.y} stroke={stroke} strokeWidth={style.width} strokeDasharray={dash} />;
        }
        case "horizontalLine":
          if (!a || a.y == null) return null;
          return <line x1={0} y1={a.y} x2={width} y2={a.y} stroke={stroke} strokeWidth={style.width} strokeDasharray={dash} />;
        case "horizontalRay":
          if (!a || a.x == null) return null;
          return <line x1={a.x} y1={a.y!} x2={width} y2={a.y!} stroke={stroke} strokeWidth={style.width} strokeDasharray={dash} />;
        case "verticalLine":
          if (!a || a.x == null) return null;
          return <line x1={a.x} y1={0} x2={a.x} y2={height} stroke={stroke} strokeWidth={style.width} strokeDasharray={dash} />;
        case "rectangle": {
          if (!a || !b || a.x == null || b.x == null) return null;
          const x = Math.min(a.x, b.x); const y = Math.min(a.y!, b.y!);
          return <rect x={x} y={y} width={Math.abs(b.x - a.x)} height={Math.abs(b.y! - a.y!)} fill={stroke} fillOpacity={style.fillOpacity} stroke={stroke} strokeWidth={style.width} strokeDasharray={dash} />;
        }
        case "fibRetracement": {
          if (!a || !b || a.x == null || b.x == null) return null;
          const left = Math.min(a.x, b.x); const right = Math.max(a.x, b.x);
          const priceA = drawing.points[0].price; const priceB = drawing.points[1].price;
          return (
            <g>
              {FIB_LEVELS.map((level) => {
                const price = priceB + (priceA - priceB) * level.coeff;
                const ly = toY(price);
                if (ly == null) return null;
                return (
                  <g key={level.coeff}>
                    <line x1={left} y1={ly} x2={right} y2={ly} stroke={level.color} strokeWidth={style.width} strokeDasharray={dash} />
                    {style.showLabels ? (
                      <text x={left + 2} y={ly - 2} fill={level.color} fontSize={10} fontFamily="monospace">
                        {level.coeff.toFixed(3)} ({price.toFixed(2)})
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          );
        }
        case "text":
          if (!a || a.x == null) return null;
          return <text x={a.x} y={a.y!} fill={stroke} fontSize={13} fontFamily="Inter, sans-serif">{drawing.text ?? ""}</text>;
        default:
          return null;
      }
    })();

    if (!body) return null;
    return <g key={drawing.id} opacity={opacityWrap}>{body}{handles}</g>;
  };

  const previewDrawing: Drawing | null = pending && cursor
    ? { id: "__preview__", tool: pending.tool, points: [...pending.points, cursor], style: { ...drawingsStyleFallback } }
    : null;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 z-[24]"
      width={width}
      height={height}
      style={{ pointerEvents: active || selectedId ? "auto" : "none", cursor: active ? "crosshair" : "default" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => setCursor(null)}
    >
      {drawings.map((drawing) => renderDrawing(drawing))}
      {previewDrawing ? renderDrawing(previewDrawing, true) : null}
    </svg>
  );
}

const drawingsStyleFallback = {
  color: "#2962FF",
  width: 2,
  lineStyle: "solid" as DrawLineStyle,
  fillOpacity: 0.12,
  showLabels: true,
};

function extend(x1: number, y1: number, x2: number, y2: number, w: number, h: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return { x: x2, y: y2 };
  // extend toward the (x2,y2) direction until it leaves the viewport
  const tx = dx > 0 ? (w - x1) / dx : dx < 0 ? -x1 / dx : Infinity;
  const ty = dy > 0 ? (h - y1) / dy : dy < 0 ? -y1 / dy : Infinity;
  const t = Math.max(0, Math.min(tx, ty));
  return { x: x1 + dx * t, y: y1 + dy * t };
}

function pointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
