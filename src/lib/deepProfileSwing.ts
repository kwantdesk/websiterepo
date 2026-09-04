import type { FootprintBar } from "./footprint.ts";
import type { InstitutionalTrade, InstitutionalVolumeProfile, InstitutionalVolumeProfileLevel } from "./institutionalMarketData.ts";
import { calculateVolumeProfileValueArea } from "./volumeProfileMath.ts";

export const DEEP_PROFILE_SWING_SETTINGS_VERSION = 1;

export type SwingDetectionMode = "highest-lowest" | "left-right-bars" | "absolute-reversal" | "reversal-ticks";
export type SwingProfileMode = "volume" | "bid-ask" | "delta" | "delta-volume" | "delta-percentage";

export type DeepProfileSwingSettings = {
  schemaVersion: number;
  profileMode: SwingProfileMode;
  lengthType: "swing" | "vwap";
  includeReversalBar: boolean;
  displayMode: "profile-and-lines" | "lines-only";
  swingType: SwingDetectionMode;
  absoluteReversal: number;
  reversalTicks: number;
  leftBars: number;
  rightBars: number;
  stopSwingEnabled: boolean;
  stopSwingType: SwingDetectionMode;
  stopAbsoluteReversal: number;
  stopReversalTicks: number;
  stopLeftBars: number;
  stopRightBars: number;
  swingMinTicks: number;
  swingMaxTicks: number;
  vwapBreakTicks: number;
  inputData: "volume" | "trades";
  filterMin: number;
  filterMax: number;
  groupingMode: "automatic" | "manual";
  autoGroupFactor: number;
  groupTicks: number;
  valueAreaPercent: number;
  maxProfiles: number;
  profileWidth: number;
  opacity: number;
  showPocLine: boolean;
  showValueAreaLines: boolean;
  showVwapLine: boolean;
  showLevelLabels: boolean;
  volumeColor: string;
  valueAreaColor: string;
  askColor: string;
  bidColor: string;
  pocColor: string;
  vwapColor: string;
  lineWidth: number;
  useThemeColors: boolean;
};

export type DeepProfileSwingFrame = {
  status: "LIVE" | "HISTORICAL" | "WAITING_FOR_VOLUME_AT_PRICE";
  profiles: InstitutionalVolumeProfile[];
};

export const DEFAULT_DEEP_PROFILE_SWING_SETTINGS: DeepProfileSwingSettings = {
  schemaVersion: DEEP_PROFILE_SWING_SETTINGS_VERSION,
  profileMode: "volume",
  lengthType: "swing",
  includeReversalBar: true,
  displayMode: "profile-and-lines",
  swingType: "reversal-ticks",
  absoluteReversal: 10,
  reversalTicks: 20,
  leftBars: 3,
  rightBars: 3,
  stopSwingEnabled: false,
  stopSwingType: "reversal-ticks",
  stopAbsoluteReversal: 5,
  stopReversalTicks: 10,
  stopLeftBars: 2,
  stopRightBars: 2,
  swingMinTicks: 12,
  swingMaxTicks: 240,
  vwapBreakTicks: 8,
  inputData: "volume",
  filterMin: 0,
  filterMax: 0,
  groupingMode: "automatic",
  autoGroupFactor: 1,
  groupTicks: 4,
  valueAreaPercent: 68,
  maxProfiles: 12,
  profileWidth: 34,
  opacity: 68,
  showPocLine: true,
  showValueAreaLines: true,
  showVwapLine: true,
  showLevelLabels: true,
  volumeColor: "#64748B",
  valueAreaColor: "#22C55E",
  askColor: "#22C55E",
  bidColor: "#EF4444",
  pocColor: "#F59E0B",
  vwapColor: "#38BDF8",
  lineWidth: 1,
  useThemeColors: true,
};

const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const integer = (value: unknown, fallback: number, low: number, high: number) => Math.round(clamp(finite(value, fallback), low, high));
const enumValue = <T extends string>(value: unknown, values: readonly T[], fallback: T): T => values.includes(value as T) ? value as T : fallback;

