import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";

import {
  TradeTapeArchive, backfillFileName, encodeTrade, decodeTrade, sideCode,
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

test("the wire's numeric aggressor is understood", () => {
  /*
   * The failure this shipped with. Rithmic sends the aggressor as an enum -
   * 1 = buy, 2 = sell, the same two values book-store.mjs has always mapped -
   * and this read the field as text, so every live print stringified to "1",
   * matched nothing, and was stored as "the feed did not say". Measured on the
   * live tape: 4,060 of 4,060 prints sided 0, which would have made every
   * delta bar built from this tape read flat.
   */
  assert.equal(sideCode({ aggressor: 1 }), 1);
  assert.equal(sideCode({ aggressor: 2 }), -1);
  assert.equal(sideCode({ aggressor: "1" }), 1, "the archived record stores it as a string on some paths");
  assert.equal(sideCode({ aggressor: "2" }), -1);
  // An unrecognised code is not a side. A guess is worse than an absence.
  assert.equal(sideCode({ aggressor: 0 }), 0);
  assert.equal(sideCode({ aggressor: 7 }), 0);
  assert.equal(sideCode({}), 0);
});

test("a bid-hitting print is a sell, not a buy", () => {
  // ASK and BID name the side that was HIT, so they invert. "BID" also starts
  // with a B, and the previous ordering let the B-prefix branch claim it -
  // classifying every seller-aggressive print as a buy.
  assert.equal(sideCode({ aggressor: "BID" }), -1);
  assert.equal(sideCode({ aggressor: "ASK" }), 1);
  assert.equal(sideCode({ aggressor: "BUY" }), 1);
  assert.equal(sideCode({ aggressor: "SELL" }), -1);
});

test("a multi-day window reads every session it covers", async () => {
  /*
   * The loader took only the window's first and last trading dates, so a
   * five-day chart request read two session files and silently skipped
   * everything between them. Measured live: NQ asked for five days of
   * 40-range bars and got three sessions - which reads as "the archive has no
   * more", not as a bug.
   */
  const dir = mkdtempSync(join(tmpdir(), "kwant-tape-"));
  try {
    const archive = new TradeTapeArchive({ dir, roots: ["NQ"], flushMs: 10_000 });
    const DAY = 24 * 60 * 60_000;
    // Five consecutive sessions, one print each.
    const written = [];
    for (let back = 0; back < 5; back += 1) {
      const at = T0 - back * DAY;
      const dayDir = join(dir, "trades", chicagoTradingDate(at));
      mkdirSync(dayDir, { recursive: true });
      writeFileSync(
        join(dayDir, backfillFileName("CME", "NQU6")),
        gzipSync(Buffer.from(`${JSON.stringify([at, 29000 + back, 1, 1])}\n`)),
      );
      written.push(29000 + back);
    }
    const { trades } = await archive.load({
      exchange: "CME", symbol: "NQU6", fromMs: T0 - 5 * DAY, toMs: T0 + 60_000,
    });
    assert.equal(
      trades.length, written.length,
      `only ${trades.length} of ${written.length} sessions in the window were read`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a cut-short window says so, and stops reading once it is full", async () => {
  /*
   * Two separate failures. The cap was applied after reading everything, so a
   * six-day NQ request loaded 6.8 million prints, sorted them, and returned
   * the newest 500,000 - thirteen times the work for the same answer, on a
   * box that is also carrying the live feed. And the response said nothing
   * about being cut short, which makes a chart that stops part-way through
   * the requested history look exactly like one whose archive ends there.
   */
  const dir = mkdtempSync(join(tmpdir(), "kwant-tape-"));
  try {
    const archive = new TradeTapeArchive({ dir, roots: ["NQ"], flushMs: 10_000 });
    const DAY = 24 * 60 * 60_000;
    for (let back = 0; back < 4; back += 1) {
      const at = T0 - back * DAY;
      const dayDir = join(dir, "trades", chicagoTradingDate(at));
      mkdirSync(dayDir, { recursive: true });
      const rows = [0, 1, 2].map((n) => JSON.stringify([at + n * 1_000, 29000 + back, 1, 1]));
      writeFileSync(
        join(dayDir, backfillFileName("CME", "NQU6")),
        gzipSync(Buffer.from(`${rows.join("\n")}\n`)),
      );
    }
    const window = { exchange: "CME", symbol: "NQU6", fromMs: T0 - 4 * DAY, toMs: T0 + 60_000 };

    const full = await archive.load(window);
    assert.equal(full.trades.length, 12);
    assert.equal(full.truncated, false, "a complete window must not claim to be cut short");
    assert.equal(full.earliestMs, full.trades[0].timestamp);

    // A limit that only the newest sessions can satisfy.
    const capped = await archive.load({ ...window, limit: 4 });
    assert.equal(capped.truncated, true, "a cut-short window did not say so");
    assert.equal(capped.trades.length, 4);
    // The newest prints are the ones kept - a chart needs the live edge.
    assert.equal(capped.trades.at(-1).timestamp, full.trades.at(-1).timestamp);
    assert.equal(capped.earliestMs, capped.trades[0].timestamp);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a page cutoff retains every execution sharing its millisecond", async () => {
  await withArchive(async (archive) => {
    const client = new EventEmitter();
    archive.attach(client);
    for (let index = 0; index < 6; index += 1) {
      client.emit("rawMessage", print(index < 3 ? 0 : index * 1_000, 29000 + index, 1));
    }
    await archive.close();
    const page = await archive.load({
      exchange: "CME", symbol: "NQU6", fromMs: T0 - 1, toMs: T0 + 10_000, limit: 5,
    });
    assert.equal(page.truncated, true);
    assert.equal(
      page.trades.filter((trade) => trade.timestamp === T0).length,
      3,
      "pagination split legitimate same-millisecond executions",
    );
  });
});

test("sub-minute bars are folded from executions with exact OHLCV and flow", async () => {
  await withArchive(async (archive) => {
    const client = new EventEmitter();
    archive.attach(client);
    client.emit("rawMessage", print(0, 100, 2, "BUY"));
    client.emit("rawMessage", print(1_000, 105, 3, "SELL"));
    client.emit("rawMessage", print(2_000, 95, 4, "BUY"));
    client.emit("rawMessage", print(6_000, 102, 5, "SELL"));
    await archive.close();
    const result = await archive.loadTimeBars({
      exchange: "CME", symbol: "NQU6", interval: "5s", intervalMs: 5_000,
      fromMs: T0 - 1, toMs: T0 + 10_000,
    });
    assert.equal(result.candles.length, 2);
    assert.deepEqual(
      result.candles.map(({ open, high, low, close, volume, askVolume, bidVolume, delta }) => (
        { open, high, low, close, volume, askVolume, bidVolume, delta }
      )),
      [
        { open: 100, high: 105, low: 95, close: 95, volume: 9, askVolume: 6, bidVolume: 3, delta: 3 },
        { open: 102, high: 102, low: 102, close: 102, volume: 5, askVolume: 0, bidVolume: 5, delta: -5 },
      ],
    );
  });
});

test("event bars are folded once beside the tape with exact flow and a shared cache", async () => {
  await withArchive(async (archive) => {
    const client = new EventEmitter();
    archive.attach(client);
    const rows = [
      [0, 100, 2, "BUY"],
      [1_000, 105, 3, "SELL"],
      [2_000, 110, 4, "BUY"],
      [3_000, 99, 5, "SELL"],
      [4_000, 112, 6, "BUY"],
    ];
    for (const [offset, price, size, side] of rows) {
      client.emit("rawMessage", print(offset, price, size, side));
    }
    await archive.close();

    const args = {
      exchange: "CME", symbol: "NQU6", interval: "40r",
      fromMs: T0 - 1, toMs: T0 + 10_000,
    };
    const first = await archive.loadEventBars(args);
    const second = await archive.loadEventBars(args);
    assert.strictEqual(second, first, "identical pane requests did not share the settled event result");
    assert.ok(first.candles.length >= 2);
    assert.equal(first.sourceRecordCount, rows.length);
    assert.equal(first.executions.reduce((sum, row) => sum + row[2], 0), 20);
    assert.equal(first.candles.reduce((sum, candle) => sum + candle.volume, 0), 20);
    assert.ok(first.candles.every((candle) => candle.high >= candle.low));
  });
});
