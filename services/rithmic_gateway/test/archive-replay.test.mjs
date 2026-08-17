import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";

import { replayArchiveIntoBook } from "../src/archive-replay.mjs";
import { RithmicBookStore } from "../src/book-store.mjs";
import { chicagoTradingDate } from "../src/trading-session.mjs";

const NOW = Date.parse("2026-08-07T14:00:00Z");

function archiveWith(lines, { gzip = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "kwantify-replay-"));
  const dayDir = join(dir, chicagoTradingDate(NOW));
  mkdirSync(dayDir, { recursive: true });
  const body = `${lines.join("\n")}\n`;
  const name = gzip ? "CME-NQU6.ndjson.gz" : "CME-NQU6.ndjson";
  writeFileSync(join(dayDir, name), gzip ? gzipSync(body) : body);
  return dir;
}

function tradeLine(price, size, aggressor, id) {
  return JSON.stringify({
    templateId: 150,
    exchange: "CME",
    symbol: "NQU6",
    payload: {
      exchange: "CME", symbol: "NQU6",
      tradePrice: price, tradeSize: size, aggressor,
      sourceTradeId: id, ssboe: 1786000000, usecs: 0,
    },
    receivedAt: "2026-08-07T14:00:00.000Z",
  });
}

test("restores the session tape so the profile is not left near-empty", async () => {
  const dir = archiveWith([
    tradeLine(29500, 4, 1, "t1"),
    tradeLine(29500.25, 2, 2, "t2"),
    tradeLine(29500, 9, 1, "t3"),
  ]);
  const book = new RithmicBookStore({ maxTrades: 1000 });
  const result = await replayArchiveIntoBook({ dir, book, now: NOW });

  assert.equal(result.replayed, 3);
  assert.equal(result.files, 1);
  const trades = book.trades("CME", "NQU6");
  assert.equal(trades.length, 3);
  assert.equal(trades.reduce((sum, t) => sum + t.size, 0), 15, "sizes survive the round trip");
});

test("aggressor side survives, so replayed delta is real not neutral", async () => {
  const dir = archiveWith([tradeLine(29500, 5, 1, "b1"), tradeLine(29501, 3, 2, "s1")]);
  const book = new RithmicBookStore({ maxTrades: 1000 });
  await replayArchiveIntoBook({ dir, book, now: NOW });

  const sides = book.trades("CME", "NQU6").map((t) => t.aggressor);
  assert.deepEqual(sides, ["BUY", "SELL"], "a replayed profile must not collapse to zero delta");
});

test("integrity markers and junk lines are skipped, not replayed as trades", async () => {
  const dir = archiveWith([
    tradeLine(29500, 1, 1, "t1"),
    JSON.stringify({ type: "GAP", exchange: "CME", symbol: "NQU6", reason: "connection lost" }),
    JSON.stringify({ type: "DROPPED", instrument: "CME:NQU6", droppedMessages: 12 }),
    JSON.stringify({ templateId: 160, exchange: "CME", symbol: "NQU6", payload: { depthPrice: 1 } }),
    "{ this is not json",
  ]);
  const book = new RithmicBookStore({ maxTrades: 1000 });
  const result = await replayArchiveIntoBook({ dir, book, now: NOW });

  assert.equal(result.replayed, 1, "only real trades are replayed");
  assert.equal(book.trades("CME", "NQU6").length, 1);
  assert.ok(result.skipped >= 1, "the malformed line is counted, not silently ignored");
});

test("uncompressed archives replay too", async () => {
  const dir = archiveWith([tradeLine(29500, 7, 1, "t1")], { gzip: false });
  const book = new RithmicBookStore({ maxTrades: 1000 });
  const result = await replayArchiveIntoBook({ dir, book, now: NOW });
  assert.equal(result.replayed, 1);
});

test("a missing archive is reported, never fatal", async () => {
  const book = new RithmicBookStore({ maxTrades: 1000 });
  const result = await replayArchiveIntoBook({ dir: join(tmpdir(), "definitely-not-here"), book, now: NOW });
  assert.equal(result.replayed, 0);
  assert.ok(result.reason, "the reason is stated rather than failing silently");
});

test("historical replay merges without overwriting the live quote or sequence", () => {
  const archive = new RithmicBookStore({ maxTrades: 1000 });
  archive.applyTrade({ exchange: "CME", symbol: "NQU6", tradePrice: 29500, tradeSize: 2, aggressor: 1, sourceTradeId: "old", ssboe: 100 });
  const live = new RithmicBookStore({ maxTrades: 1000 });
  live.applyTrade({ exchange: "CME", symbol: "NQU6", tradePrice: 30125, tradeSize: 1, aggressor: 2, sourceTradeId: "live", ssboe: 200 });
  const before = live.snapshot("CME", "NQU6");

  assert.equal(live.mergeHistoricalTradesFrom(archive), 1);
  const after = live.snapshot("CME", "NQU6");
  assert.equal(after.lastPrice, 30125, "archive price cannot replace the live quote");
  assert.equal(after.sequence, before.sequence, "archive sequence cannot advance the live cursor");
  assert.deepEqual(live.trades("CME", "NQU6").map((trade) => trade.price), [29500, 30125]);
});
