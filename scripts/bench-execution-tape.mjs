import { admitRecords } from "../src/lib/executionTape.ts";

/** Allocation cost of one SSE trades message, old strategy vs new. */
const MAX = 25_000;
const recordKey = (r) => r.eventId || `${r.timestamp}:${r.recordIndex}:${r.close}:${r.volume}`;

// --- verbatim from the previous implementation (git HEAD) ---
function unseenRecords(current, incoming) {
  if (!incoming.length) return [];
  const seen = new Set(current.slice(-Math.max(4_096, incoming.length * 4)).map(recordKey));
  return incoming.filter((record) => {
    const key = recordKey(record);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function mergeRecords(current, incoming) {
  const recentKeys = new Set(current.slice(-Math.max(4_096, incoming.length * 4)).map(recordKey));
  const additions = incoming.filter((record) => !recentKeys.has(recordKey(record)));
  if (!additions.length) return current;
  return current.concat(additions).slice(-MAX);
}

let seq = 0;
const batch = (n) => Array.from({ length: n }, () => {
  seq += 1;
  return { eventId: `e${seq}`, timestamp: 1_000 + seq, recordIndex: seq, close: 29_500 + (seq % 40) * 0.25, volume: 1 + (seq % 7) };
});

const MESSAGES = 400, PER_MESSAGE = 12;
const run = (label, fn) => {
  seq = 0;
  global.gc?.();
  const before = process.memoryUsage().heapUsed;
  const t0 = performance.now();
  fn();
  const ms = performance.now() - t0;
  const allocMB = (process.memoryUsage().heapUsed - before) / 1048576;
  console.log(`${label.padEnd(26)} ${(ms / MESSAGES).toFixed(3)} ms/msg   ~${(allocMB / MESSAGES * 1024).toFixed(0)} KB/msg retained-at-end`);
  return ms / MESSAGES;
};

// Prime both to a full tape first so the comparison is at steady state.
const oldPrime = []; let oldTape = oldPrime;
for (let i = 0; i < MAX / PER_MESSAGE; i += 1) oldTape = mergeRecords(oldTape, batch(PER_MESSAGE));
const oldStart = oldTape;
const newTape = { records: [], recordKeys: new Set() };
seq = 0;
for (let i = 0; i < MAX / PER_MESSAGE; i += 1) admitRecords(newTape, batch(PER_MESSAGE));

console.log(`steady state: ${MAX.toLocaleString()}-record tape, ${PER_MESSAGE} prints per SSE message\n`);
const before = run("old: rebuild + concat", () => {
  let tape = oldStart;
  for (let i = 0; i < MESSAGES; i += 1) {
    const records = batch(PER_MESSAGE);
    const additions = unseenRecords(tape, records);
    tape = mergeRecords(tape, additions);
  }
});
const after = run("new: in-place admission", () => {
  for (let i = 0; i < MESSAGES; i += 1) admitRecords(newTape, batch(PER_MESSAGE));
});
console.log(`\nper-message cost: ${(before / after).toFixed(1)}x faster`);
