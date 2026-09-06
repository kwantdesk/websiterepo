import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateAuctionGapStudy } from '../src/lib/auctionGapStudy.ts';
const start = Date.parse('2026-09-08T13:30:00Z');
const trade = (i, price, timestamp) => ({ recordIndex: i, timestamp, open: price, high: price, low: price, close: price,
  volume: 10, trades: 1, bidVolume: 0, askVolume: 10, aggressor: 'BUY' });
const input = () => ({ contractSymbol: 'NQU6', expectedContract: 'NQU6', tickSize: .25, asOfMs: start + 119999,
  coverage: 'complete', chart: { kind: 'time' },
  records: [trade(0, 100.25, start), trade(1, 100.5, start + 1), trade(2, 100.75, start + 2), trade(3, 100.5, start + 60000)],
  candles: [{ timestamp: start, open: 100.25, high: 100.75, low: 100.25, close: 100.75, volume: 30 },
    { timestamp: start + 60000, open: 100.5, high: 100.5, low: 100.5, close: 100.5, volume: 10 }],
  geometry: [{ id: 'a', timestamp: start, endTime: start + 60000, lowTick: 401, highTick: 403, openTick: 401, closeTick: 403, isClosed: true },
    { id: 'b', timestamp: start + 60000, endTime: start + 120000, lowTick: 402, highTick: 402, openTick: 402, closeTick: 402, isClosed: false }],
  calendar: { timeZone: 'America/Chicago', sessionOpenMinutes: 1020, rthStartMinutes: 510, rthEndMinutes: 900 },
  timeSettings: { resetMode: 'none', filterTime: 'none', customStartMinutes: 0, customEndMinutes: 0 },
  detectionSettings: { includeMode: 'all' }, lifecycleSettings: { extendedBars: 200, retestMode: 'touch', showTriggered: true, onlyTriggered: false } });
test('source to zone pipeline preserves expected ticks and first retest', () => {
  const data = input(), before = structuredClone(data), frame = calculateAuctionGapStudy(data);
  assert.equal(frame.status, 'ready'); assert.equal(frame.zones.length, 1);
  assert.deepEqual([frame.zones[0].lowTick, frame.zones[0].highTick, frame.zones[0].triggeredAtIndex], [401, 403, 1]);
  assert.deepEqual(data, before);
});
test('geometry mismatch, missing volume and partial coverage produce explicit unavailable results', () => {
  const altered = input(); altered.geometry[0].highTick++;
  assert.equal(calculateAuctionGapStudy(altered).reason, 'geometry-mismatch');
  const missing = input(); missing.records.pop();
  assert.equal(calculateAuctionGapStudy(missing).reason, 'source-chart-mismatch');
  const partial = input(); partial.coverage = 'partial';
  assert.equal(calculateAuctionGapStudy(partial).reason, 'partial-history');
});
test('filtered-out later executions still retest detected zones', () => {
  const data = input(); data.timeSettings = { ...data.timeSettings, filterTime: 'custom', customStartMinutes: 510, customEndMinutes: 511 };
  const frame = calculateAuctionGapStudy(data);
  assert.equal(frame.status, 'ready'); assert.equal(frame.zones[0].state, 'triggered');
});

test('matching chart geometry and volume alone do not prove matching execution OHLC', () => {
  const data = input(); data.candles[0].high = 101; data.geometry[0].highTick = 404;
  assert.equal(calculateAuctionGapStudy(data).reason, 'execution-ohlc-mismatch');
});
