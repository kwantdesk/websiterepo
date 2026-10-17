import type { Candle } from "./backtester";
import type { InstitutionalTrade } from "./institutionalMarketData";

type CompactBar = { timestamp: number; open: number | null; high: number | null; low: number | null;
  close: number | null; volume: number; delta: number; deltaHigh: number; deltaLow: number; levels: number[][] };
export type CompactFootprintPayload = { schemaVersion?: string; contractSymbol?: string;
  fromMs?: number; toMs?: number; minimumTradeVolume?: number; maximumTradeVolume?: number;
  sourceRecordCount?: number; bars?: CompactBar[] };

export function decodeCompactFootprintHistory(payload: CompactFootprintPayload, contract: string,
  candles: Candle[], fromMs: number, toMs: number, minimumTradeVolume: number, maximumTradeVolume: number): InstitutionalTrade[] {
  const expected = candles.filter(c => c.timestamp >= fromMs && c.timestamp < toMs);
  if (payload.schemaVersion !== "kwantdesk-exact-footprint-v1" || payload.contractSymbol !== contract
    || payload.fromMs !== fromMs || payload.toMs !== toMs || payload.minimumTradeVolume !== minimumTradeVolume
    || payload.maximumTradeVolume !== maximumTradeVolume || !Array.isArray(payload.bars)
    || payload.bars.length !== expected.length || !Number.isSafeInteger(payload.sourceRecordCount)
    || Number(payload.sourceRecordCount) < 0) throw new Error("Exact Footprint history is incomplete.");
  const records: InstitutionalTrade[] = [];
  let totalTrades = 0;
  for (let i = 0; i < expected.length; i++) {
    const candle = expected[i], bar = payload.bars[i];
    if (bar.timestamp !== candle.timestamp || bar.volume !== (candle.volume ?? 0)
      || (bar.volume > 0 && (bar.open !== candle.open || bar.high !== candle.high || bar.low !== candle.low || bar.close !== candle.close))
      || !Array.isArray(bar.levels) || ![bar.delta, bar.deltaHigh, bar.deltaLow].every(Number.isFinite)) {
      throw new Error("Exact Footprint executions do not cover this candle history yet.");
    }
    const firstRecord = records.length;
    let volume = 0, delta = 0, previousPrice = -Infinity;
    for (const row of bar.levels) {
      if (!Array.isArray(row) || row.length !== 7 || !Number.isFinite(row[0]) || row[0] <= previousPrice
        || row[0] < candle.low || row[0] > candle.high || row.slice(1).some(v => !Number.isSafeInteger(v) || v < 0)) {
        throw new Error("Invalid exact Footprint price level.");
      }
      previousPrice = row[0];
      for (const side of [1, 2, 3]) {
        const size = row[side], count = row[side + 3];
        if (!size && !count) continue;
        if (size < count || count < 1 || (minimumTradeVolume > 0 && size < count * minimumTradeVolume)
          || (maximumTradeVolume > 0 && size > count * maximumTradeVolume)) throw new Error("Invalid exact Footprint trade counts.");
        const bidVolume = side === 1 ? size : 0, askVolume = side === 2 ? size : 0;
        volume += size; delta += askVolume - bidVolume; totalTrades += count;
        const recordIndex = records.length;
        if (recordIndex >= 100000) throw new Error("Footprint has too many price levels; zoom in.");
        records.push({ timestamp: candle.timestamp, open: row[0], high: row[0], low: row[0], close: row[0],
          volume: size, bidVolume, askVolume, delta: askVolume - bidVolume, trades: count,
          recordIndex, eventId: `footprint:${contract}:${fromMs}:${recordIndex}`, flowOnly: true, sideSemanticsVersion: 2,
          aggressor: side === 1 ? "SELL" : side === 2 ? "BUY" : "UNKNOWN",
          footprintSummary: { minimumTradeVolume, maximumTradeVolume } });
      }
    }
    if (delta !== bar.delta || volume > bar.volume || (!minimumTradeVolume && !maximumTradeVolume && volume !== bar.volume)
      || bar.deltaHigh < Math.max(0, delta) || bar.deltaLow > Math.min(0, delta)
      || bar.deltaHigh > volume || bar.deltaLow < -volume) throw new Error("Invalid exact Footprint totals.");
    if (records[firstRecord]) records[firstRecord].footprintSummary = { minimumTradeVolume, maximumTradeVolume,
      deltaHigh: bar.deltaHigh, deltaLow: bar.deltaLow };
  }
  if (totalTrades > Number(payload.sourceRecordCount)) throw new Error("Invalid exact Footprint source count.");
  return records;
}
