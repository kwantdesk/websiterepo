import "server-only";

import {
  getCashCalibratedChartGammaLevels,
  getHistoricalCashCalibratedChartGammaLevelsAt,
} from "@/lib/quantData.server";
import type {
  HistoricalZyonLevel,
  HistoricalZyonPriceWindow,
  HistoricalZyonReplayInput,
  HistoricalZyonZone,
} from "@/lib/historicalZyon";

const MAX_REPLAY_AGE_MS = 20 * 365 * 24 * 60 * 60_000;

function text(value: unknown, limit: number) {
  return typeof value === "string" ? value.replace(/\u0000/g, "").trim().slice(0, limit) : "";
}

function finite(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function newYorkParts(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    sessionDate: `${read("year")}-${read("month")}-${read("day")}`,
    weekday: read("weekday"),
    minute: Number(read("hour")) * 60 + Number(read("minute")),
    clock: `${read("hour")}:${read("minute")}:${read("second")}`,
  };
}

function previousWeekdayIso(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  do value.setUTCDate(value.getUTCDate() - 1);
  while (value.getUTCDay() === 0 || value.getUTCDay() === 6);
  return value.toISOString().slice(0, 10);
}

function replayOptionsCutoff(timestamp: number) {
  const parts = newYorkParts(timestamp);
  const weekday = new Date(`${parts.sessionDate}T00:00:00.000Z`).getUTCDay();
  const tradingDay = weekday >= 1 && weekday <= 5;
  if (tradingDay && parts.minute >= 9 * 60 + 30 && parts.minute < 16 * 60) {
    return { mode: "INTRADAY" as const, sessionDate: parts.sessionDate };
  }
  if (tradingDay && parts.minute >= 16 * 60 + 5) {
    return { mode: "EOD" as const, sessionDate: parts.sessionDate };
  }
  return { mode: "EOD" as const, sessionDate: previousWeekdayIso(parts.sessionDate) };
}

function sessionState(timestamp: number) {
  const { minute } = newYorkParts(timestamp);
  if (minute >= 9 * 60 + 30 && minute < 16 * 60) return "NEW_YORK_CASH";
  if (minute >= 4 * 60 && minute < 9 * 60 + 30) return "NEW_YORK_PREMARKET";
  if (minute >= 3 * 60 && minute < 4 * 60) return "FRANKFURT";
  if (minute >= 2 * 60 && minute < 9 * 60 + 30) return "LONDON";
  return "GLOBEX";
}

function sanitizePriceWindows(value: unknown, cutoff: number): HistoricalZyonPriceWindow[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(["5M", "15M", "30M", "1H", "4H", "1D"]);
  return value.flatMap((row): HistoricalZyonPriceWindow[] => {
    if (!row || typeof row !== "object") return [];
    const source = row as Record<string, unknown>;
    const window = text(source.window, 3);
    const from = text(source.from, 40);
    const to = text(source.to, 40);
    const values = {
      open: finite(source.open),
      high: finite(source.high),
      low: finite(source.low),
      close: finite(source.close),
      change: finite(source.change),
      changePercent: finite(source.changePercent),
      volume: finite(source.volume),
      bars: finite(source.bars),
    };
    if (!allowed.has(window) || !Number.isFinite(Date.parse(from)) || Date.parse(to) > cutoff) return [];
    if (Object.values(values).some((item) => item === null)) return [];
    return [{
      window: window as HistoricalZyonPriceWindow["window"],
      from,
      to,
      bars: Math.max(1, Math.floor(values.bars ?? 1)),
      open: values.open ?? 0,
      high: values.high ?? 0,
      low: values.low ?? 0,
      close: values.close ?? 0,
      change: values.change ?? 0,
      changePercent: values.changePercent ?? 0,
      volume: Math.max(0, values.volume ?? 0),
    }];
  }).slice(0, 6);
}

function sanitizeLevels(value: unknown): HistoricalZyonLevel[] {
  if (!Array.isArray(value)) return [];
  const families = new Set(["gamma", "quant", "valueArea"]);
  return value.flatMap((row): HistoricalZyonLevel[] => {
    if (!row || typeof row !== "object") return [];
    const source = row as Record<string, unknown>;
    const family = text(source.family, 12);
    const label = text(source.label, 120);
    const price = finite(source.price);
    if (!families.has(family) || !label || price === null || price <= 0) return [];
    return [{
      family: family as HistoricalZyonLevel["family"],
      label,
      price,
      visible: source.visible === true,
    }];
  }).slice(0, 100);
}

function sanitizeZones(value: unknown): HistoricalZyonZone[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row): HistoricalZyonZone[] => {
    if (!row || typeof row !== "object") return [];
    const source = row as Record<string, unknown>;
    const low = finite(source.low);
    const high = finite(source.high);
    const label = text(source.label, 120);
    if (low === null || high === null || low <= 0 || high <= 0 || !label) return [];
    return [{ family: "quant", label, low: Math.min(low, high), high: Math.max(low, high), visible: source.visible === true }];
  }).slice(0, 40);
}

function sanitizeCandles(value: unknown, cutoff: number) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const source = row as Record<string, unknown>;
    const timestamp = finite(source.timestamp);
    const open = finite(source.open);
    const high = finite(source.high);
    const low = finite(source.low);
    const close = finite(source.close);
    const volume = finite(source.volume) ?? 0;
    if (timestamp === null || timestamp > cutoff || timestamp < cutoff - 7 * 24 * 60 * 60_000) return [];
    if ([open, high, low, close].some((item) => item === null)) return [];
    return [{
      timestamp,
      open: open ?? 0,
      high: high ?? 0,
      low: low ?? 0,
      close: close ?? 0,
      volume: Math.max(0, volume),
    }];
  }).sort((left, right) => left.timestamp - right.timestamp).slice(-160);
}

