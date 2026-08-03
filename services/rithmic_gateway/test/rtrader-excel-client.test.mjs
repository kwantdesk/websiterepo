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
