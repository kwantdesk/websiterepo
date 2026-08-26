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
  // trade marks
  | "entryArrow"
  | "exitArrow"
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
  | "draw"
  | "eraser"
  | "trend"
  | "gann"
  | "fib"
  | "patterns"
  | "forecast"
  | "trade"
  | "volume"
  | "shapes"
  | "annotation"
  | "measure";

/**
 * Magnet strength. Weak only takes a point that is already almost on the
 * level, so ordinary drawing is unaffected; strong reaches out and is for
 * deliberately pinning to wicks. Weak is first because it is the default and
 * the one that does not surprise you mid-drawing.
 */
export type MagnetStrength = "weak" | "strong";

export const MAGNET_STRENGTHS: {
  id: MagnetStrength;
  label: string;
  /** How close, in pixels, a point must come before it snaps. */
  radiusPx: number;
  /** How far it must travel to break a snap it already holds. */
  releasePx: number;
}[] = [
  { id: "weak", label: "Weak magnet", radiusPx: 9, releasePx: 15 },
  { id: "strong", label: "Strong magnet", radiusPx: 26, releasePx: 40 },
];

export const DEFAULT_MAGNET_STRENGTH: MagnetStrength = "weak";

export const magnetStrengthSpec = (strength: MagnetStrength) =>
  MAGNET_STRENGTHS.find((entry) => entry.id === strength) ?? MAGNET_STRENGTHS[0];

export type DrawLineStyle = "solid" | "dashed" | "dotted";

export type DrawStyle = {
  /**
   * Only consulted once the trader has picked a colour of their own. Until
   * then `useThemeColor` keeps the drawing on the theme's bullish candle, so
   * every tool on the left rail matches the chart it is drawn on.
   */
  color: string;
  /**
   * True until the trader chooses a colour. Absent on drawings saved before
   * the theme followed the tools, which is why the check is `!== false`.
   */
  useThemeColor?: boolean;
  width: number;        // px, 0.5..4
  lineStyle: DrawLineStyle;
  fillOpacity: number;  // 0..1, used by shapes
  showLabels: boolean;
  fontSize?: number;    // text tools
  visible?: boolean;    // hide without deleting
  /** Stamped by migrateDrawStyle so the width halving runs exactly once. */
  styleVersion?: number;
  // Volume-profile tools (fixed range / anchored). Optional so drawings saved
  // before these settings existed keep rendering with the defaults.
  profileRows?: number;        // row count, 20..200 (default 80)
  valueAreaPercent?: number;   // 50..95 (default 70)
  showPoc?: boolean;           // POC line + label (default true)
  outsideColor?: string;       // rows outside the value area (default #787B86)
  profileWidthPercent?: number; // widest row as % of the range width, 10..80
  /**
   * Long/Short position zones. The profit and risk bands were pinned to the
   * theme's two candle colours with no way to override them, so a desk that
   * runs a monochrome or white-bullish theme could not make the calculator
   * read red-and-green — the one place a trader most wants those two colours
   * to be unambiguous.
   *
   * Absent means "follow the theme", which is what every existing drawing and
   * every new one does until the trader picks. Saving a style template
   * captures them like any other style field.
   */
  profitColor?: string;
  lossColor?: string;
};

export const DRAW_STYLE_SCHEMA_VERSION = 2;

