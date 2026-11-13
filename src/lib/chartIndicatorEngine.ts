import { timeframeDurationMs } from "@/lib/chartHistoryWindow";
import { isEventBasedChartInterval } from "@/lib/chartIntervals";
import type { Candle } from "@/lib/backtester";
import { applyMomentumPlacement, momentumOnChart } from "@/lib/momentumPlacement";
import { candleDeltaPath } from "@/lib/candleDeltaPath";
import { clipReplayIndicatorSeries, replayCausalCandles, replaySafeIndicators } from "@/lib/replayIndicatorSafety";
import { calculateAbsoluteLevels } from "@/lib/absoluteLevels";
import { calculatePivotPoints } from "@/lib/pivotPoints";
import type { PivotPointLabelOptions } from "@/lib/pivotPointLabels";
import { calculateFairValueGaps } from "@/lib/fairValueGap";
import type { GapZoneRenderOptions } from "@/lib/gapZonePrimitive";
import { calculateZigZag } from "@/lib/zigZag";
import { calculateInverseCyberCycle } from "@/lib/inverseCyberCycle";
import { calculateIchimoku } from "@/lib/ichimoku";
import type { IchimokuCloudOptions } from "@/lib/ichimokuCloudPrimitive";
import type { ZigZagRetracementOptions } from "@/lib/zigZagRetracementPrimitive";
import { calculateAverageDirectionalIndex } from "@/lib/averageDirectionalIndex";
import { rsiSettings } from "@/lib/relativeStrengthIndex";
import { calculateCci, cciAverageType, CCI_DEFAULTS } from "@/lib/commodityChannelIndex";
import { calculateParabolicSar } from "@/lib/parabolicSar";
import { calculateLinearRegression } from "@/lib/linearRegression";
import { calculateRegressionChannel } from "@/lib/regressionChannel";
import { calculateSwingPoints } from "@/lib/swingPointLevels";
import type { SwingPointLevelOptions } from "@/lib/swingPointLevelPrimitive";
import { calculateTextOnChart } from "@/lib/textOnChart";
import { calculatePriceMovementLevels } from "@/lib/priceMovementLevels";
import { calculateAverageDailyRangeTarget } from "@/lib/averageDailyRangeTarget";
import { calculateVolumeDeltaSprint } from "@/lib/volumeDeltaSprint";
import { calculateOverlayTimeframeHighlight } from "@/lib/overlayTimeframeHighlight";
import type { OverlayTimeframeHighlightModel } from "@/lib/overlayTimeframeHighlight";
import type { TextOnChartOptions } from "@/lib/textOnChartPrimitive";
import { calculateTillsonT3 } from "@/lib/tillsonT3";
import { calculateSuperTrendSeries } from "@/lib/superTrendSeries";
import type { SuperTrendLabelOptions } from "@/lib/superTrendLabels";
import { smoother, type KstAverage } from "@/lib/knowSureThing";
import { calculateKstSeries, type KstPanePresentation } from "@/lib/knowSureThingSeries";
import { exchangeClockParts } from "@/lib/exchangeClock";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";
import { calculateDeepEffortAverage } from "@/lib/deepEffort";
import { resolveVolumeProfileGradient } from "@/lib/volumeProfileGradients";
import { detectCvdDivergences, sessionCvdBars, type CvdDivergenceSegment } from "@/lib/cvdDivergence";
import { runSourceIndicator, type SourceIndicatorLanguage } from "@/lib/indicatorSourceAdapters";
import { cciThemeColors, AROON_OSCILLATOR_COLORS, AROON_OSCILLATOR_LENGTH, applyIndicatorPlotColors, defaultIndicatorPlotColors } from "@/lib/indicatorPlotColors";
import { calculateDeepDeltaBars, normalizeDeepDeltaSettings } from "@/lib/deepDelta";
import {
  calculatePeriodVwap,
  calculateRollingVwap,
  vwapEnvelopeOffset,
  type VwapEnvelopeMode,
  type VwapSource,
} from "@/lib/vwap";

export type CalculatedIndicatorSeries = {
  /** Same historical signals rendered on price; never re-detect from another window. */
  cvdDivergences?: CvdDivergenceSegment[];
  textOnChart?: TextOnChartOptions;
  swingPointLevels?: SwingPointLevelOptions;
  ichimokuCloud?: IchimokuCloudOptions;
  gapZones?: GapZoneRenderOptions;
  zigZagRetracements?: ZigZagRetracementOptions;
  pivotLabels?: PivotPointLabelOptions;
  superTrendLabels?: SuperTrendLabelOptions;
  superTrendStyleKey?: string;
  kstPresentation?: KstPanePresentation;
  overlayTimeframeHighlight?: OverlayTimeframeHighlightModel;
  key: string;
  groupKey?: string;
  label: string;
  kind: "line" | "histogram" | "candlestick";
  placement: "overlay" | "pane";
  color: string;
  lineWidth?: 1 | 2 | 3 | 4;
  /** Optional histogram outline; absent keeps every existing study unchanged. */
  histogramOutlineWidth?: number;
  /** Optional bounded pixel thickness along the time axis; legacy candle widths unchanged. */
  histogramBarWidth?: number;
  histogramFixedWidth?: number;
  lineStyle?: "solid" | "dashed" | "dotted";
  lineType?: "simple" | "with-steps";
  pointMarkersVisible?: boolean;
  lineVisible?: boolean;
  candleStyle?: "candlestick" | "ohlc" | "candle-body" | "wick-only";
  lastValueVisible?: boolean;
  /** Full-pane, user-defined reference; does not alter price autoscaling. */
  horizontalPriceLine?: boolean;
  excludeFromAutoScale?: boolean;
  independentScale?: boolean;
  priceScaleId?: string;
  showZeroLine?: boolean;
  zeroLineColor?: string;
  zeroLineWidth?: 1 | 2 | 3 | 4;
  includeZeroInScale?: boolean;
  data: Array<{
    time: number;
    value: number;
    color?: string;
    borderColor?: string;
    breakBefore?: boolean;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
  }>;
};

export type IndicatorTheme = {
  primary: string;
  secondary: string;
  positive: string;
  negative: string;
  muted: string;
  background?: string;
};

export type DeltaPercentHighlightPoint = {
  time: number;
  deltaPercent: number;
  side: "ask" | "bid";
};

const finite = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const settingNumber = (instance: ChartIndicatorInstance, key: string, fallback: number) =>
  finite(instance.settings?.[key], fallback);

const settingBoolean = (instance: ChartIndicatorInstance, key: string, fallback: boolean) =>
  typeof instance.settings?.[key] === "boolean" ? instance.settings[key] as boolean : fallback;

const settingString = (instance: ChartIndicatorInstance, key: string, fallback: string) =>
  typeof instance.settings?.[key] === "string" && String(instance.settings[key]).trim()
    ? String(instance.settings[key])
    : fallback;

const vwapLineWidth = (instance: ChartIndicatorInstance, key: string, fallback: number): 1 | 2 | 3 | 4 =>
  Math.max(1, Math.min(4, Math.round(settingNumber(instance, key, fallback)))) as 1 | 2 | 3 | 4;

const vwapLineStyle = (instance: ChartIndicatorInstance, key: string, fallback: "solid" | "dashed" | "dotted") => {
  const value = settingString(instance, key, fallback);
  return (value === "dashed" || value === "dotted" ? value : "solid") as "solid" | "dashed" | "dotted";
};

