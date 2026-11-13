import type { InstitutionalTrade } from "./institutionalMarketData";

const DAY = 86_400_000;

// Preserve the selected time span when a deliberately low threshold exceeds
// the drawing budget. Retain the strongest execution in each time bucket,
// rather than removing every marker on the older part of the chart.
export function distributeContractMarkers<T extends { timestamp: number; volume: number }>(records: T[], cap: number): T[] {
  if (records.length <= cap) return records;
  if (cap <= 1) return cap === 1 ? [records.at(-1)!] : [];
  const first = records[0].timestamp;
  const width = Math.max(1, records.at(-1)!.timestamp - first + 1) / cap;
  const buckets = new Map<number, T>();
  for (const record of records) {
    const bucket = Math.min(cap - 1, Math.floor((record.timestamp - first) / width));
    if (!buckets.has(bucket) || buckets.get(bucket)!.volume < record.volume) buckets.set(bucket, record);
  }
  // Preserve both edges exactly, including the newest live qualification.
  buckets.set(0, records[0]);
  buckets.set(cap - 1, records.at(-1)!);
  return [...buckets.values()].sort((a, b) => a.timestamp - b.timestamp);
}

// Request bounded slices: the archive's per-response print ceiling must not
// turn a multi-day request into just its newest executions.
export function bigContractHistoryWindows(days: number, toMs: number) {
  return bigContractHistoryWindowsForRange(toMs - Math.min(365, Math.max(1, Math.round(days))) * DAY, toMs);
}

export function bigContractHistoryWindowsForRange(fromMs: number, toMs: number) {
  const windows = [];
  for (let start = fromMs; start < toMs;) {
    const end = Math.min(toMs, (Math.floor(start / DAY) + 1) * DAY);
    windows.push({ fromMs: start, toMs: end });
    start = end;
  }
  return windows;
}

// Archived candidates have different IDs from the live stream. Keep the
// maximum observed multiplicity of an execution, not two copies of it.
export function mergeBigContractHistory(history: InstitutionalTrade[], live: InstitutionalTrade[]) {
  if (!history.length) {
    const result = live.filter(trade => !trade.flowOnly);
    // The live tape is normally already ordered. Avoid rebuilding string keys
    // and sorting it just to merge an empty history during a new pane mount.
    const ordered = result.every((trade,index) => index === 0
      || trade.timestamp > result[index-1].timestamp
      || trade.timestamp === result[index-1].timestamp && !(trade.recordIndex < result[index-1].recordIndex));
    return ordered ? result : result.sort((a,b)=>a.timestamp-b.timestamp || a.recordIndex-b.recordIndex);
  }
  const key = (trade: InstitutionalTrade) => `${trade.timestamp}:${trade.close}:${trade.volume}:${trade.delta}`;
  const remaining = new Map<string, number>();
  const result = history.filter((trade) => !trade.flowOnly);
  for (const trade of result) remaining.set(key(trade), (remaining.get(key(trade)) ?? 0) + 1);
  for (const trade of live) {
    if (trade.flowOnly) continue;
    const id = key(trade);
    const count = remaining.get(id) ?? 0;
    if (count) remaining.set(id, count - 1);
    else result.push(trade);
  }
  return result.sort((a, b) => a.timestamp - b.timestamp || a.recordIndex - b.recordIndex);
}
