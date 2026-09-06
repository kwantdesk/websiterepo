import type { InstitutionalTrade } from "./institutionalMarketData.ts";
import type { AuctionGapSessionClock } from "./auctionGapSessionClock.ts";

export type AuctionGapExecution = {
  id: string;
  timestamp: number;
  tickIndex: number;
  volume: number;
  bidVolume: number;
  askVolume: number;
  unknownVolume: number;
  detect: boolean;
  resetKey: string | null;
};

/** Strict source boundary for a pending execution-derived study. No coercion of
 * missing values, candle-direction classification, price rounding off tick, or
 * silent partial-history success. Bar allocation is a separate explicit stage.
 */
export function prepareAuctionGapExecutions(input: {
  contractSymbol: string;
  expectedContract: string;
  tickSize: number;
  asOfMs: number;
  coverage: "complete" | "partial";
  records: readonly InstitutionalTrade[];
}, clock: AuctionGapSessionClock): {
  status: "ready" | "partial-history" | "requires-executions" | "invalid-data";
  executions: AuctionGapExecution[];
} {
  const fail = (status: "partial-history" | "requires-executions" | "invalid-data") => ({ status, executions: [] });
  if (!input.contractSymbol || input.contractSymbol !== input.expectedContract || !Number.isFinite(input.asOfMs)
    || !Number.isFinite(input.tickSize) || input.tickSize <= 0) return fail("invalid-data");
  if (input.coverage !== "complete") return fail("partial-history");
  const found = new Map<string, { signature: string; execution: AuctionGapExecution }>();
  let previous = -Infinity;
  for (const record of input.records) {
    if (!Number.isFinite(record.timestamp)) return fail("invalid-data");
    if (record.timestamp > input.asOfMs) continue;
    if (record.flowOnly) return fail("requires-executions");
    if (record.timestamp < previous) return fail("invalid-data");
    previous = record.timestamp;
    if (![record.open, record.high, record.low, record.close, record.volume, record.bidVolume, record.askVolume].every(Number.isFinite)
      || record.open !== record.close || record.high !== record.close || record.low !== record.close) return fail("requires-executions");
    if (record.volume <= 0 || record.bidVolume < 0 || record.askVolume < 0
      || record.bidVolume + record.askVolume > record.volume) return fail("invalid-data");
    const tick = record.close / input.tickSize;
    const tickIndex = Math.round(tick);
    if (!Number.isSafeInteger(tickIndex) || Math.abs(tick - tickIndex) > 1e-6) return fail("invalid-data");
    const id = record.eventId ? `event:${record.eventId}`
      : Number.isSafeInteger(record.recordIndex) && record.recordIndex >= 0 ? `record:${record.recordIndex}` : null;
    if (!id) return fail("invalid-data");
    const time = clock.classify(record.timestamp);
    if (!time) return fail("invalid-data");
    let bidVolume = record.bidVolume, askVolume = record.askVolume;
    if (bidVolume + askVolume === 0) {
      if (record.aggressor === "BUY") askVolume = record.volume;
      else if (record.aggressor === "SELL") bidVolume = record.volume;
    }
    const execution = { id, timestamp: record.timestamp, tickIndex, volume: record.volume,
      bidVolume, askVolume, unknownVolume: record.volume - bidVolume - askVolume, ...time };
    const signature = JSON.stringify(execution);
    const prior = found.get(id);
    if (prior && prior.signature !== signature) return fail("invalid-data");
    if (!prior) found.set(id, { signature, execution });
  }
  return { status: "ready", executions: Array.from(found.values(), entry => entry.execution) };
}
