import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { BarFlowArchive, foldPrintsToMinutes, resampleFlow } from "../src/bar-flow-archive.mjs";
import { backfillFileName } from "../src/trade-tape-archive.mjs";
import { chicagoTradingDate } from "../src/trading-session.mjs";

/**
 * Per-bar aggressor flow for footprint, CVD, delta and Big Trades.
 *
 * The website used to rebuild this by streaming the vendor's raw trades. That
 * subscription is gone, and because the flow was fetched inside the same call
 * as the bars, its failure threw the BARS away too - so every time-based chart
 * fell back to what it had accumulated live and showed only the last few
 * minutes, on every timeframe at once.
 */

const T0 = Date.parse("2026-08-31T14:30:00Z");
const print = (offsetMs, price, size, side) => ({
  timestamp: T0 + offsetMs, price, size, side,
});

test("a minute carries the bid/ask split, not just volume", () => {
  const { minutes } = foldPrintsToMinutes([
    print(0, 29000, 3, 1),
    print(1_000, 29001, 2, -1),
    print(2_000, 29002, 5, 0),
  ]);
  assert.equal(minutes.length, 1);
  const [row] = minutes;
  assert.equal(row.volume, 10, "every print counts toward volume");
  assert.equal(row.trades, 3);
  assert.equal(row.askVolume, 3);
  assert.equal(row.bidVolume, 2);
  // The sideless print moves no delta. The feed did not say which way it went,
  // and a guessed side is worse than an absent one.
  assert.equal(row.delta, 1);
});

test("delta extremes are the running path, not the total", () => {
  // +5 then -8 ends at -3, but the bar genuinely reached +5 on the way.
  const { minutes } = foldPrintsToMinutes([
    print(0, 29000, 5, 1),
    print(1_000, 29001, 8, -1),
  ]);
  assert.equal(minutes[0].delta, -3);
  assert.equal(minutes[0].deltaHigh, 5, "the bar's delta high was lost");
  assert.equal(minutes[0].deltaLow, -3);
});

test("delta extremes compose exactly onto a larger interval", () => {
  /*
   * The reason the extremes are stored relative to each minute's own start.
   * A five-minute bar's delta high is not the highest of its minutes' highs -
   * it is the highest point of the cumulative path across all five, which is
   * each minute's running total at its start plus that minute's own path.
   */
  const minutes = [
    { t: T0, volume: 4, trades: 2, askVolume: 4, bidVolume: 0, delta: 4, deltaHigh: 4, deltaLow: 0 },
    { t: T0 + 60_000, volume: 3, trades: 1, askVolume: 3, bidVolume: 0, delta: 3, deltaHigh: 3, deltaLow: 0 },
    { t: T0 + 120_000, volume: 9, trades: 2, askVolume: 0, bidVolume: 9, delta: -9, deltaHigh: 0, deltaLow: -9 },
  ];
  const bucket = resampleFlow(minutes, 300_000).get(Math.floor(T0 / 300_000) * 300_000);
  assert.equal(bucket.delta, -2, "4 + 3 - 9");
  // The path ran 0 -> 4 -> 7 -> -2, so the five-minute bar peaked at 7.
  assert.equal(bucket.deltaHigh, 7, "the composed delta high is wrong");
  assert.equal(bucket.deltaLow, -2);
  assert.equal(bucket.volume, 16);
  assert.equal(bucket.trades, 5);
  assert.equal(bucket.askVolume, 7);
  assert.equal(bucket.bidVolume, 9);
});

test("the strongest prints of each minute are kept, not the latest", () => {
  /*
   * Keeping the most recent made Big Trades appear to begin at the moment the
   * indicator was switched on.
   */
  const prints = [];
  for (let index = 0; index < 40; index += 1) prints.push(print(index * 1_000, 29000 + index, index + 1, 1));
  const { executions } = foldPrintsToMinutes(prints);
  assert.equal(executions.length, 12, "the per-minute cap was not applied");
  const sizes = executions.map((row) => row[2]).sort((a, b) => a - b);
  assert.equal(sizes[0], 29, "a smaller print displaced a larger one");
  assert.equal(sizes.at(-1), 40);
});

test("a sideless print is never a big trade", () => {
  // It carries no delta, so it cannot be shown as buying or selling pressure.
  const { executions } = foldPrintsToMinutes([print(0, 29000, 5000, 0)]);
  assert.deepEqual(executions, []);
});

