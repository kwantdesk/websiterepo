import assert from "node:assert/strict";
import test from "node:test";

import { parseJournalTextFile } from "../src/lib/journal.ts";

test("a three-trade CSV imports into one existing journal with complete economics", () => {
  const csv = [
    "Entry Time,Exit Time,Instrument,Direction,Contracts,Entry Price,Exit Price,Net P&L,Initial Risk,Stop Loss,Take Profit,Account Type,Account Size,Setup",
    "2026-08-10T13:31:00Z,2026-08-10T13:38:00Z,MNQ,Long,2,23000,23020,80,40,22990,23030,Funded,50000,Opening drive",
    "2026-08-10T14:02:00Z,2026-08-10T14:09:00Z,MNQ,Short,1,23040,23025,30,20,23050,23010,Funded,50000,Failed breakout",
    "2026-08-10T14:44:00Z,2026-08-10T14:51:00Z,MNQ,Long,3,23010,23005,-30,45,23000,23035,Funded,50000,Reclaim",
  ].join("\n");

  const result = parseJournalTextFile("monday-trades.csv", csv, "My KwantDesk Journal", "import-1");

  assert.equal(result.detectedSchema, "closed-trades");
  assert.equal(result.trades.length, 3);
  assert.equal(result.rejectedRows, 0);
  assert.deepEqual(result.trades.map((trade) => trade.netPnl), [80, 30, -30]);
  assert.deepEqual(result.trades.map((trade) => trade.initialRisk), [40, 20, 45]);
  assert.ok(result.trades.every((trade) => trade.account === "My KwantDesk Journal"));
  assert.ok(result.trades.every((trade) => trade.contractClass === "MICRO"));
  assert.ok(result.trades.every((trade) => trade.tradingAccountType === "FUNDED"));
  assert.ok(result.trades.every((trade) => trade.accountSize === 50_000));
  assert.equal(new Set(result.trades.map((trade) => trade.fingerprint)).size, 3);
});

test("an execution CSV pairs fills into editable closed trades", () => {
  const csv = [
    "Timestamp,Symbol,Side,Quantity,Price,Fees",
    "2026-08-10T13:31:00Z,MNQ,Buy,2,23000,1.20",
    "2026-08-10T13:38:00Z,MNQ,Sell,2,23020,1.20",
    "2026-08-10T14:02:00Z,MNQ,Sell,1,23040,0.60",
    "2026-08-10T14:09:00Z,MNQ,Buy,1,23025,0.60",
  ].join("\n");

  const result = parseJournalTextFile("fills.csv", csv, "My KwantDesk Journal", "import-2");

  assert.equal(result.detectedSchema, "executions");
  assert.equal(result.trades.length, 2);
  assert.deepEqual(result.trades.map((trade) => trade.side), ["LONG", "SHORT"]);
  assert.deepEqual(result.trades.map((trade) => trade.sourceRows), [[2, 3], [4, 5]]);
  assert.ok(result.trades.every((trade) => trade.contractClass === "MICRO"));
});

test("a semicolon-delimited Deep Charts closed-trade export imports signed quantities", () => {
  const csv = [
    "Symbol;Quantity;Entry DT;Entry Price;Exit DT;Exit Price;ProfitLoss",
    "NQ;-2;2026-08-10 08:00:35;29876;2026-08-10 08:12:23.000;29834.75;1650",
    "NQ;2;2026-08-10 08:18:51;29816.25;2026-08-10 08:28:16.000;29848;1270",
    "NQ;-2;2026-08-10 08:31:20;29834.5;2026-08-10 08:37:33.000;29827;300",
    "NQ;-1;2026-08-10 08:49:20;29836.25;2026-08-10 08:50:11.000;29843.25;-140",
  ].join("\n");

  const result = parseJournalTextFile("10.08 globex.csv", csv, "My KwantDesk Journal", "import-deepcharts");

  assert.equal(result.detectedSchema, "closed-trades");
  assert.equal(result.trades.length, 4);
  assert.equal(result.rejectedRows, 0);
  assert.deepEqual(result.trades.map((trade) => trade.side), ["SHORT", "LONG", "SHORT", "SHORT"]);
  assert.deepEqual(result.trades.map((trade) => trade.quantity), [2, 2, 2, 1]);
  assert.deepEqual(result.trades.map((trade) => trade.netPnl), [1650, 1270, 300, -140]);
  assert.deepEqual(result.trades.map((trade) => trade.sourceRows), [[2], [3], [4], [5]]);
  assert.ok(result.trades.every((trade) => trade.openedAt && trade.closedAt));
});
