import { chartTimeBucketStartMs } from "./chartTimeBucket.ts";

// The Nov 5 market-map captures alternate between two SPY price bands with
// no exchange timestamps or trade conditions to identify the valid branch.
// Keep the source archive intact. Every bar that overlaps the affected window
// is incomplete, including higher intervals built from those minutes.
const SPY_CAPTURE_INCIDENT = {
  from: Date.parse("2026-11-05T14:57:00Z"),
  until: Date.parse("2026-11-05T17:32:00Z"),
};

export function excludeUnverifiedCashHistory<T extends { timestamp: number }>(
  rows: T[],
  symbol: string,
  timeframe: string,
): T[] {
  if (symbol.trim().toUpperCase() !== "SPY" || rows.length === 0) return rows;
  const first = chartTimeBucketStartMs(SPY_CAPTURE_INCIDENT.from, timeframe);
  const last = chartTimeBucketStartMs(SPY_CAPTURE_INCIDENT.until - 1, timeframe);
  if (!rows.some(({ timestamp }) => timestamp >= first && timestamp <= last)) return rows;
  return rows.filter(({ timestamp }) => timestamp < first || timestamp > last);
}