export function normalizeDeepProfileSwingSettings(input?: Record<string, unknown> | null): DeepProfileSwingSettings {
  const source = input ?? {};
  const result = { ...DEFAULT_DEEP_PROFILE_SWING_SETTINGS, ...source } as DeepProfileSwingSettings;
  result.schemaVersion = DEEP_PROFILE_SWING_SETTINGS_VERSION;
  result.profileMode = enumValue(source.profileMode, ["volume", "bid-ask", "delta", "delta-volume", "delta-percentage"], "volume");
  result.lengthType = enumValue(source.lengthType, ["swing", "vwap"], "swing");
  result.displayMode = enumValue(source.displayMode, ["profile-and-lines", "lines-only"], "profile-and-lines");
  result.swingType = enumValue(source.swingType, ["highest-lowest", "left-right-bars", "absolute-reversal", "reversal-ticks"], "reversal-ticks");
  result.stopSwingType = enumValue(source.stopSwingType, ["highest-lowest", "left-right-bars", "absolute-reversal", "reversal-ticks"], "reversal-ticks");
  result.inputData = enumValue(source.inputData, ["volume", "trades"], "volume");
  result.groupingMode = enumValue(source.groupingMode, ["automatic", "manual"], "automatic");
  result.absoluteReversal = clamp(finite(source.absoluteReversal, 10), 0.01, 100_000);
  result.reversalTicks = integer(source.reversalTicks, 20, 1, 100_000);
  result.leftBars = integer(source.leftBars, 3, 1, 500);
  result.rightBars = integer(source.rightBars, 3, 1, 500);
  result.stopAbsoluteReversal = clamp(finite(source.stopAbsoluteReversal, 5), 0.01, 100_000);
  result.stopReversalTicks = integer(source.stopReversalTicks, 10, 1, 100_000);
  result.stopLeftBars = integer(source.stopLeftBars, 2, 1, 500);
  result.stopRightBars = integer(source.stopRightBars, 2, 1, 500);
  result.swingMinTicks = integer(source.swingMinTicks, 12, 1, 100_000);
  result.swingMaxTicks = integer(source.swingMaxTicks, 240, result.swingMinTicks, 1_000_000);
  result.vwapBreakTicks = integer(source.vwapBreakTicks, 8, 1, 100_000);
  result.filterMin = clamp(finite(source.filterMin, 0), 0, 10_000_000);
  result.filterMax = clamp(finite(source.filterMax, 0), 0, 10_000_000);
  result.autoGroupFactor = clamp(finite(source.autoGroupFactor, 1), 0.5, 4);
  result.groupTicks = integer(source.groupTicks, 4, 1, 500);
  result.valueAreaPercent = clamp(finite(source.valueAreaPercent, 68), 1, 100);
  result.maxProfiles = integer(source.maxProfiles, 12, 1, 100);
  result.profileWidth = clamp(finite(source.profileWidth, 34), 1, 100);
  result.opacity = clamp(finite(source.opacity, 68), 0, 100);
  result.lineWidth = clamp(finite(source.lineWidth, 1), 0.5, 6);
  return result;
}

type SwingRange = { start: number; end: number };

function reversalAmount(mode: SwingDetectionMode, absolute: number, ticks: number, tickSize: number) {
  return mode === "absolute-reversal" ? absolute : Math.max(tickSize, ticks * tickSize);
}

/** Confirmed zig-zag ranges. A reversal bar belongs to one side only. */
function reversalRanges(bars: readonly FootprintBar[], threshold: number, includeReversalBar: boolean): SwingRange[] {
  if (bars.length < 2) return bars.length ? [{ start: 0, end: 0 }] : [];
  const ranges: SwingRange[] = [];
  let start = 0;
  let direction: 1 | -1 | 0 = 0;
  let extreme = bars[0].close;
  for (let index = 1; index < bars.length; index += 1) {
    const bar = bars[index];
    if (direction === 0) {
      const change = bar.close - bars[start].close;
      if (Math.abs(change) >= threshold) {
        direction = change > 0 ? 1 : -1;
        extreme = direction > 0 ? bar.high : bar.low;
      }
      continue;
    }
    extreme = direction > 0 ? Math.max(extreme, bar.high) : Math.min(extreme, bar.low);
    const reversed = direction > 0 ? extreme - bar.low >= threshold : bar.high - extreme >= threshold;
    if (!reversed) continue;
    const completedEnd = includeReversalBar ? index : Math.max(start, index - 1);
    ranges.push({ start, end: completedEnd });
    start = includeReversalBar ? index : Math.max(0, index - 1);
    direction = direction > 0 ? -1 : 1;
    extreme = direction > 0 ? bar.high : bar.low;
  }
  ranges.push({ start, end: bars.length - 1 });
  return ranges;
}

