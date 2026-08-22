"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";
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
  candles: DrawCandle[];
  magnet: boolean;
  viewportVersion: number;
  chartReady: number;
  subscribeViewport: (callback: () => void) => (() => void);
  onCommit: (drawing: Drawing) => void;
  onUpdate: (drawing: Drawing) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string | null) => void;
  onToolConsumed: () => void;
  onRequestText: (points: DrawPoint[], tool: DrawToolId) => void;
  onOpenSettings: (id: string) => void;
};

type XY = { x: number | null; y: number | null };
export type DrawCandle = { time: number; open: number; high: number; low: number; close: number; volume: number };

const dashFor = (style: DrawLineStyle, width: number) =>
  style === "dashed" ? `${width * 3} ${width * 2}` : style === "dotted" ? `${width} ${width * 2}` : undefined;

const TEXT_INPUT_TOOLS: DrawToolId[] = ["text", "note", "callout", "signpost"];

export default function ChartDrawLayer({
  width, height, activeTool, keepDrawing, drawings, selectedId,
  toX, toY, fromXY, candles, magnet, viewportVersion, chartReady, subscribeViewport, onCommit, onUpdate, onDelete, onSelect, onToolConsumed, onRequestText, onOpenSettings,
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
  // Magnet. Snaps in PIXEL space to the nearest OHLC value of the bar under
  // the cursor, and only when that value is within reach — the old version
  // snapped unconditionally in price space, so hovering anywhere near a bar
  // yanked the anchor to some far-off close and every pixel of drag re-snapped
  // to a different candidate ("spazzing"). Two further rules make it usable:
  //  - velocity: a fast drag moves freely; snapping engages as the pointer
  //    slows near the wick it is aiming for;
  //  - hysteresis: once locked, the anchor stays locked until the pointer
  //    clearly leaves the target, so it cannot flicker between neighbours.
  const SNAP_RADIUS_PX = 18;
  const SNAP_RELEASE_PX = 30;
  const SNAP_FAST_PX_PER_MS = 0.9;
  const snapStateRef = useRef<{ lastX: number; lastY: number; lastAt: number; lock: DrawPoint | null }>({
    lastX: 0, lastY: 0, lastAt: 0, lock: null,
  });
  const nearestCandleByTime = (time: number) => {
    let low = 0;
    let high = candles.length - 1;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (candles[middle].time < time) low = middle + 1;
      else high = middle;
    }
    const after = candles[low];
    const before = candles[low - 1];
    if (!before) return after;
    return Math.abs(after.time - time) < Math.abs(before.time - time) ? after : before;
  };
  const snapAt = (x: number, y: number, options: { velocityAware: boolean }): DrawPoint | null => {
    const raw = fromXY(x, y);
    if (!raw || !magnet || candles.length === 0) return raw;
    const state = snapStateRef.current;
    const now = performance.now();
    const elapsed = Math.max(1, now - state.lastAt);
    const speed = Math.hypot(x - state.lastX, y - state.lastY) / elapsed;
    state.lastX = x; state.lastY = y; state.lastAt = now;

    // Hysteresis: a held lock survives until the pointer clearly leaves it.
    if (state.lock) {
      const lx = toX(state.lock.time); const ly = toY(state.lock.price);
      if (lx != null && ly != null && Math.hypot(lx - x, ly - y) <= SNAP_RELEASE_PX) return state.lock;
      state.lock = null;
    }
    if (options.velocityAware && speed > SNAP_FAST_PX_PER_MS) return raw;

    const candle = nearestCandleByTime(raw.time);
    const cx = toX(candle.time);
    if (cx == null || Math.abs(cx - x) > SNAP_RADIUS_PX) return raw;
    let best: DrawPoint | null = null;
    let bestDist = SNAP_RADIUS_PX;
    for (const value of [candle.high, candle.low, candle.open, candle.close]) {
      const vy = toY(value);
      if (vy == null) continue;
      const distance = Math.abs(vy - y);
      if (distance <= bestDist) { bestDist = distance; best = { time: candle.time, price: value }; }
    }
    if (!best) return raw;
    state.lock = best;
    return best;
  };
  const localPoint = (event: ReactPointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    // Placement clicks must lock decisively; only pointer MOVES are velocity
    // aware, so "click the high, click the low" always lands on the wick.
    return snapAt(event.clientX - rect.left, event.clientY - rect.top, { velocityAware: event.type === "pointermove" });
  };

  const finish = (tool: DrawToolId, points: DrawPoint[]) => {
    let committed = points;
    // TradingView-style position tools: one click places the whole tool.
    // Synthesize the stop (below/above) and target (above/below) points plus a
    // bounded right edge from pixel offsets so the default shape reads the
    // same at any zoom; the user then drags the handles to fit the trade.
    if ((tool === "longPosition" || tool === "shortPosition") && points.length === 1) {
      const p = points[0];
      const px = toX(p.time); const py = toY(p.price);
      if (px != null && py != null) {
        const dir = tool === "longPosition" ? 1 : -1;
        // A clean 1:1, sized from what the instrument actually moves.
        //
        // Fixed pixel offsets meant the default box was a different NUMBER of
        // points at every zoom, and the same offsets produced a sensible risk
        // on one instrument and an absurd one on another. Sizing from recent
        // bar range gives roughly fifty points on NQ and ten on ES without
        // hard-coding either, because that is the ratio of how they move.
        const recent = candles.slice(-14);
        const averageRange = recent.length
          ? recent.reduce((total, candle) => total + Math.max(0, candle.high - candle.low), 0) / recent.length
          : 0;
        const risk = averageRange > 0 ? averageRange * 2 : Math.abs(p.price) * 0.0015;
        const stopPrice = p.price - dir * risk;
        const targetPrice = p.price + dir * risk;
        const rightPt = fromXY(Math.min(px + 180, width - 8), py);
        if (rightPt && Number.isFinite(stopPrice) && Number.isFinite(targetPrice)) {
          committed = [
            p,
            { time: rightPt.time, price: stopPrice },
            { time: rightPt.time, price: targetPrice },
          ];
        }
      }
    }
    onCommit(createDrawing(tool, committed));
    setPending(null);
    if (!keepDrawing) onToolConsumed();
  };

  // Dragging is driven by window-level listeners so the pointer never
  // "escapes" the drawing and the chart cannot repaint mid-drag — the source
  // of the previous glitchy, wobbling movement.
  const windowPoint = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return snapAt(clientX - rect.left, clientY - rect.top, { velocityAware: true });
  };
  const dragCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => { dragCleanupRef.current?.(); }, []);
  // Redraw the overlay in lockstep with the chart's OWN viewport changes,
  // coalesced to one repaint per animation frame. Relying on the chart's
  // throttled ~15fps React signal made drawings lag and wobble behind the
  // candles during a fast pan; this tracks the candles at frame rate.
  const [, forceRedraw] = useState(0);
  // The projection this render's coordinates were computed against.
  //
  // SVG cannot be repainted inside the chart's paint pass — it is the
  // browser's to draw, and a React render lands a frame or more later. That
  // gap is the wobble when the chart is grabbed and thrown. A PAN, though, is
  // a pure translation of an unchanged projection, so the layer can simply be
  // translated to match the chart in the same frame and left exact until React
  // catches up with fresh coordinates. Anything that is not a pure translation
  // (a zoom, a price rescale) falls back to a re-render, because stretching
  // the layer would distort strokes and text instead of moving them.
  const projectionBasisRef = useRef<{
    timeA: number; timeB: number; priceA: number; priceB: number;
    xA: number; xB: number; yA: number; yB: number;
  } | null>(null);
  const drawingsGroupRef = useRef<SVGGElement | null>(null);

  const readProjection = useCallback(() => {
    const timeA = candles[0]?.time;
    const timeB = candles[candles.length - 1]?.time;
    const priceA = candles[0]?.close;
    if (timeA == null || timeB == null || priceA == null || timeA === timeB) return null;
    const priceB = priceA * 1.01;
    const xA = toX(timeA);
    const xB = toX(timeB);
    const yA = toY(priceA);
    const yB = toY(priceB);
    if (xA == null || xB == null || yA == null || yB == null || xA === xB || yA === yB) return null;
    return { timeA, timeB, priceA, priceB, xA, xB, yA, yB };
  }, [candles, toX, toY]);

  useEffect(() => {
    // Fresh coordinates: drop any compensating transform from the last pan.
    projectionBasisRef.current = readProjection();
    drawingsGroupRef.current?.removeAttribute("transform");
  });

  useEffect(() => {
    const onViewport = () => {
      const basis = projectionBasisRef.current;
      const group = drawingsGroupRef.current;
      if (!basis || !group) return;
      const xA = toX(basis.timeA);
      const xB = toX(basis.timeB);
      const yA = toY(basis.priceA);
      const yB = toY(basis.priceB);
      if (xA == null || xB == null || yA == null || yB == null) return;
      const scaleX = (xB - xA) / (basis.xB - basis.xA);
      const scaleY = (yB - yA) / (basis.yB - basis.yA);
      const translated = Math.abs(scaleX - 1) < 0.0005 && Math.abs(scaleY - 1) < 0.0005;
      if (!translated) {
        // A real scale change. Let React redraw at the new projection.
        group.removeAttribute("transform");
        forceRedraw((value) => value + 1);
        return;
      }
      const dx = xA - basis.xA;
      const dy = yA - basis.yA;
      if (dx === 0 && dy === 0) {
        group.removeAttribute("transform");
        return;
      }
      group.setAttribute("transform", `translate(${dx} ${dy})`);
    };
    const unsubscribe = subscribeViewport(onViewport);
    return () => { unsubscribe(); };
  }, [subscribeViewport, chartReady, toX, toY]);
  // Volume-profile histograms and anchored-VWAP series live in price/time space
  // — they do NOT change when the user pans or zooms, only the pixel projection
  // does. Computing them inside renderDrawing meant a full candle scan per
  // profile on every rAF pan frame (the "hella laggy" volume profiles). Memoize
  // the price-space result on the data; the per-frame render only re-projects.
  const volumeProfileCache = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof volumeProfile>>();
    for (const drawing of drawings) {
      if (drawing.tool !== "fixedRangeVolumeProfile" && drawing.tool !== "anchoredVolumeProfile") continue;
      const pr = drawing.points;
      const anchored = drawing.tool === "anchoredVolumeProfile";
      if (pr.length < (anchored ? 1 : 2)) continue;
      const t0 = anchored ? pr[0].time : Math.min(pr[0].time, pr[1].time);
      const t1 = anchored ? (candles[candles.length - 1]?.time ?? pr[0].time) : Math.max(pr[0].time, pr[1].time);
      cache.set(drawing.id, volumeProfile(
        candles,
        t0,
        t1,
        drawing.style.profileRows ?? 80,
        drawing.style.valueAreaPercent ?? 68,
      ));
    }
    return cache;
  }, [drawings, candles]);
  // Between the first and second placement click the preview histogram used to
  // recompute on EVERY mousemove — a full candle scan per pixel of cursor
  // travel, which is what made drawing the fixed range feel glitchy. The
  // preview now recomputes only when the cursor crosses into a new bar.
  const previewProfileRef = useRef<{ key: string; prof: ReturnType<typeof volumeProfile> } | null>(null);
  const previewVolumeProfile = (t0: number, t1: number, rows: number, valueArea: number) => {
    let snappedEnd = t1;
    for (let index = candles.length - 1; index >= 0; index -= 1) {
      if (candles[index].time <= t1) { snappedEnd = candles[index].time; break; }
    }
    const key = `${t0}:${snappedEnd}:${rows}:${valueArea}:${candles.length}`;
    if (previewProfileRef.current?.key === key) return previewProfileRef.current.prof;
    const prof = volumeProfile(candles, t0, t1, rows, valueArea);
    previewProfileRef.current = { key, prof };
    return prof;
  };
  const vwapCache = useMemo(() => {
    const cache = new Map<string, Array<{ time: number; vwap: number }>>();
    for (const drawing of drawings) {
      if (drawing.tool !== "anchoredVwap") continue;
      const pr = drawing.points;
      if (pr.length < 1) continue;
      cache.set(drawing.id, anchoredVwapSeries(candles, pr[0].time));
    }
    return cache;
  }, [drawings, candles]);

  const beginDrag = (drawing: Drawing, mode: "move" | number, event: ReactPointerEvent) => {
    event.stopPropagation();
    onSelect(drawing.id);
    const origin = drawing.points.map((point) => ({ ...point }));
    const start = windowPoint(event.clientX, event.clientY);
    if (!start) return;
    const onMove = (moveEvent: PointerEvent) => {
      const point = windowPoint(moveEvent.clientX, moveEvent.clientY);
      if (!point) return;
      if (mode === "move") {
        const dt = point.time - start.time;
        const dp = point.price - start.price;
        onUpdate({ ...drawing, points: origin.map((p) => ({ time: p.time + dt, price: p.price + dp })) });
      } else {
        onUpdate({ ...drawing, points: origin.map((p, i) => (i === mode ? point : p)) });
      }
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      dragCleanupRef.current = null;
    };
    const onUp = () => cleanup();
    // A single stored cleanup guarantees the window listeners are removed even
    // if the pane unmounts mid-drag (the previous leak).
    dragCleanupRef.current = cleanup;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
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
    if (["rectangle", "ellipse", "circle", "fibRetracement", "priceRange", "dateRange", "datePriceRange", "brush", "highlighter", "longPosition", "shortPosition"].includes(drawing.tool)) {
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
    if (!preview && style.visible === false) return null;
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
          // TradingView-style position tool: two bordered zones (profit above
          // entry for a long, risk below) bounded left by the entry anchor and
          // right by the stop/target points' time, with centred price chips
          // and a risk/reward readout riding the entry line.
          if (!b || !c || a.x == null) return null;
          const long = drawing.tool === "longPosition";
          const entryY = a.y!; const stopY = b.y!; const targetY = c.y!;
          const xL = a.x!;
          const xrCandidates = [b.x, c.x].filter((v): v is number => v != null);
          const xR = Math.max(xL + 40, ...(xrCandidates.length ? xrCandidates : [xL + 180]));
          const green = "#089981"; const red = "#F23645";
          const entryP = pr[0].price; const stopP = pr[1].price; const targetP = pr[2].price;
          const reward = Math.abs(targetP - entryP); const risk = Math.abs(entryP - stopP);
          const rr = risk > 0 ? reward / risk : 0;
          const pct = (v: number) => (entryP ? `${((v / entryP) * 100).toFixed(2)}%` : "");
          const chip = (cx: number, cy: number, text: string, bg: string) => {
            const wd = text.length * 6 + 14;
            return (
              <g>
                <rect x={cx - wd / 2} y={cy - 9} width={wd} height={18} rx={3} fill={bg} fillOpacity={0.92} />
                <text x={cx} y={cy + 3.5} fill="#FFFFFF" fontSize={10} fontFamily="monospace" textAnchor="middle">{text}</text>
              </g>
            );
          };
          const midX = (xL + xR) / 2;
          // TradingView layout (from their docs/tutorial): plain translucent
          // zone fills, the Target pill riding ON the target boundary, the
          // Stop pill ON the stop boundary, and a grey stats pill on the entry
          // line showing open P&L (real last close, in points) and the
          // risk/reward ratio.
          const lastClose = candles.length ? candles[candles.length - 1].close : null;
          const openPnl = lastClose == null ? null : (long ? lastClose - entryP : entryP - lastClose);
          const stats = `${openPnl == null ? "" : `Open P&L: ${openPnl >= 0 ? "+" : ""}${openPnl.toFixed(2)} · `}Risk/Reward Ratio: ${rr.toFixed(2)}`;
          return (
            <g>
              <rect x={xL} y={Math.min(entryY, targetY)} width={xR - xL} height={Math.max(1, Math.abs(targetY - entryY))} fill={green} fillOpacity={0.18} />
              <rect x={xL} y={Math.min(entryY, stopY)} width={xR - xL} height={Math.max(1, Math.abs(stopY - entryY))} fill={red} fillOpacity={0.18} />
              <line x1={xL} y1={targetY} x2={xR} y2={targetY} stroke={green} strokeOpacity={0.55} strokeWidth={1} />
              <line x1={xL} y1={stopY} x2={xR} y2={stopY} stroke={red} strokeOpacity={0.55} strokeWidth={1} />
              <line x1={xL} y1={entryY} x2={xR} y2={entryY} stroke="#B2B5BE" strokeOpacity={0.8} strokeWidth={1} />
              {style.showLabels ? (
                <g>
                  {chip(midX, targetY, `Target: ${targetP.toFixed(2)} (${long ? "+" : "-"}${reward.toFixed(2)} · ${pct(reward)})`, green)}
                  {chip(midX, stopY, `Stop: ${stopP.toFixed(2)} (${long ? "-" : "+"}${risk.toFixed(2)} · ${pct(risk)})`, red)}
                  {chip(midX, entryY, stats, "#5A6270")}
                </g>
              ) : null}
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
          return a.x == null ? null : <text x={a.x} y={a.y!} fill={stroke} fontSize={style.fontSize ?? 13} fontFamily="Inter, sans-serif">{drawing.text ?? ""}</text>;
        case "regressionTrend": {
          if (!b || a.x == null || b.x == null) return null;
          const t0 = Math.min(pr[0].time, pr[1].time); const t1 = Math.max(pr[0].time, pr[1].time);
          const inRange = candles.filter((cd) => cd.time >= t0 && cd.time <= t1);
          if (inRange.length < 2) return line(a.x!, a.y!, b.x, b.y!);
          const n = inRange.length;
          let sx = 0, sy = 0, sxy = 0, sxx = 0;
          inRange.forEach((cd, i) => { sx += i; sy += cd.close; sxy += i * cd.close; sxx += i * i; });
          const slope = (n * sxy - sx * sy) / Math.max(1e-9, n * sxx - sx * sx);
          const intercept = (sy - slope * sx) / n;
          let ssd = 0; inRange.forEach((cd, i) => { const e = cd.close - (intercept + slope * i); ssd += e * e; });
          const sd = Math.sqrt(ssd / n);
          const startPrice = intercept; const endPrice = intercept + slope * (n - 1);
          const sx0 = toX(inRange[0].time); const sx1 = toX(inRange[n - 1].time);
          if (sx0 == null || sx1 == null) return null;
          const py = (price: number) => toY(price);
          const cy0 = py(startPrice); const cy1 = py(endPrice);
          const u0 = py(startPrice + 2 * sd); const u1 = py(endPrice + 2 * sd);
          const l0 = py(startPrice - 2 * sd); const l1 = py(endPrice - 2 * sd);
          return <g>
            {cy0 != null && cy1 != null ? line(sx0, cy0, sx1, cy1) : null}
            {u0 != null && u1 != null ? line(sx0, u0, sx1, u1, stroke, 1) : null}
            {l0 != null && l1 != null ? line(sx0, l0, sx1, l1, stroke, 1) : null}
            {u0 != null && l1 != null ? <path d={`M${sx0},${u0} L${sx1},${u1} L${sx1},${l1} L${sx0},${l0} Z`} fill={stroke} fillOpacity={style.fillOpacity} stroke="none" /> : null}
          </g>;
        }
        case "barsPattern": {
          if (!b || a.x == null || b.x == null) return null;
          const t0 = Math.min(pr[0].time, pr[1].time); const t1 = Math.max(pr[0].time, pr[1].time);
          const inRange = candles.filter((cd) => cd.time >= t0 && cd.time <= t1);
          const bw = inRange.length > 1 ? Math.max(1, (Math.abs(b.x - a.x!) / inRange.length) * 0.6) : 3;
          return <g>{inRange.map((cd, i) => {
            const cx = toX(cd.time); const oy = toY(cd.open); const cyy = toY(cd.close); const hy = toY(cd.high); const ly = toY(cd.low);
            if (cx == null || oy == null || cyy == null || hy == null || ly == null) return null;
            const up = cd.close >= cd.open; const col = up ? "#089981" : "#F23645";
            return <g key={i}>{line(cx, hy, cx, ly, col, 1)}<rect x={cx - bw / 2} y={Math.min(oy, cyy)} width={bw} height={Math.max(1, Math.abs(cyy - oy))} fill={col} /></g>;
          })}</g>;
        }
        case "fixedRangeVolumeProfile":
        case "anchoredVolumeProfile": {
          const anchored = drawing.tool === "anchoredVolumeProfile";
          if (a.x == null) return null;
          const t0 = anchored ? pr[0].time : Math.min(pr[0].time, pr[1].time);
          const t1 = anchored ? (candles[candles.length - 1]?.time ?? pr[0].time) : Math.max(pr[0].time, pr[1].time);
          const x0 = toX(t0); const x1 = toX(t1);
          if (x0 == null || x1 == null) return null;
          const rows = style.profileRows ?? 80;
          const valueArea = style.valueAreaPercent ?? 68;
          // Committed drawings read the memoized histogram (recomputed only when
          // candles/anchors/settings change); the live preview recomputes only
          // when the cursor crosses a bar, never per pixel.
          const prof = preview
            ? previewVolumeProfile(t0, t1, rows, valueArea)
            : (volumeProfileCache.get(drawing.id) ?? volumeProfile(candles, t0, t1, rows, valueArea));
          if (!prof) return null;
          const boxRight = anchored ? x1 : Math.max(x0, x1);
          const boxLeft = Math.min(x0, x1);
          const widthPercent = Math.max(10, Math.min(80, style.profileWidthPercent ?? 32));
          const maxBarW = Math.max(30, (boxRight - boxLeft) * (widthPercent / 100));
          const outside = style.outsideColor ?? "#787B86";
          const showPoc = style.showPoc !== false;
          const pocY = toY(prof.poc);
          return <g>
            {prof.bins.map((bin, i) => {
              const yTop = toY(bin.priceHigh); const yBot = toY(bin.priceLow);
              if (yTop == null || yBot == null || prof.maxVol <= 0 || bin.volume <= 0) return null;
              const w = (bin.volume / prof.maxVol) * maxBarW;
              const inVA = bin.priceLow >= prof.valLow - 1e-9 && bin.priceHigh <= prof.vahHigh + 1e-9;
              const isPoc = i === prof.pocIndex;
              const rowHeight = Math.max(0.7, Math.abs(yBot - yTop) - 0.35);
              // The rows share a left spine and keep a hairline separation like
              // the native profile renderer, staying legible at 200 rows.
              return <rect key={i} x={boxLeft} y={Math.min(yTop, yBot) + 0.175} width={Math.max(0.5, w)} height={rowHeight} rx={Math.min(1.5, rowHeight / 2)}
                fill={isPoc ? style.color : inVA ? stroke : outside} fillOpacity={isPoc ? 0.95 : inVA ? 0.62 : 0.32} />;
            })}
            {showPoc && pocY != null ? line(boxLeft, pocY, boxRight, pocY, style.color, 1) : null}
            {showPoc && style.showLabels && pocY != null ? label(boxLeft + 3, pocY - 2, `POC ${prof.poc.toFixed(2)}`, style.color) : null}
          </g>;
        }
        case "anchoredVwap": {
          if (a.x == null) return null;
          const from = pr[0].time;
          const series = preview ? anchoredVwapSeries(candles, from) : (vwapCache.get(drawing.id) ?? anchoredVwapSeries(candles, from));
          if (series.length < 2) return null;
          const pts: string[] = [];
          for (const point of series) {
            const px = toX(point.time); const py = toY(point.vwap);
            if (px != null && py != null) pts.push(`${px},${py}`);
          }
          if (pts.length < 2) return null;
          return <g><polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth={w} strokeDasharray={dash} />{style.showLabels ? label(a.x, a.y! - 4, "AVWAP") : null}</g>;
        }
        case "gannFan": {
          if (!b || a.x == null || b.x == null) return null;
          const dxp = pr[1].time - pr[0].time; const dyp = pr[1].price - pr[0].price;
          const ratios = [1/8, 1/4, 1/3, 1/2, 1, 2, 3, 4, 8];
          return <g>{ratios.map((r, i) => {
            const ex = toX(pr[0].time + dxp); const ey = toY(pr[0].price + dyp * r);
            if (ex == null || ey == null) return null;
            const e = extend(a.x!, a.y!, ex, ey, width, height);
            return line(a.x!, a.y!, e.x, e.y, i === 4 ? stroke : "#787B86", i === 4 ? w : 1);
          })}</g>;
        }
        case "gannBox": {
          if (!b || a.x == null || b.x == null) return null;
          const x0 = Math.min(a.x!, b.x); const x1 = Math.max(a.x!, b.x); const y0 = Math.min(a.y!, b.y!); const y1 = Math.max(a.y!, b.y!);
          const fr = [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1];
          return <g>
            <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={stroke} fillOpacity={style.fillOpacity} stroke={stroke} strokeWidth={w} />
            {fr.map((f) => <g key={`h${f}`}>{line(x0, y0 + (y1 - y0) * f, x1, y0 + (y1 - y0) * f, "#787B86", 1)}</g>)}
            {fr.map((f) => <g key={`v${f}`}>{line(x0 + (x1 - x0) * f, y0, x0 + (x1 - x0) * f, y1, "#787B86", 1)}</g>)}
          </g>;
        }
        case "pitchfork":
        case "schiffPitchfork":
        case "modifiedSchiffPitchfork":
        case "insidePitchfork": {
          if (!b || !c || a.x == null || b.x == null || c.x == null) return null;
          let ox = a.x!; let oy = a.y!;
          if (drawing.tool === "schiffPitchfork") { oy = (a.y! + b.y!) / 2; }
          else if (drawing.tool === "modifiedSchiffPitchfork") { ox = (a.x! + b.x) / 2; oy = (a.y! + b.y!) / 2; }
          else if (drawing.tool === "insidePitchfork") { ox = (a.x! + b.x) / 2; oy = (a.y! + b.y!) / 2; }
          const mx = (b.x + c.x) / 2; const my = (b.y! + c.y!) / 2;
          const med = extend(ox, oy, mx, my, width, height);
          const dxm = mx - ox; const dym = my - oy;
          const tine = (hx: number, hy: number) => { const e = extend(hx, hy, hx + dxm, hy + dym, width, height); return line(hx, hy, e.x, e.y, stroke, 1); };
          return <g>{line(ox, oy, med.x, med.y)}{line(b.x, b.y!, c.x, c.y!, "#787B86", 1)}{tine(b.x, b.y!)}{tine(c.x, c.y!)}</g>;
        }
        case "cypher":
        case "elliottImpulse":
        case "elliottCorrection": {
          const valid = coords.filter((p) => p.x != null);
          const pts = valid.map((p) => `${p.x},${p.y}`).join(" ");
          const labels = drawing.tool === "cypher" ? ["X", "A", "B", "C", "D"]
            : drawing.tool === "elliottImpulse" ? ["", "1", "2", "3", "4", "5"]
            : ["", "A", "B", "C"];
          return <g>
            <polyline points={pts} fill={drawing.tool === "cypher" ? stroke : "none"} fillOpacity={drawing.tool === "cypher" ? style.fillOpacity : 0} stroke={stroke} strokeWidth={w} strokeDasharray={dash} />
            {style.showLabels ? valid.map((p, i) => labels[i] ? label(p.x! + 3, p.y! - 3, labels[i]) : null) : null}
          </g>;
        }
        default:
          return null;
      }
    })();

    if (!body) return null;
    const interactive = !preview && !active && activeTool !== "eraser";
    // Volume profiles anchor to the exact wicks the trader clicked. A body
    // drag silently shifting both anchors was how profiles "wandered"; the
    // body now only selects, and repositioning happens through the two
    // anchor dots alone.
    const bodyMovable = drawing.tool !== "fixedRangeVolumeProfile" && drawing.tool !== "anchoredVolumeProfile";
    const valid = coords.filter((p) => p.x != null && p.y != null) as { x: number; y: number }[];
    const xs = valid.map((p) => p.x); const ys = valid.map((p) => p.y);
    // Transparent fat hit layer so thin lines and shape interiors are easy to
    // grab; single-anchor tools get a hit line/dot instead.
    const hit = interactive ? (
      <g style={{ pointerEvents: "all" }}>
        {["horizontalLine", "horizontalRay"].includes(drawing.tool) && a.y != null
          ? <line x1={0} y1={a.y} x2={width} y2={a.y} stroke="transparent" strokeWidth={12} />
          : ["verticalLine", "crossLine"].includes(drawing.tool) && a.x != null
            ? <>{<line x1={a.x} y1={0} x2={a.x} y2={height} stroke="transparent" strokeWidth={12} />}{drawing.tool === "crossLine" && a.y != null ? <line x1={0} y1={a.y} x2={width} y2={a.y} stroke="transparent" strokeWidth={12} /> : null}</>
            : valid.length >= 2
              ? <>
                  <polyline points={valid.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="transparent" strokeWidth={12} />
                  <rect x={Math.min(...xs)} y={Math.min(...ys)} width={Math.max(1, Math.max(...xs) - Math.min(...xs))} height={Math.max(1, Math.max(...ys) - Math.min(...ys))} fill="transparent" />
                </>
              : valid.length === 1
                ? <circle cx={valid[0].x} cy={valid[0].y} r={12} fill="transparent" />
                : null}
      </g>
    ) : null;
    const handles = selected
      ? valid.map((p, i) => (
        <circle key={`h${i}`} cx={p.x} cy={p.y} r={4.5} fill="#fff" stroke={stroke} strokeWidth={1.5}
          style={{ pointerEvents: "all", cursor: "grab" }}
          onPointerDown={(event) => beginDrag(drawing, i, event)} />
      ))
      : null;
    return (
      <g
        key={drawing.id}
        opacity={preview ? 0.75 : 1}
        style={interactive ? { pointerEvents: "auto", cursor: bodyMovable ? "move" : "pointer" } : { pointerEvents: "none" }}
        onPointerDown={interactive
          ? (event) => {
              if (bodyMovable) beginDrag(drawing, "move", event);
              else { event.stopPropagation(); onSelect(drawing.id); }
            }
          : undefined}
        onDoubleClick={interactive ? () => onOpenSettings(drawing.id) : undefined}
      >
        {body}
        {hit}
        {handles}
      </g>
    );
  };

  const previewDrawing: Drawing | null = pending && cursor
    ? { id: "__preview__", tool: pending.tool, points: freehandRef.current ? pending.points : [...pending.points, cursor], style: previewStyle(pending.tool) }
    : null;

  const captureActive = active || activeTool === "eraser";
  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 z-[24]"
      width={width}
      height={height}
      data-viewport={viewportVersion}
      style={{ pointerEvents: "none" }}
    >
      <g ref={drawingsGroupRef}>
        {drawings.map((drawing) => renderDrawing(drawing))}
        {previewDrawing ? renderDrawing(previewDrawing, true) : null}
      </g>
      {captureActive ? (
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          style={{ pointerEvents: "all", cursor: active ? "crosshair" : "cell" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          onPointerLeave={() => setCursor(null)}
        />
      ) : null}
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

// Price-space anchored-VWAP series (viewport-invariant): one cumulative pass
// over the candles from the anchor time forward, returning {time, vwap} pairs.
// The per-frame render maps these to pixels; it does not recompute the sum.
function anchoredVwapSeries(candles: DrawCandle[], from: number) {
  const series: Array<{ time: number; vwap: number }> = [];
  let cumPV = 0; let cumV = 0;
  for (const cd of candles) {
    if (cd.time < from) continue;
    const v = Math.max(0, cd.volume ?? 0);
    const typical = (cd.high + cd.low + cd.close) / 3;
    if (v > 0) { cumPV += typical * v; cumV += v; }
    series.push({ time: cd.time, vwap: cumV > 0 ? cumPV / cumV : typical });
  }
  return series;
}

function volumeProfile(candles: DrawCandle[], t0: number, t1: number, binCount = 80, valueAreaPercent = 70) {
  const inRange = candles.filter((c) => c.time >= t0 && c.time <= t1);
  if (inRange.length < 2) return null;
  let priceMin = Infinity; let priceMax = -Infinity;
  for (const c of inRange) { if (c.low < priceMin) priceMin = c.low; if (c.high > priceMax) priceMax = c.high; }
  if (!Number.isFinite(priceMin) || !Number.isFinite(priceMax) || priceMax <= priceMin) return null;
  binCount = Math.max(20, Math.min(200, Math.round(binCount)));
  const binSize = (priceMax - priceMin) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    priceLow: priceMin + i * binSize,
    priceHigh: priceMin + (i + 1) * binSize,
    volume: 0,
  }));
  let totalVol = 0;
  for (const c of inRange) {
    const v = Math.max(0, c.volume ?? 0);
    if (v <= 0) continue;
    totalVol += v;
    const span = Math.max(binSize, c.high - c.low);
    const perPrice = v / span;
    for (const bin of bins) {
      const overlap = Math.max(0, Math.min(c.high, bin.priceHigh) - Math.max(c.low, bin.priceLow));
      if (overlap > 0) bin.volume += perPrice * overlap;
    }
  }
  if (totalVol <= 0) return null;
  let pocIndex = 0; let maxVol = 0;
  bins.forEach((bin, i) => { if (bin.volume > maxVol) { maxVol = bin.volume; pocIndex = i; } });
  const poc = (bins[pocIndex].priceLow + bins[pocIndex].priceHigh) / 2;
  const target = totalVol * (Math.max(50, Math.min(95, valueAreaPercent)) / 100);
  let vaVol = bins[pocIndex].volume; let lo = pocIndex; let hi = pocIndex;
  while (vaVol < target && (lo > 0 || hi < bins.length - 1)) {
    const below = lo > 0 ? bins[lo - 1].volume : -1;
    const above = hi < bins.length - 1 ? bins[hi + 1].volume : -1;
    if (above >= below && hi < bins.length - 1) { hi += 1; vaVol += bins[hi].volume; }
    else if (lo > 0) { lo -= 1; vaVol += bins[lo].volume; }
    else break;
  }
  return { bins, poc, pocIndex, maxVol, valLow: bins[lo].priceLow, vahHigh: bins[hi].priceHigh };
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
