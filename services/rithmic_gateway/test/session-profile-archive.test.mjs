import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import {
  SessionProfileArchive, foldPrintsToMinuteLevels, sumMinuteLevels,
} from "../src/session-profile-archive.mjs";
import { backfillFileName } from "../src/trade-tape-archive.mjs";
import { chicagoTradingDate } from "../src/trading-session.mjs";

/**
 * Traded volume per price, for windows the live execution ring cannot reach.
 *
 * The profile route builds from a bounded in-memory ring. Measured
 * mid-session it reached back only to 14:04Z, so that day's Asia window
 * (00:00-07:00Z) came back covering 00:00-01:01 and London's covered
 * 14:04-15:59 of 08:00-16:00 - every figure computed correctly over the wrong
 * span. As the day rolls on each session falls out of the ring in turn, which
 * is what "the daily profiles keep disappearing" was.
 */

const T0 = Date.parse("2026-08-31T14:30:00Z");
const TICK = 0.25;
const print = (offsetMs, price, size, side) => ({
  timestamp: T0 + offsetMs, price, size, side,
});

test("volume lands on the price it traded at", () => {
  const minutes = foldPrintsToMinuteLevels([
    print(0, 29000.25, 3, 1),
    print(1_000, 29000.25, 2, -1),
    print(2_000, 29000.5, 5, 1),
  ], TICK);
  assert.equal(minutes.length, 1);
  const levels = new Map(minutes[0].levels.map((row) => [row[0] * TICK, row]));
  assert.deepEqual(levels.get(29000.25).slice(1), [5, 3, 2, 2], "volume/ask/bid/trades at 29000.25");
  assert.deepEqual(levels.get(29000.5).slice(1), [5, 5, 0, 1]);
});

test("a price is keyed as an integer tick, not a float", () => {
  /*
   * A profile keys on exact price equality and 29,131.75 does not survive a
   * float round trip reliably enough to be a map key - two prints at the same
   * price landing in two rows would split the level and move the POC.
   */
  const minutes = foldPrintsToMinuteLevels([
    print(0, 29131.75, 4, 1),
    print(1_000, 29131.75, 6, 1),
  ], TICK);
  assert.equal(minutes[0].levels.length, 1, "one price split into two rows");
  assert.equal(minutes[0].levels[0][1], 10);
  assert.equal(Number.isInteger(minutes[0].levels[0][0]), true, "the key must be an integer tick");
});

test("a sideless print is volume, but is neither a buy nor a sell", () => {
  // It traded, so it belongs in the profile; the feed did not say which way,
  // so it cannot be attributed to either half of the delta.
  const minutes = foldPrintsToMinuteLevels([print(0, 29000, 7, 0)], TICK);
  const [, volume, askVolume, bidVolume] = minutes[0].levels[0];
  assert.equal(volume, 7);
  assert.equal(askVolume, 0);
  assert.equal(bidVolume, 0);
});

test("a window is the exact sum of the minutes inside it", () => {
  /*
   * The property the whole design rests on: a profile SUMS, so any window on a
   * minute boundary is reconstructed exactly from folded minutes. Every
   * session the product offers is such a window.
   */
  const prints = [];
  for (let minute = 0; minute < 10; minute += 1) {
    prints.push(print(minute * 60_000, 29000 + minute, minute + 1, 1));
    prints.push(print(minute * 60_000 + 1_000, 29000, 2, -1));
  }
  const minutes = foldPrintsToMinuteLevels(prints, TICK);

  // Minutes 3, 4 and 5 only.
  const { totals } = sumMinuteLevels(minutes, T0 + 3 * 60_000, T0 + 6 * 60_000);
  const at = (price) => totals.get(Math.round(price / TICK));
  assert.equal(at(29003).volume, 4);
  assert.equal(at(29004).volume, 5);
  assert.equal(at(29005).volume, 6);
  assert.equal(at(29006), undefined, "a minute outside the window was counted");
  // 29000 collected the three sell prints of those minutes.
  assert.equal(at(29000).volume, 6);
  assert.equal(at(29000).bidVolume, 6);
});

