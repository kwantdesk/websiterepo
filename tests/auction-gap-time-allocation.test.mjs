import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocateAuctionGapTimeExecutions as allocate } from '../src/lib/auctionGapTimeAllocation.ts';
const execution = (id, timestamp, volume = 5) => ({ id, timestamp, volume });
const bar = (id, startMs, endMs, expectedVolume = 5) => ({ id, startMs, endMs, expectedVolume });
test('exact boundary belongs to the next bar and same-ms distinct executions are retained', () => {
  const out = allocate([execution('a', 100), execution('b', 200), execution('c', 200)], [bar('x', 100, 200), bar('y', 200, 300, 10)]);
  assert.equal(out.status, 'ready'); assert.deepEqual(out.assignments.map(a => a.chartIndex), [0, 1, 1]);
});
test('session gaps and outside-seed records do not leak into an adjacent candle', () => {
  const bars = [bar('x', 100, 200), bar('y', 300, 400)];
  for (const timestamp of [99, 200, 250, 400]) assert.equal(allocate([execution('a', timestamp)], bars).status, 'unassigned-execution');
});
test('unequal session bar durations use explicit boundaries rather than a guessed interval', () => {
  const out = allocate([execution('a', 199), execution('b', 2999)], [bar('short', 100, 200), bar('long', 1000, 3000)]);
  assert.equal(out.status, 'ready'); assert.deepEqual(out.assignments.map(a => a.chartIndex), [0, 1]);
});
test('zero-volume bars remain empty and volume mismatch is explicit', () => {
  assert.equal(allocate([], [bar('x', 100, 200, 0)]).status, 'ready');
  assert.equal(allocate([], [bar('x', 100, 200)]).status, 'source-chart-mismatch');
  assert.equal(allocate([execution('a', 150, 6)], [bar('x', 100, 200)]).status, 'source-chart-mismatch');
});
test('reject overlapping bars, duplicate identities, reversed records and corrupt boundaries', () => {
  assert.equal(allocate([], [bar('x', 100, 200), bar('y', 199, 300)]).status, 'invalid-source');
  assert.equal(allocate([], [bar('x', 100, 200), bar('x', 200, 300)]).status, 'invalid-source');
  assert.equal(allocate([], [bar('x', 100, NaN)]).status, 'invalid-source');
  const bars = [bar('x', 100, 200, 10)];
  assert.equal(allocate([execution('a', 150), execution('a', 150)], bars).status, 'invalid-source');
  assert.equal(allocate([execution('a', 160), execution('b', 150)], bars).status, 'invalid-source');
});
