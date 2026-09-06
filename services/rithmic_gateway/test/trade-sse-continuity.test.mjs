import test from "node:test";
import assert from "node:assert/strict";

import {
  completeTradeSseSeed,
  createTradeSseSubscriber,
  queueTradeSseRecord,
} from "../src/trade-sse-continuity.mjs";

const record = (index, timestamp = index * 1_000) => ({
  eventId: `trade-${index}`,
  recordIndex: index,
  timestamp,
  close: 20_000 + index,
  volume: 1,
});

test("prints arriving while the retained snapshot is read are included in the seed", () => {
  const events = [];
  const subscriber = createTradeSseSubscriber("CME:NQU6", {}, "stream-a");
  queueTradeSseRecord(subscriber, record(3), (name, payload) => events.push({ name, payload }));
  const merged = completeTradeSseSeed(
    subscriber,
    [record(1), record(2), record(3)],
    (name, payload) => events.push({ name, payload }),
  );

  assert.deepEqual(merged.map((row) => row.recordIndex), [1, 2, 3]);
  assert.equal(events.length, 1);
  assert.equal(events[0].name, "seed");
  assert.equal(events[0].payload.streamId, "stream-a");
  assert.equal(events[0].payload.batchSequence, 0);
  assert.equal(events[0].payload.continuity, "continuous");
});

test("post-seed trade batches carry an uninterrupted stream-local sequence", () => {
  const events = [];
  const subscriber = createTradeSseSubscriber("CME:NQU6", {}, "stream-b");
  completeTradeSseSeed(subscriber, [record(1)], (name, payload) => events.push({ name, payload }));
  queueTradeSseRecord(subscriber, record(2), (name, payload) => events.push({ name, payload }));
  queueTradeSseRecord(subscriber, record(3), (name, payload) => events.push({ name, payload }));

  assert.deepEqual(events.map((event) => [event.name, event.payload.batchSequence]), [
    ["seed", 0],
    ["trades", 1],
    ["trades", 2],
  ]);
  assert.ok(events.every((event) => event.payload.streamId === "stream-b"));
});
