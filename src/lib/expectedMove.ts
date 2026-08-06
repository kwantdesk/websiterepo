export const EXPECTED_MOVE_TRADING_DAYS = 252;
export const EXPECTED_MOVE_SEMANTICS = "Edges are priced travel, not momentum levels. In positive gamma regime the edges tend to be defended; acceptance beyond the band is news.";

export type ExpectedMoveAnchorLabel = "SESSION_OPEN" | "LATEST_COMPLETED_CLOSE" | "LATEST_PRICE";
export type ExpectedMoveMethod = "QD_PRIOR_IV_ONE_SIGMA" | "PRIOR_REALIZED_RANGE";
export type ExpectedMoveMode = "SESSION" | "LIVE";
export type ExpectedMoveSourceSymbol = "QQQ" | "NDX";

export type ExpectedMoveCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type ExpectedMoveRange = {
  method: ExpectedMoveMethod;
  anchorPrice: number;
  anchorLabel: ExpectedMoveAnchorLabel;
  annualizedIv: number;
  movePercent: number;
  moveDollars: number;
  min: number;
  max: number;
  sourceExpiration: string | null;
  approximate: boolean;
  exactMenthorQEquivalent: false;
};

export type ExpectedMoveApiPayload = {
  generatedAt: string;
  nextRefreshAt: string;
  sessionDate: string;
  sourceSymbol: ExpectedMoveSourceSymbol;
  marketOpen: boolean;
  stale: boolean;
  dataAge: number;
  range: ExpectedMoveRange;
};

export type ExpectedMoveCalibration = {
  sourceSymbol: ExpectedMoveSourceSymbol;
  targetInstrument: "NQ" | "MNQ";
  sessionDate: string;
  scale: number;
  calibratedAtMs: number;
};

export type ExpectedMoveBand = {
  mode: ExpectedMoveMode;
  anchor: number;
  anchorLabel: ExpectedMoveAnchorLabel | "CURRENT_PRICE";
  high: number;
  low: number;
  movePercent: number;
  movePoints: number;
  remainingFraction: number;
  approximate: boolean;
};

const NEW_YORK_TIME_ZONE = "America/New_York";
const newYorkFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: NEW_YORK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function candleDate(candle: ExpectedMoveCandle) {
  return new Date(candle.timestamp).toISOString().slice(0, 10);
}

function partsAt(timestamp: number) {
  const parts = newYorkFormatter.formatToParts(new Date(timestamp));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function newYorkEpoch(date: string, hour: number, minute: number) {
  const [year, month, day] = date.split("-").map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let candidate = localAsUtc;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const actual = partsAt(candidate);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    candidate += localAsUtc - actualAsUtc;
  }
  return candidate;
}

function addUtcDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isWeekday(date: string) {
  const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  return day !== 0 && day !== 6;
}

export function expectedMovePercentFromIv(annualizedIv: number) {
  return Number.isFinite(annualizedIv) && annualizedIv > 0
    ? annualizedIv / Math.sqrt(EXPECTED_MOVE_TRADING_DAYS)
    : 0;
}

export function expectedMoveRange(args: {
  priorAtmIv: number | null;
  expiration: string | null;
  dailyCandles: ExpectedMoveCandle[];
  sessionDate: string;
  fallbackPrice: number | null;
}): ExpectedMoveRange | null {
  const ordered = [...args.dailyCandles].sort((left, right) => left.timestamp - right.timestamp);
  const sessionCandle = ordered.find((candle) => candleDate(candle) === args.sessionDate) ?? null;
  const priorCandle = ordered.filter((candle) => candleDate(candle) < args.sessionDate).at(-1) ?? null;
  const anchorPrice = sessionCandle?.open ?? priorCandle?.close ?? args.fallbackPrice;
  const anchorLabel: ExpectedMoveAnchorLabel = sessionCandle
    ? "SESSION_OPEN"
    : priorCandle
      ? "LATEST_COMPLETED_CLOSE"
      : "LATEST_PRICE";
  if (anchorPrice === null || !Number.isFinite(anchorPrice) || anchorPrice <= 0) return null;

  const approximate = args.priorAtmIv === null || args.priorAtmIv <= 0;
  const movePercent = !approximate
    ? expectedMovePercentFromIv(args.priorAtmIv!)
    : priorCandle && priorCandle.close > 0
      ? (priorCandle.high - priorCandle.low) / (2 * priorCandle.close)
      : 0;
  if (!Number.isFinite(movePercent) || movePercent <= 0) return null;

  const moveDollars = anchorPrice * movePercent;
  return {
    method: approximate ? "PRIOR_REALIZED_RANGE" : "QD_PRIOR_IV_ONE_SIGMA",
    anchorPrice,
    anchorLabel,
    annualizedIv: approximate
      ? movePercent * Math.sqrt(EXPECTED_MOVE_TRADING_DAYS)
      : args.priorAtmIv!,
    movePercent,
    moveDollars,
    min: anchorPrice - moveDollars,
    max: anchorPrice + moveDollars,
    sourceExpiration: args.expiration,
    approximate,
    exactMenthorQEquivalent: false,
  };
}

