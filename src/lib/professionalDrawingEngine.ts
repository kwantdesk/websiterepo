import type { Time } from "lightweight-charts";

import {
  DrawingManager,
  getToolRegistry,
  type Anchor,
  type DrawingOptions,
  type DrawingStyle,
  type IDrawing,
  type SerializedDrawing,
} from "@/vendor/lightweight-charts-drawing";
import {
  KwantToolDrawing,
  type KwantMarketDataSource,
} from "@/vendor/lightweight-charts-drawing/tools/kwant/kwant-tool-drawing";

/**
 * Maps the existing KwantDesk toolbar vocabulary to the canvas-native drawing
 * registry. Unsupported product actions deliberately have no mapping; they are
 * not presented as working drawing tools.
 */
export const PROFESSIONAL_DRAWING_TYPE_BY_TOOL: Readonly<Record<string, string>> = {
  trendLine: "trend-line",
  ray: "ray",
  infoLine: "info-line",
  extendedLine: "extended-line",
  trendAngle: "trend-angle",
  horizontalLine: "horizontal-line",
  horizontalRay: "horizontal-ray",
  verticalLine: "vertical-line",
  crossLine: "cross-line",
  parallelChannel: "parallel-channel",
  priceChannel: "price-channel",
  highlightX: "highlight-x",
  highlightY: "highlight-y",
  regressionTrend: "regression-trend",
  flatTopBottom: "flat-top-bottom",
  disjointChannel: "disjoint-channel",
  pitchfork: "andrews-pitchfork",
  schiffPitchfork: "schiff-pitchfork",
  modifiedSchiffPitchfork: "modified-schiff-pitchfork",
  insidePitchfork: "inside-pitchfork",
  fibRetracement: "fib-retracement",
  trendBasedFibExtension: "fib-extension",
  fibChannel: "fib-channel",
  fibTimeZone: "fib-time-zone",
  fibSpeedResistanceFan: "fib-speed-fan",
  trendBasedFibTime: "fib-time-extension",
  fibCircles: "fib-circles",
  fibSpiral: "fib-spiral",
  fibSpeedResistanceArcs: "fib-arcs",
  fibWedge: "fib-wedge",
  pitchfan: "pitchfan",
  fibFan: "fib-fan",
  gannBox: "gann-box",
  gannSquareFixed: "gann-square-fixed",
  gannSquare: "gann-square",
  gannFan: "gann-fan",
  rectangle: "rectangle",
  rotatedRectangle: "rotated-rectangle",
  ellipse: "ellipse",
  circle: "circle",
  path: "path",
  polyline: "polyline",
  triangle: "triangle",
  arc: "arc",
  curve: "curve",
  doubleCurve: "double-curve",
  brush: "brush",
  highlighter: "highlighter",
  arrowMarker: "arrow-marker",
  arrow: "arrow",
  arrowMarkUp: "arrow-mark-up",
  arrowMarkDown: "arrow-mark-down",
  text: "text-annotation",
  label: "label",
  rightPriceLabel: "right-price-label",
  leftPriceLabel: "left-price-label",
  anchoredText: "anchored-text",
  note: "note",
  priceNote: "price-note",
  pin: "pin",
  table: "table",
  callout: "callout",
  comment: "comment",
  priceLabel: "price-label",
  signpost: "signpost",
  flagMark: "flag-mark",
  elliottImpulseWave: "elliott-impulse",
  elliottCorrectionWave: "elliott-correction",
  elliottTriangleWave: "elliott-triangle",
  elliottDoubleComboWave: "elliott-double-combo",
  elliottTripleComboWave: "elliott-triple-combo",
  longPosition: "long-position",
  shortPosition: "short-position",
  positionForecast: "forecast",
  projection: "projection",
  barPattern: "bars-pattern",
  priceRange: "price-range",
  dateRange: "date-range",
  datePriceRange: "date-price-range",
  ruler: "ruler",
  measure: "measure",
  dot: "dot",
  diamond: "diamond",
  square: "square",
  upArrow: "up-arrow",
  downArrow: "down-arrow",
  anchoredVwap: "anchored-vwap",
  dynamicPoc: "dynamic-poc",
  cvdCorrelation: "cvd-correlation",
  marketProfile: "market-profile",
  fixedRangeVolumeProfile: "fixed-market-profile",
  anchoredVolumeProfile: "anchored-market-profile",
  zigzagTpoProfile: "zigzag-tpo-profile",
} as const;

const PROFESSIONAL_TOOL_BY_TYPE = Object.fromEntries(
  Object.entries(PROFESSIONAL_DRAWING_TYPE_BY_TOOL).map(([tool, type]) => [type, tool]),
) as Record<string, string>;

export { DrawingManager };
export type { Anchor, DrawingStyle, IDrawing, SerializedDrawing };

export function professionalDrawingType(tool: string): string | null {
  return PROFESSIONAL_DRAWING_TYPE_BY_TOOL[tool] ?? null;
}

export function professionalToolbarTool(type: string): string | null {
  return PROFESSIONAL_TOOL_BY_TYPE[type] ?? null;
}

export function isProfessionalDrawingTool(tool: string): boolean {
  const type = professionalDrawingType(tool);
  return Boolean(type && getToolRegistry().has(type));
}

export function requiredProfessionalAnchors(tool: string): number {
  const type = professionalDrawingType(tool);
  return type ? getToolRegistry().get(type)?.requiredAnchors ?? 2 : 0;
}

