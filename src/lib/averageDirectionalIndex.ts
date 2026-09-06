import type { Candle } from "./backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "./chartIndicatorEngine";

export const ADX_DEFAULTS = {
  period: 14, lineWidth: 1, lineStyle: "solid", showPlusDi: true, showMinusDi: true,
  useThemeColors: true,
};

/** Wilder directional movement and ADX, with explicit full-window seeds. */
export function calculateAverageDirectionalIndex(
  candles: readonly Candle[], settings: Record<string, unknown>, theme: IndicatorTheme,
): CalculatedIndicatorSeries[] {
  const numericPeriod = Number(settings.period ?? ADX_DEFAULTS.period);
  const period = Math.min(1000, Math.max(1, Math.floor(Number.isFinite(numericPeriod) ? numericPeriod : 14)));
  const output: Record<"adx" | "plusDi" | "minusDi", CalculatedIndicatorSeries["data"]> = { adx: [], plusDi: [], minusDi: [] };
  let previous: Candle | null = null;
  let lastTimestamp = -Infinity;
  let samples = 0, tr = 0, plus = 0, minus = 0, dxCount = 0, dxSum = 0, adx = 0;
  let broken = false;
  let diBreak = false, adxBreak = false;
  const reset = () => {
    previous = null; samples = 0; tr = 0; plus = 0; minus = 0; dxCount = 0; dxSum = 0; adx = 0;
    broken = true;
  };
  for (const candle of candles) {
    if (![candle.timestamp, candle.high, candle.low, candle.close].every(Number.isFinite)
      || candle.high < candle.low || candle.close > candle.high || candle.close < candle.low
      || candle.timestamp <= lastTimestamp) {
      reset();
      continue;
    }
    lastTimestamp = candle.timestamp;
    if (!previous) {
      previous = candle;
      if (broken) { diBreak = true; adxBreak = true; broken = false; }
      continue;
    }
    const upward = candle.high - previous.high;
    const downward = previous.low - candle.low;
    const positive = upward > downward && upward > 0 ? upward : 0;
    const negative = downward > upward && downward > 0 ? downward : 0;
    const trueRange = Math.max(candle.high - candle.low, Math.abs(candle.high - previous.close), Math.abs(candle.low - previous.close));
    previous = candle;
    samples++;
    if (samples <= period) {
      tr += trueRange; plus += positive; minus += negative;
    } else {
      tr = tr - tr / period + trueRange;
      plus = plus - plus / period + positive;
      minus = minus - minus / period + negative;
    }
    if (samples < period) continue;
    const plusDi = tr > 0 ? 100 * plus / tr : 0;
    const minusDi = tr > 0 ? 100 * minus / tr : 0;
    const dx = plusDi + minusDi > 0 ? 100 * Math.abs(plusDi - minusDi) / (plusDi + minusDi) : 0;
    const time = candle.timestamp / 1000;
    output.plusDi.push({ time, value: plusDi, ...(diBreak ? { breakBefore: true } : {}) });
    output.minusDi.push({ time, value: minusDi, ...(diBreak ? { breakBefore: true } : {}) });
    diBreak = false;
    dxCount++;
    if (dxCount <= period) {
      dxSum += dx;
      if (dxCount < period) continue;
      adx = dxSum / period;
    } else adx = (adx * (period - 1) + dx) / period;
    output.adx.push({ time, value: adx, ...(adxBreak ? { breakBefore: true } : {}) });
    adxBreak = false;
  }
  const width = Number(settings.lineWidth ?? 1);
  const lineWidth = Math.max(1, Math.min(4, Math.round(Number.isFinite(width) ? width : 1))) as 1 | 2 | 3 | 4;
  const lineStyle = settings.lineStyle === "dashed" || settings.lineStyle === "dotted" ? settings.lineStyle : "solid";
  return ([
    ["adx", "ADX", theme.primary, true],
    ["plusDi", "+DI", theme.positive, settings.showPlusDi !== false],
    ["minusDi", "−DI", theme.negative, settings.showMinusDi !== false],
  ] as const).filter(([key, , , show]) => show && output[key].length).map(([key, label, color]) => ({
    key: `average-directional-index-adx-${key === "plusDi" ? "plus-di" : key === "minusDi" ? "minus-di" : "adx"}`,
    label, color, kind: "line", placement: "pane", lineWidth, lineStyle,
    includeZeroInScale: true, data: output[key],
  }));
}
