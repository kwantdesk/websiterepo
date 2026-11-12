import type { Candle } from "@/lib/backtester";

type Settings = Record<string, number | string | boolean>;
type CciPoint = { time: number; value: number; breakBefore?: boolean };
export const CCI_INDICATOR_ID = "commodity-channel-index-cci";

const period = (value: unknown, fallback: number, minimum: number) => {
  const parsed = Number(value ?? fallback);
  return Math.min(500, Math.max(minimum, Math.round(Number.isFinite(parsed) ? parsed : fallback)));
};

export function cciPeriods(settings: Settings) {
  return {
    length: period(settings.length, 20, 2),
    averageLength: settings.showAverage === true ? period(settings.averageLength, 9, 1) : 0,
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
  let averageFrom = 0;
  for (let index = 0; index < prices.length; index++) {
    const price = prices[index];
    if (!Number.isFinite(price)) {
      validFrom = index + 1;
      averageFrom = data.length;
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

    const firstAveragePoint = data.length - averageLength;
    if (!averageLength || firstAveragePoint < averageFrom) continue;
    let sum = 0;
    for (let i = firstAveragePoint; i < data.length; i++) sum += data[i].value;
    averageData.push({ time, value: sum / averageLength,
      ...(data[firstAveragePoint].breakBefore && { breakBefore: true }) });
  }
  return { length, averageLength, data, averageData };
}
