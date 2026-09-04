import type { FootprintBar } from "./footprint.ts";
import type {
  InstitutionalTrade,
  InstitutionalVolumeProfile,
  InstitutionalVolumeProfileLevel,
} from "./institutionalMarketData.ts";
import { calculateVolumeProfileValueArea } from "./volumeProfileMath.ts";
import { exchangeMidnightMs, exchangeMinuteOfDay } from "./volumeProfileSessions.ts";

export const DEEP_PROFILE_VALUES_SETTINGS_VERSION = 1;

export type DeepProfileValuesSettings = {
  schemaVersion: number;
  periodMode: "composite" | "multiples" | "visible" | "personalized";
  lengthType: "minutes" | "days" | "weeks" | "months" | "volume";
  lengthValue: number;
  customStartMs: number;
  customEndMs: number;
  inputData: "volume" | "order" | "aggregate-trades" | "trades";
  filterMin: number;
  filterMax: number;
  groupingMode: "automatic" | "manual";
  autoGroupFactor: number;
  groupTicks: number;
  numberOfProfiles: number;
  valueAreaPercent: number;
  filterMode: "none" | "filter" | "split";
  sessionStartMinutes: number;
  sessionEndMinutes: number;
  useEndSessionAsStartDay: boolean;
  showPocLine: boolean;
  pocLineMode: "show" | "developing" | "extend-shifted";
  pocExtensionMode: "none" | "until-first-interaction" | "to-window-end";
  developingPocStartMinutes: number;
  shiftedPocTicks: number;
  shiftedPocOpacity: number;
  showValueAreaLines: boolean;
  showDevelopingValueArea: boolean;
  valueAreaExtensionMode: "none" | "until-first-interaction" | "to-window-end";
  showPeaks: boolean;
  showValleys: boolean;
  peakValleySensitivity: number;
  excludeHighLow: boolean;
  peakMinimumVolumePercent: number;
  valleyMaximumVolumePercent: number;
  peakExtensionMode: "none" | "until-first-interaction" | "to-window-end";
  valleyExtensionMode: "none" | "until-first-interaction" | "to-window-end";
  showVwap: boolean;
  showDevelopingVwap: boolean;
  showVwapBands: boolean;
  vwapExtensionMode: "none" | "until-first-interaction" | "to-window-end";
  vwapBand1: number;
  vwapBand2: number;
  vwapBand3: number;
  showSummary: boolean;
  showSummaryTrades: boolean;
  showLevelLabels: boolean;
  showLevelLabelPrice: boolean;
  lineWidth: number;
  pocColor: string;
  valueAreaColor: string;
  peakColor: string;
  valleyColor: string;
  vwapColor: string;
  vwapBandColor: string;
  summaryTextColor: string;
  askColor: string;
  bidColor: string;
  useThemeColors: boolean;
};

export type DeepProfileValuesFrame = {
  status: "LIVE" | "HISTORICAL" | "WAITING_FOR_VOLUME_AT_PRICE" | "WAITING_FOR_ORDER_HISTORY";
  profiles: InstitutionalVolumeProfile[];
};

export const DEFAULT_DEEP_PROFILE_VALUES_SETTINGS: DeepProfileValuesSettings = {
  schemaVersion: DEEP_PROFILE_VALUES_SETTINGS_VERSION,
  periodMode: "multiples",
  lengthType: "days",
  lengthValue: 1,
  customStartMs: 0,
  customEndMs: 0,
  inputData: "volume",
  filterMin: 0,
  filterMax: 0,
  groupingMode: "automatic",
  autoGroupFactor: 1,
  groupTicks: 4,
  numberOfProfiles: 6,
  valueAreaPercent: 68,
  filterMode: "none",
  sessionStartMinutes: 8 * 60 + 30,
  sessionEndMinutes: 15 * 60 + 15,
  useEndSessionAsStartDay: false,
  showPocLine: true,
  pocLineMode: "show",
  pocExtensionMode: "to-window-end",
  developingPocStartMinutes: 0,
  shiftedPocTicks: 1,
  shiftedPocOpacity: 68,
  showValueAreaLines: true,
  showDevelopingValueArea: false,
  valueAreaExtensionMode: "to-window-end",
  showPeaks: false,
  showValleys: false,
  peakValleySensitivity: 40,
  excludeHighLow: true,
  peakMinimumVolumePercent: 0,
  valleyMaximumVolumePercent: 100,
  peakExtensionMode: "none",
  valleyExtensionMode: "none",
  showVwap: true,
  showDevelopingVwap: false,
  showVwapBands: false,
  vwapExtensionMode: "none",
  vwapBand1: 1,
  vwapBand2: 2,
  vwapBand3: 0,
  showSummary: false,
  showSummaryTrades: false,
  showLevelLabels: true,
  showLevelLabelPrice: true,
  lineWidth: 1,
  pocColor: "#F59E0B",
  valueAreaColor: "#22C55E",
  peakColor: "#22C55E",
  valleyColor: "#EF4444",
  vwapColor: "#38BDF8",
  vwapBandColor: "#64748B",
  summaryTextColor: "#E2E8F0",
  askColor: "#22C55E",
  bidColor: "#EF4444",
  useThemeColors: true,
};

