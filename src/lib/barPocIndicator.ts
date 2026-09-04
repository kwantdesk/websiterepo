import { cmeSessionDateKey } from "./chartHistoryWindow.ts";
import type { FootprintBar, FootprintRow } from "./footprint.ts";
import { exchangeMinuteOfDay } from "./volumeProfileSessions.ts";

export const BAR_POC_SETTINGS_VERSION = 1;

export type BarPocSettings = {
  schemaVersion: number;
  daysToLoad: number;
  inputData: "volume" | "order" | "aggregate-trades";
  filterMin: number;
  filterMax: number;
  filterMode: "none" | "manual" | "auto";
  autoStdDev: number;
  manualMinimumVolume: number;
  rthFilterWindow: "disabled" | "exchange-rth" | "custom";
  rthFilterMode: "none" | "manual" | "auto";
  rthAutoStdDev: number;
  rthManualMinimumVolume: number;
  rthStartMinutes: number;
  showRectangle: boolean;
  rectangleLineWidth: number;
  showBackground: boolean;
  backgroundOpacity: number;
  bidColor: string;
  askColor: string;
  extendPoc: boolean;
  extensionLineWidth: number;
  maxBarsExtension: number;
  resetOnNewDay: boolean;
  removeOnShadowTouch: boolean;
  tickMarginBreakout: number;
  hideLineOnBreakout: boolean;
  showDuration: boolean;
  durationFontSize: number;
  durationTextColor: string;
  useThemeColors: boolean;
};

export type BarPocLevel = {
  id: string;
  barStartMs: number;
  barEndMs: number;
  priceTick: number;
  bidVolume: number;
  askVolume: number;
  totalVolume: number;
  totalTrades: number;
  metricValue: number;
  direction: "bid" | "ask";
  extensionEndMs: number;
  extensionBars: number;
  triggered: boolean;
};

export type BarPocFrame = {
  instrument: string;
  tickSize: number;
  status: "LIVE" | "HISTORICAL" | "WAITING_FOR_VOLUME_AT_PRICE";
  levels: BarPocLevel[];
};

export const DEFAULT_BAR_POC_SETTINGS: BarPocSettings = {
  schemaVersion: BAR_POC_SETTINGS_VERSION,
  daysToLoad: 5,
  inputData: "volume",
  filterMin: 0,
  filterMax: 0,
  filterMode: "none",
  autoStdDev: 1,
  manualMinimumVolume: 0,
  rthFilterWindow: "disabled",
  rthFilterMode: "none",
  rthAutoStdDev: 1,
  rthManualMinimumVolume: 0,
  rthStartMinutes: 8 * 60 + 30,
  showRectangle: true,
  rectangleLineWidth: 1,
  showBackground: true,
  backgroundOpacity: 22,
  bidColor: "#EF4444",
  askColor: "#22C55E",
  extendPoc: true,
  extensionLineWidth: 1,
  maxBarsExtension: 0,
  resetOnNewDay: false,
  removeOnShadowTouch: true,
  tickMarginBreakout: 0,
  hideLineOnBreakout: false,
  showDuration: false,
  durationFontSize: 9,
  durationTextColor: "#A1A1AA",
  useThemeColors: true,
};

