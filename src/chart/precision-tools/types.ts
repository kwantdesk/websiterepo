import type { Candle } from "@/lib/backtester";
import type { InstitutionalTrade } from "@/lib/institutionalMarketData";

export const PRECISION_TOOL_IDS = [
  "precision-line",
  "precision-ray",
  "precision-horizontal-line",
  "precision-vertical-line",
  "precision-parallel-line",
  "precision-rectangle",
  "precision-ellipse",
  "precision-text",
  "precision-pencil",
  "precision-fibonacci-retracement",
  "precision-fibonacci-projection",
  "precision-fibonacci-fan",
  "precision-ruler",
  "precision-volume-profile",
  "precision-anchored-vwap",
  "precision-buy-calculator",
  "precision-sell-calculator",
] as const;

export type PrecisionToolId = (typeof PRECISION_TOOL_IDS)[number];
export type PrecisionToolGroupId = "geometry" | "shapes-notes" | "fibonacci" | "analysis" | "trade-calculators";
export type PrecisionMode = "select" | "crosshair" | "global-crosshair" | "hand" | "zoom-range" | "place";
export type PrecisionSnapMode = "off" | "weak" | "strong";
export type PrecisionLineStyle = "solid" | "dashed" | "dotted";
export type PrecisionLabelPosition = "start" | "middle" | "end" | "top" | "bottom";

export interface PrecisionAnchor {
  time: number;
  logicalIndex: number;
  price: number;
}

export interface PrecisionStyle {
  stroke: string;
  strokeWidth: number;
  lineStyle: PrecisionLineStyle;
  opacity: number;
  fill: string;
  fillOpacity: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
  positiveColor: string;
  negativeColor: string;
  neutralColor: string;
  valueAreaColor: string;
  pocColor: string;
}

export interface PrecisionLabelOptions {
  visible: boolean;
  text: string;
  position: PrecisionLabelPosition;
  showPrice: boolean;
  showTime: boolean;
  showMetrics: boolean;
}

export interface PrecisionVisibility {
  visible: boolean;
  locked: boolean;
  timeframes: string[];
  minZoom: number | null;
  maxZoom: number | null;
}

export interface PrecisionAlert {
  id: string;
  enabled: boolean;
  condition: "cross" | "cross-up" | "cross-down" | "enter" | "exit";
  once: boolean;
  message: string;
  lastTriggeredAt: number | null;
}

export interface PrecisionObject {
  schemaVersion: 1;
  id: string;
  toolId: PrecisionToolId;
  name: string;
  anchors: PrecisionAnchor[];
  path?: PrecisionAnchor[];
  text?: string;
  style: PrecisionStyle;
  labels: PrecisionLabelOptions;
  visibility: PrecisionVisibility;
  alert: PrecisionAlert | null;
  configSlot: number;
  options: Record<string, number | string | boolean | number[]>;
  createdAt: number;
  updatedAt: number;
  zIndex: number;
}

export interface PrecisionToolDefinition {
  id: PrecisionToolId;
  label: string;
  shortLabel: string;
  groupId: PrecisionToolGroupId;
  anchorCount: number;
  supportsPath?: boolean;
  shortcut?: string;
  description: string;
}

export interface PrecisionToolConfig {
  schemaVersion: 1;
  toolId: PrecisionToolId;
  slot: number;
  name: string;
  style: PrecisionStyle;
  labels: PrecisionLabelOptions;
  options: Record<string, number | string | boolean | number[]>;
  updatedAt: number;
}

export interface PrecisionToolbarState {
  collapsed: boolean;
  hidden: boolean;
  locked: boolean;
  snapMode: PrecisionSnapMode;
  activeGroup: PrecisionToolGroupId | null;
  activeTool: PrecisionToolId | null;
  mode: PrecisionMode;
  activeConfigSlot: number;
  activeConfigSlots: Partial<Record<PrecisionToolId, number>>;
  visibleGroups: PrecisionToolGroupId[];
}

export interface PrecisionDocument {
  schemaVersion: 1;
  workspaceId: string;
  chartId: string;
  objects: PrecisionObject[];
  savedAt: number;
}

export interface PrecisionTheme {
  background: string;
  panel: string;
  surface: string;
  border: string;
  foreground: string;
  muted: string;
  primary: string;
  bullish: string;
  bearish: string;
}

export interface PrecisionChartAdapter {
  width: number;
  height: number;
  priceScaleWidth: number;
  timeScaleHeight: number;
  minMove: number;
  precision: number;
  pointValue: number;
  instrument: string;
  timeframe: string;
  pixelsPerBar: number;
  candles: Candle[];
  trades: InstitutionalTrade[];
  timeToX: (time: number, logicalIndex?: number) => number | null;
  xToAnchor: (x: number, y: number) => PrecisionAnchor | null;
  priceToY: (price: number) => number | null;
  yToPrice: (y: number) => number | null;
  setVisibleTimeRange: (startMs: number, endMs: number) => void;
  requestChartRender: () => void;
  /**
   * Subscribe to the chart's own paint pass.
   *
   * The layer's canvas used to redraw from a React effect keyed on the
   * adapter, which is rebuilt from throttled state — so every drawing was a
   * frame or more behind the candles and visibly floated while the chart was
   * panned. Redrawing on this signal puts the canvas back in step with the
   * bars, because the adapter's projections read the chart live.
   */
  subscribeViewport?: (listener: () => void) => () => void;
}

export interface PrecisionScreenPoint { x: number; y: number }

export interface PrecisionHit {
  objectId: string;
  kind: "body" | "anchor" | "resize";
  handleIndex?: number;
  distance: number;
}

export interface PrecisionMetrics {
  title: string;
  lines: string[];
  warning?: string;
}

export interface PrecisionStoreSnapshot {
  objects: PrecisionObject[];
  selectedIds: string[];
  draft: PrecisionObject | null;
  toolbar: PrecisionToolbarState;
  revision: number;
}
