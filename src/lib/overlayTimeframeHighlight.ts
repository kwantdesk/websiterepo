import type { Candle } from "./backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "./chartIndicatorEngine";

export const OVERLAY_TIMEFRAME_HIGHLIGHT_DEFAULTS = {
  parameterType: "minutes", parameter1: 15,
  colorBasedOnDelta: false, colorMode: "fixed", standardDeviation: 2,
  enabled: true, borderWidth: 1, bodyOpacity: 18, shadowOpacity: 70, showBackground: true,
  targetEnabled: false, targetLineWidth: 1, targetLineStyle: "dashed",
  extendLineLeft: false, showTargetText: true, textSize: 10,
  summaryEnabled: false, volumeSummary: true, tradeSummary: true,
  summaryTextSize: 9, summaryToView: 3, useThemeColors: true,
  upColor: "#22C55E", downColor: "#EF4444", highColor: "#22C55E", lowColor: "#EF4444",
  textColor: "#FFFFFF", summaryTextColor: "#FFFFFF", askColor: "#22C55E", bidColor: "#EF4444",
} as const;

export type OverlayTimeframeHighlightSettings = {
  parameterType: "minutes" | "hours" | "days";
  parameter1: number;
  intervalMs: number;
  colorBasedOnDelta: boolean;
  colorMode: "fixed" | "fading";
  standardDeviation: number;
  enabled: boolean;
  borderWidth: 1 | 2 | 3 | 4;
  bodyOpacity: number;
  shadowOpacity: number;
  showBackground: boolean;
  targetEnabled: boolean;
  targetLineWidth: 1 | 2 | 3 | 4;
  targetLineStyle: "solid" | "dashed" | "dotted";
  extendLineLeft: boolean;
  showTargetText: boolean;
  textSize: number;
  summaryEnabled: boolean;
  volumeSummary: boolean;
  tradeSummary: boolean;
  summaryTextSize: number;
  summaryToView: number;
  useThemeColors: boolean;
  upColor: string;
  downColor: string;
  highColor: string;
  lowColor: string;
  textColor: string;
  summaryTextColor: string;
  askColor: string;
  bidColor: string;
};

export type OverlayTimeframeHighlightBucket = {
  startTime: number;
  firstTime: number;
  lastTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades: number;
  askVolume: number;
  bidVolume: number;
};

export type OverlayTimeframeHighlightModel = {
  buckets: OverlayTimeframeHighlightBucket[];
  settings: OverlayTimeframeHighlightSettings;
  colors: { up: string; down: string; high: string; low: string; text: string; summary: string; ask: string; bid: string };
};

const finite = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const bounded = (value: unknown, fallback: number, min: number, max: number) => Math.max(min, Math.min(max, finite(value, fallback)));
const color = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value : fallback;

export function normalizeOverlayTimeframeHighlightSettings(raw: Record<string, unknown> = {}): OverlayTimeframeHighlightSettings {
  const parameterType = raw.parameterType === "hours" || raw.parameterType === "days" ? raw.parameterType : "minutes";
  const parameter1 = Math.round(bounded(raw.parameter1, 15, 1, parameterType === "days" ? 30 : parameterType === "hours" ? 168 : 10_080));
  const factor = parameterType === "days" ? 86_400_000 : parameterType === "hours" ? 3_600_000 : 60_000;
  return {
    parameterType, parameter1, intervalMs: parameter1 * factor,
    colorBasedOnDelta: raw.colorBasedOnDelta === true,
    colorMode: raw.colorMode === "fading" ? "fading" : "fixed",
    standardDeviation: bounded(raw.standardDeviation, 2, 0.1, 10),
    enabled: raw.enabled !== false,
    borderWidth: Math.round(bounded(raw.borderWidth, 1, 1, 4)) as 1 | 2 | 3 | 4,
    bodyOpacity: bounded(raw.bodyOpacity, 18, 0, 100),
    shadowOpacity: bounded(raw.shadowOpacity, 70, 0, 100),
    showBackground: raw.showBackground !== false,
    targetEnabled: raw.targetEnabled === true,
    targetLineWidth: Math.round(bounded(raw.targetLineWidth, 1, 1, 4)) as 1 | 2 | 3 | 4,
    targetLineStyle: raw.targetLineStyle === "solid" || raw.targetLineStyle === "dotted" ? raw.targetLineStyle : "dashed",
    extendLineLeft: raw.extendLineLeft === true,
    showTargetText: raw.showTargetText !== false,
    textSize: bounded(raw.textSize, 10, 6, 30),
    summaryEnabled: raw.summaryEnabled === true,
    volumeSummary: raw.volumeSummary !== false,
    tradeSummary: raw.tradeSummary !== false,
    summaryTextSize: bounded(raw.summaryTextSize, 9, 6, 24),
    summaryToView: Math.round(bounded(raw.summaryToView, 3, 1, 100)),
    useThemeColors: raw.useThemeColors !== false,
    upColor: color(raw.upColor, "#22C55E"), downColor: color(raw.downColor, "#EF4444"),
    highColor: color(raw.highColor, "#22C55E"), lowColor: color(raw.lowColor, "#EF4444"),
    textColor: color(raw.textColor, "#FFFFFF"), summaryTextColor: color(raw.summaryTextColor, "#FFFFFF"),
    askColor: color(raw.askColor, "#22C55E"), bidColor: color(raw.bidColor, "#EF4444"),
  };
}

