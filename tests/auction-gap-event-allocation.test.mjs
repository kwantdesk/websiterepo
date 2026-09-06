import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocateAuctionGapEventExecutions } from '../src/lib/auctionGapEventAllocation.ts';
import { applyMarketTradesToEventBars } from '../src/lib/eventBars.ts';
const execution = (i, price, volume = 10) => ({ id: String(i), timestamp: 1700000000000,
  tickIndex: price / .25, volume, tradeCount: 1, bidVolume: 0, askVolume: volume,
  unknownVolume: 0, detect: true, resetKey: null });
const build = (executions, timeframe) => applyMarketTradesToEventBars([], executions.map(e => ({
  timestamp: e.timestamp, price: e.tickIndex * .25, size: e.volume, trades: e.tradeCount, delta: e.askVolume - e.bidVolume,
})), timeframe, 'NQ', 20000);
const run = (executions, timeframe, expectedCandles = build(executions, timeframe)) =>
  allocateAuctionGapEventExecutions({ executions, timeframe, expectedCandles, symbol: 'NQ', tickSize: .25 });

test('same-ms threshold executions map by actual engine ownership, not synthetic timestamp', () => {
  const executions = [execution(1, 100, 600), execution(2, 101, 5), execution(3, 102, 495), execution(4, 103, 5)];
  const out = run(executions, '500v');
  assert.equal(out.status, 'ready');
  assert.deepEqual(out.assignments.map(a => a.chartIndex), [0, 1, 1, 2]);
});
test('range bridges do not duplicate source execution volume', () => {
  const executions = [execution(1, 100, 7), execution(2, 120, 13)];
  const out = run(executions, '40r');
  assert.equal(out.status, 'ready');
  assert.deepEqual(out.assignments.map(a => a.chartIndex), [0, 0]);
  assert.ok(build(executions, '40r').slice(1).every(b => b.volume === 0));
});
test('tail replay matches full builder and preserves volume for every supported event family', () => {
  const executions = Array.from({ length: 120 }, (_, i) => execution(i, 100 + (i % 20), 20));
  for (const timeframe of ['500v', '50t', '50dv', '40r', '4R', '1/27PF', '10/100VB']) {
    const candles = build(executions, timeframe), out = run(executions, timeframe, candles);
    assert.equal(out.status, 'ready', timeframe);
    const volumes = candles.map(() => 0);
    out.assignments.forEach((a, i) => { volumes[a.chartIndex] += executions[i].volume; });
    assert.deepEqual(volumes, candles.map(c => c.volume), timeframe);
  }
});
test('truncated or corrected chart seed fails instead of attaching to different candles', () => {
  const executions = [execution(1, 100, 600), execution(2, 101, 10)];
  const candles = build(executions, '500v');
  assert.equal(run(executions, '500v', candles.slice(1)).status, 'source-chart-mismatch');
  const altered = structuredClone(candles); altered[0].volume++;
  assert.equal(run(executions, '500v', altered).status, 'source-chart-mismatch');
});
test('invalid identities and non-event inputs rejected; source and expected chart untouched', () => {
  const executions = [execution(1, 100), execution(2, 101)], copy = structuredClone(executions);
  const candles = build(executions, '40r'), snapshot = structuredClone(candles);
  assert.equal(run(executions, '40r', candles).status, 'ready');
  assert.deepEqual(executions, copy); assert.deepEqual(candles, snapshot);
  assert.equal(run([executions[0], executions[0]], '40r').status, 'invalid-source');
  assert.equal(run(executions, '1m', []).status, 'invalid-source');
});
