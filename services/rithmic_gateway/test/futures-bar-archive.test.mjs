import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";

import {
  FuturesBarArchive,
  parseIntervalMs,
  resampleBars,
  tradeFromRecord,
  tradeTimestampMs,
  tradingDatesBetween,
} from "../src/futures-bar-archive.mjs";
import { chicagoTradingDate } from "../src/trading-session.mjs";

/**
 * Chart history built from the desk's own recorded Rithmic prints.
 *
 * Every print was already being recorded and none of it was ever turned into
 * bars, so history came from a vendor - and when that licence lapsed to a
 * delayed window the chart fell back to whatever the live stream had
 * accumulated since the pane opened.
 */

const withArchive = async (fn, options = {}) => {
  const dir = mkdtempSync(join(tmpdir(), "kwant-bars-"));
  try {
    await fn(new FuturesBarArchive({ dir, flushMs: 10_000, ...options }), dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

// 2026-08-31 14:30 UTC — inside the RTH session of CME trading date 2026-08-31.
const T0 = Date.parse("2026-08-31T14:30:00Z");
const print = (offsetMs, price, size) => ({
  exchange: "CME",
  symbol: "NQU6",
  receivedAt: new Date(T0 + offsetMs).toISOString(),
  payload: {
    tradePrice: price,
    tradeSize: size,
    ssboe: Math.floor((T0 + offsetMs) / 1000),
    usecs: 0,
  },
});

test("the exchange's own timestamp is preferred over our arrival time", () => {
  // A bar built from receivedAt drifts with our scheduling and lines up with
  // nobody else's chart.
  const exchangeMs = tradeTimestampMs({ ssboe: 1_788_000_000, usecs: 500_000 }, "2020-01-01T00:00:00Z");
  assert.equal(exchangeMs, 1_788_000_000_000 + 500);
  // Only when the wire carries neither field does arrival stand in.
  assert.equal(tradeTimestampMs({}, "2026-08-31T14:30:00Z"), T0);
});

test("only actual prints become bars", () => {
  assert.equal(tradeFromRecord({ payload: {} }), null, "a non-trade message became a bar");
  assert.equal(tradeFromRecord({ payload: { tradePrice: 0, tradeSize: 5 } }), null);
  assert.equal(tradeFromRecord({ payload: { tradePrice: 100, tradeSize: 0 } }), null);
  const trade = tradeFromRecord(print(0, 20_000.25, 3));
  assert.equal(trade.price, 20_000.25);
  assert.equal(trade.size, 3);
});

test("prints in one minute become one bar with true OHLCV", async () => {
  await withArchive(async (archive) => {
    archive.record(print(0, 100, 1));
    archive.record(print(1_000, 105, 2));
    archive.record(print(2_000, 95, 3));
    archive.record(print(3_000, 102, 4));
    const { candles } = await archive.load({
      exchange: "CME", symbol: "NQU6", interval: "1m", fromMs: T0 - 60_000, toMs: T0 + 60_000,
    });
    assert.equal(candles.length, 1);
    assert.deepEqual(
      { o: candles[0].open, h: candles[0].high, l: candles[0].low, c: candles[0].close, v: candles[0].volume },
      { o: 100, h: 105, l: 95, c: 102, v: 10 },
    );
  });
});

test("a print is never counted twice when both streams are live", async () => {
  /*
   * The recorder listens to rawMessage AND marketData, preferring the first.
   * Without the same guard here every bar's volume would be doubled, which is
   * the kind of wrong that looks plausible on a chart.
   */
  await withArchive(async (archive) => {
    const client = new EventEmitter();
    archive.attach(client);
    client.emit("rawMessage", print(0, 100, 5));
    client.emit("marketData", print(0, 100, 5));
    const { candles } = await archive.load({
      exchange: "CME", symbol: "NQU6", interval: "1m", fromMs: T0 - 60_000, toMs: T0 + 60_000,
    });
    assert.equal(candles.length, 1);
    assert.equal(candles[0].volume, 5, "the print was counted on both streams");
    archive.detach();
  });
});

test("bars survive a restart", async () => {
  // The reason this is written down at all rather than held in memory.
  await withArchive(async (archive, dir) => {
    archive.record(print(0, 100, 1));
    archive.record(print(60_000, 101, 2));
    await archive.flush();

    const restarted = new FuturesBarArchive({ dir });
    const { candles } = await restarted.load({
      exchange: "CME", symbol: "NQU6", interval: "1m", fromMs: T0 - 60_000, toMs: T0 + 120_000,
    });
    assert.equal(candles.length, 2, "the session did not survive the restart");
    assert.equal(candles[1].close, 101);
  });
});

test("old sessions fall back from today's contract to History Plant root bars", async () => {
  await withArchive(async (archive, dir) => {
    const timestamp = Date.parse("2025-01-02T15:00:00Z");
    const tradingDate = chicagoTradingDate(timestamp);
    const dayDir = join(dir, "bars", tradingDate);
    mkdirSync(dayDir, { recursive: true });
    writeFileSync(join(dayDir, "CME-NQ.json"), JSON.stringify({
      tradingDate,
      exchange: "CME",
      symbol: "NQ",
      source: "Rithmic History Plant minute bars",
      bars: [[timestamp, 21_000, 21_010, 20_995, 21_005, 123]],
    }));
    const result = await archive.load({
      exchange: "CME", symbol: "NQU6", interval: "1m", fromMs: timestamp - 1, toMs: timestamp + 1,
    });
    assert.equal(result.candles.length, 1);
    assert.equal(result.candles[0].close, 21_005);
  });
});

test("a flush merges with the session already on disk", async () => {
  /*
   * The offline backfill writes the same file. A live flush that overwrote it
   * would erase the session it had just rebuilt.
   */
  await withArchive(async (archive, dir) => {
    archive.record(print(0, 100, 1));
    await archive.flush();

    const second = new FuturesBarArchive({ dir });
    second.record(print(120_000, 103, 7));
    await second.flush();

    const reader = new FuturesBarArchive({ dir });
    const { candles } = await reader.load({
      exchange: "CME", symbol: "NQU6", interval: "1m", fromMs: T0 - 60_000, toMs: T0 + 300_000,
    });
    assert.equal(candles.length, 2, "the earlier bars were overwritten");
    assert.equal(candles[0].close, 100);
    assert.equal(candles[1].close, 103);
  });
});

test("minutes roll up to larger intervals", () => {
  const minutes = [
    { t: 0, o: 1, h: 4, l: 1, c: 3, v: 10 },
    { t: 60_000, o: 3, h: 9, l: 2, c: 8, v: 20 },
    { t: 120_000, o: 8, h: 8, l: 5, c: 6, v: 30 },
    { t: 300_000, o: 6, h: 7, l: 6, c: 7, v: 40 },
  ];
  const five = resampleBars(minutes, parseIntervalMs("5m"));
  assert.equal(five.length, 2);
  assert.deepEqual(five[0], { t: 0, o: 1, h: 9, l: 1, c: 6, v: 60 });
  assert.deepEqual(five[1], { t: 300_000, o: 6, h: 7, l: 6, c: 7, v: 40 });
});

test("resolution we do not have is not invented", () => {
  // Minute bars cannot become seconds. Relabelling them would be a lie the
  // chart would draw confidently.
  const minutes = [{ t: 0, o: 1, h: 2, l: 1, c: 2, v: 5 }];
  assert.equal(resampleBars(minutes, parseIntervalMs("30s")), minutes);
});

test("daily bars follow the 17:00 Chicago trading-session boundary", () => {
  const beforeRoll = Date.parse("2026-08-31T21:59:00Z");
  const afterRoll = Date.parse("2026-08-31T22:01:00Z");
  const rows = [
    { t: beforeRoll, o: 100, h: 101, l: 99, c: 100, v: 1 },
    { t: afterRoll, o: 200, h: 201, l: 199, c: 200, v: 1 },
  ];
  const daily = resampleBars(rows, parseIntervalMs("1D"), "1D");
  assert.equal(daily.length, 2, "UTC bucketing merged two CME sessions into one day");
  assert.deepEqual(daily.map((bar) => bar.c), [100, 200]);
  assert.equal(parseIntervalMs("1M"), 30 * 86_400_000, "monthly was silently parsed as one minute");
});

test("a window spanning the 17:00 roll reads both session files", async () => {
  /*
   * A print at 16:59 Chicago and one at 17:01 belong to different trading
   * dates and therefore different files. A chart asking across that boundary
   * must get both or it shows a hole exactly at the session open.
   */
  await withArchive(async (archive) => {
    const beforeRoll = Date.parse("2026-08-31T21:30:00Z");  // 16:30 Chicago
    const afterRoll = Date.parse("2026-08-31T22:30:00Z");   // 17:30 Chicago
    const at = (ms, price) => ({
      exchange: "CME", symbol: "NQU6", receivedAt: new Date(ms).toISOString(),
      payload: { tradePrice: price, tradeSize: 1, ssboe: Math.floor(ms / 1000), usecs: 0 },
    });
    archive.record(at(beforeRoll, 200));
    archive.record(at(afterRoll, 300));
    assert.equal(archive.open.size, 2, "both sides of the roll landed in one session");

    const { candles } = await archive.load({
      exchange: "CME", symbol: "NQU6", interval: "1m",
      fromMs: beforeRoll - 60_000, toMs: afterRoll + 60_000,
    });
    assert.deepEqual(candles.map((c) => c.close), [200, 300]);
  });
});

test("trading dates across a window are enumerated, not guessed", () => {
  const from = Date.parse("2026-08-27T15:00:00Z");
  const to = Date.parse("2026-08-31T15:00:00Z");
  const dates = tradingDatesBetween(from, to);
  assert.ok(dates.length >= 4, `expected several sessions, got ${dates.length}`);
  assert.deepEqual([...dates].sort(), dates, "sessions are not in order");
  assert.equal(new Set(dates).size, dates.length, "a session was enumerated twice");
});

test("an unknown instrument never becomes a bar", async () => {
  await withArchive(async (archive) => {
    archive.record({ receivedAt: new Date(T0).toISOString(), payload: { tradePrice: 1, tradeSize: 1 } });
    const { candles } = await archive.load({
      exchange: "UNKNOWN", symbol: "UNKNOWN", interval: "1m", fromMs: T0 - 60_000, toMs: T0 + 60_000,
    });
    assert.equal(candles.length, 0);
  });
});

test("the served window is bounded and keeps the most recent bars", async () => {
  await withArchive(async (archive) => {
    for (let minute = 0; minute < 50; minute += 1) {
      archive.record(print(minute * 60_000, 100 + minute, 1));
    }
    const { candles } = await archive.load({
      exchange: "CME", symbol: "NQU6", interval: "1m",
      fromMs: T0 - 60_000, toMs: T0 + 60 * 60_000, limit: 10,
    });
    assert.equal(candles.length, 10);
    assert.equal(candles.at(-1).close, 149, "the limit dropped the live edge instead of the oldest bars");
  });
});
