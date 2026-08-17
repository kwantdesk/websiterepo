import type { Candle } from "@/lib/backtester";
import type { ChartGammaSourceSnapshot } from "@/lib/chartGammaLevels";
import {
  canonicalOptionsSourceForRoot,
  isOptionsFuturesRatioSane,
  type OptionsFuturesRoot,
} from "@/lib/optionsFlow";

export type GammaSourceSymbol = ChartGammaSourceSnapshot["symbol"];
export type GammaChartInstrument = "NQ" | "MNQ" | "ES" | "MES";
export type DirectGammaEnvironmentInstrument = "SPX" | "SPXW" | "SPY" | "NDX" | "QQQ";
export type GammaConversionId =
  | "NQ-NQ"
  | "NQ-MNQ"
  | "ES-ES"
  | "ES-MES"
  | "QQQ-NQ"
  | "NDX-NQ"
  | "QQQ-MNQ"
  | "NDX-MNQ"
  | "SPY-ES"
  | "SPX-ES"
  | "SPXW-ES"
  | "SPY-MES"
  | "SPX-MES"
  | "SPXW-MES";

export type GammaConversionDefinition = {
  id: GammaConversionId;
  source: GammaSourceSymbol;
  target: GammaChartInstrument;
  futuresRoot: Extract<OptionsFuturesRoot, "NQ" | "ES">;
  label: string;
};

export type ChartGammaCalibration = {
  conversionId: GammaConversionId;
  sourceSymbol: GammaSourceSymbol;
  targetInstrument: GammaChartInstrument;
  futuresRoot: Extract<OptionsFuturesRoot, "NQ" | "ES">;
  futuresContract: string;
  sessionDate: string;
  scale: number;
  calibratedAtMs: number;
  cashAsOfMs: number;
  futuresAsOfMs: number;
};

const GAMMA_CALIBRATION_STORAGE_PREFIX = "kwantdesk:chart-gamma-calibration:v1";

export const GAMMA_CONVERSIONS: readonly GammaConversionDefinition[] = [
  { id: "NQ-NQ", source: "NQ", target: "NQ", futuresRoot: "NQ", label: "NQ native" },
  { id: "NQ-MNQ", source: "NQ", target: "MNQ", futuresRoot: "NQ", label: "NQ native → MNQ" },
  { id: "ES-ES", source: "ES", target: "ES", futuresRoot: "ES", label: "ES native" },
  { id: "ES-MES", source: "ES", target: "MES", futuresRoot: "ES", label: "ES native → MES" },
  { id: "QQQ-NQ", source: "QQQ", target: "NQ", futuresRoot: "NQ", label: "QQQ → NQ" },
  { id: "NDX-NQ", source: "NDX", target: "NQ", futuresRoot: "NQ", label: "NDX → NQ" },
  { id: "QQQ-MNQ", source: "QQQ", target: "MNQ", futuresRoot: "NQ", label: "QQQ → MNQ" },
  { id: "NDX-MNQ", source: "NDX", target: "MNQ", futuresRoot: "NQ", label: "NDX → MNQ" },
  { id: "SPY-ES", source: "SPY", target: "ES", futuresRoot: "ES", label: "SPY → ES" },
  { id: "SPX-ES", source: "SPX", target: "ES", futuresRoot: "ES", label: "SPX → ES" },
  { id: "SPXW-ES", source: "SPXW", target: "ES", futuresRoot: "ES", label: "SPXW → ES" },
  { id: "SPY-MES", source: "SPY", target: "MES", futuresRoot: "ES", label: "SPY → MES" },
  { id: "SPX-MES", source: "SPX", target: "MES", futuresRoot: "ES", label: "SPX → MES" },
  { id: "SPXW-MES", source: "SPXW", target: "MES", futuresRoot: "ES", label: "SPXW → MES" },
] as const;

export function isGammaChartInstrument(value: string): value is GammaChartInstrument {
  return value === "NQ" || value === "MNQ" || value === "ES" || value === "MES";
}

export function gammaConversionOptions(instrument: string): GammaConversionDefinition[] {
  if (!isGammaChartInstrument(instrument)) return [];
  return GAMMA_CONVERSIONS.filter((conversion) => conversion.target === instrument);
}

export function resolveGammaConversion(
  requested: unknown,
  instrument: string,
): GammaConversionDefinition | null {
  if (!isGammaChartInstrument(instrument)) return null;
  const options = gammaConversionOptions(instrument);
  const exact = options.find((conversion) => conversion.id === requested);
  if (exact) return exact;

  const requestedSource = typeof requested === "string"
    ? requested.split("-")[0] as GammaSourceSymbol
    : null;
  const sameSource = options.find((conversion) => conversion.source === requestedSource);
  if (sameSource) return sameSource;

  return options.find((conversion) => conversion.source === conversion.futuresRoot)
    ?? options.find((conversion) => conversion.source === (instrument === "NQ" || instrument === "MNQ" ? "QQQ" : "SPY"))
    ?? options[0]
    ?? null;
}

/**
 * Gamma Environment on a cash/index chart must read that underlying's own
 * options frame. It does not need (and must not wait for) the futures-price
 * calibration used to project strikes onto an NQ/ES chart.
 */
