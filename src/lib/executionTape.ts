/**
 * The execution tape: identity, validation, decoding and admission.
 *
 * Deliberately free of DOM and React so the market-data worker and the
 * main-thread fallback run the exact same code. Nothing here may touch
 * `window`, `document` or any client-only module.
 */
import type { InstitutionalTrade } from "@/lib/institutionalMarketData";

// The seed is deliberately bounded for browser responsiveness; complete
// session calculations such as Volume Profile stay inside the gateway.
export const MAX_TAPE_RECORDS = 25_000;
// How far past the cap the tape may run before it is cut back in one move,
// so trimming costs one splice per few thousand prints instead of a fresh
// array per message.
export const TAPE_TRIM_SLACK = 4_096;

export function recordKey(record: InstitutionalTrade) {
  return record.eventId
    || `${record.timestamp}:${record.recordIndex}:${record.close}:${record.volume}`;
}

export function validRecord(value: unknown): value is InstitutionalTrade {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<InstitutionalTrade>;
  return Number.isFinite(Number(row.timestamp))
    && Number.isFinite(Number(row.close))
    && Number.isFinite(Number(row.volume));
}

export function decodeRecords(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(validRecord).map((row) => ({
    ...row,
    eventId: row.eventId ? String(row.eventId) : undefined,
    recordIndex: Number(row.recordIndex ?? 0),
    timestamp: Number(row.timestamp),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    trades: Number(row.trades ?? 1),
    volume: Number(row.volume),
    bidVolume: Number(row.bidVolume ?? 0),
    askVolume: Number(row.askVolume ?? 0),
    delta: Number(row.delta ?? 0),
    aggressor: row.aggressor === "BUY" || row.aggressor === "SELL" ? row.aggressor : "UNKNOWN",
    sideSemanticsVersion: Number(row.sideSemanticsVersion ?? 2),
  } satisfies InstitutionalTrade));
}

/**
 * Admits genuinely new prints to the shared tape, in place.
 *
 * The previous pair of helpers rebuilt, for EVERY SSE trades message, a Set
 * of the last 4,096 record keys — a 4,096-element slice plus 4,096 freshly
 * built strings — and did it twice, once to find the unseen records and again
 * to merge them. The merge then allocated two more 25,000-element arrays via
 * `concat(...).slice(-MAX)`. That is roughly 900KB of garbage per message,
 * and a busy NQ session sends them many times a second: measured on the
 * owner's machine, the charts page climbed to 2,275MB of a 4,192MB heap in
 * 245 seconds, and the resulting major GCs are what freeze the pointer and
 * stall the price.
 *
 * The tape now keeps its identity index alongside it. Each message costs one
 * key per incoming record and an append — no rescan of the retained tape, no
 * reallocation of it. Trimming is amortised: the tape is allowed to run past
 * the cap by a slack window and is then cut back in one splice, so the O(n)
 * move happens once every few thousand prints instead of once per message.
 *
 * Dedup is also now exact over everything retained rather than over a 4,096
 * record window, so a long reconnect replay can no longer slip a duplicate
 * past the window and permanently inflate the candle it lands in.
 */
export type ExecutionTapeBuffer = {
  records: InstitutionalTrade[];
  recordKeys: Set<string>;
};

export function admitRecords(
  stream: ExecutionTapeBuffer,
  incoming: InstitutionalTrade[],
  maxRecords = MAX_TAPE_RECORDS,
  trimSlack = TAPE_TRIM_SLACK,
) {
  if (!incoming.length) return [];
  const additions: InstitutionalTrade[] = [];
  for (const record of incoming) {
    const key = recordKey(record);
    if (stream.recordKeys.has(key)) continue;
    stream.recordKeys.add(key);
    additions.push(record);
  }
  if (!additions.length) return additions;
  for (const record of additions) stream.records.push(record);
  if (stream.records.length > maxRecords + trimSlack) {
    const overflow = stream.records.length - maxRecords;
    for (let index = 0; index < overflow; index += 1) {
      stream.recordKeys.delete(recordKey(stream.records[index]));
    }
    stream.records.splice(0, overflow);
  }
  return additions;
}
