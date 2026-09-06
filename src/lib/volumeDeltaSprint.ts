import type { Candle } from "./backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "./chartIndicatorEngine";

export const VOLUME_DELTA_SPRINT_DEFAULTS = {
  inputData: "volume", filterMin: 0, filterMax: 0, length: 10,
  deltaColorMode: "fading", smoothingEnabled: false,
  smoothingType: "simple", smoothingLength: 3,
  showDelta: true, showBid: false, showAsk: false,
  useThemeColors: true, positiveColor: "#22C55E", negativeColor: "#EF4444",
  bidColor: "#EF4444", askColor: "#22C55E", lineWidth: 3,
  shortName: "Volume/Delta Sprint",
} as const;

export type VolumeDeltaSprintSettings = {
  inputData: "volume" | "trades";
  filterMin: number;
  filterMax: number;
  length: number;
  deltaColorMode: "fixed" | "fading";
  smoothingEnabled: boolean;
  smoothingType: "simple" | "exponential" | "triangular" | "weighted";
  smoothingLength: number;
  showDelta: boolean;
  showBid: boolean;
  showAsk: boolean;
  useThemeColors: boolean;
  positiveColor: string;
  negativeColor: string;
  bidColor: string;
  askColor: string;
  lineWidth: 1 | 2 | 3 | 4;
  shortName: string;
};

type SprintPoint = { time: number; ask: number; bid: number; delta: number; breakBefore: boolean };
const finite = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const bounded = (value: unknown, fallback: number, min: number, max: number) => Math.max(min, Math.min(max, finite(value, fallback)));
const colour = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value : fallback;

export function normalizeVolumeDeltaSprintSettings(raw: Record<string, unknown> = {}): VolumeDeltaSprintSettings {
  return {
    inputData: raw.inputData === "trades" || raw.inputData === "order" ? "trades" : "volume",
    filterMin: bounded(raw.filterMin, 0, 0, 10_000_000),
    filterMax: bounded(raw.filterMax, 0, 0, 10_000_000),
    length: Math.round(bounded(raw.length, 10, 1, 10_000)),
    deltaColorMode: raw.deltaColorMode === "fixed" ? "fixed" : "fading",
    smoothingEnabled: raw.smoothingEnabled === true,
    smoothingType: ["exponential", "triangular", "weighted"].includes(String(raw.smoothingType))
      ? raw.smoothingType as VolumeDeltaSprintSettings["smoothingType"] : "simple",
    smoothingLength: Math.round(bounded(raw.smoothingLength, 3, 1, 1_000)),
    showDelta: raw.showDelta !== false,
    showBid: raw.showBid === true,
    showAsk: raw.showAsk === true,
    useThemeColors: raw.useThemeColors !== false,
    positiveColor: colour(raw.positiveColor, "#22C55E"),
    negativeColor: colour(raw.negativeColor, "#EF4444"),
    bidColor: colour(raw.bidColor, "#EF4444"),
    askColor: colour(raw.askColor, "#22C55E"),
    lineWidth: Math.round(bounded(raw.lineWidth, 3, 1, 4)) as 1 | 2 | 3 | 4,
    shortName: typeof raw.shortName === "string" && raw.shortName.trim() ? raw.shortName.trim().slice(0, 64) : "Volume/Delta Sprint",
  };
}

function classified(candle: Candle, mode: VolumeDeltaSprintSettings["inputData"]) {
  const ask = finite(mode === "trades" ? candle.askTrades : candle.askVolume, Number.NaN);
  const bid = finite(mode === "trades" ? candle.bidTrades : candle.bidVolume, Number.NaN);
  return ask >= 0 && bid >= 0 && Number.isFinite(ask) && Number.isFinite(bid) ? { ask, bid } : null;
}

/** A missing or invalid flow candle starts a new segment; rolling windows never bridge it. */
export function calculateVolumeDeltaSprintPoints(candles: readonly Candle[], raw: Record<string, unknown> = {}) {
  const settings = normalizeVolumeDeltaSprintSettings(raw);
  const result: SprintPoint[] = [];
  let window: Array<{ ask: number; bid: number }> = [];
  let askSum = 0;
  let bidSum = 0;
  let previousTimestamp = -Infinity;
  let nextBreak = true;
  for (const candle of candles) {
    const sides = classified(candle, settings.inputData);
    if (!sides || !Number.isFinite(candle.timestamp) || candle.timestamp <= previousTimestamp) {
      window = []; askSum = 0; bidSum = 0; nextBreak = true;
      if (Number.isFinite(candle.timestamp)) previousTimestamp = candle.timestamp;
      continue;
    }
    previousTimestamp = candle.timestamp;
    const filter = (value: number) => value >= settings.filterMin && (settings.filterMax === 0 || value <= settings.filterMax) ? value : 0;
    const item = { ask: filter(sides.ask), bid: filter(sides.bid) };
    window.push(item); askSum += item.ask; bidSum += item.bid;
    if (window.length > settings.length) {
      const removed = window.shift()!; askSum -= removed.ask; bidSum -= removed.bid;
    }
    if (window.length < settings.length) continue;
    result.push({ time: candle.timestamp / 1_000, ask: askSum, bid: bidSum, delta: askSum - bidSum, breakBefore: nextBreak });
    nextBreak = false;
  }
  return result;
}

