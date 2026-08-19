import type {
  TpoBar,
  TpoIndicatorSettings,
  TpoPeakValley,
  TpoProfileModel,
  TpoProfileRow,
  TpoSinglePrintZone,
  TpoSubperiod,
  TpoTrade,
} from "@/lib/tpo/types";
import { priceToTick } from "@/lib/tpo/types";

const DAY_MS = 86_400_000;
const WEEK_MS = DAY_MS * 7;
const MARKERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// Allocation-free min/max reducers. TPO source arrays (executions on a 4-6k
// order-flow window) can hold tens of thousands of entries; `Math.max(...arr)`
// spreads every element as a function argument and throws a RangeError past
// V8's argument limit — a real "Aw, Snap" crash vector — besides being slow.
function reduceMax(values: readonly number[], seed = Number.NEGATIVE_INFINITY) {
  let max = seed;
  for (let i = 0; i < values.length; i += 1) if (values[i] > max) max = values[i];
  return max;
}
function reduceMin(values: readonly number[], seed = Number.POSITIVE_INFINITY) {
  let min = seed;
  for (let i = 0; i < values.length; i += 1) if (values[i] < min) min = values[i];
  return min;
}
function mapMax<T>(items: readonly T[], get: (item: T) => number, seed = Number.NEGATIVE_INFINITY) {
  let max = seed;
  for (let i = 0; i < items.length; i += 1) { const v = get(items[i]); if (v > max) max = v; }
  return max;
}
function mapMin<T>(items: readonly T[], get: (item: T) => number, seed = Number.POSITIVE_INFINITY) {
  let min = seed;
  for (let i = 0; i < items.length; i += 1) { const v = get(items[i]); if (v < min) min = v; }
  return min;
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

type MutableRow = {
  rowTick: number;
  lowTick: number;
  highTick: number;
  subperiods: Map<number, MutableCell>;
  volume: number;
  bidVolume: number;
  askVolume: number;
  trades: number;
  hasVolume: boolean;
  hasSide: boolean;
};

type MutableCell = {
  marker: string;
  sessionSegment: number;
  volume: number;
  bidVolume: number;
  askVolume: number;
  trades: number;
  hasVolume: boolean;
  hasSide: boolean;
};

type PeriodBoundary = { startMs: number; endMs: number; id: string };

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const next = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  formatterCache.set(timeZone, next);
  return next;
}

