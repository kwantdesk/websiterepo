/**
 * Brand-new charting-tool subsystem, built from the TradingView tool taxonomy
 * (tool names, groupings, point-geometry, and the standard Fibonacci levels).
 * It is deliberately independent of the existing KwantDesk drawing engine:
 * new file, new data model, new overlay renderer, its own top toolbar. Icons
 * are clean-room line art in the same visual language — no TradingView asset
 * is copied.
 */

export type DrawToolId =
  // cursors
  | "cursor"
  | "eraser"
  // trend / lines
  | "trendLine"
  | "ray"
  | "extendedLine"
  | "trendAngle"
  | "infoLine"
  | "horizontalLine"
  | "horizontalRay"
  | "verticalLine"
  | "crossLine"
  | "parallelChannel"
  | "flatChannel"
  | "regressionTrend"
  // gann & pitchfork
  | "gannFan"
  | "gannBox"
  | "pitchfork"
  | "schiffPitchfork"
  | "modifiedSchiffPitchfork"
  | "insidePitchfork"
  // fib
  | "fibRetracement"
  | "fibExtension"
  | "fibChannel"
  | "fibTimeZone"
  | "fibCircles"
  | "fibSpeedFan"
  // patterns
  | "xabcd"
  | "abcd"
  | "trianglePattern"
  | "headShoulders"
  | "threeDrivers"
  | "cypher"
  | "elliottImpulse"
  | "elliottCorrection"
  // forecast / measurement
  | "longPosition"
  | "shortPosition"
  | "forecast"
  | "priceRange"
  | "dateRange"
  | "datePriceRange"
  | "barsPattern"
  // volume
  | "fixedRangeVolumeProfile"
  | "anchoredVolumeProfile"
  | "anchoredVwap"
  // shapes
  | "rectangle"
  | "rotatedRectangle"
  | "ellipse"
  | "circle"
  | "triangleShape"
  | "polyline"
  | "path"
  | "brush"
  | "highlighter"
  // annotation
  | "text"
  | "note"
  | "callout"
  | "priceLabel"
  | "signpost"
  | "arrowMarker"
  | "flagMark"
  // measure
  | "measure";

export type DrawToolGroupId =
  | "cursor"
  | "trend"
  | "gann"
  | "fib"
  | "patterns"
  | "forecast"
  | "volume"
  | "shapes"
  | "annotation"
  | "measure";

export type DrawLineStyle = "solid" | "dashed" | "dotted";

export type DrawStyle = {
  color: string;
  width: number;        // px, 1..4
  lineStyle: DrawLineStyle;
  fillOpacity: number;  // 0..1, used by shapes
  showLabels: boolean;
  fontSize?: number;    // text tools
  visible?: boolean;    // hide without deleting
  // Volume-profile tools (fixed range / anchored). Optional so drawings saved
  // before these settings existed keep rendering with the defaults.
  profileRows?: number;        // row count, 20..200 (default 80)
  valueAreaPercent?: number;   // 50..95 (default 70)
  showPoc?: boolean;           // POC line + label (default true)
  outsideColor?: string;       // rows outside the value area (default #787B86)
  profileWidthPercent?: number; // widest row as % of the range width, 10..80
};

export const DEFAULT_DRAW_STYLE: DrawStyle = {
  color: "#2962FF",
  width: 2,
  lineStyle: "solid",
  fillOpacity: 0.12,
  showLabels: true,
  fontSize: 13,
  visible: true,
};

// pointsMode: fixed number, or a freehand/multi behaviour.
export type DrawPointsMode = number | "freehand" | "poly";

export type DrawToolSpec = {
  id: DrawToolId;
  group: DrawToolGroupId;
  label: string;
  points: DrawPointsMode;
};

const T = (id: DrawToolId, group: DrawToolGroupId, label: string, points: DrawPointsMode): DrawToolSpec =>
  ({ id, group, label, points });

