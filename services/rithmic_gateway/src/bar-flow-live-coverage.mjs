/** Use already accumulated exact execution flow when the archive fold
 * lags. Require the same closed bar and matching tape totals; a partial live
 * bar from a reconnect or a replay cutoff cannot impersonate full history. */
export function supplementArchivedBarFlow({ candles, archived, readLive, intervalMs, fromMs, toMs, nowMs = Date.now() }) {
  const minute = 60_000;
  const maxAge = 24 * 60 * minute;
  if (!Number.isInteger(intervalMs) || intervalMs < minute || intervalMs >= maxAge || intervalMs % minute !== 0) return archived;
  const end = Math.min(nowMs, Number(toMs) > 0 ? Number(toMs) : nowMs);
  const start = Math.max(nowMs - maxAge, Number(fromMs) || 0);
  if (end <= start) return archived;
  const matches = (candle, flow) => Boolean(flow
    && candle.volume > 0 && flow.trades > 0
    && flow.volume === candle.volume
    && (!Number.isFinite(candle.trades) || flow.trades === candle.trades)
    && flow.askVolume + flow.bidVolume > 0);
  const needsFlow = candles.filter(candle =>
    candle.timestamp >= start && candle.timestamp + intervalMs <= end
    && !matches(candle, archived.get(candle.timestamp)));
  if (!needsFlow.length) return archived;
  const live = new Map(readLive({
    fromMs: needsFlow[0].timestamp,
    toMs: needsFlow.at(-1).timestamp + intervalMs - 1,
    intervalMs,
    limit: Math.ceil(maxAge / intervalMs) + 1,
  }).map(row => [row.timestamp, row]));
  let result = archived;
  for (const candle of needsFlow) {
    const row = live.get(candle.timestamp);
    if (!matches(candle, row) || row.open !== candle.open || row.close !== candle.close
      || row.high !== candle.high || row.low !== candle.low) continue;
    if (result === archived) result = new Map(archived);
    result.set(candle.timestamp, row);
  }
  return result;
}
