import test from "node:test";
import assert from "node:assert/strict";

import { createEventBarBuilder } from "../src/event-bar-builder.mjs";

const executions = [
  { timestamp: 1_000, price: 100, size: 3, trades: 1, delta: 3 },
  { timestamp: 2_000, price: 101.5, size: 4, trades: 1, delta: -4 },
  { timestamp: 3_000, price: 99.5, size: 5, trades: 1, delta: 5 },
  { timestamp: 4_000, price: 102, size: 6, trades: 1, delta: -6 },
];

for (const interval of ["10v", "2t", "10dv", "4r", "4R", "4/8PF"]) {
  test(`${interval} reports the single event bar that owns each execution`, () => {
    const builder = createEventBarBuilder(interval, "NQU6", 100);
    for (const execution of executions) {
      const before = builder.finish().map((bar) => Number(bar.volume || 0));
      const ownership = builder.add(execution);
      const after = builder.finish();
      assert.ok(ownership && Number.isSafeInteger(ownership.chartIndex));
      const deltas = after.map((bar, index) => Number(bar.volume || 0) - Number(before[index] || 0));
      const positive = deltas.map((amount, index) => ({ amount, index })).filter((entry) => entry.amount > 0);
      assert.deepEqual(positive, [{ amount: execution.size, index: ownership.chartIndex }]);
    }
  });
}

test("rejected input does not report invented ownership", () => {
  const builder = createEventBarBuilder("4r", "NQU6", 100);
  assert.equal(builder.add({ timestamp: NaN, price: 100, size: 1 }), undefined);
  builder.add(executions[0]);
  assert.equal(builder.add({ ...executions[1], timestamp: 999 }), undefined);
});