const blendHexColors = (from: string, to: string, amount: number) => {
  const normalize = (color: string) => {
    const match = color.trim().match(/^#([\da-f]{6})$/i);
    if (!match) return null;
    const value = Number.parseInt(match[1], 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
  };
  const start = normalize(from);
  const end = normalize(to);
  if (!start || !end) return to;
  const weight = Math.min(1, Math.max(0, amount));
  const channel = (index: number) => Math.round(start[index] + (end[index] - start[index]) * weight);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
};

const vwapBandColor = (theme: IndicatorTheme, index: number) => {
  if (index === 0) return theme.secondary;
  return blendHexColors(theme.muted, theme.secondary, index === 1 ? 0.78 : 0.62);
};

const ENGINE_TIME_ZONE = "America/Chicago";

function sessionKey(timestamp: number, startHour = 17) {
  // Runs per candle across several indicators. The shared clock caches per
  // minute so a recompute does not pay Intl for every bar.
  const parts = exchangeClockParts(timestamp, ENGINE_TIME_ZONE);
  const tradingDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (parts.hour < startHour) tradingDate.setUTCDate(tradingDate.getUTCDate() - 1);
  return tradingDate.toISOString().slice(0, 10);
}

function sma(candles: Candle[], length: number) {
  const output: Array<{ time: number; value: number }> = [];
  let sum = 0;
  candles.forEach((candle, index) => {
    sum += candle.close;
    if (index >= length) sum -= candles[index - length].close;
    if (index >= length - 1) output.push({ time: candle.timestamp / 1000, value: sum / length });
  });
  return output;
}

function ema(values: number[], length: number) {
  if (values.length === 0) return [];
  const alpha = 2 / (Math.max(1, length) + 1);
  const output = [values[0]];
  for (let index = 1; index < values.length; index += 1) {
    output.push(values[index] * alpha + output[index - 1] * (1 - alpha));
  }
  return output;
}

// Loop-based window extremes. Spreading a slice into Math.max/min
// (`Math.max(...slice)`) throws V8's argument-limit RangeError once the window
// grows large (order-flow charts can hold thousands of candles), and it is the
// same crash that already bit the gamma heatmap. These are allocation-free.
function windowMax(values: number[], start: number, endInclusive: number): number {
  let max = -Infinity;
  for (let i = start; i <= endInclusive; i += 1) if (values[i] > max) max = values[i];
  return max;
}
function windowMin(values: number[], start: number, endInclusive: number): number {
  let min = Infinity;
  for (let i = start; i <= endInclusive; i += 1) if (values[i] < min) min = values[i];
  return min;
}
function aroonExtremeAges(values: number[], length: number, high: boolean): Int32Array {
  const ages = new Int32Array(values.length);
  const capacity = Math.min(values.length, length + 1);
  const queue = new Int32Array(capacity);
  let head = 0;
  let count = 0;
  for (let index = 0; index < values.length; index += 1) {
    const start = index - length;
    if (count && queue[head] < start) {
      head = (head + 1) % capacity;
      count -= 1;
    }
    const value = values[index];
    if (!Number.isNaN(value)) {
      while (count) {
        const tail = (head + count - 1) % capacity;
        const previous = values[queue[tail]];
        if (high ? previous > value : previous < value) break;
        // Equal extremes use the most recent candle.
        count -= 1;
      }
      queue[(head + count) % capacity] = index;
      count += 1;
    }
    if (start >= 0) {
      const extreme = Number.isNaN(values[start]) ? start : queue[head];
      ages[index] = index - extreme;
    }
  }
  return ages;
}

function aroonScore(length: number, age: number) {
  return ((length - age) / length) * 100;
}

const aroonDataCache = new WeakMap<ChartIndicatorInstance, {
  candles: Candle[];
  length: number;
  colors?: string;
  series: CalculatedIndicatorSeries["data"];
}>();

function aroonData(instance: ChartIndicatorInstance, candles: Candle[], length: number, colors: typeof AROON_OSCILLATOR_COLORS) {
  const colorKey = `${colors.positive}/${colors.negative}`;
  const previous = aroonDataCache.get(instance);
  let matching = 0;
  if (previous?.length === length && previous.colors === colorKey) {
    const count = Math.min(candles.length, previous.candles.length);
    // Chart candle updates replace changed bars and preserve the settled prefix.
    while (matching < count) {
      const bar = candles[matching];
      const old = previous.candles[matching];
      if (bar !== old && (bar.timestamp !== old.timestamp || bar.high !== old.high || bar.low !== old.low)) break;
      matching += 1;
    }
    if (matching === candles.length && matching === previous.candles.length) return previous.series;
  }

  const firstOutput = Math.max(length, matching);
  const remainder = matching <= length ? candles : candles.slice(matching - length);
  const highs = aroonExtremeAges(remainder.map(bar => bar.high), length, true);
  const lows = aroonExtremeAges(remainder.map(bar => bar.low), length, false);
  const series = matching > length && previous ? previous.series.slice(0, matching - length) : [];
  for (let index = firstOutput; index < candles.length; index += 1) {
    const offset = length + index - firstOutput;
    const time = candles[index].timestamp / 1000;
    const up = aroonScore(length, highs[offset]);
    const down = aroonScore(length, lows[offset]);
    const value = up - down;
    series.push({ time, value, color: value > 0 ? colors.positive : value < 0 ? colors.negative : "transparent" });
  }
  aroonDataCache.set(instance, { candles, length, colors: colorKey, series });
  return series;
}

function rollingMean(values: number[], length: number) {
  const output = Array<number | null>(values.length).fill(null);
  let sum = 0;
  values.forEach((value, index) => {
    sum += value;
    if (index >= length) sum -= values[index - length];
    if (index >= length - 1) output[index] = sum / length;
  });
  return output;
}

function rollingMeanNullable(values: Array<number | null>, length: number) {
  const output = Array<number | null>(values.length).fill(null);
  for (let index = length - 1; index < values.length; index += 1) {
    const window = values.slice(index - length + 1, index + 1);
    if (window.some((value) => value == null)) continue;
    output[index] = window.reduce<number>((sum, value) => sum + (value ?? 0), 0) / length;
  }
  return output;
}

function rollingDeviation(values: number[], length: number) {
  const output = Array<number | null>(values.length).fill(null);
  let sum = 0;
  let sumSquares = 0;
  values.forEach((value, index) => {
    sum += value;
    sumSquares += value * value;
    if (index >= length) {
      sum -= values[index - length];
      sumSquares -= values[index - length] * values[index - length];
    }
    if (index >= length - 1) {
      const mean = sum / length;
      output[index] = Math.sqrt(Math.max(0, sumSquares / length - mean * mean));
    }
  });
  return output;
}

function trueRanges(candles: Candle[]) {
  return candles.map((candle, index) => index === 0
    ? candle.high - candle.low
    : Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - candles[index - 1].close),
      Math.abs(candle.low - candles[index - 1].close),
    ));
}

function wilder(values: number[], length: number) {
  const output = Array<number | null>(values.length).fill(null);
  if (values.length < length) return output;
  let average = values.slice(0, length).reduce((sum, value) => sum + value, 0) / length;
  output[length - 1] = average;
  for (let index = length; index < values.length; index += 1) {
    average = (average * (length - 1) + values[index]) / length;
    output[index] = average;
  }
  return output;
}

function lineData(candles: Candle[], values: Array<number | null>) {
  return values.flatMap((value, index) =>
    value == null || !Number.isFinite(value)
      ? []
      : [{ time: candles[index].timestamp / 1000, value }]
  );
}

function hasVerifiedCvdInput(candle: Candle, useTradeCounts = false) {
  const ask = Number(useTradeCounts ? candle.askTrades : candle.askVolume);
  const bid = Number(useTradeCounts ? candle.bidTrades : candle.bidVolume);
  return Number.isFinite(ask) && Number.isFinite(bid) && ask + bid > 0;
}

function hasVerifiedOrderFlow(candle: Candle) {
  return hasVerifiedCvdInput(candle);
}

function orderFlowAvailable(candles: Candle[]) {
  return candles.some(hasVerifiedOrderFlow);
}

// Cash indices (SPX, NDX, VIX...) publish no traded volume at all. Volume
// studies must vanish honestly on such feeds instead of silently degrading
// (e.g. VWAP collapsing into a typical-price line), which would be fake data.
function volumeAvailable(candles: Candle[]) {
  return candles.some((candle) => {
    const reported = Number(candle.volume);
    const classified = Number(candle.askVolume ?? 0) + Number(candle.bidVolume ?? 0);
    return (Number.isFinite(reported) && reported > 0)
      || (Number.isFinite(classified) && classified > 0);
  });
}

export function calculateDeltaPercentHighlights(
  instance: ChartIndicatorInstance,
  candles: Candle[],
): DeltaPercentHighlightPoint[] {
  if (!instance.enabled) return [];
  const minimum = Math.max(0, settingNumber(instance, "minValue", 50));
  const maximum = Math.max(0, settingNumber(instance, "maxValue", 0));
  const showAsk = settingBoolean(instance, "showAsk", true);
  const showBid = settingBoolean(instance, "showBid", true);

  return candles.flatMap((candle) => {
    if (!hasVerifiedOrderFlow(candle)) return [];
    const askVolume = Math.max(0, finite(candle.askVolume));
    const bidVolume = Math.max(0, finite(candle.bidVolume));
    const executedVolume = askVolume + bidVolume;
    if (executedVolume <= 0) return [];
    const deltaPercent = (askVolume - bidVolume) / executedVolume * 100;
    const magnitude = Math.abs(deltaPercent);
    if (magnitude < minimum || (maximum > 0 && magnitude > maximum)) return [];
    const side = deltaPercent >= 0 ? "ask" : "bid";
    if ((side === "ask" && !showAsk) || (side === "bid" && !showBid)) return [];
    return [{
      time: candle.timestamp / 1_000,
      deltaPercent,
      side,
    }];
  });
}