function pivotRanges(bars: readonly FootprintBar[], left: number, right: number, includeReversalBar: boolean): SwingRange[] {
  const pivots: number[] = [0];
  for (let index = left; index < bars.length - right; index += 1) {
    const from = index - left;
    const to = index + right;
    let high = true;
    let low = true;
    for (let peer = from; peer <= to; peer += 1) {
      if (peer === index) continue;
      if (bars[peer].high >= bars[index].high) high = false;
      if (bars[peer].low <= bars[index].low) low = false;
    }
    if (high || low) pivots.push(index);
  }
  if (pivots.at(-1) !== bars.length - 1) pivots.push(bars.length - 1);
  return pivots.slice(1).map((end, index) => ({
    start: includeReversalBar ? pivots[index] : Math.min(end, pivots[index] + (index > 0 ? 1 : 0)),
    end,
  })).filter((range) => range.end >= range.start);
}

function highestLowestRanges(bars: readonly FootprintBar[], lookback: number, includeReversalBar: boolean): SwingRange[] {
  const pivots: number[] = [0];
  let lastKind: "high" | "low" | null = null;
  // The DLL exposes a very large numeric ceiling, but a trader can have tens
  // of thousands of event bars loaded. Bound the working window to available
  // history and scan it directly; never allocate two arrays per bar.
  const window = Math.max(1, Math.min(bars.length, Math.round(lookback)));
  for (let index = window; index < bars.length; index += 1) {
    let priorHigh = Number.NEGATIVE_INFINITY;
    let priorLow = Number.POSITIVE_INFINITY;
    for (let peer = index - window; peer < index; peer += 1) {
      priorHigh = Math.max(priorHigh, bars[peer].high);
      priorLow = Math.min(priorLow, bars[peer].low);
    }
    const isHigh = bars[index].high > priorHigh;
    const isLow = bars[index].low < priorLow;
    const kind = isHigh && !isLow ? "high" : isLow && !isHigh ? "low" : null;
    if (kind && lastKind && kind !== lastKind) pivots.push(index);
    if (kind) lastKind = kind;
  }
  if (pivots.at(-1) !== bars.length - 1) pivots.push(bars.length - 1);
  return pivots.slice(1).map((end, index) => ({ start: includeReversalBar ? pivots[index] : Math.min(end, pivots[index] + (index > 0 ? 1 : 0)), end }));
}

function vwapRanges(bars: readonly FootprintBar[], settings: DeepProfileSwingSettings, tickSize: number): SwingRange[] {
  if (!bars.length) return [];
  const ranges: SwingRange[] = [];
  let start = 0;
  let weighted = 0;
  let volume = 0;
  let high = bars[0].high;
  let low = bars[0].low;
  for (let index = 0; index < bars.length; index += 1) {
    const bar = bars[index];
    const weight = Math.max(0, bar.totalVolume);
    weighted += (bar.vwap ?? bar.close) * weight;
    volume += weight;
    high = Math.max(high, bar.high);
    low = Math.min(low, bar.low);
    const vwap = volume > 0 ? weighted / volume : bar.close;
    const travelled = (high - low) / tickSize;
    const breakDistance = Math.abs(bar.close - vwap) / tickSize;
    if (index > start && travelled >= settings.swingMinTicks && (travelled >= settings.swingMaxTicks || breakDistance >= settings.vwapBreakTicks)) {
      ranges.push({ start, end: index });
      start = settings.includeReversalBar ? index : Math.min(index + 1, bars.length - 1);
      weighted = 0;
      volume = 0;
      high = bar.high;
      low = bar.low;
    }
  }
  if (!ranges.length || ranges.at(-1)!.end < bars.length - 1) ranges.push({ start, end: bars.length - 1 });
  return ranges;
}

