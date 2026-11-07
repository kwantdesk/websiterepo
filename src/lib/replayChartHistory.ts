import type { Candle } from "./backtester";
import type { InstitutionalTrade } from "./institutionalMarketData";
import { replayFormingCandle } from "./replayFormingCandle";

const DAY_MS = 86_400_000;
const PERIOD_DAYS: Record<string, number> = { "1D": 1, "5D": 10, "1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365, All: 1460 };

/** Anchor pre-roll to the selected historical session, never today's date.
 * Five sessions need calendar headroom for weekends/holidays. The caller
 * trims actual returned session labels, not an invented five-day tape. */
export function replayChartHistoryRange(session: { startMs: number; endMs: number }, period: string, nowMs = Date.now()) {
  const days = PERIOD_DAYS[period] ?? 10;
  const fromMs = session.startMs - (days - 1) * DAY_MS;
  // Sibling panes must share the same immutable current-session request key.
  const toMs = Math.min(session.endMs, Math.floor(nowMs / 60_000) * 60_000);
  return { fromMs, toMs, key: `replay-${period}-${fromMs}-${toMs}` };
}

/** Live recomputation has a tail budget; replay must cover every revealed bar. */
export function replayIndicatorCandles<T>(candles: T[], liveLimit: number, replayClock: number | null | undefined): T[] {
  return replayClock == null ? candles.slice(-Math.max(1, liveLimit)) : candles;
}

/** The one candle cut used by every price/footprint pane in Charts replay.
 * The caller supplies only bars whose opening timestamp has been revealed. */
export function replayCandlesAtClock(candles: Candle[], prints: InstitutionalTrade[], clock: number | null,
  intervalMs: number, eventBased: boolean): Candle[] {
  if (clock === null || !candles.length) return candles;
  if (eventBased) return candles.filter((candle, index) => {
    const end = Number(candle.sourceEndTimestamp);
    if (Number.isFinite(end) && end >= candle.timestamp) return end <= clock;
    return index + 1 < candles.length && candles[index + 1].timestamp <= clock;
  });
  const last = candles[candles.length - 1];
  // Use the archive's actual open, including exchange-aligned daily bars.
  if (intervalMs <= 0 || clock >= last.timestamp + intervalMs) return candles;
  const forming = replayFormingCandle(last.timestamp, clock, prints);
  return forming ? [...candles.slice(0, -1), forming] : candles.slice(0, -1);
}

/** A whole-bar price ladder is usable only after that exact bar closes.
 * Its bar-open timestamp must never be confused with publication time. */
export function completedReplayFootprintCandles(candles: Candle[], intervalMs: number | null, clock: number | null | undefined) {
  return clock == null ? candles : intervalMs == null ? [] : candles.filter(candle => candle.timestamp + intervalMs <= clock);
}

export function replayFootprintRecords(records: InstitutionalTrade[], intervalMs: number | null, clock: number | null | undefined) {
  return clock == null ? records : records.filter(record => record.footprintSummary || record.flowOnly
    ? intervalMs != null && record.timestamp + intervalMs <= clock
    : record.timestamp <= clock);
}
