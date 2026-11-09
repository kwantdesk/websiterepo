import type { DrawToolId } from "./chartDrawTools";

export const LINE_TEXT_TOOLS: ReadonlySet<DrawToolId> = new Set([
  "trendLine", "ray", "extendedLine", "trendAngle", "infoLine",
  "horizontalLine", "horizontalRay", "verticalLine", "crossLine",
  "parallelChannel", "flatChannel", "regressionTrend", "forecast",
  "polyline", "path", "brush", "highlighter",
]);

type ScreenPoint = { x: number | null; y: number | null };

/** Use the actual starting anchor, never a viewport-edge substitute. Font size
 * and offset are screen pixels; zoom only changes the anchor and line angle. */
export function lineTextGeometry(tool: DrawToolId, points: ScreenPoint[], value?: string) {
  const text = value?.replace(/\s+/g, " ").trim();
  const start = points[0];
  if (!LINE_TEXT_TOOLS.has(tool) || !text || !start
    || start.x === null || start.y === null
    || !Number.isFinite(start.x) || !Number.isFinite(start.y)) return null;
  const next = points.find((point, index) => index > 0 && point.x !== null && point.y !== null
    && Number.isFinite(point.x) && Number.isFinite(point.y)
    && (point.x !== start.x || point.y !== start.y));
  const horizontal = tool === "horizontalLine" || tool === "horizontalRay" || tool === "crossLine";
  const angle = tool === "verticalLine" ? -90 : horizontal || !next ? 0
    : Math.atan2(next.y! - start.y, next.x! - start.x) * 180 / Math.PI;
  const radians = angle * Math.PI / 180;
  const reversed = angle > 90 || angle < -90;
  return {
    text,
    x: start.x + Math.cos(radians) * 4 + Math.sin(radians) * 4,
    y: start.y + Math.sin(radians) * 4 - Math.cos(radians) * 4,
    angle: reversed ? angle + (angle > 90 ? -180 : 180) : angle,
    textAnchor: reversed ? "end" as const : "start" as const,
  };
}
