import test from 'node:test';
import assert from 'node:assert/strict';
import { RollingDepthEngine } from '../public/heatmap-app/src/depth-engine.js';

const frame = {
  id: 1, timestamp: 1000, trades: [],
  bids: Array.from({ length: 80 }, (_, i) => [i, i % 20 + 1]),
  asks: Array.from({ length: 80 }, (_, i) => [80 + i, i % 20 + 1]),
};
const geometry = {
  bottomTick: 0, topTick: 160, rowTicks: 1,
  filterType: 'none', sensitivity: 1, temporalEnhancement: 0,
};
const create = () => { const e = new RollingDepthEngine(10); e.append(frame); return e; };

test('zoomed grouped rows recalibrate rather than all saturating on the one-tick scale', () => {
  const e = create();
  e.buildHeatmap(geometry);
  const zoomed = e.buildHeatmap({ ...geometry, rowTicks: 8 });
  const fresh = create().buildHeatmap({ ...geometry, rowTicks: 8 });
  assert.equal(zoomed.contrastChanged, true);
  assert.deepEqual(zoomed.contrast, fresh.contrast);
  assert.deepEqual(zoomed.intensities, fresh.intensities);
  assert.ok(new Set(zoomed.intensities).size >= 4);
  assert.ok([...zoomed.intensities].some(value => value < 128));
  assert.equal(zoomed.height, 20);
  assert.deepEqual(e.frames[0].bids, frame.bids);
  assert.deepEqual(e.frames[0].asks, frame.asks);
});

test('zooming back restores the same fine scale as a fresh renderer', () => {
  const e = create();
  e.buildHeatmap(geometry);
  e.buildHeatmap({ ...geometry, rowTicks: 8 });
  const restored = e.buildHeatmap(geometry);
  const fresh = create().buildHeatmap(geometry);
  assert.equal(restored.contrastChanged, true);
  assert.deepEqual(restored.contrast, fresh.contrast);
  assert.deepEqual(restored.intensities, fresh.intensities);
});

test('pan, sensitivity and incoming frames do not repeatedly recalibrate or invalidate incremental reuse', () => {
  const e = create();
  const first = e.buildHeatmap(geometry);
  const repeated = e.buildHeatmap(geometry);
  assert.equal(repeated.contrastChanged, false);
  assert.equal(repeated.reusedColumns, repeated.width);
  e.append({ ...frame, id: 2, timestamp: 2000 });
  const live = e.buildHeatmap(geometry);
  const pan = e.buildHeatmap({ ...geometry, bottomTick: 4, topTick: 164 });
  const sensitivity = e.buildHeatmap({ ...geometry, sensitivity: 0.5 });
  for (const result of [live, pan, sensitivity]) {
    assert.equal(result.contrastChanged, false);
    assert.deepEqual(result.contrast, first.contrast);
  }
});

test('reset clears the grouping identity before a new instrument calibrates', () => {
  const e = create();
  e.buildHeatmap({ ...geometry, rowTicks: 8 });
  e.reset();
  e.append(frame);
  const result = e.buildHeatmap(geometry);
  assert.deepEqual(result.contrast, create().buildHeatmap(geometry).contrast);
});
