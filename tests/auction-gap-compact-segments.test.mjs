import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAuctionGapCompactSegments } from '../src/lib/auctionGapCompactSegments.ts';
import { calculateAuctionGapStudy } from '../src/lib/auctionGapStudy.ts';

const calendar = { timeZone: 'UTC', sessionOpenMinutes: 0, rthStartMinutes: 1, rthEndMinutes: 2 };
const row = (tickIndex, askVolume) => ({ tickIndex, bidVolume: 0, askVolume, unknownVolume: 0 });
const candle = { timestamp: 0, open: 100, high: 101, low: 100, close: 101, volume: 10 };
const history = { status: 'ready', coverage: 'complete', contractSymbol: 'NQU6', bars: [{
  chartIndex: 0, timestamp: 0, endTime: 120_000,
  rows: [row(400, 4), row(402, 3), row(404, 3)],
  slices: [
    { minute: 0, startTime: 59_999, endTime: 59_999, openTick: 400, highTick: 400, lowTick: 400, closeTick: 400,
      volume: 4, rows: [row(400, 4)] },
    { minute: 60_000, startTime: 60_000, endTime: 60_001, openTick: 402, highTick: 404, lowTick: 402, closeTick: 404,
      volume: 6, rows: [row(402, 3), row(404, 3)] },
  ],
}] };

test('RTH filter keeps raw retest rows while detection uses only classified minute slices', () => {
  const result = buildAuctionGapCompactSegments({ history, candles: [candle], expectedContract: 'NQU6',
    chartKind: 'time', tickSize: 0.25, asOfMs: 120_000, calendar,
    timeSettings: { resetMode: 'none', filterTime: 'rth', customStartMinutes: 0, customEndMinutes: 0 } });
  assert.equal(result.status, 'ready'); assert.equal(result.segments.length, 1);
  assert.deepEqual(result.segments[0].bar.rows.map(value => value.tickIndex), [400, 402, 404]);
  assert.deepEqual(result.segments[0].detectionBar.rows.map(value => value.tickIndex), [402, 404]);
});

test('session reset splits one chart candle at the exact minute boundary', () => {
  const result = buildAuctionGapCompactSegments({ history, candles: [candle], expectedContract: 'NQU6',
    chartKind: 'time', tickSize: 0.25, asOfMs: 120_000, calendar,
    timeSettings: { resetMode: 'eth-and-rth-open', filterTime: 'none', customStartMinutes: 0, customEndMinutes: 0 } });
  assert.equal(result.status, 'ready'); assert.equal(result.segments.length, 2);
  assert.deepEqual(result.segments.map(segment => segment.chartIndex), [0, 0]);
  assert.deepEqual(result.segments.map(segment => segment.resetKey), ['1970-01-01:session-open', '1970-01-01:rth-open']);
  assert.deepEqual(result.segments.map(segment => [segment.bar.openTick, segment.bar.closeTick]), [[400, 400], [402, 404]]);
});

test('partial, wrong-contract and stale candle generations fail with no segments', () => {
  assert.equal(buildAuctionGapCompactSegments({ history: { status: 'unavailable', coverage: 'partial', reason: 'missing', bars: [] },
    candles: [candle], expectedContract: 'NQU6', chartKind: 'time', tickSize: 0.25, asOfMs: 1, calendar,
    timeSettings: { resetMode: 'none', filterTime: 'none', customStartMinutes: 0, customEndMinutes: 0 } }).reason, 'partial-history');
  for (const patch of [{ expectedContract: 'NQZ6' }, { candles: [{ ...candle, timestamp: 1 }] }]) {
    const result = buildAuctionGapCompactSegments({ history, candles: [candle], expectedContract: 'NQU6',
      chartKind: 'time', tickSize: 0.25, asOfMs: 1, calendar,
      timeSettings: { resetMode: 'none', filterTime: 'none', customStartMinutes: 0, customEndMinutes: 0 }, ...patch });
    assert.equal(result.status, 'unavailable'); assert.deepEqual(result.segments, []);
  }
});

test('whole study consumes compact history without reconstructing a raw execution tape', () => {
  const compact = structuredClone(history);
  compact.bars[0].slices = [{
    minute: 0, startTime: 1, endTime: 3, openTick: 400, highTick: 402, lowTick: 400, closeTick: 402,
    volume: 10, rows: [row(400, 3), row(401, 3), row(402, 4)],
  }];
  compact.bars[0].rows = structuredClone(compact.bars[0].slices[0].rows);
  const result = calculateAuctionGapStudy({ contractSymbol: 'NQU6', expectedContract: 'NQU6', tickSize: .25,
    asOfMs: 120_000, coverage: 'complete', records: [], compactHistory: compact, candles: [candle],
    geometry: [{ id: 'a', timestamp: 0, endTime: 120_000, lowTick: 400, highTick: 404,
      openTick: 400, closeTick: 404, isClosed: true }], chart: { kind: 'time' }, calendar,
    timeSettings: { resetMode: 'none', filterTime: 'none', customStartMinutes: 0, customEndMinutes: 0 },
    detectionSettings: { includeMode: 'all' },
    lifecycleSettings: { extendedBars: 200, retestMode: 'touch', showTriggered: true, onlyTriggered: false } });
  assert.equal(result.status, 'ready'); assert.equal(result.zones.length, 1);
  assert.deepEqual([result.zones[0].lowTick, result.zones[0].highTick], [400, 402]);
});