export const DRAW_TOOL_LIST: DrawToolSpec[] = [
  T("cursor", "cursor", "Cursor", 0),
  T("eraser", "cursor", "Eraser", 0),

  T("trendLine", "trend", "Trend Line", 2),
  T("ray", "trend", "Ray", 2),
  T("extendedLine", "trend", "Extended Line", 2),
  T("trendAngle", "trend", "Trend Angle", 2),
  T("infoLine", "trend", "Info Line", 2),
  T("horizontalLine", "trend", "Horizontal Line", 1),
  T("horizontalRay", "trend", "Horizontal Ray", 1),
  T("verticalLine", "trend", "Vertical Line", 1),
  T("crossLine", "trend", "Cross Line", 1),
  T("parallelChannel", "trend", "Parallel Channel", 3),
  T("flatChannel", "trend", "Flat Channel", 3),
  T("regressionTrend", "trend", "Regression Trend", 2),

  T("gannFan", "gann", "Gann Fan", 2),
  T("gannBox", "gann", "Gann Box", 2),
  T("pitchfork", "gann", "Pitchfork", 3),
  T("schiffPitchfork", "gann", "Schiff Pitchfork", 3),
  T("modifiedSchiffPitchfork", "gann", "Modified Schiff Pitchfork", 3),
  T("insidePitchfork", "gann", "Inside Pitchfork", 3),

  T("fibRetracement", "fib", "Fib Retracement", 2),
  T("fibExtension", "fib", "Trend-Based Fib Extension", 3),
  T("fibChannel", "fib", "Fib Channel", 3),
  T("fibTimeZone", "fib", "Fib Time Zone", 2),
  T("fibCircles", "fib", "Fib Circles", 2),
  T("fibSpeedFan", "fib", "Fib Speed/Resistance Fan", 2),

  T("xabcd", "patterns", "XABCD Pattern", 5),
  T("abcd", "patterns", "ABCD Pattern", 4),
  T("trianglePattern", "patterns", "Triangle Pattern", 4),
  T("headShoulders", "patterns", "Head & Shoulders", 5),
  T("threeDrivers", "patterns", "Three Drivers", 7),
  T("cypher", "patterns", "Cypher Pattern", 5),
  T("elliottImpulse", "patterns", "Elliott Impulse (12345)", 6),
  T("elliottCorrection", "patterns", "Elliott Correction (ABC)", 4),

  // TradingView-style: one click places the tool with default target/stop
  // zones; the three stored points (entry, stop+right edge, target) are
  // synthesized at commit time and then adjusted by dragging their handles.
  T("longPosition", "forecast", "Long Position", 1),
  T("shortPosition", "forecast", "Short Position", 1),
  T("forecast", "forecast", "Forecast", 2),
  T("priceRange", "forecast", "Price Range", 2),
  T("dateRange", "forecast", "Date Range", 2),
  T("datePriceRange", "forecast", "Date & Price Range", 2),
  T("barsPattern", "forecast", "Bars Pattern", 2),

  T("fixedRangeVolumeProfile", "volume", "Fixed Range Volume Profile", 2),
  T("anchoredVolumeProfile", "volume", "Anchored Volume Profile", 1),
  T("anchoredVwap", "volume", "Anchored VWAP", 1),

  T("rectangle", "shapes", "Rectangle", 2),
  T("rotatedRectangle", "shapes", "Rotated Rectangle", 3),
  T("ellipse", "shapes", "Ellipse", 2),
  T("circle", "shapes", "Circle", 2),
  T("triangleShape", "shapes", "Triangle", 3),
  T("polyline", "shapes", "Polyline", "poly"),
  T("path", "shapes", "Path", "poly"),
  T("brush", "shapes", "Brush", "freehand"),
  T("highlighter", "shapes", "Highlighter", "freehand"),

  T("text", "annotation", "Text", 1),
  T("note", "annotation", "Note", 1),
  T("callout", "annotation", "Callout", 2),
  T("priceLabel", "annotation", "Price Label", 1),
  T("signpost", "annotation", "Signpost", 2),
  T("arrowMarker", "annotation", "Arrow", 2),
  T("flagMark", "annotation", "Flag", 1),

  T("measure", "measure", "Measure", 2),
];

