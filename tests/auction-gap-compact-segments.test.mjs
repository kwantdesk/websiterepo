import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAuctionGapCompactSegments } from '../src/lib/auctionGapCompactSegments.ts';
import { calculateAuctionGapStudy, prepareAuctionGapStudy } from '../src/lib/auctionGapStudy.ts';

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

test('live exact prints replace the compact seam bar and append newer bars', () => {
  const makeCandle = (timestamp, openTick, highTick, closeTick, volume) => ({
    timestamp, open: openTick * .25, high: highTick * .25,
    low: Math.min(openTick, closeTick) * .25, close: closeTick * .25, volume,
  });
  const makeCompactBar = (chartIndex, timestamp, ticks) => ({
    chartIndex, timestamp, endTime: timestamp + 60_000,
    rows: ticks.map(tickIndex => row(tickIndex, 10)),
    slices: [{ minute: timestamp, startTime: timestamp, endTime: timestamp + ticks.length - 1,
      openTick: ticks[0], highTick: Math.max(...ticks), lowTick: Math.min(...ticks),
      closeTick: ticks.at(-1), volume: ticks.length * 10,
      rows: ticks.map(tickIndex => row(tickIndex, 10)) }],
  });
  const candles = [
    makeCandle(0, 400, 402, 402, 30),
    makeCandle(60_000, 404, 406, 406, 30),
    makeCandle(120_000, 406, 406, 406, 10),
  ];
  const compactHistory = { status: 'ready', coverage: 'complete', contractSymbol: 'NQU6', bars: [
    makeCompactBar(0, 0, [400, 401, 402]),
    // This stale copy is deliberately replaced by the live tape below.
    makeCompactBar(1, 60_000, [404, 405, 406]),
  ] };
  const records = [404, 405, 406, 406].map((tickIndex, index) => ({
    recordIndex: 100 + index, timestamp: index < 3 ? 60_000 + index : 120_000,
    open: tickIndex * .25, high: tickIndex * .25, low: tickIndex * .25, close: tickIndex * .25,
    volume: 10, trades: 1, bidVolume: 0, askVolume: 10, aggressor: 'BUY',
  }));
  const prepared = prepareAuctionGapStudy({ contractSymbol: 'NQU6', expectedContract: 'NQU6', tickSize: .25,
    asOfMs: 180_000, coverage: 'complete', records, compactHistory, candles,
    geometry: candles.map((value, index) => ({ id: String(index), timestamp: value.timestamp,
      endTime: value.timestamp + 60_000, lowTick: Math.round(value.low / .25), highTick: Math.round(value.high / .25),
      openTick: Math.round(value.open / .25), closeTick: Math.round(value.close / .25), isClosed: index < 2 })),
    chart: { kind: 'time' }, calendar,
    timeSettings: { resetMode: 'none', filterTime: 'none', customStartMinutes: 0, customEndMinutes: 0 },
    detectionSettings: { includeMode: 'all' },
    lifecycleSettings: { extendedBars: 200, retestMode: 'touch', showTriggered: true, onlyTriggered: false } });
  assert.equal(prepared.status, 'ready');
  assert.deepEqual(prepared.segments.map(segment => segment.chartIndex), [0, 1, 2]);
  assert.deepEqual(prepared.segments[1].bar.rows.map(value => value.tickIndex), [404, 405, 406]);
});

test('live seam refuses a partial retained tape instead of merging false rows', () => {
  const compact = structuredClone(history);
  const result = calculateAuctionGapStudy({ contractSymbol: 'NQU6', expectedContract: 'NQU6', tickSize: .25,
    asOfMs: 120_000, coverage: 'complete', records: [{ recordIndex: 9, timestamp: 59_999,
      open: 100, high: 100, low: 100, close: 100, volume: 1, trades: 1,
      bidVolume: 0, askVolume: 1, aggressor: 'BUY' }], compactHistory: compact, candles: [candle],
    geometry: [{ id: 'a', timestamp: 0, endTime: 120_000, lowTick: 400, highTick: 404,
      openTick: 400, closeTick: 404, isClosed: true }], chart: { kind: 'time' }, calendar,
    timeSettings: { resetMode: 'none', filterTime: 'none', customStartMinutes: 0, customEndMinutes: 0 },
    detectionSettings: { includeMode: 'all' },
    lifecycleSettings: { extendedBars: 200, retestMode: 'touch', showTriggered: true, onlyTriggered: false } });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.reason, 'source-chart-mismatch');
});