const DAY_MS = 86_400_000;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const integer = (value: unknown, fallback: number, low: number, high: number) => Math.round(clamp(finite(value, fallback), low, high));
const enumValue = <T extends string>(value: unknown, choices: readonly T[], fallback: T): T => choices.includes(value as T) ? value as T : fallback;

export function normalizeDeepProfileValuesSettings(input?: Record<string, unknown> | null): DeepProfileValuesSettings {
  const source = input ?? {};
  const result = { ...DEFAULT_DEEP_PROFILE_VALUES_SETTINGS, ...source } as DeepProfileValuesSettings;
  result.schemaVersion = DEEP_PROFILE_VALUES_SETTINGS_VERSION;
  result.periodMode = enumValue(source.periodMode, ["composite", "multiples", "visible", "personalized"], "multiples");
  result.lengthType = enumValue(source.lengthType, ["minutes", "days", "weeks", "months", "volume"], "days");
  result.inputData = enumValue(source.inputData, ["volume", "order", "aggregate-trades", "trades"], "volume");
  result.groupingMode = enumValue(source.groupingMode, ["automatic", "manual"], "automatic");
  result.filterMode = enumValue(source.filterMode, ["none", "filter", "split"], "none");
  result.pocLineMode = enumValue(source.pocLineMode, ["show", "developing", "extend-shifted"], "show");
  result.pocExtensionMode = enumValue(source.pocExtensionMode, ["none", "until-first-interaction", "to-window-end"], "to-window-end");
  result.valueAreaExtensionMode = enumValue(source.valueAreaExtensionMode, ["none", "until-first-interaction", "to-window-end"], "to-window-end");
  result.peakExtensionMode = enumValue(source.peakExtensionMode, ["none", "until-first-interaction", "to-window-end"], "none");
  result.valleyExtensionMode = enumValue(source.valleyExtensionMode, ["none", "until-first-interaction", "to-window-end"], "none");
  result.vwapExtensionMode = enumValue(source.vwapExtensionMode, ["none", "until-first-interaction", "to-window-end"], "none");
  result.lengthValue = integer(source.lengthValue, 1, 1, 1_000_000);
  result.customStartMs = Math.max(0, finite(source.customStartMs, 0));
  result.customEndMs = Math.max(0, finite(source.customEndMs, 0));
  result.filterMin = clamp(finite(source.filterMin, 0), 0, 10_000_000);
  result.filterMax = clamp(finite(source.filterMax, 0), 0, 10_000_000);
  result.autoGroupFactor = clamp(finite(source.autoGroupFactor, 1), 0.5, 4);
  result.groupTicks = integer(source.groupTicks, 4, 1, 500);
  result.numberOfProfiles = integer(source.numberOfProfiles, 6, 1, 250);
  result.valueAreaPercent = clamp(finite(source.valueAreaPercent, 68), 1, 100);
  result.sessionStartMinutes = integer(source.sessionStartMinutes, 510, 0, 1439);
  result.sessionEndMinutes = integer(source.sessionEndMinutes, 915, 0, 1439);
  result.developingPocStartMinutes = integer(source.developingPocStartMinutes, 0, 0, 1439);
  result.shiftedPocTicks = integer(source.shiftedPocTicks, 1, 1, 500);
  result.shiftedPocOpacity = clamp(finite(source.shiftedPocOpacity, 68), 0, 100);
  result.peakValleySensitivity = clamp(finite(source.peakValleySensitivity, 40), 0, 100);
  result.peakMinimumVolumePercent = clamp(finite(source.peakMinimumVolumePercent, 0), 0, 100);
  result.valleyMaximumVolumePercent = clamp(finite(source.valleyMaximumVolumePercent, 100), 0, 100);
  result.vwapBand1 = clamp(finite(source.vwapBand1, 1), 0, 20);
  result.vwapBand2 = clamp(finite(source.vwapBand2, 2), 0, 20);
  result.vwapBand3 = clamp(finite(source.vwapBand3, 0), 0, 20);
  result.lineWidth = clamp(finite(source.lineWidth, 1), 0.5, 6);
  return result;
}