test("an untaped instrument returns no flow rather than zeros", async () => {
  /*
   * Only the four event-bar contracts are taped. A real zero delta means the
   * market traded balanced; an absent one means nobody recorded the side, and
   * a chart must be able to tell those apart.
   */
  const dir = mkdtempSync(join(tmpdir(), "kwant-flow-"));
  try {
    const archive = new BarFlowArchive({ dir });
    const { flow, executions } = await archive.load({
      exchange: "COMEX", symbol: "GCV6", interval: "5m", fromMs: T0 - 60_000, toMs: T0 + 60_000,
    });
    assert.equal(flow.size, 0);
    assert.deepEqual(executions, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("flow is read from the recorded tape and keyed by bar", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kwant-flow-"));
  try {
    const tradingDate = chicagoTradingDate(T0);
    const dayDir = join(dir, "trades", tradingDate);
    mkdirSync(dayDir, { recursive: true });
    const rows = [
      [T0, 29000, 4, 1],
      [T0 + 30_000, 29001, 1, -1],
      [T0 + 90_000, 29002, 2, 1],
    ].map((row) => JSON.stringify(row));
    writeFileSync(
      join(dayDir, backfillFileName("CME", "NQU6")),
      gzipSync(Buffer.from(`${rows.join("\n")}\n`)),
    );

    const archive = new BarFlowArchive({ dir });
    /*
     * Folded up front, because load() deliberately will not do it. Folding
     * reads a whole session and the gateway is one process, so doing it inside
     * a request blocked the event loop that also serves options, GEX and the
     * live feed - it took the desk down at the open.
     */
    await archive.sessionFlow(tradingDate, "CME", "NQU6", true);
    const minute = await archive.load({
      exchange: "CME", symbol: "NQU6", interval: "1m", fromMs: T0 - 60_000, toMs: T0 + 300_000,
    });
    assert.equal(minute.flow.get(T0).delta, 3, "4 bought, 1 sold");
    assert.equal(minute.flow.get(T0 + 60_000).delta, 2);

    // The same prints, rolled up: one five-minute bar carrying all of them.
    const fiveMinute = await archive.load({
      exchange: "CME", symbol: "NQU6", interval: "5m", fromMs: T0 - 60_000, toMs: T0 + 300_000,
    });
    const bucket = fiveMinute.flow.get(Math.floor(T0 / 300_000) * 300_000);
    assert.equal(bucket.delta, 5);
    assert.equal(bucket.volume, 7);
    assert.equal(bucket.askVolume, 6);
    assert.equal(bucket.bidVolume, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a completed session is cached on disk, the live one never is", async () => {
  /*
   * Caching the session in progress would freeze it at whatever the market had
   * done when the first chart asked, and every later request would read that
   * stale file back instead of the prints that have arrived since.
   */
  const dir = mkdtempSync(join(tmpdir(), "kwant-flow-"));
  try {
    const archive = new BarFlowArchive({ dir });
    const today = chicagoTradingDate(Date.now());
    const past = chicagoTradingDate(T0);
    assert.notEqual(today, past, "this test needs a completed session");

    for (const [tradingDate, at] of [[past, T0], [today, Date.now()]]) {
      const dayDir = join(dir, "trades", tradingDate);
      mkdirSync(dayDir, { recursive: true });
      writeFileSync(
        join(dayDir, backfillFileName("CME", "NQU6")),
        gzipSync(Buffer.from(`${JSON.stringify([at, 29000, 1, 1])}\n`)),
      );
    }
    await archive.sessionFlow(past, "CME", "NQU6");
    await archive.sessionFlow(today, "CME", "NQU6");

    const { existsSync } = await import("node:fs");
    assert.ok(
      existsSync(join(dir, "flow", past, "CME-NQU6.flow.json.gz")),
      "a completed session was not cached",
    );
    assert.ok(
      !existsSync(join(dir, "flow", today, "CME-NQU6.flow.json.gz")),
      "the live session was frozen to disk",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a request never folds a session itself; the warmer does", async () => {
  /*
   * The outage this is guarding. Folding reads a whole session's prints, and
   * the gateway is one Node process: doing that on the request path blocked
   * the event loop serving options, GEX, quotes and the live feed. Measured
   * during the incident: /health timing out at 25s.
   */
  const dir = mkdtempSync(join(tmpdir(), "kwant-flow-"));
  try {
    const tradingDate = chicagoTradingDate(T0);
    const dayDir = join(dir, "trades", tradingDate);
    mkdirSync(dayDir, { recursive: true });
    writeFileSync(
      join(dayDir, backfillFileName("CME", "NQU6")),
      gzipSync(Buffer.from(`${JSON.stringify([T0, 29000, 4, 1])}
`)),
    );
    const archive = new BarFlowArchive({ dir });

    const cold = await archive.load({
      exchange: "CME", symbol: "NQU6", interval: "1m", fromMs: T0 - 1, toMs: T0 + 60_000,
    });
    assert.equal(cold.flow.size, 0, "a request folded a session on the spot");
    assert.equal(archive.status().pending, 1, "the session was not queued for the warmer");

    // What the warmer does, minus the timer.
    await archive.sessionFlow(tradingDate, "CME", "NQU6", true);
    const warm = await archive.load({
      exchange: "CME", symbol: "NQU6", interval: "1m", fromMs: T0 - 1, toMs: T0 + 60_000,
    });
    assert.equal(warm.flow.get(T0).delta, 4, "the warmer did not fill the flow in");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
