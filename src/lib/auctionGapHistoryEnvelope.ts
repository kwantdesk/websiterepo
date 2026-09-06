import type { InstitutionalTrade } from "./institutionalMarketData.ts";
import type { AuctionGapHistoryResponse } from "./auctionGapHistorySource.ts";

export type AuctionGapHistoryEnvelopeResult =
  | { status: "ready"; coverage: "complete"; contractSymbol: string; records: InstitutionalTrade[];
      fromMs: number; toMs: number; sourceRecordCount: number }
  | { status: "unavailable"; reason: string; coverage: "partial"; records: [] };

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Validate the original provider envelope without legacy-side rewrites or
 * fallback defaults. Exact-data studies require an affirmative archive proof:
 * a non-truncated response plus matching bounds is not sufficient when the
 * endpoint itself says historicalAvailable=false (its in-memory tape can start
 * late while still truthfully returning every record it retains).
 */
export function validateAuctionGapHistoryEnvelope(response: AuctionGapHistoryResponse,
  expectedContract: string): AuctionGapHistoryEnvelopeResult {
  const fail = (reason: string): AuctionGapHistoryEnvelopeResult =>
    ({ status: "unavailable", reason, coverage: "partial", records: [] });
  const { payload, request } = response;
  if (!expectedContract || request.contractSymbol !== expectedContract
    || payload.contractSymbol !== expectedContract) return fail("contract-mismatch");
  if (payload.schemaVersion !== "kwantify-market-data-v3"
    || payload.provider !== "Rithmic") return fail("unsupported-source-schema");
  const fromMs = payload.fromMs, toMs = payload.toMs, sourceRecordCount = payload.sourceRecordCount;
  if (!finite(request.fromMs) || !finite(request.toMs) || !finite(fromMs) || !finite(toMs) || !finite(sourceRecordCount)
    || !Number.isSafeInteger(sourceRecordCount) || sourceRecordCount < 0
    || fromMs > request.fromMs || toMs < request.toMs) return fail("coverage-bounds-mismatch");
  if (payload.truncated !== false || payload.historicalAvailable !== true
    || payload.coverageComplete !== true || payload.executionOrderComplete !== true) {
    return fail("historical-coverage-unproved");
  }
  if (!Array.isArray(payload.records) || payload.records.length !== sourceRecordCount) {
    return fail("record-count-mismatch");
  }
  const records: InstitutionalTrade[] = [];
  let previousTime = -Infinity;
  const ids = new Set<string>();
  for (const item of payload.records) {
    if (!record(item) || item.flowOnly === true || item.sideSemanticsVersion !== 2) return fail("invalid-execution-record");
    const { timestamp, open, high, low, close, volume, trades, bidVolume, askVolume } = item;
    if (!finite(timestamp) || !finite(open) || !finite(high) || !finite(low) || !finite(close)
      || !finite(volume) || !finite(trades) || !finite(bidVolume) || !finite(askVolume)
      || open !== high || open !== low || open !== close
      || timestamp < fromMs || timestamp > toMs || timestamp < previousTime
      || volume <= 0 || trades <= 0 || bidVolume < 0 || askVolume < 0
      || bidVolume + askVolume > volume) return fail("invalid-execution-record");
    const eventId = typeof item.eventId === "string" && item.eventId ? item.eventId : null;
    const index = item.recordIndex;
    if (!finite(index) || !Number.isSafeInteger(index) || index < 0) {
      return fail("invalid-execution-order");
    }
    const id = eventId ? `event:${eventId}` : `record:${index}`;
    if (ids.has(id)) return fail("duplicate-execution");
    ids.add(id); previousTime = timestamp;
    records.push({ ...(eventId ? { eventId } : {}), recordIndex: index, timestamp,
      open, high, low, close, trades, volume, bidVolume, askVolume,
      delta: askVolume - bidVolume,
      aggressor: item.aggressor === "BUY" ? "BUY" : item.aggressor === "SELL" ? "SELL" : "UNKNOWN",
      sideSemanticsVersion: 2 });
  }
  return { status: "ready", coverage: "complete", contractSymbol: expectedContract,
    records, fromMs, toMs, sourceRecordCount };
}
