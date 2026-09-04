import type { Candle } from "@/lib/backtester";

export const DEEP_DELTA_SETTINGS_VERSION = 1;

export type DeepDeltaInput = "volume" | "aggregate-trades" | "trades" | "order";
export type DeepDeltaMode = "classic" | "multi-range";

export type DeepDeltaSettings = {
  inputData: DeepDeltaInput;
  deltaMode: DeepDeltaMode;
  barGrouping: number;
  range1Enabled: boolean;
  range1Minimum: number;
  range1Maximum: number;
  range2Enabled: boolean;
  range2Minimum: number;
  range2Maximum: number;
  range3Enabled: boolean;
  range3Minimum: number;
  range3Maximum: number;
  range4Enabled: boolean;
  range4Minimum: number;
  range4Maximum: number;
  level1Enabled: boolean;
  level1Value: number;
  level1LineWidth: number;
  level1LineStyle: "solid" | "dashed" | "dotted";
  level2Enabled: boolean;
  level2Value: number;
  level2LineWidth: number;
  level2LineStyle: "solid" | "dashed" | "dotted";
  markerEnabled: boolean;
  markerMinimumDelta: number;
  lineWidth: number;
  useThemeColors: boolean;
  schemaVersion: number;
};

export const DEFAULT_DEEP_DELTA_SETTINGS: DeepDeltaSettings = {
  inputData: "volume",
  deltaMode: "multi-range",
  barGrouping: 4,
  range1Enabled: true,
  range1Minimum: 1,
  range1Maximum: 10,
  range2Enabled: true,
  range2Minimum: 11,
  range2Maximum: 20,
  range3Enabled: true,
  range3Minimum: 21,
  range3Maximum: 30,
  range4Enabled: true,
  range4Minimum: 31,
  range4Maximum: 0,
  level1Enabled: false,
  level1Value: 1000,
  level1LineWidth: 1,
  level1LineStyle: "dashed",
  level2Enabled: false,
  level2Value: 1500,
  level2LineWidth: 1,
  level2LineStyle: "dashed",
  markerEnabled: false,
  markerMinimumDelta: 0,
  lineWidth: 1,
  useThemeColors: true,
  schemaVersion: DEEP_DELTA_SETTINGS_VERSION,
};

const finite = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bounded = (value: unknown, fallback: number, min: number, max: number) =>
  Math.min(max, Math.max(min, finite(value, fallback)));

export function normalizeDeepDeltaSettings(source?: Record<string, unknown> | null): DeepDeltaSettings {
  const input = String(source?.inputData ?? DEFAULT_DEEP_DELTA_SETTINGS.inputData);
  const mode = String(source?.deltaMode ?? DEFAULT_DEEP_DELTA_SETTINGS.deltaMode);
  const style = (key: "level1LineStyle" | "level2LineStyle") => {
    const value = String(source?.[key] ?? DEFAULT_DEEP_DELTA_SETTINGS[key]);
    return (value === "solid" || value === "dotted" ? value : "dashed") as "solid" | "dashed" | "dotted";
  };
  const enabled = (key: keyof DeepDeltaSettings) =>
    typeof source?.[key] === "boolean" ? Boolean(source[key]) : Boolean(DEFAULT_DEEP_DELTA_SETTINGS[key]);
  const range = (number: 1 | 2 | 3 | 4) => ({
    enabled: enabled(`range${number}Enabled` as keyof DeepDeltaSettings),
    minimum: bounded(source?.[`range${number}Minimum`], DEFAULT_DEEP_DELTA_SETTINGS[`range${number}Minimum`], 0, 10_000_000),
    maximum: bounded(source?.[`range${number}Maximum`], DEFAULT_DEEP_DELTA_SETTINGS[`range${number}Maximum`], 0, 10_000_000),
  });
  const ranges = [range(1), range(2), range(3), range(4)];
  // Keep every tier deterministic while it is dragged. Zero is the documented
  // "no maximum" value, otherwise a maximum can never sit below its minimum.
  ranges.forEach((item) => {
    if (item.maximum > 0 && item.maximum < item.minimum) item.maximum = item.minimum;
  });
  return {
    inputData: (["volume", "aggregate-trades", "trades", "order"].includes(input) ? input : "volume") as DeepDeltaInput,
    deltaMode: (mode === "classic" ? mode : "multi-range") as DeepDeltaMode,
    barGrouping: Math.round(bounded(source?.barGrouping, 4, 1, 100)),
    range1Enabled: ranges[0].enabled,
    range1Minimum: ranges[0].minimum,
    range1Maximum: ranges[0].maximum,
    range2Enabled: ranges[1].enabled,
    range2Minimum: ranges[1].minimum,
    range2Maximum: ranges[1].maximum,
    range3Enabled: ranges[2].enabled,
    range3Minimum: ranges[2].minimum,
    range3Maximum: ranges[2].maximum,
    range4Enabled: ranges[3].enabled,
    range4Minimum: ranges[3].minimum,
    range4Maximum: ranges[3].maximum,
    level1Enabled: enabled("level1Enabled"),
    level1Value: bounded(source?.level1Value, 1000, 0, 10_000_000),
    level1LineWidth: bounded(source?.level1LineWidth, 1, 0.5, 6),
    level1LineStyle: style("level1LineStyle"),
    level2Enabled: enabled("level2Enabled"),
    level2Value: bounded(source?.level2Value, 1500, 0, 10_000_000),
    level2LineWidth: bounded(source?.level2LineWidth, 1, 0.5, 6),
    level2LineStyle: style("level2LineStyle"),
    markerEnabled: enabled("markerEnabled"),
    markerMinimumDelta: bounded(source?.markerMinimumDelta, 0, 0, 10_000_000),
    lineWidth: bounded(source?.lineWidth, 1, 0.5, 6),
    useThemeColors: source?.useThemeColors !== false,
    schemaVersion: DEEP_DELTA_SETTINGS_VERSION,
  };
}

