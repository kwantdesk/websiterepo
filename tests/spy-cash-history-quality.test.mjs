import assert from "node:assert/strict";
import test from "node:test";
import { excludeUnverifiedCashHistory } from "../src/lib/cashHistoryQuality.ts";
import { chartTimeBucketStartMs } from "../src/lib/chartTimeBucket.ts";
import { repairInstitutionalCandleSeries } from "../src/lib/institutionalMarketData.ts";

const time = (value) => Date.parse(`2026-11-05T${value}:00Z`);
const conflicting = { timestamp: time("16:21"), open: 738.34, high: 745.20, low: 737.87, close: 744.48, volume: 0 };
const before = { ...conflicting, timestamp: time("14:56") };
const after = { ...conflicting, timestamp: time("17:32") };

test("SPY incident excludes the recorded bad candle without changing neighboring OHLC", () => {
  const input = [before, conflicting, after];
  assert.deepEqual(excludeUnverifiedCashHistory(input, "SPY", "1m"), [before, after]);
  assert.deepEqual(repairInstitutionalCandleSeries(input, "1m", "SPY"), [before, after]);
  assert.equal(excludeUnverifiedCashHistory(input, "QQQ", "1m"), input);
  assert.equal(excludeUnverifiedCashHistory(input, "SPX", "1m"), input);
  assert.deepEqual(input, [before, conflicting, after]);
});

test("larger candles containing any incident minute are incomplete", () => {
  for (const timeframe of ["3m", "5m", "15m", "1h", "4h", "1D", "1W", "1M"]) {
    const start = chartTimeBucketStartMs(time("14:57"), timeframe);
    const end = chartTimeBucketStartMs(time("17:31"), timeframe);
    const rows = [start - 1, start, end, end + 1].map(timestamp => ({ timestamp }));
    assert.deepEqual(excludeUnverifiedCashHistory(rows, "spy", timeframe), [rows[0], rows[3]], timeframe);
  }
});