type Range = { start: number; end: number; sessionId?: string; sessionLabel?: string };

function barStart(bar: FootprintBar) {
  return Number.isFinite(bar.startTime) ? bar.startTime : bar.timestamp;
}

function barEnd(bar: FootprintBar) {
  return Number.isFinite(bar.endTime) && bar.endTime > barStart(bar) ? bar.endTime : bar.timestamp + 1;
}

function exchangeWeekStart(timestamp: number) {
  const midnight = exchangeMidnightMs(timestamp);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short" }).format(new Date(timestamp));
  const offset = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[weekday] ?? 0;
  return midnight - offset * DAY_MS;
}

function exchangeMonthKey(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit" }).format(new Date(timestamp));
}

function baseRanges(bars: readonly FootprintBar[], settings: DeepProfileValuesSettings, visible?: { startMs: number; endMs: number } | null): Range[] {
  if (!bars.length) return [];
  if (settings.periodMode === "composite") return [{ start: 0, end: bars.length - 1 }];
  if (settings.periodMode === "visible") {
    if (!visible || !Number.isFinite(visible.startMs) || !Number.isFinite(visible.endMs)) return [];
    const indices = bars.map((bar, index) => ({ bar, index })).filter(({ bar }) => barEnd(bar) > visible.startMs && barStart(bar) < visible.endMs);
    return indices.length ? [{ start: indices[0].index, end: indices.at(-1)!.index }] : [];
  }
  if (settings.periodMode === "personalized") {
    if (!(settings.customEndMs > settings.customStartMs)) return [];
    const indices = bars.map((bar, index) => ({ bar, index })).filter(({ bar }) => barEnd(bar) > settings.customStartMs && barStart(bar) < settings.customEndMs);
    return indices.length ? [{ start: indices[0].index, end: indices.at(-1)!.index }] : [];
  }

  const ranges: Range[] = [];
  if (settings.lengthType === "volume") {
    let start = 0;
    let volume = 0;
    for (let index = 0; index < bars.length; index += 1) {
      volume += Math.max(0, bars[index].totalVolume);
      if (volume >= settings.lengthValue) {
        ranges.push({ start, end: index });
        start = index + 1;
        volume = 0;
      }
    }
    if (start < bars.length) ranges.push({ start, end: bars.length - 1 });
    return ranges;
  }

  const key = (bar: FootprintBar): string | number => {
    const timestamp = barStart(bar);
    if (settings.lengthType === "minutes") return Math.floor(timestamp / (settings.lengthValue * 60_000));
    let periodTimestamp = timestamp;
    // An overnight custom session must remain one period across midnight.
    // Assign its evening and morning halves to either the start or end day,
    // matching DeepCharts' "Use end session as start day" contract.
    if (settings.filterMode !== "none" && settings.sessionEndMinutes <= settings.sessionStartMinutes) {
      const minute = exchangeMinuteOfDay(timestamp);
      if (minute >= settings.sessionStartMinutes && settings.useEndSessionAsStartDay) periodTimestamp += DAY_MS;
      if (minute < settings.sessionEndMinutes && !settings.useEndSessionAsStartDay) periodTimestamp -= DAY_MS;
    }
    if (settings.lengthType === "days") return Math.floor(exchangeMidnightMs(periodTimestamp) / (settings.lengthValue * DAY_MS));
    if (settings.lengthType === "weeks") return Math.floor(exchangeWeekStart(periodTimestamp) / (settings.lengthValue * 7 * DAY_MS));
    const month = exchangeMonthKey(periodTimestamp);
    const [year, monthNumber] = month.split("-").map(Number);
    return Math.floor((year * 12 + monthNumber - 1) / settings.lengthValue);
  };
  let start = 0;
  let previous = key(bars[0]);
  for (let index = 1; index < bars.length; index += 1) {
    const current = key(bars[index]);
    if (current === previous) continue;
    ranges.push({ start, end: index - 1 });
    start = index;
    previous = current;
  }
  ranges.push({ start, end: bars.length - 1 });
  return ranges;
}

