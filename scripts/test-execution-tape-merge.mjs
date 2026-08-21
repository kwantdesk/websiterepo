import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { admitRecords } from "../src/lib/rithmicIndicatorStream.ts";

const tape = () => ({ records: [], recordKeys: new Set() });
const print = (n) => ({ eventId: `e${n}`, timestamp: 1_000 + n, recordIndex: n, close: 29_500 + (n % 40) * 0.25, volume: 1 + (n % 7), side: n % 2 ? "buy" : "sell" });

// --- admission keeps the tape exact ---
{
  const t = tape();
  assert.deepEqual(admitRecords(t, []), [], "an empty batch admits nothing");
  const first = admitRecords(t, [print(1), print(2), print(3)]);
  assert.equal(first.length, 3);
  assert.equal(t.records.length, 3);

  // A reconnect replays the tail: those prints must not be counted twice, or
  // the candle they land in is permanently inflated.
  const replay = admitRecords(t, [print(2), print(3), print(4)]);
  assert.deepEqual(replay.map((r) => r.eventId), ["e4"], "only genuinely new prints are admitted");
  assert.equal(t.records.length, 4);
  assert.deepEqual(t.records.map((r) => r.eventId), ["e1", "e2", "e3", "e4"], "order is preserved");

  // Duplicates inside one batch are caught too.
  const withinBatch = admitRecords(t, [print(5), print(5), print(6)]);
  assert.deepEqual(withinBatch.map((r) => r.eventId), ["e5", "e6"]);
  assert.equal(t.recordKeys.size, t.records.length, "the index never drifts from the tape");
}

// --- the tape stays bounded, and trimming releases its keys ---
{
  const t = tape();
  const MAX = 100, SLACK = 20;
  for (let batch = 0; batch < 40; batch += 1) {
    admitRecords(t, Array.from({ length: 10 }, (_, i) => print(batch * 10 + i)), MAX, SLACK);
    assert.ok(t.records.length <= MAX + SLACK, `tape ran to ${t.records.length}, past the cap plus slack`);
    assert.equal(t.recordKeys.size, t.records.length, "trimmed keys are released with their records");
  }
  // The newest prints survive, the oldest are the ones dropped.
  assert.equal(t.records.at(-1).eventId, "e399");
  assert.ok(Number(t.records[0].eventId.slice(1)) > 250, "the oldest prints were trimmed");

  // A record trimmed off the front is no longer known, so a late replay of it
  // is admitted rather than silently dropped — the tape is the only claim.
  const revived = admitRecords(t, [print(0)], MAX, SLACK);
  assert.equal(revived.length, 1, "a print older than the retained window is not remembered");
}

// --- the shipped stream must not rebuild its dedup index per message ---
{
  const source = readFileSync(new URL("../src/lib/rithmicIndicatorStream.ts", import.meta.url), "utf8");
  // Rebuilding a Set of the last 4,096 record keys for every SSE message, then
  // reallocating the whole 25,000-record tape with concat().slice(), was
  // measured as the charts page's dominant allocation: 2,275MB of a 4,192MB
  // heap in 245 seconds on the owner's machine.
  assert.ok(!source.includes("function unseenRecords"), "the per-message dedup rebuild is gone");
  assert.ok(!source.includes("function mergeRecords"), "the per-message tape copy is gone");
  assert.ok(
    !/\.concat\(additions\)\.slice\(-MAX_TAPE_RECORDS\)/.test(source),
    "the tape must not be reallocated per message",
  );
  assert.match(source, /stream\.recordKeys\.add\(key\)/);
  assert.match(source, /stream\.records\.splice\(0, overflow\)/);
  // Seeds hand out a snapshot because the tape is mutated in place now.
  assert.match(source, /const seed = stream\.records\.slice\(\);/);
  assert.match(source, /subscriber\.onSeed\?\.\(stream\.records\.slice\(\)\)/);
}

console.log("Execution tape admission tests passed.");
