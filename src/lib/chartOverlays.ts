import type { Candle } from "@/lib/backtester";

export const CHART_OVERLAY_SETTINGS_VERSION = 1;

export type OverlayChartStyle = "candlestick" | "ohlc" | "candlebody" | "line" | "hidden";

export type ChartOverlaySettings = {
  symbol: string;
  timeframe: string;
  style: OverlayChartStyle;
  useSecondaryAxis: boolean;
  widthBasedOnVolume: boolean;
  colorBasedOnDelta: boolean;
  openCloseBorder: boolean;
  filled: boolean;
  maxVolumeWidthPercent: number;
  standardDeviation: number;
  borderWidth: 1 | 2 | 3 | 4;
  opacity: number;
  useThemeColors: boolean;
  upColor: string;
  downColor: string;
  lineColor: string;
};

export type ChartOverlaySeries = ChartOverlaySettings & {
  id: string;
  name: string;
  candles: Candle[];
  spanIntervalMs?: number;
  fixedWidthPercent?: number;
  drawCloseBoundary?: boolean;
  closeBoundaryColor?: string;
};

export type OverlayTimeframeSettings = {
  timeframe: string;
  intervalMs: number;
  filled: boolean;
  candleWidthPercent: number;
  borderWidth: 1 | 2 | 3 | 4;
  opacity: number;
  drawCloseBoundary: boolean;
  useThemeColors: boolean;
  upColor: string;
  downColor: string;
  closeBoundaryColor: string;
};

const bounded = (value: unknown, fallback: number, minimum: number, maximum: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
};

export function pairedOverlaySymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  // Resolve the longest roots first: contract codes such as MESU6 and MNQZ6
  // otherwise look like ES/NQ when their month/year suffix is stripped.
  const root = ["MNQ", "MES", "M2K", "RTY", "NQ", "ES", "YM"]
    .find((candidate) => normalized.startsWith(candidate))
    ?? normalized.replace(/[^A-Z].*$/, "");
  if (root === "NQ") return "ES";
  if (root === "MNQ") return "MES";
  if (root === "ES") return "NQ";
  if (root === "MES") return "MNQ";
  if (root === "YM") return "NQ";
  if (root === "RTY" || root === "M2K") return "ES";
  return "NQ";
}

export function normalizeChartOverlaySettings(
  input: Record<string, unknown> | null | undefined,
  args: {
    chartSymbol: string;
    chartTimeframe: string;
    inheritTimeframe: boolean;
    theme: { upColor: string; downColor: string; accentColor: string };
  },
): ChartOverlaySettings {
  const style = input?.style;
  const selectedStyle: OverlayChartStyle = style === "line"
    || style === "ohlc"
    || style === "candlebody"
    || style === "hidden"
    || style === "candlestick"
    ? style
    : "candlestick";
  const symbol = typeof input?.symbol === "string" && input.symbol.trim() && input.symbol.trim().toUpperCase() !== "AUTO"
    ? input.symbol.trim().toUpperCase()
    : pairedOverlaySymbol(args.chartSymbol);
  const timeframe = args.inheritTimeframe
    ? args.chartTimeframe
    : typeof input?.timeframe === "string" && input.timeframe.trim() && input.timeframe.trim().toUpperCase() !== "AUTO"
      ? input.timeframe.trim()
      : args.chartTimeframe;
  return {
    symbol,
    timeframe,
    style: selectedStyle,
    useSecondaryAxis: input?.useSecondaryAxis !== false,
    widthBasedOnVolume: input?.widthBasedOnVolume === true,
    colorBasedOnDelta: input?.colorBasedOnDelta === true,
    openCloseBorder: input?.openCloseBorder !== false,
    filled: input?.filled !== false,
    maxVolumeWidthPercent: bounded(input?.maxVolumeWidthPercent, 100, 10, 200),
    standardDeviation: bounded(input?.standardDeviation, 2, 0.1, 10),
    borderWidth: Math.round(bounded(input?.borderWidth, 1, 1, 4)) as 1 | 2 | 3 | 4,
    opacity: bounded(input?.opacity, 68, 5, 100),
    useThemeColors: input?.useThemeColors !== false,
    upColor: typeof input?.upColor === "string" ? input.upColor : args.theme.upColor,
    downColor: typeof input?.downColor === "string" ? input.downColor : args.theme.downColor,
    lineColor: typeof input?.lineColor === "string" ? input.lineColor : args.theme.accentColor,
  };
}

export function aggregateCandlesByMilliseconds(candles: Candle[], intervalMs: number): Candle[] {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return [];
  const buckets = new Map<number, Candle>();
  for (const candle of candles) {
    if (!Number.isFinite(candle.timestamp)) continue;
    const timestamp = Math.floor(candle.timestamp / intervalMs) * intervalMs;
    const current = buckets.get(timestamp);
    if (!current) {
      buckets.set(timestamp, { ...candle, timestamp });
      continue;
    }
    const delta = (current.delta ?? 0) + (candle.delta ?? 0);
    buckets.set(timestamp, {
      ...current,
      high: Math.max(current.high, candle.high),
      low: Math.min(current.low, candle.low),
      close: candle.close,
      volume: (current.volume ?? 0) + (candle.volume ?? 0),
      trades: (current.trades ?? 0) + (candle.trades ?? 0),
      bidVolume: (current.bidVolume ?? 0) + (candle.bidVolume ?? 0),
      askVolume: (current.askVolume ?? 0) + (candle.askVolume ?? 0),
      delta,
    });
  }
  return [...buckets.values()].sort((left, right) => left.timestamp - right.timestamp);
}

export function overlayTimeframeMilliseconds(value: unknown, fallback = 15 * 60_000) {
  const match = String(value ?? "").trim().match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d|w|mo)$/i);
  if (!match) return fallback;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const factor = unit === "s" ? 1_000
    : unit === "m" ? 60_000
      : unit === "h" ? 3_600_000
        : unit === "d" ? 86_400_000
          : unit === "w" ? 7 * 86_400_000
            : 30 * 86_400_000;
  return Math.min(365 * 86_400_000, Math.max(1_000, amount * factor));
}

export function normalizeOverlayTimeframeSettings(
  input: Record<string, unknown> | null | undefined,
  theme: { upColor: string; downColor: string; accentColor: string },
): OverlayTimeframeSettings {
  const timeframe = typeof input?.timeframe === "string" && input.timeframe.trim()
    ? input.timeframe.trim()
    : "15m";
  return {
    timeframe,
    intervalMs: overlayTimeframeMilliseconds(timeframe),
    filled: input?.filled !== false,
    candleWidthPercent: bounded(input?.candleWidthPercent, 94, 10, 100),
    borderWidth: Math.round(bounded(input?.borderWidth, 1, 1, 4)) as 1 | 2 | 3 | 4,
    opacity: bounded(input?.opacity, 34, 5, 100),
    drawCloseBoundary: input?.drawCloseBoundary === true,
    useThemeColors: input?.useThemeColors !== false,
    upColor: typeof input?.upColor === "string" ? input.upColor : theme.upColor,
    downColor: typeof input?.downColor === "string" ? input.downColor : theme.downColor,
    closeBoundaryColor: typeof input?.closeBoundaryColor === "string" ? input.closeBoundaryColor : theme.accentColor,
  };
}
