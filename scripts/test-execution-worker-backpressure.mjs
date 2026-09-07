import assert from "node:assert/strict";

const {
  createWorkerTradeBackpressure,
} = await import("../src/lib/workerTradeBackpressure.ts");

const sent = [];
const publisher = createWorkerTradeBackpressure(
  (key, records) => sent.push({ key, records }),
  5,
);

publisher.publish("NQ:NQU6", [1, 2]);
publisher.publish("NQ:NQU6", [3, 4]);
publisher.publish("NQ:NQU6", [5, 6, 7, 8]);

assert.deepEqual(sent, [{ key: "NQ:NQU6", records: [1, 2] }],
  "only one structured-cloned batch may be in flight");
assert.equal(publisher.pendingCount("NQ:NQU6"), 6,
  "the worker-side backlog must retain every execution");

publisher.acknowledge("NQ:NQU6");
assert.deepEqual(sent[1], { key: "NQ:NQU6", records: [3, 4, 5, 6, 7] },
  "the next bounded batch must preserve the oldest unsent executions");
assert.equal(publisher.hasInFlight("NQ:NQU6"), true);
assert.equal(publisher.pendingCount("NQ:NQU6"), 1);
publisher.acknowledge("NQ:NQU6");
assert.deepEqual(sent[2], { key: "NQ:NQU6", records: [8] },
  "the trailing execution must drain rather than disappear");
publisher.acknowledge("NQ:NQU6");
assert.equal(publisher.hasInFlight("NQ:NQU6"), false);

publisher.publish("ES:ESU6", [10]);
assert.deepEqual(sent[3], { key: "ES:ESU6", records: [10] },
  "contracts must have independent backpressure windows");

for (let record = 11; record <= 100_010; record += 1) {
  publisher.publish("ES:ESU6", [record]);
}
assert.equal(sent.length, 4,
  "a stalled renderer must not create additional structured-cloned messages");
assert.equal(publisher.pendingCount("ES:ESU6"), 100_000,
  "a sustained live burst must retain every unsent execution");
const drained = [];
while (publisher.hasInFlight("ES:ESU6")) {
  const sentBeforeAck = sent.length;
  publisher.acknowledge("ES:ESU6");
  const batch = sent.length > sentBeforeAck ? sent.at(-1) : null;
  if (batch?.key === "ES:ESU6" && batch.records[0] !== 10) drained.push(...batch.records);
}
assert.deepEqual(drained, Array.from({ length: 100_000 }, (_, index) => index + 11),
  "aggressive flow must drain in exact order with no CVD execution gap");
assert.ok(sent.filter((batch) => batch.key === "ES:ESU6").every((batch) => batch.records.length <= 5),
  "every structured-cloned delivery must remain bounded");

publisher.remove("NQ:NQU6");
publisher.acknowledge("NQ:NQU6");
assert.equal(publisher.hasInFlight("NQ:NQU6"), false,
  "unsubscribing must release retained pending records");

console.log("Execution worker backpressure tests passed");
