export type VolatilityCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type VolatilityRegime = "LOW" | "QUIET" | "NORMAL" | "HIGH" | "EXTREME";
export type VolatilityTrend = "RISING" | "STEADY" | "EASING";

export type VolatilitySnapshot = {
  score: number;
  regime: VolatilityRegime;
  trend: VolatilityTrend;
  paceRatio: number;
  currentRange: number;
  typicalRange: number;
  rangePercentile: number;
  pacePercentile: number;
  impulsePercentile: number;
  sampleCount: number;
  historyDays: number;
  updatedAt: string;
  guidance: string;
};

type WindowMetrics = {
  pace: number;
  range: number;
  impulse: number;
};

const WINDOW_BARS = 12;
const FIVE_MINUTES_MS = 5 * 60_000;
const MAX_CONTIGUOUS_GAP_MS = 12 * 60_000;

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentileRank(values: number[], value: number) {
  if (!values.length || !Number.isFinite(value)) return 50;
  let below = 0;
  let equal = 0;
  for (const candidate of values) {
    if (candidate < value) below += 1;
    else if (candidate === value) equal += 1;
  }
  return clamp(((below + equal * 0.5) / values.length) * 100, 0, 100);
}

function isContiguous(candles: VolatilityCandle[]) {
  for (let index = 1; index < candles.length; index += 1) {
    const gap = candles[index].timestamp - candles[index - 1].timestamp;
    if (gap <= 0 || gap > MAX_CONTIGUOUS_GAP_MS) return false;
  }
  return true;
}

function metricsForWindow(candles: VolatilityCandle[]): WindowMetrics | null {
  if (candles.length < WINDOW_BARS || !isContiguous(candles)) return null;
  const trueRanges: number[] = [];
  const impulses: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const candle = candles[index];
    const previousClose = candles[index - 1].close;
    trueRanges.push(Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    ));
    impulses.push(Math.abs(candle.close - previousClose));
  }
  return {
    pace: average(trueRanges),
    range: Math.max(...candles.map((candle) => candle.high)) - Math.min(...candles.map((candle) => candle.low)),
    impulse: Math.max(...impulses),
  };
}

function regimeForScore(score: number): VolatilityRegime {
  if (score < 20) return "LOW";
  if (score < 40) return "QUIET";
  if (score < 60) return "NORMAL";
  if (score < 80) return "HIGH";
  return "EXTREME";
}

function guidanceForRegime(regime: VolatilityRegime) {
  if (regime === "LOW") {
    return "Expect slower rotations and weaker follow-through. Work from mapped edges, keep targets realistic, and require acceptance before trusting a breakout.";
  }
  if (regime === "QUIET") {
    return "Favour clean level-to-level rotations. First reactions matter, but do not pay up in the middle of the map while movement remains compressed.";
  }
  if (regime === "NORMAL") {
    return "Use the standard map playbook: react at named zones, wait for the print, and only follow a break after price proves acceptance.";
  }
  if (regime === "HIGH") {
    return "Movement is running faster than normal. Reduce size, allow wider structural stops, and avoid fading an accepted break simply because price looks extended.";
  }
  return "Capital preservation comes first. Expect overshoots, rapid level transitions, and failed first reactions; use smaller size and wait for clear confirmation.";
}

