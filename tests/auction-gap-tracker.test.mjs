import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectAuctionGaps, normalizeAuctionGapDetection } from '../src/lib/auctionGapTracker.ts';

const source = { groupTicks: 1, inputType: 'volume', sizeFiltered: false };
const row = (tickIndex, bidVolume = 0, askVolume = 10, unknownVolume = 0) => ({ tickIndex, bidVolume, askVolume, unknownVolume });
const bar = (rows, extra = {}) => ({ id: 'NQ:bar:1', startTime: 100, endTime: 200,
  lowTick: 0, highTick: 5, hasPriceLevelFlow: true, isClosed: true, rows, ...extra });
const run = (rows, settings = {}, extra = {}) => detectAuctionGaps(bar(rows, extra), source, settings);

test('three consecutive classified zero-bid ticks produce one buy zone and exact totals', () => {
  const frame = run([row(1), row(2, 0, 20), row(3)]);
  assert.equal(frame.status, 'ready');
  assert.deepEqual(frame.gaps.map(g => [g.side, g.lowTick, g.highTick, g.levelCount, g.dominantVolume, g.oppositeVolume, g.provisional]),
    [['buy', 1, 3, 3, 40, 0, false]]);
});

test('intrabar excludes extremes; all includes them; seller side is mirrored', () => {
  const rows = [row(0, 10, 0), row(1, 10, 0), row(2, 10, 0)];
  assert.equal(run(rows).gaps.length, 0);
  assert.equal(run(rows, { includeMode: 'all' }).gaps[0].side, 'sell');
});

test('DLL location modes select exact extremes or wick ticks and exclude the candle body', () => {
  const rows = [0, 1, 2, 3, 4, 5].map(t => row(t));
  const base = { minimumConsecutiveLevels: 1 };
  assert.deepEqual(run(rows, { ...base, includeMode: 'high-only' }).gaps.map(g => g.lowTick), [5]);
  assert.deepEqual(run(rows, { ...base, includeMode: 'low-only' }).gaps.map(g => g.lowTick), [0]);
  assert.deepEqual(run(rows, { ...base, includeMode: 'extreme-only' }).gaps.map(g => g.lowTick), [0, 5]);
  const body = { openTick: 2, closeTick: 3 };
  assert.deepEqual(run(rows, { ...base, includeMode: 'wick-only' }, body).gaps.map(g => [g.lowTick, g.highTick]), [[0, 1], [4, 5]]);
  assert.equal(run(rows, { ...base, includeMode: 'wick-only' }).status, 'invalid-data');
});

test('missing rows and unknown prints break runs, never manufacture zero participation', () => {
  assert.equal(run([row(1), row(2), row(4)]).gaps.length, 0);
  assert.equal(run([row(1), row(2, 0, 10, 1), row(3)]).gaps.length, 0);
  assert.equal(run([row(1, 0, 0), row(2, 0, 0), row(3, 0, 0)]).gaps.length, 0);
});

test('thresholds include exact boundary; low participation ties have no invented side', () => {
  const rows = [row(1, 1, 9), row(2, 1, 9), row(3, 1, 9)];
  assert.equal(run(rows).gaps.length, 0);
  assert.equal(run(rows, { maximumOppositeVolume: 1, minimumTickVolume: 10 }).gaps[0].oppositeVolume, 3);
  assert.equal(run(rows, { maximumOppositeVolume: 1, minimumTickVolume: 11 }).gaps.length, 0);
  assert.equal(run([row(1, 1, 1), row(2, 1, 1), row(3, 1, 1)], { maximumOppositeVolume: 1 }).gaps.length, 0);
});

test('grouped, trade-count, filtered or missing volume datasets are explicitly unavailable', () => {
  for (const patch of [{ groupTicks: 2 }, { inputType: 'num-trades' }, { sizeFiltered: true }]) {
    assert.equal(detectAuctionGaps(bar([row(1), row(2), row(3)]), { ...source, ...patch }).status, 'requires-raw-volume');
  }
  assert.equal(run([], {}, { hasPriceLevelFlow: false }).status, 'requires-raw-volume');
});

test('live replacement can remove a provisional gap; different same-time bar IDs stay distinct', () => {
  const a = run([row(1), row(2), row(3)], {}, { isClosed: false });
  assert.equal(a.gaps[0].provisional, true);
  assert.equal(run([row(1), row(2, 5, 10), row(3)]).gaps.length, 0);
  const b = run([row(1), row(2), row(3)], {}, { id: 'NQ:bar:2' });
  assert.notEqual(a.gaps[0].id, b.gaps[0].id);
});

test('invalid prices, duplicates and volume corruption fail explicitly without mutating rows', () => {
  for (const rows of [[row(1), row(1)], [row(1, NaN)], [row(2, -1)], [row(2, 0, Infinity)], [row(1.5)], [row(6)]]) {
    assert.equal(run(rows).status, 'invalid-data');
  }
  const rows = [row(3), row(1), row(2)]; const before = structuredClone(rows);
  assert.equal(run(rows).gaps.length, 1); assert.deepEqual(rows, before);
});

test('settings reject booleans and empty coercions, clamp bounds, preserve valid zero', () => {
  assert.deepEqual(normalizeAuctionGapDetection({ minimumTickVolume: true, maximumOppositeVolume: -2,
    minimumConsecutiveLevels: 10001, includeMode: 'wrong' }), {
    minimumTickVolume: 0, maximumOppositeVolume: 0, minimumConsecutiveLevels: 1000, includeMode: 'intrabar',
  });
  assert.equal(normalizeAuctionGapDetection({ minimumConsecutiveLevels: '' }).minimumConsecutiveLevels, 3);
});
