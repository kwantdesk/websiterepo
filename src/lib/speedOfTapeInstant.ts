import type { InstitutionalTrade } from "@/lib/institutionalMarketData";

export const SPEED_OF_TAPE_INSTANT_SETTINGS_VERSION = 2;

// Deep Charts leaves a stable ten-percent meter margin above the largest
// visible/SD reference. Without it SD+2 was pinned to the top border and the
// bars looked stretched compared with the licensed reference rail.
export const SPEED_OF_TAPE_PLOT_TOP_MARGIN_PERCENT = 10;

export type SpeedOfTapeInputData = "volume" | "trades";
export type SpeedOfTapeDisplayValue = "total" | "buy" | "sell" | "delta";

export type SpeedOfTapeInstantSettings = {
  settingsVersion: number;
  inputData: SpeedOfTapeInputData;
  filterMin: number;
  filterMax: number;
  displayValue: SpeedOfTapeDisplayValue;
  numberOfSeconds: number;
  barsToShow: number;
  scaleMinValue: number;
  lineWidth: number;
  plotReversed: boolean;
  showStandardDeviations: boolean;
  standardDeviationLookback: number;
  useThemeColors: boolean;
  positiveBorderColor: string;
  positiveFillColor: string;
  negativeBorderColor: string;
  negativeFillColor: string;
  textEnabled: boolean;
  textSize: number;
  textColor: string;
};

export const DEFAULT_SPEED_OF_TAPE_INSTANT_SETTINGS: SpeedOfTapeInstantSettings = {
  settingsVersion: SPEED_OF_TAPE_INSTANT_SETTINGS_VERSION,
  inputData: "volume",
  filterMin: 1,
  filterMax: 0,
  displayValue: "total",
  numberOfSeconds: 10,
  barsToShow: 3,
  scaleMinValue: 0,
  lineWidth: 1,
  plotReversed: false,
  showStandardDeviations: true,
  standardDeviationLookback: 60,
  useThemeColors: true,
  positiveBorderColor: "#22C55E",
  positiveFillColor: "#22C55E",
  negativeBorderColor: "#EF4444",
  negativeFillColor: "#EF4444",
  textEnabled: true,
  textSize: 10,
  textColor: "#F8FAFC",
};

export type SpeedOfTapeInstantBar = {
  startMs: number;
  endMs: number;
  total: number;
  buy: number;
  sell: number;
  delta: number;
  value: number;
  positive: boolean;
};

export type SpeedOfTapeInstantFrame = {
  bars: SpeedOfTapeInstantBar[];
  mean: number;
  standardDeviation: number;
  latestTradeMs: number | null;
};

const finite = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

export function normalizeSpeedOfTapeInstantSettings(
  input?: Record<string, unknown> | Partial<SpeedOfTapeInstantSettings> | null,
): SpeedOfTapeInstantSettings {
  const source = input ?? {};
  return {
    ...DEFAULT_SPEED_OF_TAPE_INSTANT_SETTINGS,
    ...source,
    settingsVersion: SPEED_OF_TAPE_INSTANT_SETTINGS_VERSION,
    inputData: source.inputData === "trades" ? "trades" : "volume",
    displayValue: ["total", "buy", "sell", "delta"].includes(String(source.displayValue))
      ? source.displayValue as SpeedOfTapeDisplayValue
      : "total",
    filterMin: clamp(finite(source.filterMin, 1), 0, 1_000_000),
    filterMax: clamp(finite(source.filterMax, 0), 0, 1_000_000),
    numberOfSeconds: Math.round(clamp(finite(source.numberOfSeconds, 10), 1, 3_600)),
    barsToShow: Math.round(clamp(finite(source.barsToShow, 3), 1, 20)),
    scaleMinValue: clamp(finite(source.scaleMinValue, 0), 0, 1_000_000_000),
    lineWidth: clamp(finite(source.lineWidth, 1), 0.5, 6),
    standardDeviationLookback: Math.round(clamp(finite(source.standardDeviationLookback, 60), 10, 500)),
    plotReversed: source.plotReversed === true,
    showStandardDeviations: source.showStandardDeviations !== false,
    useThemeColors: source.useThemeColors !== false,
    positiveBorderColor: String(source.positiveBorderColor ?? DEFAULT_SPEED_OF_TAPE_INSTANT_SETTINGS.positiveBorderColor),
    positiveFillColor: String(source.positiveFillColor ?? DEFAULT_SPEED_OF_TAPE_INSTANT_SETTINGS.positiveFillColor),
    negativeBorderColor: String(source.negativeBorderColor ?? DEFAULT_SPEED_OF_TAPE_INSTANT_SETTINGS.negativeBorderColor),
    negativeFillColor: String(source.negativeFillColor ?? DEFAULT_SPEED_OF_TAPE_INSTANT_SETTINGS.negativeFillColor),
    textEnabled: source.textEnabled !== false,
    textSize: clamp(finite(source.textSize, DEFAULT_SPEED_OF_TAPE_INSTANT_SETTINGS.textSize), 6, 24),
    textColor: String(source.textColor ?? DEFAULT_SPEED_OF_TAPE_INSTANT_SETTINGS.textColor),
  };
}

