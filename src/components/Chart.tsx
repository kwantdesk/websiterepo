"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type DragEvent as ReactDragEvent } from "react";
import { createChart, IChartApi, LineStyle, Time } from "lightweight-charts";
import {
  ArrowBigDown,
  ArrowBigUp,
  ArrowDown,
  ArrowUp,
  Bell,
  Brush,
  Calculator,
  ChartColumnIncreasing,
  Circle,
  Copy,
  Crosshair,
  Dot,
  Eraser,
  Eye,
  Flag,
  Frown,
  Highlighter,
  Image as ImageIcon,
  Info,
  KanbanSquare,
  Link2,
  Lock,
  Magnet,
  MapPin,
  MessageCircle,
  MessageSquare,
  MoveHorizontal,
  MoveVertical,
  MousePointer2,
  Paintbrush2,
  PencilLine,
  PenLine,
  Pin,
  Plus,
  Radar,
  RectangleHorizontal,
  RotateCcw,
  Ruler,
  ScanLine,
  Settings2,
  Shapes,
  ShoppingCart,
  Slash,
  SmilePlus,
  Sparkles,
  StickyNote,
  Table2,
  Tag,
  Trash2,
  Type,
  Undo2,
  Waypoints,
  Waves,
  X,
} from "lucide-react";
import { Candle, Trade } from "@/lib/backtester";
import { defaultChartSettings, type ChartSettings } from "@/lib/chartSettings";

interface ChartProps {
  candles: Candle[];
  trades?: (Trade & { markerVisible?: boolean })[];
  levels?: ChartLevel[];
  instrument?: string;
  timeframe?: string;
  marketIsActive?: boolean;
  onOpenSettings?: () => void;
  onCreateAlertAtPrice?: (price: string) => void;
  onRemoveAllIndicators?: () => void;
  settings?: ChartSettings;
  toolbarEnabled?: boolean;
  chartDragEnabled?: boolean;
  onChartDragStart?: (event: ReactDragEvent<HTMLButtonElement>) => void;
  onChartDragEnd?: () => void;
  gammaLevelsEnabled?: boolean;
  gammaLevelsAvailable?: boolean;
  gammaLevelsLoading?: boolean;
  gammaLevelsError?: string | null;
  onToggleGammaLevels?: () => void;
}

export interface ChartLevel {
  id: string;
  price: number;
  color: string;
  label: string;
  lineStyle?: "solid" | "dashed" | "dotted";
  lineWidth?: 1 | 2 | 3 | 4;
  axisLabelVisible?: boolean;
}

type DrawingToolId =
  | "cursor"
  | "dot"
  | "arrowCursor"
  | "demonstration"
  | "magic"
  | "eraser"
  | "trendLine"
  | "ray"
  | "infoLine"
  | "extendedLine"
  | "trendAngle"
  | "horizontalLine"
  | "horizontalRay"
  | "verticalLine"
  | "crossLine"
  | "parallelChannel"
  | "regressionTrend"
  | "flatTopBottom"
  | "disjointChannel"
  | "pitchfork"
  | "schiffPitchfork"
  | "modifiedSchiffPitchfork"
  | "insidePitchfork"
  | "anchoredVwap"
  | "fibRetracement"
  | "trendBasedFibExtension"
  | "fibChannel"
  | "fibTimeZone"
  | "fibSpeedResistanceFan"
  | "trendBasedFibTime"
  | "fibCircles"
  | "fibSpiral"
  | "fibSpeedResistanceArcs"
  | "fibWedge"
  | "pitchfan"
  | "gannBox"
  | "gannSquareFixed"
  | "gannSquare"
  | "gannFan"
  | "xabcdPattern"
  | "cypherPattern"
  | "headAndShoulders"
  | "abcdPattern"
  | "trianglePattern"
  | "threeDrivesPattern"
  | "elliottImpulseWave"
  | "elliottCorrectionWave"
  | "elliottTriangleWave"
  | "elliottDoubleComboWave"
  | "elliottTripleComboWave"
  | "cyclicLines"
  | "timeCycles"
  | "sineLine"
  | "rectangle"
  | "rotatedRectangle"
  | "ellipse"
  | "circle"
  | "path"
  | "polyline"
  | "triangle"
  | "arc"
  | "curve"
  | "doubleCurve"
  | "brush"
  | "highlighter"
  | "arrowMarker"
  | "arrow"
  | "arrowMarkUp"
  | "arrowMarkDown"
  | "text"
  | "note"
  | "priceNote"
  | "pin"
  | "table"
  | "callout"
  | "comment"
  | "priceLabel"
  | "signpost"
  | "flagMark"
  | "image"
  | "post"
  | "idea"
  | "emoji"
  | "longPosition"
  | "shortPosition"
  | "positionForecast"
  | "barPattern"
  | "ghostFeed"
  | "sector"
  | "fixedRangeVolumeProfile"
  | "anchoredVolumeProfile"
  | "measure"
  | "priceRange"
  | "dateRange"
  | "datePriceRange"
  | "zoomIn"
  | "zoomOut";

type ToolbarGroupId =
  | "cursorTools"
  | "trend"
  | "fib"
  | "patterns"
  | "shapes"
  | "forecast"
  | "annotation"
  | "icons"
  | "measure"
  | "zoom";

type ToolbarDock = "left" | "right" | "top" | "bottom";

type DrawingPoint = {
  time: number;
  price: number;
};

type ChartDrawing = {
  id: string;
  tool: DrawingToolId;
  points: DrawingPoint[];
  text?: string;
  color?: string;
};

type DrawingInteraction =
  | {
      drawingId: string;
      mode: "move";
      startPointer: DrawingPoint;
      originalPoints: DrawingPoint[];
    }
  | {
      drawingId: string;
      mode: "anchor0" | "anchor1";
      startPointer: DrawingPoint;
      originalPoints: DrawingPoint[];
    };

type ToolbarTool = {
  id: DrawingToolId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  section?: string;
  shortcut?: string;
  implemented?: boolean;
};

type ToolbarGroup = {
  id: ToolbarGroupId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tools: ToolbarTool[];
};

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const TEXT_TOOLS: DrawingToolId[] = ["text", "note", "priceNote", "callout", "comment", "priceLabel", "pin", "signpost", "flagMark"];