export type ValidHistoricalZyonReplay = Omit<HistoricalZyonReplayInput, "currentPrice"> & {
  currentPrice: number;
  asOfMs: number;
  sessionDate: string;
  newYorkClock: string;
  sessionState: string;
};

export function validateHistoricalZyonReplay(value: unknown): ValidHistoricalZyonReplay {
  if (!value || typeof value !== "object") throw new Error("Historical replay context is missing.");
  const source = value as Record<string, unknown>;
  const asOf = text(source.asOf, 40);
  const asOfMs = Date.parse(asOf);
  const root = source.root === "ES" ? "ES" : source.root === "NQ" ? "NQ" : null;
  const instrument = ["NQ", "MNQ", "ES", "MES"].includes(String(source.instrument))
    ? String(source.instrument) as HistoricalZyonReplayInput["instrument"]
    : null;
  if (!root || !instrument || (root === "NQ") !== (instrument === "NQ" || instrument === "MNQ")) {
    throw new Error("Historical replay instrument context is invalid.");
  }
  if (!Number.isFinite(asOfMs) || asOfMs > Date.now() + 5_000 || asOfMs < Date.now() - MAX_REPLAY_AGE_MS) {
    throw new Error("Historical replay timestamp is invalid.");
  }
  const currentPriceInput = finite(source.currentPrice);
  const candles = sanitizeCandles(source.recentCandles, asOfMs);
  const currentPrice = candles.at(-1)?.close ?? currentPriceInput;
  if (currentPrice === null || currentPrice <= 0) throw new Error("Historical replay price is unavailable.");
  const ny = newYorkParts(asOfMs);
  return {
    mode: "HISTORICAL_REPLAY",
    replayId: text(source.replayId, 120) || `${instrument}-${ny.sessionDate}`,
    root,
    instrument,
    asOf: new Date(asOfMs).toISOString(),
    asOfMs,
    sessionDate: ny.sessionDate,
    newYorkClock: ny.clock,
    sessionState: sessionState(asOfMs),
    replayStartedAt: text(source.replayStartedAt, 40),
    replayTimeZone: text(source.replayTimeZone, 80) || "UTC",
    timeframe: text(source.timeframe, 30) || "1m",
    playing: source.playing === true,
    speed: Math.max(0, Math.min(200, finite(source.speed) ?? 0)),
    currentPrice,
    priceWindows: sanitizePriceWindows(source.priceWindows, asOfMs),
    recentCandles: candles,
    levels: sanitizeLevels(source.levels),
    zones: sanitizeZones(source.zones),
  };
}

export async function getHistoricalZyonContext(replay: ValidHistoricalZyonReplay) {
  const source = replay.root === "NQ" ? "QQQ" : "SPY";
  const cutoff = replayOptionsCutoff(replay.asOfMs);
  const warnings: string[] = [];
  const gamma = await (cutoff.mode === "INTRADAY"
    ? getHistoricalCashCalibratedChartGammaLevelsAt(replay.root, source, replay.asOf, replay.currentPrice)
    : getCashCalibratedChartGammaLevels(replay.root, source, cutoff.sessionDate))
    .catch((error) => {
      warnings.push(error instanceof Error ? error.message : "Historical Gamma could not be reconstructed.");
      return null;
    });
  const sourceLevels = gamma?.sources.find((item) => item.levels.length)?.levels ?? [];
  const positioning = gamma?.positioning ?? null;
  const nearestStrikes = positioning
    ? [...positioning.strikes]
      .sort((left, right) => Math.abs(left.futuresEquivalent - replay.currentPrice) - Math.abs(right.futuresEquivalent - replay.currentPrice))
      .slice(0, 41)
      .sort((left, right) => right.sourceStrike - left.sourceStrike)
    : [];
  return {
    mode: "HISTORICAL_REPLAY",
    noLookahead: true,
    cutoff: {
      asOf: replay.asOf,
      sessionDate: replay.sessionDate,
      newYorkClock: replay.newYorkClock,
      sessionState: replay.sessionState,
      optionsMode: cutoff.mode,
      optionsSessionDate: cutoff.sessionDate,
      rule: "Every accepted candle and options frame is timestamped at or before asOf. Future bars and later options frames are excluded.",
    },
    replay: {
      id: replay.replayId,
      instrument: replay.instrument,
      root: replay.root,
      timeframe: replay.timeframe,
      replayTimeZone: replay.replayTimeZone,
      replayStartedAt: replay.replayStartedAt,
      playing: replay.playing,
      speed: replay.speed,
      currentPrice: replay.currentPrice,
    },
    priceAction: {
      windows: replay.priceWindows,
      recentCandles: replay.recentCandles,
    },
    screen: {
      levels: replay.levels,
      zones: replay.zones,
      visibleLevelFamilies: [...new Set(replay.levels.filter((level) => level.visible).map((level) => level.family))],
    },
    gamma: gamma ? {
      checkedAt: gamma.checkedAt,
      snapshotMode: gamma.snapshotMode,
      sessionDate: gamma.sessionDate,
      environment: gamma.environment,
      source,
      futuresRoot: replay.root,
      priceScale: positioning?.priceScale ?? gamma.levelPriceScale ?? null,
      sourcePrice: positioning?.sourcePrice ?? null,
      futuresPrice: positioning?.futuresPrice ?? replay.currentPrice,
      totals: positioning?.totals ?? null,
      levels: sourceLevels.map((level) => ({
        kind: level.kind,
        label: level.label,
        futuresPrice: level.price,
        sourceStrike: positioning?.priceScale ? level.price / positioning.priceScale : null,
        value: level.value,
        rank: level.rank,
      })),
      structureNearPrice: nearestStrikes,
    } : null,
    warnings,
  };
}