export const DEFAULT_DRAW_STYLE: DrawStyle = {
  color: "#2962FF",
  useThemeColor: true,
  styleVersion: DRAW_STYLE_SCHEMA_VERSION,
  // Halved. Every tool on the rail drew at 2px, which reads as heavy against
  // candles and buries the price action under its own annotation.
  width: 1,
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
  T("eraser", "eraser", "Eraser", 0),
  T("brush", "draw", "Pencil", "freehand"),
  T("highlighter", "draw", "Highlighter", "freehand"),

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
  // One click drops the arrow on the bar; the two handles then set how far it
  // reaches and how wide it is. Placed like the position calculators rather
  // than as a two-click line, because a fill is a single point in the market.
  T("entryArrow", "trade", "Entry Arrow", 1),
  T("exitArrow", "trade", "Exit Arrow", 1),

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
  // Pencil and eraser sit on the rail in their own right. The rail renders one
  // button per group, so while the pencil lived in Shapes and the eraser in
  // Cursor they were both a chevron and a flyout away — unusable for the two
  // actions reached most often while marking a chart up.
  { id: "draw", label: "Draw" },
  { id: "eraser", label: "Eraser" },
  { id: "trend", label: "Lines" },
  { id: "gann", label: "Gann" },
  { id: "fib", label: "Fib" },
  { id: "patterns", label: "Patterns" },
  { id: "forecast", label: "Forecast" },
  // Its own rail slot: marking an entry and an exit is done constantly while
  // reviewing a chart, and the rail shows one button per group — anything
  // sharing a group with the calculators would be a chevron away.
  { id: "trade", label: "Trade" },
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

/**
 * What a RETRACEMENT draws: the 0-1 range only.
 *
 * A retracement measures how far a move has pulled back, so every level lives
 * between its two anchors. The projections past 1 belong to the Trend-Based
 * Fib Extension tool, which keeps the full list above.
 */
export const FIB_RETRACEMENT_LEVELS: FibLevel[] = FIB_LEVELS.filter(
  (level) => level.coeff >= 0 && level.coeff <= 1,
);

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

/**
 * The colour a drawing is actually painted in.
 *
 * Tools follow the theme's bullish candle until the trader picks a colour of
 * their own, so changing theme restyles every existing drawing rather than
 * leaving a chart of stale blue lines behind. Position calculators resolve
 * their profit and stop zones the same way, from the same two colours.
 */
export function resolveDrawColor(
  style: Pick<DrawStyle, "color" | "useThemeColor"> | undefined,
  themeColor: string | undefined,
): string {
  if (!style) return themeColor || DEFAULT_DRAW_STYLE.color;
  if (style.useThemeColor === false) return style.color;
  return themeColor || style.color || DEFAULT_DRAW_STYLE.color;
}

/**
 * Saved drawings predate both the halved stroke and the theme link, and their
 * style is persisted per drawing rather than read from a live default. Without
 * a migration the trader's existing chart keeps every 2px blue line while only
 * new ones follow the theme.
 *
 * Stamped so it runs once: a trader who deliberately picks 2px afterwards
 * keeps it.
 */
function migrateDrawStyle(saved: Partial<DrawStyle>): Partial<DrawStyle> {
  if (Number(saved.styleVersion ?? 0) >= DRAW_STYLE_SCHEMA_VERSION) return saved;
  const savedWidth = Number(saved.width);
  return {
    ...saved,
    // Only a width the drawing actually carried is halved. Merging the default
    // in first and halving that would drive every style-less drawing to 0.5px.
    ...(Number.isFinite(savedWidth) ? { width: Math.max(0.5, savedWidth / 2) } : {}),
    // An old drawing never had the flag, so it was never an explicit choice.
    useThemeColor: saved.useThemeColor ?? true,
    styleVersion: DRAW_STYLE_SCHEMA_VERSION,
  };
}

/**
 * The colours the chart already uses for a real fill marker, so a drawn entry
 * and a genuine one are the same green and red. These are the values in
 * PaperFillMarkersRenderer, not the backtest series markers, which use a
 * different pair.
 */
export const PAPER_FILL_BUY_COLOR = "#22e887";
export const PAPER_FILL_SELL_COLOR = "#ff3b5c";

const defaultStyleFor = (tool: DrawToolId): DrawStyle => {
  if (tool === "highlighter") return { ...DEFAULT_DRAW_STYLE, color: "#FFEB3B", width: 4, fillOpacity: 0.25 };
  // The calculators land as clean target/risk boxes. Their readout is three
  // stacked pills across the middle of the box; on by default it covers the
  // price action the position is being sized against. Still available from the
  // style panel.
  if (tool === "longPosition" || tool === "shortPosition") {
    return { ...DEFAULT_DRAW_STYLE, showLabels: false };
  }
  // Entry and exit arrows mean the same thing the real fill markers do, so
  // they carry the fill colours rather than the theme's line colour: a green
  // buy and a red sell read identically whichever theme the chart is on.
  // useThemeColor:false is what stops the theme repainting them; the trader
  // can still change either from the style panel.
  if (tool === "entryArrow" || tool === "exitArrow") {
    return {
      ...DEFAULT_DRAW_STYLE,
      color: tool === "entryArrow" ? PAPER_FILL_BUY_COLOR : PAPER_FILL_SELL_COLOR,
      useThemeColor: false,
      width: 1,
      // A real fill marker is a bare triangle with no caption, so the drawn
      // one matches it out of the box. Still available from the style panel.
      showLabels: false,
    };
  }
  if (tool === "text" || tool === "note" || tool === "callout" || tool === "priceLabel" || tool === "signpost" || tool === "flagMark") {
    return { ...DEFAULT_DRAW_STYLE, color: "#EAB308" };
  }
  return { ...DEFAULT_DRAW_STYLE };
};

/**
 * Move one handle of a drawing.
 *
 * A position calculator draws ONE right edge, at the furthest of its stop and
 * target points. Moving either handle alone therefore only ever pushed that
 * edge out: pull one in and the other still held the maximum, so the box
 * refused to shrink and the corner felt dead. The two points share the edge,
 * so dragging either moves it in both directions - while each keeps its own
 * price, so sizing the target never drags the stop level with it.
 */
export function updateDrawingHandle(
  drawing: Drawing,
  index: number,
  point: DrawPoint,
): Drawing {
  const sharesRightEdge = (drawing.tool === "longPosition" || drawing.tool === "shortPosition")
    && (index === 1 || index === 2);
  return {
    ...drawing,
    points: drawing.points.map((existing, i) => {
      if (i === index) return point;
      if (sharesRightEdge && (i === 1 || i === 2)) return { ...existing, time: point.time };
      return existing;
    }),
  };
}

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
      ? { ...defaultStyleFor(candidate.tool!), ...migrateDrawStyle(candidate.style) }
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
