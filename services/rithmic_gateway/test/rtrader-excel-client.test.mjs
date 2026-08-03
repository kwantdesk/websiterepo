import assert from "node:assert/strict";
import test from "node:test";

import { RTraderExcelMarketDataClient } from "../src/rtrader-excel-client.mjs";

test("Excel client becomes connected only after a real workbook snapshot", async () => {
  const client = new RTraderExcelMarketDataClient({
    configured: true,
    excelStaleMs: 10_000,
    maxTrades: 100,
    subscriptions: [],
  });
  await client.start();
  assert.equal(client.health().connected, false);
  const snapshot = client.ingestSnapshot({
    exchange: "CME",
    contractSymbol: "NQU6",
    timestampMs: Date.now(),
    sequence: 1,
    bids: [{ price: 28_100, size: 4, orders: 1 }],
    asks: [{ price: 28_100.25, size: 6, orders: 2 }],
    tradeVolumes: [],
  });
  assert.equal(client.health().connected, true);
  assert.equal(snapshot.depthMode, "MBO_AGGREGATED");
  await client.stop();
});

test("Excel client ingests explicit bought and sold trades once", async () => {
  const client = new RTraderExcelMarketDataClient({
    configured: true,
    excelStaleMs: 10_000,
    maxTrades: 100,
    subscriptions: [],
  });
  await client.start();
  const events = [];
  client.on("marketData", (event) => {
    if (event.type === "trade") events.push(event);
  });
  const payload = {
    exchange: "CME",
    contractSymbol: "NQU6",
    trades: [
      { sourceTradeId: "a", timestampMs: 1_700_000_000_100, price: 28_100.25, size: 3, aggressor: "B" },
      { sourceTradeId: "b", timestampMs: 1_700_000_000_200, price: 28_100, size: 2, aggressor: "S" },
    ],
  };
  const first = client.ingestTrades(payload);
  const duplicate = client.ingestTrades(payload);
  assert.equal(first.accepted, 2);
  assert.equal(duplicate.accepted, 0);
  assert.deepEqual(events.map((event) => event.trade.aggressor), ["BUY", "SELL"]);
  assert.deepEqual(events.map((event) => event.trade.size), [3, 2]);
  await client.stop();
});