const WEEKDAYS: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export function zonedParts(timestampMs: number, timeZone: string): ZonedParts {
  const parts = Object.fromEntries(
    formatter(timeZone).formatToParts(new Date(timestampMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS[String(parts.weekday)] ?? 0,
  };
}

function zonedDateTimeToUtc(parts: Omit<ZonedParts, "weekday">, timeZone: string) {
  const desired = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  let guess = desired;
  for (let pass = 0; pass < 4; pass += 1) {
    const actual = zonedParts(guess, timeZone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const correction = desired - represented;
    guess += correction;
    if (correction === 0) break;
  }
  return guess;
}

function parseClock(value: string) {
  const [hour = 0, minute = 0, second = 0] = value.split(":").map(Number);
  return { hour, minute, second };
}

function localDateShift(parts: ZonedParts, days: number) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function clockSeconds(value: string) {
  const parsed = parseClock(value);
  return parsed.hour * 3_600 + parsed.minute * 60 + parsed.second;
}

function dateKey(timestampMs: number, timeZone: string) {
  const p = zonedParts(timestampMs, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function dailyBoundary(timestampMs: number, settings: TpoIndicatorSettings): PeriodBoundary {
  const timeZone = settings.timezone;
  const now = zonedParts(timestampMs, timeZone);
  const startClock = parseClock(settings.dailyStartTime);
  const localSeconds = now.hour * 3_600 + now.minute * 60 + now.second;
  let startDate = localDateShift(now, localSeconds < clockSeconds(settings.dailyStartTime) ? -1 : 0);
  let startWeekday = zonedParts(zonedDateTimeToUtc({ ...startDate, ...startClock }, timeZone), timeZone).weekday;
  const enabled = settings.enabledWeekdays.length ? new Set(settings.enabledWeekdays) : new Set([0, 1, 2, 3, 4]);
  for (let safety = 0; safety < 7 && !enabled.has(startWeekday); safety += 1) {
    startDate = localDateShift({ ...now, ...startDate }, -1);
    startWeekday = (startWeekday + 6) % 7;
  }
  const startMs = zonedDateTimeToUtc({ ...startDate, ...startClock }, timeZone);
  let endMs: number;
  if (settings.dailyEndMode === "explicit-time") {
    const endClock = parseClock(settings.dailyEndTime);
    const crossesMidnight = clockSeconds(settings.dailyEndTime) <= clockSeconds(settings.dailyStartTime);
    const endDate = localDateShift({ ...now, ...startDate }, crossesMidnight ? 1 : 0);
    endMs = zonedDateTimeToUtc({ ...endDate, ...endClock }, timeZone);
  } else {
    let nextDate = localDateShift({ ...now, ...startDate }, 1);
    let nextWeekday = (startWeekday + 1) % 7;
    for (let safety = 0; safety < 7 && !enabled.has(nextWeekday); safety += 1) {
      nextDate = localDateShift({ ...now, ...nextDate }, 1);
      nextWeekday = (nextWeekday + 1) % 7;
    }
    endMs = zonedDateTimeToUtc({ ...nextDate, ...startClock }, timeZone);
  }
  return { startMs, endMs, id: `daily:${dateKey(startMs, timeZone)}` };
}

function weeklyBoundary(timestampMs: number, settings: TpoIndicatorSettings): PeriodBoundary {
  const timeZone = settings.timezone;
  const now = zonedParts(timestampMs, timeZone);
  const startClock = parseClock(settings.weekStartTime);
  const dayDelta = (now.weekday - settings.weekStartDay + 7) % 7;
  const beforeStartOnSameDay = dayDelta === 0
    && (now.hour * 3_600 + now.minute * 60 + now.second) < clockSeconds(settings.weekStartTime);
  const startDate = localDateShift(now, -(dayDelta + (beforeStartOnSameDay ? 7 : 0)));
  const startMs = zonedDateTimeToUtc({ ...startDate, ...startClock }, timeZone);
  let endMs: number;
  if (settings.weekEndMode === "explicit-day-time") {
    const endClock = parseClock(settings.weekEndTime);
    let daysForward = (settings.weekEndDay - settings.weekStartDay + 7) % 7;
    if (daysForward === 0 && clockSeconds(settings.weekEndTime) <= clockSeconds(settings.weekStartTime)) daysForward = 7;
    const endDate = localDateShift({ ...now, ...startDate }, daysForward);
    endMs = zonedDateTimeToUtc({ ...endDate, ...endClock }, timeZone);
  } else {
    const endDate = localDateShift({ ...now, ...startDate }, 7 * settings.weekLength);
    endMs = zonedDateTimeToUtc({ ...endDate, ...startClock }, timeZone);
  }
  return { startMs, endMs, id: `weekly:${dateKey(startMs, timeZone)}` };
}

function genericBoundary(timestampMs: number, settings: TpoIndicatorSettings): PeriodBoundary {
  const unitMs = settings.lengthUnit === "minute" ? 60_000
    : settings.lengthUnit === "day" ? DAY_MS
      : settings.lengthUnit === "week" ? WEEK_MS
        : DAY_MS * 30;
  const duration = Math.max(60_000, unitMs * settings.lengthValue);
  const startMs = Math.floor(timestampMs / duration) * duration;
  return { startMs, endMs: startMs + duration, id: `generic:${startMs}` };
}

export function periodBoundaryForTime(timestampMs: number, settings: TpoIndicatorSettings): PeriodBoundary | null {
  if (settings.periodMode === "all-loaded-bars") return null;
  if (settings.scheduleKind === "custom-range" || settings.periodMode === "custom-range") {
    if (settings.customStartMs == null) return null;
    const endMs = settings.customEndFollowsLatest ? Number.POSITIVE_INFINITY : settings.customEndMs;
    return endMs == null || timestampMs < settings.customStartMs || timestampMs >= endMs
      ? null
      : { startMs: settings.customStartMs, endMs, id: `custom:${settings.customStartMs}` };
  }
  if (settings.scheduleKind === "daily") return dailyBoundary(timestampMs, settings);
  if (settings.scheduleKind === "weekly") return weeklyBoundary(timestampMs, settings);
  return genericBoundary(timestampMs, settings);
}

export function markerForSubperiod(index: number) {
  const base = MARKERS[index % MARKERS.length];
  const cycle = Math.floor(index / MARKERS.length);
  return cycle === 0 ? base : `${base}${cycle + 1}`;
}

function groupedRowTick(tick: number, ticksPerRow: number) {
  return Math.floor(tick / ticksPerRow) * ticksPerRow;
}

function chooseTicksPerRow(
  trades: TpoTrade[],
  bars: TpoBar[],
  settings: TpoIndicatorSettings,
) {
  if (settings.groupingMode === "manual") return Math.max(1, Math.round(settings.ticksPerRow));
  const ticks = [
    ...trades.map((trade) => priceToTick(trade.price, trade.tickSize)),
    ...bars.flatMap((bar) => [priceToTick(bar.low, bar.tickSize), priceToTick(bar.high, bar.tickSize)]),
  ];
  if (!ticks.length) return 1;
  const range = reduceMax(ticks) - reduceMin(ticks) + 1;
  return Math.max(1, Math.ceil(range / Math.max(20, settings.autoTargetRows) * settings.autoGroupFactor));
}

function isInsideSession(timestampMs: number, settings: TpoIndicatorSettings) {
  if (settings.filterMode !== "filter" || settings.sessionPreset === "eth") return true;
  const parts = zonedParts(timestampMs, settings.timezone);
  const seconds = parts.hour * 3_600 + parts.minute * 60 + parts.second;
  const start = clockSeconds(settings.sessionPreset === "rth" ? "08:30:00" : settings.customSessionStart);
  const end = clockSeconds(settings.sessionPreset === "rth" ? "15:00:00" : settings.customSessionEnd);
  return start <= end ? seconds >= start && seconds < end : seconds >= start || seconds < end;
}

function hasCompleteExactCoverage(
  period: PeriodBoundary,
  trades: TpoTrade[],
  bars: TpoBar[],
  settings: TpoIndicatorSettings,
  nowMs: number,
) {
  const periodTrades = trades.filter((trade) => trade.timestampMs >= period.startMs && trade.timestampMs < period.endMs);
  if (!periodTrades.length) return false;
  const periodBars = bars.filter((bar) => bar.endTimeMs > period.startMs && bar.startTimeMs < period.endMs);
  if (!periodBars.length) return true;
  const expectedStartMs = Math.max(period.startMs, mapMin(periodBars, (bar) => bar.startTimeMs));
  const expectedEndMs = Math.min(
    Number.isFinite(period.endMs) ? period.endMs : nowMs + 1,
    mapMax(periodBars, (bar) => bar.endTimeMs),
  );
  const firstTradeMs = mapMin(periodTrades, (trade) => trade.timestampMs);
  const lastTradeMs = mapMax(periodTrades, (trade) => trade.timestampMs);
  const toleranceMs = Math.max(60_000, settings.subperiodMinutes * 60_000);
  return firstTradeMs <= expectedStartMs + toleranceMs && lastTradeMs >= expectedEndMs - toleranceMs;
}

function sessionSegment(timestampMs: number, settings: TpoIndicatorSettings) {
  if (settings.filterMode !== "split-two" && settings.filterMode !== "split-three") return 0;
  const parts = zonedParts(timestampMs, settings.timezone);
  const seconds = parts.hour * 3_600 + parts.minute * 60 + parts.second;
  const rthStart = clockSeconds("08:30:00");
  const rthEnd = clockSeconds("15:00:00");
  if (settings.filterMode === "split-two") return seconds >= rthStart && seconds < rthEnd ? 1 : 0;
  if (seconds >= rthStart && seconds < rthEnd) return 2;
  return seconds >= clockSeconds("02:00:00") && seconds < rthStart ? 1 : 0;
}

function getOrCreateRow(rows: Map<number, MutableRow>, rowTick: number, ticksPerRow: number) {
  const existing = rows.get(rowTick);
  if (existing) return existing;
  const row: MutableRow = {
    rowTick,
    lowTick: rowTick,
    highTick: rowTick + ticksPerRow - 1,
    subperiods: new Map(),
    volume: 0,
    bidVolume: 0,
    askVolume: 0,
    trades: 0,
    hasVolume: false,
    hasSide: false,
  };
  rows.set(rowTick, row);
  return row;
}

function getOrCreateCell(row: MutableRow, subperiodIndex: number, marker: string) {
  const existing = row.subperiods.get(subperiodIndex);
  if (existing) return existing;
  const cell: MutableCell = {
    marker,
    sessionSegment: 0,
    volume: 0,
    bidVolume: 0,
    askVolume: 0,
    trades: 0,
    hasVolume: false,
    hasSide: false,
  };
  row.subperiods.set(subperiodIndex, cell);
  return cell;
}

function profileRows(rows: Map<number, MutableRow>) {
  return [...rows.values()].sort((left, right) => left.rowTick - right.rowTick).map((row): TpoProfileRow => {
    const visits = [...row.subperiods.entries()].sort((left, right) => left[0] - right[0]);
    const cells = visits.map(([subperiodIndex, cell]) => ({
      subperiodIndex,
      marker: cell.marker,
      sessionSegment: cell.sessionSegment,
      volume: cell.hasVolume ? cell.volume : null,
      bidVolume: cell.hasSide ? cell.bidVolume : null,
      askVolume: cell.hasSide ? cell.askVolume : null,
      delta: cell.hasSide ? cell.askVolume - cell.bidVolume : null,
      trades: cell.hasVolume ? cell.trades : null,
    }));
    return {
      rowTick: row.rowTick,
      lowTick: row.lowTick,
      highTick: row.highTick,
      subperiodIds: visits.map(([index]) => String(index)),
      subperiodIndexes: visits.map(([index]) => index),
      markers: visits.map(([, cell]) => cell.marker),
      cells,
      tpoCount: visits.length,
      volume: row.hasVolume ? row.volume : null,
      bidVolume: row.hasSide ? row.bidVolume : null,
      askVolume: row.hasSide ? row.askVolume : null,
      delta: row.hasSide ? row.askVolume - row.bidVolume : null,
      trades: row.hasVolume ? row.trades : null,
    };
  });
}

export function calculateTpoPoc(rows: TpoProfileRow[], closeTick: number | null) {
  if (!rows.length) return null;
  const maxCount = mapMax(rows, (row) => row.tpoCount);
  const candidates = rows.filter((row) => row.tpoCount === maxCount);
  if (candidates.length === 1) return (candidates[0].lowTick + candidates[0].highTick) / 2;
  const midpoint = (rows[0].lowTick + rows[rows.length - 1].highTick) / 2;
  const selected = [...candidates].sort((left, right) => {
    const leftCentre = (left.lowTick + left.highTick) / 2;
    const rightCentre = (right.lowTick + right.highTick) / 2;
    const midpointDifference = Math.abs(leftCentre - midpoint) - Math.abs(rightCentre - midpoint);
    if (midpointDifference !== 0) return midpointDifference;
    if (closeTick !== null) {
      const closeDifference = Math.abs(leftCentre - closeTick) - Math.abs(rightCentre - closeTick);
      if (closeDifference !== 0) return closeDifference;
    }
    return left.rowTick - right.rowTick;
  })[0];
  return (selected.lowTick + selected.highTick) / 2;
}

export function calculateTpoValueArea(
  rows: TpoProfileRow[],
  pocTick: number | null,
  percentage: number,
) {
  if (!rows.length || pocTick === null) return { vahTick: null, valTick: null };
  const pocIndex = rows.findIndex((row) => pocTick >= row.lowTick && pocTick <= row.highTick);
  if (pocIndex < 0) return { vahTick: null, valTick: null };
  const target = rows.reduce((sum, row) => sum + row.tpoCount, 0) * Math.min(100, Math.max(1, percentage)) / 100;
  let included = rows[pocIndex].tpoCount;
  let low = pocIndex;
  let high = pocIndex;
  while (included < target && (low > 0 || high < rows.length - 1)) {
    const below = low > 0 ? rows[low - 1].tpoCount : Number.NEGATIVE_INFINITY;
    const above = high < rows.length - 1 ? rows[high + 1].tpoCount : Number.NEGATIVE_INFINITY;
    if (below === above) {
      if (low > 0) { low -= 1; included += rows[low].tpoCount; }
      if (high < rows.length - 1) { high += 1; included += rows[high].tpoCount; }
    } else if (above > below) {
      high += 1;
      included += rows[high].tpoCount;
    } else {
      low -= 1;
      included += rows[low].tpoCount;
    }
  }
  return { vahTick: rows[high].highTick, valTick: rows[low].lowTick };
}

export function detectSinglePrints(
  rows: TpoProfileRow[],
  minimumTicks: number,
  includeExtremes: boolean,
  quality = 0,
) {
  const result: TpoSinglePrintZone[] = [];
  let start: TpoProfileRow | null = null;
  let previous: TpoProfileRow | null = null;
  const flush = () => {
    if (!start || !previous) return;
    const length = previous.highTick - start.lowTick + 1;
    const atExtreme = start === rows[0] || previous === rows.at(-1);
    if (length >= minimumTicks && (includeExtremes || !atExtreme)) {
      result.push({ lowTick: start.lowTick, highTick: previous.highTick, tested: false });
    }
    start = null;
    previous = null;
  };
  rows.forEach((row) => {
    if (row.tpoCount !== 1 || (previous && row.lowTick > previous.highTick + 1)) flush();
    if (row.tpoCount === 1) {
      if (!start) start = row;
      previous = row;
    }
  });
  flush();
  // The quality filter ranks zones by tick height: 0 keeps every single
  // print, 100 keeps only the tallest one, in between keeps the top share.
  if (quality > 0 && result.length > 1) {
    const keep = Math.max(1, Math.round(result.length * (1 - quality / 100)));
    const threshold = [...result]
      .sort((a, b) => (b.highTick - b.lowTick) - (a.highTick - a.lowTick))
      .slice(0, keep);
    const kept = new Set(threshold);
    return result.filter((zone) => kept.has(zone));
  }
  return result;
}

export function detectPeaksValleys(rows: TpoProfileRow[], radius: number, prominence: number) {
  const result: TpoPeakValley[] = [];
  for (let index = 1; index < rows.length - 1; index += 1) {
    const value = rows[index].tpoCount;
    let plateauEnd = index;
    while (plateauEnd + 1 < rows.length && rows[plateauEnd + 1].tpoCount === value) plateauEnd += 1;
    const left = rows.slice(Math.max(0, index - radius), index).map((row) => row.tpoCount);
    const right = rows.slice(plateauEnd + 1, Math.min(rows.length, plateauEnd + radius + 1)).map((row) => row.tpoCount);
    if (left.length && right.length) {
      const centre = rows[Math.floor((index + plateauEnd) / 2)];
      const peakFloor = Math.max(Math.min(...left), Math.min(...right));
      const valleyCeiling = Math.min(Math.max(...left), Math.max(...right));
      if (left.every((candidate) => value > candidate) && right.every((candidate) => value > candidate) && value - peakFloor >= prominence) {
        result.push({ kind: "peak", rowTick: centre.rowTick, value });
      } else if (left.every((candidate) => value < candidate) && right.every((candidate) => value < candidate) && valleyCeiling - value >= prominence) {
        result.push({ kind: "valley", rowTick: centre.rowTick, value });
      }
    }
    index = plateauEnd;
  }
  return result;
}

function buildOneProfile(
  period: PeriodBoundary,
  trades: TpoTrade[],
  bars: TpoBar[],
  settings: TpoIndicatorSettings,
  source: "exact-trades" | "bar-range",
  nowMs: number,
  ticksPerRowOverride?: number,
): TpoProfileModel | null {
  const periodTrades = trades.filter((trade) => trade.timestampMs >= period.startMs && trade.timestampMs < period.endMs && isInsideSession(trade.timestampMs, settings));
  const periodBars = bars.filter((bar) => bar.endTimeMs > period.startMs && bar.startTimeMs < period.endMs && isInsideSession(bar.startTimeMs, settings));
  if (!periodTrades.length && !periodBars.length) return null;
  const latestSourceMs = Math.max(
    mapMax(periodTrades, (trade) => trade.timestampMs + 1, period.startMs + 1),
    mapMax(periodBars, (bar) => bar.endTimeMs, period.startMs + 1),
  );
  const effectiveEndMs = Number.isFinite(period.endMs)
    ? period.endMs
    : Math.max(nowMs + 1, latestSourceMs);
  const tickSize = periodTrades[0]?.tickSize ?? periodBars[0]?.tickSize ?? 0.25;
  const ticksPerRow = ticksPerRowOverride == null
    ? chooseTicksPerRow(periodTrades, periodBars, settings)
    : Math.max(1, Math.round(ticksPerRowOverride));
  const rows = new Map<number, MutableRow>();
  const subperiodMap = new Map<number, TpoSubperiod>();
  const subperiodMs = settings.subperiodMinutes * 60_000;
  let closeTick: number | null = null;
  const subperiod = (timestampMs: number) => {
    const index = Math.max(0, Math.floor((timestampMs - period.startMs) / subperiodMs));
    const existing = subperiodMap.get(index);
    if (existing) return existing;
    const created: TpoSubperiod = {
      id: `${period.id}:${index}`,
      profileId: period.id,
      index,
      startTimeMs: period.startMs + index * subperiodMs,
      endTimeMs: Math.min(effectiveEndMs, period.startMs + (index + 1) * subperiodMs),
      marker: markerForSubperiod(index),
      sessionSegment: sessionSegment(timestampMs, settings),
      openTick: null,
      highTick: null,
      lowTick: null,
      closeTick: null,
    };
    subperiodMap.set(index, created);
    return created;
  };
  if (source === "exact-trades") {
    periodTrades.sort((left, right) => left.timestampMs - right.timestampMs).forEach((trade) => {
      const current = subperiod(trade.timestampMs);
      const tick = priceToTick(trade.price, tickSize);
      current.openTick ??= tick;
      current.highTick = current.highTick === null ? tick : Math.max(current.highTick, tick);
      current.lowTick = current.lowTick === null ? tick : Math.min(current.lowTick, tick);
      current.closeTick = tick;
      closeTick = tick;
      const row = getOrCreateRow(rows, groupedRowTick(tick, ticksPerRow), ticksPerRow);
      const cell = getOrCreateCell(row, current.index, current.marker);
      cell.sessionSegment = current.sessionSegment;
      row.volume += trade.size;
      row.trades += 1;
      row.hasVolume = true;
      cell.volume += trade.size;
      cell.trades += 1;
      cell.hasVolume = true;
      if (trade.aggressorSide === "buy") {
        row.askVolume += trade.size; row.hasSide = true;
        cell.askVolume += trade.size; cell.hasSide = true;
      }
      if (trade.aggressorSide === "sell") {
        row.bidVolume += trade.size; row.hasSide = true;
        cell.bidVolume += trade.size; cell.hasSide = true;
      }
    });
  } else {
    periodBars.sort((left, right) => left.startTimeMs - right.startTimeMs).forEach((bar) => {
      const current = subperiod(Math.max(period.startMs, bar.startTimeMs));
      const openTick = priceToTick(bar.open, tickSize);
      const highTick = priceToTick(bar.high, tickSize);
      const lowTick = priceToTick(bar.low, tickSize);
      const barCloseTick = priceToTick(bar.close, tickSize);
      current.openTick ??= openTick;
      current.highTick = current.highTick === null ? highTick : Math.max(current.highTick, highTick);
      current.lowTick = current.lowTick === null ? lowTick : Math.min(current.lowTick, lowTick);
      current.closeTick = barCloseTick;
      closeTick = barCloseTick;
      const firstRow = groupedRowTick(lowTick, ticksPerRow);
      const lastRow = groupedRowTick(highTick, ticksPerRow);
      const rowCount = Math.max(1, Math.floor((lastRow - firstRow) / ticksPerRow) + 1);
      for (let rowTick = firstRow; rowTick <= lastRow; rowTick += ticksPerRow) {
        const row = getOrCreateRow(rows, rowTick, ticksPerRow);
        const cell = getOrCreateCell(row, current.index, current.marker);
        cell.sessionSegment = current.sessionSegment;
        if (bar.volume != null) {
          row.volume += bar.volume / rowCount;
          row.trades += (bar.tradeCount ?? 0) / rowCount;
          row.hasVolume = true;
          cell.volume += bar.volume / rowCount;
          cell.trades += (bar.tradeCount ?? 0) / rowCount;
          cell.hasVolume = true;
        }
        if (bar.bidVolume != null || bar.askVolume != null) {
          row.bidVolume += (bar.bidVolume ?? 0) / rowCount;
          row.askVolume += (bar.askVolume ?? 0) / rowCount;
          row.hasSide = true;
          cell.bidVolume += (bar.bidVolume ?? 0) / rowCount;
          cell.askVolume += (bar.askVolume ?? 0) / rowCount;
          cell.hasSide = true;
        }
      }
    });
  }
  const finalRows = profileRows(rows);
  const pocTick = calculateTpoPoc(finalRows, closeTick);
  const { vahTick, valTick } = calculateTpoValueArea(finalRows, pocTick, settings.valueAreaPercent);
  const subperiods = [...subperiodMap.values()].sort((left, right) => left.index - right.index);
  const ibSubperiods = new Set(subperiods
    .slice(settings.initialBalanceStartSubperiod, settings.initialBalanceStartSubperiod + settings.initialBalanceSubperiods)
    .map((item) => item.index));
  const ibRows = finalRows.filter((row) => row.subperiodIndexes.some((index) => ibSubperiods.has(index)));
  const lowerGranularity = source === "bar-range" && periodBars.some((bar) => bar.endTimeMs - bar.startTimeMs > subperiodMs);
  const total = (key: "volume" | "trades" | "bidVolume" | "askVolume") => {
    const values = finalRows.map((row) => row[key]).filter((value): value is number => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  };
  const developingPoc: Array<{ timeMs: number; tick: number }> = [];
  const developingVah: Array<{ timeMs: number; tick: number }> = [];
  const developingVal: Array<{ timeMs: number; tick: number }> = [];
  // Developing POC/VA per subperiod. The naive version cloned every price-row
  // (cells + marker arrays and all) for every subperiod — O(subperiods×rows)
  // full-object allocations per rebuild, and this whole profile rebuilds on
  // every live sample. Instead keep a running per-row TPO count advanced by a
  // pointer (both subperiods and each row's subperiodIndexes are ascending) and
  // build only the three numeric fields the POC/VA math actually reads.
  const developingRows = finalRows.map((row) => ({
    rowTick: row.rowTick,
    lowTick: row.lowTick,
    highTick: row.highTick,
    indexes: row.subperiodIndexes,
    ptr: 0,
    count: 0,
  }));
  subperiods.forEach((current) => {
    const partial: TpoProfileRow[] = [];
    for (const developingRow of developingRows) {
      while (developingRow.ptr < developingRow.indexes.length
        && developingRow.indexes[developingRow.ptr] <= current.index) {
        developingRow.ptr += 1;
        developingRow.count += 1;
      }
      if (developingRow.count > 0) {
        partial.push({
          rowTick: developingRow.rowTick,
          lowTick: developingRow.lowTick,
          highTick: developingRow.highTick,
          tpoCount: developingRow.count,
        } as TpoProfileRow);
      }
    }
    const partialPoc = calculateTpoPoc(partial, current.closeTick);
    const partialVa = calculateTpoValueArea(partial, partialPoc, settings.valueAreaPercent);
    if (partialPoc !== null) developingPoc.push({ timeMs: current.endTimeMs, tick: partialPoc });
    if (partialVa.vahTick !== null) developingVah.push({ timeMs: current.endTimeMs, tick: partialVa.vahTick });
    if (partialVa.valTick !== null) developingVal.push({ timeMs: current.endTimeMs, tick: partialVa.valTick });
  });
  const bidVolume = total("bidVolume");
  const askVolume = total("askVolume");
  const firstInteraction = (lowTick: number | null, highTick: number | null) => {
    if (lowTick === null || highTick === null || !Number.isFinite(period.endMs)) return null;
    const tradeTouch = trades
      .filter((trade) => trade.timestampMs >= effectiveEndMs)
      .find((trade) => {
        const tick = priceToTick(trade.price, tickSize);
        return tick >= lowTick && tick <= highTick;
      })?.timestampMs ?? null;
    const barTouch = bars
      .filter((bar) => bar.endTimeMs > effectiveEndMs)
      .find((bar) => {
        const low = priceToTick(bar.low, tickSize);
        const high = priceToTick(bar.high, tickSize);
        return high >= lowTick && low <= highTick;
      })?.startTimeMs ?? null;
    if (tradeTouch === null) return barTouch;
    if (barTouch === null) return tradeTouch;
    return Math.min(tradeTouch, barTouch);
  };
  const singlePrints = detectSinglePrints(finalRows, settings.minimumSinglePrintTicks, settings.includeExtremesInSinglePrints, settings.singlePrintQuality)
    .map((zone) => {
      const firstInteractionMs = firstInteraction(zone.lowTick, zone.highTick);
      return { ...zone, tested: firstInteractionMs !== null, firstInteractionMs };
    });
  return {
    id: period.id,
    instrumentId: periodTrades[0]?.instrumentId ?? periodBars[0]?.instrumentId ?? "UNKNOWN",
    startTimeMs: period.startMs,
    endTimeMs: effectiveEndMs,
    developing: nowMs >= period.startMs && (nowMs < period.endMs || !Number.isFinite(period.endMs)),
    source,
    lowerGranularity,
    tickSize,
    ticksPerRow,
    rows: finalRows,
    subperiods,
    totalTpos: finalRows.reduce((sum, row) => sum + row.tpoCount, 0),
    profileHighTick: finalRows.at(-1)?.highTick ?? null,
    profileLowTick: finalRows[0]?.lowTick ?? null,
    closeTick,
    pocTick,
    vahTick,
    valTick,
    pocFirstInteractionMs: firstInteraction(pocTick, pocTick),
    vahFirstInteractionMs: firstInteraction(vahTick, vahTick),
    valFirstInteractionMs: firstInteraction(valTick, valTick),
    developingPoc,
    developingVah,
    developingVal,
    initialBalanceHighTick: ibRows.at(-1)?.highTick ?? null,
    initialBalanceLowTick: ibRows[0]?.lowTick ?? null,
    singlePrints,
    peaksValleys: detectPeaksValleys(finalRows, settings.peakValleyRadius, settings.peakMinimumProminence),
    totalVolume: total("volume"),
    totalTrades: total("trades"),
    bidVolume,
    askVolume,
    delta: bidVolume !== null && askVolume !== null ? askVolume - bidVolume : null,
  } satisfies TpoProfileModel;
}

export function buildTpoProfiles({
  trades,
  bars,
  settings,
  nowMs = Date.now(),
}: {
  trades: TpoTrade[];
  bars: TpoBar[];
  settings: TpoIndicatorSettings;
  nowMs?: number;
}) {
  const exactAvailable = trades.some((trade) => Number.isFinite(trade.price) && trade.size > 0);
  const preferredSource: "exact-trades" | "bar-range" = settings.visitSource === "bar-range"
    ? "bar-range"
    : settings.visitSource === "exact-trades"
      ? "exact-trades"
      : exactAvailable ? "exact-trades" : "bar-range";
  if (settings.visitSource === "exact-trades" && !exactAvailable) return [];
  const timestamps = settings.visitSource === "exact-trades"
    ? trades.map((trade) => trade.timestampMs)
    : settings.visitSource === "bar-range"
      ? bars.map((bar) => bar.startTimeMs)
      : [...trades.map((trade) => trade.timestampMs), ...bars.map((bar) => bar.startTimeMs)];
  if (!timestamps.length) return [];
  if (settings.periodMode === "all-loaded-bars") {
    const startMs = reduceMin(timestamps);
    const endMs = mapMax(timestamps, (timestamp) => timestamp + 1, nowMs + 1);
    const profile = buildOneProfile({ startMs, endMs, id: `loaded:${startMs}` }, trades, bars, settings, preferredSource, nowMs);
    return profile ? [profile] : [];
  }
  const periods = new Map<string, PeriodBoundary>();
  timestamps.forEach((timestamp) => {
    const period = periodBoundaryForTime(timestamp, settings);
    if (period) periods.set(period.id, period);
  });
  const orderedPeriods = [...periods.values()]
    .sort((left, right) => left.startMs - right.startMs)
    .slice(-settings.profileCount);
  const profiles: TpoProfileModel[] = [];
  orderedPeriods.forEach((period) => {
    const periodHasExactTrades = hasCompleteExactCoverage(period, trades, bars, settings, nowMs);
    const source = settings.visitSource === "automatic"
      ? periodHasExactTrades ? "exact-trades" as const : "bar-range" as const
      : preferredSource;
    // When grouping is frozen, every displayed profile uses one price-row
    // resolution. This prevents a single low-range or developing session from
    // switching to visually larger rows than all adjacent TPO profiles.
    const frozenTicksPerRow = settings.freezeActiveGrouping
      ? profiles.at(0)?.ticksPerRow
      : undefined;
    const profile = buildOneProfile(period, trades, bars, settings, source, nowMs, frozenTicksPerRow);
    if (profile) profiles.push(profile);
  });
  return profiles;
}

export function mergeTpoProfileModels(
  profiles: TpoProfileModel[],
  anchorProfileId: string,
  settings: TpoIndicatorSettings,
) {
  if (!profiles.length) return null;
  const ordered = [...profiles].sort((left, right) => left.startTimeMs - right.startTimeMs);
  if (new Set(ordered.map((profile) => profile.instrumentId)).size !== 1) return null;
  if (new Set(ordered.map((profile) => profile.tickSize)).size !== 1) return null;
  const anchor = ordered.find((profile) => profile.id === anchorProfileId) ?? ordered.at(-1)!;
  const ticksPerRow = anchor.ticksPerRow;
  const rows = new Map<number, MutableRow>();
  let subperiodOffset = 0;
  const subperiods: TpoSubperiod[] = [];
  ordered.forEach((profile) => {
    profile.subperiods.forEach((subperiod) => {
      subperiods.push({ ...subperiod, index: subperiod.index + subperiodOffset, marker: markerForSubperiod(subperiod.index + subperiodOffset) });
    });
    profile.rows.forEach((sourceRow) => {
      const targetTick = groupedRowTick(sourceRow.rowTick, ticksPerRow);
      const target = getOrCreateRow(rows, targetTick, ticksPerRow);
      sourceRow.cells.forEach((sourceCell) => {
        const targetIndex = sourceCell.subperiodIndex + subperiodOffset;
        const cell = getOrCreateCell(target, targetIndex, markerForSubperiod(targetIndex));
        cell.sessionSegment = sourceCell.sessionSegment;
        if (sourceCell.volume !== null) { cell.volume += sourceCell.volume; cell.hasVolume = true; }
        if (sourceCell.trades !== null) cell.trades += sourceCell.trades;
        if (sourceCell.bidVolume !== null || sourceCell.askVolume !== null) {
          cell.bidVolume += sourceCell.bidVolume ?? 0;
          cell.askVolume += sourceCell.askVolume ?? 0;
          cell.hasSide = true;
        }
      });
      if (sourceRow.volume !== null) { target.volume += sourceRow.volume; target.hasVolume = true; }
      if (sourceRow.trades !== null) target.trades += sourceRow.trades;
      if (sourceRow.bidVolume !== null || sourceRow.askVolume !== null) {
        target.bidVolume += sourceRow.bidVolume ?? 0;
        target.askVolume += sourceRow.askVolume ?? 0;
        target.hasSide = true;
      }
    });
    subperiodOffset += profile.subperiods.length;
  });
  const finalRows = profileRows(rows);
  const closeTick = ordered.at(-1)?.closeTick ?? null;
  const pocTick = calculateTpoPoc(finalRows, closeTick);
  const valueArea = calculateTpoValueArea(finalRows, pocTick, settings.valueAreaPercent);
  const bidVolume = finalRows.reduce((sum, row) => sum + (row.bidVolume ?? 0), 0);
  const askVolume = finalRows.reduce((sum, row) => sum + (row.askVolume ?? 0), 0);
  return {
    ...anchor,
    id: `composite:${ordered.map((profile) => profile.id).join("|")}`,
    startTimeMs: ordered[0].startTimeMs,
    endTimeMs: ordered.at(-1)!.endTimeMs,
    developing: ordered.some((profile) => profile.developing),
    source: ordered.every((profile) => profile.source === "exact-trades") ? "exact-trades" : "bar-range",
    lowerGranularity: ordered.some((profile) => profile.lowerGranularity),
    ticksPerRow,
    rows: finalRows,
    subperiods,
    totalTpos: finalRows.reduce((sum, row) => sum + row.tpoCount, 0),
    profileHighTick: finalRows.at(-1)?.highTick ?? null,
    profileLowTick: finalRows[0]?.lowTick ?? null,
    closeTick,
    pocTick,
    vahTick: valueArea.vahTick,
    valTick: valueArea.valTick,
    singlePrints: detectSinglePrints(finalRows, settings.minimumSinglePrintTicks, settings.includeExtremesInSinglePrints, settings.singlePrintQuality),
    peaksValleys: detectPeaksValleys(finalRows, settings.peakValleyRadius, settings.peakMinimumProminence),
    totalVolume: finalRows.some((row) => row.volume !== null) ? finalRows.reduce((sum, row) => sum + (row.volume ?? 0), 0) : null,
    totalTrades: finalRows.some((row) => row.trades !== null) ? finalRows.reduce((sum, row) => sum + (row.trades ?? 0), 0) : null,
    bidVolume: finalRows.some((row) => row.bidVolume !== null) ? bidVolume : null,
    askVolume: finalRows.some((row) => row.askVolume !== null) ? askVolume : null,
    delta: finalRows.some((row) => row.bidVolume !== null || row.askVolume !== null) ? askVolume - bidVolume : null,
    memberProfileIds: ordered.map((profile) => profile.id),
    anchorProfileId: anchor.id,
  } satisfies TpoProfileModel;
}
