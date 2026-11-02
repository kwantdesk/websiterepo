// Feed activity is based on the provider's observation time, never HTTP receipt
// time or the candle-merging clock fallback. Unknown/stale timestamps are not
// evidence of a live market. This is freshness, not an exchange calendar.
import { chartTimeBucketStartMs } from "./chartTimeBucket.ts";

export const CHART_ACTIVITY_WINDOW_MS = 15_000;
const calendarDeadlines = new Map<string, number>();

/** Match the actual calendar buckets used by live and recorded aggregation. */
function candleDeadline(candleTimestamp: number, intervalMs: number, timeframe?: string) {
  const match = timeframe?.match(/^(\d+)(D|W|M)$/);
  if (!match) return candleTimestamp + intervalMs;
  const interval = match[0];
  const key = `${interval}:${candleTimestamp}`;
  const cached = calendarDeadlines.get(key);
  if (cached !== undefined) return cached;
  const start = chartTimeBucketStartMs(candleTimestamp, interval);
  let low = candleTimestamp;
  const spanDays = match[2] === "D" ? 2 : match[2] === "W" ? 8 : 32;
  let high = low + Number(match[1]) * spanDays * 86400000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (chartTimeBucketStartMs(middle, interval) > start) high = middle;
    else low = middle;
  }
  calendarDeadlines.set(key, high);
  if (calendarDeadlines.size > 256) calendarDeadlines.delete(calendarDeadlines.keys().next().value!);
  return high;
}

export function chartSourceTimestamp(value: unknown): number {
  if (typeof value === "string" && /^\d+$/.test(value.trim())) value = Number(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return Number.NaN;
    return value > 10_000_000_000_000_000 ? Math.floor(value / 1_000_000)
      : value > 10_000_000_000_000 ? Math.floor(value / 1_000)
        : value < 10_000_000_000 ? Math.floor(value * 1_000) : value;
  }
  return typeof value === "string" ? Date.parse(value) : Number.NaN;
}

export function chartActivityRemainingMs(sourceTimestamp: number, now: number): number {
  if (!Number.isFinite(sourceTimestamp) || !Number.isFinite(now)
    || sourceTimestamp > now + 1_000) return 0;
  return Math.max(0, Math.min(CHART_ACTIVITY_WINDOW_MS, sourceTimestamp + CHART_ACTIVITY_WINDOW_MS - now));
}

export function candleCountdownRemainingMs(
  candleTimestamp: number, intervalMs: number, now: number, marketIsActive?: boolean, timeframe?: string,
): number | null {
  if (marketIsActive !== true || !Number.isFinite(candleTimestamp)
    || !Number.isFinite(intervalMs) || intervalMs <= 0 || !Number.isFinite(now)
    || candleTimestamp > now) return null;
  const remaining = candleDeadline(candleTimestamp, intervalMs, timeframe) - now;
  // Never invent another candle deadline from the computer clock when the
  // actual bar has expired. Wait for a genuinely current candle instead.
  return remaining > 0 ? remaining : null;
}
