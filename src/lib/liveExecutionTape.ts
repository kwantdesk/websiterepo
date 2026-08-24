import type { InstitutionalTrade } from "./institutionalMarketData";

const FLOW_RECORD_LIMIT = 30_000;
const EXACT_RECORD_LIMIT = 25_000;
// Compact in batches instead of filtering and sorting the entire tape for
// every live execution packet. The extra headroom is small in memory and
// removes a recurring main-thread stall during active markets.
// Keep only a small amount of merge headroom above the two retained lanes.
// A 70k high-water mark let every open pane carry another 15k records until
// the next compaction. Across several charts that transient headroom was
// enough to trigger large, periodic garbage collections in Chrome.
const COMPACTION_HIGH_WATER = 60_000;

const recordKey = (record: InstitutionalTrade) => record.eventId
  || `${record.timestamp}:${record.recordIndex}:${record.close}:${record.volume}`;

function ordered(left: InstitutionalTrade, right: InstitutionalTrade) {
  return left.timestamp - right.timestamp || left.recordIndex - right.recordIndex;
}

function compactSortedTape(records: InstitutionalTrade[]) {
  if (records.length <= COMPACTION_HIGH_WATER) return records;
  const flow: InstitutionalTrade[] = [];
  const exact: InstitutionalTrade[] = [];
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record.flowOnly) {
      if (flow.length < FLOW_RECORD_LIMIT) flow.push(record);
    } else if (exact.length < EXACT_RECORD_LIMIT) {
      exact.push(record);
    }
    if (flow.length >= FLOW_RECORD_LIMIT && exact.length >= EXACT_RECORD_LIMIT) break;
  }
  flow.reverse();
  exact.reverse();
  return [...flow, ...exact].sort(ordered);
}

function removeSupersededFlowBuckets(
  current: InstitutionalTrade[],
  exactSecondBuckets: Set<number>,
) {
  if (!current.length || !exactSecondBuckets.size) return current;
  const seconds = [...exactSecondBuckets];
  const firstTimestamp = Math.min(...seconds) * 1_000;
  const lastTimestampExclusive = (Math.max(...seconds) + 1) * 1_000;
  const currentTail = current.at(-1);
  if (!currentTail || currentTail.timestamp < firstTimestamp) return current;

  // The tape is timestamp ordered. Exact live prints normally overlap only
  // the newest one-second flow bucket, so binary-search into that small window
  // instead of filtering all 55k retained records for every Rithmic packet.
  let low = 0;
  let high = current.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (current[middle].timestamp < firstTimestamp) low = middle + 1;
    else high = middle;
  }
  const start = low;
  let end = start;
  while (end < current.length && current[end].timestamp < lastTimestampExclusive) end += 1;
  if (start === end) return current;

  const retained = current.slice(start, end).filter((record) => !(
    record.flowOnly
    && exactSecondBuckets.has(Math.floor(record.timestamp / 1_000))
  ));
  if (retained.length === end - start) return current;
  return [...current.slice(0, start), ...retained, ...current.slice(end)];
}

function removeSupersededFlowBucketsInPlace(
  current: InstitutionalTrade[],
  exactSecondBuckets: Set<number>,
) {
  if (!current.length || !exactSecondBuckets.size) return;
  let firstSecond = Number.POSITIVE_INFINITY;
  let lastSecond = Number.NEGATIVE_INFINITY;
  for (const second of exactSecondBuckets) {
    if (second < firstSecond) firstSecond = second;
    if (second > lastSecond) lastSecond = second;
  }
  const firstTimestamp = firstSecond * 1_000;
  const lastTimestampExclusive = (lastSecond + 1) * 1_000;
  const currentTail = current.at(-1);
  if (!currentTail || currentTail.timestamp < firstTimestamp) return;

  let low = 0;
  let high = current.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (current[middle].timestamp < firstTimestamp) low = middle + 1;
    else high = middle;
  }
  const start = low;
  let end = start;
  while (end < current.length && current[end].timestamp < lastTimestampExclusive) end += 1;
  if (start === end) return;

  let write = start;
  for (let read = start; read < end; read += 1) {
    const record = current[read];
    if (
      record.flowOnly
      && exactSecondBuckets.has(Math.floor(record.timestamp / 1_000))
    ) continue;
    current[write] = record;
    write += 1;
  }
  if (write === end) return;
  const removed = end - write;
  current.copyWithin(write, end);
  current.length -= removed;
}

