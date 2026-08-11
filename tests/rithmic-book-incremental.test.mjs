import assert from "node:assert/strict";
import test from "node:test";

import { RithmicBookStore } from "../services/rithmic_gateway/src/book-store.mjs";

function update(overrides = {}) {
  return {
    exchange: "CME",
    symbol: "NQU6",
    sequenceNumber: "1",
    updateType: [1],
    transactionType: [1],
    depthPrice: [30_000],
    depthSize: [3],
    depthOrderPriority: ["1"],
    exchangeOrderId: ["order-a"],
    ...overrides,
  };
}

test("DBO updates maintain price aggregates without rebuilding or double counting", () => {
  const book = new RithmicBookStore();

  book.applyDepthUpdate(update());
  assert.deepEqual(book.snapshot("CME", "NQU6", 10).bids, [
    { price: 30_000, size: 3, orders: 1 },
  ]);

  book.applyDepthUpdate(update({ sequenceNumber: "2", depthSize: [5] }));
  assert.deepEqual(book.snapshot("CME", "NQU6", 10).bids, [
    { price: 30_000, size: 5, orders: 1 },
  ]);

  book.applyDepthUpdate(update({
    sequenceNumber: "3",
    depthSize: [2],
    exchangeOrderId: ["order-b"],
  }));
  assert.deepEqual(book.snapshot("CME", "NQU6", 10).bids, [
    { price: 30_000, size: 7, orders: 2 },
  ]);

  book.applyDepthUpdate(update({
    sequenceNumber: "4",
    depthPrice: [30_001],
    depthSize: [4],
  }));
  assert.deepEqual(book.snapshot("CME", "NQU6", 10).bids, [
    { price: 30_001, size: 4, orders: 1 },
    { price: 30_000, size: 2, orders: 1 },
  ]);

  book.applyDepthUpdate(update({
    sequenceNumber: "5",
    updateType: [3],
    exchangeOrderId: ["order-b"],
  }));
  assert.deepEqual(book.snapshot("CME", "NQU6", 10).bids, [
    { price: 30_001, size: 4, orders: 1 },
  ]);
});
