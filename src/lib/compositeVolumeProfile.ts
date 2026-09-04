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

type TimestampedBar = { timestamp: number };

const finiteTimestamp = (value: unknown) => {
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
  intervalMs: number;
  mode: unknown;
  lengthValue: unknown;
  customStartMs?: unknown;
  customEndMs?: unknown;
  customEndFollowsLatest?: unknown;
  nowMs?: number;
}): CompositeVolumeProfileRange | null {
  const timestamps = args.candles
    .map((candle) => finiteTimestamp(candle.timestamp))
    .filter((timestamp): timestamp is number => timestamp !== null)
    .sort((left, right) => left - right);
  if (!timestamps.length) return null;

  const intervalMs = Math.max(1, finiteTimestamp(args.intervalMs) ?? 60_000);
  const loadedStartMs = timestamps[0];
  const liveEndMs = timestamps[timestamps.length - 1] + intervalMs;
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
    startMs = timestamps[Math.max(0, timestamps.length - lengthValue)];
  } else if (mode === "rolling-minutes") {
    startMs = endMs - lengthValue * 60_000;
  } else if (mode === "rolling-days") {
    startMs = endMs - lengthValue * 24 * 60 * 60_000;
  } else if (mode === "rolling-weeks") {
    startMs = endMs - lengthValue * 7 * 24 * 60 * 60_000;
  } else if (mode === "rolling-months") {
    const start = new Date(endMs);
    start.setUTCMonth(start.getUTCMonth() - lengthValue);
    startMs = start.getTime();
  } else if (mode === "custom") {
    const customStartMs = finiteTimestamp(args.customStartMs);
    const customEndMs = finiteTimestamp(args.customEndMs);
    if (!customStartMs) return null;
    startMs = customStartMs;
    endMs = args.customEndFollowsLatest === false && customEndMs
      ? customEndMs
      : Math.max(liveEndMs, finiteTimestamp(args.nowMs) ?? liveEndMs);
  }

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  return { startMs, endMs };
}
