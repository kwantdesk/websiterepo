"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";
import {
  DRAW_TOOL_SPECS,
  FIB_CIRCLE_COEFFS,
  FIB_LEVELS,
  FIB_TIME_COEFFS,
  createDrawing,
  type DrawLineStyle,
  type DrawPoint,
  type DrawToolId,
  type Drawing,
} from "@/lib/chartDrawTools";

// Self-contained SVG overlay that owns the new charting tools end to end:
// point placement (fixed-count, poly-click and freehand-drag), live preview,
// per-tool rendering, selection handles and dragging. The chart supplies the
// coordinate system — the only thing shared with the chart.
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
  onDelete: (id: string) => void;
  onSelect: (id: string | null) => void;
  onToolConsumed: () => void;
  onRequestText: (points: DrawPoint[], tool: DrawToolId) => void;
};

type XY = { x: number | null; y: number | null };

const dashFor = (style: DrawLineStyle, width: number) =>
  style === "dashed" ? `${width * 3} ${width * 2}` : style === "dotted" ? `${width} ${width * 2}` : undefined;

const TEXT_INPUT_TOOLS: DrawToolId[] = ["text", "note", "callout", "signpost"];

export default function ChartDrawLayer({
  width, height, activeTool, keepDrawing, drawings, selectedId,
  toX, toY, fromXY, onCommit, onUpdate, onDelete, onSelect, onToolConsumed, onRequestText,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pending, setPending] = useState<{ tool: DrawToolId; points: DrawPoint[] } | null>(null);
  const [cursor, setCursor] = useState<DrawPoint | null>(null);
  const freehandRef = useRef(false);
  const dragRef = useRef<
    | { kind: "move"; id: string; start: DrawPoint; origin: DrawPoint[] }
    | { kind: "handle"; id: string; index: number }
    | null
  >(null);

  const active = activeTool !== "cursor" && activeTool !== "eraser";
  const spec = DRAW_TOOL_SPECS[activeTool];
  const localPoint = (event: ReactPointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return fromXY(event.clientX - rect.left, event.clientY - rect.top);
  };

  const finish = (tool: DrawToolId, points: DrawPoint[]) => {
    onCommit(createDrawing(tool, points));
    setPending(null);
    if (!keepDrawing) onToolConsumed();
  };

  const handlePointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    const point = localPoint(event);
    if (!point) return;

    if (activeTool === "eraser") {
      const hit = hitTest(point);
      if (hit) onDelete(hit.id);
      return;
    }
    if (!active) {
      const hit = hitTest(point);
      if (hit) {
        onSelect(hit.id);
        svgRef.current?.setPointerCapture(event.pointerId);
        if (hit.handleIndex != null) dragRef.current = { kind: "handle", id: hit.id, index: hit.handleIndex };
        else {
          const drawing = drawings.find((d) => d.id === hit.id)!;
          dragRef.current = { kind: "move", id: hit.id, start: point, origin: drawing.points.map((p) => ({ ...p })) };
        }
      } else onSelect(null);
      return;
    }

    if (TEXT_INPUT_TOOLS.includes(activeTool)) {
      const need = typeof spec.points === "number" ? spec.points : 1;
      if (!pending) {
        if (need <= 1) { onRequestText([point], activeTool); onToolConsumed(); return; }
        setPending({ tool: activeTool, points: [point] });
        svgRef.current?.setPointerCapture(event.pointerId);
      } else {
        const next = [...pending.points, point];
        if (next.length >= need) { onRequestText(next, activeTool); setPending(null); onToolConsumed(); }
        else setPending({ tool: activeTool, points: next });
      }
      return;
    }

    if (spec.points === "freehand") {
      freehandRef.current = true;
      setPending({ tool: activeTool, points: [point] });
      svgRef.current?.setPointerCapture(event.pointerId);
      return;
    }
    if (spec.points === "poly") {
      setPending((current) => current && current.tool === activeTool
        ? { ...current, points: [...current.points, point] }
        : { tool: activeTool, points: [point] });
      svgRef.current?.setPointerCapture(event.pointerId);
      return;
    }
    if (spec.points === 1) { finish(activeTool, [point]); return; }

    if (!pending) {
      setPending({ tool: activeTool, points: [point] });
      svgRef.current?.setPointerCapture(event.pointerId);
    } else {
      const next = [...pending.points, point];
      if (next.length >= (spec.points as number)) finish(pending.tool, next);
      else setPending({ tool: pending.tool, points: next });
    }
  };

  const handlePointerMove = (event: ReactPointerEvent) => {
    const point = localPoint(event);
    if (!point) return;
    setCursor(point);

    if (freehandRef.current && pending) {
      setPending({ tool: pending.tool, points: [...pending.points, point] });
      return;
    }
    const drag = dragRef.current;
    if (drag) {
      const drawing = drawings.find((d) => d.id === drag.id);
      if (!drawing) return;
      if (drag.kind === "handle") onUpdate({ ...drawing, points: drawing.points.map((p, i) => (i === drag.index ? point : p)) });
      else {
        const dt = point.time - drag.start.time;
        const dp = point.price - drag.start.price;
        onUpdate({ ...drawing, points: drag.origin.map((p) => ({ time: p.time + dt, price: p.price + dp })) });
      }
    }
  };

  const handlePointerUp = () => {
    if (freehandRef.current && pending) {
      freehandRef.current = false;
      if (pending.points.length >= 2) finish(pending.tool, pending.points);
      else setPending(null);
    }
    dragRef.current = null;
  };

  const handleDoubleClick = () => {
    if (pending && DRAW_TOOL_SPECS[pending.tool].points === "poly" && pending.points.length >= 2) {
      finish(pending.tool, pending.points);
    }
  };

  // ---- hit testing ----
  const hitTest = (point: DrawPoint): { id: string; handleIndex: number | null } | null => {
    const px = toX(point.time); const py = toY(point.price);
    if (px == null || py == null) return null;
    for (let i = drawings.length - 1; i >= 0; i -= 1) {
      const drawing = drawings[i];
      const coords = drawing.points.map((p) => ({ x: toX(p.time), y: toY(p.price) }));
      for (let h = 0; h < coords.length; h += 1) {
        const c = coords[h];
        if (c.x != null && c.y != null && Math.hypot(c.x - px, c.y - py) <= 8) return { id: drawing.id, handleIndex: h };
      }
      if (bodyHit(drawing, coords, px, py)) return { id: drawing.id, handleIndex: null };
    }
    return null;
  };

  const bodyHit = (drawing: Drawing, coords: XY[], px: number, py: number): boolean => {
    const a = coords[0];
    if (a.x == null || a.y == null) return false;
    if (drawing.tool === "horizontalLine" || drawing.tool === "horizontalRay") {
      return Math.abs(py - a.y) <= 6 && (drawing.tool === "horizontalLine" || px >= a.x);
    }
    if (drawing.tool === "verticalLine" || drawing.tool === "crossLine") {
      return Math.abs(px - a.x) <= 6 || (drawing.tool === "crossLine" && Math.abs(py - a.y) <= 6);
    }
    if (["rectangle", "ellipse", "circle", "fibRetracement", "priceRange", "dateRange", "datePriceRange", "brush", "highlighter"].includes(drawing.tool)) {
      const xs = coords.map((c) => c.x).filter((v): v is number => v != null);
      const ys = coords.map((c) => c.y).filter((v): v is number => v != null);
      if (!xs.length) return false;
      return px >= Math.min(...xs) - 4 && px <= Math.max(...xs) + 4 && py >= Math.min(...ys) - 4 && py <= Math.max(...ys) + 4;
    }
    // default: near any segment
    for (let i = 0; i < coords.length - 1; i += 1) {
      const c = coords[i]; const d = coords[i + 1];
      if (c.x != null && c.y != null && d.x != null && d.y != null && pointToSegment(px, py, c.x, c.y, d.x, d.y) <= 6) return true;
    }
    return false;
  };

  // ---- rendering ----
  const renderDrawing = (drawing: Drawing, preview = false): ReactElement | null => {
    const { style } = drawing;
    const dash = dashFor(style.lineStyle, style.width);
    const stroke = style.color;
    const w = style.width;
    const selected = !preview && drawing.id === selectedId;
    const coords = drawing.points.map((p) => ({ x: toX(p.time), y: toY(p.price) }));
    const pr = drawing.points;
    const line = (x1: number, y1: number, x2: number, y2: number, color = stroke, sw = w) =>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={sw} strokeDasharray={dash} />;
    const label = (x: number, y: number, text: string, color = stroke) =>
      <text x={x} y={y} fill={color} fontSize={10} fontFamily="monospace">{text}</text>;

    const a = coords[0]; const b = coords[1]; const c = coords[2];
    const body: ReactElement | null = (() => {
      switch (drawing.tool) {
        case "trendLine":
        case "forecast":
          if (!a?.x == null || !b || a.x == null || b.x == null) return null;
          return line(a.x!, a.y!, b.x, b.y!);
        case "infoLine":
        case "trendAngle": {
          if (!b || a.x == null || b.x == null) return null;
          const dtBars = pr[1].time - pr[0].time;
          const dPrice = pr[1].price - pr[0].price;
          const ang = Math.atan2(-(b.y! - a.y!), b.x - a.x!) * 180 / Math.PI;
          const text = drawing.tool === "trendAngle" ? `${ang.toFixed(1)}°` : `${dPrice >= 0 ? "+" : ""}${dPrice.toFixed(2)} · ${Math.round(dtBars / 60)}m`;
          return <g>{line(a.x!, a.y!, b.x, b.y!)}{style.showLabels ? label((a.x! + b.x) / 2, (a.y! + b.y!) / 2 - 4, text) : null}</g>;
        }
        case "ray": {
          if (!b || a.x == null || b.x == null) return null;
          const e = extend(a.x!, a.y!, b.x, b.y!, width, height);
          return line(a.x!, a.y!, e.x, e.y);
        }
        case "extendedLine": {
          if (!b || a.x == null || b.x == null) return null;
          const f = extend(b.x, b.y!, a.x!, a.y!, width, height);
          const g = extend(a.x!, a.y!, b.x, b.y!, width, height);
          return line(f.x, f.y, g.x, g.y);
        }
        case "horizontalLine": return a.y == null ? null : line(0, a.y, width, a.y);
        case "horizontalRay": return a.x == null ? null : line(a.x, a.y!, width, a.y!);
        case "verticalLine": return a.x == null ? null : line(a.x, 0, a.x, height);
        case "crossLine": return a.x == null ? null : <g>{line(0, a.y!, width, a.y!)}{line(a.x, 0, a.x, height)}</g>;
        case "parallelChannel":
        case "flatChannel": {
          if (!b || !c || a.x == null || b.x == null || c.y == null) return null;
          const off = c.y - (drawing.tool === "flatChannel" ? a.y! : projectY(a, b, c));
          return (
            <g>
              {line(a.x!, a.y!, b.x, b.y!)}
              {line(a.x!, a.y! + off, b.x, b.y! + off)}
              <path d={`M${a.x},${a.y} L${b.x},${b.y} L${b.x},${b.y! + off} L${a.x},${a.y! + off} Z`} fill={stroke} fillOpacity={style.fillOpacity} stroke="none" />
            </g>
          );
        }
        case "rectangle": {
          if (!b || a.x == null || b.x == null) return null;
          return <rect x={Math.min(a.x!, b.x)} y={Math.min(a.y!, b.y!)} width={Math.abs(b.x - a.x!)} height={Math.abs(b.y! - a.y!)} fill={stroke} fillOpacity={style.fillOpacity} stroke={stroke} strokeWidth={w} strokeDasharray={dash} />;
        }
        case "rotatedRectangle": {
          if (!b || !c || a.x == null || b.x == null || c.y == null) return null;
          const off = c.y - projectY(a, b, c);
          return <path d={`M${a.x},${a.y} L${b.x},${b.y} L${b.x},${b.y! + off} L${a.x},${a.y! + off} Z`} fill={stroke} fillOpacity={style.fillOpacity} stroke={stroke} strokeWidth={w} strokeDasharray={dash} />;
        }
        case "ellipse": {
          if (!b || a.x == null || b.x == null) return null;
          return <ellipse cx={(a.x! + b.x) / 2} cy={(a.y! + b.y!) / 2} rx={Math.abs(b.x - a.x!) / 2} ry={Math.abs(b.y! - a.y!) / 2} fill={stroke} fillOpacity={style.fillOpacity} stroke={stroke} strokeWidth={w} strokeDasharray={dash} />;
        }
        case "circle": {
          if (!b || a.x == null || b.x == null) return null;
          const r = Math.hypot(b.x - a.x!, b.y! - a.y!);
          return <circle cx={a.x!} cy={a.y!} r={r} fill={stroke} fillOpacity={style.fillOpacity} stroke={stroke} strokeWidth={w} strokeDasharray={dash} />;
        }
        case "triangleShape": {
          const pts = coords.filter((p) => p.x != null).map((p) => `${p.x},${p.y}`).join(" ");
          return <polygon points={pts} fill={stroke} fillOpacity={style.fillOpacity} stroke={stroke} strokeWidth={w} strokeDasharray={dash} />;
        }
        case "polyline":
        case "path":
        case "brush":
        case "highlighter": {
          const pts = coords.filter((p) => p.x != null).map((p) => `${p.x},${p.y}`).join(" ");
          const swWide = drawing.tool === "highlighter" ? w * 3 : w;
          return <polyline points={pts} fill="none" stroke={stroke} strokeOpacity={drawing.tool === "highlighter" ? 0.5 : 1} strokeWidth={swWide} strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round" />;
        }
        case "xabcd":
        case "abcd":
        case "trianglePattern":
        case "headShoulders":
        case "threeDrivers": {
          const valid = coords.filter((p) => p.x != null);
          const pts = valid.map((p) => `${p.x},${p.y}`).join(" ");
          const labels = drawing.tool === "xabcd" ? ["X", "A", "B", "C", "D"]
            : drawing.tool === "abcd" ? ["A", "B", "C", "D"]
            : drawing.tool === "headShoulders" ? ["LS", "H1", "Head", "H2", "RS"]
            : [];
          return (
            <g>
              <polyline points={pts} fill={stroke} fillOpacity={drawing.tool === "abcd" || drawing.tool === "xabcd" ? style.fillOpacity : 0} stroke={stroke} strokeWidth={w} strokeDasharray={dash} />
              {style.showLabels ? valid.map((p, i) => labels[i] ? label(p.x! + 3, p.y! - 3, labels[i]) : null) : null}
            </g>
          );
        }
        case "fibRetracement": {
          if (!b || a.x == null || b.x == null) return null;
          const left = Math.min(a.x!, b.x); const right = Math.max(a.x!, b.x);
          const p0 = pr[0].price; const p1 = pr[1].price;
          return <g>{FIB_LEVELS.map((lv) => {
            const price = p1 + (p0 - p1) * lv.coeff; const ly = toY(price);
            return ly == null ? null : <g key={lv.coeff}>{line(left, ly, right, ly, lv.color)}{style.showLabels ? label(left + 2, ly - 2, `${lv.coeff} (${price.toFixed(2)})`, lv.color) : null}</g>;
          })}</g>;
        }
        case "fibExtension": {
          if (!b || !c || a.x == null || c.x == null) return null;
          const move = pr[1].price - pr[0].price;
          return <g>{FIB_LEVELS.map((lv) => {
            const price = pr[2].price + move * lv.coeff; const ly = toY(price);
            return ly == null ? null : <g key={lv.coeff}>{line(c.x!, ly, width, ly, lv.color)}{style.showLabels ? label(c.x! + 2, ly - 2, `${lv.coeff} (${price.toFixed(2)})`, lv.color) : null}</g>;
          })}</g>;
        }
        case "fibChannel": {
          if (!b || !c || a.x == null || b.x == null || c.y == null) return null;
          const base = projectY(a, b, c); const off = c.y - base;
          return <g>{FIB_LEVELS.slice(0, 7).map((lv) => (
            <g key={lv.coeff}>{line(a.x!, a.y! + off * lv.coeff, b.x!, b.y! + off * lv.coeff, lv.color)}</g>
          ))}</g>;
        }
        case "fibTimeZone": {
          if (!b || a.x == null || b.x == null) return null;
          const step = pr[1].time - pr[0].time;
          return <g>{FIB_TIME_COEFFS.map((coeff) => {
            const vx = toX(pr[0].time + step * coeff);
            return vx == null ? null : <g key={coeff}>{line(vx, 0, vx, height, "#2962FF")}{style.showLabels ? label(vx + 2, 12, String(coeff)) : null}</g>;
          })}</g>;
        }
        case "fibCircles": {
          if (!b || a.x == null || b.x == null) return null;
          const r = Math.hypot(b.x - a.x!, b.y! - a.y!);
          return <g>{FIB_CIRCLE_COEFFS.map((coeff) => <circle key={coeff} cx={a.x!} cy={a.y!} r={r * coeff} fill="none" stroke={stroke} strokeWidth={w} strokeDasharray={dash} />)}</g>;
        }
        case "fibSpeedFan": {
          if (!b || a.x == null || b.x == null) return null;
          return <g>{[0.236, 0.382, 0.5, 0.618, 0.786, 1].map((coeff) => {
            const ty = a.y! + (b.y! - a.y!) * coeff;
            return line(a.x!, a.y!, b.x!, ty, stroke);
          })}</g>;
        }
        case "longPosition":
        case "shortPosition": {
          if (!b || !c || a.x == null) return null;
          const long = drawing.tool === "longPosition";
          const x1 = a.x!; const x2 = width; const entry = a.y!;
          const stop = b.y!; const target = c.y!;
          const green = "#089981"; const red = "#F23645";
          return (
            <g>
              <rect x={x1} y={Math.min(entry, target)} width={x2 - x1} height={Math.abs(target - entry)} fill={green} fillOpacity={0.12} />
              <rect x={x1} y={Math.min(entry, stop)} width={x2 - x1} height={Math.abs(stop - entry)} fill={red} fillOpacity={0.12} />
              {line(x1, entry, x2, entry, "#787B86")}
              {line(x1, target, x2, target, green)}
              {line(x1, stop, x2, stop, red)}
              {style.showLabels ? <g>{label(x1 + 4, target - 3, `Target ${pr[2].price.toFixed(2)}`, green)}{label(x1 + 4, stop + 11, `Stop ${pr[1].price.toFixed(2)}`, red)}{label(x1 + 4, entry - 3, `${long ? "Long" : "Short"} ${pr[0].price.toFixed(2)}`)}</g> : null}
            </g>
          );
        }
        case "priceRange": {
          if (!b || a.x == null || b.x == null) return null;
          const d = pr[1].price - pr[0].price;
          return <g>{line(a.x!, a.y!, a.x!, b.y!)}{line(a.x! - 6, a.y!, a.x! + 6, a.y!)}{line(a.x! - 6, b.y!, a.x! + 6, b.y!)}{style.showLabels ? label(a.x! + 6, (a.y! + b.y!) / 2, `${d >= 0 ? "+" : ""}${d.toFixed(2)}`) : null}</g>;
        }
        case "dateRange": {
          if (!b || a.x == null || b.x == null) return null;
          const bars = Math.round((pr[1].time - pr[0].time) / 60);
          return <g>{line(a.x!, a.y!, b.x, a.y!)}{line(a.x!, a.y! - 6, a.x!, a.y! + 6)}{line(b.x, a.y! - 6, b.x, a.y! + 6)}{style.showLabels ? label((a.x! + b.x) / 2, a.y! - 4, `${bars}m`) : null}</g>;
        }
        case "datePriceRange": {
          if (!b || a.x == null || b.x == null) return null;
          const d = pr[1].price - pr[0].price; const bars = Math.round((pr[1].time - pr[0].time) / 60);
          return <g><rect x={Math.min(a.x!, b.x)} y={Math.min(a.y!, b.y!)} width={Math.abs(b.x - a.x!)} height={Math.abs(b.y! - a.y!)} fill={stroke} fillOpacity={style.fillOpacity} stroke={stroke} strokeWidth={w} strokeDasharray={dash} />{style.showLabels ? label(Math.min(a.x!, b.x) + 4, Math.min(a.y!, b.y!) - 4, `${d >= 0 ? "+" : ""}${d.toFixed(2)} · ${bars}m`) : null}</g>;
        }
        case "measure": {
          if (!b || a.x == null || b.x == null) return null;
          const d = pr[1].price - pr[0].price; const pct = pr[0].price ? (d / pr[0].price) * 100 : 0; const bars = Math.round((pr[1].time - pr[0].time) / 60);
          const green = d >= 0 ? "#089981" : "#F23645";
          return <g><rect x={Math.min(a.x!, b.x)} y={Math.min(a.y!, b.y!)} width={Math.abs(b.x - a.x!)} height={Math.abs(b.y! - a.y!)} fill={green} fillOpacity={0.12} stroke={green} strokeWidth={1} />{line(a.x!, a.y!, b.x, b.y!, green)}{label(Math.min(a.x!, b.x) + 4, Math.min(a.y!, b.y!) - 4, `${d >= 0 ? "+" : ""}${d.toFixed(2)} (${pct.toFixed(2)}%) · ${bars}m`, green)}</g>;
        }
        case "arrowMarker": {
          if (!b || a.x == null || b.x == null) return null;
          const ang = Math.atan2(b.y! - a.y!, b.x - a.x!);
          const head = 10;
          return <g>{line(a.x!, a.y!, b.x, b.y!)}<path d={`M${b.x},${b.y} L${b.x - head * Math.cos(ang - 0.5)},${b.y! - head * Math.sin(ang - 0.5)} M${b.x},${b.y} L${b.x - head * Math.cos(ang + 0.5)},${b.y! - head * Math.sin(ang + 0.5)}`} stroke={stroke} strokeWidth={w} fill="none" /></g>;
        }
        case "callout": {
          if (!b || a.x == null || b.x == null) return null;
          return <g>{line(a.x!, a.y!, b.x, b.y!)}<rect x={b.x} y={b.y! - 14} width={Math.max(40, (drawing.text?.length ?? 4) * 7)} height={18} rx={3} fill="var(--panel)" stroke={stroke} strokeWidth={1} /><text x={b.x + 4} y={b.y! - 1} fill={stroke} fontSize={12}>{drawing.text ?? ""}</text></g>;
        }
        case "priceLabel": {
          if (a.x == null) return null;
          return <g><rect x={a.x} y={a.y! - 9} width={Math.max(46, (drawing.text?.length ?? 6) * 7)} height={16} rx={2} fill={stroke} /><text x={a.x + 4} y={a.y! + 3} fill="#fff" fontSize={11} fontFamily="monospace">{drawing.text || pr[0].price.toFixed(2)}</text></g>;
        }
        case "signpost": {
          if (!b || a.x == null) return null;
          return <g>{line(a.x!, a.y!, a.x!, b.y!)}<rect x={a.x} y={b.y! - 9} width={Math.max(40, (drawing.text?.length ?? 4) * 7)} height={18} rx={3} fill={stroke} /><text x={a.x + 5} y={b.y! + 3} fill="#fff" fontSize={11}>{drawing.text ?? ""}</text></g>;
        }
        case "flagMark": {
          if (a.x == null) return null;
          return <g>{line(a.x, a.y!, a.x, a.y! - 20)}<path d={`M${a.x},${a.y! - 20} L${a.x + 14},${a.y! - 16} L${a.x},${a.y! - 12} Z`} fill={stroke} /></g>;
        }
        case "note": {
          if (a.x == null) return null;
          return <g><circle cx={a.x} cy={a.y!} r={7} fill={stroke} /><text x={a.x - 2} y={a.y! + 3} fill="#fff" fontSize={9}>N</text>{drawing.text ? label(a.x + 10, a.y! + 3, drawing.text) : null}</g>;
        }
        case "text":
          return a.x == null ? null : <text x={a.x} y={a.y!} fill={stroke} fontSize={13} fontFamily="Inter, sans-serif">{drawing.text ?? ""}</text>;
        default:
          return null;
      }
    })();

    if (!body) return null;
    const handles = selected
      ? coords.filter((p) => p.x != null && p.y != null).map((p, i) => <circle key={`h${i}`} cx={p.x!} cy={p.y!} r={4} fill="#fff" stroke={stroke} strokeWidth={1.5} />)
      : null;
    return <g key={drawing.id} opacity={preview ? 0.75 : 1}>{body}{handles}</g>;
  };

  const previewDrawing: Drawing | null = pending && cursor
    ? { id: "__preview__", tool: pending.tool, points: freehandRef.current ? pending.points : [...pending.points, cursor], style: previewStyle(pending.tool) }
    : null;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 z-[24]"
      width={width}
      height={height}
      style={{ pointerEvents: active || activeTool === "eraser" || selectedId ? "auto" : "none", cursor: active ? "crosshair" : activeTool === "eraser" ? "cell" : "default" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onPointerLeave={() => setCursor(null)}
    >
      {drawings.map((drawing) => renderDrawing(drawing))}
      {previewDrawing ? renderDrawing(previewDrawing, true) : null}
    </svg>
  );
}