function applySessionMode(bars: readonly FootprintBar[], ranges: readonly Range[], settings: DeepProfileValuesSettings): Range[] {
  if (settings.filterMode === "none") return [...ranges];
  const isInside = (bar: FootprintBar) => {
    const minute = exchangeMinuteOfDay(barStart(bar));
    const start = settings.sessionStartMinutes;
    const end = settings.sessionEndMinutes;
    return end > start ? minute >= start && minute < end : minute >= start || minute < end;
  };
  const output: Range[] = [];
  for (const range of ranges) {
    let runStart: number | null = null;
    let runInside: boolean | null = null;
    for (let index = range.start; index <= range.end + 1; index += 1) {
      const inside = index <= range.end ? isInside(bars[index]) : null;
      const accepted = settings.filterMode === "split" || inside === true;
      if (accepted && runStart === null) {
        runStart = index;
        runInside = inside;
      }
      if (runStart !== null && (inside !== runInside || index > range.end)) {
        output.push({
          start: runStart,
          end: index - 1,
          sessionId: settings.filterMode === "split" ? (runInside ? "custom" : "outside") : "custom",
          sessionLabel: settings.filterMode === "split" ? (runInside ? "Session" : "Outside session") : "Session",
        });
        runStart = accepted ? index : null;
        runInside = accepted ? inside : null;
      }
    }
  }
  return output.filter((range) => range.end >= range.start);
}

function groupedTicks(bars: readonly FootprintBar[], range: Range, tickSize: number, settings: DeepProfileValuesSettings) {
  if (settings.groupingMode === "manual") return settings.groupTicks;
  let high = Number.NEGATIVE_INFINITY;
  let low = Number.POSITIVE_INFINITY;
  for (let index = range.start; index <= range.end; index += 1) {
    high = Math.max(high, bars[index].high);
    low = Math.min(low, bars[index].low);
  }
  return Math.max(1, Math.round(settings.autoGroupFactor * Math.max(1, Math.ceil((high - low) / Math.max(tickSize, 1e-9) / 90))));
}

