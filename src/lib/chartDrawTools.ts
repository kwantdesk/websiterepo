/**
 * Brand-new charting-tool subsystem, built from the TradingView tool taxonomy
 * (tool names, groupings, point-geometry, and the standard Fibonacci levels).
 * It is deliberately independent of the existing KwantDesk drawing engine:
 * new file, new data model, new overlay renderer, its own top toolbar. Icons
 * are clean-room line art in the same visual language — no TradingView asset
 * is copied.
 */

export type DrawToolId =
  | "cursor"
  | "trendLine"
  | "ray"
  | "extendedLine"
  | "horizontalLine"
  | "horizontalRay"
  | "verticalLine"
  | "rectangle"
  | "fibRetracement"
  | "text";

export type DrawToolGroupId = "cursor" | "trend" | "fib" | "shapes" | "annotation";

export type DrawLineStyle = "solid" | "dashed" | "dotted";

export type DrawStyle = {
  color: string;
  width: number;        // px, 1..4
  lineStyle: DrawLineStyle;
  fillOpacity: number;  // 0..1, used by shapes
  showLabels: boolean;
};

export const DEFAULT_DRAW_STYLE: DrawStyle = {
  color: "#2962FF",
  width: 2,
  lineStyle: "solid",
  fillOpacity: 0.12,
  showLabels: true,
};

export type DrawToolSpec = {
  id: DrawToolId;
  group: DrawToolGroupId;
  label: string;
  points: number;          // anchors required to finish the drawing
  overlay?: boolean;       // reserved
};

export const DRAW_TOOL_SPECS: Record<DrawToolId, DrawToolSpec> = {
  cursor: { id: "cursor", group: "cursor", label: "Cursor", points: 0 },
  trendLine: { id: "trendLine", group: "trend", label: "Trend Line", points: 2 },
  ray: { id: "ray", group: "trend", label: "Ray", points: 2 },
  extendedLine: { id: "extendedLine", group: "trend", label: "Extended Line", points: 2 },
  horizontalLine: { id: "horizontalLine", group: "trend", label: "Horizontal Line", points: 1 },
  horizontalRay: { id: "horizontalRay", group: "trend", label: "Horizontal Ray", points: 1 },
  verticalLine: { id: "verticalLine", group: "trend", label: "Vertical Line", points: 1 },
  rectangle: { id: "rectangle", group: "shapes", label: "Rectangle", points: 2 },
  fibRetracement: { id: "fibRetracement", group: "fib", label: "Fib Retracement", points: 2 },
  text: { id: "text", group: "annotation", label: "Text", points: 1 },
};

// Standard Fibonacci retracement levels and TradingView's conventional colour
// per level (well-known values, reproduced as facts).
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
];

export type DrawPoint = { time: number; price: number };

export type Drawing = {
  id: string;
  tool: DrawToolId;
  points: DrawPoint[];
  style: DrawStyle;
  text?: string;
};

export function createDrawing(tool: DrawToolId, points: DrawPoint[], text?: string): Drawing {
  return {
    id: `draw-${crypto.randomUUID()}`,
    tool,
    points,
    style: { ...DEFAULT_DRAW_STYLE },
    text,
  };
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
    if (points.length < spec.points) continue;
    const style = candidate.style && typeof candidate.style === "object"
      ? { ...DEFAULT_DRAW_STYLE, ...candidate.style }
      : { ...DEFAULT_DRAW_STYLE };
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