export function createProfessionalDrawing(args: {
  tool: string;
  id: string;
  anchors: Anchor[];
  style?: Partial<DrawingStyle>;
  options?: Partial<DrawingOptions>;
}): IDrawing | null {
  const type = professionalDrawingType(args.tool);
  if (!type) return null;
  return getToolRegistry().createDrawing(type, args.id, args.anchors, args.style, args.options);
}

export function drawingFromSerialized(record: SerializedDrawing): IDrawing | null {
  const drawing = getToolRegistry().createDrawing(
    record.type,
    record.id,
    record.anchors,
    record.style,
    record.options,
  );
  if (drawing) drawing.fromJSON(record);
  return drawing;
}

export function configureProfessionalDrawingMarketData(
  drawing: IDrawing,
  source: KwantMarketDataSource,
): IDrawing {
  if (drawing instanceof KwantToolDrawing) drawing.setMarketDataSource(source);
  return drawing;
}

export type { KwantMarketDataSource };

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function validAnchor(value: unknown): Anchor | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { time?: unknown; price?: unknown };
  const time = finiteNumber(candidate.time);
  const price = finiteNumber(candidate.price);
  return time === null || price === null ? null : { time: time as Time, price };
}

function normalizeNativeRecord(value: unknown): SerializedDrawing | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SerializedDrawing>;
  if (typeof candidate.id !== "string" || typeof candidate.type !== "string") return null;
  if (!getToolRegistry().has(candidate.type) || !Array.isArray(candidate.anchors)) return null;
  const anchors = candidate.anchors.map(validAnchor).filter((anchor): anchor is Anchor => Boolean(anchor));
  if (anchors.length !== candidate.anchors.length) return null;
  return {
    id: candidate.id,
    type: candidate.type,
    anchors,
    style: {
      lineColor: candidate.style?.lineColor ?? "#8B5CF6",
      lineWidth: candidate.style?.lineWidth ?? 2,
      lineDash: candidate.style?.lineDash ?? [],
      fillColor: candidate.style?.fillColor ?? "rgba(139,92,246,0.12)",
      fillOpacity: candidate.style?.fillOpacity ?? 0.12,
      showLabels: candidate.style?.showLabels ?? true,
      labelFont: candidate.style?.labelFont ?? "12px 'JetBrains Mono', monospace",
      labelColor: candidate.style?.labelColor ?? candidate.style?.lineColor ?? "#8B5CF6",
    },
    options: {
      visible: candidate.options?.visible !== false,
      baseVisible: candidate.options?.baseVisible ?? candidate.options?.visible !== false,
      locked: candidate.options?.locked === true,
      zIndex: candidate.options?.zIndex ?? 0,
      extendLeft: candidate.options?.extendLeft === true,
      extendRight: candidate.options?.extendRight === true,
      timeframes: Array.isArray(candidate.options?.timeframes)
        ? candidate.options.timeframes.filter((value): value is string => typeof value === "string")
        : undefined,
      templateId: typeof candidate.options?.templateId === "string" ? candidate.options.templateId : undefined,
      text: typeof candidate.options?.text === "string" ? candidate.options.text : undefined,
      fontSize: finiteNumber(candidate.options?.fontSize) ?? undefined,
      fontFamily: typeof candidate.options?.fontFamily === "string" ? candidate.options.fontFamily : undefined,
      fontWeight: typeof candidate.options?.fontWeight === "string" ? candidate.options.fontWeight : undefined,
      textAlign: candidate.options?.textAlign,
      backgroundColor: typeof candidate.options?.backgroundColor === "string" ? candidate.options.backgroundColor : undefined,
      borderColor: typeof candidate.options?.borderColor === "string" ? candidate.options.borderColor : undefined,
      padding: finiteNumber(candidate.options?.padding) ?? undefined,
    },
  };
}

/** Converts the former SVG payload once, preserving the user's time and price anchors. */
function migrateLegacyRecord(value: unknown): SerializedDrawing | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as {
    id?: unknown;
    tool?: unknown;
    points?: unknown;
    color?: unknown;
  };
  if (typeof candidate.id !== "string" || typeof candidate.tool !== "string") return null;
  const type = professionalDrawingType(candidate.tool);
  if (!type || !Array.isArray(candidate.points)) return null;
  const anchors = candidate.points.map(validAnchor).filter((anchor): anchor is Anchor => Boolean(anchor));
  if (!anchors.length || anchors.length !== candidate.points.length) return null;

  const required = getToolRegistry().get(type)?.requiredAnchors ?? 2;
  while (anchors.length < required) {
    const entry = anchors[0];
    const stop = anchors[1] ?? entry;
    const risk = Math.max(Math.abs(entry.price - stop.price), 1);
    const isShort = candidate.tool === "shortPosition";
    anchors.push({
      time: stop.time,
      price: isShort ? entry.price - risk * 2 : entry.price + risk * 2,
    });
  }
  if (anchors.length > required) anchors.length = required;

  const color = typeof candidate.color === "string" ? candidate.color : "#8B5CF6";
  return {
    id: candidate.id,
    type,
    anchors,
    style: {
      lineColor: color,
      lineWidth: 2,
      lineDash: [],
      fillColor: "rgba(139,92,246,0.12)",
      fillOpacity: 0.12,
      showLabels: true,
      labelFont: "12px 'JetBrains Mono', monospace",
      labelColor: color,
    },
    options: { visible: true, baseVisible: true, locked: false, zIndex: 0 },
  };
}

export function normalizeProfessionalDrawings(value: unknown): SerializedDrawing[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    const record = normalizeNativeRecord(item) ?? migrateLegacyRecord(item);
    if (!record || seen.has(record.id)) return [];
    seen.add(record.id);
    return [record];
  });
}
