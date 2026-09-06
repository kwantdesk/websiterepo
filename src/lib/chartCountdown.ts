// Feed activity is based on the provider's observation time, never HTTP receipt
// time or the candle-merging clock fallback. Unknown/stale timestamps are not
// evidence of a live market. This is freshness, not an exchange calendar.
export const CHART_ACTIVITY_WINDOW_MS = 15_000;

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
  candleTimestamp: number, intervalMs: number, now: number, marketIsActive?: boolean,
): number | null {
  if (marketIsActive !== true || !Number.isFinite(candleTimestamp)
    || !Number.isFinite(intervalMs) || intervalMs <= 0 || !Number.isFinite(now)
    || candleTimestamp > now) return null;
  const remaining = candleTimestamp + intervalMs - now;
  // Never invent another candle deadline from the computer clock when the
  // actual bar has expired. Wait for a genuinely current candle instead.
  return remaining > 0 ? remaining : null;
}
