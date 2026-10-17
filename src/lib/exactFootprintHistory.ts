import type { Candle } from "./backtester";
import type { InstitutionalTrade } from "./institutionalMarketData";

export function decodeExactFootprintHistory(payload: {
  schemaVersion?: string; contractSymbol?: string; truncated?: boolean;
  records?: number[][]; sourceRecordCount?: number; fromMs?: number; toMs?: number;
}, contract: string, candles: Candle[], fromMs: number, toMs: number): InstitutionalTrade[] {
  if (payload.schemaVersion !== "kwantdesk-exact-tape-window-v1" || payload.contractSymbol !== contract
    || payload.truncated !== false || payload.fromMs !== fromMs || payload.toMs !== toMs
    || !Array.isArray(payload.records) || payload.records.length > 100000
    || payload.sourceRecordCount !== payload.records.length) throw new Error("Exact Footprint history is incomplete.");
  const volumes = new Map<number, number>();
  let index = 0, previous = -Infinity;
  const expected = candles.filter(c => c.timestamp >= fromMs && c.timestamp < toMs);
  const result = payload.records.map((row, recordIndex): InstitutionalTrade => {
    if (!Array.isArray(row) || row.length !== 4) throw new Error("Invalid exact Footprint execution.");
    const [timestamp, price, volume, side] = row;
    if (!Number.isFinite(timestamp) || timestamp < previous || timestamp < fromMs || timestamp >= toMs
      || !Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(volume) || volume <= 0
      || ![-1, 0, 1].includes(side)) throw new Error("Invalid exact Footprint execution.");
    previous = timestamp;
    while (index + 1 < expected.length && expected[index + 1].timestamp <= timestamp) index++;
    const candle = expected[index];
    if (!candle || timestamp < candle.timestamp || price < candle.low || price > candle.high) throw new Error("Footprint execution has no matching candle.");
    volumes.set(candle.timestamp, (volumes.get(candle.timestamp) ?? 0) + volume);
    const bidVolume = side < 0 ? volume : 0, askVolume = side > 0 ? volume : 0;
    return { timestamp, open: price, high: price, low: price, close: price, volume,
      bidVolume, askVolume, delta: askVolume - bidVolume, trades: 1, recordIndex,
      eventId: `exact:${contract}:${fromMs}:${recordIndex}`, sideSemanticsVersion: 2,
      aggressor: side > 0 ? "BUY" : side < 0 ? "SELL" : "UNKNOWN" };
  });
  if (expected.some(c => (volumes.get(c.timestamp) ?? 0) !== (c.volume ?? 0))) {
    throw new Error("Exact Footprint executions do not cover this candle history yet.");
  }
  return result;
}