export function chartSessionExpectedMove(args: {
  sessionDate: string;
  marketOpen: boolean;
  iv: { priorAtmIv: number | null; atmIv: number | null; expiration: string | null };
  dailyCandles: ExpectedMoveCandle[];
  fallbackPrice: number | null;
}) {
  return expectedMoveRange({
    priorAtmIv: args.iv.priorAtmIv ?? args.iv.atmIv,
    expiration: args.iv.expiration,
    dailyCandles: args.dailyCandles,
    sessionDate: args.sessionDate,
    fallbackPrice: args.fallbackPrice,
  });
}

export function newYorkExpectedMoveSessionBounds(sessionDate: string) {
  return {
    open: newYorkEpoch(sessionDate, 9, 30),
    close: newYorkEpoch(sessionDate, 16, 0),
  };
}

export function nextNewYorkExpectedMoveOpen(now: number) {
  const local = partsAt(now);
  let date = `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
  for (let offset = 0; offset < 8; offset += 1) {
    if (offset) date = addUtcDays(date, 1);
    if (!isWeekday(date)) continue;
    const open = newYorkEpoch(date, 9, 30);
    if (open > now) return open;
  }
  return now + 24 * 60 * 60_000;
}

export function expectedMoveRemainingFraction(now: number, sessionDate: string) {
  const { open, close } = newYorkExpectedMoveSessionBounds(sessionDate);
  if (now <= open) return 1;
  if (now >= close) return 0;
  return clamp((close - now) / (close - open));
}

export function isExpectedMoveCalibrationUsable(args: {
  calibration: ExpectedMoveCalibration | null;
  sourceSymbol: ExpectedMoveSourceSymbol;
  targetInstrument: "NQ" | "MNQ";
  sessionDate: string;
  marketOpen: boolean;
  now: number;
  ratioIsSane: boolean;
  maximumLiveAgeMs?: number;
}) {
  const calibration = args.calibration;
  if (!calibration) return false;
  if (
    calibration.sourceSymbol !== args.sourceSymbol
    || calibration.targetInstrument !== args.targetInstrument
    || calibration.sessionDate !== args.sessionDate
    || !args.ratioIsSane
  ) return false;
  return !args.marketOpen
    || args.now - calibration.calibratedAtMs <= (args.maximumLiveAgeMs ?? 20 * 60_000);
}

function roundToTick(value: number, tickSize: number) {
  const tick = Number.isFinite(tickSize) && tickSize > 0 ? tickSize : 0.25;
  return Math.round(value / tick) * tick;
}

export function buildExpectedMoveBand(args: {
  mode: ExpectedMoveMode;
  range: ExpectedMoveRange;
  scale: number;
  currentPrice: number;
  now: number;
  sessionDate: string;
  tickSize?: number;
}): ExpectedMoveBand | null {
  if (!Number.isFinite(args.scale) || args.scale <= 0) return null;
  const tickSize = args.tickSize ?? 0.25;
  const remainingFraction = args.mode === "LIVE"
    ? expectedMoveRemainingFraction(args.now, args.sessionDate)
    : 1;
  const anchor = args.mode === "LIVE" ? args.currentPrice : args.range.anchorPrice * args.scale;
  if (!Number.isFinite(anchor) || anchor <= 0) return null;
  const movePoints = args.mode === "LIVE"
    ? anchor * args.range.movePercent * Math.sqrt(remainingFraction)
    : args.range.moveDollars * args.scale;
  return {
    mode: args.mode,
    anchor: roundToTick(anchor, tickSize),
    anchorLabel: args.mode === "LIVE" ? "CURRENT_PRICE" : args.range.anchorLabel,
    high: roundToTick(anchor + movePoints, tickSize),
    low: roundToTick(anchor - movePoints, tickSize),
    movePercent: args.range.movePercent,
    movePoints,
    remainingFraction,
    approximate: args.range.approximate,
  };
}

export function expectedMoveSigmaRails(band: ExpectedMoveBand, multiplier: 1 | 2) {
  const offset = band.movePoints * multiplier;
  return {
    high: band.anchor + offset,
    low: band.anchor - offset,
  };
}

export function expectedMoveLabel(args: { approximate: boolean; side: "high" | "low"; sigma: 1 | 2 }) {
  const prefix = args.approximate ? "~" : "";
  return args.sigma === 1
    ? `${prefix}EM ${args.side}`
    : `${prefix}EM 2σ ${args.side}`;
}

export function staleExpectedMovePayload(payload: ExpectedMoveApiPayload, now: number): ExpectedMoveApiPayload {
  return {
    ...payload,
    stale: true,
    dataAge: Math.max(0, now - Date.parse(payload.generatedAt)),
  };
}
