import type { GexBoxSurface, OrderflowMetric } from "@/lib/gex-box/domain";

export const GEX_BOX_SETTINGS_VERSION = 1;

export type GexBoxSettings = {
  version: 1;
  surface: GexBoxSurface;
  ticker: string;
  expiryMode: "aggregate_90d" | "latest" | "next" | "combined";
  dataset: "volume" | "open_interest" | "both";
  stateMetric: "gex" | "gamma" | "delta" | "convexity" | "negative_vanna" | "charm";
  showSpot: boolean;
  showZeroGamma: boolean;
  showMajorPositive: boolean;
  showMajorNegative: boolean;
  showLookbacks: boolean;
  showInspector: boolean;
  showGrid: boolean;
  lineWidth: number;
  dotSize: number;
  historyMinutes: number;
  orderflowMetrics: [OrderflowMetric, OrderflowMetric, OrderflowMetric];
};

export const DEFAULT_GEX_BOX_SETTINGS: GexBoxSettings = {
  version: 1,
  surface: "classic",
  ticker: "NQ_NDX",
  expiryMode: "aggregate_90d",
  dataset: "both",
  stateMetric: "gex",
  showSpot: true,
  showZeroGamma: true,
  showMajorPositive: true,
  showMajorNegative: true,
  showLookbacks: true,
  showInspector: true,
  showGrid: true,
  lineWidth: 2,
  dotSize: 5,
  historyMinutes: 390,
  orderflowMetrics: ["dex_orderflow", "gex_orderflow", "convexity_orderflow"],
};

const surfaces = new Set(["classic", "state", "orderflow", "research"]);
const expiryModes = new Set(["aggregate_90d", "latest", "next", "combined"]);
const datasets = new Set(["volume", "open_interest", "both"]);
const stateMetrics = new Set(["gex", "gamma", "delta", "convexity", "negative_vanna", "charm"]);
const orderflowMetrics = new Set([
  "dex_orderflow", "gex_orderflow", "convexity_orderflow", "net_gex",
  "net_convexity", "aggregate_dex", "net_negative_vanna", "net_charm",
]);

function bounded(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

export function migrateGexBoxSettings(input: unknown): GexBoxSettings {
  if (!input || typeof input !== "object") return { ...DEFAULT_GEX_BOX_SETTINGS };
  const source = input as Record<string, unknown>;
  const selected = Array.isArray(source.orderflowMetrics)
    ? [...new Set(source.orderflowMetrics.filter((value): value is OrderflowMetric => typeof value === "string" && orderflowMetrics.has(value)))].slice(0, 3)
    : [];
  for (const fallback of DEFAULT_GEX_BOX_SETTINGS.orderflowMetrics) {
    if (selected.length >= 3) break;
    if (!selected.includes(fallback)) selected.push(fallback);
  }
  return {
    ...DEFAULT_GEX_BOX_SETTINGS,
    surface: surfaces.has(String(source.surface)) ? source.surface as GexBoxSurface : DEFAULT_GEX_BOX_SETTINGS.surface,
    ticker: typeof source.ticker === "string" && source.ticker.trim() ? source.ticker.trim().toUpperCase() : DEFAULT_GEX_BOX_SETTINGS.ticker,
    expiryMode: expiryModes.has(String(source.expiryMode)) ? source.expiryMode as GexBoxSettings["expiryMode"] : DEFAULT_GEX_BOX_SETTINGS.expiryMode,
    dataset: datasets.has(String(source.dataset)) ? source.dataset as GexBoxSettings["dataset"] : DEFAULT_GEX_BOX_SETTINGS.dataset,
    stateMetric: stateMetrics.has(String(source.stateMetric)) ? source.stateMetric as GexBoxSettings["stateMetric"] : DEFAULT_GEX_BOX_SETTINGS.stateMetric,
    showSpot: typeof source.showSpot === "boolean" ? source.showSpot : DEFAULT_GEX_BOX_SETTINGS.showSpot,
    showZeroGamma: typeof source.showZeroGamma === "boolean" ? source.showZeroGamma : DEFAULT_GEX_BOX_SETTINGS.showZeroGamma,
    showMajorPositive: typeof source.showMajorPositive === "boolean" ? source.showMajorPositive : DEFAULT_GEX_BOX_SETTINGS.showMajorPositive,
    showMajorNegative: typeof source.showMajorNegative === "boolean" ? source.showMajorNegative : DEFAULT_GEX_BOX_SETTINGS.showMajorNegative,
    showLookbacks: typeof source.showLookbacks === "boolean" ? source.showLookbacks : DEFAULT_GEX_BOX_SETTINGS.showLookbacks,
    showInspector: typeof source.showInspector === "boolean" ? source.showInspector : DEFAULT_GEX_BOX_SETTINGS.showInspector,
    showGrid: typeof source.showGrid === "boolean" ? source.showGrid : DEFAULT_GEX_BOX_SETTINGS.showGrid,
    lineWidth: bounded(source.lineWidth, DEFAULT_GEX_BOX_SETTINGS.lineWidth, 1, 8),
    dotSize: bounded(source.dotSize, DEFAULT_GEX_BOX_SETTINGS.dotSize, 2, 18),
    historyMinutes: bounded(source.historyMinutes, DEFAULT_GEX_BOX_SETTINGS.historyMinutes, 30, 90 * 24 * 60),
    orderflowMetrics: selected as GexBoxSettings["orderflowMetrics"],
  };
}
