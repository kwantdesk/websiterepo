import type { Candle } from "@/lib/backtester";

import { smoother, type KstAverage } from "@/lib/knowSureThing";

export const CCI_DEFAULTS = {
  length: 14, source: "hlc3", showAverage: true, averageType: "simple", averageLength: 20,
  showLevels: true, levelValue: 100, levelLineWidth: 1, lineWidth: 1,
  averageLineWidth: 2, lineStyle: "solid", useThemeColors: true,
} as const;

export function cciAverageType(value: unknown): KstAverage {
  return value === "exponential" || value === "triangular" || value === "weighted" ? value : "simple";
}

type Settings = Record<string, number | string | boolean>;
type CciPoint = { time: number; value: number; breakBefore?: boolean };
export const CCI_INDICATOR_ID = "commodity-channel-index-cci";

const period = (value: unknown, fallback: number, minimum: number) => {
  const parsed = Number(value ?? fallback);
  return Math.min(500, Math.max(minimum, Math.round(Number.isFinite(parsed) ? parsed : fallback)));
};

export function cciPeriods(settings: Settings) {
  return {
    length: period(settings.length, CCI_DEFAULTS.length, 2),
    averageLength: settings.showAverage !== false ? period(settings.averageLength, CCI_DEFAULTS.averageLength, 1) : 0,
  };
}

function inputPrice(candle: Candle, source: Settings["source"]) {
  const { open, high, low, close } = candle;
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)
    || high < low || close < low || close > high) return NaN;
  if (source === "close") return close;
  if (source === "hl2") return (high + low) / 2;
  if (source === "ohlc4") return Number.isFinite(open) && open >= low && open <= high
    ? (open + high + low + close) / 4 : NaN;
  return (high + low + close) / 3;
}

export function calculateCci(candles: readonly Candle[], settings: Settings) {
  const { length, averageLength } = cciPeriods(settings);
  const prices = candles.map(candle => inputPrice(candle, settings.source));
  const data: CciPoint[] = [];
  const averageData: CciPoint[] = [];
  let validFrom = 0;
  const averageType = cciAverageType(settings.averageType);
  const average = averageLength && averageType !== "simple" ? smoother(averageLength, averageType) : null;
  let averageFrom = 0;
  let averageBreak = false;
  for (let index = 0; index < prices.length; index++) {
    const price = prices[index];
    if (!Number.isFinite(price)) {
      validFrom = index + 1;
      averageFrom = data.length;
      averageBreak = averageData.length > 0;
      average?.reset();
      continue;
    }
    const first = index - length + 1;
    if (first < validFrom) continue;

    // Calculate around the current price to avoid cancelling tiny price moves
    // on high-priced indexes. Rebuilding just this window gives the same value
    // as a full history run, including an execution correction in the live tail.
    let deviationFromPrice = 0;
    for (let i = first; i <= index; i++) deviationFromPrice += prices[i] - price;
    const meanOffset = deviationFromPrice / length;
    let absoluteDeviation = 0;
    for (let i = first; i <= index; i++) absoluteDeviation += Math.abs(prices[i] - price - meanOffset);
    const meanDeviation = absoluteDeviation / length;
    const value = meanDeviation > 0 ? -meanOffset / (0.015 * meanDeviation) : 0;
    const time = candles[index].timestamp / 1000;
    const firstAfterGap = validFrom > 0 && first === validFrom;
    data.push({ time, value: value === 0 ? 0 : value, ...(firstAfterGap && { breakBefore: true }) });

    if (!averageLength || data.length - averageLength < averageFrom) {
      average?.push(value);
      continue;
    }
    let smoothed = average?.push(value);
    if (averageType === "simple") {
      let sum = 0;
      for (let i = data.length - averageLength; i < data.length; i++) sum += data[i].value;
      smoothed = sum / averageLength;
    }
    if (smoothed === undefined) continue;
    averageData.push({ time, value: smoothed, ...(averageBreak && { breakBefore: true }) });
    averageBreak = false;
  }
  return { length, averageLength, data, averageData };
}
