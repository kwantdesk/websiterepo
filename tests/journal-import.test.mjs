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

test("a Claude CSV with separate entry and exit date/time columns imports cleanly", () => {
  const csv = [
    "Trade Date,Entry Time,Exit Time,Contract Symbol,Trade Direction,Number of Contracts,Entry Price,Exit Price,Profit/Loss ($)",
    "2026-08-11,09:35:00,09:42:00,MNQ,Long,2,23800,23820,80",
    "2026-08-11,10:04:00,10:11:00,NQ,Short,1,23840,23820,400",
  ].join("\n");

  const result = parseJournalTextFile("claude-trades.csv", csv, "Friend Journal", "import-claude-split");

  assert.equal(result.trades.length, 2);
  assert.equal(result.rejectedRows, 0);
  assert.deepEqual(result.trades.map((trade) => trade.side), ["LONG", "SHORT"]);
  assert.deepEqual(result.trades.map((trade) => trade.quantity), [2, 1]);
  assert.ok(result.trades.every((trade) => trade.openedAt && trade.closedAt));
});

test("a compact generated trade list preserves Entry/Exit points and infers exit time from Hold", () => {
  const csv = [
    "Date,Time,Session,Account,Symbol,Direction,Entry Points,Exit Points,Points,Profit and Loss,Hold,MAE",
    "2026-08-11,09:35:00,New York,Funded 50K,NQ,Short,29840.25,29820.25,20,400,7m 30s,-6.25",
    "2026-08-11,10:04:00,New York,Funded 50K,MNQ,Long,29780,29795.5,15.5,62,00:04:15,-4.5",
  ].join("\n");

  const result = parseJournalTextFile("friend-generated.csv", csv, "Friend Journal", "import-friend-generated");

  assert.equal(result.detectedSchema, "closed-trades");
  assert.equal(result.trades.length, 2);
  assert.equal(result.rejectedRows, 0);
  assert.deepEqual(result.trades.map((trade) => trade.entryPrice), [29840.25, 29780]);
  assert.deepEqual(result.trades.map((trade) => trade.exitPrice), [29820.25, 29795.5]);
  assert.deepEqual(result.trades.map((trade) => trade.durationMs), [450_000, 255_000]);
  assert.ok(result.trades.every((trade) => trade.entryTimeKnown === true));
  assert.ok(result.trades.every((trade) => trade.exitTimeKnown === true));
  assert.ok(result.trades.every((trade) => trade.openedAt && trade.closedAt));
});

test("a Claude CSV with qualified date-time headers imports cleanly", () => {
  const csv = [
    "Entry Date/Time (Brisbane),Exit Date/Time (Brisbane),Instrument Symbol,Position Direction,Contract Quantity,Entry Price,Exit Price,Net P&L (AUD)",
    "2026-08-11T09:35:00+10:00,2026-08-11T09:42:00+10:00,MNQ,Long,2,23800,23820,80",
  ].join("\n");

  const result = parseJournalTextFile("claude-qualified.csv", csv, "Friend Journal", "import-claude-qualified");

  assert.equal(result.trades.length, 1);
  assert.equal(result.rejectedRows, 0);
  assert.equal(result.trades[0].symbol, "MNQ");
  assert.equal(result.trades[0].netPnl, 80);
});

test("a generated CSV can include prose, a code fence, and common alternate headers", () => {
  const csv = [
    "Here is the completed trade export for KwantDesk:",
    "```csv",
    "Trade Open,Trade Close,Ticker,Market Position,Lots,Entry,Exit,Result ($)",
    "2026-08-11 09:35:00,2026-08-11 09:42:00,MNQ,Long (Buy),2,23800,23820,80",
    "2026-08-11 10:04:00,2026-08-11 10:11:00,NQ,Short (Sell),1,23840,23820,400",
    "```",
  ].join("\n");

  const result = parseJournalTextFile("generated-trades.csv", csv, "Friend Journal", "import-generated");

  assert.equal(result.detectedSchema, "closed-trades");
  assert.equal(result.trades.length, 2);
  assert.equal(result.rejectedRows, 0);
  assert.deepEqual(result.trades.map((trade) => trade.side), ["LONG", "SHORT"]);
  assert.deepEqual(result.trades.map((trade) => trade.netPnl), [80, 400]);
});

test("rejected CSV rows explain the fields that were actually missing", () => {
  const csv = [
    "Trade Open,Ticker,Result ($)",
    ",MNQ,80",
    "2026-08-11 10:04:00,,400",
    "2026-08-11 10:20:00,NQ,",
  ].join("\n");

  const result = parseJournalTextFile("incomplete.csv", csv, "Friend Journal", "import-incomplete");

  assert.equal(result.trades.length, 0);
  assert.equal(result.rejectedRows, 3);
  assert.match(result.warnings[0], /1 missing a valid entry date\/time/);
  assert.match(result.warnings[0], /1 missing an instrument/);
  assert.match(result.warnings[0], /1 missing P&L or an entry\/exit price pair/);
});

test("source-agnostic inference imports unfamiliar closed-trade column wording", () => {
  const csv = [
    "Opened Date & Time,Closed Date & Time,Product Name,Market Pos.,Number Lots,Price Entered,Price Closed,Realised Profit/Loss (GBP)",
    "2026-08-11 09:35:00,2026-08-11 09:42:00,MNQ,Long,2,23800,23820,80",
  ].join("\n");

  const result = parseJournalTextFile("unknown-platform.csv", csv, "Universal Journal", "import-unfamiliar");

  assert.equal(result.trades.length, 1);
  assert.equal(result.trades[0].symbol, "MNQ");
  assert.equal(result.trades[0].side, "LONG");
  assert.equal(result.trades[0].quantity, 2);
  assert.equal(result.trades[0].netPnl, 80);
});

test("generic broker fill logs pair B/S executions into a closed trade", () => {
  const csv = [
    "Date/Time,Product,B/S,Filled Quantity,Avg Fill Price,Commission/Fee",
    "2026-08-11 09:35:00,MNQ,Buy,2,23800,1.20",
    "2026-08-11 09:42:00,MNQ,Sell,2,23820,1.20",
  ].join("\n");

  const result = parseJournalTextFile("broker-fills.csv", csv, "Universal Journal", "import-broker-fills");

  assert.equal(result.detectedSchema, "executions");
  assert.equal(result.trades.length, 1);
  assert.equal(result.trades[0].side, "LONG");
  assert.equal(result.trades[0].netPnl, 77.6);
});

test("nested JSON collections and row objects import without a platform adapter", () => {
  const json = JSON.stringify({
    data: [{
      timing: { "Entry Time": "2026-08-11T09:35:00+10:00", "Exit Time": "2026-08-11T09:42:00+10:00" },
      trade: { Instrument: "MNQ", Direction: "Long", Contracts: 2 },
      prices: { "Entry Price": 23800, "Exit Price": 23820 },
      result: { "Net P&L": 80 },
    }],
  });

  const result = parseJournalTextFile("portable.json", json, "Universal Journal", "import-json-nested");

  assert.equal(result.detectedSchema, "json");
  assert.equal(result.trades.length, 1);
  assert.equal(result.trades[0].netPnl, 80);
});
