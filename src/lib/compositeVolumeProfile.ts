import { candleDeadline } from "./chartCountdown.ts";

export type CompositeVolumeProfileRangeMode =
  | "loaded-range"
  | "rolling-bars"
  | "rolling-minutes"
  | "rolling-days"
  | "rolling-weeks"
  | "rolling-months"
  | "custom";

export type CompositeVolumeProfileRange = {
  startMs: number;
  endMs: number;
};

type TimestampedBar = { timestamp: number; sourceStartTimestamp?: number; sourceEndTimestamp?: number };

const finiteTimestamp = (value: unknown) => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 * Resolve the one exact execution window owned by a Composite Volume Profile.
 *
 * DeepCharts exposes period, length type/value and custom date boundaries as
 * separate controls. Keeping the resolution in one pure function prevents the
 * request window, renderer anchor and saved-workspace migration from silently
 * interpreting those controls differently.
 */
export function resolveCompositeVolumeProfileRange(args: {
  candles: readonly TimestampedBar[];
  intervalMs: number | null;
  timeframe?: string;
  replayEndMs?: number | null;
  mode: unknown;
  lengthValue: unknown;
  customStartMs?: unknown;
  customEndMs?: unknown;
  customEndFollowsLatest?: unknown;
  nowMs?: number;
}): CompositeVolumeProfileRange | null {
  const intervalMs = args.intervalMs === null ? null : Math.max(1, finiteTimestamp(args.intervalMs) ?? 60_000);
  const replayEndMs = finiteTimestamp(args.replayEndMs) ?? Infinity;
  const starts: number[] = [];
  let lastTimestamp = 0;
  let lastExecutionEnd = 0;
  for (const candle of args.candles) {
    const timestamp = finiteTimestamp(candle.timestamp);
    if (timestamp === null) continue;
    const start = intervalMs === null ? finiteTimestamp(candle.sourceStartTimestamp) ?? timestamp : timestamp;
    if (start >= replayEndMs) continue;
    starts.push(start);
    lastTimestamp = Math.max(lastTimestamp, timestamp);
    if (intervalMs === null) {
      lastExecutionEnd = Math.max(lastExecutionEnd, (finiteTimestamp(candle.sourceEndTimestamp) ?? timestamp) + 1);
    }
  }
  if (!starts.length) return null;
  starts.sort((left, right) => left - right);
  const loadedStartMs = starts[0];
  const liveEndMs = Math.min(replayEndMs, intervalMs === null
    ? lastExecutionEnd
    : candleDeadline(lastTimestamp, intervalMs, args.timeframe));
  const mode = ([
    "loaded-range",
    "rolling-bars",
    "rolling-minutes",
    "rolling-days",
    "rolling-weeks",
    "rolling-months",
    "custom",
  ].includes(String(args.mode))
    ? String(args.mode)
    : "loaded-range") as CompositeVolumeProfileRangeMode;
  const lengthValue = Math.max(1, Math.round(Number(args.lengthValue) || 1));

  let startMs = loadedStartMs;
  let endMs = liveEndMs;
  if (mode === "rolling-bars") {
    startMs = starts[Math.max(0, starts.length - lengthValue)];
  } else if (mode === "rolling-minutes") {
    startMs = endMs - lengthValue * 60_000;
  } else if (mode === "rolling-days") {
    startMs = endMs - lengthValue * 24 * 60 * 60_000;
  } else if (mode === "rolling-weeks") {
    startMs = endMs - lengthValue * 7 * 24 * 60 * 60_000;
  } else if (mode === "rolling-months") {
    const start = new Date(endMs);
    const day = start.getUTCDate();
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() - lengthValue);
    const monthEnd = new Date(start);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
    start.setUTCDate(Math.min(day, monthEnd.getUTCDate()));
    startMs = start.getTime();
  } else if (mode === "custom") {
    const customStartMs = finiteTimestamp(args.customStartMs);
    const customEndMs = finiteTimestamp(args.customEndMs);
    const fixedEnd = args.customEndFollowsLatest === false;
    if (!customStartMs || (fixedEnd && !customEndMs)) return null;
    startMs = customStartMs;
    endMs = Math.min(replayEndMs, fixedEnd ? customEndMs! : Math.max(liveEndMs, finiteTimestamp(args.nowMs) ?? liveEndMs));
  }

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  return { startMs, endMs };
}

/** The deployed archive folds whole minutes. Only send minutes wholly inside
 * the selected window so replay or a sub-minute boundary cannot leak prints. */
export function compositeArchiveWindow(range: CompositeVolumeProfileRange, clockMs: number) {
  const minuteMs = 60_000;
  const startMs = Math.ceil(range.startMs / minuteMs) * minuteMs;
  const endMs = Math.floor(Math.min(range.endMs, clockMs) / minuteMs) * minuteMs;
  return startMs < endMs ? { startMs, endMs } : null;
}
