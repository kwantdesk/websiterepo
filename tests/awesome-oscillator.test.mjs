import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateIndicatorSeries } from '../src/lib/chartIndicatorEngine.ts';
import { normalizeStoredIndicator } from '../src/lib/chartIndicatorConfig.ts';
import { LiveDeltaPaneModel } from '../src/lib/liveDeltaPanes.ts';

const indicatorId = 'awesome-oscillator';
const theme = { primary: '#fff', secondary: '#ccc', positive: '#0f0', negative: '#f00', muted: '#888' };
const makeCandles = (prices) => prices.map((price, index) => ({
  timestamp: 1700000000000 + index * 60_000,
  open: price - 1, high: price + 2, low: price - 2, close: price + 1, volume: 10,
}));
const candles = makeCandles([10, 10, 14, 15, 10, 8, 8, 13]);
const instance = { indicatorId, instanceId: 'ao', enabled: true, settings: { fastLength: 1, slowLength: 3 } };
const plot = (input = candles, options = instance, context = {}) =>
  calculateIndicatorSeries(options, input, theme, context)[0];

test('AO uses high-low midpoints and colours rising and falling values on both sides of zero', () => {
  const series = plot();
  assert.equal(series.includeZeroInScale, true);
  const result = series.data;
  assert.equal(result[0].time, candles[2].timestamp / 1000);
  assert.deepEqual(result.map(point => Number(point.value.toFixed(5))), [2.66667, 2, -3, -3, -0.66667, 3.33333]);
  assert.deepEqual(result.map(point => point.color), ['#0f0', '#f00', '#f00', '#0f0', '#0f0', '#0f0']);
});

test('AO preserves legacy colours and applies individual growing and falling colours', () => {
  const old = normalizeStoredIndicator({ ...instance, settings: { ...instance.settings, useThemeColors: false, plotColor: '#ABCDE0' } });
  assert.equal(old.settings.plotUpColor, '#ABCDE0');
  assert.equal(old.settings.plotDownColor, '#ABCDE0');
  assert.ok(plot(candles, old).data.every(point => point.color === '#ABCDE0'));
  const custom = { ...old, settings: { ...old.settings, plotUpColor: '#12AB34', plotDownColor: '#CD1234' } };
  assert.deepEqual(plot(candles, custom).data.slice(0, 2).map(point => point.color), ['#12AB34', '#CD1234']);
});

test('AO waits for its slow window and normalizes settings to the applied lengths', () => {
  const normalized = normalizeStoredIndicator({ ...instance, settings: { fastLength: 500, slowLength: 2 } });
  assert.equal(normalized.settings.slowLength, 501);
  assert.equal(plot(candles, normalized).data.length, 0);
  const deep = makeCandles(Array.from({ length: 2500 }, (_, index) => 50 + index % 9));
  const longest = { ...instance, settings: { fastLength: 500, slowLength: 1000 } };
  assert.equal(plot(deep, longest).data.length, 1501);
});

test('AO live model matches the engine and replay has the same prefix without future candle values', () => {
  const model = new LiveDeltaPaneModel();
  model.hydrate(candles.slice(0, -1));
  model.observeSnapshot(candles);
  const group = { key: 'ao', indicatorId, settings: instance.settings, series: [] };
  const [live] = model.calculate(group, { candles, theme });
  assert.deepEqual(live.data, plot().data);
  const cutoff = candles[4].timestamp;
  assert.deepEqual(plot(candles, instance, { replayTimestampMs: cutoff }).data, plot(candles.slice(0, 5)).data);
  const overlay = plot(candles, { ...instance, settings: { ...instance.settings, chartArea: 'chart' } });
  assert.equal(overlay.placement, 'overlay');
  assert.equal(overlay.independentScale, true);
});
