import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateIndicatorSeries } from '../src/lib/chartIndicatorEngine.ts';
import { calculateDeepEffort } from '../src/lib/deepEffort.ts';
import { resolveVolumeProfileGradient } from '../src/lib/volumeProfileGradients.ts';

const theme = { positive: '#11FF11', negative: '#FF1111', primary: '#FFFFFF', secondary: '#AAAAAA', muted: '#555555' };
const candles = Array.from({ length: 60 }, (_, index) => {
  const close = 100 + Math.sin(index / 5) * 8;
  return { timestamp: 1700000000000 + index * 60_000, open: close, high: close + 2, low: close - 2, close, volume: 100 };
});
const instance = { indicatorId: 'deep-m-effort-nq', instanceId: 'blocks', enabled: true };
const plot = (settings, replayTimestampMs = null) =>
  calculateIndicatorSeries({ ...instance, settings }, candles, theme, { instrument: 'NQ', replayTimestampMs });

test('Big Blocks moving average is opt-in and the selected length affects the plotted series', () => {
  assert.deepEqual(plot({}), []);
  const [fast] = plot({ showMovingAverage: true, averageLength: 2 });
  const [slow] = plot({ showMovingAverage: true, averageLength: 40 });
  assert.notEqual(fast.data.at(-1).value, slow.data.at(-1).value);
  const expected = calculateDeepEffort(candles, { instrument: 'NQ', averageLength: 40 }).average;
  assert.deepEqual(slow.data.map(point => point.value), expected.map(point => point.value));
});

test('Big Blocks moving average uses the selected style, gradient and replay cutoff', () => {
  const settings = {
    showMovingAverage: true, averageLength: 20, maAutoColor: 'price',
    maLineWidth: 3, maLineStyle: 'dashed', gradientPreset: 'pink-blue', showValueLabel: false,
  };
  const [series] = plot(settings, candles[25].timestamp);
  const gradient = resolveVolumeProfileGradient('pink-blue');
  assert.equal(series.lineWidth, 3);
  assert.equal(series.lineStyle, 'dashed');
  assert.equal(series.lastValueVisible, false);
  assert.deepEqual(new Set(series.data.map(point => point.color)), new Set([gradient.from, gradient.to]));
  assert.equal(series.data.at(-1).time, candles[25].timestamp / 1000);
  const [single] = plot({ ...settings, maAutoColor: 'none' });
  assert.ok(single.data.every(point => point.color === gradient.to));
});
