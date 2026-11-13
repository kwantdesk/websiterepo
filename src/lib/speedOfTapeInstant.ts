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
  open: number;
  high: number;
  low: number;
  positive: boolean;
};

export type SpeedOfTapeInstantFrame = {
  bars: SpeedOfTapeInstantBar[];
  mean: number;
  standardDeviation: number;
  latestTradeMs: number | null;
  nextChangeMs?: number;
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

/** Sample the trailing execution window at arrivals, expiries and candle boundaries. */
export function buildSpeedOfTapeInstantFrame(
  tradesInput: readonly InstitutionalTrade[],
  settingsInput?: Record<string, unknown> | Partial<SpeedOfTapeInstantSettings> | null,
  asOfMs?: number,
): SpeedOfTapeInstantFrame {
  const settings = normalizeSpeedOfTapeInstantSettings(settingsInput);
  const bucketMs = settings.numberOfSeconds * 1_000;
  const compare = (a: InstitutionalTrade, b: InstitutionalTrade) =>
    a.timestamp - b.timestamp || a.recordIndex - b.recordIndex;
  const trades = tradesInput.some((trade, index) => !Number.isFinite(trade.timestamp)
    || (index > 0 && compare(tradesInput[index - 1], trade) > 0))
    ? tradesInput.filter(trade => Number.isFinite(trade.timestamp)).sort(compare)
    : tradesInput;
  const isExecution = (trade: InstitutionalTrade) =>
    !trade.flowOnly && !trade.footprintSummary && Number.isFinite(trade.volume) && trade.volume > 0;
  let latestTradeMs: number | null = null;
  for (let i = trades.length - 1; i >= 0; i--) {
    const trade = trades[i];
    if ((asOfMs === undefined || trade.timestamp <= asOfMs) && isExecution(trade)) {
      latestTradeMs = trade.timestamp;
      break;
    }
  }
  if (latestTradeMs === null) return { bars: [], mean: 0, standardDeviation: 0, latestTradeMs };
  const clock = asOfMs ?? latestTradeMs;
  const latestStartMs = Math.floor(clock / bucketMs) * bucketMs;
  const baselineCount = Math.max(settings.barsToShow, settings.standardDeviationLookback);
  const firstStartMs = latestStartMs - (baselineCount - 1) * bucketMs;
  let start = 0, end = trades.length;
  while (start < end) {
    const middle = (start + end) >>> 1;
    if (trades[middle].timestamp <= firstStartMs - bucketMs) start = middle + 1;
    else end = middle;
  }

  const eligible: Array<{ time: number; size: number; side: InstitutionalTrade["aggressor"] }> = [];
  for (let i = start; i < trades.length && trades[i].timestamp <= clock; i++) {
    const trade = trades[i];
    if (!isExecution(trade) || trade.volume < settings.filterMin
      || (settings.filterMax > 0 && trade.volume > settings.filterMax)) continue;
    const size = settings.inputData === "trades" ? Math.max(1, finite(trade.trades, 1)) : trade.volume;
    eligible.push({ time: trade.timestamp, size, side: trade.aggressor });
  }
  let left = 0, right = 0, total = 0, buy = 0, sell = 0;
  const update = (trade: (typeof eligible)[number], sign: number) => {
    const change = trade.size * sign;
    total += change;
    if (trade.side === "BUY") buy += change;
    else if (trade.side === "SELL") sell += change;
  };
  const value = () => selectedValue(settings.displayValue, total, buy, sell);
  const advance = (cutoff: number, sample?: () => void) => {
    while (true) {
      const arrival = eligible[right]?.time ?? Infinity;
      const expiry = left < right ? eligible[left].time + bucketMs : Infinity;
      const next = Math.min(arrival, expiry);
      if (next > cutoff) return;
      while (left < right && eligible[left].time + bucketMs <= next) update(eligible[left++], -1);
      while (eligible[right]?.time === next) update(eligible[right++], 1);
      sample?.();
    }
  };

  const firstTradeMs = trades.find(isExecution)!.timestamp;
  const firstVisibleBucket = Math.max(firstStartMs, Math.floor(firstTradeMs / bucketMs) * bucketMs);
  const bars: SpeedOfTapeInstantBar[] = [];
  for (let startMs = firstVisibleBucket; startMs <= latestStartMs; startMs += bucketMs) {
    const endMs = startMs + bucketMs;
    advance(startMs);
    const open = value();
    let high = open, low = open;
    advance(Math.min(endMs - 1, clock), () => {
      const current = value();
      high = Math.max(high, current);
      low = Math.min(low, current);
    });
    const delta = buy - sell;
    bars.push({ startMs, endMs, total, buy, sell, delta, open, high, low, value: value(), positive: delta >= 0 });
  }
  const baselineValues = bars.slice(-settings.standardDeviationLookback).map(bar => Math.abs(bar.value));
  const mean = baselineValues.reduce((sum, item) => sum + item, 0) / baselineValues.length;
  const variance = baselineValues.reduce((sum, item) => sum + (item - mean) ** 2, 0) / baselineValues.length;
  const visible = bars.slice(-settings.barsToShow);
  const nextExpiry = left < right ? eligible[left].time + bucketMs : Infinity;
  const nextChangeMs = visible.some(bar => bar.high !== 0 || bar.low !== 0)
    ? Math.min(latestStartMs + bucketMs, nextExpiry) : undefined;
  return {
    bars: settings.plotReversed ? visible.reverse() : visible,
    mean, standardDeviation: Math.sqrt(variance), latestTradeMs, nextChangeMs,
  };
}