function buildProfile(
  bars: readonly FootprintBar[], range: Range, instrument: string, contractSymbol: string,
  tickSize: number, settings: DeepProfileValuesSettings, trades?: readonly InstitutionalTrade[],
): InstitutionalVolumeProfile | null {
  const startMs = barStart(bars[range.start]);
  const endMs = Math.max(startMs + 1, barEnd(bars[range.end]));
  const groupTicks = groupedTicks(bars, range, tickSize, settings);
  const rows = new Map<number, InstitutionalVolumeProfileLevel>();
  const filteredExecutions = settings.filterMin > 0 || settings.filterMax > 0;
  const acceptedTrades = filteredExecutions && trades?.length
    ? trades
      .filter((trade) => !trade.flowOnly
        && trade.timestamp >= startMs
        && trade.timestamp < endMs
        && trade.volume >= settings.filterMin
        && (settings.filterMax <= 0 || trade.volume <= settings.filterMax))
      .sort((left, right) => left.timestamp - right.timestamp || left.recordIndex - right.recordIndex)
    : [];
  if (filteredExecutions && acceptedTrades.length) {
    for (const trade of acceptedTrades) {
      const groupedTick = Math.floor(Math.round(trade.close / tickSize) / groupTicks) * groupTicks;
      const current = rows.get(groupedTick) ?? { price: groupedTick * tickSize, volume: 0, bidVolume: 0, askVolume: 0, delta: 0, trades: 0 };
      const weight = settings.inputData === "trades" ? Math.max(1, trade.trades) : trade.volume;
      if (trade.aggressor === "BUY") current.askVolume += weight;
      else if (trade.aggressor === "SELL") current.bidVolume += weight;
      current.volume += weight;
      current.trades += Math.max(1, trade.trades);
      current.delta = current.askVolume - current.bidVolume;
      rows.set(groupedTick, current);
    }
  } else if (!filteredExecutions) {
    for (let index = range.start; index <= range.end; index += 1) {
      for (const row of bars[index].rows) {
        const groupedTick = Math.floor(row.tickIndex / groupTicks) * groupTicks;
        const current = rows.get(groupedTick) ?? { price: groupedTick * tickSize, volume: 0, bidVolume: 0, askVolume: 0, delta: 0, trades: 0 };
        const tradesMode = settings.inputData === "trades";
        const bid = tradesMode ? row.bidTrades : row.bidVolume;
        const ask = tradesMode ? row.askTrades : row.askVolume;
        const unknown = tradesMode ? row.unknownTrades : row.unknownVolume;
        current.bidVolume += bid;
        current.askVolume += ask;
        current.volume += bid + ask + unknown;
        current.trades += row.bidTrades + row.askTrades + row.unknownTrades;
        current.delta = current.askVolume - current.bidVolume;
        rows.set(groupedTick, current);
      }
    }
  }
  const levels = [...rows.values()].sort((left, right) => left.price - right.price);
  const totalVolume = levels.reduce((sum, row) => sum + row.volume, 0);
  if (!(totalVolume > 0)) return null;
  const bidVolume = levels.reduce((sum, row) => sum + row.bidVolume, 0);
  const askVolume = levels.reduce((sum, row) => sum + row.askVolume, 0);
  const tradeCount = levels.reduce((sum, row) => sum + row.trades, 0);
  const valueArea = calculateVolumeProfileValueArea(levels, tickSize * groupTicks, settings.valueAreaPercent);
  const weighted = levels.reduce((sum, row) => sum + row.price * row.volume, 0);
  const vwap = weighted / totalVolume;
  const variance = levels.reduce((sum, row) => sum + ((row.price - vwap) ** 2) * row.volume, 0) / totalVolume;

  const developingPoc: Array<{ timestamp: number; price: number }> = [];
  const developingValueArea: Array<{ timestamp: number; vah: number; val: number }> = [];
  const developingVwap: Array<{ timestamp: number; price: number }> = [];
  if (settings.pocLineMode !== "show" || settings.showDevelopingValueArea || settings.showDevelopingVwap) {
    const cumulative = new Map<number, InstitutionalVolumeProfileLevel>();
    let cumulativeVolume = 0;
    let cumulativeWeighted = 0;
    let tradeCursor = 0;
    for (let index = range.start; index <= range.end; index += 1) {
      if (filteredExecutions) {
        const currentBarStart = barStart(bars[index]);
        const currentBarEnd = barEnd(bars[index]);
        while (tradeCursor < acceptedTrades.length && acceptedTrades[tradeCursor].timestamp < currentBarStart) tradeCursor += 1;
        while (tradeCursor < acceptedTrades.length && acceptedTrades[tradeCursor].timestamp < currentBarEnd) {
          const trade = acceptedTrades[tradeCursor];
          const groupedTick = Math.floor(Math.round(trade.close / tickSize) / groupTicks) * groupTicks;
          const current = cumulative.get(groupedTick) ?? { price: groupedTick * tickSize, volume: 0, bidVolume: 0, askVolume: 0, delta: 0, trades: 0 };
          const volume = settings.inputData === "trades" ? Math.max(1, trade.trades) : trade.volume;
          if (trade.aggressor === "BUY") current.askVolume += volume;
          else if (trade.aggressor === "SELL") current.bidVolume += volume;
          current.volume += volume;
          current.delta = current.askVolume - current.bidVolume;
          current.trades += Math.max(1, trade.trades);
          cumulative.set(groupedTick, current);
          cumulativeVolume += volume;
          cumulativeWeighted += current.price * volume;
          tradeCursor += 1;
        }
      } else {
        for (const row of bars[index].rows) {
          const groupedTick = Math.floor(row.tickIndex / groupTicks) * groupTicks;
          const current = cumulative.get(groupedTick) ?? { price: groupedTick * tickSize, volume: 0, bidVolume: 0, askVolume: 0, delta: 0, trades: 0 };
          const tradesMode = settings.inputData === "trades";
          const bid = tradesMode ? row.bidTrades : row.bidVolume;
          const ask = tradesMode ? row.askTrades : row.askVolume;
          const unknown = tradesMode ? row.unknownTrades : row.unknownVolume;
          const volume = bid + ask + unknown;
          current.bidVolume += bid;
          current.askVolume += ask;
          current.volume += volume;
          current.delta = current.askVolume - current.bidVolume;
          current.trades += row.bidTrades + row.askTrades + row.unknownTrades;
          cumulative.set(groupedTick, current);
          cumulativeVolume += volume;
          cumulativeWeighted += current.price * volume;
        }
      }
      const timestamp = Math.max(barStart(bars[index]), bars[index].timestamp);
      const currentLevels = [...cumulative.values()].sort((left, right) => left.price - right.price);
      const currentArea = calculateVolumeProfileValueArea(currentLevels, tickSize * groupTicks, settings.valueAreaPercent);
      if (currentArea.poc !== null) developingPoc.push({ timestamp, price: currentArea.poc });
      if (currentArea.vah !== null && currentArea.val !== null) developingValueArea.push({ timestamp, vah: currentArea.vah, val: currentArea.val });
      if (cumulativeVolume > 0) developingVwap.push({ timestamp, price: cumulativeWeighted / cumulativeVolume });
    }
  }
  return {
    schemaVersion: "kwantify-volume-profile-v1", provider: "Rithmic",
    source: `Rithmic classified executions · Deep Profile Values · ${settings.inputData}`,
    root: instrument, contractSymbol, period: "custom", sessionId: range.sessionId, sessionLabel: range.sessionLabel,
    startMs, endMs, coverageStartMs: startMs, coverageEndMs: endMs,
    complete: range.end < bars.length - 1 ? true : null, tickSize, groupTicks,
    valueAreaPercent: settings.valueAreaPercent, minTradeVolume: settings.filterMin, maxTradeVolume: settings.filterMax,
    totalVolume, bidVolume, askVolume, delta: askVolume - bidVolume, trades: tradeCount,
    poc: valueArea.poc, vah: valueArea.vah, val: valueArea.val, vwap,
    standardDeviation: Math.sqrt(Math.max(0, variance)), levels, developingPoc,
    developingValueArea, developingVwap, asOf: new Date(endMs).toISOString(),
  };
}

export function buildDeepProfileValuesFrame(
  bars: readonly FootprintBar[], instrument: string, contractSymbol: string, tickSize: number,
  input?: Record<string, unknown> | null, trades?: readonly InstitutionalTrade[],
  visibleRange?: { startMs: number; endMs: number } | null,
): DeepProfileValuesFrame {
  const settings = normalizeDeepProfileValuesSettings(input);
  if (settings.inputData === "order") return { status: "WAITING_FOR_ORDER_HISTORY", profiles: [] };
  const exact = bars.filter((bar) => bar.hasPriceLevelFlow && bar.rows.length > 0);
  if (!exact.length) return { status: "WAITING_FOR_VOLUME_AT_PRICE", profiles: [] };
  const ranges = applySessionMode(exact, baseRanges(exact, settings, visibleRange), settings).slice(-settings.numberOfProfiles);
  const profiles = ranges.flatMap((range) => {
    const profile = buildProfile(exact, range, instrument, contractSymbol, tickSize, settings, trades);
    return profile ? [profile] : [];
  });
  if (!profiles.length) return { status: "WAITING_FOR_VOLUME_AT_PRICE", profiles: [] };
  return { status: exact.at(-1)?.isClosed === false ? "LIVE" : "HISTORICAL", profiles };
}