function previewStyle(tool: DrawToolId) {
  const base = { color: "#2962FF", width: 2, lineStyle: "solid" as DrawLineStyle, fillOpacity: 0.12, showLabels: true };
  if (tool === "highlighter") return { ...base, color: "#FFEB3B", width: 4, fillOpacity: 0.25 };
  if (tool === "longPosition") return { ...base, color: "#089981" };
  if (tool === "shortPosition") return { ...base, color: "#F23645" };
  return base;
}

function extend(x1: number, y1: number, x2: number, y2: number, w: number, h: number) {
  const dx = x2 - x1; const dy = y2 - y1;
  if (dx === 0 && dy === 0) return { x: x2, y: y2 };
  const tx = dx > 0 ? (w - x1) / dx : dx < 0 ? -x1 / dx : Infinity;
  const ty = dy > 0 ? (h - y1) / dy : dy < 0 ? -y1 / dy : Infinity;
  const t = Math.max(0, Math.min(tx, ty));
  return { x: x1 + dx * t, y: y1 + dy * t };
}

// vertical offset of point c projected onto the a→b line at c's x.
function projectY(a: XY, b: XY, c: XY): number {
  if (a.x == null || b.x == null || c.x == null || b.x === a.x) return a.y ?? 0;
  const slope = (b.y! - a.y!) / (b.x - a.x);
  return a.y! + slope * (c.x - a.x);
}

function pointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax; const dy = by - ay; const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