export function resolveDirectGammaEnvironmentConversion(
  instrument: string,
): GammaConversionDefinition | null {
  const source = instrument.trim().toUpperCase() as DirectGammaEnvironmentInstrument;
  const target = source === "NDX" || source === "QQQ"
    ? "NQ"
    : source === "SPX" || source === "SPXW" || source === "SPY"
      ? "ES"
      : null;
  if (!target) return null;
  return GAMMA_CONVERSIONS.find((conversion) => (
    conversion.source === source && conversion.target === target
  )) ?? null;
}

export function cashFallbackGammaConversion(
  instrument: string,
): GammaConversionDefinition | null {
  if (!isGammaChartInstrument(instrument)) return null;
  const root = instrument === "NQ" || instrument === "MNQ" ? "NQ" : "ES";
  const source = canonicalOptionsSourceForRoot(root);
  return gammaConversionOptions(instrument).find((conversion) => conversion.source === source) ?? null;
}

export function isNativeGammaConversion(conversion: GammaConversionDefinition): boolean {
  return conversion.source === conversion.futuresRoot;
}

export function identityGammaCalibration(
  conversion: GammaConversionDefinition,
  sessionDate: string,
  futuresContract: string,
  nowMs: number,
): ChartGammaCalibration {
  return {
    conversionId: conversion.id,
    sourceSymbol: conversion.source,
    targetInstrument: conversion.target,
    futuresRoot: conversion.futuresRoot,
    futuresContract,
    sessionDate,
    scale: 1,
    calibratedAtMs: nowMs,
    cashAsOfMs: nowMs,
    futuresAsOfMs: nowMs,
  };
}

function newYorkClock(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    minute: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

export function findGammaSessionAnchor(
  candles: Candle[],
  sessionDate: string,
): number | null {
  const sessionCandles = candles.filter((candle) => {
    const clock = newYorkClock(candle.timestamp);
    return clock.date === sessionDate && clock.minute >= 9 * 60 + 30;
  });
  return sessionCandles[0]?.timestamp ?? null;
}

export function findCashCloseFuturesCandle(
  candles: Candle[],
  sessionDate: string,
): Candle | null {
  let nearest: Candle | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const candle of candles) {
    const clock = newYorkClock(candle.timestamp);
    if (clock.date !== sessionDate) continue;
    const distance = Math.abs(clock.minute - (15 * 60 + 59));
    if (distance < nearestDistance) {
      nearest = candle;
      nearestDistance = distance;
    }
  }
  return nearestDistance <= 10 ? nearest : null;
}

export function roundedGammaPrice(
  nativePrice: number,
  scale: number,
  tickSize: number,
) {
  const safeTick = Number.isFinite(tickSize) && tickSize > 0 ? tickSize : 0.25;
  return Math.round(nativePrice * scale / safeTick) * safeTick;
}

export function buildChartGammaCalibration(args: {
  conversion: GammaConversionDefinition;
  futuresContract: string;
  sessionDate: string;
  futuresPrice: number;
  futuresAsOfMs: number;
  cashPrice: number;
  cashAsOfMs: number;
  sourceLevels: number[];
  liveFuturesPrice: number;
  nowMs?: number;
}): ChartGammaCalibration | null {
  const scale = args.futuresPrice / args.cashPrice;
  if (!Number.isFinite(scale) || !isOptionsFuturesRatioSane(args.conversion.source, scale)) return null;

  const converted = args.sourceLevels
    .filter((level) => Number.isFinite(level) && level > 0)
    .map((level) => level * scale);
  const bracketed = converted.length >= 2
    && converted.some((level) => level <= args.liveFuturesPrice)
    && converted.some((level) => level >= args.liveFuturesPrice);
  if (!bracketed) return null;

  return {
    conversionId: args.conversion.id,
    sourceSymbol: args.conversion.source,
    targetInstrument: args.conversion.target,
    futuresRoot: args.conversion.futuresRoot,
    futuresContract: args.futuresContract,
    sessionDate: args.sessionDate,
    scale,
    calibratedAtMs: args.nowMs ?? Date.now(),
    cashAsOfMs: args.cashAsOfMs,
    futuresAsOfMs: args.futuresAsOfMs,
  };
}

function calibrationStorageKey(conversionId: GammaConversionId) {
  return `${GAMMA_CALIBRATION_STORAGE_PREFIX}:${conversionId}`;
}

export function loadChartGammaCalibration(
  conversion: GammaConversionDefinition,
): ChartGammaCalibration | null {
  try {
    const raw = window.localStorage.getItem(calibrationStorageKey(conversion.id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ChartGammaCalibration>;
    if (
      parsed.conversionId !== conversion.id
      || parsed.sourceSymbol !== conversion.source
      || parsed.targetInstrument !== conversion.target
      || parsed.futuresRoot !== conversion.futuresRoot
      || typeof parsed.futuresContract !== "string"
      || typeof parsed.sessionDate !== "string"
      || typeof parsed.scale !== "number"
      || typeof parsed.calibratedAtMs !== "number"
      || typeof parsed.cashAsOfMs !== "number"
      || typeof parsed.futuresAsOfMs !== "number"
      || !isOptionsFuturesRatioSane(conversion.source, parsed.scale)
    ) return null;
    return parsed as ChartGammaCalibration;
  } catch {
    return null;
  }
}

export function saveChartGammaCalibration(calibration: ChartGammaCalibration) {
  try {
    window.localStorage.setItem(
      calibrationStorageKey(calibration.conversionId),
      JSON.stringify(calibration),
    );
  } catch {
    // The in-memory calibration remains valid if browser storage is full.
  }
}
