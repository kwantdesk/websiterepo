import { cmeSessionDateKey, cmeSessionWindowForDate } from "./chartHistoryWindow";
import type { InstitutionalVolumeProfileRequest } from "./institutionalMarketData";

/** Request ownership must survive the gateway's shared `custom` period. */
export type ProfileVariantJob = {
  ownerId: string;
  key: string;
  label: string;
  startMs: number;
  endMs: number;
  request: InstitutionalVolumeProfileRequest;
};

type Range = { startMs: number; endMs: number };
type Bar = { timestamp: number; sourceStartTimestamp?: number; sourceEndTimestamp?: number };
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function monthStart(year: number, month: number): number {
  // A month owns its trading dates, not UTC dates or a rolling 30-day span.
  // Weekend dates have no session; a holiday may return empty genuine data.
  const first = new Date(Date.UTC(year, month, 1));
  while (first.getUTCDay() === 0 || first.getUTCDay() === 6) first.setUTCDate(first.getUTCDate() + 1);
  return cmeSessionWindowForDate(first.toISOString().slice(0, 10))!.startMs;
}

/** Full exchange-calendar months, newest first, each strictly clipped to clock. */
export function monthlyProfileRanges(clockMs: number, count = 1, previous = false): Array<Range & { label: string }> {
  if (!finite(clockMs)) return [];
  const tradingDate = cmeSessionDateKey(clockMs);
  if (!tradingDate) return [];
  const [year, month] = tradingDate.split("-").map(Number);
  const limit = Math.min(120, Math.max(1, Math.floor(Number.isFinite(count) ? count : 1)));
  const result: Array<Range & { label: string }> = [];
  for (let index = 0; index < limit; index++) {
    const offset = index + Number(previous);
    const date = new Date(Date.UTC(year, month - 1 - offset, 1));
    const startMs = monthStart(date.getUTCFullYear(), date.getUTCMonth());
    const endMs = Math.min(clockMs, monthStart(date.getUTCFullYear(), date.getUTCMonth() + 1));
    if (endMs > startMs) result.push({ startMs, endMs, label: date.toISOString().slice(0, 7) });
  }
  return result;
}

/**
 * Logical coordinates are required: multiple volume/range bars can share one
 * second. Preserve source execution bounds rather than rounding candle times.
 * The caller supplies a sorted candle array and the current visible range.
 */
export function visibleProfileRange(args: {
  candles: readonly Bar[];
  from: number;
  to: number;
  intervalMs: number | null;
  clockMs: number;
}): Range | null {
  const { candles, from, to, clockMs } = args;
  if (!candles.length || ![from, to, clockMs].every(finite) || to < from || to < 0 || from > candles.length - 1) return null;
  const first = Math.max(0, Math.floor(from));
  const last = Math.min(candles.length - 1, Math.ceil(to));
  const left = candles[first];
  const right = candles[last];
  const startMs = finite(left.sourceStartTimestamp) ? left.sourceStartTimestamp : left.timestamp;
  // A single trade can be split across adjacent volume bars, or several trades
  // can share one timestamp. The timestamp-only gateway cannot isolate those
  // allocations. Refuse that ambiguous slice rather than count invisible bars.
  const before = candles[first - 1]?.sourceEndTimestamp;
  const after = candles[last + 1]?.sourceStartTimestamp;
  if (finite(before) && before >= startMs) return null;
  if (finite(after) && finite(right.sourceEndTimestamp) && after <= right.sourceEndTimestamp) return null;
  // An explicit execution end is inclusive: convert once to [start, end).
  // Do not give an event candle an invented minute duration.
  const rawEnd = finite(right.sourceEndTimestamp) ? right.sourceEndTimestamp + 1
    : finite(args.intervalMs) && args.intervalMs > 0 ? right.timestamp + args.intervalMs
      : candles[last + 1]?.sourceStartTimestamp ?? candles[last + 1]?.timestamp ?? clockMs;
  const endMs = Math.min(rawEnd, clockMs);
  return finite(startMs) && finite(endMs) && endMs > startMs ? { startMs, endMs } : null;
}

/** Data settings are part of request identity, instance ownership is not lost. */
export function profileVariantJob(args: {
  ownerId: string;
  label: string;
  range: Range;
  source: Omit<InstitutionalVolumeProfileRequest, "period" | "startMs" | "endMs" | "tradingDate">;
}): ProfileVariantJob {
  if (!args.ownerId || !finite(args.range.startMs) || !finite(args.range.endMs) || args.range.endMs <= args.range.startMs) {
    throw new Error("A profile job needs an owner and a finite, non-empty execution range");
  }
  const request: InstitutionalVolumeProfileRequest = { ...args.source, period: "custom", ...args.range };
  const canonicalRequest = Object.fromEntries(Object.entries(request).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b)));
  return { ...args.range, ownerId: args.ownerId, label: args.label, key: JSON.stringify([args.ownerId, canonicalRequest]), request };
}

/**
 * One bounded batch, newest-first order supplied by planner. Invalidation
 * suppresses late publication and stops queued work; it does not pretend to
 * cancel a shared upstream request another chart may still need.
 */
export async function runProfileVariantJobs<T>(args: {
  jobs: readonly ProfileVariantJob[];
  read: (job: ProfileVariantJob) => Promise<T>;
  publish: (job: ProfileVariantJob, value: T) => void;
  failed: (job: ProfileVariantJob, error: unknown) => void;
  isCurrent: () => boolean;
  concurrency?: number;
}): Promise<void> {
  let cursor = 0;
  const requested = args.concurrency ?? 2;
  const workers = Math.min(args.jobs.length, Math.max(1, Math.min(4, Math.floor(finite(requested) ? requested : 2))));
  await Promise.all(Array.from({ length: workers }, async () => {
    while (args.isCurrent() && cursor < args.jobs.length) {
      const job = args.jobs[cursor++];
      try {
        const value = await args.read(job);
        if (args.isCurrent()) args.publish(job, value);
      } catch (error) {
        if (args.isCurrent()) args.failed(job, error);
      }
    }
  }));
}