export function buildOverlayTimeframeHighlightBuckets(candles: readonly Candle[], intervalMs: number) {
  if (!(intervalMs > 0)) return [];
  const buckets: OverlayTimeframeHighlightBucket[] = [];
  let active: OverlayTimeframeHighlightBucket | null = null;
  let previous = -Infinity;
  for (const candle of candles) {
    const valid = Number.isFinite(candle.timestamp) && candle.timestamp > previous
      && [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)
      && candle.high >= Math.max(candle.open, candle.close) && candle.low <= Math.min(candle.open, candle.close);
    if (!valid) { active = null; if (Number.isFinite(candle.timestamp)) previous = Math.max(previous, candle.timestamp); continue; }
    previous = candle.timestamp;
    const startTime = Math.floor(candle.timestamp / intervalMs) * intervalMs;
    if (!active || active.startTime !== startTime) {
      active = { startTime, firstTime: candle.timestamp, lastTime: candle.timestamp, open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume: Math.max(0, finite(candle.volume)), trades: Math.max(0, finite(candle.trades)), askVolume: Math.max(0, finite(candle.askVolume)), bidVolume: Math.max(0, finite(candle.bidVolume)) };
      buckets.push(active); continue;
    }
    active.lastTime = candle.timestamp; active.high = Math.max(active.high, candle.high); active.low = Math.min(active.low, candle.low); active.close = candle.close;
    active.volume += Math.max(0, finite(candle.volume)); active.trades += Math.max(0, finite(candle.trades)); active.askVolume += Math.max(0, finite(candle.askVolume)); active.bidVolume += Math.max(0, finite(candle.bidVolume));
  }
  return buckets;
}

export function calculateOverlayTimeframeHighlight(candles: readonly Candle[], raw: Record<string, unknown>, theme: IndicatorTheme): CalculatedIndicatorSeries[] {
  const settings = normalizeOverlayTimeframeHighlightSettings(raw);
  if (!settings.enabled) return [];
  const buckets = buildOverlayTimeframeHighlightBuckets(candles, settings.intervalMs);
  if (!buckets.length) return [];
  const colors = settings.useThemeColors
    ? { up: theme.positive, down: theme.negative, high: theme.positive, low: theme.negative, text: theme.primary, summary: theme.primary, ask: theme.positive, bid: theme.negative }
    : { up: settings.upColor, down: settings.downColor, high: settings.highColor, low: settings.lowColor, text: settings.textColor, summary: settings.summaryTextColor, ask: settings.askColor, bid: settings.bidColor };
  return [{
    key: "overlay-timeframe-highlight", label: "Overlay Timeframe Highlight", kind: "line", placement: "overlay",
    color: colors.up, lineVisible: false, lastValueVisible: false, excludeFromAutoScale: true,
    overlayTimeframeHighlight: { buckets, settings, colors },
    data: buckets.map(bucket => ({ time: bucket.firstTime / 1_000, value: bucket.close })),
  }];
}