function replaceArrayContents<T>(target: T[], replacement: T[]) {
  if (target === replacement) return target;
  target.length = 0;
  for (const item of replacement) target.push(item);
  return target;
}

export function mergeInstitutionalTradeTape(
  current: InstitutionalTrade[],
  incoming: InstitutionalTrade[],
) {
  if (!incoming.length) return current;
  const exactSecondBuckets = new Set(
    incoming
      .filter((record) => !record.flowOnly)
      .map((record) => Math.floor(record.timestamp / 1_000)),
  );
  const baseCurrent = removeSupersededFlowBuckets(current, exactSecondBuckets);
  const recentKeys = new Set(
    baseCurrent
      .slice(-Math.max(512, incoming.length * 4))
      .map(recordKey),
  );
  const additions = incoming.filter((record) => !recentKeys.has(recordKey(record)));
  if (!additions.length) return baseCurrent;

  const currentTail = baseCurrent.at(-1);
  const additionsAreOrdered = additions.every((record, index) => (
    index === 0
      ? !currentTail || ordered(currentTail, record) <= 0
      : ordered(additions[index - 1], record) <= 0
  ));
  if (additionsAreOrdered) {
    return compactSortedTape(baseCurrent.concat(additions));
  }

  const unique = new Map<string, InstitutionalTrade>();
  for (const record of [...baseCurrent, ...additions]) unique.set(recordKey(record), record);
  return compactSortedTape([...unique.values()].sort(ordered));
}

/**
 * Append into the single workspace-owned live tape without allocating another
 * 55k-entry array for every Rithmic packet. React consumers must receive a
 * sampled `tape.slice()` rather than retaining this mutable canonical array.
 */
export function mergeInstitutionalTradeTapeInPlace(
  current: InstitutionalTrade[],
  incoming: InstitutionalTrade[],
) {
  if (!incoming.length) return current;

  const exactSecondBuckets = new Set<number>();
  for (const record of incoming) {
    if (!record.flowOnly) exactSecondBuckets.add(Math.floor(record.timestamp / 1_000));
  }
  removeSupersededFlowBucketsInPlace(current, exactSecondBuckets);

  const recentKeys = new Set<string>();
  const recentStart = Math.max(0, current.length - Math.max(512, incoming.length * 4));
  for (let index = recentStart; index < current.length; index += 1) {
    recentKeys.add(recordKey(current[index]));
  }

  const additions: InstitutionalTrade[] = [];
  for (const record of incoming) {
    const key = recordKey(record);
    if (recentKeys.has(key)) continue;
    recentKeys.add(key);
    additions.push(record);
  }
  if (!additions.length) return current;

  const currentTail = current.at(-1);
  const additionsAreOrdered = additions.every((record, index) => (
    index === 0
      ? !currentTail || ordered(currentTail, record) <= 0
      : ordered(additions[index - 1], record) <= 0
  ));
  if (!additionsAreOrdered) {
    return replaceArrayContents(current, mergeInstitutionalTradeTape(current, additions));
  }

  for (const record of additions) current.push(record);
  if (current.length > COMPACTION_HIGH_WATER) {
    replaceArrayContents(current, compactSortedTape(current));
  }
  return current;
}

export const LIVE_EXECUTION_TAPE_LIMITS = {
  flow: FLOW_RECORD_LIMIT,
  exact: EXACT_RECORD_LIMIT,
  highWater: COMPACTION_HIGH_WATER,
} as const;
