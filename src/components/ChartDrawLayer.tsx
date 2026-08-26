"use client";

import { type PointerEvent as ReactPointerEvent, type ReactElement, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  DRAW_TOOL_SPECS,
  FIB_CIRCLE_COEFFS,
  FIB_LEVELS,
  FIB_RETRACEMENT_LEVELS,
  FIB_TIME_COEFFS,
  createDrawing,
  resolveDrawColor,
  updateDrawingHandle,
  type DrawLineStyle,
  type DrawPoint,
  type DrawToolId,
  type Drawing,
  magnetStrengthSpec,
  type MagnetStrength,
} from "@/lib/chartDrawTools";
import { fillMarkerGeometry, timeAtPixelPastLastBar } from "@/lib/chartDrawGeometry";

// Self-contained SVG overlay that owns the new charting tools end to end:
// point placement (fixed-count, poly-click and freehand-drag), live preview,
// per-tool rendering, selection handles and dragging. The chart supplies the
// coordinate system — the only thing shared with the chart.
type Props = {
  width: number;
  /**
   * The price scale's width. The overlay spans the whole chart element, so
   * without it every drawing paints over the scale instead of sliding under
   * it the way candles do.
   */
  priceScaleWidth?: number;
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
  magnetStrength: MagnetStrength;
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
  /**
   * The theme's bullish candle colour. Every tool on the rail paints in it
   * until the trader picks a colour of their own, so a drawing never sits on
   * the chart in a palette the theme has moved away from.
   */
  themeColor?: string;
  /** Theme bearish candle, for the risk side of a position calculator. */
  themeBearColor?: string;
};

type XY = { x: number | null; y: number | null };
export type DrawCandle = { time: number; open: number; high: number; low: number; close: number; volume: number };

const dashFor = (style: DrawLineStyle, width: number) =>
  style === "dashed" ? `${width * 3} ${width * 2}` : style === "dotted" ? `${width} ${width * 2}` : undefined;

// Every tool whose whole point is the words on it. priceLabel and flagMark
// were missing: defaultStyleFor treats them as text-bearing, but they fell
// through to generic placement instead of being asked for their text, so both
// dropped an empty, captionless marker on the chart and looked broken.
const TEXT_INPUT_TOOLS: DrawToolId[] = ["text", "note", "callout", "signpost", "priceLabel", "flagMark"];