export function speedOfTapeMeterHeightPercent(value: number, scaleMaximum: number) {
  const usable = 100 - SPEED_OF_TAPE_PLOT_TOP_MARGIN_PERCENT;
  if (!Number.isFinite(value) || !Number.isFinite(scaleMaximum) || scaleMaximum <= 0) return 0;
  return clamp((Math.abs(value) / scaleMaximum) * usable, 0, usable);
}

export function speedOfTapeMeterTopPercent(value: number, scaleMaximum: number) {
  return 100 - speedOfTapeMeterHeightPercent(value, scaleMaximum);
}

function selectedValue(
  displayValue: SpeedOfTapeDisplayValue,
  total: number,
  buy: number,
  sell: number,
) {
  if (displayValue === "buy") return buy;
  if (displayValue === "sell") return sell;
  if (displayValue === "delta") return buy - sell;
  return total;
}

/**
 * Builds the DeepCharts-style instant tape-speed columns from actual
 * executions. Each column owns one non-overlapping N-second exchange window;
 * OHLCV candles are never used as a substitute for a missing execution tape.
 */
export function buildSpeedOfTapeInstantFrame(
  tradesInput: readonly InstitutionalTrade[],
  settingsInput?: Record<string, unknown> | Partial<SpeedOfTapeInstantSettings> | null,
): SpeedOfTapeInstantFrame {
  const settings = normalizeSpeedOfTapeInstantSettings(settingsInput);
  const bucketMs = settings.numberOfSeconds * 1_000;
  const exact = tradesInput
    .filter((trade) => !trade.flowOnly && Number.isFinite(trade.timestamp) && Number.isFinite(trade.volume));
  let ordered = true;
  for (let index = 1; index < exact.length; index += 1) {
    if (exact[index].timestamp < exact[index - 1].timestamp) { ordered = false; break; }
  }
  if (!ordered) exact.sort((left, right) => left.timestamp - right.timestamp || left.recordIndex - right.recordIndex);
  if (!exact.length) return { bars: [], mean: 0, standardDeviation: 0, latestTradeMs: null };

  const latestTradeMs = exact.at(-1)!.timestamp;
  const latestStartMs = Math.floor(latestTradeMs / bucketMs) * bucketMs;
  const baselineCount = Math.max(settings.barsToShow, settings.standardDeviationLookback);
  const firstStartMs = latestStartMs - (baselineCount - 1) * bucketMs;
  let low = 0;
  let high = exact.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (exact[middle].timestamp < firstStartMs) low = middle + 1;
    else high = middle;
  }
  // The canonical Rithmic tape can hold tens of thousands of prints. Only the
  // configured baseline horizon can affect this rail, so do not clone/sort or
  // filter the unreachable historical prefix on every live packet.
  const eligible = exact.slice(low)
    .filter((trade) => {
      const size = Math.max(0, Number(trade.volume));
      return size >= settings.filterMin && (settings.filterMax <= 0 || size <= settings.filterMax);
    });
  if (!eligible.length) return { bars: [], mean: 0, standardDeviation: 0, latestTradeMs: null };
  const buckets = Array.from({ length: baselineCount }, (_, index) => ({
    startMs: firstStartMs + index * bucketMs,
    endMs: firstStartMs + (index + 1) * bucketMs,
    total: 0,
    buy: 0,
    sell: 0,
  }));

  for (const trade of eligible) {
    const index = Math.floor((trade.timestamp - firstStartMs) / bucketMs);
    if (index < 0 || index >= buckets.length) continue;
    const weight = settings.inputData === "trades" ? Math.max(1, Number(trade.trades) || 1) : Math.max(0, Number(trade.volume));
    buckets[index].total += weight;
    if (trade.aggressor === "BUY") buckets[index].buy += weight;
    else if (trade.aggressor === "SELL") buckets[index].sell += weight;
  }

  const allBars: SpeedOfTapeInstantBar[] = buckets.map((bucket) => {
    const value = selectedValue(settings.displayValue, bucket.total, bucket.buy, bucket.sell);
    // DeepCharts names these paint slots Delta Positive/Negative. The height
    // is the chosen speed metric; the side colour remains execution delta so
    // Total and Trades do not lose which aggressor controlled the window.
    const delta = bucket.buy - bucket.sell;
    return { ...bucket, delta, value, positive: delta >= 0 };
  });
  const baselineValues = allBars.map((bar) => Math.abs(bar.value));
  const mean = baselineValues.reduce((sum, value) => sum + value, 0) / Math.max(1, baselineValues.length);
  const variance = baselineValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, baselineValues.length);
  const visible = allBars.slice(-settings.barsToShow);
  return {
    bars: settings.plotReversed ? [...visible].reverse() : visible,
    mean,
    standardDeviation: Math.sqrt(variance),
    latestTradeMs,
  };
}