function smooth(values: number[], type: VolumeDeltaSprintSettings["smoothingType"], length: number) {
  if (length <= 1) return values;
  if (type === "exponential") {
    const alpha = 2 / (length + 1);
    let ema = values[0] ?? 0;
    return values.map((value, index) => index === 0 ? value : (ema = alpha * value + (1 - alpha) * ema));
  }
  const rolling = (source: number[], weighted: boolean) => source.map((_, index) => {
    const from = Math.max(0, index - length + 1);
    const slice = source.slice(from, index + 1);
    if (!weighted) return slice.reduce((sum, value) => sum + value, 0) / slice.length;
    const denominator = slice.length * (slice.length + 1) / 2;
    return slice.reduce((sum, value, offset) => sum + value * (offset + 1), 0) / denominator;
  });
  if (type === "triangular") return rolling(rolling(values, false), false);
  return rolling(values, type === "weighted");
}

function mix(from: string, to: string, amount: number) {
  const parse = (input: string) => /^#([0-9a-f]{6})$/i.exec(input)?.[1];
  const a = parse(from); const b = parse(to);
  if (!a || !b) return to;
  const channel = (offset: number) => Math.round(parseInt(a.slice(offset, offset + 2), 16) * (1 - amount) + parseInt(b.slice(offset, offset + 2), 16) * amount).toString(16).padStart(2, "0");
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

export function calculateVolumeDeltaSprint(
  candles: readonly Candle[], raw: Record<string, unknown>, theme: IndicatorTheme,
): CalculatedIndicatorSeries[] {
  const settings = normalizeVolumeDeltaSprintSettings(raw);
  const points = calculateVolumeDeltaSprintPoints(candles, settings);
  if (!points.length) return [];
  const deltaValues = settings.smoothingEnabled ? smooth(points.map(point => point.delta), settings.smoothingType, settings.smoothingLength) : points.map(point => point.delta);
  const bidValues = settings.smoothingEnabled ? smooth(points.map(point => point.bid), settings.smoothingType, settings.smoothingLength) : points.map(point => point.bid);
  const askValues = settings.smoothingEnabled ? smooth(points.map(point => point.ask), settings.smoothingType, settings.smoothingLength) : points.map(point => point.ask);
  const positive = settings.useThemeColors ? theme.positive : settings.positiveColor;
  const negative = settings.useThemeColors ? theme.negative : settings.negativeColor;
  const bidColor = settings.useThemeColors ? theme.negative : settings.bidColor;
  const askColor = settings.useThemeColors ? theme.positive : settings.askColor;
  const magnitudeWindow: number[] = [];
  const deltaData = points.map((point, index) => {
    magnitudeWindow.push(Math.abs(deltaValues[index]));
    if (magnitudeWindow.length > settings.length) magnitudeWindow.shift();
    const target = deltaValues[index] >= 0 ? positive : negative;
    const maximum = Math.max(1, ...magnitudeWindow);
    const color = settings.deltaColorMode === "fixed" ? target : mix(theme.muted, target, 0.25 + 0.75 * Math.abs(deltaValues[index]) / maximum);
    return { time: point.time, value: deltaValues[index], color, breakBefore: point.breakBefore };
  });
  const series: CalculatedIndicatorSeries[] = [];
  if (settings.showDelta) series.push({ key: "volume-delta-sprint-delta", label: settings.shortName, kind: "histogram", placement: "pane", color: positive, histogramBarWidth: settings.lineWidth, includeZeroInScale: true, data: deltaData });
  if (settings.showBid) series.push({ key: "volume-delta-sprint-bid", label: "Bid", kind: "histogram", placement: "pane", color: bidColor, histogramBarWidth: settings.lineWidth, includeZeroInScale: true, data: points.map((point, index) => ({ time: point.time, value: -bidValues[index], color: bidColor, breakBefore: point.breakBefore })) });
  if (settings.showAsk) series.push({ key: "volume-delta-sprint-ask", label: "Ask", kind: "histogram", placement: "pane", color: askColor, histogramBarWidth: settings.lineWidth, includeZeroInScale: true, data: points.map((point, index) => ({ time: point.time, value: askValues[index], color: askColor, breakBefore: point.breakBefore })) });
  return series;
}