function normalizeCandles(candles: VolatilityCandle[]) {
  const rows = new Map<number, VolatilityCandle>();
  for (const candle of candles) {
    if (
      !Number.isFinite(candle.timestamp)
      || !Number.isFinite(candle.open)
      || !Number.isFinite(candle.high)
      || !Number.isFinite(candle.low)
      || !Number.isFinite(candle.close)
      || candle.timestamp <= 0
      || candle.open <= 0
      || candle.high <= 0
      || candle.low <= 0
      || candle.close <= 0
      || candle.high < candle.low
    ) continue;
    rows.set(candle.timestamp, candle);
  }
  return [...rows.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function applyLivePrice(candles: VolatilityCandle[], livePrice: number | null) {
  if (!candles.length || livePrice === null || !Number.isFinite(livePrice) || livePrice <= 0) return candles;
  const rows = [...candles];
  const last = rows.at(-1)!;
  const now = Date.now();
  if (now - last.timestamp > 30 * 60_000) return rows;
  const liveBucket = Math.floor(now / FIVE_MINUTES_MS) * FIVE_MINUTES_MS;
  if (liveBucket > last.timestamp && liveBucket - last.timestamp <= MAX_CONTIGUOUS_GAP_MS) {
    rows.push({
      timestamp: liveBucket,
      open: last.close,
      high: Math.max(last.close, livePrice),
      low: Math.min(last.close, livePrice),
      close: livePrice,
      volume: 0,
    });
  } else {
    rows[rows.length - 1] = {
      ...last,
      high: Math.max(last.high, livePrice),
      low: Math.min(last.low, livePrice),
      close: livePrice,
    };
  }
  return rows;
}

export function calculateVolatilitySnapshot(
  sourceCandles: VolatilityCandle[],
  livePrice: number | null,
): VolatilitySnapshot | null {
  const normalized = applyLivePrice(normalizeCandles(sourceCandles), livePrice);
  if (normalized.length < WINDOW_BARS * 4) return null;

  const historicalWindows: WindowMetrics[] = [];
  for (let end = WINDOW_BARS; end < normalized.length - 1; end += 2) {
    const metrics = metricsForWindow(normalized.slice(end - WINDOW_BARS, end));
    if (metrics) historicalWindows.push(metrics);
  }
  if (historicalWindows.length < 20) return null;

  const currentMetrics = metricsForWindow(normalized.slice(-WINDOW_BARS));
  if (!currentMetrics) return null;
  const previousMetrics = metricsForWindow(normalized.slice(-(WINDOW_BARS * 2), -WINDOW_BARS));

  const paceValues = historicalWindows.map((window) => window.pace);
  const rangeValues = historicalWindows.map((window) => window.range);
  const impulseValues = historicalWindows.map((window) => window.impulse);
  const pacePercentile = percentileRank(paceValues, currentMetrics.pace);
  const rangePercentile = percentileRank(rangeValues, currentMetrics.range);
  const impulsePercentile = percentileRank(impulseValues, currentMetrics.impulse);
  const score = Math.round(
    pacePercentile * 0.5
    + rangePercentile * 0.3
    + impulsePercentile * 0.2,
  );
  const previousScore = previousMetrics
    ? (
        percentileRank(paceValues, previousMetrics.pace) * 0.5
        + percentileRank(rangeValues, previousMetrics.range) * 0.3
        + percentileRank(impulseValues, previousMetrics.impulse) * 0.2
      )
    : score;
  const trend: VolatilityTrend = score - previousScore > 5
    ? "RISING"
    : previousScore - score > 5
      ? "EASING"
      : "STEADY";
  const regime = regimeForScore(score);
  const firstTimestamp = normalized[0].timestamp;
  const lastTimestamp = normalized.at(-1)!.timestamp;
  const updatedAt = livePrice !== null && Date.now() - lastTimestamp < 30 * 60_000
    ? new Date().toISOString()
    : new Date(lastTimestamp).toISOString();

  return {
    score,
    regime,
    trend,
    paceRatio: currentMetrics.pace / Math.max(0.000001, median(paceValues)),
    currentRange: currentMetrics.range,
    typicalRange: median(rangeValues),
    rangePercentile: Math.round(rangePercentile),
    pacePercentile: Math.round(pacePercentile),
    impulsePercentile: Math.round(impulsePercentile),
    sampleCount: historicalWindows.length,
    historyDays: Math.max(1, Math.ceil((lastTimestamp - firstTimestamp) / 86_400_000)),
    updatedAt,
    guidance: guidanceForRegime(regime),
  };
}