const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export function normalizeBarPocSettings(input?: Record<string, unknown> | null): BarPocSettings {
  const source = input ?? {};
  const settings = { ...DEFAULT_BAR_POC_SETTINGS, ...source } as BarPocSettings;
  settings.schemaVersion = BAR_POC_SETTINGS_VERSION;
  settings.daysToLoad = Math.round(clamp(finite(source.daysToLoad, 5), 1, 365));
  settings.filterMin = clamp(finite(source.filterMin, 0), 0, 1_000_000_000);
  settings.filterMax = clamp(finite(source.filterMax, 0), 0, 1_000_000_000);
  settings.autoStdDev = clamp(finite(source.autoStdDev, 1), 0, 4);
  settings.manualMinimumVolume = clamp(finite(source.manualMinimumVolume, 0), 0, 10_000_000);
  settings.rthAutoStdDev = clamp(finite(source.rthAutoStdDev, 1), 0, 4);
  settings.rthManualMinimumVolume = clamp(finite(source.rthManualMinimumVolume, 0), 0, 10_000_000);
  settings.rthStartMinutes = Math.round(clamp(finite(source.rthStartMinutes, 510), 0, 1_439));
  settings.rectangleLineWidth = clamp(finite(source.rectangleLineWidth, 1), 1, 8);
  settings.backgroundOpacity = clamp(finite(source.backgroundOpacity, 22), 0, 100);
  settings.extensionLineWidth = clamp(finite(source.extensionLineWidth, 1), 1, 8);
  settings.maxBarsExtension = Math.round(clamp(finite(source.maxBarsExtension, 0), 0, 100_000));
  settings.tickMarginBreakout = Math.round(clamp(finite(source.tickMarginBreakout, 0), 0, 10_000));
  settings.durationFontSize = clamp(finite(source.durationFontSize, 9), 6, 50);
  if (!(new Set(["volume", "order", "aggregate-trades"]) as Set<unknown>).has(settings.inputData)) settings.inputData = "volume";
  if (!(new Set(["none", "manual", "auto"]) as Set<unknown>).has(settings.filterMode)) settings.filterMode = "none";
  if (!(new Set(["disabled", "exchange-rth", "custom"]) as Set<unknown>).has(settings.rthFilterWindow)) settings.rthFilterWindow = "disabled";
  if (!(new Set(["none", "manual", "auto"]) as Set<unknown>).has(settings.rthFilterMode)) settings.rthFilterMode = "none";
  return settings;
}

function rowMetric(row: FootprintRow, mode: BarPocSettings["inputData"]) {
  if (mode === "order") return row.bidTrades + row.askTrades + row.unknownTrades;
  // Rithmic execution rows are already aggregated by exact exchange price.
  return row.bidVolume + row.askVolume + row.unknownVolume;
}

function choosePoc(bar: FootprintBar, mode: BarPocSettings["inputData"]) {
  const candidates = bar.rows.map((row) => ({ row, value: rowMetric(row, mode) })).filter((item) => item.value > 0);
  if (!candidates.length) return null;
  const maximum = Math.max(...candidates.map((item) => item.value));
  const tied = candidates.filter((item) => item.value === maximum);
  const total = candidates.reduce((sum, item) => sum + item.value, 0);
  const weightedTick = total > 0 ? candidates.reduce((sum, item) => sum + item.row.tickIndex * item.value, 0) / total : bar.closeTick;
  tied.sort((left, right) => Math.abs(left.row.tickIndex - weightedTick) - Math.abs(right.row.tickIndex - weightedTick)
    || Math.abs(left.row.tickIndex - bar.closeTick) - Math.abs(right.row.tickIndex - bar.closeTick)
    || left.row.tickIndex - right.row.tickIndex);
  return { row: tied[0].row, metricValue: maximum };
}

function meanAndDeviation(values: number[]) {
  if (!values.length) return { mean: 0, deviation: 0 };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  return { mean, deviation };
}

function inRthFilter(bar: FootprintBar, settings: BarPocSettings) {
  if (settings.rthFilterWindow === "disabled") return false;
  const start = settings.rthFilterWindow === "exchange-rth" ? 8 * 60 + 30 : settings.rthStartMinutes;
  const minute = exchangeMinuteOfDay(bar.startTime);
  return minute >= start && minute < 17 * 60;
}

function passesFilter(value: number, mode: "none" | "manual" | "auto", manual: number, stdDev: number, sample: number[]) {
  if (mode === "manual") return value >= manual;
  if (mode === "auto") {
    const stats = meanAndDeviation(sample);
    return value >= stats.mean + stats.deviation * stdDev;
  }
  return true;
}