export const DRAW_TOOL_SPECS: Record<DrawToolId, DrawToolSpec> = Object.fromEntries(
  DRAW_TOOL_LIST.map((spec) => [spec.id, spec]),
) as Record<DrawToolId, DrawToolSpec>;

export const DRAW_TOOL_GROUPS: { id: DrawToolGroupId; label: string }[] = [
  { id: "cursor", label: "Cursor" },
  { id: "trend", label: "Lines" },
  { id: "gann", label: "Gann" },
  { id: "fib", label: "Fib" },
  { id: "patterns", label: "Patterns" },
  { id: "forecast", label: "Forecast" },
  { id: "volume", label: "Volume" },
  { id: "shapes", label: "Shapes" },
  { id: "annotation", label: "Text" },
  { id: "measure", label: "Measure" },
];

// Standard Fibonacci levels and TradingView's conventional colour per level.
export type FibLevel = { coeff: number; color: string };
export const FIB_LEVELS: FibLevel[] = [
  { coeff: 0, color: "#787B86" },
  { coeff: 0.236, color: "#F23645" },
  { coeff: 0.382, color: "#FF9800" },
  { coeff: 0.5, color: "#4CAF50" },
  { coeff: 0.618, color: "#089981" },
  { coeff: 0.786, color: "#00BCD4" },
  { coeff: 1, color: "#787B86" },
  { coeff: 1.618, color: "#2962FF" },
  { coeff: 2.618, color: "#F23645" },
  { coeff: 3.618, color: "#9C27B0" },
  { coeff: 4.236, color: "#787B86" },
];

export const FIB_TIME_COEFFS = [0, 1, 2, 3, 5, 8, 13, 21, 34];
export const FIB_CIRCLE_COEFFS = [0.236, 0.382, 0.5, 0.618, 1];

export type DrawPoint = { time: number; price: number };

export type Drawing = {
  id: string;
  tool: DrawToolId;
  points: DrawPoint[];
  style: DrawStyle;
  text?: string;
};

const defaultStyleFor = (tool: DrawToolId): DrawStyle => {
  if (tool === "highlighter") return { ...DEFAULT_DRAW_STYLE, color: "#FFEB3B", width: 4, fillOpacity: 0.25 };
  if (tool === "longPosition") return { ...DEFAULT_DRAW_STYLE, color: "#089981" };
  if (tool === "shortPosition") return { ...DEFAULT_DRAW_STYLE, color: "#F23645" };
  if (tool === "text" || tool === "note" || tool === "callout" || tool === "priceLabel" || tool === "signpost" || tool === "flagMark") {
    return { ...DEFAULT_DRAW_STYLE, color: "#EAB308" };
  }
  return { ...DEFAULT_DRAW_STYLE };
};

export function createDrawing(tool: DrawToolId, points: DrawPoint[], text?: string): Drawing {
  return { id: `draw-${crypto.randomUUID()}`, tool, points, style: defaultStyleFor(tool), text };
}

export function normalizeDrawings(value: unknown): Drawing[] {
  if (!Array.isArray(value)) return [];
  const out: Drawing[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as Partial<Drawing>;
    const spec = candidate.tool ? DRAW_TOOL_SPECS[candidate.tool] : undefined;
    if (!spec || typeof candidate.id !== "string" || !Array.isArray(candidate.points)) continue;
    const points = candidate.points
      .filter((point): point is DrawPoint => Boolean(point)
        && Number.isFinite(Number((point as DrawPoint).time))
        && Number.isFinite(Number((point as DrawPoint).price)))
      .map((point) => ({ time: Number(point.time), price: Number(point.price) }));
    const minPoints = typeof spec.points === "number" ? spec.points : 2;
    if (points.length < minPoints) continue;
    const style = candidate.style && typeof candidate.style === "object"
      ? { ...defaultStyleFor(candidate.tool!), ...candidate.style }
      : defaultStyleFor(candidate.tool!);
    out.push({
      id: candidate.id,
      tool: candidate.tool!,
      points,
      style,
      text: typeof candidate.text === "string" ? candidate.text : undefined,
    });
  }
  return out;
}
