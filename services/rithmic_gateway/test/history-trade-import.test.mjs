import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { decodeIndividualHistoryTrade, validateHistoryTradeChunk } from "../src/history-trade-import.mjs";
import { TradeTapeArchive, instrumentFileName, sessionTradeFiles } from "../src/trade-tape-archive.mjs";
import { BarFlowArchive } from "../src/bar-flow-archive.mjs";
import { SessionProfileArchive } from "../src/session-profile-archive.mjs";
import { FuturesBarArchive } from "../src/futures-bar-archive.mjs";
import { materializeRecoveredCandles } from "../scripts/restore-indicator-history.mjs";

const t = Date.parse("2026-10-15T22:00:00Z");
const scope = { exchange: "CME", symbol: "NQZ6", fromMs: t, toMs: t + 60000 };
const row = { exchange: "CME", symbol: "NQZ6", numTrades: "1", volume: "3",
  bidVolume: "0", askVolume: "3", openPrice: 100, highPrice: 100, lowPrice: 100, closePrice: 100,
  dataBarSsboe: [t / 1000, t / 1000 + 1], dataBarUsecs: [0, 123456] };

test("individual replay preserves end timestamp, explicit side, size and unknown classification", () => {
  assert.deepEqual(decodeIndividualHistoryTrade(row, scope), [t + 1123.456, 100, 3, 1]);
  assert.equal(decodeIndividualHistoryTrade({ ...row, askVolume: 0 }, scope)[3], 0);
  assert.equal(decodeIndividualHistoryTrade({ ...row, askVolume: 0, bidVolume: 3 }, scope)[3], -1);
});

test("non-atomic, off-tick, wrong-contract and invalid trade rows fail closed", () => {
  for (const changes of [{ numTrades: 2 }, { highPrice: 101 }, { closePrice: 100.1 },
    { symbol: "ESZ6" }, { askVolume: 2 }, { bidVolume: 1 }, { dataBarSsboe: [t / 1000 + 60] }]) {
    assert.throws(() => decodeIndividualHistoryTrade({ ...row, ...changes }, scope));
  }
});

test("trades reconcile to close-marked minute OHLCV and classification; a missing last-second print fails", () => {
  const trades = [[t + 1, 100, 3, 1], [t + 59999, 101, 2, -1]];
  const bars = [{ marker: (t + 60000) / 1000, openPrice: 100, highPrice: 101,
    lowPrice: 100, closePrice: 101, volume: 5, askVolume: 3, bidVolume: 2 }];
  validateHistoryTradeChunk(trades, bars);
  assert.throws(() => validateHistoryTradeChunk(trades.slice(0, 1), bars), /reconcile/);
  assert.throws(() => validateHistoryTradeChunk(trades, []), /matching/);
});

test("completed replay replaces partial tapes without duplicating them and invalidates existing flow/profile caches", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kd-history-trades-"));
  try {
    const date = "2026-10-15", day = join(dir, "trades", date);
    await mkdir(day, { recursive: true });
    await writeFile(join(day, instrumentFileName("CME", "NQZ6")), gzipSync(JSON.stringify([t, 100, 90, 1]) + "\n"));
    const flow = new BarFlowArchive({ dir });
    const profiles = new SessionProfileArchive({ dir });
    assert.equal((await flow.sessionFlow(date, "CME", "NQZ6")).minutes[0].volume, 90);
    assert.equal((await profiles.sessionLevels(date, "CME", "NQZ6", .25)).minutes[0].levels[0][1], 90);
    const complete = [[t + 1, 100, 3, 1], [t + 2, 100.25, 2, -1]];
    const history = join(day, "CME-NQZ6.trades.history.ndjson.gz");
    await writeFile(history, gzipSync(complete.map(r => JSON.stringify(r)).join("\n") + "\n"));
    assert.deepEqual(sessionTradeFiles(join(dir, "trades"), date, "CME", "NQZ6"), [history]);
    assert.equal((await flow.sessionFlow(date, "CME", "NQZ6")).minutes[0].volume, 5);
    assert.equal((await profiles.sessionLevels(date, "CME", "NQZ6", .25)).minutes[0].levels.reduce((n, r) => n + r[1], 0), 5);
    const profile = await profiles.load({ exchange: "CME", symbol: "NQZ6", tickSize: .25, fromMs: t, toMs: t + 86400000 });
    assert.deepEqual(profile.authoritativeIntervals, [{ tradingDate: date, startMs: t, endMs: t + 86400000 }]);
    const tape = new TradeTapeArchive({ dir });
    const result = await tape.load({ exchange: "CME", symbol: "NQZ6", fromMs: t, toMs: t + 60000 });
    assert.equal(result.trades.length, 2);
    assert.equal(result.trades.reduce((sum, r) => sum + r.size, 0), 5);
    await materializeRecoveredCandles(dir, "CME", "NQZ6", date);
    await writeFile(join(dir, "bars", date, "CME-NQ.json"), JSON.stringify({ bars: [[t + 60000, 120, 120, 120, 120, 900]] }));
    const barArchive = new FuturesBarArchive({ dir });
    barArchive.barsFor(date, "CME", "NQZ6").set(t + 60000, { t: t + 60000, o: 120, h: 120, l: 120, c: 120, v: 900 });
    barArchive.dirty.add(`${date}\u0000CME\u0000NQZ6`);
    await barArchive.flush();
    const bars = await barArchive.load({ exchange: "CME", symbol: "NQZ6", interval: "1m", fromMs: t, toMs: t + 120000 });
    assert.equal(bars.candles.length, 1, "completed exact history must not be padded with stale root minutes");
    assert.equal(bars.candles[0].volume, 5);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
