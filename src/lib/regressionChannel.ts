import type { Candle } from "./backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "./chartIndicatorEngine";

export const REGRESSION_CHANNEL_DEFAULTS = {
  mode: "bars",
  bars: 100,
  standardDeviationValue: 1,
  zigZagMode: "tick-reversal",
  zigZagAbsoluteReversal: 0.5,
  zigZagReversalValue: 22,
  midLineWidth: 2,
  upperLineWidth: 2,
  lowerLineWidth: 2,
  midLineStyle: "dashed",
  upperLineStyle: "dashed",
  lowerLineStyle: "dashed",
  useThemeColors: true,
};

const finite = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(parsed) ? parsed : fallback));
};

export function normalizeRegressionChannelSettings(settings: Record<string, unknown>) {
  const mode = settings.mode === "zig-zag" ? "zig-zag" : "bars";
  const zigZagMode = settings.zigZagMode === "highest-lowest" ? "highest-lowest" : "tick-reversal";
  const style = (value: unknown) => value === "solid" || value === "dotted" ? value : "dashed";
  return {
    ...REGRESSION_CHANNEL_DEFAULTS,
    ...settings,
    mode,
    bars: Math.round(finite(settings.bars, 100, 2, 10000)),
    standardDeviationValue: finite(settings.standardDeviationValue, 1, 0, 10),
    zigZagMode,
    zigZagAbsoluteReversal: finite(settings.zigZagAbsoluteReversal, 0.5, 0, 100000),
    zigZagReversalValue: Math.round(finite(settings.zigZagReversalValue, 22, 1, 10000)),
    midLineWidth: Math.round(finite(settings.midLineWidth, 2, 1, 4)),
    upperLineWidth: Math.round(finite(settings.upperLineWidth, 2, 1, 4)),
    lowerLineWidth: Math.round(finite(settings.lowerLineWidth, 2, 1, 4)),
    midLineStyle: style(settings.midLineStyle),
    upperLineStyle: style(settings.upperLineStyle),
    lowerLineStyle: style(settings.lowerLineStyle),
    useThemeColors: settings.useThemeColors !== false,
  };
}

function tickReversalStart(candles: readonly Candle[], tickSize: number, absolute: number, ticks: number) {
  const threshold = Math.max(absolute, Math.max(0, tickSize) * ticks);
  if (!(threshold > 0)) return Math.max(0, candles.length - 2);
  let direction: -1 | 0 | 1 = 0;
  const origin = candles[0].close;
  let extreme = candles[0].close;
  let extremeIndex = 0;
  let lastConfirmedPivot = 0;
  for (let index = 1; index < candles.length; index += 1) {
    const price = candles[index].close;
    if (direction === 0) {
      if (price - origin >= threshold) { direction = 1; extreme = price; extremeIndex = index; }
      else if (origin - price >= threshold) { direction = -1; extreme = price; extremeIndex = index; }
      continue;
    }
    if (direction > 0) {
      if (price >= extreme) { extreme = price; extremeIndex = index; }
      else if (extreme - price >= threshold) {
        lastConfirmedPivot = extremeIndex; direction = -1; extreme = price; extremeIndex = index;
      }
    } else {
      if (price <= extreme) { extreme = price; extremeIndex = index; }
      else if (price - extreme >= threshold) {
        lastConfirmedPivot = extremeIndex; direction = 1; extreme = price; extremeIndex = index;
      }
    }
  }
  return Math.min(lastConfirmedPivot, candles.length - 2);
}

function highestLowestStart(candles: readonly Candle[], lookback: number) {
  const from = Math.max(0, candles.length - lookback);
  let highIndex = from;
  let lowIndex = from;
  for (let index = from + 1; index < candles.length; index += 1) {
    if (candles[index].high >= candles[highIndex].high) highIndex = index;
    if (candles[index].low <= candles[lowIndex].low) lowIndex = index;
  }
  // The older opposite extreme is the origin of the developing leg.
  const start = highIndex > lowIndex ? lowIndex : highIndex;
  return Math.min(start, candles.length - 2);
}

export function calculateRegressionChannel(
  candles: readonly Candle[], rawSettings: Record<string, unknown>, theme: IndicatorTheme,
  instanceId: string, tickSize = 0,
): CalculatedIndicatorSeries[] {
  const settings = normalizeRegressionChannelSettings(rawSettings);
  // A channel must never bridge an unknown/out-of-order bar. Work only from
  // the newest uninterrupted suffix so a temporary history gap cannot draw a
  // confident support/resistance line across data we do not have.
  let segmentStart = 0;
  let lastTimestamp = -Infinity;
  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    const valid = Number.isFinite(candle.timestamp) && candle.timestamp > lastTimestamp
      && Number.isFinite(candle.close) && Number.isFinite(candle.high) && Number.isFinite(candle.low);
    if (!valid) { segmentStart = index + 1; lastTimestamp = -Infinity; }
    else lastTimestamp = candle.timestamp;
  }
  const valid = candles.slice(segmentStart);
  if (valid.length < 2) return [];
  const start = settings.mode === "bars"
    ? Math.max(0, valid.length - settings.bars)
    : settings.zigZagMode === "highest-lowest"
      ? highestLowestStart(valid, settings.zigZagReversalValue)
      : tickReversalStart(valid, tickSize, settings.zigZagAbsoluteReversal, settings.zigZagReversalValue);
  const window = valid.slice(start);
  if (window.length < 2) return [];
  const count = window.length;
  const meanX = (count - 1) / 2;
  let sumY = 0;
  let weighted = 0;
  for (let index = 0; index < count; index += 1) {
    sumY += window[index].close;
    weighted += index * window[index].close;
  }
  const meanY = sumY / count;
  const varianceX = count * (count * count - 1) / 12;
  const slope = varianceX ? (weighted - meanX * sumY) / varianceX : 0;
  const intercept = meanY - slope * meanX;
  let residualSquares = 0;
  for (let index = 0; index < count; index += 1) {
    const residual = window[index].close - (intercept + slope * index);
    residualSquares += residual * residual;
  }
  const offset = Math.sqrt(residualSquares / count) * settings.standardDeviationValue;
  const positive = slope >= 0;
  const pointColor = positive ? theme.positive : theme.negative;
  const make = (key: string, label: string, shift: number, width: number, lineStyle: unknown): CalculatedIndicatorSeries => ({
    key: `regression-channel-${key}`,
    groupKey: `regression-channel-${instanceId}`,
    label,
    kind: "line",
    placement: "overlay",
    color: pointColor,
    lineWidth: width as 1 | 2 | 3 | 4,
    lineStyle: lineStyle as "solid" | "dashed" | "dotted",
    lastValueVisible: false,
    data: window.map((candle, index) => ({
      time: candle.timestamp / 1000,
      value: intercept + slope * index + shift,
      color: pointColor,
    })),
  });
  return [
    make("mid", "Regression MID", 0, settings.midLineWidth, settings.midLineStyle),
    make("upper", "Regression UP", offset, settings.upperLineWidth, settings.upperLineStyle),
    make("lower", "Regression DN", -offset, settings.lowerLineWidth, settings.lowerLineStyle),
  ];
}
