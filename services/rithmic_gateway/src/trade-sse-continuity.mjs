import { randomUUID } from "node:crypto";

function recordKey(record) {
  const eventId = String(record?.eventId ?? "").trim();
  if (eventId) return `event:${eventId}`;
  const recordIndex = Number(record?.recordIndex);
  if (Number.isFinite(recordIndex)) return `index:${recordIndex}`;
  return JSON.stringify([
    Number(record?.timestamp),
    Number(record?.close),
    Number(record?.volume),
    String(record?.aggressor ?? ""),
  ]);
}

function mergeSeedAndPending(seedRecords, pendingRecords) {
  const records = [];
  const seen = new Set();
  for (const record of [...seedRecords, ...pendingRecords]) {
    const key = recordKey(record);
    if (seen.has(key)) continue;
    seen.add(key);
    records.push(record);
  }
  return records.sort((left, right) => (
    Number(left.timestamp) - Number(right.timestamp)
    || Number(left.recordIndex ?? 0) - Number(right.recordIndex ?? 0)
  ));
}

export function createTradeSseSubscriber(key, response, streamId = randomUUID()) {
  return {
    key,
    response,
    streamId,
    phase: "seeding",
    batchSequence: 0,
    pendingRecords: [],
  };
}

export function queueTradeSseRecord(subscriber, record, writeEvent) {
  if (subscriber.phase === "seeding") {
    subscriber.pendingRecords.push(record);
    return;
  }
  subscriber.batchSequence += 1;
  writeEvent("trades", {
    streamId: subscriber.streamId,
    batchSequence: subscriber.batchSequence,
    continuity: "continuous",
    historicalSeed: false,
    records: [record],
  });
}

/**
 * Completes an atomic snapshot-to-live handoff.
 *
 * The subscriber is registered before the book snapshot is read. Executions
 * observed during that read are queued here, deduplicated against the
 * snapshot, and emitted in the seed before the subscriber changes to live.
 * JavaScript runs this function synchronously, so no execution can land
 * between the final pending read and the phase change.
 */
export function completeTradeSseSeed(subscriber, seedRecords, writeEvent, extra = {}) {
  const records = mergeSeedAndPending(seedRecords, subscriber.pendingRecords);
  subscriber.pendingRecords = [];
  writeEvent("seed", {
    ...extra,
    streamId: subscriber.streamId,
    batchSequence: 0,
    continuity: "continuous",
    records,
  });
  subscriber.phase = "live";
  return records;
}
