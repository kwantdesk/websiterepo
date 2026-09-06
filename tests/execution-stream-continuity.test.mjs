import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptExecutionStreamSeed,
  advanceExecutionStreamReceipt,
} from "../src/lib/executionStreamContinuity.ts";

test("only a named, sequence-zero continuous seed proves a stream", () => {
  assert.deepEqual(acceptExecutionStreamSeed({
    streamId: "stream-a", batchSequence: 0, continuity: "continuous",
  }), { streamId: "stream-a", batchSequence: 0 });
  assert.equal(acceptExecutionStreamSeed({ streamId: "", batchSequence: 0, continuity: "continuous" }), null);
  assert.equal(acceptExecutionStreamSeed({ streamId: "stream-a", batchSequence: 1, continuity: "continuous" }), null);
  assert.equal(acceptExecutionStreamSeed({ streamId: "stream-a", batchSequence: 0 }), null);
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
