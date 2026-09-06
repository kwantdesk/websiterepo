import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAuctionGapRows } from '../src/lib/auctionGapRows.ts';
import { buildAuctionGapLifecycle } from '../src/lib/auctionGapLifecycle.ts';
const geometry = (id = 'a') => ({ id, timestamp: 100, endTime: 200, lowTick: 0, highTick: 5, openTick: 2, closeTick: 3,
  isClosed: true, emptySourceTime: 100, emptyResetKey: 's1' });
const execution = (id, tickIndex, patch = {}) => ({ id, timestamp: 100, tickIndex, volume: 10, tradeCount: 1,
  bidVolume: 0, askVolume: 10, unknownVolume: 0, detect: true, resetKey: 's1', ...patch });
const build = (executions, bars = [geometry()], indices = executions.map(() => 0)) => buildAuctionGapRows({
  executions, bars, instrument: 'NQU6', assignments: executions.map((e, i) => ({ executionId: e.id, chartIndex: indices[i] })),
});
test('raw and filtered detection rows are independent and preserve unknown volumes', () => {
  const out = build([execution('a', 1), execution('b', 1, { detect: false, askVolume: 0, unknownVolume: 10 })]);
  assert.equal(out.status, 'ready');
  assert.equal(out.segments[0].rawBar.rows[0].unknownVolume, 10);
  assert.equal(out.segments[0].detectionBar.rows[0].unknownVolume, 0);
  assert.notEqual(out.segments[0].rawBar.rows[0], out.segments[0].detectionBar.rows[0]);
});
test('session resets split a single chart bar without merging volumes', () => {
  const out = build([execution('a', 1), execution('b', 2, { resetKey: 's2' })]);
  assert.equal(out.segments.length, 2); assert.deepEqual(out.segments.map(s => s.chartIndex), [0, 0]);
  assert.deepEqual(out.segments.map(s => s.resetKey), ['s1', 's2']);
  assert.notEqual(out.segments[0].rawBar.id, out.segments[1].rawBar.id);
});
test('physical tick outside a synthetic bar remains at its real price, empty bridge stays empty', () => {
  const out = build([execution('a', 10)], [geometry(), geometry('bridge')]);
  assert.equal(out.segments[0].rawBar.rows[0].tickIndex, 10);
  assert.equal(out.segments[0].rawBar.highTick, 10);
  assert.equal(out.segments[1].rawBar.rows.length, 0);
});
test('unknown, duplicated and reversed allocations rejected', () => {
  assert.equal(build([execution('a', 1)], [geometry()], [2]).status, 'invalid-allocation');
  assert.equal(build([execution('a', 1), execution('a', 2)]).status, 'invalid-allocation');
  assert.equal(build([execution('a', 1), execution('b', 2)], [geometry(), geometry('b')], [1, 0]).status, 'invalid-allocation');
});

test('empty bridges require an explicit source clock and preserve reset metadata', () => {
  const missing = geometry(); delete missing.emptySourceTime;
  assert.equal(build([], [missing]).status, 'invalid-allocation');
  const result = build([], [{ ...geometry(), timestamp: 110, emptySourceTime: 100 }]);
  assert.equal(result.segments[0].rawBar.startTime, 100);
  assert.equal(result.segments[0].resetKey, 's1');
});
test('row adapter connects filtered detection and raw retests into lifecycle', () => {
  const prints = [execution('a', 1), execution('b', 2), execution('c', 3), execution('d', 2, { detect: false })];
  const rows = build(prints, [geometry(), geometry('b')], [0, 0, 0, 1]);
  const out = buildAuctionGapLifecycle(rows.segments.map(s => ({ ...s, bar: s.rawBar, detect: true })),
    { groupTicks: 1, inputType: 'volume', sizeFiltered: false }, {},
    { extendedBars: 200, retestMode: 'touch', showTriggered: true, onlyTriggered: false });
  assert.equal(out.status, 'ready'); assert.equal(out.zones.length, 1);
  assert.equal(out.zones[0].state, 'triggered'); assert.equal(out.zones[0].triggeredAtIndex, 1);
});
