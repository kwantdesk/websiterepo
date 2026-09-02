import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";

import {
  TradeTapeArchive, backfillFileName, encodeTrade, decodeTrade,
} from "../src/trade-tape-archive.mjs";
import { chicagoTradingDate } from "../src/trading-session.mjs";

/**
 * Range and volume bars get a history.
 *
 * They cannot be derived from minute bars: a 40-range bar closes when price
 * has travelled forty ticks and a volume bar when a contract count is reached,
 * so both need the individual prints - the path taken WITHIN a minute is
 * exactly the information an OHLC minute throws away. The website asked the
 * vendor for a raw trades feed to build them and that subscription is gone, so
 * those chart types have had no history at all.
 *
 * The prints exist in the raw tape, but a 2.2 GB session that takes 198
 * seconds to extract is not a serving format.
 */

const withArchive = async (fn, options = {}) => {
  const dir = mkdtempSync(join(tmpdir(), "kwant-tape-"));
  try {
    const archive = new TradeTapeArchive({ dir, roots: ["NQ"], flushMs: 10_000, ...options });
    await fn(archive, dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const T0 = Date.parse("2026-08-31T14:30:00Z");
const print = (offsetMs, price, size, aggressor = "BUY") => ({
  exchange: "CME",
  symbol: "NQU6",
  receivedAt: new Date(T0 + offsetMs).toISOString(),
  payload: {
    tradePrice: price,
    tradeSize: size,
    aggressor,
    ssboe: Math.floor((T0 + offsetMs) / 1000),
    usecs: (offsetMs % 1000) * 1000,
  },
});

test("a print survives the round trip with its four fields", () => {
  const row = encodeTrade({ timestamp: T0, price: 29000.25, size: 3 }, 1);
  assert.deepEqual(row, [T0, 29000.25, 3, 1]);
  assert.deepEqual(decodeTrade(row), { timestamp: T0, price: 29000.25, size: 3, side: 1 });
});

test("every print is written and read back in order", async () => {
  await withArchive(async (archive) => {
    const client = new EventEmitter();
    archive.attach(client);
    // Deliberately out of order on arrival; the tape must come back sorted.
    client.emit("rawMessage", print(2_000, 29010, 2));
    client.emit("rawMessage", print(0, 29000, 1));
    client.emit("rawMessage", print(1_000, 29005, 5, "SELL"));
    await archive.close();

    const { trades } = await archive.load({
      exchange: "CME", symbol: "NQU6", fromMs: T0 - 60_000, toMs: T0 + 60_000,
    });
    assert.equal(trades.length, 3, `expected 3 prints, got ${trades.length}`);
    assert.deepEqual(trades.map((trade) => trade.price), [29000, 29005, 29010]);
    assert.deepEqual(trades.map((trade) => trade.size), [1, 5, 2]);
  });
});

test("the aggressor side is kept, because delta bars need it", async () => {
  await withArchive(async (archive) => {
    const client = new EventEmitter();
    archive.attach(client);
    client.emit("rawMessage", print(0, 29000, 1, "BUY"));
    client.emit("rawMessage", print(1_000, 29001, 1, "SELL"));
    client.emit("rawMessage", print(2_000, 29002, 1, ""));
    await archive.close();
    const { trades } = await archive.load({ exchange: "CME", symbol: "NQU6", fromMs: T0 - 1, toMs: T0 + 60_000 });
    assert.deepEqual(trades.map((trade) => trade.side), [1, -1, 0], "an unknown side must not be guessed");
  });
});

test("a print is never counted twice when both streams are live", async () => {
  // The recorder's rule: prefer the decoded wire message. Without it every
  // bar's volume doubles, which looks plausible on a chart.
  await withArchive(async (archive) => {
    const client = new EventEmitter();
    archive.attach(client);
    client.emit("rawMessage", print(0, 29000, 4));
    client.emit("marketData", print(0, 29000, 4));
    await archive.close();
    const { trades } = await archive.load({ exchange: "CME", symbol: "NQU6", fromMs: T0 - 1, toMs: T0 + 1_000 });
    assert.equal(trades.length, 1);
  });
});

test("only the instruments that earn the space get a tape", async () => {
  /*
   * A tape is ~400,000 rows a session per instrument and the disk is the
   * binding constraint, so this is deliberately not everything.
   */
  await withArchive(async (archive) => {
    const client = new EventEmitter();
    archive.attach(client);
    client.emit("rawMessage", print(0, 29000, 1));
    client.emit("rawMessage", { ...print(0, 4300, 1), symbol: "GCV6", exchange: "COMEX" });
    await archive.close();
    const kept = await archive.load({ exchange: "CME", symbol: "NQU6", fromMs: T0 - 1, toMs: T0 + 1_000 });
    const skipped = await archive.load({ exchange: "COMEX", symbol: "GCV6", fromMs: T0 - 1, toMs: T0 + 1_000 });
    assert.equal(kept.trades.length, 1);
    assert.equal(skipped.trades.length, 0, "an instrument outside the configured roots was taped");
  });
});

test("a contract roll does not stop the tape", async () => {
  // Roots are matched by prefix, so NQZ6 keeps recording when NQU6 expires.
  await withArchive(async (archive) => {
    const client = new EventEmitter();
    archive.attach(client);
    client.emit("rawMessage", { ...print(0, 29000, 1), symbol: "NQZ6" });
    await archive.close();
    const { trades } = await archive.load({ exchange: "CME", symbol: "NQZ6", fromMs: T0 - 1, toMs: T0 + 1_000 });
    assert.equal(trades.length, 1);
  });
});

test("the window is honoured", async () => {
  await withArchive(async (archive) => {
    const client = new EventEmitter();
    archive.attach(client);
    for (let minute = 0; minute < 10; minute += 1) {
      client.emit("rawMessage", print(minute * 60_000, 29000 + minute, 1));
    }
    await archive.close();
    const { trades } = await archive.load({
      exchange: "CME", symbol: "NQU6", fromMs: T0 + 3 * 60_000, toMs: T0 + 5 * 60_000,
    });
    assert.deepEqual(trades.map((trade) => trade.price), [29003, 29004, 29005]);
  });
});

test("the response is bounded and keeps the most recent prints", async () => {
  await withArchive(async (archive) => {
    const client = new EventEmitter();
    archive.attach(client);
    for (let index = 0; index < 50; index += 1) client.emit("rawMessage", print(index * 1_000, 29000 + index, 1));
    await archive.close();
    const { trades } = await archive.load({
      exchange: "CME", symbol: "NQU6", fromMs: T0 - 1, toMs: T0 + 60 * 1_000, limit: 10,
    });
    assert.equal(trades.length, 10);
    assert.equal(trades.at(-1).price, 29049, "the limit dropped the live edge instead of the oldest prints");
  });
});

test("the micros are taped, not just the minis", async () => {
  /*
   * MNQU6 does not start with "NQ" and MESU6 does not start with "ES", so a
   * tape configured only for the minis records nothing at all for the micros -
   * which is what it did before, silently.
   */
  const { DEFAULT_TAPE_ROOTS } = await import("../src/trade-tape-archive.mjs");
  for (const root of ["NQ", "MNQ", "ES", "MES"]) {
    assert.ok(DEFAULT_TAPE_ROOTS.includes(root), `${root} has no tape`);
  }
  const dir = mkdtempSync(join(tmpdir(), "kwant-tape-"));
  try {
    const archive = new TradeTapeArchive({ dir, flushMs: 10_000 });
    const client = new EventEmitter();
    archive.attach(client);
    for (const symbol of ["NQU6", "MNQU6", "ESU6", "MESU6"]) {
      client.emit("rawMessage", { ...print(0, 29000, 1), symbol });
    }
    await archive.close();
    for (const symbol of ["NQU6", "MNQU6", "ESU6", "MESU6"]) {
      const { trades } = await archive.load({
        exchange: "CME", symbol, fromMs: T0 - 1, toMs: T0 + 1_000,
      });
      assert.equal(trades.length, 1, `${symbol} was not taped`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the tape is readable while the session is still running", async () => {
  /*
   * The failure this was shipped with. Deflate holds its output until it has
   * enough to emit, so the file was write-only until the session closed: a
   * chart asking for the last hour got an empty response while thousands of
   * prints sat in the compressor. Measured live: 2,744 written, 0 readable.
   */
  const dir = mkdtempSync(join(tmpdir(), "kwant-tape-"));
  try {
    const archive = new TradeTapeArchive({ dir, roots: ["NQ"], flushMs: 10_000 });
    const client = new EventEmitter();
    archive.attach(client);
    for (let index = 0; index < 25; index += 1) {
      client.emit("rawMessage", print(index * 1_000, 29000 + index, 1));
    }
    // Flushed, but deliberately NOT closed - the session is still live.
    archive.flush();
    await new Promise((resolve) => setTimeout(resolve, 150));

    const { trades } = await archive.load({
      exchange: "CME", symbol: "NQU6", fromMs: T0 - 1, toMs: T0 + 60_000,
    });
    assert.ok(trades.length >= 25, `only ${trades.length} of 25 prints were readable mid-session`);
    await archive.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an absent session is empty, not an error", async () => {
  await withArchive(async (archive) => {
    const { trades } = await archive.load({
      exchange: "CME", symbol: "NQU6", fromMs: T0 - 1, toMs: T0 + 1_000,
    });
    assert.deepEqual(trades, []);
  });
});

test("a backfilled sidecar is read as one series with the live tape", async () => {
  /*
   * The collector only records from the moment it starts, so the first hours
   * of a session it was restarted into have no live tape at all. Rewriting the
   * live file to add them is not an option - the collector holds it open, and
   * publishing over it by rename would strand that handle and send the rest of
   * the session to a file nothing reads. So the backfill writes a sidecar and
   * the loader reads the pair.
   */
  const dir = mkdtempSync(join(tmpdir(), "kwant-tape-"));
  try {
    const archive = new TradeTapeArchive({ dir, roots: ["NQ"], flushMs: 10_000 });
    const client = new EventEmitter();
    archive.attach(client);
    // The live tape starts late, at T0 + 5 minutes.
    client.emit("rawMessage", print(5 * 60_000, 29005, 1));
    client.emit("rawMessage", print(6 * 60_000, 29006, 1));
    await archive.close();

    // The backfill fills in what came before it.
    const dayDir = join(dir, "trades", chicagoTradingDate(T0));
    const rows = [0, 1, 2].map((minute) => JSON.stringify([T0 + minute * 60_000, 29000 + minute, 1, 1]));
    writeFileSync(
      join(dayDir, backfillFileName("CME", "NQU6")),
      gzipSync(Buffer.from(`${rows.join("\n")}\n`)),
    );

    const { trades } = await archive.load({
      exchange: "CME", symbol: "NQU6", fromMs: T0 - 1, toMs: T0 + 10 * 60_000,
    });
    assert.deepEqual(
      trades.map((trade) => trade.price),
      [29000, 29001, 29002, 29005, 29006],
      "the backfill and the live tape did not merge into one ordered series",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a session with only a backfill still loads", async () => {
  // Every session recorded before the tape existed is this case.
  const dir = mkdtempSync(join(tmpdir(), "kwant-tape-"));
  try {
    const archive = new TradeTapeArchive({ dir, roots: ["NQ"], flushMs: 10_000 });
    const dayDir = join(dir, "trades", chicagoTradingDate(T0));
    mkdirSync(dayDir, { recursive: true });
    writeFileSync(
      join(dayDir, backfillFileName("CME", "NQU6")),
      gzipSync(Buffer.from(`${JSON.stringify([T0, 29000, 4, -1])}\n`)),
    );
    const { trades } = await archive.load({
      exchange: "CME", symbol: "NQU6", fromMs: T0 - 1, toMs: T0 + 1_000,
    });
    assert.deepEqual(trades, [{ timestamp: T0, price: 29000, size: 4, side: -1 }]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
