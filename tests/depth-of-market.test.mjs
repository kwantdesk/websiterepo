import assert from "node:assert/strict";
import test from "node:test";

import { buildDepthLadder } from "../src/lib/depthOfMarket.ts";

test("groups native depth without inventing liquidity", () => {
  const model = buildDepthLadder({
    levels: [
      { side: "BID", price: 100, size: 12, orders: 2 },
      { side: "BID", price: 99.75, size: 8, orders: 1 },
      { side: "ASK", price: 100.25, size: 10, orders: 3 },
      { side: "ASK", price: 100.5, size: 6, orders: 1 },
    ],
    tickSize: 0.25,
    groupTicks: 1,
    rowCount: 9,
    centrePrice: 100.125,
  });

  assert.equal(model.bestBid, 100);
  assert.equal(model.bestAsk, 100.25);
  assert.equal(model.bidTotal, 20);
  assert.equal(model.askTotal, 16);
  assert.equal(model.rows.find((row) => row.price === 100)?.bidOrders, 2);
});

test("cumulative depth grows outwards from the inside market on both sides", () => {
  const model = buildDepthLadder({
    levels: [
      { side: "BID", price: 100, size: 10 },
      { side: "BID", price: 99.75, size: 20 },
      { side: "ASK", price: 100.25, size: 7 },
      { side: "ASK", price: 100.5, size: 13 },
    ],
    tickSize: 0.25,
    groupTicks: 1,
    rowCount: 9,
    centrePrice: 100.125,
  });

  assert.equal(model.rows.find((row) => row.price === 100)?.bidCumulative, 10);
  assert.equal(model.rows.find((row) => row.price === 99.75)?.bidCumulative, 30);
  assert.equal(model.rows.find((row) => row.price === 100.25)?.askCumulative, 7);
  assert.equal(model.rows.find((row) => row.price === 100.5)?.askCumulative, 20);
});

test("pulling and stacking survive grouped price aggregation", () => {
  const model = buildDepthLadder({
    levels: [
      { side: "BID", price: 100, size: 10, addedSize: 16, removedSize: 4 },
      { side: "BID", price: 99.75, size: 5, addedSize: 3, removedSize: 7 },
    ],
    tickSize: 0.25,
    groupTicks: 2,
    rowCount: 5,
    centrePrice: 100,
  });

  const grouped = model.rows.find((row) => row.price === 100);
  assert.equal(grouped?.bidSize, 15);
  assert.equal(grouped?.bidPullStack, 8);
});