test("a window boundary belongs to one session, not both", () => {
  // End-exclusive, so two adjacent sessions never both claim the shared minute.
  const minutes = foldPrintsToMinuteLevels([
    print(0, 29000, 1, 1),
    print(60_000, 29001, 1, 1),
  ], TICK);
  const first = sumMinuteLevels(minutes, T0, T0 + 60_000);
  const second = sumMinuteLevels(minutes, T0 + 60_000, T0 + 120_000);
  assert.equal(first.totals.size, 1);
  assert.equal(second.totals.size, 1);
  assert.ok(first.totals.has(Math.round(29000 / TICK)));
  assert.ok(second.totals.has(Math.round(29001 / TICK)));
});

const withTape = (rows) => {
  const dir = mkdtempSync(join(tmpdir(), "kwant-profile-"));
  const tradingDate = chicagoTradingDate(T0);
  const dayDir = join(dir, "trades", tradingDate);
  mkdirSync(dayDir, { recursive: true });
  writeFileSync(
    join(dayDir, backfillFileName("CME", "NQU6")),
    gzipSync(Buffer.from(`${rows.map((row) => JSON.stringify(row)).join("\n")}\n`)),
  );
  return { dir, tradingDate };
};

test("a request never folds a session itself; the warmer does", async () => {
  /*
   * The outage this is guarding against. Folding reads a whole session's
   * prints, and the gateway is one Node process: doing that on the request
   * path blocked the event loop serving options, GEX, quotes and the live
   * feed, twice in one day.
   */
  const { dir, tradingDate } = withTape([[T0, 29000, 4, 1], [T0 + 60_000, 29001, 2, -1]]);
  try {
    const archive = new SessionProfileArchive({ dir });
    const cold = await archive.load({
      exchange: "CME", symbol: "NQU6", tickSize: TICK, fromMs: T0 - 1, toMs: T0 + 300_000,
    });
    assert.equal(cold, null, "a request folded a session on the spot");
    assert.equal(archive.status().pending, 1, "the session was not queued for the warmer");

    // What the warmer does, minus the timer.
    await archive.sessionLevels(tradingDate, "CME", "NQU6", TICK, true);
    const warm = await archive.load({
      exchange: "CME", symbol: "NQU6", tickSize: TICK, fromMs: T0 - 1, toMs: T0 + 300_000,
    });
    assert.equal(warm.levels.length, 2);
    assert.equal(warm.levels[0].price, 29000);
    assert.equal(warm.levels[0].delta, 4);
    assert.equal(warm.levels[1].delta, -2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("nothing folded reads as unknown, not as an empty market", async () => {
  /*
   * null rather than an empty profile: "nobody has counted this yet" and "no
   * volume traded here" have to stay distinguishable, or a chart draws a blank
   * profile over a session that was actually busy.
   */
  const dir = mkdtempSync(join(tmpdir(), "kwant-profile-"));
  try {
    const archive = new SessionProfileArchive({ dir });
    assert.equal(await archive.load({
      exchange: "COMEX", symbol: "GCV6", tickSize: 0.1, fromMs: T0, toMs: T0 + 60_000,
    }), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a completed session is cached on disk, the live one never is", async () => {
  // Caching the session in progress would freeze it at whatever the market had
  // done when the first chart asked.
  const { dir, tradingDate } = withTape([[T0, 29000, 1, 1]]);
  try {
    const archive = new SessionProfileArchive({ dir });
    const today = chicagoTradingDate(Date.now());
    assert.notEqual(today, tradingDate, "this test needs a completed session");
    await archive.sessionLevels(tradingDate, "CME", "NQU6", TICK, true);
    assert.ok(
      existsSync(join(dir, "profiles", tradingDate, "CME-NQU6.profile.json.gz")),
      "a completed session was not cached",
    );

    const liveDir = join(dir, "trades", today);
    mkdirSync(liveDir, { recursive: true });
    writeFileSync(
      join(liveDir, backfillFileName("CME", "NQU6")),
      gzipSync(Buffer.from(`${JSON.stringify([Date.now(), 29000, 1, 1])}\n`)),
    );
    await archive.sessionLevels(today, "CME", "NQU6", TICK, true);
    assert.ok(
      !existsSync(join(dir, "profiles", today, "CME-NQU6.profile.json.gz")),
      "the live session was frozen to disk",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