export function detectDeepProfileSwingRanges(bars: readonly FootprintBar[], settings: DeepProfileSwingSettings, tickSize: number): SwingRange[] {
  if (settings.lengthType === "vwap") return vwapRanges(bars, settings, tickSize);
  if (settings.swingType === "left-right-bars") return pivotRanges(bars, settings.leftBars, settings.rightBars, settings.includeReversalBar);
  if (settings.swingType === "highest-lowest") return highestLowestRanges(bars, settings.reversalTicks, settings.includeReversalBar);
  const threshold = reversalAmount(settings.swingType, settings.absoluteReversal, settings.reversalTicks, tickSize);
  let ranges = reversalRanges(bars, threshold, settings.includeReversalBar);
  if (settings.stopSwingEnabled) {
    const stopThreshold = reversalAmount(settings.stopSwingType, settings.stopAbsoluteReversal, settings.stopReversalTicks, tickSize);
    ranges = ranges.flatMap((range) => {
      const local = bars.slice(range.start, range.end + 1);
      const stops = settings.stopSwingType === "left-right-bars"
        ? pivotRanges(local, settings.stopLeftBars, settings.stopRightBars, settings.includeReversalBar)
        : settings.stopSwingType === "highest-lowest"
          ? highestLowestRanges(local, settings.stopReversalTicks, settings.includeReversalBar)
          : reversalRanges(local, stopThreshold, settings.includeReversalBar);
      return stops.map((stop) => ({ start: range.start + stop.start, end: range.start + stop.end }));
    });
  }
  return ranges;
}