const DRAWING_TOOLBAR_GROUPS: ToolbarGroup[] = [
  {
    id: "cursorTools",
    label: "Cursor Tools",
    icon: Crosshair,
    tools: [
      { id: "cursor", label: "Cross", icon: Crosshair, implemented: true },
      { id: "dot", label: "Dot", icon: Dot },
      { id: "arrowCursor", label: "Arrow", icon: MousePointer2 },
      { id: "demonstration", label: "Demonstration", icon: MoveHorizontal },
      { id: "magic", label: "Magic", icon: Sparkles },
      { id: "eraser", label: "Eraser", icon: Eraser, implemented: true },
    ],
  },
  {
    id: "trend",
    label: "Trend Line Tools",
    icon: Slash,
    tools: [
      { id: "trendLine", label: "Trendline", icon: Slash, section: "Lines", shortcut: "Alt + T", implemented: true },
      { id: "ray", label: "Ray", icon: PencilLine, section: "Lines", implemented: true },
      { id: "infoLine", label: "Info line", icon: Info, section: "Lines", implemented: true },
      { id: "extendedLine", label: "Extended line", icon: MoveHorizontal, section: "Lines", implemented: true },
      { id: "trendAngle", label: "Trend angle", icon: MoveVertical, section: "Lines" },
      { id: "horizontalLine", label: "Horizontal line", icon: MoveHorizontal, section: "Lines", shortcut: "Alt + H", implemented: true },
      { id: "horizontalRay", label: "Horizontal ray", icon: ArrowRightIconShim, section: "Lines", implemented: true },
      { id: "verticalLine", label: "Vertical line", icon: MoveVertical, section: "Lines", shortcut: "Alt + V", implemented: true },
      { id: "crossLine", label: "Cross line", icon: Crosshair, section: "Lines", shortcut: "Alt + C", implemented: true },
      { id: "parallelChannel", label: "Parallel channel", icon: KanbanSquare, section: "Channels" },
      { id: "regressionTrend", label: "Regression trend", icon: ChartColumnIncreasing, section: "Channels" },
      { id: "flatTopBottom", label: "Flat top/bottom", icon: RectangleHorizontal, section: "Channels" },
      { id: "disjointChannel", label: "Disjoint channel", icon: Shapes, section: "Channels" },
      { id: "pitchfork", label: "Pitchfork", icon: Waypoints, section: "Pitchforks" },
      { id: "schiffPitchfork", label: "Schiff pitchfork", icon: Waypoints, section: "Pitchforks" },
      { id: "modifiedSchiffPitchfork", label: "Modified Schiff pitchfork", icon: Waypoints, section: "Pitchforks" },
      { id: "insidePitchfork", label: "Inside pitchfork", icon: Waypoints, section: "Pitchforks" },
    ],
  },
  {
    id: "fib",
    label: "Gann and Fibonacci Tools",
    icon: Waypoints,
    tools: [
      { id: "fibRetracement", label: "Fib retracement", icon: Waypoints, section: "Fibonacci", shortcut: "Alt + F", implemented: true },
      { id: "trendBasedFibExtension", label: "Trend-based fib extension", icon: ChartColumnIncreasing, section: "Fibonacci" },
      { id: "fibChannel", label: "Fib channel", icon: KanbanSquare, section: "Fibonacci" },
      { id: "fibTimeZone", label: "Fib time zone", icon: MoveVertical, section: "Fibonacci" },
      { id: "fibSpeedResistanceFan", label: "Fib speed resistance fan", icon: Radar, section: "Fibonacci" },
      { id: "trendBasedFibTime", label: "Trend-based fib time", icon: MoveHorizontal, section: "Fibonacci" },
      { id: "fibCircles", label: "Fib circles", icon: Circle, section: "Fibonacci" },
      { id: "fibSpiral", label: "Fib spiral", icon: RotateCcw, section: "Fibonacci" },
      { id: "fibSpeedResistanceArcs", label: "Fib speed resistance arcs", icon: Waves, section: "Fibonacci" },
      { id: "fibWedge", label: "Fib wedge", icon: TriangleIconShim, section: "Fibonacci" },
      { id: "pitchfan", label: "Pitchfan", icon: Radar, section: "Fibonacci" },
      { id: "gannBox", label: "Gann box", icon: RectangleHorizontal, section: "Gann" },
      { id: "gannSquareFixed", label: "Gann square fixed", icon: RectangleHorizontal, section: "Gann" },
      { id: "gannSquare", label: "Gann square", icon: RectangleHorizontal, section: "Gann" },
      { id: "gannFan", label: "Gann fan", icon: Radar, section: "Gann" },
    ],
  },
  {
    id: "patterns",
    label: "Patterns and Cycles",
    icon: Waypoints,
    tools: [
      { id: "xabcdPattern", label: "XABCD pattern", icon: Waypoints, section: "Chart Patterns" },
      { id: "cypherPattern", label: "Cypher pattern", icon: Waypoints, section: "Chart Patterns" },
      { id: "headAndShoulders", label: "Head and shoulders", icon: Waypoints, section: "Chart Patterns" },
      { id: "abcdPattern", label: "ABCD pattern", icon: Shapes, section: "Chart Patterns" },
      { id: "trianglePattern", label: "Triangle pattern", icon: TriangleIconShim, section: "Chart Patterns" },
      { id: "threeDrivesPattern", label: "Three drives pattern", icon: Waypoints, section: "Chart Patterns" },
      { id: "elliottImpulseWave", label: "Elliott impulse wave (1·2·3·4·5)", icon: Waves, section: "Elliott Waves" },
      { id: "elliottCorrectionWave", label: "Elliott correction wave (A·B·C)", icon: Waves, section: "Elliott Waves" },
      { id: "elliottTriangleWave", label: "Elliott triangle wave (A·B·C·D·E)", icon: Waves, section: "Elliott Waves" },
      { id: "elliottDoubleComboWave", label: "Elliott double combo wave (W·X·Y)", icon: Waves, section: "Elliott Waves" },
      { id: "elliottTripleComboWave", label: "Elliott triple combo wave (W·X·Y·X·Z)", icon: Waves, section: "Elliott Waves" },
      { id: "cyclicLines", label: "Cyclic lines", icon: MoveVertical, section: "Cycles" },
      { id: "timeCycles", label: "Time cycles", icon: MoveHorizontal, section: "Cycles" },
      { id: "sineLine", label: "Sine line", icon: Waves, section: "Cycles" },
    ],
  },
  {
    id: "shapes",
    label: "Brushes, Arrows and Shapes",
    icon: Brush,
    tools: [
      { id: "brush", label: "Brush", icon: Brush, section: "Brushes" },
      { id: "highlighter", label: "Highlighter", icon: Highlighter, section: "Brushes" },
      { id: "arrowMarker", label: "Arrow marker", icon: ArrowUp, section: "Arrows" },
      { id: "arrow", label: "Arrow", icon: ArrowUp, section: "Arrows" },
      { id: "arrowMarkUp", label: "Arrow mark up", icon: ArrowBigUp, section: "Arrows" },
      { id: "arrowMarkDown", label: "Arrow mark down", icon: ArrowBigDown, section: "Arrows" },
      { id: "rectangle", label: "Rectangle", icon: RectangleHorizontal, section: "Shapes", shortcut: "Alt + Shift + R", implemented: true },
      { id: "rotatedRectangle", label: "Rotated rectangle", icon: RectangleHorizontal, section: "Shapes" },
      { id: "path", label: "Path", icon: PencilLine, section: "Shapes", implemented: true },
      { id: "circle", label: "Circle", icon: Circle, section: "Shapes", implemented: true },
      { id: "ellipse", label: "Ellipse", icon: Circle, section: "Shapes", implemented: true },
      { id: "polyline", label: "Polyline", icon: PencilLine, section: "Shapes" },
      { id: "triangle", label: "Triangle", icon: TriangleIconShim, section: "Shapes" },
      { id: "arc", label: "Arc", icon: RotateCcw, section: "Shapes" },
      { id: "curve", label: "Curve", icon: PenLine, section: "Shapes" },
      { id: "doubleCurve", label: "Double curve", icon: PenLine, section: "Shapes" },
    ],
  },
  {
    id: "forecast",
    label: "Forecasting",
    icon: ChartColumnIncreasing,
    tools: [
      { id: "longPosition", label: "Long position", icon: MoveHorizontal, section: "Forecasting", implemented: true },
      { id: "shortPosition", label: "Short position", icon: MoveHorizontal, section: "Forecasting", implemented: true },
      { id: "positionForecast", label: "Position forecast", icon: ChartColumnIncreasing, section: "Forecasting" },
      { id: "barPattern", label: "Bar pattern", icon: ChartColumnIncreasing, section: "Forecasting" },
      { id: "ghostFeed", label: "Ghost feed", icon: Waves, section: "Forecasting" },
      { id: "sector", label: "Sector", icon: Radar, section: "Forecasting" },
      { id: "anchoredVwap", label: "Anchored VWAP", icon: ChartColumnIncreasing, section: "Volume-Based", implemented: true },
      { id: "fixedRangeVolumeProfile", label: "Fixed range volume profile", icon: KanbanSquare, section: "Volume-Based" },
      { id: "anchoredVolumeProfile", label: "Anchored volume profile", icon: KanbanSquare, section: "Volume-Based" },
      { id: "priceRange", label: "Price range", icon: Ruler, section: "Measurers", implemented: true },
      { id: "dateRange", label: "Date range", icon: Ruler, section: "Measurers", implemented: true },
      { id: "datePriceRange", label: "Date and price range", icon: Calculator, section: "Measurers", implemented: true },
    ],
  },
  {
    id: "annotation",
    label: "Text and Notes",
    icon: Type,
    tools: [
      { id: "text", label: "Text", icon: Type, section: "Text and Notes", implemented: true },
      { id: "note", label: "Note", icon: StickyNote, section: "Text and Notes", implemented: true },
      { id: "priceNote", label: "Price note", icon: Tag, section: "Text and Notes", implemented: true },
      { id: "pin", label: "Pin", icon: Pin, section: "Text and Notes", implemented: true },
      { id: "table", label: "Table", icon: Table2, section: "Text and Notes" },
      { id: "callout", label: "Callout", icon: MessageSquare, section: "Text and Notes", implemented: true },
      { id: "comment", label: "Comment", icon: MessageCircle, section: "Text and Notes", implemented: true },
      { id: "priceLabel", label: "Price label", icon: Tag, section: "Text and Notes", implemented: true },
      { id: "signpost", label: "Signpost", icon: Flag, section: "Text and Notes", implemented: true },
      { id: "flagMark", label: "Flag mark", icon: Flag, section: "Text and Notes", implemented: true },
      { id: "image", label: "Image", icon: ImageIcon, section: "Content" },
      { id: "post", label: "Post", icon: MessageSquare, section: "Content" },
      { id: "idea", label: "Idea", icon: LightbulbIconShim, section: "Content" },
    ],
  },
  {
    id: "icons",
    label: "Icons and Emojis",
    icon: SmilePlus,
    tools: [{ id: "emoji", label: "Emoji", icon: SmilePlus, section: "Icons" }],
  },
  {
    id: "measure",
    label: "Measurers",
    icon: Ruler,
    tools: [{ id: "measure", label: "Measure", icon: Ruler, section: "Measure", implemented: true }],
  },
  {
    id: "zoom",
    label: "Zoom Tools",
    icon: Plus,
    tools: [
      { id: "zoomIn", label: "Zoom in", icon: Plus, section: "Zoom" },
      { id: "zoomOut", label: "Zoom out", icon: Undo2, section: "Zoom" },
    ],
  },
];

const TOOLBAR_ICON_MAP: Record<ToolbarGroupId, ComponentType<{ className?: string }>> = {
  cursorTools: Crosshair,
  trend: Slash,
  fib: Waypoints,
  patterns: Waypoints,
  shapes: Brush,
  forecast: ChartColumnIncreasing,
  annotation: Type,
  icons: SmilePlus,
  measure: Ruler,
  zoom: Plus,
};

function ArrowRightIconShim({ className }: { className?: string }) {
  return <ArrowUp className={className} style={{ transform: "rotate(90deg)" }} />;
}

function TriangleIconShim({ className }: { className?: string }) {
  return <Shapes className={className} />;
}

function LightbulbIconShim({ className }: { className?: string }) {
  return <Bell className={className} />;
}

function getPriceFormat(instrument: string) {
  const fiveDecimal = ["EURUSD", "GBPUSD", "AUDUSD", "NZDUSD", "USDCAD", "USDCHF"];
  const threeDecimalForex = ["USDJPY"];
  const threeDecimal = ["XAUUSD", "OIL"];
  const oneDecimal = ["NAS100", "S&P500", "GER40", "UK100", "DOW30", "NIKKEI"];

  if (fiveDecimal.includes(instrument)) return { type: "price" as const, precision: 5, minMove: 0.00001 };
  if (threeDecimalForex.includes(instrument)) return { type: "price" as const, precision: 3, minMove: 0.001 };
  if (threeDecimal.includes(instrument)) return { type: "price" as const, precision: 3, minMove: 0.001 };
  if (oneDecimal.includes(instrument)) return { type: "price" as const, precision: 1, minMove: 0.1 };
  return { type: "price" as const, precision: 2, minMove: 0.01 };
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function drawingsStorageKey(instrument: string) {
  return `kwantify-chart-drawings:${instrument}`;
}

function toolbarDockStorageKey() {
  return "kwantify-chart-toolbar-dock";
}

function toolbarCollapsedStorageKey() {
  return "kwantify-chart-toolbar-collapsed";
}

function normalizeTimeValue(value: Time | null): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "year" in value) {
    return Math.floor(Date.UTC(value.year, value.month - 1, value.day) / 1000);
  }
  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatDateRangeLabel(a: number, b: number) {
  const diffSeconds = Math.abs(b - a);
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = diffMinutes / 60;
  if (diffHours < 24) return `${diffHours.toFixed(diffHours >= 10 ? 0 : 1)}h`;
  const diffDays = diffHours / 24;
  return `${diffDays.toFixed(diffDays >= 10 ? 0 : 1)}d`;
}

function timeframeToMs(timeframe?: string) {
  const match = timeframe?.trim().match(/^(\d+)\s*(s|m|h|d|w|M|y|D|W|Y)$/);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;

  const unit = match[2];
  if (unit === "s") return value * 1_000;
  if (unit === "m") return value * 60_000;
  if (unit === "h") return value * 60 * 60_000;
  if (unit === "d" || unit === "D") return value * 24 * 60 * 60_000;
  if (unit === "w" || unit === "W") return value * 7 * 24 * 60 * 60_000;
  if (unit === "M") return value * 30 * 24 * 60 * 60_000;
  if (unit === "y" || unit === "Y") return value * 365 * 24 * 60 * 60_000;
  return null;
}