/**
 * Every study's plots, with the trader's own colours applied over them.
 *
 * The engine paints from the chart theme, which is right until somebody wants
 * one moving average a different colour from another. Overrides are applied
 * here, once, rather than threaded through twenty-six separate branches — an
 * untouched indicator returns exactly what it always did.
 */
type IndicatorCalculationContext = {
  instrument?: string;
  timeframe?: string;
  tickSize?: number;
  replayTimestampMs?: number | null;
  adrDailyCandles?: readonly Candle[];
  adrAsOfMs?: number;
};

export function calculateIndicatorSeries(
  instance: ChartIndicatorInstance,
  candles: Candle[],
  theme: IndicatorTheme,
  context: IndicatorCalculationContext = {},
): CalculatedIndicatorSeries[] {
  const clock = context.replayTimestampMs;
  const [safeInstance] = replaySafeIndicators([instance], clock);
  if (!safeInstance.enabled) return [];
  return applyMomentumPlacement(safeInstance, clipReplayIndicatorSeries(calculateUnclippedIndicatorSeries(safeInstance,
    replayCausalCandles(candles, clock), theme, context), clock));
}

function calculateUnclippedIndicatorSeries(
  instance: ChartIndicatorInstance,
  candles: Candle[],
  theme: IndicatorTheme,
  context: IndicatorCalculationContext = {},
): CalculatedIndicatorSeries[] {
  // KST owns both slope colours per plot. The generic post-colour pass would
  // flatten those deliberate two-colour paths into one custom swatch.
  if (instance.indicatorId === "know-sure-thing-kst") {
    return instance.enabled ? calculateKstSeries(candles, instance.settings ?? {}, theme) : [];
  }
  if (instance.indicatorId === "super-trend" || instance.indicatorId === "super-trend-difference") {
    return instance.enabled ? calculateSuperTrendSeries(candles, instance.settings ?? {}, theme,
      instance.instanceId, instance.indicatorId === "super-trend-difference") : [];
  }
  const plotTheme = instance.indicatorId === "aroon-oscillator" && instance.settings?.useThemeColors !== true
    ? { ...theme, ...AROON_OSCILLATOR_COLORS } : theme;
  return applyIndicatorPlotColors(
    instance.indicatorId,
    instance.indicatorId === "volume" ? { ...instance.settings, gradientPreset: "off" }
      : instance.settings as Record<string, unknown> | undefined,
    computeIndicatorSeries(instance, candles, plotTheme, context),
    plotTheme,
  );
}