function profileForRange(
  bars: readonly FootprintBar[], range: SwingRange, instrument: string, contractSymbol: string,
  tickSize: number, settings: DeepProfileSwingSettings, trades?: readonly InstitutionalTrade[],
): InstitutionalVolumeProfile | null {
  let rangeHigh = Number.NEGATIVE_INFINITY;
  let rangeLow = Number.POSITIVE_INFINITY;
  for (let index = range.start; index <= range.end; index += 1) {
    rangeHigh = Math.max(rangeHigh, bars[index].high);
    rangeLow = Math.min(rangeLow, bars[index].low);
  }
  const groupTicks = settings.groupingMode === "manual"
    ? settings.groupTicks
    : Math.max(1, Math.round(settings.autoGroupFactor * Math.max(1, Math.ceil((rangeHigh - rangeLow) / tickSize / 90))));
  const rows = new Map<number, InstitutionalVolumeProfileLevel>();
  const filterExecutions = settings.filterMin > 0 || settings.filterMax > 0;
  if (filterExecutions) {
    const startMs = bars[range.start].startTime;
    const endMs = bars[range.end].endTime;
    for (const trade of trades ?? []) {
      if (trade.flowOnly || trade.timestamp < startMs || trade.timestamp >= endMs) continue;
      if (trade.volume < settings.filterMin || (settings.filterMax > 0 && trade.volume > settings.filterMax)) continue;
      const tickIndex = Math.round(trade.close / tickSize);
      const groupedTick = Math.floor(tickIndex / groupTicks) * groupTicks;
      const current = rows.get(groupedTick) ?? { price: groupedTick * tickSize, volume: 0, bidVolume: 0, askVolume: 0, delta: 0, trades: 0 };
      const weight = settings.inputData === "trades" ? Math.max(1, trade.trades) : trade.volume;
      if (trade.aggressor === "BUY") current.askVolume += weight;
      else if (trade.aggressor === "SELL") current.bidVolume += weight;
      current.volume += weight;
      current.delta = current.askVolume - current.bidVolume;
      current.trades += Math.max(1, trade.trades);
      rows.set(groupedTick, current);
    }
  }
  if (!filterExecutions) {
  for (let index = range.start; index <= range.end; index += 1) {
    for (const row of bars[index].rows) {
      const rawValue = settings.inputData === "trades" ? row.bidTrades + row.askTrades + row.unknownTrades : row.totalVolume;
      if (rawValue < settings.filterMin || (settings.filterMax > 0 && rawValue > settings.filterMax)) continue;
      const groupedTick = Math.floor(row.tickIndex / groupTicks) * groupTicks;
      const current = rows.get(groupedTick) ?? { price: groupedTick * tickSize, volume: 0, bidVolume: 0, askVolume: 0, delta: 0, trades: 0 };
      const bid = settings.inputData === "trades" ? row.bidTrades : row.bidVolume;
      const ask = settings.inputData === "trades" ? row.askTrades : row.askVolume;
      const unknown = settings.inputData === "trades" ? row.unknownTrades : row.unknownVolume;
      current.bidVolume += bid;
      current.askVolume += ask;
      current.volume += bid + ask + unknown;
      current.delta = current.askVolume - current.bidVolume;
      current.trades += row.bidTrades + row.askTrades + row.unknownTrades;
      rows.set(groupedTick, current);
    }
  }
  }
  const levels = [...rows.values()].sort((a, b) => a.price - b.price);
  const totalVolume = levels.reduce((sum, row) => sum + row.volume, 0);
  if (!(totalVolume > 0)) return null;
  const bidVolume = levels.reduce((sum, row) => sum + row.bidVolume, 0);
  const askVolume = levels.reduce((sum, row) => sum + row.askVolume, 0);
  const tradeCount = levels.reduce((sum, row) => sum + row.trades, 0);
  const weighted = levels.reduce((sum, row) => sum + row.price * row.volume, 0);
  const vwap = weighted / totalVolume;
  const variance = levels.reduce((sum, row) => sum + ((row.price - vwap) ** 2) * row.volume, 0) / totalVolume;
  const valueArea = calculateVolumeProfileValueArea(levels, tickSize * groupTicks, settings.valueAreaPercent);
  return {
    schemaVersion: "kwantify-volume-profile-v1", provider: "Rithmic",
    source: "Rithmic classified executions · automatic swing", root: instrument, contractSymbol,
    period: "custom", startMs: bars[range.start].startTime, endMs: bars[range.end].endTime,
    coverageStartMs: bars[range.start].startTime, coverageEndMs: bars[range.end].endTime,
    complete: range.end < bars.length - 1 ? true : null, tickSize, groupTicks,
    valueAreaPercent: settings.valueAreaPercent, minTradeVolume: settings.filterMin,
    maxTradeVolume: settings.filterMax, totalVolume, bidVolume, askVolume,
    delta: askVolume - bidVolume, trades: tradeCount, poc: valueArea.poc, vah: valueArea.vah, val: valueArea.val,
    vwap, standardDeviation: Math.sqrt(Math.max(0, variance)), levels, developingPoc: [],
    asOf: new Date(bars[range.end].endTime).toISOString(),
  };
}

export function buildDeepProfileSwingFrame(
  bars: readonly FootprintBar[], instrument: string, contractSymbol: string, tickSize: number,
  input?: Record<string, unknown> | null, trades?: readonly InstitutionalTrade[],
): DeepProfileSwingFrame {
  const settings = normalizeDeepProfileSwingSettings(input);
  const exact = bars.filter((bar) => bar.hasPriceLevelFlow && bar.rows.length > 0);
  if (!exact.length) return { status: "WAITING_FOR_VOLUME_AT_PRICE", profiles: [] };
  const ranges = detectDeepProfileSwingRanges(exact, settings, tickSize).slice(-settings.maxProfiles);
  const profiles = ranges.flatMap((range) => {
    const profile = profileForRange(exact, range, instrument, contractSymbol, tickSize, settings, trades);
    return profile ? [profile] : [];
  });
  if (!profiles.length) return { status: "WAITING_FOR_VOLUME_AT_PRICE", profiles: [] };
  return { status: exact.at(-1)?.isClosed === false ? "LIVE" : "HISTORICAL", profiles };
}
