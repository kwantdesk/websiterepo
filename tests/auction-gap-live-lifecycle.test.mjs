import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuctionGapLiveLifecycle } from '../src/lib/auctionGapLiveLifecycle.ts';
import { buildAuctionGapLifecycle } from '../src/lib/auctionGapLifecycle.ts';
const source = { groupTicks: 1, inputType: 'volume', sizeFiltered: false };
const settings = { extendedBars: 3, retestMode: 'touch', showTriggered: true, onlyTriggered: false };
const segment = (index, ticks = [1, 2, 3], extra = {}) => ({ chartIndex: index, resetKey: 'a', detect: true,
  bar: { id: `bar${index}`, instrument: 'NQU6', startTime: index * 1000, endTime: index * 1000 + 999,
    lowTick: 0, highTick: 10, openTick: 5, closeTick: 5, hasPriceLevelFlow: true, isClosed: false,
    rows: ticks.map(tickIndex => ({ tickIndex, bidVolume: 0, askVolume: 10, unknownVolume: 0 })) }, ...extra });
const live = (patch = {}, limit) => new AuctionGapLiveLifecycle(source, {}, { ...settings, ...patch }, limit);
const expected = (rows, patch = {}) => buildAuctionGapLifecycle(rows, source, {}, { ...settings, ...patch }).zones;

test('incremental append, expiry and reset exactly match complete rebuild at every step', () => {
  const engine = live(), rows = [];
  for (let i = 0; i < 50; i++) {
    rows.push(segment(i, i % 4 ? [8] : [1, 2, 3], { resetKey: String(Math.floor(i / 11)) }));
    assert.equal(engine.updateTail([rows.at(-1)]), 'ready');
    assert.deepEqual(engine.snapshot(), expected(rows));
  }
});

test('forming-bar replacements remove provisional zones and undo retests, without history accumulation', () => {
  const engine = live(), first = segment(0);
  engine.updateTail([first]);
  for (let i = 0; i < 1000; i++) {
    const tail = segment(1, i % 2 ? [8] : [1, 2, 3]);
    assert.equal(engine.updateTail([tail]), 'ready');
    assert.deepEqual(engine.snapshot(), expected([first, tail]));
    assert.equal(engine.retainedCounts.segments, 2);
  }
});

test('replacing every reset subsegment of a chart bar restores earlier active zones', () => {
  const engine = live(), first = segment(0);
  engine.updateTail([first]);
  const a = segment(1), b = segment(1, [2], { resetKey: 'b' });
  b.bar.id = 'bar1part2'; b.bar.startTime++;
  engine.updateTail([a, b]); assert.deepEqual(engine.snapshot(), expected([first, a, b]));
  const tail = segment(1, [8]);
  engine.updateTail([tail]); assert.deepEqual(engine.snapshot(), expected([first, tail]));
});

test('rejected replacement is atomic; older corrections explicitly require rebuild', () => {
  const engine = live(); engine.updateTail([segment(0)]); engine.updateTail([segment(1)]);
  const before = engine.snapshot(), invalid = segment(1); invalid.bar.hasPriceLevelFlow = false;
  assert.equal(engine.updateTail([invalid]), 'requires-raw-volume'); assert.deepEqual(engine.snapshot(), before);
  assert.equal(engine.updateTail([segment(0)]), 'requires-rebuild');
  assert.equal(engine.updateTail([segment(3)]), 'requires-rebuild');
  assert.deepEqual(engine.snapshot(), before);
  assert.equal(engine.updateTail([segment(1, [8])]), 'ready');
});

test('capacity is explicit, no silent eviction, and snapshots cannot mutate retained state', () => {
  const engine = live({}, 2); engine.updateTail([segment(0)]); engine.updateTail([segment(1)]);
  const before = engine.snapshot(); engine.snapshot()[0].lowTick = -999;
  assert.deepEqual(engine.snapshot(), before);
  assert.equal(engine.updateTail([segment(2)]), 'capacity-limit'); assert.deepEqual(engine.snapshot(), before);
  assert.equal(engine.updateTail([segment(1, [8])]), 'ready');
});

test('cross and visibility modes remain rebuild-equivalent during corrections', () => {
  for (const patch of [{ retestMode: 'cross' }, { onlyTriggered: true }, { showTriggered: false }]) {
    const engine = live(patch), first = segment(0); engine.updateTail([first]);
    for (const close of [0, 5, 0]) {
      const tail = segment(1, [0, 2]); tail.bar.closeTick = close;
      engine.updateTail([tail]); assert.deepEqual(engine.snapshot(), expected([first, tail], patch));
    }
  }
});

test('tail changes never revisit historical price rows or inherit subsequent settings mutation', () => {
  const configuration = { ...settings }, engine = new AuctionGapLiveLifecycle(source, {}, configuration);
  const first = segment(0); engine.updateTail([first]);
  first.bar.rows = new Proxy([], { get() { throw Error('Historical rows revisited'); } });
  configuration.extendedBars = 0;
  const tail = segment(1, [2]);
  assert.equal(engine.updateTail([tail]), 'ready');
  assert.equal(engine.snapshot()[0].triggeredAtIndex, 1);
  assert.equal(engine.updateTail([segment(1, [8])]), 'ready');
  assert.equal(engine.snapshot()[0].state, 'fresh');
});
