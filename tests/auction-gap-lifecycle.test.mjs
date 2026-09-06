import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAuctionGapLifecycle } from '../src/lib/auctionGapLifecycle.ts';
const source = { groupTicks: 1, inputType: 'volume', sizeFiltered: false };
const settings = { extendedBars: 200, retestMode: 'touch', showTriggered: true, onlyTriggered: false };
const row = (tickIndex, bidVolume = 0, askVolume = 10) => ({ tickIndex, bidVolume, askVolume, unknownVolume: 0 });
const bar = (id, ticks, extra = {}) => ({ id, instrument: 'NQU6', startTime: 100, endTime: 200,
  lowTick: 0, highTick: 10, openTick: 5, closeTick: 5, hasPriceLevelFlow: true,
  isClosed: true, rows: ticks.map(t => row(t)), ...extra });
const item = (bar, detect = false, resetKey = 'session1') => ({ bar, detect, resetKey });
const initial = () => item(bar('a', [1, 2, 3]), true);
const frame = (bars, patch = {}) => buildAuctionGapLifecycle(bars, source, {}, { ...settings, ...patch });

test('source cannot retest itself; later same-ms chart bar can', () => {
  assert.equal(frame([initial()]).zones[0].state, 'fresh');
  const z = frame([initial(), item(bar('b', [2]))]).zones[0];
  assert.equal(z.state, 'triggered'); assert.equal(z.triggeredAtBarId, 'b'); assert.equal(z.triggeredAtIndex, 1);
});
test('OHLC spanning a zone without actual prints does not trigger it', () => {
  assert.equal(frame([initial(), item(bar('b', [0, 8]))]).zones[0].state, 'fresh');
});
test('extensions count real bars, end inclusively and expire before later retests', () => {
  const z = frame([initial(), item(bar('b', [8])), item(bar('c', [2]))], { extendedBars: 1 }).zones[0];
  assert.equal(z.endIndex, 1); assert.equal(z.state, 'fresh'); assert.equal(z.stoppedBy, 'extension');
  assert.equal(frame([initial(), item(bar('b', [2]))], { extendedBars: 0 }).zones[0].endIndex, 0);
});
test('reset boundary stops old zones before evaluating the new session', () => {
  const z = frame([initial(), item(bar('b', [2]), false, 'session2')]).zones[0];
  assert.equal(z.endIndex, 0); assert.equal(z.state, 'fresh'); assert.equal(z.stoppedBy, 'reset');
  const inputs = [initial(), item(bar('b', [2]))].map(v => ({ ...v, resetKey: null }));
  assert.equal(frame(inputs).zones[0].state, 'triggered');
});
test('touch and cross conventions differ, and first retest identity is stable', () => {
  const bars = [initial(), item(bar('b', [2], { closeTick: 2 })), item(bar('c', [0, 2], { closeTick: 0 })), item(bar('d', [2]))];
  assert.equal(frame(bars).zones[0].triggeredAtBarId, 'b');
  assert.equal(frame(bars, { retestMode: 'cross' }).zones[0].triggeredAtBarId, 'c');
});
test('triggered visibility and only-triggered mode operate independently', () => {
  assert.equal(frame([initial()], { onlyTriggered: true }).zones.length, 0);
  const bars = [initial(), item(bar('b', [2]))];
  assert.equal(frame(bars, { onlyTriggered: true }).zones.length, 1);
  assert.equal(frame(bars, { showTriggered: false }).zones.length, 0);
});
test('corrections rebuild stale retest state, without mutating caller data', () => {
  const bars = [initial(), item(bar('b', [2]))], copy = structuredClone(bars);
  assert.equal(frame(bars).zones[0].state, 'triggered'); assert.deepEqual(bars, copy);
  bars[1] = item(bar('b', [8])); assert.equal(frame(bars).zones[0].state, 'fresh');
});
test('mixed contracts, duplicate IDs, reversed order or unavailable intervening rows fail honestly', () => {
  for (const next of [bar('a', [8]), bar('b', [8], { instrument: 'ESU6' }), bar('b', [8], { startTime: 99 })]) {
    assert.equal(frame([initial(), item(next)]).status, 'invalid-data');
  }
  const unavailable = frame([initial(), item(bar('b', [], { hasPriceLevelFlow: false }))]);
  assert.equal(unavailable.status, 'requires-raw-volume'); assert.equal(unavailable.zones.length, 0);
});
