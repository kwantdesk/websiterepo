import test from 'node:test';
import assert from 'node:assert/strict';
import {createPriceSeries, normalizePriceCandle} from '../public/kwanty-app/price-series.js';

// Explicit arithmetic fixtures, never production fallbacks.
const time = Date.UTC(2026, 9, 20, 14, 0);
const bar = (offset = 0, values = {}) => ({time: time + offset * 60_000, open: 100, high: 105, low: 98, close: 102, ...values});
const context = {symbol: 'QQQ', sessionDate: '2026-10-20'};
const series = options => {const value = createPriceSeries(options); value.reset(context); return value;};

test('only structurally valid millisecond one-minute OHLC can seed candles', () => {
  const value = series();
  assert.equal(value.seed([bar()], context), true);
  for (const invalid of [{timestamp: time / 1000, spot: 102}, bar(0, {high: 99}), bar(0, {open: null}), bar(0, {time: time + 1}), bar(0, {low: -1})]) {
    assert.equal(normalizePriceCandle(invalid), null);
    assert.equal(value.seed([bar(1), invalid], context), false);
    assert.equal(value.size, 1);
  }
});

test('one real source candle displays immediately, independently of positioning snapshots', () => {
  const value = series(); value.seed([bar()], context);
  assert.equal(value.candles().length, 1);
  assert.deepEqual(value.candles().map(({open, high, low, close}) => [open, high, low, close]), [[100, 105, 98, 102]]);
});

test('sampled quotes never manufacture new candles or pad missing minutes', () => {
  const value = series();
  value.quote({...context, timestamp: time, lastPrice: 101});
  value.quote({...context, timestamp: time + 180_000, lastPrice: 110});
  assert.deepEqual(value.candles(), []);
  assert.deepEqual(value.quoteLine().map(point => point.spot), [101, 110]);
  value.seed([bar()], context);
  assert.equal(value.candles().length, 1);
});

test('quotes widen existing wick evidence without claiming complete execution coverage', () => {
  const value = series(); value.seed([bar()], context);
  value.quote({...context, timestamp: time + 1_000, lastPrice: 108});
  value.quote({...context, timestamp: time + 2_000, lastPrice: 96});
  value.quote({...context, timestamp: time + 3_000, lastPrice: 101});
  const candle = value.candles()[0];
  assert.deepEqual([candle.open, candle.high, candle.low, candle.close], [100, 108, 96, 101]);
  assert.equal(candle.partial, true); assert.equal(candle.observationOnly, true);
});

test('late history retains observed live extrema and newest close', () => {
  const value = series(); value.seed([bar()], context);
  value.quote({...context, timestamp: time + 4_000, lastPrice: 109});
  value.quote({...context, timestamp: time + 5_000, lastPrice: 103});
  value.seed([bar(0, {open: 99, high: 106, close: 104})], context);
  const candle = value.candles()[0];
  assert.deepEqual([candle.open, candle.high, candle.low, candle.close], [99, 109, 98, 103]);
});

test('same timestamp price changes work, older and exact duplicate quotes do not rewind', () => {
  const value = series();
  assert.equal(value.quote({...context, timestamp: time, lastPrice: 101}), true);
  assert.equal(value.quote({...context, timestamp: time, lastPrice: 102}), true);
  assert.equal(value.quote({...context, timestamp: time, lastPrice: 102}), false);
  assert.equal(value.quote({...context, timestamp: time - 1, lastPrice: 95}), false);
  assert.equal(value.current.spot, 102); assert.equal(value.quoteLine().length, 1);
});

test('authoritative finalized OHLC replaces an older observed quote close without shrinking proven extrema', () => {
  const value = series(); value.seed([bar()], context);
  value.quote({...context, timestamp: time + 10_000, lastPrice: 109});
  value.seed([bar(0, {close: 104})], {...context, asOf: time + 60_000});
  assert.equal(value.candles()[0].close, 104);
  assert.equal(value.candles()[0].high, 109);
  value.quote({...context, timestamp: time + 20_000, lastPrice: 103});
  assert.equal(value.candles()[0].close, 104, 'late quote cannot reopen a finalized source bar');
  value.seed([bar(0, {high: 110, close: 106})], {...context, asOf: time + 120_000});
  assert.equal(value.candles()[0].close, 106);
  assert.equal(value.candles()[0].partial, false, 'complete source OHLC subsumes old sampled extrema');
  value.seed([bar(0, {close: 100})], {...context, asOf: time + 60_000});
  assert.equal(value.candles()[0].close, 106, 'older source publication cannot rewind newer OHLC');
  assert.equal(value.candles()[0].sourceAsOf, time + 120_000);
});

test('interval aggregation preserves source OHLC and marks holes partial without inventing bars', () => {
  const value = series(); value.seed([bar(), bar(1, {high: 107, low: 97, close: 103}), bar(4, {high: 108, close: 104})], context);
  const candle = value.candles(300_000)[0];
  assert.deepEqual([candle.open, candle.high, candle.low, candle.close], [100, 108, 97, 104]);
  assert.equal(candle.sourceBars, 3); assert.equal(candle.partial, true);
  assert.deepEqual(value.candles(30_000), []);
});

test('replay excludes future full-minute OHLC and quote points', () => {
  const value = series(); value.seed([bar(), bar(1)], context);
  value.quote({...context, timestamp: time + 120_000, lastPrice: 105});
  assert.equal(value.candles(60_000, {cutoffTime: time + 90_000}).length, 1);
  assert.equal(value.quoteLine({cutoffTime: time + 90_000}).length, 0);
});

test('explicit scope blocks wrong symbols, session races and reset leakage', () => {
  const value = series(); value.seed([bar()], context);
  assert.equal(value.seed([bar(1)], {symbol: 'NDX'}), false);
  assert.equal(value.seed([bar(1, {symbol: 'NDX'})], context), false);
  assert.equal(value.quote({...context, sessionDate: '2026-10-19', timestamp: time, lastPrice: 99}), false);
  value.reset({symbol: 'NDX', sessionDate: '2026-10-21'});
  assert.equal(value.size, 0); assert.equal(value.current, null);
  assert.deepEqual(value.quoteLine(), []);
});

test('bounded bars and quotes prune oldest, getters cannot mutate retained state', () => {
  const value = series({maxBars: 2, maxQuotes: 2});
  value.seed([bar(2), bar(), bar(1)], context);
  for (let n = 0; n < 3; n++) value.quote({...context, timestamp: time + n, lastPrice: 100 + n});
  assert.deepEqual(value.candles().map(row => row.time), [time + 60_000, time + 120_000]);
  assert.equal(value.quoteLine().length, 2);
  value.candles()[0].high = 999; value.current.spot = 999;
  assert.equal(value.candles()[0].high, 105); assert.equal(value.current.spot, 102);
});
