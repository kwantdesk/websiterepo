import type { Candle } from "@/lib/backtester";

export type MarketSessionDefinition = {
  key: "tokyo" | "london" | "newYork" | "sydney";
  label: string;
  timezone: string;
  start: string;
  end: string;
  color: string;
};

export type MarketSessionWindow = MarketSessionDefinition & {
  startTimestamp: number;
  endTimestamp: number;
  highTimestamp: number;
  lowTimestamp: number;
  open: number;
  close: number;
  high: number;
  low: number;
};

export type PreviousSessionHighLowLevel = {
  id: string;
  rank: 1 | 2 | 3;
  side: "high" | "low";
  session: MarketSessionWindow;
  price: number;
  startTimestamp: number;
  label: string;
};

export const INITIAL_BALANCE_DURATIONS = [15, 30, 45, 60] as const;
export type InitialBalanceDuration = (typeof INITIAL_BALANCE_DURATIONS)[number];

export type InitialBalanceLevel = {
  id: string;
  side: "high" | "low";
  session: MarketSessionWindow;
  price: number;
  startTimestamp: number;
  endTimestamp: number;
  formationEndTimestamp: number;
  durationMinutes: InitialBalanceDuration;
  developing: boolean;
  label: string;
};

export const DEFAULT_MARKET_SESSIONS: MarketSessionDefinition[] = [
  { key: "tokyo", label: "Tokyo", timezone: "Asia/Tokyo", start: "09:00", end: "18:00", color: "#FF9900" },
  { key: "london", label: "London", timezone: "Europe/London", start: "08:00", end: "17:00", color: "#4CAF50" },
  { key: "newYork", label: "New York", timezone: "America/New_York", start: "09:00", end: "18:00", color: "#2196F3" },
  { key: "sydney", label: "Sydney", timezone: "Australia/Sydney", start: "08:00", end: "17:00", color: "#A461BB" },
];

type SessionSettings = Record<string, number | string | boolean>;
const zonedFormatters = new Map<string, Intl.DateTimeFormat>();