function extensionTriggered(level: BarPocLevel, source: FootprintBar, later: FootprintBar, settings: BarPocSettings) {
  if (settings.removeOnShadowTouch) return later.lowTick <= level.priceTick && later.highTick >= level.priceTick;
  const margin = settings.tickMarginBreakout;
  if (source.closeTick > level.priceTick) return later.closeTick <= level.priceTick - margin;
  if (source.closeTick < level.priceTick) return later.closeTick >= level.priceTick + margin;
  return Math.abs(later.closeTick - level.priceTick) >= margin;
}

export function buildBarPocFrame(
  barsInput: FootprintBar[],
  instrument: string,
  tickSize: number,
  input?: Record<string, unknown> | null,
): BarPocFrame {
  const settings = normalizeBarPocSettings(input);
  const latestMs = Math.max(0, ...barsInput.map((bar) => bar.endTime));
  const cutoff = latestMs - settings.daysToLoad * 86_400_000;
  const bars = barsInput.filter((bar) => bar.endTime >= cutoff);
  if (!bars.some((bar) => bar.hasPriceLevelFlow)) {
    return { instrument, tickSize, status: "WAITING_FOR_VOLUME_AT_PRICE", levels: [] };
  }
  const selected = bars.map((bar, barIndex) => ({ bar, barIndex, poc: choosePoc(bar, settings.inputData) }))
    .filter((item): item is { bar: FootprintBar; barIndex: number; poc: NonNullable<ReturnType<typeof choosePoc>> } => Boolean(item.poc));
  const allValues = selected.map((item) => item.poc.metricValue);
  const rthValues = selected.filter((item) => inRthFilter(item.bar, settings)).map((item) => item.poc.metricValue);
  const levels: BarPocLevel[] = [];
  for (const { bar, barIndex, poc } of selected) {
    const useRth = inRthFilter(bar, settings);
    const filterMode = useRth ? settings.rthFilterMode : settings.filterMode;
    const manual = useRth ? settings.rthManualMinimumVolume : settings.manualMinimumVolume;
    const stdDev = useRth ? settings.rthAutoStdDev : settings.autoStdDev;
    if (!passesFilter(poc.metricValue, filterMode, manual, stdDev, useRth ? rthValues : allValues)) continue;
    const row = poc.row;
    const level: BarPocLevel = {
      id: `bar-poc:${bar.id}:${row.tickIndex}:${settings.inputData}`,
      barStartMs: bar.startTime,
      barEndMs: bar.endTime,
      priceTick: row.tickIndex,
      bidVolume: row.bidVolume,
      askVolume: row.askVolume,
      totalVolume: row.bidVolume + row.askVolume + row.unknownVolume,
      totalTrades: row.bidTrades + row.askTrades + row.unknownTrades,
      metricValue: poc.metricValue,
      direction: row.askVolume - row.bidVolume >= 0 ? "ask" : "bid",
      extensionEndMs: bar.endTime,
      extensionBars: 0,
      triggered: false,
    };
    if (settings.extendPoc) {
      const session = cmeSessionDateKey(bar.startTime);
      for (let laterIndex = barIndex + 1; laterIndex < bars.length; laterIndex += 1) {
        const later = bars[laterIndex];
        if (settings.resetOnNewDay && cmeSessionDateKey(later.startTime) !== session) break;
        if (settings.maxBarsExtension > 0 && level.extensionBars >= settings.maxBarsExtension) break;
        level.extensionEndMs = later.endTime;
        level.extensionBars += 1;
        if (extensionTriggered(level, bar, later, settings)) {
          level.triggered = true;
          break;
        }
      }
    }
    levels.push(level);
  }
  const latest = bars.at(-1);
  return { instrument, tickSize, status: latest && !latest.isClosed ? "LIVE" : "HISTORICAL", levels };
}