export default function ChartDrawLayer({
  width, height, priceScaleWidth = 0, activeTool, keepDrawing, drawings, selectedId,
  toX, toY, fromXY, candles, magnet, magnetStrength, viewportVersion, chartReady, subscribeViewport, onCommit, onUpdate, onDelete, onSelect, onToolConsumed, onRequestText, onOpenSettings, themeColor, themeBearColor,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pending, setPending] = useState<{ tool: DrawToolId; points: DrawPoint[] } | null>(null);
  const [cursor, setCursor] = useState<DrawPoint | null>(null);
  const freehandRef = useRef(false);
  const dragRef = useRef<
    // A move carries where the drawing sat on SCREEN when it was grabbed, not
    // just the anchor under the pointer. Translating by a time delta assumes
    // an equal step in time is an equal step in pixels; on a volume, range or
    // tick chart the bar times are irregular, a session gap folds hours into
    // one boundary, and past the last bar the mapping extrapolates — so the
    // drawing sheared and flung points at the pane edge as it moved.
    | {
      kind: "move";
      id: string;
      startX: number;
      startY: number;
      origin: DrawPoint[];
      originPixels: Array<{ x: number | null; y: number | null }>;
    }
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
  // Snap reach follows the selected strength rather than one fixed radius,
  // so a weak magnet can be left on permanently without it grabbing points
  // the trader meant to place freely.
  const SNAP_RADIUS_PX = magnetStrengthSpec(magnetStrength).radiusPx;
  const SNAP_RELEASE_PX = magnetStrengthSpec(magnetStrength).releasePx;
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
  // The nearest candle level to a pixel position, ignoring both the hysteresis
  // lock and pointer velocity. The preview path deliberately drops the magnet
  // while the pointer is moving fast, which is right for the rubber band but
  // wrong at the moment a gesture commits: flicking an anchor onto a wick and
  // letting go was landing on the raw pointer price, a few ticks off the high.
  const hardSnap = (x: number, y: number): { point: DrawPoint; distance: number } | null => {
    const raw = fromXY(x, y);
    if (!raw || !magnet || candles.length === 0) return null;
    const candle = nearestCandleByTime(raw.time);
    const cx = toX(candle.time);
    if (cx == null || Math.abs(cx - x) > SNAP_RADIUS_PX) return null;
    let best: DrawPoint | null = null;
    let bestDist = SNAP_RADIUS_PX;
    for (const value of [candle.high, candle.low, candle.open, candle.close]) {
      const vy = toY(value);
      if (vy == null) continue;
      const distance = Math.abs(vy - y);
      if (distance <= bestDist) { bestDist = distance; best = { time: candle.time, price: value }; }
    }
    return best ? { point: best, distance: bestDist } : null;
  };

  // Freehand samples must never magnet. Snapping every sample of a stroke to
  // the nearest open/high/low/close turns a drawn line into a staircase.
  const rawPoint = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return fromXY(clientX - rect.left, clientY - rect.top);
  };

  /**
   * The price at a pixel, independent of whether the time is knowable.
   *
   * fromXY answers with a {time, price} pair or nothing at all, so a pixel the
   * time scale cannot name also loses its price. The price scale always knows
   * its own answer, and a drag that can only resolve one axis should still
   * move along that axis rather than doing nothing.
   */
  const priceAtY = (localY: number) => {
    // Probe at a pixel the time scale can definitely name — the last bar's own
    // x — so the pair resolves and its price can be read. The price scale does
    // not care which column was asked.
    const lastTime = candles.length ? candles[candles.length - 1].time : null;
    const probeX = lastTime == null ? null : toX(lastTime);
    for (const x of [probeX, 0, Math.max(0, width - priceScaleWidth - 1)]) {
      if (x == null) continue;
      const point = fromXY(x, localY);
      if (point) return point.price;
    }
    return null;
  };

  /**
   * The chart time at a pixel, including past the last bar.
   *
   * The time scale only names times it has bars for, so everything right of
   * the live edge — where a position tool's right edge is deliberately placed
   * — comes back null. Past the last bar the answer is counted in BARS: how
   * many bar widths the pixel is beyond the final bar, times the bar spacing.
   * Measuring in bars rather than clock time is what makes this behave the
   * same on a volume, range or tick chart, whose bars carry irregular times
   * and which have no fixed interval to extrapolate with at all.
   */
  const timeAtX = (localX: number) => {
    const direct = fromXY(localX, 0);
    if (direct) return direct.time;
    if (candles.length < 2) return null;
    const lastTime = candles[candles.length - 1].time;
    const previousTime = candles[candles.length - 2].time;
    const lastX = toX(lastTime);
    const previousX = toX(previousTime);
    if (lastX == null || previousX == null) return null;
    return timeAtPixelPastLastBar({
      localX,
      lastTime,
      lastX,
      previousTime,
      previousX,
      recentTimes: candles.slice(-12).map((candle) => candle.time),
    });
  };
  // Unique per layer: two charts on screen must not share one clip.
  const plotClipId = useId().replace(/:/g, "");
  const freehandCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => { freehandCleanupRef.current?.(); }, []);

  const localPoint = (event: ReactPointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    // Placement clicks must lock decisively; only pointer MOVES are velocity
    // aware, so "click the high, click the low" always lands on the wick.
    return snapAt(event.clientX - rect.left, event.clientY - rect.top, { velocityAware: event.type === "pointermove" });
  };

  /**
   * Where a freshly placed position tool should end, in chart time.
   *
   * Counted in bars so it behaves the same on a clock chart and on a volume,
   * range or tick chart, whose bars carry irregular times. Past the last bar
   * there is nothing to count, so the spacing of the recent ones is continued
   * — the median rather than the mean, since one maintenance break would drag
   * an average across the whole session.
   */
  const POSITION_TOOL_BARS = 12;
  const rightEdgeTimeForPosition = (fromTime: number): number | null => {
    if (!candles.length) return fromTime + 60 * POSITION_TOOL_BARS;
    let index = 0;
    while (index < candles.length && candles[index].time < fromTime) index += 1;
    const ahead = candles[Math.min(candles.length - 1, index + POSITION_TOOL_BARS)];
    if (ahead && ahead.time > fromTime) return ahead.time;
    const tail = candles.slice(-12);
    const gaps = tail
      .slice(1)
      .map((candle, position) => candle.time - tail[position].time)
      .filter((gap) => gap > 0)
      .sort((left, right) => left - right);
    const step = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 60;
    return fromTime + step * POSITION_TOOL_BARS;
  };

  const finish = (tool: DrawToolId, points: DrawPoint[]) => {
    let committed = points;
    // Entry and exit markers are placed with ONE click on the bar being
    // marked. The click is the fill itself — the marker is CENTRED on it, as
    // the real one is — and the second point is a size handle synthesized a
    // marker's width away.
    //
    // Nine pixels right is inside the plot for any click that landed on a
    // bar, so fromXY can always name it. Asking for a pixel much further right
    // would land past the last bar near the live edge and come back null,
    // which is how other tools have silently failed to appear.
    if ((tool === "entryArrow" || tool === "exitArrow") && points.length === 1) {
      const anchor = points[0];
      const anchorX = toX(anchor.time);
      const anchorY = toY(anchor.price);
      if (anchorX != null && anchorY != null) {
        const handle = fromXY(
          anchorX + FILL_MARKER_DEFAULT_HALF_WIDTH_PX,
          anchorY + FILL_MARKER_DEFAULT_HALF_HEIGHT_PX,
        );
        if (handle) committed = [anchor, handle];
      }
    }
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
        // The right edge is measured in BARS, not pixels.
        //
        // It used to ask the time scale what time sat 180px to the right, and
        // on a volume or range chart that lands past the last bar, where the
        // scale has no time to give. fromXY returned null, the three-point
        // shape was never built, and the renderer — which needs all three —
        // drew nothing at all. A long or short placed on 500v simply did not
        // appear.
        const rightTime = rightEdgeTimeForPosition(p.time);
        if (rightTime != null && Number.isFinite(stopPrice) && Number.isFinite(targetPrice)) {
          committed = [
            p,
            { time: rightTime, price: stopPrice },
            { time: rightTime, price: targetPrice },
          ];
        }
      }
    }
    onCommit(createDrawing(tool, committed));
    setPending(null);
    // Drawing is repetitive by nature: finishing one stroke should leave the
    // pencil in hand rather than dropping back to the cursor every time.
    const staysArmed = keepDrawing || DRAW_TOOL_SPECS[tool].points === "freehand";
    if (!staysArmed) onToolConsumed();
  };

  // Dragging is driven by window-level listeners so the pointer never
  // "escapes" the drawing and the chart cannot repaint mid-drag — the source
  // of the previous glitchy, wobbling movement.
  const windowPoint = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return snapAt(clientX - rect.left, clientY - rect.top, { velocityAware: true });
  };
  // Clicking the chart away from a drawing puts its anchor dots away.
  //
  // The only deselect used to live on the capture rect, which is not rendered
  // while the cursor tool is active — which is exactly the state you are in
  // after drawing something. So a placed drawing kept its handles for the rest
  // of the session and could be dragged by accident at any moment.
  //
  // It listens on the chart container in the bubble phase, and it decides from
  // the EVENT TARGET.
  //
  // It used to clear unconditionally, on the assumption that a drawing's own
  // onPointerDown had already called stopPropagation() so a press that hit a
  // drawing could never reach here. That is not how React delivers events:
  // listeners are attached once at the app ROOT, which is an ancestor of this
  // container, so the native event reaches this listener FIRST and the React
  // handler — with its stopPropagation — runs afterwards. Pressing a resize
  // handle therefore deselected the drawing before the grab could start, the
  // handles unmounted underneath the cursor, and the drag died on the spot.
  // That is why every tool's corner handles "did nothing": trend lines, rays,
  // fibs, rectangles and both position calculators all share this path.
  //
  // Reading the target is immune to the ordering: anything inside a drawing is
  // marked data-draw-hit, so only a press that genuinely hit empty chart
  // clears the selection.
  useEffect(() => {
    if (!selectedId) return;
    const container = svgRef.current?.parentElement;
    if (!container) return;
    const clear = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.("[data-draw-hit]")) return;
      onSelect(null);
    };
    container.addEventListener("pointerdown", clear);
    return () => container.removeEventListener("pointerdown", clear);
  }, [onSelect, selectedId]);

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

  // Chart.tsx supplies these projectors as inline callbacks. Their identity
  // therefore changes on every live candle render even though they always
  // read the same chart refs. A viewport subscription that depends on those
  // callback identities continuously unsubscribes and re-subscribes while
  // the market is live, leaving a large volume of listener closures for GC.
  // Keep the single subscription stable and read the current projectors from
  // a ref when a viewport event actually arrives.
  const viewportProjectionRef = useRef({ toX, toY });
  viewportProjectionRef.current = { toX, toY };

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
    let settleTimer: number | null = null;
    /**
     * Re-render at the real projection once the chart stops moving.
     *
     * The transform below keeps every drawing in the right PLACE while the
     * chart moves. What it cannot keep is label text at its true size, since
     * text inside a scaled group scales with it. So the layer is left alone
     * during the gesture and redrawn when it ends — by which time the
     * transform has already been holding the correct position, so there is
     * nothing to see in the swap.
     */
    const settle = () => {
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        settleTimer = null;
        forceRedraw((value) => value + 1);
      }, 90);
    };
    const onViewport = () => {
      const basis = projectionBasisRef.current;
      const group = drawingsGroupRef.current;
      if (!basis || !group) return;
      const projection = viewportProjectionRef.current;
      const xA = projection.toX(basis.timeA);
      const xB = projection.toX(basis.timeB);
      const yA = projection.toY(basis.priceA);
      const yB = projection.toY(basis.priceB);
      if (xA == null || xB == null || yA == null || yB == null) return;
      const scaleX = (xB - xA) / (basis.xB - basis.xA);
      const scaleY = (yB - yA) / (basis.yB - basis.yA);
      // Panning and zooming a linear time and price scale are both AFFINE, so
      // a translate-and-scale reproduces the new projection exactly — not
      // approximately — however far the chart has moved. This used to give up
      // past a five-percent rescale and hand the frame to a React redraw,
      // which lands after the candles have already moved: one wheel notch is
      // more than five percent, so every zoom left the drawings a frame or
      // more behind the chart and then snapped them into place when the
      // movement stopped. That snap is the drawing "resetting".
      if (
        !Number.isFinite(scaleX) || !Number.isFinite(scaleY)
        || scaleX <= 0.001 || scaleY <= 0.001
        || scaleX > 1_000 || scaleY > 1_000
      ) {
        group.removeAttribute("transform");
        forceRedraw((value) => value + 1);
        return;
      }
      const dx = xA - scaleX * basis.xA;
      const dy = yA - scaleY * basis.yA;
      if (dx === 0 && dy === 0 && scaleX === 1 && scaleY === 1) {
        group.removeAttribute("transform");
        return;
      }
      group.setAttribute("transform", `translate(${dx} ${dy}) scale(${scaleX} ${scaleY})`);
      // Only a rescale needs settling; a pure pan translates text without
      // distorting it, so it can hold the transform indefinitely.
      if (scaleX !== 1 || scaleY !== 1) settle();
    };
    const unsubscribe = subscribeViewport(onViewport);
    return () => {
      unsubscribe();
      if (settleTimer !== null) window.clearTimeout(settleTimer);
    };
  }, [subscribeViewport, chartReady]);
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

  /**
   * Resizing a position tool by one of its four corners.
   *
   * The generic handles put one dot per POINT, which for this tool is the
   * entry anchor and the two right-hand prices — three dots, none of them on a
   * corner of the box you can see. Dragging the body moved the whole thing, so
   * there was no way to change the stop or the target by hand: it only ever
   * slid around.
   *
   * A corner carries a price and a time edge. The stop corners move the stop,
   * the target corners move the target, the left pair moves the entry's own
   * time and the right pair moves the shared right edge. The entry PRICE is
   * never touched — that is where the trade was entered, not a size handle.
   */
  const beginPositionCornerDrag = (
    drawing: Drawing,
    corner: { side: "left" | "right"; edge: "stop" | "target" },
    event: ReactPointerEvent,
  ) => {
    event.stopPropagation();
    onSelect(drawing.id);
    if (drawing.points.length < 3) return;
    const origin = drawing.points.map((point) => ({ ...point }));
    const onMove = (moveEvent: PointerEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const localX = moveEvent.clientX - rect.left;
      const localY = moveEvent.clientY - rect.top;
      // The two axes are resolved SEPARATELY, and this is the whole fix.
      //
      // It used to ask fromXY for a {time, price} pair and give up entirely
      // when that came back null. fromXY is null for any pixel the time scale
      // cannot name — which is the whole blank area to the right of the last
      // bar. A position tool is placed with its right edge twelve bars past
      // the entry, so both right-hand corners sit in exactly that dead zone
      // and dragging them did nothing at all. Worse, the price was thrown
      // away with the time, so a corner could not even be moved up or down.
      const price = priceAtY(localY);
      const time = timeAtX(localX);
      if (price == null && time == null) return;
      const next = origin.map((entry) => ({ ...entry }));
      if (price != null) {
        if (corner.edge === "stop") next[1].price = price;
        else next[2].price = price;
      }
      if (time != null) {
        if (corner.side === "left") {
          // Neither edge may cross the other, or the box turns inside out and
          // the fills render with a negative width.
          next[0].time = Math.min(time, next[1].time - 1);
        } else {
          const right = Math.max(time, next[0].time + 1);
          next[1].time = right;
          next[2].time = right;
        }
      }
      onUpdate({ ...drawing, points: next });
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      dragCleanupRef.current = null;
    };
    dragCleanupRef.current = cleanup;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
  };

  /**
   * Resizing an entry/exit fill marker by its single handle.
   *
   * The generic handles put one dot per POINT, and this tool's two points are
   * the fill itself and a size corner nine pixels away — two dots overlapping
   * at the marker's default size, with the hit test returning the first. So
   * grabbing the visible dot always caught the ANCHOR and moved the marker
   * instead of resizing it: the handle did nothing, because it could not be
   * reached at all.
   *
   * There is now one handle, drawn out at the triangle's point where nothing
   * else sits. Dragging it along the direction the marker faces sets its
   * width, and away from the price line sets its height.
   */
  const beginFillMarkerResize = (drawing: Drawing, event: ReactPointerEvent) => {
    event.stopPropagation();
    onSelect(drawing.id);
    if (drawing.points.length < 2) return;
    const origin = drawing.points.map((point) => ({ ...point }));
    const onMove = (moveEvent: PointerEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const localX = moveEvent.clientX - rect.left;
      const localY = moveEvent.clientY - rect.top;
      // Each axis resolved on its own, so a pixel past the last bar — where
      // the time scale has no answer — still resizes the height.
      const price = priceAtY(localY);
      const time = timeAtX(localX);
      if (price == null && time == null) return;
      const next = origin.map((point) => ({ ...point }));
      if (time != null) next[1].time = time;
      if (price != null) next[1].price = price;
      onUpdate({ ...drawing, points: next });
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      dragCleanupRef.current = null;
    };
    dragCleanupRef.current = cleanup;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
  };

  const beginDrag = (drawing: Drawing, mode: "move" | number, event: ReactPointerEvent) => {
    event.stopPropagation();
    onSelect(drawing.id);
    const origin = drawing.points.map((point) => ({ ...point }));
    // Moving a whole drawing measures its delta from the RAW pointer.
    //
    // Taking it from the magnet-snapped point made the delta jump to whichever
    // candle time and open/high/low/close the magnet had latched, and the
    // velocity-aware snap engages and releases while a drag is in flight — so
    // the shape lurched sideways and scrambled as it moved, worst on a pencil
    // stroke where every sample carries its own time. Snapping belongs to
    // placing a point, not to translating one that is already placed.
    const start = mode === "move"
      ? rawPoint(event.clientX, event.clientY)
      : windowPoint(event.clientX, event.clientY);
    if (!start) return;
    // Where each point sits on SCREEN when the grab starts.
    //
    // A drag moves a drawing across the screen, so it has to translate in
    // screen space. Applying a time delta to every point instead assumes an
    // equal step in time is an equal step in pixels, and it is not: bar times
    // on a volume, range or tick chart are irregular, a session gap folds
    // hours into one bar boundary, and past the last bar the mapping
    // extrapolates. The same drawing therefore stretched, sheared and threw
    // points at the edge of the pane as it moved — worst on a pencil stroke,
    // where every sample carries its own time and each one distorted by a
    // different amount. Held in pixels the shape is exactly the shape drawn.
    const startPixels = origin.map((p) => ({ x: toX(p.time), y: toY(p.price) }));
    const startX = event.clientX;
    const startY = event.clientY;
    // The drag's own running result. Reading it back off the `drawing` prop at
    // release would use the value captured when the drag began.
    let latest = origin;
    const onMove = (moveEvent: PointerEvent) => {
      if (mode === "move") {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        const moved: DrawPoint[] = [];
        for (let index = 0; index < origin.length; index += 1) {
          const pixel = startPixels[index];
          // A point the projection cannot place — off an event chart's ends,
          // say — keeps its stored anchor rather than being invented at the
          // pane edge.
          if (pixel.x == null || pixel.y == null) { moved.push(origin[index]); continue; }
          const next = fromXY(pixel.x + dx, pixel.y + dy);
          moved.push(next ?? origin[index]);
        }
        latest = moved;
      } else {
        const point = windowPoint(moveEvent.clientX, moveEvent.clientY);
        if (!point) return;
        latest = origin.map((p, i) => (i === mode ? point : p));
      }
      onUpdate({ ...drawing, points: latest });
    };

    // Landing the gesture. A whole-drawing move previously applied a raw
    // delta to every point, so a trend line, Gann fan or fib moved as a unit
    // ignored the magnet entirely however close its ends came to a wick.
    // Now the anchor that sits closest to a candle level pulls the whole
    // drawing onto it, and a single dragged anchor snaps in its own right.
    const settle = () => {
      if (!magnet || latest === origin) return;
      // A freehand stroke has no meaningful anchor to pin to a wick, and
      // shifting the whole thing so one arbitrary sample lands on one would
      // move a drawing the trader placed by hand.
      if (DRAW_TOOL_SPECS[drawing.tool].points === "freehand") return;
      let best: { index: number; point: DrawPoint; distance: number } | null = null;
      latest.forEach((p, index) => {
        if (mode !== "move" && index !== mode) return;
        const px = toX(p.time);
        const py = toY(p.price);
        if (px == null || py == null) return;
        const hit = hardSnap(px, py);
        if (!hit) return;
        if (!best || hit.distance < best.distance) best = { index, point: hit.point, distance: hit.distance };
      });
      if (!best) return;
      const target = best as { index: number; point: DrawPoint; distance: number };
      if (mode === "move") {
        const dt = target.point.time - latest[target.index].time;
        const dp = target.point.price - latest[target.index].price;
        if (dt === 0 && dp === 0) return;
        onUpdate({ ...drawing, points: latest.map((p) => ({ time: p.time + dt, price: p.price + dp })) });
      } else {
        onUpdate({ ...drawing, points: latest.map((p, i) => (i === mode ? target.point : p)) });
      }
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      dragCleanupRef.current = null;
    };
    const onUp = () => { settle(); cleanup(); };
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
        event.currentTarget.setPointerCapture(event.pointerId);
        if (hit.handleIndex != null) dragRef.current = { kind: "handle", id: hit.id, index: hit.handleIndex };
        else {
          const drawing = drawings.find((d) => d.id === hit.id)!;
          const rect = svgRef.current?.getBoundingClientRect();
          dragRef.current = {
            kind: "move",
            id: hit.id,
            startX: event.clientX - (rect?.left ?? 0),
            startY: event.clientY - (rect?.top ?? 0),
            origin: drawing.points.map((p) => ({ ...p })),
            originPixels: drawing.points.map((p) => ({ x: toX(p.time), y: toY(p.price) })),
          };
        }
      } else onSelect(null);
      return;
    }

    if (TEXT_INPUT_TOOLS.includes(activeTool)) {
      const need = typeof spec.points === "number" ? spec.points : 1;
      if (!pending) {
        if (need <= 1) { onRequestText([point], activeTool); onToolConsumed(); return; }
        setPending({ tool: activeTool, points: [point] });
        event.currentTarget.setPointerCapture(event.pointerId);
      } else {
        const next = [...pending.points, point];
        if (next.length >= need) { onRequestText(next, activeTool); setPending(null); onToolConsumed(); }
        else setPending({ tool: activeTool, points: next });
      }
      return;
    }

    if (spec.points === "freehand") {
      // Press, drag, release — driven from the window so the release is always
      // seen.
      //
      // This used to take pointer capture on the <svg> root, which carries
      // pointer-events:none and no handlers; the handlers live on the capture
      // rect inside it. Capture therefore routed every following pointermove
      // and pointerup away from the only code that could end the stroke, so
      // the release went unnoticed: freehandRef stayed true, ordinary mouse
      // movement kept extending the line with no button held, and the next
      // click restarted `pending` and wiped whatever had been drawn.
      const first = rawPoint(event.clientX, event.clientY);
      if (!first) return;
      freehandRef.current = true;
      let samples = [first];
      setPending({ tool: activeTool, points: samples });
      const onMove = (moveEvent: PointerEvent) => {
        const next = rawPoint(moveEvent.clientX, moveEvent.clientY);
        if (!next) return;
        samples = [...samples, next];
        setPending({ tool: activeTool, points: samples });
      };
      const cleanup = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        freehandCleanupRef.current = null;
        freehandRef.current = false;
      };
      const onUp = () => {
        cleanup();
        // A stroke of one sample is a stray click, not a drawing.
        if (samples.length >= 2) finish(activeTool, samples);
        else setPending(null);
      };
      freehandCleanupRef.current = cleanup;
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      return;
    }
    if (spec.points === "poly") {
      setPending((current) => current && current.tool === activeTool
        ? { ...current, points: [...current.points, point] }
        : { tool: activeTool, points: [point] });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (spec.points === 1) { finish(activeTool, [point]); return; }

    if (!pending) {
      setPending({ tool: activeTool, points: [point] });
      event.currentTarget.setPointerCapture(event.pointerId);
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

    // Freehand runs on window listeners; the rect must not sample it as well.
    if (freehandRef.current) return;
    const drag = dragRef.current;
    if (drag) {
      const drawing = drawings.find((d) => d.id === drag.id);
      if (!drawing) return;
      if (drag.kind === "handle") onUpdate(updateDrawingHandle(drawing, drag.index, point));
      else {
        const rect = svgRef.current?.getBoundingClientRect();
        const dx = event.clientX - (rect?.left ?? 0) - drag.startX;
        const dy = event.clientY - (rect?.top ?? 0) - drag.startY;
        // Translated in pixels, so what the trader sees keeps the shape they
        // drew. A point the projection cannot place keeps its stored anchor
        // rather than being invented at the pane edge.
        const moved = drag.origin.map((p, index) => {
          const pixel = drag.originPixels[index];
          if (pixel?.x == null || pixel?.y == null) return p;
          return fromXY(pixel.x + dx, pixel.y + dy) ?? p;
        });
        onUpdate({ ...drawing, points: moved });
      }
    }
  };

  const handlePointerUp = () => {
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
    if (["rectangle", "ellipse", "circle", "fibRetracement", "priceRange", "dateRange", "datePriceRange", "brush", "highlighter", "longPosition", "shortPosition", "entryArrow", "exitArrow"].includes(drawing.tool)) {
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
    const stroke = resolveDrawColor(style, themeColor);
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
        case "horizontalLine": return a.y == null ? null : line(-EDGE_OVERSCAN, a.y, width + EDGE_OVERSCAN, a.y);
        case "horizontalRay": return a.x == null ? null : line(a.x, a.y!, width + EDGE_OVERSCAN, a.y!);
        case "verticalLine": return a.x == null ? null : line(a.x, -EDGE_OVERSCAN, a.x, height + EDGE_OVERSCAN);
        case "crossLine": return a.x == null ? null : <g>{line(-EDGE_OVERSCAN, a.y!, width + EDGE_OVERSCAN, a.y!)}{line(a.x, -EDGE_OVERSCAN, a.x, height + EDGE_OVERSCAN)}</g>;
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
          return <g>{FIB_RETRACEMENT_LEVELS.map((lv) => {
            const price = p1 + (p0 - p1) * lv.coeff; const ly = toY(price);
            return ly == null ? null : <g key={lv.coeff}>{line(left, ly, right, ly, stroke)}{style.showLabels ? label(left + 2, ly - 2, `${lv.coeff} (${price.toFixed(2)})`, stroke) : null}</g>;
          })}</g>;
        }
        case "fibExtension": {
          if (!b || !c || a.x == null || c.x == null) return null;
          const move = pr[1].price - pr[0].price;
          return <g>{FIB_LEVELS.map((lv) => {
            const price = pr[2].price + move * lv.coeff; const ly = toY(price);
            return ly == null ? null : <g key={lv.coeff}>{line(c.x!, ly, width + EDGE_OVERSCAN, ly, stroke)}{style.showLabels ? label(c.x! + 2, ly - 2, `${lv.coeff} (${price.toFixed(2)})`, stroke) : null}</g>;
          })}</g>;
        }
        case "fibChannel": {
          if (!b || !c || a.x == null || b.x == null || c.y == null) return null;
          const base = projectY(a, b, c); const off = c.y - base;
          return <g>{FIB_LEVELS.slice(0, 7).map((lv) => (
            <g key={lv.coeff}>{line(a.x!, a.y! + off * lv.coeff, b.x!, b.y! + off * lv.coeff, stroke)}</g>
          ))}</g>;
        }
        case "fibTimeZone": {
          if (!b || a.x == null || b.x == null) return null;
          const step = pr[1].time - pr[0].time;
          return <g>{FIB_TIME_COEFFS.map((coeff) => {
            const vx = toX(pr[0].time + step * coeff);
            return vx == null ? null : <g key={coeff}>{line(vx, -EDGE_OVERSCAN, vx, height + EDGE_OVERSCAN, "#2962FF")}{style.showLabels ? label(vx + 2, 12, String(coeff)) : null}</g>;
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
          // The zones ARE the theme's two candle colours: on a white-bullish,
          // grey-bearish theme the target zone is white and the risk zone
          // grey. These were pinned to TradingView's green/red, so the
          // calculator was the one tool that never matched the chart.
          const green = themeColor || "#089981";
          const red = themeBearColor || "#F23645";
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
              {/*
                * The readout belongs to the calculator being worked on. Left
                * on permanently it stacked three pills across the chart for
                * every position tool placed, which is what made a few of these
                * unreadable. Deselected, the tool is just its two zones.
                */}
              {style.showLabels && (selected || preview) ? (
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
        case "entryArrow":
        case "exitArrow": {
          // The mark this chart already paints on a real fill: a sideways
          // triangle centred on the fill, pointing RIGHT into an entry and
          // LEFT out of an exit (PaperFillMarkersRenderer). Same shape, same
          // colours, just resizable.
          if (a.x == null || a.y == null) return null;
          const entry = drawing.tool === "entryArrow";
          const marker = fillMarkerGeometry({
            direction: entry ? "right" : "left",
            anchorX: a.x,
            anchorY: a.y,
            handleX: b?.x,
            handleY: b?.y,
            defaultHalfWidth: FILL_MARKER_DEFAULT_HALF_WIDTH_PX,
            defaultHalfHeight: FILL_MARKER_DEFAULT_HALF_HEIGHT_PX,
            minHalfWidth: FILL_MARKER_MIN_HALF_WIDTH_PX,
            minHalfHeight: FILL_MARKER_MIN_HALF_HEIGHT_PX,
          });
          const path = `${marker.points.map(([x, y], index) => `${index ? "L" : "M"}${x},${y}`).join(" ")} Z`;
          return (
            <g>
              <path d={path} fill={stroke} stroke={stroke} strokeWidth={w} strokeLinejoin="round" />
              {style.showLabels === false || !drawing.text
                ? null
                : <text
                    x={entry ? marker.backX - 4 : marker.backX + 4}
                    y={a.y + 3}
                    fill={stroke}
                    fontSize={10}
                    fontFamily="monospace"
                    textAnchor={entry ? "end" : "start"}
                  >{drawing.text}</text>}
            </g>
          );
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
                fill={isPoc ? stroke : inVA ? stroke : outside} fillOpacity={isPoc ? 0.95 : inVA ? 0.62 : 0.32} />;
            })}
            {showPoc && pocY != null ? line(boxLeft, pocY, boxRight, pocY, stroke, 1) : null}
            {showPoc && style.showLabels && pocY != null ? label(boxLeft + 3, pocY - 2, `POC ${prof.poc.toFixed(2)}`, stroke) : null}
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
      <g data-draw-hit="body" style={{ pointerEvents: "all" }}>
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
    const isPositionTool = drawing.tool === "longPosition" || drawing.tool === "shortPosition";
    const positionCorners = isPositionTool && coords.length >= 3
      && coords[0].x != null && coords[1].x != null && coords[2].x != null
      && coords[0].y != null && coords[1].y != null && coords[2].y != null
      ? (() => {
        const leftX = Math.min(coords[0].x as number, coords[1].x as number);
        const rightX = Math.max(coords[0].x as number, coords[1].x as number, coords[2].x as number);
        const stopY = coords[1].y as number;
        const targetY = coords[2].y as number;
        return [
          { id: "ls", x: leftX, y: stopY, side: "left" as const, edge: "stop" as const },
          { id: "rs", x: rightX, y: stopY, side: "right" as const, edge: "stop" as const },
          { id: "lt", x: leftX, y: targetY, side: "left" as const, edge: "target" as const },
          { id: "rt", x: rightX, y: targetY, side: "right" as const, edge: "target" as const },
        ];
      })()
      : null;
    // One handle, at the point of the triangle. Anywhere closer would sit
    // under the anchor dot and be unreachable.
    const fillMarkerHandle = (drawing.tool === "entryArrow" || drawing.tool === "exitArrow")
      && a.x != null && a.y != null
      ? fillMarkerGeometry({
          direction: drawing.tool === "entryArrow" ? "right" : "left",
          anchorX: a.x,
          anchorY: a.y,
          handleX: b?.x,
          handleY: b?.y,
          defaultHalfWidth: FILL_MARKER_DEFAULT_HALF_WIDTH_PX,
          defaultHalfHeight: FILL_MARKER_DEFAULT_HALF_HEIGHT_PX,
          minHalfWidth: FILL_MARKER_MIN_HALF_WIDTH_PX,
          minHalfHeight: FILL_MARKER_MIN_HALF_HEIGHT_PX,
        })
      : null;
    /**
     * A grab handle: a small visible dot with a much larger invisible target.
     *
     * The dots were bare r=4.5 circles, so the grabbable region ended about
     * six pixels from their centre — measured. Aim for one and land seven
     * pixels out and the pointer instead hit the body layer underneath, which
     * MOVES the drawing. So a resize silently became a drag, on every tool
     * that has handles. The dot still draws at 4.5 so nothing looks different;
     * the transparent circle around it is what the pointer actually catches.
     */
    const grabHandle = (
      key: string,
      x: number,
      y: number,
      cursor: string,
      onGrab: (event: ReactPointerEvent) => void,
    ) => (
      <g key={key} data-draw-hit="handle" style={{ pointerEvents: "all", cursor }} onPointerDown={onGrab}>
        <circle cx={x} cy={y} r={HANDLE_HIT_RADIUS_PX} fill="transparent" />
        <circle cx={x} cy={y} r={HANDLE_DOT_RADIUS_PX} fill="#fff" stroke={stroke} strokeWidth={1.5} />
      </g>
    );

    const handles = !selected
      ? null
      : fillMarkerHandle
      ? grabHandle(
        "fill-marker",
        fillMarkerHandle.tipX,
        a.y as number,
        "ew-resize",
        (event) => beginFillMarkerResize(drawing, event),
      )
      : positionCorners
        ? positionCorners.map((corner) => grabHandle(
          `c${corner.id}`,
          corner.x,
          corner.y,
          "nwse-resize",
          (event) => beginPositionCornerDrag(drawing, { side: corner.side, edge: corner.edge }, event),
        ))
        // A pencil or highlighter stroke is hundreds of sampled points, and a
        // grab dot on every one of them buries the stroke under its own
        // handles. Only the two that mean anything are offered: where the
        // stroke started and where it ended.
        : (DRAW_TOOL_SPECS[drawing.tool].points === "freehand" && valid.length > 2
          ? [{ point: valid[0], index: 0 }, { point: valid[valid.length - 1], index: drawing.points.length - 1 }]
          : valid.map((point, index) => ({ point, index }))
        ).map(({ point, index }) => grabHandle(
          `h${index}`,
          point.x,
          point.y,
          "grab",
          (event) => beginDrag(drawing, index, event),
        ));
    return (
      <g
        key={drawing.id}
        data-draw-hit={interactive ? "drawing" : undefined}
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
      {/*
        * The chart's right edge. Drawings are chart content, so they end
        * where the candles end and slide under the price scale rather than
        * painting across it — a trend line or a rectangle running over the
        * prices is the chart's own axis being covered by something drawn on
        * it. Generous vertically so nothing is clipped at the top or bottom.
        */}
      <defs>
        <clipPath id={plotClipId}>
          <rect
            x={-EDGE_OVERSCAN}
            y={-EDGE_OVERSCAN}
            width={Math.max(0, width - priceScaleWidth) + EDGE_OVERSCAN}
            height={height + EDGE_OVERSCAN * 2}
          />
        </clipPath>
      </defs>
      {/*
        * The placement surface sits UNDER the drawings, not over them.
        *
        * SVG paints in document order, so while it was rendered last it was the
        * top-most thing in the layer and swallowed every press. That was fine
        * for placing a new drawing on empty chart and wrong for everything
        * else: a press on a selected drawing's resize handle never reached the
        * handle at all. It landed here, ran the hit test below, and that test
        * only knows a drawing's RAW POINTS — a position calculator's four
        * visible corners are computed geometry, not points, so it could never
        * match one. The miss fell through to onSelect(null), the handles
        * unmounted under the cursor, and the resize died before it started.
        *
        * Underneath, the ordering does the work: drawings are pointerEvents
        * "none" while a tool is armed, so an empty press still reaches this
        * rect and places normally, while handles — which are always "all" —
        * get the presses that land on them.
        */}
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
      {/*
        * non-scaling-stroke keeps line weight true while the group carries a
        * pan's small rescale, so a drawing cannot thicken as the chart moves.
        */}
      <g ref={drawingsGroupRef} vectorEffect="non-scaling-stroke" clipPath={`url(#${plotClipId})`}>
        {drawings.map((drawing) => renderDrawing(drawing))}
        {previewDrawing ? renderDrawing(previewDrawing, true) : null}
      </g>
    </svg>
  );
}

function previewStyle(tool: DrawToolId) {
  const base = { color: "#2962FF", width: 2, lineStyle: "solid" as DrawLineStyle, fillOpacity: 0.12, showLabels: true };
  if (tool === "highlighter") return { ...base, color: "#FFEB3B", width: 4, fillOpacity: 0.25 };
  // Matches defaultStyleFor: the calculators are placed without their readout.
  if (tool === "longPosition" || tool === "shortPosition") {
    return { ...base, showLabels: false };
  }
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

/**
 * How far past the pane edge-anchored geometry is drawn.
 *
 * Panning does not redraw this layer — it puts a compensating translate on the
 * whole drawing group, which is exact for a shape anchored at both ends in
 * price and time. Anything that runs to the EDGE of the pane is not: a
 * horizontal ray, a vertical line, a fib extension's rails, a fib time zone's
 * verticals and every extended ray all pull away from the edge they are
 * supposed to touch, which is the drifting the trader sees while moving the
 * chart. Drawing them well past the edge means the translate can never expose
 * an end; the <svg> root clips at its own width and height, so the overspill
 * costs nothing on screen.
 *
 * A pan larger than this in one frame falls back to a real redraw, so the
 * margin sets the cost, not the correctness.
 */
const EDGE_OVERSCAN = 2000;

/**
 * Default and minimum geometry for the entry/exit fill markers, in pixels.
 *
 * Pixels rather than price: a fill marker is an annotation on the screen and
 * should read the same size at every zoom and on every instrument, exactly as
 * the real one does.
 */
// The real marker is 12x8 around the fill. The drawn one starts a little
// larger so it is easy to grab, keeping the same 3:2 proportion, and scales
// from there.
const FILL_MARKER_DEFAULT_HALF_WIDTH_PX = 9;
const FILL_MARKER_DEFAULT_HALF_HEIGHT_PX = 6;
/** Below these it stops being legible, or grabbable. */
const FILL_MARKER_MIN_HALF_WIDTH_PX = 4;
const FILL_MARKER_MIN_HALF_HEIGHT_PX = 3;

/**
 * Grab handles: what is drawn, and what the pointer can actually catch.
 *
 * The visible dot stays small so it does not cover the price action it marks.
 * The target around it is what makes it grabbable — a nine-pixel dot is far
 * below what anyone can hit reliably, and missing it does not do nothing, it
 * drags the whole drawing instead.
 */
const HANDLE_DOT_RADIUS_PX = 4.5;
const HANDLE_HIT_RADIUS_PX = 11;

function extend(x1: number, y1: number, x2: number, y2: number, w: number, h: number) {
  const dx = x2 - x1; const dy = y2 - y1;
  if (dx === 0 && dy === 0) return { x: x2, y: y2 };
  // Clipped to the overscanned box rather than the pane, so an extended ray
  // still reaches the edge after a pan translate.
  const left = -EDGE_OVERSCAN;
  const top = -EDGE_OVERSCAN;
  const right = w + EDGE_OVERSCAN;
  const bottom = h + EDGE_OVERSCAN;
  const tx = dx > 0 ? (right - x1) / dx : dx < 0 ? (left - x1) / dx : Infinity;
  const ty = dy > 0 ? (bottom - y1) / dy : dy < 0 ? (top - y1) / dy : Infinity;
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
