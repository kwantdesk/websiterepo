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
assert.equal(publisher.pendingCount("NQ:NQU6"), 5,
  "the worker-side backlog must stay bounded");

publisher.acknowledge("NQ:NQU6");
assert.deepEqual(sent[1], { key: "NQ:NQU6", records: [4, 5, 6, 7, 8] },
  "the next batch must preserve the newest ordered executions");
assert.equal(publisher.hasInFlight("NQ:NQU6"), true);
assert.equal(publisher.pendingCount("NQ:NQU6"), 0);

publisher.publish("ES:ESU6", [10]);
assert.deepEqual(sent[2], { key: "ES:ESU6", records: [10] },
  "contracts must have independent backpressure windows");

for (let record = 11; record <= 100_010; record += 1) {
  publisher.publish("ES:ESU6", [record]);
}
assert.equal(sent.length, 3,
  "a stalled renderer must not create additional structured-cloned messages");
assert.equal(publisher.pendingCount("ES:ESU6"), 5,
  "a sustained live burst must retain only the configured delivery window");
publisher.acknowledge("ES:ESU6");
assert.deepEqual(sent[3], { key: "ES:ESU6", records: [100_006, 100_007, 100_008, 100_009, 100_010] },
  "after a sustained burst the renderer must receive the newest ordered records");

publisher.remove("NQ:NQU6");
publisher.acknowledge("NQ:NQU6");
assert.equal(publisher.hasInFlight("NQ:NQU6"), false,
  "unsubscribing must release retained pending records");

console.log("Execution worker backpressure tests passed");