export type DeepDeltaBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  range: 0 | 1 | 2 | 3 | 4;
  side: "ask" | "bid" | "neutral";
  struggle: boolean;
};

function candleDelta(candle: Candle, input: DeepDeltaInput) {
  if (input === "trades" || input === "order") {
    const ask = finite(candle.askTrades, 0);
    const bid = finite(candle.bidTrades, 0);
    if (ask + bid <= 0) return null;
    return { close: ask - bid, high: Math.max(0, ask - bid), low: Math.min(0, ask - bid) };
  }
  const ask = finite(candle.askVolume, 0);
  const bid = finite(candle.bidVolume, 0);
  if (ask + bid <= 0) return null;
  const close = finite(candle.deltaClose, finite(candle.delta, ask - bid));
  // Rithmic history/live aggregation carries the exchange-sequenced delta
  // extremes when available. Aggregate-trades has the same signed total when
  // no per-execution size filter is applied; grouping fragmented prints does
  // not change their sum.
  return {
    close,
    high: Math.max(0, finite(candle.deltaHigh, close)),
    low: Math.min(0, finite(candle.deltaLow, close)),
  };
}

function matchingRange(magnitude: number, settings: DeepDeltaSettings): 0 | 1 | 2 | 3 | 4 {
  if (settings.deltaMode === "classic") return 0;
  for (const number of [1, 2, 3, 4] as const) {
    if (!settings[`range${number}Enabled`]) continue;
    const min = settings[`range${number}Minimum`];
    const max = settings[`range${number}Maximum`];
    if (magnitude >= min && (max === 0 || magnitude <= max)) return number;
  }
  return 0;
}

export function calculateDeepDeltaBars(
  candles: readonly Candle[],
  inputSettings?: Record<string, unknown> | null,
): DeepDeltaBar[] {
  const settings = normalizeDeepDeltaSettings(inputSettings);
  const output: DeepDeltaBar[] = [];
  let group: Array<{ candle: Candle; delta: NonNullable<ReturnType<typeof candleDelta>> }> = [];
  const flush = () => {
    if (!group.length) return;
    let running = 0;
    let high = 0;
    let low = 0;
    for (const item of group) {
      high = Math.max(high, running + item.delta.high);
      low = Math.min(low, running + item.delta.low);
      running += item.delta.close;
      high = Math.max(high, running);
      low = Math.min(low, running);
    }
    const magnitude = Math.abs(running);
    const threshold = settings.markerMinimumDelta;
    output.push({
      time: group[group.length - 1].candle.timestamp / 1000,
      open: 0,
      high,
      low,
      close: running,
      range: matchingRange(magnitude, settings),
      side: running > 0 ? "ask" : running < 0 ? "bid" : "neutral",
      struggle: settings.markerEnabled && high >= threshold && low <= -threshold && high > 0 && low < 0,
    });
    group = [];
  };
  for (const candle of candles) {
    const delta = candleDelta(candle, settings.inputData);
    if (!delta) {
      flush();
      continue;
    }
    group.push({ candle, delta });
    if (group.length >= settings.barGrouping) flush();
  }
  // The forming group is real live information and must update with the
  // candle rather than waiting for the fourth bar to close.
  flush();
  return output;
}
