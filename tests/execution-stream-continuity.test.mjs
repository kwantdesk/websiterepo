import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptExecutionStreamSeed,
  advanceExecutionStreamReceipt,
  hasExecutionStreamReceiptMetadata,
} from "../src/lib/executionStreamContinuity.ts";

test("only a named, sequence-zero continuous seed proves a stream", () => {
  assert.deepEqual(acceptExecutionStreamSeed({
    streamId: "stream-a", batchSequence: 0, continuity: "continuous",
  }), { streamId: "stream-a", batchSequence: 0 });
  assert.equal(acceptExecutionStreamSeed({ streamId: "", batchSequence: 0, continuity: "continuous" }), null);
  assert.equal(acceptExecutionStreamSeed({ streamId: "stream-a", batchSequence: 1, continuity: "continuous" }), null);
  assert.equal(acceptExecutionStreamSeed({ streamId: "stream-a", batchSequence: 0 }), null);
});

test("legacy payloads are distinguishable from malformed receipt payloads during rollout", () => {
  assert.equal(hasExecutionStreamReceiptMetadata({ records: [] }), false);
  assert.equal(hasExecutionStreamReceiptMetadata({ streamId: "stream-a" }), true);
  assert.equal(hasExecutionStreamReceiptMetadata({ batchSequence: 0 }), true);
  assert.equal(hasExecutionStreamReceiptMetadata({ continuity: "continuous" }), true);
});

test("missing, duplicate, reordered and cross-stream trade batches break continuity", () => {
  const seed = acceptExecutionStreamSeed({
    streamId: "stream-a", batchSequence: 0, continuity: "continuous",
  });
  const first = advanceExecutionStreamReceipt(seed, {
    streamId: "stream-a", batchSequence: 1, continuity: "continuous",
  });
  assert.deepEqual(first, { streamId: "stream-a", batchSequence: 1 });
  assert.equal(advanceExecutionStreamReceipt(first, {
    streamId: "stream-a", batchSequence: 3, continuity: "continuous",
  }), null);
  assert.equal(advanceExecutionStreamReceipt(first, {
    streamId: "stream-a", batchSequence: 1, continuity: "continuous",
  }), null);
  assert.equal(advanceExecutionStreamReceipt(first, {
    streamId: "stream-b", batchSequence: 2, continuity: "continuous",
  }), null);
});
