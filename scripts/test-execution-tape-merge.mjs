import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { admitRecords } from "../src/lib/executionTape.ts";
import {
  LIVE_EXECUTION_TAPE_LIMITS,
  mergeInstitutionalTradeTapeInPlace,
} from "../src/lib/liveExecutionTape.ts";

const tape = () => ({ records: [], recordKeys: new Set() });
const print = (n) => ({ eventId: `e${n}`, timestamp: 1_000 + n, recordIndex: n, close: 29_500 + (n % 40) * 0.25, volume: 1 + (n % 7), side: n % 2 ? "buy" : "sell" });

// --- the shared workspace tape mutates one canonical array ---
{
  const current = [print(1), print(2)];
  const reference = current;
  const merged = mergeInstitutionalTradeTapeInPlace(current, [print(2), print(3), print(3), print(4)]);
  assert.equal(merged, reference, "the hot path must retain one canonical array");
  assert.deepEqual(merged.map((record) => record.eventId), ["e1", "e2", "e3", "e4"]);

  const flow = { ...print(10), timestamp: 10_050, eventId: "flow", flowOnly: true };
  const exact = { ...print(11), timestamp: 10_080, eventId: "exact", flowOnly: false };
  mergeInstitutionalTradeTapeInPlace(current, [flow]);
  mergeInstitutionalTradeTapeInPlace(current, [exact]);
  assert.ok(!current.some((record) => record.eventId === "flow"), "exact prints replace their flow bucket in place");
  assert.ok(current.some((record) => record.eventId === "exact"));
}

// --- compaction remains bounded without replacing the canonical reference ---
{
  const current = [];
  const reference = current;
  const records = Array.from({ length: LIVE_EXECUTION_TAPE_LIMITS.highWater + 10 }, (_, index) => ({
    ...print(index),
    timestamp: 100_000 + index,
    flowOnly: index % 2 === 0,
  }));
  mergeInstitutionalTradeTapeInPlace(current, records);
  assert.equal(current, reference);
  assert.ok(
    current.length <= LIVE_EXECUTION_TAPE_LIMITS.flow + LIVE_EXECUTION_TAPE_LIMITS.exact,
    "the canonical tape compacts to the two retained lanes",
  );
}

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

// --- the shipped tape must not rebuild its dedup index per message ---
{
  const tapeSource = readFileSync(new URL("../src/lib/executionTape.ts", import.meta.url), "utf8");
  // Rebuilding a Set of the last 4,096 record keys for every SSE message, then
  // reallocating the whole 25,000-record tape with concat().slice(), was
  // measured as the charts page's dominant allocation: 2,275MB of a 4,192MB
  // heap in 245 seconds on the owner's machine.
  assert.ok(!tapeSource.includes("function unseenRecords"), "the per-message dedup rebuild is gone");
  assert.ok(!tapeSource.includes("function mergeRecords"), "the per-message tape copy is gone");
  assert.ok(
    !/\.concat\(additions\)\.slice\(-MAX_TAPE_RECORDS\)/.test(tapeSource),
    "the tape must not be reallocated per message",
  );
  assert.match(tapeSource, /stream\.recordKeys\.add\(key\)/);
  assert.match(tapeSource, /stream\.records\.splice\(0, overflow\)/);
}

// --- ingest runs off the main thread ---
{
  const client = readFileSync(new URL("../src/lib/rithmicIndicatorStream.ts", import.meta.url), "utf8");
  const engine = readFileSync(new URL("../src/lib/executionTapeEngine.ts", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../src/lib/marketTape.worker.ts", import.meta.url), "utf8");

  // Parsing, dedup, tape and batching belong to the worker now. If any of it
  // creeps back onto the main thread it competes with React and canvas paint
  // for the same milliseconds, which is the stall this migration removes.
  assert.ok(!client.includes("new EventSource("), "the main thread must not own the feed");
  assert.ok(!client.includes("JSON.parse"), "the main thread must not parse feed payloads");
  assert.match(client, /new Worker\(new URL\("\.\/marketTape\.worker\.ts", import\.meta\.url\)\)/);
  assert.match(engine, /new EventSource\(/, "the engine owns the connection");
  assert.match(worker, /createExecutionTapeEngine/, "the worker runs the shared engine");

  // The engine is written once and runs in either place, so the fallback
  // cannot drift from the worker path.
  assert.match(client, /createExecutionTapeEngine/, "a worker-less browser still gets a feed");
  assert.match(client, /workerUnavailable = true;/);
  // A worker that dies mid-session must not take the feed with it.
  assert.match(client, /worker\.addEventListener\("error"/);

  // The engine must not reach for the DOM, or it cannot run in a worker.
  for (const forbidden of ["window.", "document.", "localStorage"]) {
    assert.ok(!engine.includes(forbidden), `the engine must not use ${forbidden} — it runs in a worker`);
  }
  const tapeSource = readFileSync(new URL("../src/lib/executionTape.ts", import.meta.url), "utf8");
  for (const forbidden of ["window.", "document.", "\"use client\""]) {
    assert.ok(!tapeSource.includes(forbidden), `the tape module must not use ${forbidden}`);
  }
}

console.log("Execution tape admission tests passed.");