function computeIndicatorSeries(
  instance: ChartIndicatorInstance,
  candles: Candle[],
  theme: IndicatorTheme,
  context: IndicatorCalculationContext = {},
): CalculatedIndicatorSeries[] {
  if (!instance.enabled || candles.length === 0) return [];
  const key = instance.indicatorId;

  if (key === "absolute-levels") return calculateAbsoluteLevels(candles, instance.settings ?? {}, theme);
  if (key === "pivot-points") return calculatePivotPoints(candles, instance.settings ?? {}, theme);
  if (key === "fvg-identifier") {
    const timeframe = context.timeframe;
    return calculateFairValueGaps(candles, instance.settings ?? {}, theme, context.tickSize, {
      intervalMs: timeframe ? timeframeDurationMs(timeframe) : null,
      asOfMs: context.replayTimestampMs ?? Date.now(),
      requireNextBar: timeframe ? isEventBasedChartInterval(timeframe) : false,
    });
  }
  if (key === "zig-zag") return calculateZigZag(candles, instance.settings ?? {}, theme, context.tickSize, instance.instanceId);
  if (key === "inverse-cyber-cycle") return calculateInverseCyberCycle(candles, instance.settings ?? {}, theme, instance.instanceId);
  if (key === "ichimoku-indicator") return calculateIchimoku(candles, instance.settings ?? {}, theme, instance.instanceId);
  if (key === "average-directional-index-adx") return calculateAverageDirectionalIndex(candles, instance.settings ?? {}, theme);
  if (key === "commodity-channel-index-cci") {
    const { length, averageLength, data, averageData } = calculateCci(candles, instance.settings ?? {});
    const colors = cciThemeColors(theme);
    const averageType = cciAverageType(instance.settings?.averageType);
    const averageLabel = { simple: "SMA", exponential: "EMA", triangular: "TMA", weighted: "WMA" }[averageType];
    const series: CalculatedIndicatorSeries[] = [{
      key, label: `CCI (${length})`, kind: "line", placement: "pane", color: colors.plotColor,
      lineWidth: vwapLineWidth(instance, "lineWidth", CCI_DEFAULTS.lineWidth), lineStyle: vwapLineStyle(instance, "lineStyle", "solid"), data,
    }];
    if (averageLength) series.push({
      key: `${key}-average`, label: `CCI ${averageLabel} (${averageLength})`, kind: "line", placement: "pane",
      color: colors.averageColor, lineWidth: vwapLineWidth(instance, "averageLineWidth", CCI_DEFAULTS.averageLineWidth), data: averageData,
    });
    if (data.length && settingBoolean(instance, "showLevels", CCI_DEFAULTS.showLevels)) {
      const level = Math.min(500, Math.max(1, settingNumber(instance, "levelValue", CCI_DEFAULTS.levelValue)));
      for (const value of [level, 0, -level]) series.push({
        key: `${key}-level-${Math.sign(value)}`, label: value > 0 ? `+${value}` : String(value),
        kind: "line", placement: "pane",
        color: value > 0 ? colors.overboughtColor : value < 0 ? colors.oversoldColor : colors.zeroColor,
        lineWidth: vwapLineWidth(instance, "levelLineWidth", CCI_DEFAULTS.levelLineWidth), lineStyle: "dotted",
        horizontalPriceLine: !momentumOnChart(instance),
        lastValueVisible: false, data: data.map(point => ({ ...point, value })),
      });
    }
    return series;
  }
  if (key === "parabolic-sar") return calculateParabolicSar(candles, instance.settings ?? {}, theme, instance.instanceId);
  if (key === "linear-regression") return calculateLinearRegression(candles, instance.settings ?? {}, theme, instance.instanceId, context.instrument);
  if (key === "regression-channel") return calculateRegressionChannel(candles, instance.settings ?? {}, theme, instance.instanceId, context.tickSize);
  if (key === "swing-point") return calculateSwingPoints(candles, instance.settings ?? {}, theme, context.tickSize);
  if (key === "text-on-chart") return calculateTextOnChart(candles, instance.settings ?? {}, theme);
  if (key === "price-movement-levels") return calculatePriceMovementLevels(candles, instance.settings ?? {}, theme, context.tickSize);
  if (key === "average-daily-range-target") return calculateAverageDailyRangeTarget(candles, instance.settings ?? {}, theme, context);
  if (key === "volume-delta-sprint") return calculateVolumeDeltaSprint(candles, instance.settings ?? {}, theme);
  if (key === "overlay-timeframe-highlight") return calculateOverlayTimeframeHighlight(candles, instance.settings ?? {}, theme);
  if (key === "tillson-t3") return calculateTillsonT3(candles, instance.settings ?? {}, theme, instance.instanceId, context.instrument);

  // Options execution bars own their external-data primitive, never OHLC math.
  if (key === "big-blocks-options") return [];
  if (key === "source-code-indicator") {
    const source = settingString(instance, "source", "");
    if (!source) return [];
    const sourceLanguage = settingString(instance, "sourceLanguage", "auto") as SourceIndicatorLanguage;
    return runSourceIndicator(source, sourceLanguage, candles, theme, instance.instanceId).series;
  }

  if (key === "deep-m-effort-nq") {
    const useThemeColors = settingBoolean(instance, "useThemeColors", true);
    const autoColor = settingString(instance, "maAutoColor", "price");
    const gradient = resolveVolumeProfileGradient(instance.settings?.gradientPreset);
    const primaryColor = gradient?.to ?? (useThemeColors ? theme.positive : settingString(instance, "maAboveColor", theme.positive));
    const secondaryColor = gradient?.from ?? (useThemeColors ? theme.negative : settingString(instance, "maBelowColor", theme.negative));
    const lineWidth = Math.min(
      4,
      Math.max(1, Math.round(settingNumber(instance, "maLineWidth", 2))),
    ) as 1 | 2 | 3 | 4;
    if (!settingBoolean(instance, "showMovingAverage", false)) return [];
    const average = calculateDeepEffortAverage(candles, settingNumber(instance, "averageLength", 21), context.instrument);
    return [{
      key: `${key}-average`,
      label: settingString(instance, "shortName", "Big Blocks"),
      kind: "line",
      placement: "overlay",
      color: primaryColor,
      lineWidth,
      lineStyle: settingString(instance, "maLineStyle", "solid") === "dashed" ? "dashed" : "solid",
      lastValueVisible: settingBoolean(instance, "showValueLabel", true),
      data: average.map((point) => ({
        time: point.time,
        value: point.value,
        color: autoColor === "none"
          ? primaryColor
          : point.bias === "ASK" ? primaryColor : secondaryColor,
      })),
    }];
  }

  if (key === "volume") {
    if (!volumeAvailable(candles)) return [];
    const minimumTotalVolume = Math.max(0, settingNumber(instance, "minimumTotalVolume", 0));
    return [{
      key, label: "Volume", kind: "histogram", placement: "pane", color: theme.muted,
      includeZeroInScale: true,
      data: candles.flatMap((candle) => {
        const reportedVolume = Math.max(0, finite(candle.volume));
        const classifiedVolume = Math.max(0, finite(candle.askVolume)) + Math.max(0, finite(candle.bidVolume));
        // Executed total owns bar height; sides repair an absent total only.
        const value = reportedVolume > 0 ? reportedVolume : classifiedVolume;
        return value < minimumTotalVolume ? [] : [{ time: candle.timestamp / 1000, value }];
      }),
    }];
  }

  if (key === "delta-bar") {
    if (!orderFlowAvailable(candles)) return [];
    const requestedStyle = settingString(instance, "candleStyle", "candlestick");
    const candleStyle = requestedStyle === "ohlc" || requestedStyle === "candle-body"
      ? requestedStyle : "candlestick";
    const min = Math.max(0, settingNumber(instance, "filterMinDelta", 0));
    const max = Math.max(0, settingNumber(instance, "filterMaxDelta", 0));
    return [{
      key,
      label: "Delta Bar",
      kind: "candlestick",
      candleStyle,
      placement: "pane",
      color: theme.primary,
      lineWidth: Math.min(4, Math.max(1, Math.round(settingNumber(instance, "lineWidth", 1)))) as 1 | 2 | 3 | 4,
      includeZeroInScale: true,
      data: candles.filter(hasVerifiedOrderFlow).map((candle) => {
        const close = Number(candle.askVolume) - Number(candle.bidVolume);
        const path = candleStyle === "candle-body"
          ? { high: Math.max(0, close), low: Math.min(0, close) }
          : candleDeltaPath(candle, close);
        return {
          time: candle.timestamp / 1000,
          value: close,
          open: 0,
          close,
          ...path,
          color: close >= 0 ? theme.positive : theme.negative,
        };
      }).filter(({ value }) => Math.abs(value) >= min && (!max || Math.abs(value) <= max)),
    }];
  }

  if (key === "deep-delta") {
    if (!orderFlowAvailable(candles)) return [];
    const settings = normalizeDeepDeltaSettings(instance.settings);
    const bars = calculateDeepDeltaBars(candles.filter(hasVerifiedOrderFlow), instance.settings);
    if (!bars.length) return [];
    const useTheme = settings.useThemeColors;
    const readColor = (name: string, fallback: string) => useTheme ? fallback : settingString(instance, name, fallback);
    const askColors = [
      theme.positive,
      blendHexColors(theme.muted, theme.positive, 0.35),
      blendHexColors(theme.muted, theme.positive, 0.58),
      blendHexColors(theme.muted, theme.positive, 0.78),
      theme.positive,
    ];
    const bidColors = [
      theme.negative,
      blendHexColors(theme.muted, theme.negative, 0.35),
      blendHexColors(theme.muted, theme.negative, 0.58),
      blendHexColors(theme.muted, theme.negative, 0.78),
      theme.negative,
    ];
    const series: CalculatedIndicatorSeries[] = [];
    // Keep the full series contract stable even when a mode or toggle makes a
    // plot empty. That lets saved palettes continue to address the same plots
    // when the trader swaps between Classic and Multi Range.
    const ranges = [0, 1, 2, 3, 4];
    for (const range of ranges) {
      for (const side of ["ask", "bid"] as const) {
        const colorKey = range === 0 ? `${side === "ask" ? "positive" : "negative"}Color` : `range${range}${side === "ask" ? "Ask" : "Bid"}Color`;
        const fallback = side === "ask" ? askColors[range] : bidColors[range];
        const rangeActive = settings.deltaMode === "classic" ? range === 0 : range > 0;
        const data = rangeActive ? bars.filter((bar) => bar.range === range && bar.side === side).map((bar) => ({
          time: bar.time,
          value: bar.close,
          open: bar.open,
          high: Math.max(bar.open, bar.close),
          low: Math.min(bar.open, bar.close),
          close: bar.close,
        })) : [];
        series.push({
          key: range === 0 ? `${key}-${side === "ask" ? "positive" : "negative"}` : `${key}-range${range}-${side}`,
          label: "KWANT Delta",
          kind: "candlestick",
          candleStyle: "candle-body",
          placement: "pane",
          color: readColor(colorKey, fallback),
          lineWidth: Math.max(1, Math.min(4, Math.round(settings.lineWidth))) as 1 | 2 | 3 | 4,
          includeZeroInScale: true,
          data,
        });
      }
    }
    const positiveShadow = readColor("maximumPositiveColor", theme.positive);
    const negativeShadow = readColor("minimumNegativeColor", theme.negative);
    series.push({
      key: `${key}-maximum-positive`, label: "Maximum positive Delta", kind: "candlestick", candleStyle: "wick-only", placement: "pane", color: positiveShadow,
      lineWidth: Math.max(1, Math.min(4, Math.round(settings.lineWidth))) as 1 | 2 | 3 | 4,
      data: bars.filter((bar) => bar.high > Math.max(0, bar.close)).map((bar) => { const base = Math.max(0, bar.close); return { time: bar.time, value: base, open: base, close: base, low: base, high: bar.high }; }),
    }, {
      key: `${key}-minimum-negative`, label: "Minimum negative Delta", kind: "candlestick", candleStyle: "wick-only", placement: "pane", color: negativeShadow,
      lineWidth: Math.max(1, Math.min(4, Math.round(settings.lineWidth))) as 1 | 2 | 3 | 4,
      data: bars.filter((bar) => bar.low < Math.min(0, bar.close)).map((bar) => { const base = Math.min(0, bar.close); return { time: bar.time, value: base, open: base, close: base, low: bar.low, high: base }; }),
    });
    const first = bars[0]?.time;
    const last = bars.at(-1)?.time;
    if (first != null && last != null) {
      for (const number of [1, 2] as const) {
        const value = settings[`level${number}Value`];
        const color = readColor(`level${number}Color`, theme.secondary);
        const width = Math.max(1, Math.min(4, Math.round(settings[`level${number}LineWidth`]))) as 1 | 2 | 3 | 4;
        const style = settings[`level${number}LineStyle`];
        const positiveData = settings[`level${number}Enabled`] && value > 0 ? [{ time: first, value }, { time: last, value }] : [];
        const negativeData = settings[`level${number}Enabled`] && value > 0 ? [{ time: first, value: -value }, { time: last, value: -value }] : [];
        series.push(
          { key: `${key}-level${number}`, label: `Level ${number}`, kind: "line", placement: "pane", color, lineWidth: width, lineStyle: style, data: positiveData },
          { key: `${key}-level${number}-negative`, label: `Level ${number} negative`, kind: "line", placement: "pane", color, lineWidth: width, lineStyle: style, data: negativeData },
        );
      }
    }
    series.push({
      key: `${key}-marker`, label: "Struggle", kind: "candlestick", candleStyle: "wick-only", placement: "pane",
      color: readColor("markerColor", theme.muted), lineWidth: 2,
      data: settings.markerEnabled ? bars.filter((bar) => bar.struggle).map((bar) => ({ time: bar.time, value: 0, open: 0, close: 0, high: bar.high, low: bar.low })) : [],
    });
    return series;
  }

  if (key === "cvd-divergence") {
    if (!orderFlowAvailable(candles)) return [];
    const flowCandles = candles.filter(hasVerifiedOrderFlow);
    const bars = sessionCvdBars(flowCandles);
    if (!bars.length) return [];
    const useThemeColors = settingBoolean(instance, "useThemeColors", true);
    const bullishColor = useThemeColors ? theme.positive : settingString(instance, "bullishColor", theme.positive);
    const bearishColor = useThemeColors ? theme.negative : settingString(instance, "bearishColor", theme.negative);
    const lineWidth = Math.min(4, Math.max(1, Math.round(settingNumber(instance, "lineWidth", 2)))) as 1 | 2 | 3 | 4;
    const segments = detectCvdDivergences(flowCandles, bars, {
      pivotStrength: settingNumber(instance, "pivotStrength", 2),
      lookbackBars: settingNumber(instance, "lookbackBars", 300),
    });

    // This study IS the CVD, drawn as candles, with divergences marked on it.
    // It was previously a plain line, which left nowhere to hang a wick-to-wick
    // marker and made it indistinguishable from the CVD indicator itself.
    const series: CalculatedIndicatorSeries[] = [{
      key,
      label: "CVD",
      kind: "candlestick",
      placement: "pane",
      cvdDivergences: segments,
      color: theme.primary,
      includeZeroInScale: false,
      data: bars.map((bar) => ({
        time: bar.time,
        value: bar.close,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        // Candle colour is carried per bar, matching the CVD study.
        color: bar.close >= bar.open ? theme.positive : theme.negative,
      })),
    }];

    // Every divergence is drawn, and each one stays. They share a single
    // series with an invisible hop between segments: one series per signal
    // would mean dozens of chart series over a session.
    const push = (kind: CvdDivergenceSegment["kind"], color: string) => {
      const chosen = segments.filter((segment) => segment.kind === kind);
      if (!chosen.length) return;
      const data: CalculatedIndicatorSeries["data"] = [];
      let previousTime = Number.NEGATIVE_INFINITY;
      for (const segment of chosen) {
        // A line series needs strictly increasing times, so a segment that
        // would repeat or reverse a time is skipped rather than corrupting
        // the whole series.
        if (segment.fromTime <= previousTime || segment.toTime <= segment.fromTime) continue;
        data.push({ time: segment.fromTime, value: segment.fromCvd, breakBefore: data.length > 0 });
        data.push({ time: segment.toTime, value: segment.toCvd });
        previousTime = segment.toTime;
      }
      if (data.length < 2) return;
      series.push({
        key: `${key}-${kind}`,
        label: kind === "bullish" ? "Bullish divergence" : "Bearish divergence",
        kind: "line",
        placement: "pane",
        color,
        lineWidth,
        lineStyle: "dotted",
        lastValueVisible: false,
        data,
      });
    };
    push("bullish", bullishColor);
    push("bearish", bearishColor);
    return series;
  }

  if (
    key === "cumulative-volume-delta"
    || key === "delta-cumulative-candlestick"
    || key === "delta-cumulative-histogram"
  ) {
    const dedicatedCandlestick = key === "delta-cumulative-candlestick";
    const dedicatedHistogram = key === "delta-cumulative-histogram";
    const dedicatedStudy = dedicatedCandlestick || dedicatedHistogram;
    const startHour = dedicatedStudy
      ? Math.min(23, Math.max(0, Math.round(settingNumber(instance, "sessionStartHour", 17))))
      : 17;
    const resetToSession = dedicatedStudy
      ? settingBoolean(instance, "resetToSession", true)
      : true;
    const periodMode = settingString(instance, "periodMode", "days");
    const periodValue = Math.max(1, Math.round(settingNumber(instance, "periodValue", 1)));
    const displayStyle = settingString(instance, "displayStyle", dedicatedHistogram ? "bars" : "candles");
    const inputData = settingString(instance, "inputData", "Volumes");
    const useTradeCounts = inputData === "Aggregate Trades" || inputData === "Orders";
    if (!candles.some(candle => hasVerifiedCvdInput(candle, useTradeCounts))) return [];
    const useThemeColors = settingBoolean(instance, "useThemeColors", dedicatedStudy);
    const askColor = useThemeColors ? theme.positive : settingString(instance, "deltaAskColor", theme.positive);
    const bidColor = useThemeColors ? theme.negative : settingString(instance, "deltaBidColor", theme.negative);
    const lineColor = useThemeColors ? "var(--primary)" : settingString(instance, "lineColor", "var(--primary)");
    const lineWidth = Math.min(4, Math.max(1, Math.round(settingNumber(instance, "lineWidth", 2)))) as 1 | 2 | 3 | 4;
    const showBidAsk = settingBoolean(instance, "showBidAskVolumes", false);
    const filteredEnabled = settingBoolean(instance, "filteredEnabled", false);
    const filteredSeparateAxis = settingBoolean(instance, "filteredSeparateAxis", false);
    const filterMin = Math.max(0, settingNumber(instance, "filterMinVolume", 0));
    const filterMax = Math.max(0, settingNumber(instance, "filterMaxVolume", 0));
    const showZeroLine = settingBoolean(instance, "showZeroLine", true);
    const zeroLineColor = useThemeColors ? theme.muted : settingString(instance, "zeroLineColor", theme.muted);
    const zeroLineWidth = Math.min(4, Math.max(1, Math.round(settingNumber(instance, "zeroLineWidth", 1)))) as 1 | 2 | 3 | 4;
    let activePeriod = "";
    let cumulative = 0;
    let cumulativeAsk = 0;
    let cumulativeBid = 0;
    let cumulativeFiltered = 0;
    let missingFlowSinceLastVerified = false;
    const cvd: CalculatedIndicatorSeries["data"] = [];
    const askVolume: Array<{ time: number; value: number; breakBefore?: boolean }> = [];
    const bidVolume: Array<{ time: number; value: number; breakBefore?: boolean }> = [];
    const filtered: Array<{ time: number; value: number; color: string; breakBefore?: boolean }> = [];

    candles.forEach((candle) => {
      // Saved OHLCV-only bars have no aggressor-side split. They must not be
      // rendered as zero delta because that creates a false flat CVD history.
      if (!hasVerifiedCvdInput(candle, useTradeCounts)) {
        missingFlowSinceLastVerified = true;
        return;
      }
      const session = sessionKey(candle.timestamp, startHour);
      const sessionDay = Math.floor(Date.parse(`${session}T00:00:00Z`) / 86_400_000);
      const timestampSeconds = Math.floor(candle.timestamp / 1000);
      const nextPeriod = dedicatedStudy
        ? (resetToSession ? `d:${session}` : "continuous")
        : periodMode === "minutes"
          ? `m:${Math.floor(timestampSeconds / (periodValue * 60))}`
          : periodMode === "seconds"
            ? `s:${Math.floor(timestampSeconds / periodValue)}`
            : `d:${Math.floor(sessionDay / periodValue)}`;
      const periodChanged = nextPeriod !== activePeriod;
      const seriesBreak = periodChanged || missingFlowSinceLastVerified;
      if (seriesBreak) {
        activePeriod = nextPeriod;
        cumulative = 0;
        cumulativeAsk = 0;
        cumulativeBid = 0;
        cumulativeFiltered = 0;
      }
      missingFlowSinceLastVerified = false;

      const ask = Math.max(0, finite(useTradeCounts ? candle.askTrades : candle.askVolume));
      const bid = Math.max(0, finite(useTradeCounts ? candle.bidTrades : candle.bidVolume));
      const total = ask + bid;
      // Classified side totals are the authority for this input mode. A
      // stale cached deltaClose (often zero after a hydrate) must not flatten
      // current flow even though its actual Ask/Bid totals keep advancing.
      const delta = ask - bid;
      const path = useTradeCounts ? { high: Math.max(0, delta), low: Math.min(0, delta) } : candleDeltaPath(candle, delta);
      const passesFilter = total >= filterMin && (filterMax === 0 || total <= filterMax);
      const filteredDelta = passesFilter ? delta : 0;
      const plottedDelta = dedicatedStudy ? filteredDelta : delta;
      const cumulativeBase = cumulative;
      // The previous verified close is the cumulative candle's open. Source
      // session offsets and old baked open=close values are not another flow.
      const cumulativeHigh = cumulativeBase + (passesFilter || !dedicatedStudy ? path.high : 0);
      const cumulativeLow = cumulativeBase + (passesFilter || !dedicatedStudy ? path.low : 0);
      cumulative = cumulativeBase + plottedDelta;
      const cumulativeOpen = cumulativeBase;
      cumulativeAsk += ask;
      cumulativeBid += bid;
      cumulativeFiltered += filteredDelta;
      const time = candle.timestamp / 1000;
      cvd.push({
        time,
        value: cumulative,
        open: cumulativeOpen,
        high: Math.max(cumulativeOpen, cumulativeHigh, cumulative),
        low: Math.min(cumulativeOpen, cumulativeLow, cumulative),
        close: cumulative,
        color: displayStyle === "line" ? undefined : cumulative >= cumulativeOpen ? askColor : bidColor,
        breakBefore: seriesBreak,
      });
      askVolume.push({ time, value: cumulativeAsk, breakBefore: seriesBreak });
      bidVolume.push({ time, value: cumulativeBid, breakBefore: seriesBreak });
      filtered.push({
        time,
        value: cumulativeFiltered,
        breakBefore: seriesBreak,
        color: cumulativeFiltered >= 0
          ? (useThemeColors ? theme.positive : settingString(instance, "filteredAskColor", askColor))
          : (useThemeColors ? theme.negative : settingString(instance, "filteredBidColor", bidColor)),
      });
    });

    const requestedCandleStyle = settingString(instance, "candleStyle", "candlestick");
    const candleStyle: CalculatedIndicatorSeries["candleStyle"] = ["candlestick", "ohlc", "candle-body"].includes(requestedCandleStyle)
      ? requestedCandleStyle as CalculatedIndicatorSeries["candleStyle"]
      : "candlestick";
    const series: CalculatedIndicatorSeries[] = [{
      key,
      label: dedicatedStudy
        ? settingString(
            instance,
            "customName",
            dedicatedCandlestick ? "Cumulative Delta Candlestick" : "Cumulative Delta Histogram",
          )
        : settingString(instance, "customName", "Cumulative Volume Delta"),
      kind: displayStyle === "candles" ? "candlestick" : displayStyle === "bars" ? "histogram" : "line",
      placement: "pane",
      color: displayStyle === "line" ? lineColor : theme.primary,
      lineWidth,
      lineStyle: displayStyle === "line"
        ? settingString(instance, "lineStyle", "solid") === "hatch"
          ? "dotted"
          : settingString(instance, "lineStyle", "solid") === "dashed"
            ? "dashed"
            : settingString(instance, "lineStyle", "solid") === "dotted"
              ? "dotted"
              : "solid"
        : undefined,
      candleStyle: dedicatedCandlestick ? candleStyle : "candlestick",
      lastValueVisible: settingBoolean(instance, "showValue", true),
      showZeroLine,
      zeroLineColor,
      zeroLineWidth,
      // Bookmap exposes a Compact scale specifically so a large cumulative
      // offset does not flatten the visible CVD. Keep the zero reference line,
      // but scale to the visible cumulative range rather than forcing zero
      // into every pane domain.
      includeZeroInScale: false,
      data: cvd,
    }];
    if (showBidAsk) {
      series.push(
        {
          key: `${key}-ask-volume`,
          label: "Ask volume",
          kind: "line",
          placement: "pane",
          color: useThemeColors ? theme.positive : settingString(instance, "volumeAskColor", theme.positive),
          lineWidth: 1,
          data: askVolume,
        },
        {
          key: `${key}-bid-volume`,
          label: "Bid volume",
          kind: "line",
          placement: "pane",
          color: useThemeColors ? theme.negative : settingString(instance, "volumeBidColor", theme.negative),
          lineWidth: 1,
          data: bidVolume,
        },
      );
    }
    if (filteredEnabled) {
      series.push({
        key: `${key}-filtered`,
        label: "Filtered CVD",
        kind: "line",
        placement: "pane",
        color: theme.secondary,
        lineWidth,
        independentScale: filteredSeparateAxis,
        showZeroLine,
        zeroLineColor,
        zeroLineWidth,
        data: filtered,
      });
    }
    if (dedicatedCandlestick && settingBoolean(instance, "showAverage", false)) {
      const averageLength = Math.max(1, Math.round(settingNumber(instance, "averageLength", 20)));
      const averageType = settingString(instance, "averageType", "simple");
      const averages = Array<number | null>(cvd.length).fill(null);
      const deviations = Array<number | null>(cvd.length).fill(null);
      const averageWindow: number[] = [];
      let exponentialAverage: number | null = null;
      cvd.forEach((point, index) => {
        if (point.breakBefore) {
          averageWindow.length = 0;
          exponentialAverage = null;
        }
        averageWindow.push(point.value);
        if (averageWindow.length > averageLength) averageWindow.shift();
        if (averageType === "exponential") {
          const alpha = 2 / (averageLength + 1);
          exponentialAverage = exponentialAverage == null
            ? point.value
            : point.value * alpha + exponentialAverage * (1 - alpha);
        }
        if (averageWindow.length < averageLength) return;
        const average = averageType === "exponential"
          ? exponentialAverage as number
          : averageWindow.reduce((sum, value) => sum + value, 0) / averageLength;
        averages[index] = average;
        deviations[index] = Math.sqrt(
          Math.max(
            0,
            averageWindow.reduce((sum, value) => sum + (value - average) ** 2, 0) / averageLength,
          ),
        );
      });
      const averageColor = useThemeColors
        ? theme.secondary
        : settingString(instance, "averageColor", theme.secondary);
      series.push({
        key: `${key}-average`,
        label: `Average ${averageLength}`,
        kind: "line",
        placement: "pane",
        color: averageColor,
        lineWidth: Math.min(
          4,
          Math.max(1, Math.round(settingNumber(instance, "averageLineWidth", 2))),
        ) as 1 | 2 | 3 | 4,
        lineStyle: settingString(instance, "averageLineStyle", "solid") === "dashed"
          ? "dashed"
          : settingString(instance, "averageLineStyle", "solid") === "dotted"
            ? "dotted"
            : "solid",
        data: cvd.flatMap((point, index) => averages[index] == null
          ? []
          : [{ time: point.time, value: averages[index] as number, breakBefore: point.breakBefore }]),
      });
      if (settingBoolean(instance, "showAverageDeviations", false)) {
        const deviationMultiplier = Math.max(0.1, settingNumber(instance, "averageDeviation", 2));
        const deviationColor = useThemeColors
          ? theme.muted
          : settingString(instance, "deviationColor", theme.muted);
        (["upper", "lower"] as const).forEach((side) => {
          series.push({
            key: `${key}-average-${side}`,
            label: `${side === "upper" ? "+" : "-"}${deviationMultiplier}σ`,
            kind: "line",
            placement: "pane",
            color: deviationColor,
            lineWidth: 1,
            lineStyle: "dotted",
            data: cvd.flatMap((point, index) => {
              const average = averages[index];
              const deviation = deviations[index];
              if (average == null || deviation == null) return [];
              return [{
                time: point.time,
                value: average + (side === "upper" ? 1 : -1) * deviation * deviationMultiplier,
                breakBefore: point.breakBefore,
              }];
            }),
          });
        });
      }
    }
    return series;
  }

  if (key === "moving-average") {
    const length = Math.max(1, Math.round(settingNumber(instance, "length", 20)));
    return [{
      key,
      label: `MA ${length}`,
      kind: "line",
      placement: "overlay",
      color: theme.primary,
      lineWidth: 2,
      data: sma(candles, length),
    }];
  }

  if (key === "rolling-vwap") {
    if (!volumeAvailable(candles)) return [];
    const periodValue = Math.max(1, Math.round(settingNumber(instance, "periodValue", settingNumber(instance, "length", 60))));
    const periodMode = settingString(instance, "periodMode", "bars") as "bars" | "minutes" | "days";
    const source = settingString(instance, "source", "hlc3") as VwapSource;
    const envelopeMode = settingString(instance, "envelopeMode", "standard-deviation") as VwapEnvelopeMode;
    const stats = calculateRollingVwap(candles, { source, periodMode, periodValue });
    const bands = [1, 2, 3, 4, 5].flatMap((bandNumber, index) => {
      const enabled = settingBoolean(instance, `band${bandNumber}Enabled`, bandNumber <= 3);
      const multiplier = Math.max(0, settingNumber(instance, `band${bandNumber}`, bandNumber));
      const color = vwapBandColor(theme, index);
      return [
        {
          key: `${key}-upper-${index + 1}`,
          label: `Rolling VWAP +${multiplier}${envelopeMode === "price-percentage" ? "%" : "σ"}`,
          kind: "line" as const,
          placement: "overlay" as const,
          color,
          lineWidth: vwapLineWidth(instance, "bandLineWidth", 1),
          lineStyle: vwapLineStyle(instance, "bandLineStyle", "dotted"),
          lastValueVisible: false,
          data: enabled ? stats.map(({ time, value, deviation, breakBefore }) => ({
            time,
            value: value + vwapEnvelopeOffset({ value, deviation }, multiplier, envelopeMode),
            breakBefore,
          })) : [],
        },
        {
          key: `${key}-lower-${index + 1}`,
          label: `Rolling VWAP -${multiplier}${envelopeMode === "price-percentage" ? "%" : "σ"}`,
          kind: "line" as const,
          placement: "overlay" as const,
          color,
          lineWidth: vwapLineWidth(instance, "bandLineWidth", 1),
          lineStyle: vwapLineStyle(instance, "bandLineStyle", "dotted"),
          lastValueVisible: false,
          data: enabled ? stats.map(({ time, value, deviation, breakBefore }) => ({
            time,
            value: value - vwapEnvelopeOffset({ value, deviation }, multiplier, envelopeMode),
            breakBefore,
          })) : [],
        },
      ];
    });
    return [
      {
        key,
        label: `Rolling VWAP ${periodValue} ${periodMode}`,
        kind: "line",
        placement: "overlay",
        color: theme.primary,
        lineWidth: vwapLineWidth(instance, "lineWidth", 2),
        lineStyle: vwapLineStyle(instance, "lineStyle", "solid"),
        lastValueVisible: settingBoolean(instance, "showCurrentValue", false),
        data: stats.map(({ time, value, breakBefore }) => ({ time, value, breakBefore })),
      },
      ...bands,
    ];
  }

  if (key === "aroon-oscillator") {
    const length = Math.max(2, Math.round(settingNumber(instance, "length", AROON_OSCILLATOR_LENGTH)));
    return [{
      key,
      label: `Aroon Oscillator (${length})`,
      kind: "histogram",
      placement: "pane",
      color: theme.positive,
      histogramBarWidth: 3,
      showZeroLine: true,
      includeZeroInScale: true,
      data: aroonData(instance, candles, length, theme),
    }];
  }

  const closes = candles.map((candle) => candle.close);
  const highs = candles.map((candle) => candle.high);
  const lows = candles.map((candle) => candle.low);

  if (key === "relative-strength-index-rsi") {
    const config = rsiSettings(instance.settings);
    const colors = defaultIndicatorPlotColors(key, theme);
    const { length } = config;
    const gains = closes.map((close, index) => index === 0 ? 0 : Math.max(0, close - closes[index - 1]));
    const losses = closes.map((close, index) => index === 0 ? 0 : Math.max(0, closes[index - 1] - close));
    const averageGain = wilder(gains.slice(1), length);
    const averageLoss = wilder(losses.slice(1), length);
    const values: Array<number | null> = [null];
    averageGain.forEach((gain, index) => {
      const loss = averageLoss[index];
      values.push(gain == null || loss == null ? null : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
    });
    const data = lineData(candles, values);
    const series: CalculatedIndicatorSeries[] = [{
      key, label: `RSI (${length})`, kind: "line", placement: "pane",
      color: colors.plotColor, lineWidth: 2, data,
    }];
    if (config.showAverage) {
      const average = smoother(config.averageLength, config.averageType);
      const averageData = lineData(candles, values.map(value => average.push(value ?? NaN) ?? null));
      const averageLabel = { simple: "SMA", exponential: "EMA", triangular: "TMA", weighted: "WMA" }[config.averageType];
      series.push({
        key: `${key}-average`, label: `${averageLabel} (${config.averageLength})`, kind: "line", placement: "pane",
        color: colors.averageColor, lineWidth: 1, data: averageData,
      });
    }
    if (config.showLevels && data.length) {
      const inPane = !momentumOnChart(instance);
      for (const [name, value, color] of [
        ["overbought", config.overboughtLevel, colors.overboughtColor],
        ["oversold", config.oversoldLevel, colors.oversoldColor],
      ] as const) {
        series.push({
          key: `${key}-${name}`, label: String(value), kind: "line", placement: "pane", color,
          lineWidth: config.levelLineWidth, lineStyle: "dotted", horizontalPriceLine: inPane, lastValueVisible: false,
          data: inPane ? [{ time: data[0].time, value }] : data.map(point => ({ time: point.time, value })),
        });
      }
    }
    return series;
  }

  if (key === "rate-of-change-roc" || key === "momentum-indicator") {
    const length = Math.max(1, Math.round(settingNumber(instance, "length", key === "rate-of-change-roc" ? 12 : 10)));
    const values = closes.map((close, index) => {
      if (index < length) return null;
      return key === "rate-of-change-roc"
        ? (closes[index - length] === 0 ? 0 : ((close / closes[index - length]) - 1) * 100)
        : close - closes[index - length];
    });
    return [{
      key,
      label: key === "rate-of-change-roc" ? `ROC ${length}` : `Momentum ${length}`,
      kind: "line",
      placement: "pane",
      color: theme.primary,
      lineWidth: 2,
      data: lineData(candles, values),
    }];
  }

  if (key === "macd-indicator") {
    const fast = Math.max(1, Math.round(settingNumber(instance, "fastLength", 12)));
    const slow = Math.max(fast + 1, Math.round(settingNumber(instance, "slowLength", 26)));
    const signalLength = Math.max(1, Math.round(settingNumber(instance, "signalLength", 9)));
    const fastEma = ema(closes, fast);
    const slowEma = ema(closes, slow);
    const macd = closes.map((_, index) => fastEma[index] - slowEma[index]);
    const signal = ema(macd, signalLength);
    return [
      {
        key: `${key}-macd`,
        label: "MACD",
        kind: "line",
        placement: "pane",
        color: theme.primary,
        lineWidth: 2,
        data: lineData(candles, macd),
      },
      {
        key: `${key}-signal`,
        label: "Signal",
        kind: "line",
        placement: "pane",
        color: theme.secondary,
        lineWidth: 1,
        data: lineData(candles, signal),
      },
      {
        key: `${key}-histogram`,
        label: "Histogram",
        kind: "histogram",
        placement: "pane",
        color: theme.muted,
        data: candles.map((candle, index) => ({
          time: candle.timestamp / 1000,
          value: macd[index] - signal[index],
          color: macd[index] >= signal[index] ? theme.positive : theme.negative,
        })),
      },
    ];
  }

  if (key === "average-true-range-atr") {
    const length = Math.max(1, Math.round(settingNumber(instance, "length", 14)));
    const values = wilder(trueRanges(candles), length);
    const style = settingString(instance, "lineStyle", "solid");
    return [{
      key,
      label: `ATR ${length}`,
      kind: "line",
      placement: "pane",
      color: theme.primary,
      lineWidth: Math.max(1, Math.min(4, Math.round(settingNumber(instance, "lineWidth", 2)))) as 1 | 2 | 3 | 4,
      lineStyle: style === "dashed" || style === "dotted" ? style : "solid",
      data: lineData(candles, values),
    }];
  }

  if (key === "standard-deviation") {
    const length = Math.max(2, Math.round(settingNumber(instance, "length", 20)));
    return [{
      key,
      label: `StdDev ${length}`,
      kind: "line",
      placement: "pane",
      color: theme.primary,
      lineWidth: 2,
      data: lineData(candles, rollingDeviation(closes, length)),
    }];
  }

  if (key === "bollinger-bands") {
    const length = Math.min(500, Math.max(2, Math.round(settingNumber(instance, "length", 20))));
    const multiplier = Math.min(10, Math.max(0.1, settingNumber(instance, "multiplier", 2)));
    const middle: CalculatedIndicatorSeries["data"] = [];
    const upper: CalculatedIndicatorSeries["data"] = [];
    const lower: CalculatedIndicatorSeries["data"] = [];
    // Center the rolling moments to retain small deviations at high prices.
    const origin = closes[0];
    let sum = 0;
    let squares = 0;
    for (let index = 0; index < closes.length; index += 1) {
      const value = closes[index] - origin;
      sum += value;
      squares += value * value;
      if (index >= length) {
        const outgoing = closes[index - length] - origin;
        sum -= outgoing;
        squares -= outgoing * outgoing;
      }
      if (index < length - 1) continue;
      const mean = sum / length;
      const basis = origin + mean;
      const width = Math.sqrt(Math.max(0, squares / length - mean * mean)) * multiplier;
      if (!Number.isFinite(basis) || !Number.isFinite(width)) continue;
      const time = candles[index].timestamp / 1000;
      middle.push({ time, value: basis });
      upper.push({ time, value: basis + width });
      lower.push({ time, value: basis - width });
    }
    return [
      {
        key: `${key}-middle`,
        label: `BB Basis ${length}`,
        kind: "line",
        placement: "overlay",
        color: theme.primary,
        lineWidth: 2,
        data: middle,
      },
      {
        key: `${key}-upper`,
        label: `BB +${multiplier}σ`,
        kind: "line",
        placement: "overlay",
        color: theme.secondary,
        lineWidth: 1,
        data: upper,
      },
      {
        key: `${key}-lower`,
        label: `BB -${multiplier}σ`,
        kind: "line",
        placement: "overlay",
        color: theme.secondary,
        lineWidth: 1,
        data: lower,
      },
    ];
  }

  if (key === "donchian-channel") {
    const length = Math.max(2, Math.round(settingNumber(instance, "length", 20)));
    const upper = highs.map((_, index) => index < length - 1 ? null : windowMax(highs, index - length + 1, index));
    const lower = lows.map((_, index) => index < length - 1 ? null : windowMin(lows, index - length + 1, index));
    return [
      {
        key: `${key}-upper`,
        label: `Donchian High ${length}`,
        kind: "line",
        placement: "overlay",
        color: theme.positive,
        lineWidth: 1,
        data: lineData(candles, upper),
      },
      {
        key: `${key}-middle`,
        label: "Donchian Mid",
        kind: "line",
        placement: "overlay",
        color: theme.primary,
        lineWidth: 1,
        data: lineData(candles, upper.map((value, index) => value == null || lower[index] == null ? null : (value + lower[index]!) / 2)),
      },
      {
        key: `${key}-lower`,
        label: `Donchian Low ${length}`,
        kind: "line",
        placement: "overlay",
        color: theme.negative,
        lineWidth: 1,
        data: lineData(candles, lower),
      },
    ];
  }

  if (key === "keltner-channel") {
    const length = Math.max(2, Math.round(settingNumber(instance, "length", 20)));
    const atrLength = Math.max(1, Math.round(settingNumber(instance, "atrLength", 10)));
    const multiplier = Math.max(0.1, settingNumber(instance, "multiplier", 2));
    const middle = ema(closes, length);
    const atr = wilder(trueRanges(candles), atrLength);
    return [
      {
        key: `${key}-middle`,
        label: `Keltner EMA ${length}`,
        kind: "line",
        placement: "overlay",
        color: theme.primary,
        lineWidth: 2,
        data: lineData(candles, middle),
      },
      {
        key: `${key}-upper`,
        label: "Keltner Upper",
        kind: "line",
        placement: "overlay",
        color: theme.secondary,
        lineWidth: 1,
        data: lineData(candles, middle.map((value, index) => atr[index] == null ? null : value + atr[index]! * multiplier)),
      },
      {
        key: `${key}-lower`,
        label: "Keltner Lower",
        kind: "line",
        placement: "overlay",
        color: theme.secondary,
        lineWidth: 1,
        data: lineData(candles, middle.map((value, index) => atr[index] == null ? null : value - atr[index]! * multiplier)),
      },
    ];
  }

  if (key === "awesome-oscillator") {
    const fast = Math.max(1, Math.min(500, Math.round(settingNumber(instance, "fastLength", 5))));
    const slow = Math.max(fast + 1, Math.min(1000, Math.round(settingNumber(instance, "slowLength", 34))));
    const median = candles.map((candle) => (candle.high + candle.low) / 2);
    const fastMean = rollingMean(median, fast);
    const slowMean = rollingMean(median, slow);
    const values = fastMean.map((value, index) => value == null || slowMean[index] == null ? null : value - slowMean[index]!);
    return [{
      key,
      label: "Awesome Oscillator",
      kind: "histogram",
      placement: "pane",
      includeZeroInScale: true,
      color: theme.primary,
      data: lineData(candles, values).map((row, index, points) => ({
        ...row,
        color: index === 0 || row.value >= points[index - 1].value ? theme.positive : theme.negative,
      })),
    }];
  }

  if (key === "stochastic-oscillator" || key === "williams-r") {
    const length = Math.max(2, Math.round(settingNumber(instance, "length", 14)));
    const smooth = Math.max(1, Math.round(settingNumber(instance, "smooth", 3)));
    const raw = closes.map((close, index) => {
      if (index < length - 1) return null;
      const highest = windowMax(highs, index - length + 1, index);
      const lowest = windowMin(lows, index - length + 1, index);
      if (highest === lowest) return 0;
      return key === "williams-r"
        ? -100 * ((highest - close) / (highest - lowest))
        : 100 * ((close - lowest) / (highest - lowest));
    });
    if (key === "williams-r") {
      return [{ key, label: `Williams %R ${length}`, kind: "line", placement: "pane", color: theme.primary, lineWidth: 2, data: lineData(candles, raw) }];
    }
    const k = rollingMeanNullable(raw, smooth);
    const d = rollingMeanNullable(k, smooth);
    return [
      { key: `${key}-k`, label: "%K", kind: "line", placement: "pane", color: theme.primary, lineWidth: 2, data: lineData(candles, k) },
      { key: `${key}-d`, label: "%D", kind: "line", placement: "pane", color: theme.secondary, lineWidth: 1, data: lineData(candles, d) },
    ];
  }

  if (key === "chaikin-accumulation-distribution") {
    const width = (field: string, fallback: number) =>
      Math.max(1, Math.min(4, Math.round(settingNumber(instance, field, fallback)))) as 1 | 2 | 3 | 4;
    const showAverage = settingBoolean(instance, "showAverage", false);
    const length = Math.max(1, Math.min(1000, Math.round(settingNumber(instance, "averageLength", 20))));
    const requested = settingString(instance, "averageType", "simple");
    const type: KstAverage = requested === "exponential" || requested === "triangular" || requested === "weighted" ? requested : "simple";
    const average = showAverage ? smoother(length, type) : null;
    const data: CalculatedIndicatorSeries["data"] = [];
    const averageData: CalculatedIndicatorSeries["data"] = [];
    let hasVolume = false;
    let cumulative = 0;
    for (const candle of candles) {
      const { high, low, close } = candle;
      const reported = Math.max(0, finite(candle.volume));
      const volume = reported || Math.max(0, finite(candle.askVolume)) + Math.max(0, finite(candle.bidVolume));
      hasVolume ||= volume > 0;
      const range = high - low;
      if (Number.isFinite(range) && range > 0 && close >= low && close <= high) {
        cumulative += ((close - low) - (high - close)) / range * volume;
      }
      const time = candle.timestamp / 1000;
      data.push({ time, value: cumulative });
      const smoothed = average?.push(cumulative);
      if (smoothed !== undefined) averageData.push({ time, value: smoothed });
    }
    if (!hasVolume) return [];
    const series: CalculatedIndicatorSeries[] = [{
      key, label: "Chaikin A/D", kind: "line", placement: "pane",
      color: theme.primary, lineWidth: width("lineWidth", 2), data,
    }];
    if (average) series.push({
      key: `${key}-average`, label: `Average ${length}`, kind: "line", placement: "pane",
      color: theme.secondary, lineWidth: width("averageLineWidth", 1), data: averageData,
    });
    return series;
  }

  if (key === "vwap" || key === "vwap-envelopes") {
    if (!volumeAvailable(candles)) return [];
    const source = settingString(instance, "source", "hlc3") as VwapSource;
    const envelopeMode = settingString(instance, "envelopeMode", "standard-deviation") as VwapEnvelopeMode;
    const periodValue = Math.max(1, Math.round(settingNumber(instance, "periodValue", 1)));
    const periodMode = settingString(instance, "periodMode", key === "vwap-envelopes" ? "days" : "days");
    const rows = key === "vwap-envelopes"
      ? calculateRollingVwap(candles, {
        source,
        periodMode: periodMode === "minutes" ? "minutes" : "days",
        periodValue,
      })
      : calculatePeriodVwap(candles, {
        source,
        periodMode: ["days", "minutes", "seconds", "orders"].includes(periodMode)
          ? periodMode as "days" | "minutes" | "seconds" | "orders"
          : "days",
        periodValue,
        sessionStartHour: settingNumber(instance, "sessionStartHour", 17),
      });
    const series: CalculatedIndicatorSeries[] = [{
      key: `${key}-main`,
      label: "VWAP",
      kind: "line",
      placement: "overlay",
      color: theme.primary,
      lineWidth: vwapLineWidth(instance, "lineWidth", 2),
      lineStyle: vwapLineStyle(instance, "lineStyle", "solid"),
      lastValueVisible: settingBoolean(instance, "showCurrentValue", false),
      data: rows.map(({ time, value, breakBefore }) => ({ time, value, breakBefore })),
    }];
    [1, 2, 3, 4, 5].forEach((bandNumber, index) => {
      const defaultEnabled = key === "vwap-envelopes" && bandNumber <= 3;
      const enabled = settingBoolean(instance, `band${bandNumber}Enabled`, defaultEnabled);
      const factor = Math.max(0, settingNumber(instance, `band${bandNumber}`, bandNumber));
      const suffix = envelopeMode === "price-percentage" ? "%" : "σ";
      series.push(
          {
            key: `${key}-upper-${bandNumber}`,
            label: `VWAP +${factor}${suffix}`,
            kind: "line",
            placement: "overlay",
            color: vwapBandColor(theme, index),
            lineWidth: vwapLineWidth(instance, "bandLineWidth", 1),
            lineStyle: vwapLineStyle(instance, "bandLineStyle", "dotted"),
            lastValueVisible: false,
            data: enabled ? rows.map(({ time, value, deviation, breakBefore }) => ({
              time,
              value: value + vwapEnvelopeOffset({ value, deviation }, factor, envelopeMode),
              breakBefore,
            })) : [],
          },
          {
            key: `${key}-lower-${bandNumber}`,
            label: `VWAP -${factor}${suffix}`,
            kind: "line",
            placement: "overlay",
            color: vwapBandColor(theme, index),
            lineWidth: vwapLineWidth(instance, "bandLineWidth", 1),
            lineStyle: vwapLineStyle(instance, "bandLineStyle", "dotted"),
            lastValueVisible: false,
            data: enabled ? rows.map(({ time, value, deviation, breakBefore }) => ({
              time,
              value: value - vwapEnvelopeOffset({ value, deviation }, factor, envelopeMode),
              breakBefore,
            })) : [],
          },
      );
    });
    return series;
  }

  return [];
}
