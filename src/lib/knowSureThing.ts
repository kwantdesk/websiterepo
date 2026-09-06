import type { Candle } from "./backtester";

export type KstAverage = "simple" | "exponential" | "triangular" | "weighted";
export type KstParameters = {
  rocLengths: readonly [number, number, number, number];
  averageLengths: readonly [number, number, number, number];
  signalPeriod: number;
  averageType: KstAverage;
  usePercent: boolean;
};
export type KstPoint = { time: number; value: number; breakBefore?: boolean };

// Lengths, Simple and raw mode match the official DeepCharts screenshots.
// Those screenshots do not establish protected factory/seed behavior.
export const KST_PARAMETERS: KstParameters = {
  rocLengths: [10, 15, 20, 30], averageLengths: [10, 10, 10, 15],
  signalPeriod: 9, averageType: "simple", usePercent: false,
};

/** Fixed-size, full-window-seeded smoother; one update per observed bar. */
function smoother(length: number, type: KstAverage): { reset(): void; push(value: number): number | undefined } {
  if (type === "triangular") {
    const first = smoother(Math.ceil((length + 1) / 2), "simple");
    const second = smoother(Math.floor((length + 1) / 2), "simple");
    return {
      reset() { first.reset(); second.reset(); },
      push(value) {
        if (!Number.isFinite(value)) { this.reset(); return undefined; }
        const intermediate = first.push(value);
        return intermediate === undefined ? undefined : second.push(intermediate);
      },
    };
  }
  const ring = new Float64Array(length);
  let cursor = 0, count = 0, sum = 0, weighted = 0, mean = 0, updates = 0;
  return {
    reset() { cursor = 0; count = 0; sum = 0; weighted = 0; mean = 0; updates = 0; },
    push(value: number): number | undefined {
      if (!Number.isFinite(value)) { this.reset(); return undefined; }
      if (count < length) {
        ring[cursor] = value; cursor = (cursor + 1) % length;
        count++; sum += value; weighted += count * value;
        if (count < length) return undefined;
        mean = sum / length;
      } else if (type === "exponential") {
        mean += (value - mean) * (2 / (length + 1));
      } else {
        weighted += length * value - sum;
        sum += value - ring[cursor]; ring[cursor] = value;
        cursor = (cursor + 1) % length;
        // Rebase once per whole window: bounded drift, amortized O(1).
        if (++updates === length) {
          sum = 0; weighted = 0; updates = 0;
          for (let i = 0; i < length; i++) {
            const sample = ring[(cursor + i) % length];
            sum += sample; weighted += (i + 1) * sample;
          }
        }
        mean = sum / length;
      }
      const result = type === "weighted" ? weighted / (length * (length + 1) / 2) : mean;
      if (!Number.isFinite(result)) { this.reset(); return undefined; }
      return result;
    },
  };
}

/**
 * KST = 1*MA(ROC1) + 2*MA(ROC2) + 3*MA(ROC3) + 4*MA(ROC4).
 * Signal uses the selected smoothing method over complete KST observations.
 * No time interpolation, volume proxy, session timer or future observations.
 * Invalid close/time breaks the window; zero percent denominators invalidate
 * their own ROC smoother and the signal, never fabricate a zero ROC.
 */
export function calculateKstValues(candles: readonly Candle[], parameters: KstParameters = KST_PARAMETERS) {
  const lengths = [...parameters.rocLengths, ...parameters.averageLengths, parameters.signalPeriod];
  if (parameters.rocLengths.length !== 4 || parameters.averageLengths.length !== 4
    || lengths.some(n => !Number.isInteger(n) || n < 1 || n > 1000)
    || !["simple", "exponential", "triangular", "weighted"].includes(parameters.averageType)) {
    throw new RangeError("Invalid KST parameters");
  }
  const size = Math.max(...parameters.rocLengths) + 1;
  const prices = new Float64Array(size);
  const averages = parameters.averageLengths.map(n => smoother(n, parameters.averageType));
  const signalAverage = smoother(parameters.signalPeriod, parameters.averageType);
  const kst: KstPoint[] = [], signal: KstPoint[] = [];
  let count = 0, cursor = 0, lastTime = -Infinity, kstBreak = false, signalBreak = false;
  const breakOutput = () => { kstBreak = true; signalBreak = true; signalAverage.reset(); };
  for (const candle of candles) {
    if (!Number.isFinite(candle.timestamp) || candle.timestamp <= lastTime || !Number.isFinite(candle.close)) {
      count = 0; cursor = 0; averages.forEach(a => a.reset()); breakOutput(); continue;
    }
    lastTime = candle.timestamp;
    prices[cursor] = candle.close;
    let total = 0, ready = true;
    for (let i = 0; i < 4; i++) {
      const length = parameters.rocLengths[i];
      if (count < length) { ready = false; continue; }
      const previous = prices[(cursor - length + size) % size];
      const roc = parameters.usePercent
        ? previous === 0 ? NaN : 100 * ((candle.close - previous) / previous)
        : candle.close - previous;
      const value = averages[i].push(roc);
      if (value === undefined) ready = false;
      else total += (i + 1) * value;
    }
    cursor = (cursor + 1) % size; count = Math.min(size, count + 1);
    if (!ready || !Number.isFinite(total)) { if (kst.length) breakOutput(); continue; }
    const time = candle.timestamp / 1000;
    kst.push({ time, value: total, ...(kstBreak ? { breakBefore: true } : {}) }); kstBreak = false;
    const smoothed = signalAverage.push(total);
    if (smoothed !== undefined) {
      signal.push({ time, value: smoothed, ...(signalBreak ? { breakBefore: true } : {}) }); signalBreak = false;
    }
  }
  return { kst, signal };
}