function inferCandleIntervalMs(candles: Candle[]) {
  const diffs = candles
    .slice(-30)
    .map((candle, index, rows) => {
      if (index === 0) return 0;
      return candle.timestamp - rows[index - 1].timestamp;
    })
    .filter((diff) => Number.isFinite(diff) && diff > 0)
    .sort((a, b) => a - b);

  if (diffs.length === 0) return null;
  return diffs[Math.floor(diffs.length / 2)];
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatPriceDistance(entry: number, other: number, precision: number) {
  const diff = other - entry;
  const absolute = Math.abs(diff);
  const percent = entry !== 0 ? (absolute / entry) * 100 : 0;
  const sign = diff >= 0 ? "+" : "-";
  return `${sign}${absolute.toFixed(precision)} (${percent.toFixed(2)}%)`;
}

function groupToolsBySection(tools: ToolbarTool[]) {
  const grouped: Array<{ section: string; tools: ToolbarTool[] }> = [];
  for (const tool of tools) {
    const section = tool.section ?? "Tools";
    const current = grouped[grouped.length - 1];
    if (current && current.section === section) {
      current.tools.push(tool);
    } else {
      grouped.push({ section, tools: [tool] });
    }
  }
  return grouped;
}

function getToolbarButtonTone(active: boolean) {
  return active
    ? "border-primary/50 bg-primary/15 text-primary"
    : "border-transparent bg-panel/70 text-muted hover:bg-surface hover:text-foreground";
}

function getToolbarDockStyle(dock: ToolbarDock): CSSProperties {
  switch (dock) {
    case "right":
      return { right: 12, top: 64 };
    case "top":
      return { top: 12, left: "50%", transform: "translateX(-50%)" };
    case "bottom":
      return { bottom: 12, left: "50%", transform: "translateX(-50%)" };
    default:
      return { left: 12, top: 64 };
  }
}

function getToolbarMenuPositionClasses(dock: ToolbarDock) {
  switch (dock) {
    case "right":
      return "right-14 top-0";
    case "top":
      return "left-0 top-14";
    case "bottom":
      return "left-0 bottom-14";
    default:
      return "left-14 top-0";
  }
}

function getObjectsPanelStyle(dock: ToolbarDock): CSSProperties {
  switch (dock) {
    case "right":
      return { right: 64, top: 64 };
    case "top":
      return { left: 16, top: 72 };
    case "bottom":
      return { left: 16, bottom: 72 };
    default:
      return { left: 64, top: 64 };
  }
}

function getTextToolChrome(tool: DrawingToolId) {
  switch (tool) {
    case "note":
      return { title: "Add note", placeholder: "Write note...", fill: "rgba(245, 158, 11, 0.16)", stroke: "rgba(245, 158, 11, 0.8)", text: "#FEF3C7" };
    case "priceNote":
      return { title: "Add price note", placeholder: "Price note...", fill: "rgba(59, 130, 246, 0.16)", stroke: "rgba(59, 130, 246, 0.78)", text: "#DBEAFE" };
    case "callout":
      return { title: "Add callout", placeholder: "Callout...", fill: "rgba(16, 185, 129, 0.14)", stroke: "rgba(16, 185, 129, 0.78)", text: "#D1FAE5" };
    case "comment":
      return { title: "Add comment", placeholder: "Comment...", fill: "rgba(168, 85, 247, 0.14)", stroke: "rgba(168, 85, 247, 0.78)", text: "#F3E8FF" };
    case "priceLabel":
      return { title: "Add price label", placeholder: "Label...", fill: "rgba(99, 102, 241, 0.14)", stroke: "rgba(99, 102, 241, 0.78)", text: "#E0E7FF" };
    case "pin":
      return { title: "Add pin", placeholder: "Pinned note...", fill: "rgba(236, 72, 153, 0.14)", stroke: "rgba(236, 72, 153, 0.82)", text: "#FCE7F3" };
    case "signpost":
      return { title: "Add signpost", placeholder: "Signpost...", fill: "rgba(234, 179, 8, 0.14)", stroke: "rgba(234, 179, 8, 0.82)", text: "#FEF9C3" };
    case "flagMark":
      return { title: "Add flag mark", placeholder: "Flag note...", fill: "rgba(248, 113, 113, 0.14)", stroke: "rgba(248, 113, 113, 0.82)", text: "#FEE2E2" };
    default:
      return { title: "Add text", placeholder: "Add text...", fill: "rgba(24, 24, 27, 0.92)", stroke: "rgba(255, 255, 255, 0.12)", text: "#F4F4F5" };
  }
}

export default function Chart({
  candles,
  trades,
  levels,
  instrument = "Instrument",
  timeframe,
  marketIsActive,
  onOpenSettings,
  onCreateAlertAtPrice,
  onRemoveAllIndicators,
  settings = defaultChartSettings,
  toolbarEnabled = true,
  chartDragEnabled = false,
  onChartDragStart,
  onChartDragEnd,
  gammaLevelsEnabled = false,
  gammaLevelsAvailable = false,
  gammaLevelsLoading = false,
  gammaLevelsError = null,
  onToggleGammaLevels,
}: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ReturnType<IChartApi["addCandlestickSeries"]> | null>(null);
  const prevCandlesLengthRef = useRef<number>(0);
  const prevDataRef = useRef<string>("");
  const prevFirstTimestampRef = useRef<number | null>(null);
  const tradesRef = useRef<(Trade & { markerVisible?: boolean })[]>([]);
  const levelsRef = useRef<ChartLevel[]>([]);
  const priceLinesRef = useRef<any[]>([]);
  const horzLineRef = useRef<HTMLDivElement>(null);
  const priceLabelRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; price: string } | null>(null);
  const [copiedPrice, setCopiedPrice] = useState(false);
  const [selectedTool, setSelectedTool] = useState<DrawingToolId>("cursor");
  const [openToolbarGroup, setOpenToolbarGroup] = useState<ToolbarGroupId | null>(null);
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const [draftDrawing, setDraftDrawing] = useState<ChartDrawing | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [drawingInteraction, setDrawingInteraction] = useState<DrawingInteraction | null>(null);
  const [hideDrawings, setHideDrawings] = useState(false);
  const [drawingsLocked, setDrawingsLocked] = useState(false);
  const [magnetMode, setMagnetMode] = useState<"off" | "weak" | "strong">("weak");
  const [toolbarDock, setToolbarDock] = useState<ToolbarDock>("top");
  const [toolbarDragPosition, setToolbarDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [showObjectsPanel, setShowObjectsPanel] = useState(false);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [textEditor, setTextEditor] = useState<{ x: number; y: number; time: number; price: number; value: string; tool: DrawingToolId } | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const [viewportVersion, setViewportVersion] = useState(0);
  const [themeVersion, setThemeVersion] = useState(0);
  const [candleCountdown, setCandleCountdown] = useState<{ label: string; top: number | null } | null>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const latestPointerRef = useRef<{ x: number; y: number } | null>(null);
  const viewportFrameRef = useRef<number | null>(null);
  const toolbarDragStateRef = useRef<{ offsetX: number; offsetY: number; startClientX: number; startClientY: number; hasMoved: boolean } | null>(null);
  const toolbarToggleSuppressedRef = useRef(false);

  useEffect(() => {
    const handleThemeChange = () => setThemeVersion((version) => version + 1);
    window.addEventListener("kwantdesk:theme-change", handleThemeChange);
    return () => window.removeEventListener("kwantdesk:theme-change", handleThemeChange);
  }, []);

  const priceFormat = useMemo(() => getPriceFormat(instrument), [instrument]);
  const candleIntervalMs = useMemo(() => timeframeToMs(timeframe) ?? inferCandleIntervalMs(candles), [candles, timeframe]);
  const toolbarMetrics = useMemo(() => {
    const minDimension = Math.min(
      overlaySize.width > 0 ? overlaySize.width : Number.POSITIVE_INFINITY,
      overlaySize.height > 0 ? overlaySize.height : Number.POSITIVE_INFINITY,
    );
    const compact = overlaySize.width > 0 && (overlaySize.width < 640 || overlaySize.height < 420 || minDimension < 420);
    const tiny = overlaySize.width > 0 && (overlaySize.width < 430 || overlaySize.height < 320 || minDimension < 320);
    const micro = overlaySize.width > 0 && (overlaySize.width < 320 || overlaySize.height < 250 || minDimension < 250);
    const nano = overlaySize.width > 0 && (overlaySize.width < 280 || overlaySize.height < 220 || minDimension < 220);
    return {
      buttonSize: nano ? 22 : micro ? 26 : tiny ? 30 : compact ? 36 : 44,
      iconSize: nano ? 10 : micro ? 12 : tiny ? 13 : compact ? 16 : 18,
      gap: nano ? 2 : micro ? 3 : tiny ? 4 : 8,
      radius: nano ? 7 : micro ? 8 : tiny ? 9 : 12,
      dockOffset: nano ? 4 : micro ? 6 : tiny ? 7 : 12,
      dockStart: nano ? 24 : micro ? 30 : tiny ? 38 : 64,
      menuWidth: nano ? 200 : micro ? 220 : tiny ? 260 : compact ? 320 : 420,
      menuMaxHeight: nano ? "46vh" : micro ? "52vh" : tiny ? "58vh" : "74vh",
      objectsPanelWidth: nano ? 188 : micro ? 208 : tiny ? 228 : 288,
    };
  }, [overlaySize.height, overlaySize.width]);
  const toolbarIconClassName =
    toolbarMetrics.iconSize <= 12 ? "h-3 w-3" : toolbarMetrics.iconSize <= 15 ? "h-[15px] w-[15px]" : toolbarMetrics.iconSize <= 17 ? "h-[17px] w-[17px]" : "h-[18px] w-[18px]";
  const toolbarToolIconClassName =
    toolbarMetrics.iconSize <= 12 ? "h-[11px] w-[11px]" : toolbarMetrics.iconSize <= 15 ? "h-[14px] w-[14px]" : toolbarMetrics.iconSize <= 17 ? "h-[15px] w-[15px]" : "h-4 w-4";
  const toolbarDockStyle = toolbarDragPosition
    ? { left: toolbarDragPosition.x, top: toolbarDragPosition.y }
    : (() => {
        switch (toolbarDock) {
          case "right":
            return { right: toolbarMetrics.dockOffset, top: toolbarMetrics.dockStart };
          case "top":
            return { top: toolbarMetrics.dockOffset, left: "50%", transform: "translateX(-50%)" };
          case "bottom":
            return { bottom: toolbarMetrics.dockOffset, left: "50%", transform: "translateX(-50%)" };
          default:
            return { left: toolbarMetrics.dockOffset, top: toolbarMetrics.dockStart };
        }
      })();
  const toolbarMenuStyle = {
    width: toolbarMetrics.menuWidth,
    maxHeight: toolbarMetrics.menuMaxHeight,
  } as CSSProperties;
  const objectsPanelStyle = {
    ...getObjectsPanelStyle(toolbarDock),
    width: toolbarMetrics.objectsPanelWidth,
  } as CSSProperties;

  const activeToolbarTool = useMemo(() => {
    for (const group of DRAWING_TOOLBAR_GROUPS) {
      const tool = group.tools.find((item) => item.id === selectedTool);
      if (tool) {
        return { groupId: group.id, label: tool.label };
      }
    }
    return null;
  }, [selectedTool]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(drawingsStorageKey(instrument));
      setDrawings(raw ? JSON.parse(raw) : []);
    } catch {
      setDrawings([]);
    }
  }, [instrument]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(drawingsStorageKey(instrument), JSON.stringify(drawings));
    } catch {
      // ignore storage limits
    }
  }, [drawings, instrument]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(toolbarDockStorageKey()) as ToolbarDock | null;
      if (raw === "right" || raw === "top" || raw === "bottom") {
        setToolbarDock(raw);
        return;
      }
      if (raw === "left") {
        setToolbarDock("top");
        window.localStorage.setItem(toolbarDockStorageKey(), "top");
        return;
      }
    } catch {
      setToolbarDock("top");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(toolbarDockStorageKey(), toolbarDock);
    } catch {
      // ignore storage limits
    }
  }, [toolbarDock]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setToolbarCollapsed(window.localStorage.getItem(toolbarCollapsedStorageKey()) === "true");
    } catch {
      setToolbarCollapsed(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(toolbarCollapsedStorageKey(), toolbarCollapsed ? "true" : "false");
    } catch {
      // ignore storage limits
    }
  }, [toolbarCollapsed]);

  const applyMarkers = (tradeRows: (Trade & { markerVisible?: boolean })[]) => {
    if (!candleSeriesRef.current || !tradeRows || tradeRows.length === 0) {
      candleSeriesRef.current?.setMarkers([]);
      return;
    }

    const markers = tradeRows
      .filter((trade) => trade.markerVisible !== false)
      .flatMap((trade) => {
        const entryTime = Math.floor(trade.entryTime / 1000);
        const exitTime = Math.floor(trade.exitTime / 1000);
        const isLong = trade.direction === "LONG";
        const color = isLong ? "#22C55E" : "#EF4444";
        const isWin = trade.result === "WIN";

        return [
          {
            time: entryTime as Time,
            position: (isLong ? "belowBar" : "aboveBar") as "belowBar" | "aboveBar",
            color,
            shape: (isLong ? "arrowUp" : "arrowDown") as "arrowUp" | "arrowDown",
            text: isLong ? "BUY" : "SELL",
          },
          {
            time: exitTime as Time,
            position: (isLong ? "aboveBar" : "belowBar") as "aboveBar" | "belowBar",
            color,
            shape: (isLong ? "arrowDown" : "arrowUp") as "arrowDown" | "arrowUp",
            text: isWin ? "TP" : "SL",
          },
        ];
      });

    markers.sort((a, b) => (a.time as number) - (b.time as number));
    candleSeriesRef.current.setMarkers(markers);
  };

  const applyLevels = (priceLevels: ChartLevel[]) => {
    if (!candleSeriesRef.current) return;

    priceLinesRef.current.forEach((line) => {
      try {
        candleSeriesRef.current?.removePriceLine(line);
      } catch {
        // ignore stale line handles
      }
    });
    priceLinesRef.current = [];

    if (!priceLevels.length) return;

    priceLevels.forEach((level) => {
      const line = candleSeriesRef.current?.createPriceLine({
        price: level.price,
        color: level.color,
        lineWidth: level.lineWidth ?? 1,
        lineStyle:
          level.lineStyle === "dashed"
            ? LineStyle.Dashed
            : level.lineStyle === "dotted"
              ? LineStyle.Dotted
              : LineStyle.Solid,
        axisLabelVisible: level.axisLabelVisible ?? true,
        title: level.label,
      });

      if (line) {
        priceLinesRef.current.push(line);
      }
    });
  };

  function timeToX(time: number) {
    return chartRef.current?.timeScale().timeToCoordinate(time as Time) ?? null;
  }

  function priceToY(price: number) {
    return candleSeriesRef.current?.priceToCoordinate(price) ?? null;
  }

  function getPointerPoint(clientX: number, clientY: number) {
    if (!chartContainerRef.current) return null;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    const rawTime = normalizeTimeValue(chartRef.current?.timeScale().coordinateToTime(localX) ?? null);
    const rawPrice = candleSeriesRef.current?.coordinateToPrice(localY) ?? null;

    if (rawTime == null || rawPrice == null) return null;

    let point: DrawingPoint = { time: rawTime, price: rawPrice };

    if (magnetMode !== "off") {
      const nearest = candles.reduce<Candle | null>((best, candle) => {
        if (!best) return candle;
        return Math.abs(candle.timestamp / 1000 - point.time) < Math.abs(best.timestamp / 1000 - point.time) ? candle : best;
      }, null);

      if (nearest) {
        const snappedPrices = [nearest.open, nearest.high, nearest.low, nearest.close];
        const bestPrice = snappedPrices.reduce((best, value) =>
          Math.abs(value - point.price) < Math.abs(best - point.price) ? value : best
        );
        point = {
          time: Math.floor(nearest.timestamp / 1000),
          price:
            magnetMode === "strong"
              ? bestPrice
              : Math.abs(bestPrice - point.price) < Math.max(0.6, point.price * 0.00003)
                ? bestPrice
                : point.price,
        };
      }
    }

    return point;
  }

  function finishDraft(next: ChartDrawing | null) {
    if (!next) return;
    setDrawings((current) => [...current, next]);
    setSelectedDrawingId(next.id);
    setDraftDrawing(null);
    if (selectedTool !== "cursor" && selectedTool !== "text") {
      setSelectedTool("cursor");
    }
  }

  function getLongShortGeometry(drawing: ChartDrawing) {
    const [a, b] = drawing.points;
    if (!a || !b) return null;
    const ax = timeToX(a.time);
    const ay = priceToY(a.price);
    const bx = timeToX(b.time);
    const by = priceToY(b.price);
    if (ax == null || ay == null || bx == null || by == null) return null;

    const isLong = drawing.tool === "longPosition";
    const entryPrice = a.price;
    const stopPrice = b.price;
    const risk = Math.max(Math.abs(entryPrice - stopPrice), priceFormat.minMove);
    const targetPrice = isLong ? entryPrice + risk * 2 : entryPrice - risk * 2;
    const targetY = priceToY(targetPrice);
    const entryY = priceToY(entryPrice);
    const stopY = priceToY(stopPrice);
    if (targetY == null || entryY == null || stopY == null) return null;

    const width = Math.max(80, Math.abs(bx - ax));
    const x = Math.min(ax, bx);
    const boxWidth = width;
    const profitTop = isLong ? targetY : entryY;
    const profitBottom = isLong ? entryY : targetY;
    const riskTop = isLong ? entryY : stopY;
    const riskBottom = isLong ? stopY : entryY;

    return {
      ax,
      ay,
      bx,
      by,
      x,
      boxWidth,
      entryY,
      stopY,
      targetY,
      targetPrice,
      stopPrice,
      profitTop,
      profitBottom,
      riskTop,
      riskBottom,
      leftHandle: { x: ax, y: ay },
      rightHandle: { x: bx, y: by },
      bounds: {
        left: x,
        right: x + boxWidth,
        top: Math.min(profitTop, profitBottom, riskTop, riskBottom),
        bottom: Math.max(profitTop, profitBottom, riskTop, riskBottom),
      },
    };
  }

  function getLongShortInteraction(drawing: ChartDrawing, point: DrawingPoint) {
    const geometry = getLongShortGeometry(drawing);
    if (!geometry) return null;
    const px = timeToX(point.time);
    const py = priceToY(point.price);
    if (px == null || py == null) return null;

    const leftDistance = Math.hypot(px - geometry.leftHandle.x, py - geometry.leftHandle.y);
    if (leftDistance <= 12) {
      return { mode: "anchor0" as const };
    }
    const rightDistance = Math.hypot(px - geometry.rightHandle.x, py - geometry.rightHandle.y);
    if (rightDistance <= 12) {
      return { mode: "anchor1" as const };
    }

    if (
      px >= geometry.bounds.left &&
      px <= geometry.bounds.right &&
      py >= geometry.bounds.top &&
      py <= geometry.bounds.bottom
    ) {
      return { mode: "move" as const };
    }

    return null;
  }

  function findInteractiveDrawing(point: DrawingPoint) {
    const interactive = drawings
      .filter((drawing) => drawing.tool === "longPosition" || drawing.tool === "shortPosition")
      .map((drawing) => {
        const hit = getLongShortInteraction(drawing, point);
        if (!hit) return null;
        return { drawing, hit };
      })
      .filter(Boolean) as { drawing: ChartDrawing; hit: { mode: "move" | "anchor0" | "anchor1" } }[];

    return interactive[0] ?? null;
  }

  function buildAnchoredVwap(anchor: DrawingPoint) {
    const anchorIndex = candles.findIndex((candle) => Math.floor(candle.timestamp / 1000) >= anchor.time);
    if (anchorIndex < 0) return null;
    return {
      id: createId("drawing"),
      tool: "anchoredVwap" as const,
      points: [anchor],
      color: "#EAB308",
    };
  }

  function removeNearestDrawing(point: DrawingPoint) {
    const chartWidth = chartContainerRef.current?.clientWidth ?? 0;
    const chartHeight = chartContainerRef.current?.clientHeight ?? 0;
    const targetX = timeToX(point.time);
    const targetY = priceToY(point.price);
    if (targetX == null || targetY == null) return;

    const scored = drawings
      .map((drawing) => {
        const primary = drawing.points[0];
        const secondary = drawing.points[1] ?? drawing.points[0];
        const px = timeToX(primary.time) ?? targetX;
        const py = priceToY(primary.price) ?? targetY;
        const sx = timeToX(secondary.time) ?? px;
        const sy = priceToY(secondary.price) ?? py;
        const anchorDistance = Math.hypot(px - targetX, py - targetY);
        const secondaryDistance = Math.hypot(sx - targetX, sy - targetY);
        const horizontalDistance = drawing.tool === "horizontalLine" || drawing.tool === "horizontalRay" ? Math.abs(py - targetY) : Number.POSITIVE_INFINITY;
        const verticalDistance = drawing.tool === "verticalLine" ? Math.abs(px - targetX) : Number.POSITIVE_INFINITY;
        const boxDistance =
          drawing.tool === "rectangle" || drawing.tool === "ellipse" || drawing.tool === "circle"
            ? Math.min(
                Math.abs(Math.min(px, sx) - targetX),
                Math.abs(Math.max(px, sx) - targetX),
                Math.abs(Math.min(py, sy) - targetY),
                Math.abs(Math.max(py, sy) - targetY)
              )
            : Number.POSITIVE_INFINITY;
        const viewportDistance = Math.min(anchorDistance, secondaryDistance, horizontalDistance, verticalDistance, boxDistance);
        return { id: drawing.id, distance: viewportDistance };
      })
      .sort((a, b) => a.distance - b.distance);

    if (scored[0] && scored[0].distance < Math.max(14, Math.min(chartWidth, chartHeight) * 0.03)) {
      removeDrawing(scored[0].id);
    }
  }

  function handleDrawingPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;

    const point = getPointerPoint(event.clientX, event.clientY);
    if (!point) return;

    latestPointerRef.current = { x: event.clientX, y: event.clientY };
    setOpenToolbarGroup(null);
    setContextMenu(null);

    if (selectedTool === "cursor") {
      const interactive = findInteractiveDrawing(point);
      if (interactive) {
        setSelectedDrawingId(interactive.drawing.id);
        setDrawingInteraction({
          drawingId: interactive.drawing.id,
          mode: interactive.hit.mode,
          startPointer: point,
          originalPoints: interactive.drawing.points.map((currentPoint) => ({ ...currentPoint })),
        });
      } else {
        setSelectedDrawingId(null);
      }
      return;
    }

    if (drawingsLocked) return;

    if (selectedTool === "eraser") {
      removeNearestDrawing(point);
      return;
    }

    if (selectedTool === "horizontalLine" || selectedTool === "verticalLine" || selectedTool === "crossLine") {
      finishDraft({
        id: createId("drawing"),
        tool: selectedTool,
        points: [point],
        color: "#9CA3AF",
      });
      return;
    }

    if (TEXT_TOOLS.includes(selectedTool)) {
      if (!chartContainerRef.current) return;
      const rect = chartContainerRef.current.getBoundingClientRect();
      setTextEditor({
        x: clamp(event.clientX - rect.left, 80, rect.width - 260),
        y: clamp(event.clientY - rect.top, 40, rect.height - 120),
        time: point.time,
        price: point.price,
        value: "",
        tool: selectedTool,
      });
      return;
    }

    if (selectedTool === "anchoredVwap") {
      const next = buildAnchoredVwap(point);
      if (next) finishDraft(next);
      return;
    }

    setDraftDrawing({
      id: createId("draft"),
      tool: selectedTool,
      points: [point, point],
      color: "#60A5FA",
    });
  }

  function handleDrawingPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    latestPointerRef.current = { x: event.clientX, y: event.clientY };
    if (drawingInteraction) {
      const point = getPointerPoint(event.clientX, event.clientY);
      if (!point) return;
      setDrawings((current) =>
        current.map((drawing) => {
          if (drawing.id !== drawingInteraction.drawingId) return drawing;
          const basePoints = drawingInteraction.originalPoints.map((currentPoint) => ({ ...currentPoint }));
          if (drawingInteraction.mode === "move") {
            const timeDelta = point.time - drawingInteraction.startPointer.time;
            const priceDelta = point.price - drawingInteraction.startPointer.price;
            return {
              ...drawing,
              points: basePoints.map((currentPoint) => ({
                time: currentPoint.time + timeDelta,
                price: currentPoint.price + priceDelta,
              })),
            };
          }
          const anchorIndex = drawingInteraction.mode === "anchor0" ? 0 : 1;
          basePoints[anchorIndex] = point;
          return {
            ...drawing,
            points: basePoints,
          };
        })
      );
      return;
    }
    if (!draftDrawing) return;
    const point = getPointerPoint(event.clientX, event.clientY);
    if (!point) return;
    setDraftDrawing((current) => (current ? { ...current, points: [current.points[0], point] } : current));
  }

  function handleDrawingPointerUp(event: React.PointerEvent<SVGSVGElement>) {
    if (drawingInteraction) {
      setDrawingInteraction(null);
      return;
    }
    if (!draftDrawing) return;
    const point = getPointerPoint(event.clientX, event.clientY);
    if (!point) {
      setDraftDrawing(null);
      return;
    }

    const finalized = { ...draftDrawing, points: [draftDrawing.points[0], point] };
    const [a, b] = finalized.points;
    const timeDiff = Math.abs(a.time - b.time);
    const priceDiff = Math.abs(a.price - b.price);
    const shouldDiscard = timeDiff < 1 && priceDiff < priceFormat.minMove * 0.5;
    if (shouldDiscard && finalized.tool !== "path") {
      setDraftDrawing(null);
      return;
    }
    finishDraft(finalized);
  }

  function removeDrawing(drawingId: string) {
    setDrawings((current) => current.filter((drawing) => drawing.id !== drawingId));
    setSelectedDrawingId((current) => (current === drawingId ? null : current));
  }

  const renderableDrawings = useMemo(() => (hideDrawings ? [] : drawings), [drawings, hideDrawings]);

  function renderDrawing(drawing: ChartDrawing, keyPrefix = "drawing") {
    const [a, b] = drawing.points;
    const ax = a ? timeToX(a.time) : null;
    const ay = a ? priceToY(a.price) : null;
    const bx = b ? timeToX(b.time) : null;
    const by = b ? priceToY(b.price) : null;
    const color = drawing.color ?? "#60A5FA";
    const commonStroke = { stroke: color, strokeWidth: 1.6, fill: "none" as const };

    if (ax == null || ay == null) return null;

    switch (drawing.tool) {
      case "horizontalLine":
        return <line key={`${keyPrefix}-${drawing.id}`} x1={0} y1={ay} x2={chartContainerRef.current?.clientWidth ?? 0} y2={ay} {...commonStroke} strokeDasharray="5 4" />;
      case "verticalLine":
        return <line key={`${keyPrefix}-${drawing.id}`} x1={ax} y1={0} x2={ax} y2={chartContainerRef.current?.clientHeight ?? 0} {...commonStroke} strokeDasharray="5 4" />;
      case "crossLine":
        return (
          <g key={`${keyPrefix}-${drawing.id}`}>
            <line x1={0} y1={ay} x2={chartContainerRef.current?.clientWidth ?? 0} y2={ay} {...commonStroke} strokeDasharray="5 4" />
            <line x1={ax} y1={0} x2={ax} y2={chartContainerRef.current?.clientHeight ?? 0} {...commonStroke} strokeDasharray="5 4" />
          </g>
        );
      case "trendLine":
        if (bx == null || by == null) return null;
        return <line key={`${keyPrefix}-${drawing.id}`} x1={ax} y1={ay} x2={bx} y2={by} {...commonStroke} />;
      case "infoLine":
        if (bx == null || by == null) return null;
        return (
          <g key={`${keyPrefix}-${drawing.id}`}>
            <line x1={ax} y1={ay} x2={bx} y2={by} {...commonStroke} />
            <rect
              x={(ax + bx) / 2 - 52}
              y={(ay + by) / 2 - 28}
              width={104}
              height={34}
              rx={8}
              fill="rgba(24,24,27,0.92)"
              stroke="rgba(255,255,255,0.14)"
            />
            <text x={(ax + bx) / 2} y={(ay + by) / 2 - 10} fill="#F4F4F5" fontSize="10" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">
              {formatPriceDistance(a.price, b.price, priceFormat.precision)}
            </text>
            <text x={(ax + bx) / 2} y={(ay + by) / 2 + 6} fill="#A1A1AA" fontSize="10" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">
              {formatDateRangeLabel(a.time, b.time)}
            </text>
          </g>
        );
      case "ray":
        if (bx == null || by == null) return null;
        {
          const width = chartContainerRef.current?.clientWidth ?? 0;
          const slope = bx === ax ? 0 : (by - ay) / (bx - ax);
          const endX = width;
          const endY = ay + slope * (endX - ax);
          return <line key={`${keyPrefix}-${drawing.id}`} x1={ax} y1={ay} x2={endX} y2={endY} {...commonStroke} />;
        }
      case "horizontalRay":
        return <line key={`${keyPrefix}-${drawing.id}`} x1={ax} y1={ay} x2={chartContainerRef.current?.clientWidth ?? 0} y2={ay} {...commonStroke} />;
      case "extendedLine":
        if (bx == null || by == null) return null;
        {
          const width = chartContainerRef.current?.clientWidth ?? 0;
          if (bx === ax) {
            return <line key={`${keyPrefix}-${drawing.id}`} x1={ax} y1={0} x2={ax} y2={chartContainerRef.current?.clientHeight ?? 0} {...commonStroke} />;
          }
          const slope = (by - ay) / (bx - ax);
          const startX = 0;
          const endX = width;
          const startY = ay + slope * (startX - ax);
          const endY = ay + slope * (endX - ax);
          return <line key={`${keyPrefix}-${drawing.id}`} x1={startX} y1={startY} x2={endX} y2={endY} {...commonStroke} />;
        }
      case "rectangle":
      case "measure":
      case "datePriceRange":
        if (bx == null || by == null) return null;
        {
          const x = Math.min(ax, bx);
          const y = Math.min(ay, by);
          const width = Math.abs(bx - ax);
          const height = Math.abs(by - ay);
          const measurement = drawing.tool !== "rectangle";
          return (
            <g key={`${keyPrefix}-${drawing.id}`}>
              <rect x={x} y={y} width={Math.max(width, 1)} height={Math.max(height, 1)} stroke={color} strokeWidth={1.5} fill={measurement ? "rgba(96,165,250,0.08)" : "rgba(96,165,250,0.10)"} strokeDasharray={measurement ? "6 4" : undefined} />
              {measurement && (
                <>
                  <text x={x + 8} y={y + 18} fill="#E4E4E7" fontSize="11" fontFamily="'JetBrains Mono', monospace">
                    {formatPriceDistance(a.price, b.price, priceFormat.precision)}
                  </text>
                  <text x={x + 8} y={y + 34} fill="#A1A1AA" fontSize="10" fontFamily="'JetBrains Mono', monospace">
                    {formatDateRangeLabel(a.time, b.time)}
                  </text>
                </>
              )}
            </g>
          );
        }
      case "ellipse":
        if (bx == null || by == null) return null;
        return (
          <ellipse
            key={`${keyPrefix}-${drawing.id}`}
            cx={(ax + bx) / 2}
            cy={(ay + by) / 2}
            rx={Math.abs(bx - ax) / 2}
            ry={Math.abs(by - ay) / 2}
            stroke={color}
            strokeWidth={1.5}
            fill="rgba(56,189,248,0.08)"
          />
        );
      case "circle":
        if (bx == null || by == null) return null;
        {
          const radius = Math.max(8, Math.min(Math.abs(bx - ax), Math.abs(by - ay)));
          return (
            <circle
              key={`${keyPrefix}-${drawing.id}`}
              cx={ax}
              cy={ay}
              r={radius}
              stroke={color}
              strokeWidth={1.5}
              fill="rgba(56,189,248,0.08)"
            />
          );
        }
      case "path":
        if (bx == null || by == null) return null;
        return <path key={`${keyPrefix}-${drawing.id}`} d={`M ${ax} ${ay} Q ${(ax + bx) / 2} ${Math.min(ay, by) - 36} ${bx} ${by}`} {...commonStroke} />;
      case "fibRetracement":
        if (bx == null || by == null) return null;
        {
          const x1 = Math.min(ax, bx);
          const x2 = Math.max(ax, bx);
          const minPrice = Math.min(a.price, b.price);
          const maxPrice = Math.max(a.price, b.price);
          return (
            <g key={`${keyPrefix}-${drawing.id}`}>
              {FIB_LEVELS.map((level) => {
                const levelPrice = maxPrice - (maxPrice - minPrice) * level;
                const y = priceToY(levelPrice);
                if (y == null) return null;
                return (
                  <g key={level}>
                    <line x1={x1} y1={y} x2={x2} y2={y} stroke={level === 0.5 ? "#FBBF24" : color} strokeWidth={level === 0.5 ? 1.8 : 1.2} strokeDasharray={level === 0.5 ? "3 2" : undefined} />
                    <text x={x2 + 6} y={y + 3} fill="#E4E4E7" fontSize="10" fontFamily="'JetBrains Mono', monospace">
                      {level.toFixed(level === 0 || level === 1 ? 0 : 3)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        }
      case "text":
      case "note":
      case "priceNote":
      case "callout":
      case "comment":
      case "priceLabel":
      case "pin":
      case "signpost":
      case "flagMark":
        {
          const chrome = getTextToolChrome(drawing.tool);
          const text = drawing.tool === "priceLabel" || drawing.tool === "priceNote"
            ? `${drawing.text || "Label"} ${a.price.toFixed(priceFormat.precision)}`
            : drawing.text || "Text";
          const width = Math.max(108, text.length * 7.1 + 18);
          const height = drawing.tool === "callout" || drawing.tool === "comment" || drawing.tool === "note" ? 42 : 26;
          const boxX = ax - 4;
          const boxY = ay - height + 6;
          return (
            <g key={`${keyPrefix}-${drawing.id}`}>
              {drawing.tool === "pin" ? <circle cx={ax - 6} cy={ay - 8} r={5} fill={chrome.stroke} /> : null}
              {drawing.tool === "signpost" || drawing.tool === "flagMark" ? <line x1={ax - 8} y1={ay - 16} x2={ax - 8} y2={ay + 8} stroke={chrome.stroke} strokeWidth={1.4} /> : null}
              <rect x={boxX} y={boxY} width={width} height={height} rx={8} fill={chrome.fill} stroke={chrome.stroke} />
              {drawing.tool === "callout" || drawing.tool === "comment" ? (
                <path d={`M ${ax + 10} ${boxY + height} L ${ax + 18} ${boxY + height + 10} L ${ax + 26} ${boxY + height}`} fill={chrome.fill} stroke={chrome.stroke} />
              ) : null}
              <text x={ax + 8} y={boxY + (height > 30 ? 18 : 17)} fill={chrome.text} fontSize="12" fontFamily="'Inter', sans-serif">
                {text}
              </text>
            </g>
          );
        }
      case "longPosition":
      case "shortPosition":
        if (bx == null || by == null) return null;
        {
          const geometry = getLongShortGeometry(drawing);
          if (!geometry) return null;
          const isSelected = selectedDrawingId === drawing.id;
          return (
            <g key={`${keyPrefix}-${drawing.id}`}>
              <rect x={geometry.x} y={Math.min(geometry.profitTop, geometry.profitBottom)} width={geometry.boxWidth} height={Math.abs(geometry.profitBottom - geometry.profitTop)} fill="rgba(34,197,94,0.18)" stroke="rgba(34,197,94,0.7)" />
              <rect x={geometry.x} y={Math.min(geometry.riskTop, geometry.riskBottom)} width={geometry.boxWidth} height={Math.abs(geometry.riskBottom - geometry.riskTop)} fill="rgba(239,68,68,0.18)" stroke="rgba(239,68,68,0.7)" />
              <line x1={geometry.x} y1={geometry.entryY} x2={geometry.x + geometry.boxWidth} y2={geometry.entryY} stroke="#E5E7EB" strokeWidth={1.4} strokeDasharray="5 3" />
              <text x={geometry.x + 8} y={Math.min(geometry.profitTop, geometry.profitBottom) + 16} fill="#DCFCE7" fontSize="11" fontFamily="'JetBrains Mono', monospace">
                TP {geometry.targetPrice.toFixed(priceFormat.precision)}
              </text>
              <text x={geometry.x + 8} y={Math.max(geometry.riskTop, geometry.riskBottom) - 8} fill="#FEE2E2" fontSize="11" fontFamily="'JetBrains Mono', monospace">
                SL {geometry.stopPrice.toFixed(priceFormat.precision)}
              </text>
              {isSelected ? (
                <g>
                  <rect
                    x={geometry.bounds.left}
                    y={geometry.bounds.top}
                    width={geometry.bounds.right - geometry.bounds.left}
                    height={geometry.bounds.bottom - geometry.bounds.top}
                    fill="none"
                    stroke="rgba(255,255,255,0.7)"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  />
                  <circle cx={geometry.leftHandle.x} cy={geometry.leftHandle.y} r={5.5} fill="#111827" stroke="#F9FAFB" strokeWidth={1.6} />
                  <circle cx={geometry.rightHandle.x} cy={geometry.rightHandle.y} r={5.5} fill="#111827" stroke="#F9FAFB" strokeWidth={1.6} />
                </g>
              ) : null}
            </g>
          );
        }
      case "priceRange":
        if (by == null) return null;
        {
          const y1 = ay;
          const y2 = by;
          return (
            <g key={`${keyPrefix}-${drawing.id}`}>
              <line x1={ax} y1={y1} x2={ax} y2={y2} {...commonStroke} />
              <line x1={ax - 10} y1={y1} x2={ax + 10} y2={y1} {...commonStroke} />
              <line x1={ax - 10} y1={y2} x2={ax + 10} y2={y2} {...commonStroke} />
              <text x={ax + 14} y={(y1 + y2) / 2} fill="#E4E4E7" fontSize="11" fontFamily="'JetBrains Mono', monospace">
                {formatPriceDistance(a.price, b.price, priceFormat.precision)}
              </text>
            </g>
          );
        }
      case "dateRange":
        if (bx == null) return null;
        {
          return (
            <g key={`${keyPrefix}-${drawing.id}`}>
              <line x1={ax} y1={ay} x2={bx} y2={ay} {...commonStroke} />
              <line x1={ax} y1={ay - 10} x2={ax} y2={ay + 10} {...commonStroke} />
              <line x1={bx} y1={ay - 10} x2={bx} y2={ay + 10} {...commonStroke} />
              <text x={(ax + bx) / 2} y={ay - 10} fill="#E4E4E7" fontSize="11" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">
                {formatDateRangeLabel(a.time, b.time)}
              </text>
            </g>
          );
        }
      case "anchoredVwap":
        {
          const anchorIndex = candles.findIndex((candle) => Math.floor(candle.timestamp / 1000) >= a.time);
          if (anchorIndex < 0) return null;
          let cumulativePv = 0;
          let cumulativeVolume = 0;
          const points = candles.slice(anchorIndex).map((candle) => {
            const typical = (candle.high + candle.low + candle.close) / 3;
            const volume = candle.volume ?? 1;
            cumulativePv += typical * volume;
            cumulativeVolume += volume;
            return {
              x: timeToX(Math.floor(candle.timestamp / 1000)),
              y: priceToY(cumulativeVolume > 0 ? cumulativePv / cumulativeVolume : candle.close),
            };
          }).filter((point) => point.x != null && point.y != null) as { x: number; y: number }[];
          if (points.length < 2) return null;
          const d = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
          return (
            <g key={`${keyPrefix}-${drawing.id}`}>
              <path d={d} stroke="#EAB308" strokeWidth={1.8} fill="none" />
              <circle cx={ax} cy={ay} r={4} fill="#EAB308" />
            </g>
          );
        }
      default:
        return null;
    }
  }

  useEffect(() => {
    if (!candleSeriesRef.current || !chartRef.current || candles.length === 0) return;

    const lastSourceCandle = candles[candles.length - 1];
    const lastCandleKey = `${lastSourceCandle.timestamp}-${lastSourceCandle.open}-${lastSourceCandle.high}-${lastSourceCandle.low}-${lastSourceCandle.close}`;
    if (lastCandleKey === prevDataRef.current) return;
    prevDataRef.current = lastCandleKey;

    const needsFullRedraw =
      prevCandlesLengthRef.current === 0 ||
      Math.abs(candles.length - prevCandlesLengthRef.current) > 5 ||
      (prevFirstTimestampRef.current !== null && candles[0]?.timestamp !== prevFirstTimestampRef.current);

    if (needsFullRedraw) {
      const chartData = candles.map((c) => ({
        time: (c.timestamp / 1000) as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      candleSeriesRef.current.setData(chartData);
      applyMarkers(tradesRef.current);
      setTimeout(() => {
        if (tradesRef.current.length > 0) {
          applyMarkers(tradesRef.current);
        }
      }, 100);
      prevCandlesLengthRef.current = candles.length;
      prevFirstTimestampRef.current = candles[0]?.timestamp ?? null;
      return;
    }

    const lastCandle = {
      time: (lastSourceCandle.timestamp / 1000) as Time,
      open: lastSourceCandle.open,
      high: lastSourceCandle.high,
      low: lastSourceCandle.low,
      close: lastSourceCandle.close,
    };
    if (lastCandle) {
      candleSeriesRef.current.update(lastCandle);
    }

    if (candles.length > prevCandlesLengthRef.current) {
      prevCandlesLengthRef.current = candles.length;
    }
  }, [candles]);

  useEffect(() => {
    if (!candleIntervalMs || candleIntervalMs <= 0 || candles.length === 0) {
      setCandleCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const lastCandle = candles[candles.length - 1];
      if (!lastCandle || !Number.isFinite(lastCandle.timestamp)) {
        setCandleCountdown(null);
        return;
      }

      const now = Date.now();
      const nextFromLastCandle = lastCandle.timestamp + candleIntervalMs;
      const remainingMs =
        now <= nextFromLastCandle + candleIntervalMs
          ? Math.max(0, nextFromLastCandle - now)
          : candleIntervalMs - (now % candleIntervalMs || candleIntervalMs);
      const y = candleSeriesRef.current?.priceToCoordinate(lastCandle.close) ?? null;

      setCandleCountdown({
        label: marketIsActive === false ? "-" : formatCountdown(remainingMs),
        top: typeof y === "number" ? clamp(y, 18, Math.max(18, overlaySize.height - 18)) : null,
      });
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1_000);
    return () => window.clearInterval(timer);
  }, [candles, candleIntervalMs, marketIsActive, overlaySize.height, viewportVersion]);

  useEffect(() => {
    tradesRef.current = trades || [];
    applyMarkers(tradesRef.current);
  }, [trades]);

  useEffect(() => {
    levelsRef.current = levels || [];
    applyLevels(levelsRef.current);
  }, [levels]);

  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const themeStyles = window.getComputedStyle(document.documentElement);
    const crosshairColor =
      themeStyles.getPropertyValue("--crosshair-color").trim()
      || "rgba(214,180,95,.42)";
    const crosshairLabelColor =
      themeStyles.getPropertyValue("--surface").trim()
      || "#18181B";

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: settings.backgroundColor },
        textColor: "#9CA3AF",
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: settings.gridLines ? settings.gridColor : "transparent" },
        horzLines: { color: settings.gridLines ? settings.gridColor : "transparent" },
      },
      rightPriceScale: {
        borderColor: "#1A1A1D",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "#1A1A1D",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 0,
        vertLine: {
          visible: true,
          width: 1,
          color: crosshairColor,
          style: 0,
          labelVisible: true,
          labelBackgroundColor: crosshairLabelColor,
        },
        horzLine: {
          visible: false,
          labelVisible: false,
        },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });
    setOverlaySize({
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: settings.upColor,
      downColor: settings.downColor,
      borderUpColor: settings.borderUpColor,
      borderDownColor: settings.borderDownColor,
      wickUpColor: settings.wickUpColor,
      wickDownColor: settings.wickDownColor,
      priceFormat,
      crosshairMarkerVisible: false,
    } as Parameters<typeof chart.addCandlestickSeries>[0] & { crosshairMarkerVisible: boolean });
    candleSeriesRef.current = candleSeries;

    const chartData = candles.map((c) => ({
      time: (c.timestamp / 1000) as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeries.setData(chartData);
    applyMarkers(tradesRef.current);
    applyLevels(levelsRef.current);
    setTimeout(() => {
      if (tradesRef.current.length > 0) {
        applyMarkers(tradesRef.current);
      }
      if (levelsRef.current.length > 0) {
        applyLevels(levelsRef.current);
      }
    }, 100);
    chart.timeScale().fitContent();
    candleSeries.priceScale().applyOptions({
      autoScale: false,
    });
    prevCandlesLengthRef.current = candles.length;
    prevFirstTimestampRef.current = candles[0]?.timestamp ?? null;
    const lastCandle = candles[candles.length - 1];
    prevDataRef.current = lastCandle ? `${lastCandle.timestamp}-${lastCandle.close}` : "";

    const container = chartContainerRef.current;
    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const y = event.clientY - rect.top;

      if (event.buttons !== 0) {
        scheduleViewportRefresh();
      }

      if (horzLineRef.current) {
        horzLineRef.current.style.top = `${y}px`;
        horzLineRef.current.style.display = "block";
      }

      if (priceLabelRef.current) {
        const price = candleSeries.coordinateToPrice(y);
        if (price !== null) {
          priceLabelRef.current.style.top = `${y - 10}px`;
          priceLabelRef.current.style.display = "block";
          priceLabelRef.current.textContent = price.toFixed(priceFormat.precision);
        }
      }
    };

    const handleMouseLeave = () => {
      if (horzLineRef.current) horzLineRef.current.style.display = "none";
      if (priceLabelRef.current) priceLabelRef.current.style.display = "none";
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const rect = chartContainerRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      let price = "";

      try {
        const priceValue = candleSeriesRef.current?.coordinateToPrice(y);
        price = priceValue ? priceValue.toFixed(priceFormat.precision) : "";
      } catch {
        price = "";
      }

      setContextMenu({ x, y, price });
    };

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const width = chartContainerRef.current.clientWidth;
        const height = chartContainerRef.current.clientHeight;
        chartRef.current.applyOptions({
          width,
          height,
        });
        setOverlaySize({ width, height });
      }
    };

    const scheduleViewportRefresh = () => {
      if (viewportFrameRef.current != null) return;
      viewportFrameRef.current = window.requestAnimationFrame(() => {
        viewportFrameRef.current = null;
        setViewportVersion((current) => current + 1);
      });
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);
    container.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("resize", handleResize);
    chart.timeScale().subscribeVisibleLogicalRangeChange(scheduleViewportRefresh);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      container.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("resize", handleResize);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(scheduleViewportRefresh);
      resizeObserver.disconnect();
      if (viewportFrameRef.current != null) {
        window.cancelAnimationFrame(viewportFrameRef.current);
        viewportFrameRef.current = null;
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      candleSeriesRef.current = null;
      priceLinesRef.current = [];
      prevCandlesLengthRef.current = 0;
      prevFirstTimestampRef.current = null;
      prevDataRef.current = "";
    };
  }, [instrument, priceFormat, settings, themeVersion]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTypingContext =
        tagName === "input" ||
        tagName === "textarea" ||
        target?.isContentEditable;

      if (event.key === "Escape") {
        setContextMenu(null);
        setOpenToolbarGroup(null);
        setDraftDrawing(null);
        setTextEditor(null);
        setDrawingInteraction(null);
        setSelectedDrawingId(null);
      }
      if (!isTypingContext && (event.key === "Delete" || event.key === "Backspace") && selectedDrawingId) {
        event.preventDefault();
        removeDrawing(selectedDrawingId);
        return;
      }
      if (!isTypingContext && (event.key === "Delete" || event.key === "Backspace") && showObjectsPanel && drawings.length > 0) {
        event.preventDefault();
        setDrawings((current) => current.slice(0, -1));
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [drawings.length, selectedDrawingId, showObjectsPanel]);

  useEffect(() => {
    if (!contextMenu) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (contextMenuRef.current?.contains(target)) return;
      setContextMenu(null);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [contextMenu]);

  const toolbarGroups = useMemo(
    () =>
      DRAWING_TOOLBAR_GROUPS.map((group) => ({
        ...group,
        isActive: activeToolbarTool?.groupId === group.id,
      })),
    [activeToolbarTool]
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = toolbarDragStateRef.current;
      const container = chartContainerRef.current;
      if (!drag || !container) return;
      const movedX = event.clientX - drag.startClientX;
      const movedY = event.clientY - drag.startClientY;
      if (!drag.hasMoved && Math.hypot(movedX, movedY) < 4) return;
      if (!drag.hasMoved) {
        drag.hasMoved = true;
        toolbarToggleSuppressedRef.current = true;
      }
      const rect = container.getBoundingClientRect();
      setToolbarDragPosition({
        x: event.clientX - rect.left - drag.offsetX,
        y: event.clientY - rect.top - drag.offsetY,
      });
    };

    const onPointerUp = (event: PointerEvent) => {
      const drag = toolbarDragStateRef.current;
      const container = chartContainerRef.current;
      if (!drag || !container) return;
      if (!drag.hasMoved) {
        toolbarDragStateRef.current = null;
        setToolbarDragPosition(null);
        return;
      }
      const rect = container.getBoundingClientRect();
      const distances: Record<ToolbarDock, number> = {
        left: Math.abs(event.clientX - rect.left),
        right: Math.abs(rect.right - event.clientX),
        top: Math.abs(event.clientY - rect.top),
        bottom: Math.abs(rect.bottom - event.clientY),
      };
      const nextDock = (Object.entries(distances).sort((a, b) => a[1] - b[1])[0]?.[0] ?? "left") as ToolbarDock;
      toolbarDragStateRef.current = null;
      setToolbarDragPosition(null);
      setToolbarDock(nextDock);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  return (
    <div ref={chartContainerRef} className="relative h-full w-full overflow-hidden">
      {gammaLevelsEnabled && gammaLevelsLoading ? (
        <div className="pointer-events-none absolute inset-0 z-[19] flex items-center justify-center">
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 rounded-xl border border-primary/25 bg-panel/92 px-4 py-3 text-left shadow-2xl shadow-black/35 backdrop-blur-md"
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
            <span>
              <span className="block text-[12px] font-semibold text-foreground">Loading {instrument} gamma levels…</span>
              <span className="mt-0.5 block text-[9px] uppercase tracking-[0.14em] text-muted">Syncing current levels</span>
            </span>
          </div>
        </div>
      ) : null}
      <div
        ref={horzLineRef}
        style={{
          display: "none",
          position: "absolute",
          left: 0,
          right: 60,
          height: "1px",
          backgroundColor: "var(--crosshair-color)",
          pointerEvents: "none",
          zIndex: 5,
        }}
      />
      <div
        ref={priceLabelRef}
        style={{
          display: "none",
          position: "absolute",
          right: 0,
          width: 60,
          height: 20,
          backgroundColor: "var(--surface)",
          color: "var(--muted)",
          fontSize: "11px",
          fontFamily: "monospace",
          textAlign: "center",
          lineHeight: "20px",
          pointerEvents: "none",
          zIndex: 5,
        }}
      />

      {candleCountdown ? (
        <div
          className="pointer-events-none absolute bottom-14 right-[76px] z-10 flex h-7 w-[54px] items-center justify-center rounded-lg bg-primary px-1.5 font-mono text-[10px] font-semibold leading-none text-background shadow-lg shadow-black/25"
          title="Time until next candle opens"
        >
          {candleCountdown.label}
        </div>
      ) : null}

      {toolbarEnabled && (
      <div
        ref={toolbarRef}
        className={`absolute z-20 flex ${toolbarDock === "top" || toolbarDock === "bottom" ? "flex-row items-center" : "flex-col"}`}
        style={{ ...toolbarDockStyle, gap: toolbarMetrics.gap }}
      >
        <button
          type="button"
          onClick={() => {
            if (toolbarToggleSuppressedRef.current) {
              toolbarToggleSuppressedRef.current = false;
              return;
            }
            setOpenToolbarGroup(null);
            setShowObjectsPanel(false);
            setToolbarCollapsed((current) => !current);
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const container = chartContainerRef.current;
            const toolbar = toolbarRef.current;
            if (!container || !toolbar) return;
            const rect = container.getBoundingClientRect();
            const toolbarRect = toolbar.getBoundingClientRect();
            const currentStyle = {
              x: toolbarRect.left - rect.left,
              y: toolbarRect.top - rect.top,
            };
            toolbarDragStateRef.current = {
              offsetX: event.clientX - toolbarRect.left,
              offsetY: event.clientY - toolbarRect.top,
              startClientX: event.clientX,
              startClientY: event.clientY,
              hasMoved: false,
            };
            setOpenToolbarGroup(null);
            setToolbarDragPosition({
              x: currentStyle.x,
              y: currentStyle.y,
            });
          }}
          className="flex items-center justify-center border border-transparent bg-panel/70 text-muted backdrop-blur transition-all hover:bg-surface hover:text-foreground"
          style={{ width: toolbarMetrics.buttonSize, height: toolbarMetrics.buttonSize, borderRadius: toolbarMetrics.radius }}
          title={toolbarCollapsed ? "Expand toolbar" : "Collapse toolbar. Drag to dock on another chart edge"}
          aria-pressed={toolbarCollapsed}
        >
          <span className="grid grid-cols-2" style={{ gap: Math.max(2, Math.round(toolbarMetrics.gap / 2)) }} aria-hidden="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <span
                key={index}
                className="rounded-full bg-current/85"
                style={{ width: toolbarMetrics.iconSize <= 15 ? 5 : 6, height: toolbarMetrics.iconSize <= 15 ? 5 : 6 }}
              />
            ))}
          </span>
        </button>
        <button
          type="button"
          draggable={chartDragEnabled}
          onDragStart={onChartDragStart}
          onDragEnd={onChartDragEnd}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className={`flex items-center justify-center border backdrop-blur transition-all ${
            chartDragEnabled
              ? "cursor-grab border-border bg-panel/80 text-muted hover:border-primary/40 hover:bg-surface hover:text-primary active:cursor-grabbing"
              : "cursor-not-allowed border-transparent bg-panel/45 text-muted/30"
          }`}
          style={{ width: toolbarMetrics.buttonSize, height: toolbarMetrics.buttonSize, borderRadius: toolbarMetrics.radius }}
          title={chartDragEnabled ? "Drag this chart onto another chart to swap positions" : "Unlock the workspace and add another chart to reorder"}
          aria-label="Reorder chart"
        >
          <span className="grid grid-cols-2 gap-[3px]" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <span key={index} className="h-[3px] w-[3px] rounded-full bg-current" />
            ))}
          </span>
        </button>
        {!toolbarCollapsed &&
          toolbarGroups.map((group) => {
          const GroupIcon = group.icon;
          const groupedSections = groupToolsBySection(group.tools);
          return (
            <div key={group.id} className="relative">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenToolbarGroup((current) => (current === group.id ? null : group.id));
                }}
                className={`flex items-center justify-center border backdrop-blur ${getToolbarButtonTone(group.isActive || openToolbarGroup === group.id)}`}
                style={{ width: toolbarMetrics.buttonSize, height: toolbarMetrics.buttonSize, borderRadius: toolbarMetrics.radius }}
                title={group.label}
              >
                <GroupIcon className={toolbarIconClassName} />
              </button>
              {openToolbarGroup === group.id && (
                <div
                  className={`absolute z-30 overflow-hidden rounded-2xl border border-border bg-panel/95 shadow-2xl backdrop-blur ${getToolbarMenuPositionClasses(toolbarDock)}`}
                  style={toolbarMenuStyle}
                >
                  <div className="border-b border-border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    {group.label}
                  </div>
                  <div className="overflow-y-auto p-2" style={{ maxHeight: toolbarMetrics.menuMaxHeight }}>
                    {groupedSections.map((section, sectionIndex) => (
                      <div key={`${group.id}-${section.section}`} className={sectionIndex > 0 ? "mt-2 border-t border-border pt-2" : ""}>
                        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                          {section.section}
                        </div>
                        {section.tools.map((tool) => {
                          const ToolIcon = tool.icon;
                          const active = selectedTool === tool.id;
                          const implemented = tool.implemented === true;
                          return (
                            <button
                              key={tool.id}
                              type="button"
                              aria-disabled={!implemented}
                              onClick={() => {
                                if (!implemented) return;
                                setSelectedTool(tool.id);
                                setOpenToolbarGroup(null);
                              }}
                              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] transition-all ${
                                active
                                  ? "bg-primary/12 text-foreground"
                                  : implemented
                                    ? "text-muted hover:bg-surface hover:text-foreground"
                                    : "cursor-not-allowed text-muted/55"
                              }`}
                            >
                              <ToolIcon className={`${toolbarToolIconClassName} ${active ? "text-primary" : implemented ? "text-muted" : "text-muted/45"}`} />
                              <span className="flex-1 font-medium">{tool.label}</span>
                              {tool.shortcut ? <span className="text-[12px] text-muted">{tool.shortcut}</span> : null}
                              {!implemented && !tool.shortcut ? <span className="text-[11px] uppercase tracking-[0.14em] text-muted/50">Soon</span> : null}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
          })}

        {!toolbarCollapsed && (
          <div
            className="bg-border/70"
            style={
              toolbarDock === "top" || toolbarDock === "bottom"
                ? { width: 1, height: toolbarMetrics.buttonSize, marginInline: Math.max(2, Math.round(toolbarMetrics.gap / 2)) }
                : { height: 1, width: toolbarMetrics.buttonSize, marginBlock: Math.max(2, Math.round(toolbarMetrics.gap / 2)) }
            }
          />
        )}

        {!toolbarCollapsed && (
          <>
            <button
              type="button"
              disabled={!gammaLevelsAvailable || !onToggleGammaLevels}
              onClick={(event) => {
                event.stopPropagation();
                onToggleGammaLevels?.();
              }}
              className={`flex items-center justify-center border backdrop-blur ${
                gammaLevelsAvailable
                  ? getToolbarButtonTone(gammaLevelsEnabled)
                  : "cursor-not-allowed border-transparent bg-panel/45 text-muted/30"
              }`}
              style={{ width: toolbarMetrics.buttonSize, height: toolbarMetrics.buttonSize, borderRadius: toolbarMetrics.radius }}
              title={
                gammaLevelsAvailable
                  ? gammaLevelsError
                    ? `Gamma levels: ${gammaLevelsError}`
                    : gammaLevelsLoading
                      ? "Loading current gamma levels"
                      : gammaLevelsEnabled
                        ? "Hide gamma levels"
                        : "Show gamma levels"
                  : "Gamma levels are available on NQ, MNQ, ES and MES"
              }
              aria-label={gammaLevelsEnabled ? "Hide gamma levels" : "Show gamma levels"}
              aria-pressed={gammaLevelsEnabled}
            >
              <ScanLine className={`${toolbarIconClassName} ${gammaLevelsLoading ? "animate-pulse" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => setMagnetMode((current) => (current === "off" ? "weak" : current === "weak" ? "strong" : "off"))}
              className={`flex items-center justify-center border backdrop-blur ${getToolbarButtonTone(magnetMode !== "off")}`}
              style={{ width: toolbarMetrics.buttonSize, height: toolbarMetrics.buttonSize, borderRadius: toolbarMetrics.radius }}
              title={`Magnet: ${magnetMode}`}
            >
              <Magnet className={toolbarIconClassName} />
            </button>
            <button
              type="button"
              onClick={() => setDrawingsLocked((current) => !current)}
              className={`flex items-center justify-center border backdrop-blur ${getToolbarButtonTone(drawingsLocked)}`}
              style={{ width: toolbarMetrics.buttonSize, height: toolbarMetrics.buttonSize, borderRadius: toolbarMetrics.radius }}
              title={drawingsLocked ? "Unlock drawings" : "Lock drawings"}
            >
              <Lock className={toolbarIconClassName} />
            </button>
            <button
              type="button"
              onClick={() => setHideDrawings((current) => !current)}
              className={`flex items-center justify-center border backdrop-blur ${getToolbarButtonTone(hideDrawings)}`}
              style={{ width: toolbarMetrics.buttonSize, height: toolbarMetrics.buttonSize, borderRadius: toolbarMetrics.radius }}
              title={hideDrawings ? "Show drawings" : "Hide drawings"}
            >
              <Eye className={toolbarIconClassName} />
            </button>
            <button
              type="button"
              onClick={() => setShowObjectsPanel((current) => !current)}
              className={`flex items-center justify-center border backdrop-blur ${getToolbarButtonTone(showObjectsPanel)}`}
              style={{ width: toolbarMetrics.buttonSize, height: toolbarMetrics.buttonSize, borderRadius: toolbarMetrics.radius }}
              title="Object list"
            >
              <Link2 className={toolbarIconClassName} />
            </button>
            <button
              type="button"
              onClick={() => setClearConfirm(true)}
              className="flex items-center justify-center border border-transparent bg-panel/70 text-muted backdrop-blur transition-all hover:bg-danger/10 hover:text-danger"
              style={{ width: toolbarMetrics.buttonSize, height: toolbarMetrics.buttonSize, borderRadius: toolbarMetrics.radius }}
              title="Clear drawings"
            >
              <Trash2 className={toolbarIconClassName} />
            </button>
          </>
        )}
      </div>
      )}

      {toolbarEnabled && !toolbarCollapsed && showObjectsPanel && (
        <div className="absolute z-20 overflow-hidden rounded-2xl border border-border bg-panel/96 shadow-2xl backdrop-blur" style={objectsPanelStyle}>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">Objects</div>
              <div className="mt-1 text-[13px] text-foreground">{renderableDrawings.length} drawing{renderableDrawings.length === 1 ? "" : "s"}</div>
            </div>
            <button type="button" onClick={() => setShowObjectsPanel(false)} className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-2">
            {drawings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted">
                No drawings yet
              </div>
            ) : (
              drawings.map((drawing) => (
                <div key={drawing.id} className="mb-2 flex items-center justify-between rounded-xl border border-border bg-surface/70 px-3 py-2.5">
                  <div>
                    <div className="text-[13px] font-medium text-foreground">
                      {DRAWING_TOOLBAR_GROUPS.flatMap((group) => group.tools).find((tool) => tool.id === drawing.tool)?.label ?? drawing.tool}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted">
                      {drawing.tool === "text" && drawing.text ? drawing.text : `${drawing.points.length} point${drawing.points.length === 1 ? "" : "s"}`}
                    </div>
                  </div>
                  <button type="button" onClick={() => removeDrawing(drawing.id)} className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {textEditor && (
        <div
          className="absolute z-30 w-64 rounded-2xl border border-border bg-panel/96 p-3 shadow-2xl backdrop-blur"
          style={{ left: textEditor.x, top: textEditor.y }}
        >
          {(() => {
            const chrome = getTextToolChrome(textEditor.tool);
            return (
              <>
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
            <Type className="h-3.5 w-3.5" />
            {chrome.title}
          </div>
          <textarea
            autoFocus
            value={textEditor.value}
            onChange={(event) => setTextEditor((current) => (current ? { ...current, value: event.target.value } : current))}
            placeholder={chrome.placeholder}
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary/40"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setTextEditor(null)}
              className="rounded-xl border border-border bg-surface px-3 py-2 text-[12px] text-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!textEditor.value.trim()) {
                  setTextEditor(null);
                  return;
                }
                finishDraft({
                  id: createId("drawing"),
                  tool: textEditor.tool,
                  points: [{ time: textEditor.time, price: textEditor.price }],
                  text: textEditor.value.trim(),
                  color: chrome.stroke,
                });
                setTextEditor(null);
              }}
              className="rounded-xl bg-primary px-3 py-2 text-[12px] font-semibold text-background"
            >
              Add
            </button>
          </div>
              </>
            );
          })()}
        </div>
      )}

      <svg
        ref={overlayRef}
        className={`absolute inset-0 z-[12] ${selectedTool === "cursor" ? "pointer-events-none" : "pointer-events-auto"}`}
        width={overlaySize.width || undefined}
        height={overlaySize.height || undefined}
        viewBox={`0 0 ${Math.max(overlaySize.width, 1)} ${Math.max(overlaySize.height, 1)}`}
        preserveAspectRatio="none"
        style={{ touchAction: "none" }}
        onPointerDown={handleDrawingPointerDown}
        onPointerMove={handleDrawingPointerMove}
        onPointerUp={handleDrawingPointerUp}
        onContextMenu={(event) => {
          event.preventDefault();
          const point = getPointerPoint(event.clientX, event.clientY);
          setContextMenu({
            x: event.clientX - (chartContainerRef.current?.getBoundingClientRect().left ?? 0),
            y: event.clientY - (chartContainerRef.current?.getBoundingClientRect().top ?? 0),
            price: point ? point.price.toFixed(priceFormat.precision) : "",
          });
        }}
      >
        <rect
          x={0}
          y={0}
          width="100%"
          height="100%"
          fill="transparent"
          pointerEvents={selectedTool === "cursor" ? "none" : "all"}
        />
        {renderableDrawings.map((drawing) => renderDrawing(drawing))}
        {draftDrawing && renderDrawing(draftDrawing, "draft")}
      </svg>

      {toolbarEnabled && activeToolbarTool && selectedTool !== "cursor" && (
        <div className="absolute left-16 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-border bg-panel/92 px-3 py-2 text-[12px] text-muted shadow-lg backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-foreground">{activeToolbarTool.label}</span>
          <span>Click or drag on chart</span>
        </div>
      )}

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="absolute z-50 w-[280px] rounded-xl border border-border bg-panel py-2 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onMouseDown={(e) => {
              e.stopPropagation();
              chartRef.current?.timeScale().fitContent();
              setContextMenu(null);
            }}
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface"
          >
            <RotateCcw className="h-4 w-4 text-muted" />
            <span className="flex-1 text-left">Reset chart view</span>
            <span className="text-[11px] text-muted">Alt+R</span>
          </button>
          <button
            onMouseDown={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(contextMenu.price);
              setCopiedPrice(true);
              setTimeout(() => setCopiedPrice(false), 1000);
            }}
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface"
          >
            <Copy className="h-4 w-4 text-muted" />
            <span className="flex-1 text-left">{copiedPrice ? "Copied!" : "Copy price " + contextMenu.price}</span>
          </button>
          <div className="my-1 border-t border-border" />
          <button
            onMouseDown={(e) => {
              e.stopPropagation();
              if (contextMenu.price) {
                onCreateAlertAtPrice?.(contextMenu.price);
              }
              setContextMenu(null);
            }}
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface"
          >
            <Bell className="h-4 w-4 text-muted" />
            <span className="flex-1 text-left">Add alert at {contextMenu.price}...</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onRemoveAllIndicators?.();
              window.dispatchEvent(new CustomEvent("kwantify:remove-all-indicators"));
              setContextMenu(null);
            }}
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface"
          >
            <Trash2 className="h-4 w-4 text-muted" />
            <span className="flex-1 text-left">Remove all indicators from chart</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setClearConfirm(true);
              setContextMenu(null);
            }}
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface"
          >
            <Trash2 className="h-4 w-4 text-muted" />
            <span className="flex-1 text-left">Clear drawings</span>
          </button>
          <button onMouseDown={(e) => e.stopPropagation()} className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <span className="flex-1 text-left">Buy 1 {instrument} @ {contextMenu.price}</span>
          </button>
          <button onMouseDown={(e) => e.stopPropagation()} className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface">
            <ShoppingCart className="h-4 w-4 text-danger" />
            <span className="flex-1 text-left">Sell 1 {instrument} @ {contextMenu.price}</span>
          </button>
          <div className="my-1 border-t border-border" />
          <button
            onMouseDown={(e) => {
              e.stopPropagation();
              setContextMenu(null);
              onOpenSettings?.();
            }}
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-surface"
          >
            <Settings2 className="h-4 w-4 text-muted" />
            <span className="flex-1 text-left">Chart settings...</span>
          </button>
        </div>
      )}

      {clearConfirm && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[320px] rounded-2xl border border-border bg-panel p-5 shadow-2xl">
            <div className="mb-2 text-[16px] font-semibold text-foreground">Clear drawings?</div>
            <div className="text-[13px] leading-6 text-muted">
              This will remove all chart drawings for <span className="font-medium text-foreground">{instrument}</span>.
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setClearConfirm(false)} className="rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted hover:text-foreground">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setDrawings([]);
                  setDraftDrawing(null);
                  setClearConfirm(false);
                }}
                className="rounded-xl bg-danger px-4 py-2 text-[13px] font-semibold text-white"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
