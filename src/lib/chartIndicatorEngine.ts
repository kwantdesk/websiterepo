import type { Candle } from "@/lib/backtester";
import { exchangeClockParts } from "@/lib/exchangeClock";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";
import { calculateDeepEffort } from "@/lib/deepEffort";
import { detectCvdDivergences, sessionCvdBars, type CvdDivergenceSegment } from "@/lib/cvdDivergence";
import { runSourceIndicator, type SourceIndicatorLanguage } from "@/lib/indicatorSourceAdapters";
import { applyIndicatorPlotColors } from "@/lib/indicatorPlotColors";

export type CalculatedIndicatorSeries = {
  key: string;
  groupKey?: string;
  label: string;
  kind: "line" | "histogram" | "candlestick";
  placement: "overlay" | "pane";
  color: string;
  lineWidth?: 1 | 2 | 3 | 4;
  lineStyle?: "solid" | "dashed" | "dotted";
  lineType?: "simple" | "with-steps";
  lastValueVisible?: boolean;
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

function sessionVwap(candles: Candle[], sessionStartHour: number) {
  let key = "";
  let weightedPrice = 0;
  let weightedVariance = 0;
  let volume = 0;
  return candles.map((candle) => {
    const nextKey = sessionKey(candle.timestamp, sessionStartHour);
    const breakBefore = key !== "" && nextKey !== key;
    if (nextKey !== key) {
      key = nextKey;
      weightedPrice = 0;
      weightedVariance = 0;
      volume = 0;
    }
    const typical = (candle.high + candle.low + candle.close) / 3;
    const barVolume = Math.max(0, finite(candle.volume));
    weightedPrice += typical * barVolume;
    weightedVariance += typical * typical * barVolume;
    volume += barVolume;
    const value = volume > 0 ? weightedPrice / volume : typical;
    const variance = volume > 0 ? Math.max(0, weightedVariance / volume - value * value) : 0;
    return { time: candle.timestamp / 1000, value, deviation: Math.sqrt(variance), breakBefore };
  });
}

function rollingVwap(candles: Candle[], length: number, sessionStartHour: number) {
  const output: Array<{ time: number; value: number; deviation: number; breakBefore: boolean }> = [];
  let pv = 0;
  let p2v = 0;
  let volume = 0;
  let activeSession = "";
  let pendingSessionBreak = false;
  const queue: Array<{ pv: number; p2v: number; volume: number }> = [];
  candles.forEach((candle) => {
    const nextSession = sessionKey(candle.timestamp, sessionStartHour);
    if (activeSession !== nextSession) {
      pendingSessionBreak = activeSession !== "";
      activeSession = nextSession;
      pv = 0;
      p2v = 0;
      volume = 0;
      queue.length = 0;
    }
    const typical = (candle.high + candle.low + candle.close) / 3;
    const barVolume = Math.max(0, finite(candle.volume));
    const item = {
      pv: typical * barVolume,
      p2v: typical * typical * barVolume,
      volume: barVolume,
    };
    queue.push(item);
    pv += item.pv;
    p2v += item.p2v;
    volume += item.volume;
    if (queue.length > length) {
      const removed = queue.shift()!;
      pv -= removed.pv;
      p2v -= removed.p2v;
      volume -= removed.volume;
    }
    if (queue.length === length) {
      const value = volume > 0 ? pv / volume : candle.close;
      const variance = volume > 0 ? Math.max(0, p2v / volume - value * value) : 0;
      output.push({
        time: candle.timestamp / 1000,
        value,
        deviation: Math.sqrt(variance),
        breakBefore: pendingSessionBreak,
      });
      pendingSessionBreak = false;
    }
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
function windowArgMax(values: number[], start: number, endInclusive: number): number {
  let idx = start; let max = values[start];
  for (let i = start; i <= endInclusive; i += 1) if (values[i] >= max) { max = values[i]; idx = i; }
  return idx;
}
function windowArgMin(values: number[], start: number, endInclusive: number): number {
  let idx = start; let min = values[start];
  for (let i = start; i <= endInclusive; i += 1) if (values[i] <= min) { min = values[i]; idx = i; }
  return idx;
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

function hasVerifiedOrderFlow(candle: Candle) {
  const ask = Number(candle.askVolume);
  const bid = Number(candle.bidVolume);
  return Number.isFinite(ask) && Number.isFinite(bid) && ask + bid > 0;
}

function orderFlowAvailable(candles: Candle[]) {
  return candles.some(hasVerifiedOrderFlow);
}

// Cash indices (SPX, NDX, VIX...) publish no traded volume at all. Volume
// studies must vanish honestly on such feeds instead of silently degrading
// (e.g. VWAP collapsing into a typical-price line), which would be fake data.
function volumeAvailable(candles: Candle[]) {
  return candles.some((candle) => Number.isFinite(Number(candle.volume)) && Number(candle.volume) > 0);
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
      time: Math.floor(candle.timestamp / 1_000),
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
export function calculateIndicatorSeries(
  instance: ChartIndicatorInstance,
  candles: Candle[],
  theme: IndicatorTheme,
  context: { instrument?: string; tickSize?: number } = {},
): CalculatedIndicatorSeries[] {
  return applyIndicatorPlotColors(
    instance.indicatorId,
    instance.settings as Record<string, unknown> | undefined,
    computeIndicatorSeries(instance, candles, theme, context),
  );
}

function computeIndicatorSeries(
  instance: ChartIndicatorInstance,
  candles: Candle[],
  theme: IndicatorTheme,
  context: { instrument?: string; tickSize?: number } = {},
): CalculatedIndicatorSeries[] {
  if (!instance.enabled || candles.length === 0) return [];
  const key = instance.indicatorId;

  if (key === "source-code-indicator") {
    const source = settingString(instance, "source", "");
    if (!source) return [];
    const sourceLanguage = settingString(instance, "sourceLanguage", "auto") as SourceIndicatorLanguage;
    return runSourceIndicator(source, sourceLanguage, candles, theme, instance.instanceId).series;
  }

  if (key === "deep-m-effort-nq") {
    const useThemeColors = settingBoolean(instance, "useThemeColors", true);
    const autoColor = settingString(instance, "maAutoColor", "price");
    const primaryColor = useThemeColors
      ? theme.positive
      : settingString(instance, "maAboveColor", theme.positive);
    const secondaryColor = useThemeColors
      ? theme.negative
      : settingString(instance, "maBelowColor", theme.negative);
    const lineWidth = Math.min(
      4,
      Math.max(1, Math.round(settingNumber(instance, "maLineWidth", 2))),
    ) as 1 | 2 | 3 | 4;
    const effort = calculateDeepEffort(candles, {
      zoneBars: settingNumber(instance, "zoneBars", 22),
      tickSize: context.tickSize,
      instrument: context.instrument,
    });
    if (!settingBoolean(instance, "showMovingAverage", true)) return [];
    return [{
      key: `${key}-average`,
      label: settingString(instance, "shortName", "Big Blocks"),
      kind: "line",
      placement: "overlay",
      color: primaryColor,
      lineWidth,
      lineStyle: settingString(instance, "maLineStyle", "solid") === "dashed" ? "dashed" : "solid",
      lastValueVisible: settingBoolean(instance, "showValueLabel", true),
      data: effort.average.map((point) => ({
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
    return [{
      key,
      label: "Volume",
      kind: "histogram",
      placement: "pane",
      color: theme.muted,
      data: candles.map((candle) => ({
        time: candle.timestamp / 1000,
        value: Math.max(0, finite(candle.volume)),
        color: candle.close >= candle.open ? theme.positive : theme.negative,
      })),
    }];
  }

  if (key === "delta-bar") {
    if (!orderFlowAvailable(candles)) return [];
    return [{
      key,
      label: "Delta Bar",
      kind: "histogram",
      placement: "pane",
      color: theme.primary,
      data: candles.filter(hasVerifiedOrderFlow).map((candle) => {
        const value = finite(candle.delta, finite(candle.askVolume) - finite(candle.bidVolume));
        return {
          time: candle.timestamp / 1000,
          value,
          color: value >= 0 ? theme.positive : theme.negative,
        };
      }),
    }];
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
    if (!orderFlowAvailable(candles)) return [];
    const dedicatedCandlestick = key === "delta-cumulative-candlestick";
    const dedicatedHistogram = key === "delta-cumulative-histogram";
    const dedicatedStudy = dedicatedCandlestick || dedicatedHistogram;
    // One canonical CME-session CVD: always reset at the 17:00 Chicago
    // futures-session boundary. Rolling and arbitrary time windows are not
    // alternate CVD calculations in KwantDesk.
    const startHour = 17;
    const displayStyle = settingString(instance, "displayStyle", dedicatedHistogram ? "bars" : "candles");
    const inputData = settingString(instance, "inputData", "Volumes");
    const useTradeCounts = inputData === "Aggregate Trades" || inputData === "Orders";
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
    const sessionOrdinals = new Map<string, number>();
    let nextSessionOrdinal = 0;
    let activePeriod = "";
    let cumulative = 0;
    let cumulativeAsk = 0;
    let cumulativeBid = 0;
    let cumulativeFiltered = 0;
    const cvd: CalculatedIndicatorSeries["data"] = [];
    const askVolume: Array<{ time: number; value: number }> = [];
    const bidVolume: Array<{ time: number; value: number }> = [];
    const filtered: Array<{ time: number; value: number; color: string }> = [];

    candles.forEach((candle) => {
      // Saved OHLCV-only bars have no aggressor-side split. They must not be
      // rendered as zero delta because that creates a false flat CVD history.
      if (!hasVerifiedOrderFlow(candle)) return;
      const session = sessionKey(candle.timestamp, startHour);
      if (!sessionOrdinals.has(session)) sessionOrdinals.set(session, nextSessionOrdinal++);
      const sessionOrdinal = sessionOrdinals.get(session) ?? 0;
      const nextPeriod = `d:${sessionOrdinal}`;
      const periodChanged = nextPeriod !== activePeriod;
      if (periodChanged) {
        activePeriod = nextPeriod;
        cumulative = 0;
        cumulativeAsk = 0;
        cumulativeBid = 0;
        cumulativeFiltered = 0;
      }

      const ask = Math.max(0, finite(useTradeCounts ? candle.askTrades : candle.askVolume));
      const bid = Math.max(0, finite(useTradeCounts ? candle.bidTrades : candle.bidVolume));
      const total = ask + bid;
      const delta = useTradeCounts
        ? ask - bid
        : finite(candle.deltaClose, finite(candle.delta, ask - bid));
      const relativeOpen = useTradeCounts ? 0 : finite(candle.deltaOpen, 0);
      const relativeHigh = useTradeCounts
        ? Math.max(0, delta)
        : finite(candle.deltaHigh, Math.max(relativeOpen, delta));
      const relativeLow = useTradeCounts
        ? Math.min(0, delta)
        : finite(candle.deltaLow, Math.min(relativeOpen, delta));
      const passesFilter = total >= filterMin && (filterMax === 0 || total <= filterMax);
      const filteredDelta = passesFilter ? delta : 0;
      const plottedDelta = dedicatedStudy ? filteredDelta : delta;
      const cumulativeBase = cumulative;
      const cumulativeOpen = cumulativeBase + relativeOpen;
      const cumulativeHigh = cumulativeBase + (passesFilter || !dedicatedStudy ? relativeHigh : 0);
      const cumulativeLow = cumulativeBase + (passesFilter || !dedicatedStudy ? relativeLow : 0);
      cumulative = cumulativeBase + plottedDelta;
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
        breakBefore: periodChanged,
      });
      askVolume.push({ time, value: cumulativeAsk });
      bidVolume.push({ time, value: cumulativeBid });
      filtered.push({
        time,
        value: cumulativeFiltered,
        color: cumulativeFiltered >= 0
          ? (useThemeColors ? theme.positive : settingString(instance, "filteredAskColor", askColor))
          : (useThemeColors ? theme.negative : settingString(instance, "filteredBidColor", bidColor)),
      });
    });

    const series: CalculatedIndicatorSeries[] = [{
      key,
      label: dedicatedStudy
        ? settingString(
            instance,
            "customName",
            dedicatedCandlestick ? "Cumulative Delta Candlestick" : "Cumulative Delta Histogram",
          )
        : "Cumulative Volume Delta",
      kind: displayStyle === "candles" ? "candlestick" : displayStyle === "bars" ? "histogram" : "line",
      placement: "pane",
      color: displayStyle === "line" ? lineColor : theme.primary,
      lineWidth,
      lineStyle: displayStyle === "line"
        ? settingString(instance, "lineStyle", "solid") === "hatch" ? "dotted" : "solid"
        : undefined,
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
      const averages = Array<number | null>(cvd.length).fill(null);
      const deviations = Array<number | null>(cvd.length).fill(null);
      const averageWindow: number[] = [];
      cvd.forEach((point, index) => {
        if (point.breakBefore) averageWindow.length = 0;
        averageWindow.push(point.value);
        if (averageWindow.length > averageLength) averageWindow.shift();
        if (averageWindow.length < averageLength) return;
        const average = averageWindow.reduce((sum, value) => sum + value, 0) / averageLength;
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
          : [{ time: point.time, value: averages[index] as number }]),
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
    const length = Math.max(2, Math.round(settingNumber(instance, "length", 60)));
    const sessionStartHour = settingNumber(instance, "sessionStartHour", 17);
    const bandMultipliers = [
      Math.max(0.1, settingNumber(instance, "band1", 1)),
      Math.max(0.1, settingNumber(instance, "band2", 2)),
      Math.max(0.1, settingNumber(instance, "band3", 3)),
    ];
    const stats = rollingVwap(candles, length, sessionStartHour);
    const bands = bandMultipliers.flatMap((multiplier, index) => {
      const color = vwapBandColor(theme, index);
      return [
        {
          key: `${key}-upper-${index + 1}`,
          label: `Rolling VWAP +${multiplier}σ`,
          kind: "line" as const,
          placement: "overlay" as const,
          color,
          lineWidth: 1 as const,
          lineStyle: "dotted" as const,
          data: stats.map(({ time, value, deviation, breakBefore }) => ({
            time,
            value: value + deviation * multiplier,
            breakBefore,
          })),
        },
        {
          key: `${key}-lower-${index + 1}`,
          label: `Rolling VWAP -${multiplier}σ`,
          kind: "line" as const,
          placement: "overlay" as const,
          color,
          lineWidth: 1 as const,
          lineStyle: "dotted" as const,
          data: stats.map(({ time, value, deviation, breakBefore }) => ({
            time,
            value: value - deviation * multiplier,
            breakBefore,
          })),
        },
      ];
    });
    return [
      {
        key,
        label: `Rolling VWAP ${length}`,
        kind: "line",
        placement: "overlay",
        color: theme.primary,
        lineWidth: 2,
        lineStyle: "solid",
        data: stats.map(({ time, value, breakBefore }) => ({ time, value, breakBefore })),
      },
      ...bands,
    ];
  }

  const closes = candles.map((candle) => candle.close);
  const highs = candles.map((candle) => candle.high);
  const lows = candles.map((candle) => candle.low);
  const typical = candles.map((candle) => (candle.high + candle.low + candle.close) / 3);

  if (key === "relative-strength-index-rsi") {
    const length = Math.max(2, Math.round(settingNumber(instance, "length", 14)));
    const gains = closes.map((close, index) => index === 0 ? 0 : Math.max(0, close - closes[index - 1]));
    const losses = closes.map((close, index) => index === 0 ? 0 : Math.max(0, closes[index - 1] - close));
    const averageGain = wilder(gains.slice(1), length);
    const averageLoss = wilder(losses.slice(1), length);
    const values: Array<number | null> = [null];
    averageGain.forEach((gain, index) => {
      const loss = averageLoss[index];
      values.push(gain == null || loss == null ? null : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
    });
    return [{
      key,
      label: `RSI ${length}`,
      kind: "line",
      placement: "pane",
      color: theme.primary,
      lineWidth: 2,
      data: lineData(candles, values),
    }];
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
    return [{
      key,
      label: `ATR ${length}`,
      kind: "line",
      placement: "pane",
      color: theme.primary,
      lineWidth: 2,
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
    const length = Math.max(2, Math.round(settingNumber(instance, "length", 20)));
    const multiplier = Math.max(0.1, settingNumber(instance, "multiplier", 2));
    const middle = rollingMean(closes, length);
    const deviation = rollingDeviation(closes, length);
    return [
      {
        key: `${key}-middle`,
        label: `BB Basis ${length}`,
        kind: "line",
        placement: "overlay",
        color: theme.primary,
        lineWidth: 2,
        data: lineData(candles, middle),
      },
      {
        key: `${key}-upper`,
        label: `BB +${multiplier}σ`,
        kind: "line",
        placement: "overlay",
        color: theme.secondary,
        lineWidth: 1,
        data: lineData(candles, middle.map((value, index) => value == null || deviation[index] == null ? null : value + deviation[index]! * multiplier)),
      },
      {
        key: `${key}-lower`,
        label: `BB -${multiplier}σ`,
        kind: "line",
        placement: "overlay",
        color: theme.secondary,
        lineWidth: 1,
        data: lineData(candles, middle.map((value, index) => value == null || deviation[index] == null ? null : value - deviation[index]! * multiplier)),
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

  if (key === "commodity-channel-index-cci") {
    const length = Math.max(2, Math.round(settingNumber(instance, "length", 20)));
    const mean = rollingMean(typical, length);
    const values = typical.map((value, index) => {
      if (index < length - 1 || mean[index] == null) return null;
      const window = typical.slice(index - length + 1, index + 1);
      const meanDeviation = window.reduce((sum, item) => sum + Math.abs(item - mean[index]!), 0) / length;
      return meanDeviation === 0 ? 0 : (value - mean[index]!) / (0.015 * meanDeviation);
    });
    return [{
      key,
      label: `CCI ${length}`,
      kind: "line",
      placement: "pane",
      color: theme.primary,
      lineWidth: 2,
      data: lineData(candles, values),
    }];
  }

  if (key === "aroon-up-down" || key === "aroon-oscillator") {
    const length = Math.max(2, Math.round(settingNumber(instance, "length", 25)));
    const up = highs.map((_, index) => {
      if (index < length) return null;
      const periodsSince = index - windowArgMax(highs, index - length, index);
      return ((length - periodsSince) / length) * 100;
    });
    const down = lows.map((_, index) => {
      if (index < length) return null;
      const periodsSince = index - windowArgMin(lows, index - length, index);
      return ((length - periodsSince) / length) * 100;
    });
    if (key === "aroon-oscillator") {
      return [{
        key,
        label: `Aroon Osc ${length}`,
        kind: "line",
        placement: "pane",
        color: theme.primary,
        lineWidth: 2,
        data: lineData(candles, up.map((value, index) => value == null || down[index] == null ? null : value - down[index]!)),
      }];
    }
    return [
      { key: `${key}-up`, label: "Aroon Up", kind: "line", placement: "pane", color: theme.positive, lineWidth: 2, data: lineData(candles, up) },
      { key: `${key}-down`, label: "Aroon Down", kind: "line", placement: "pane", color: theme.negative, lineWidth: 2, data: lineData(candles, down) },
    ];
  }

  if (key === "awesome-oscillator") {
    const fast = Math.max(1, Math.round(settingNumber(instance, "fastLength", 5)));
    const slow = Math.max(fast + 1, Math.round(settingNumber(instance, "slowLength", 34)));
    const median = candles.map((candle) => (candle.high + candle.low) / 2);
    const fastMean = rollingMean(median, fast);
    const slowMean = rollingMean(median, slow);
    const values = fastMean.map((value, index) => value == null || slowMean[index] == null ? null : value - slowMean[index]!);
    return [{
      key,
      label: "Awesome Oscillator",
      kind: "histogram",
      placement: "pane",
      color: theme.primary,
      data: lineData(candles, values).map((row) => ({ ...row, color: row.value >= 0 ? theme.positive : theme.negative })),
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
    if (!volumeAvailable(candles)) return [];
    let cumulative = 0;
    const values = candles.map((candle) => {
      const range = candle.high - candle.low;
      const multiplier = range === 0 ? 0 : ((candle.close - candle.low) - (candle.high - candle.close)) / range;
      cumulative += multiplier * Math.max(0, finite(candle.volume));
      return cumulative;
    });
    return [{
      key,
      label: "Chaikin A/D",
      kind: "line",
      placement: "pane",
      color: theme.primary,
      lineWidth: 2,
      data: lineData(candles, values),
    }];
  }

  if (key === "vwap" || key === "vwap-envelopes") {
    if (!volumeAvailable(candles)) return [];
    const startHour = settingNumber(instance, "sessionStartHour", 17);
    const rows = sessionVwap(candles, startHour);
    const series: CalculatedIndicatorSeries[] = [{
      key: `${key}-main`,
      label: "VWAP",
      kind: "line",
      placement: "overlay",
      color: theme.primary,
      lineWidth: 2,
      lineStyle: "solid",
      data: rows.map(({ time, value, breakBefore }) => ({ time, value, breakBefore })),
    }];
    if (key === "vwap-envelopes") {
      [1, 2, 3].forEach((multiplier, index) => {
        const factor = settingNumber(instance, `band${multiplier}`, multiplier);
        series.push(
          {
            key: `${key}-upper-${multiplier}`,
            label: `VWAP +${factor}σ`,
            kind: "line",
            placement: "overlay",
            color: vwapBandColor(theme, index),
            lineWidth: 1,
            lineStyle: "dotted",
            data: rows.map(({ time, value, deviation, breakBefore }) => ({
              time,
              value: value + deviation * factor,
              breakBefore,
            })),
          },
          {
            key: `${key}-lower-${multiplier}`,
            label: `VWAP -${factor}σ`,
            kind: "line",
            placement: "overlay",
            color: vwapBandColor(theme, index),
            lineWidth: 1,
            lineStyle: "dotted",
            data: rows.map(({ time, value, deviation, breakBefore }) => ({
              time,
              value: value - deviation * factor,
              breakBefore,
            })),
          },
        );
      });
    }
    return series;
  }

  return [];
}