function zonedParts(timestamp: number, timezone: string) {
  let formatter = zonedFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    zonedFormatters.set(timezone, formatter);
  }
  const parts = Object.fromEntries(
    formatter.formatToParts(timestamp).map((part) => [part.type, part.value]),
  );
  return {
    weekday: parts.weekday,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function parseClock(value: unknown, fallback: string) {
  const candidate = typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : fallback;
  const [hour, minute] = candidate.split(":").map(Number);
  return Math.min(1_439, Math.max(0, hour * 60 + minute));
}

function inClockRange(minute: number, start: number, end: number) {
  return start === end
    ? true
    : start < end
      ? minute >= start && minute < end
      : minute >= start || minute < end;
}

export function resolveMarketSessions(settings: SessionSettings) {
  return DEFAULT_MARKET_SESSIONS.map((session) => ({
    ...session,
    label: String(settings[`${session.key}Label`] ?? session.label),
    start: String(settings[`${session.key}Start`] ?? session.start),
    end: String(settings[`${session.key}End`] ?? session.end),
    color: String(settings[`${session.key}Color`] ?? session.color),
  })).filter((session) =>
    settings[`show${session.key[0].toUpperCase()}${session.key.slice(1)}`] !== false);
}

export function buildMarketSessionWindows(
  candles: Candle[],
  settings: SessionSettings,
  intervalMs = 60_000,
): MarketSessionWindow[] {
  if (!candles.length) return [];
  const lookbackDays = Math.max(1, Number(settings.lookbackDays ?? 30));
  const cutoff = candles.at(-1)!.timestamp - lookbackDays * 86_400_000;
  const hideWeekends = settings.hideWeekends !== false;
  const maximumGap = Math.max(intervalMs * 4, 3_600_000);
  const windows: MarketSessionWindow[] = [];

  resolveMarketSessions(settings).forEach((session) => {
    const preset = DEFAULT_MARKET_SESSIONS.find((item) => item.key === session.key)!;
    const startMinute = parseClock(session.start, preset.start);
    const endMinute = parseClock(session.end, preset.end);
    let active: MarketSessionWindow | null = null;
    let previousTimestamp = 0;

    candles.forEach((candle) => {
      if (candle.timestamp < cutoff) return;
      const parts = zonedParts(candle.timestamp, session.timezone);
      const weekend = parts.weekday === "Sat" || parts.weekday === "Sun";
      const isActive = (!hideWeekends || !weekend)
        && inClockRange(parts.minute, startMinute, endMinute);
      const contiguous = active && candle.timestamp - previousTimestamp <= maximumGap;
      if (!isActive || !contiguous) {
        if (active) windows.push(active);
        active = null;
      }
      if (!isActive) return;
      if (!active) {
        active = {
          ...session,
          startTimestamp: candle.timestamp,
          endTimestamp: candle.timestamp + intervalMs,
          highTimestamp: candle.timestamp,
          lowTimestamp: candle.timestamp,
          open: candle.open,
          close: candle.close,
          high: candle.high,
          low: candle.low,
        };
      } else {
        active.endTimestamp = candle.timestamp + intervalMs;
        active.close = candle.close;
        if (candle.high > active.high) {
          active.high = candle.high;
          active.highTimestamp = candle.timestamp;
        }
        if (candle.low < active.low) {
          active.low = candle.low;
          active.lowTimestamp = candle.timestamp;
        }
      }
      previousTimestamp = candle.timestamp;
    });
    if (active) windows.push(active);
  });
  return windows.sort((left, right) => left.startTimestamp - right.startTimestamp);
}

export function buildPreviousSessionHighLowLevels(
  candles: Candle[],
  settings: SessionSettings,
  intervalMs = 60_000,
): PreviousSessionHighLowLevel[] {
  if (!candles.length) return [];
  const latestTimestamp = candles.at(-1)!.timestamp;
  const completed = buildMarketSessionWindows(candles, {
    ...settings,
    lookbackDays: Math.max(7, Number(settings.lookbackDays ?? 30)),
  }, intervalMs)
    .filter((session) => session.endTimestamp <= latestTimestamp)
    .sort((left, right) =>
      right.endTimestamp - left.endTimestamp || right.startTimestamp - left.startTimestamp)
    .slice(0, 3);

  return completed.flatMap((session, index) => {
    const rank = (index + 1) as 1 | 2 | 3;
    if (settings[`showPrevious${rank}`] === false) return [];
    const prefix = `P${rank} ${session.label}`;
    const levels: PreviousSessionHighLowLevel[] = [];
    if (settings.showHighs !== false) {
      levels.push({
        id: `${session.key}-${session.startTimestamp}-high`,
        rank,
        side: "high",
        session,
        price: session.high,
        startTimestamp: session.highTimestamp,
        label: `${prefix} High`,
      });
    }
    if (settings.showLows !== false) {
      levels.push({
        id: `${session.key}-${session.startTimestamp}-low`,
        rank,
        side: "low",
        session,
        price: session.low,
        startTimestamp: session.lowTimestamp,
        label: `${prefix} Low`,
      });
    }
    return levels;
  });
}

function normalizeInitialBalanceDuration(value: unknown): InitialBalanceDuration {
  const requested = Number(value);
  return INITIAL_BALANCE_DURATIONS.includes(requested as InitialBalanceDuration)
    ? requested as InitialBalanceDuration
    : 60;
}

/**
 * Builds the opening-range high and low for every enabled market session.
 *
 * During the configured formation window the returned prices develop with
 * each completed/live candle. Once that window ends the same two prices are
 * retained for the rest of the session. Session discovery is shared with the
 * Sessions study, so exchange-local clocks remain DST aware.
 */
export function buildInitialBalanceLevels(
  candles: Candle[],
  settings: SessionSettings,
  intervalMs = 60_000,
): InitialBalanceLevel[] {
  if (!candles.length) return [];
  const durationMinutes = normalizeInitialBalanceDuration(settings.durationMinutes);
  const formationDurationMs = durationMinutes * 60_000;
  const latestTimestamp = candles.at(-1)!.timestamp;
  const candlesByTimestamp = new Map(candles.map((candle) => [candle.timestamp, candle]));
  const windows = buildMarketSessionWindows(candles, settings, intervalMs);

  return windows.flatMap((session) => {
    const formationEndTimestamp = session.startTimestamp + formationDurationMs;
    const formationCandles = candles.filter((candle) =>
      candle.timestamp >= session.startTimestamp
      && candle.timestamp < formationEndTimestamp
      && candle.timestamp < session.endTimestamp);
    if (!formationCandles.length) return [];

    const high = Math.max(...formationCandles.map((candle) => candle.high));
    const low = Math.min(...formationCandles.map((candle) => candle.low));
    if (!Number.isFinite(high) || !Number.isFinite(low)) return [];

    // Keep the developing line attached to the latest real chart bar. Once
    // the session is historical, its own end timestamp freezes the extent.
    const finalCandle = candlesByTimestamp.get(session.endTimestamp - intervalMs);
    const endTimestamp = finalCandle
      ? finalCandle.timestamp
      : Math.max(session.startTimestamp, session.endTimestamp - intervalMs);
    const developing = latestTimestamp < formationEndTimestamp
      && latestTimestamp < session.endTimestamp;
    const suffix = developing ? " · BUILDING" : "";

    return [
      ...(settings.showHighs === false ? [] : [{
        id: `${session.key}-${session.startTimestamp}-ib-high-${durationMinutes}`,
        side: "high" as const,
        session,
        price: high,
        startTimestamp: session.startTimestamp,
        endTimestamp,
        formationEndTimestamp,
        durationMinutes,
        developing,
        label: `${session.label} IBH ${durationMinutes}m${suffix}`,
      }]),
      ...(settings.showLows === false ? [] : [{
        id: `${session.key}-${session.startTimestamp}-ib-low-${durationMinutes}`,
        side: "low" as const,
        session,
        price: low,
        startTimestamp: session.startTimestamp,
        endTimestamp,
        formationEndTimestamp,
        durationMinutes,
        developing,
        label: `${session.label} IBL ${durationMinutes}m${suffix}`,
      }]),
    ];
  });
}
