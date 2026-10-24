import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { drawingCoordinateToTime, drawingTimeToCoordinate } from '../src/lib/chartDrawingCoordinates.ts';
import { createDrawing, DRAW_TOOL_LIST, normalizeDrawings } from '../src/lib/chartDrawTools.ts';
import { positionToolScreenGeometry } from '../src/lib/chartDrawGeometry.ts';

const start = 1792589400;
function nativeScale(times, spacing = 12, offset = 30) {
  return {
    timeToIndex(time, nearest) {
      if (!times.length) return null;
      const found = times.findIndex(t => t >= time);
      const index = found < 0 ? times.length - 1 : found;
      return nearest || times[index] === time ? index : null;
    },
    coordinateToLogical: x => (x - offset) / spacing,
    logicalToCoordinate: index => offset + index * spacing,
    coordinateToTime: x => times[Math.round((x - offset) / spacing)] ?? null,
  };
}
const minutes = interval => Array.from({ length: 90 / interval }, (_, i) => start + i * interval * 60);

test('actual Chart projectors use the painted scale while timeframe props are pending', () => {
  const chart = readFileSync(new URL('../src/components/Chart.tsx', import.meta.url), 'utf8');
  const source = chart.slice(chart.indexOf('  function timeToX(time: number)'), chart.indexOf('  function priceToY(price: number)'));
  const scale = nativeScale(minutes(1));
  scale.timeToCoordinate = time => {
    const index = scale.timeToIndex(time, false);
    return index == null ? null : scale.logicalToCoordinate(index);
  };
  const sandbox = {
    chartRef: { current: { timeScale: () => scale } },
    candles: minutes(1).map(t => ({ timestamp: t * 1000 })),
    candleIntervalMs: 180000, // selected 3m; native still contains 1m
    normalizeTimeValue: value => value,
    drawingTimeToCoordinate, drawingCoordinateToTime,
  };
  vm.createContext(sandbox);
  vm.runInContext(ts.transpileModule(source + '\nglobalThis.result = {timeToX,xToTime};', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, sandbox);
  const future = start + 100 * 60;
  assert.equal(sandbox.result.timeToX(future), 1230);
  assert.equal(sandbox.result.xToTime(1230), future);
  const fractional = start + 10.4 * 60;
  assert.ok(Math.abs(sandbox.result.xToTime(sandbox.result.timeToX(fractional)) - fractional) < 0.001);
});

test('long/short drawings retain exact anchors and prices through 1m → 3m → 1m', () => {
  for (const tool of ['longPosition', 'shortPosition']) {
    const sign = tool === 'longPosition' ? 1 : -1;
    const drawing = createDrawing(tool, [
      { time: start + 61 * 60, price: 21000 },
      { time: start + 73 * 60, price: 21000 - sign * 25 },
      { time: start + 73 * 60, price: 21000 + sign * 50 },
    ]);
    const original = JSON.stringify(drawing);
    for (const interval of [1, 3, 5, 15, 1]) {
      const scale = nativeScale(minutes(interval));
      const points = drawing.points.map(p => ({ x: drawingTimeToCoordinate(scale, p.time), y: (21100 - p.price) * 2 }));
      const rect = positionToolScreenGeometry(points);
      assert.ok(rect);
      assert.ok(Math.abs(rect.width - 144 / interval) < 0.001);
      assert.equal(rect.stopY, (21100 - drawing.points[1].price) * 2);
      assert.equal(rect.targetY, (21100 - drawing.points[2].price) * 2);
      assert.equal(JSON.stringify(drawing), original, 'projection must not rewrite saved anchors');
    }
  }
});

test('shared anchors roundtrip at fractional bars, session gaps, edges and irregular event times', () => {
  for (const times of [minutes(1), minutes(3), [start, start + 3, start + 11, start + 12, start + 40],
    [...minutes(1), ...minutes(1).map(t => t + 86400)]]) {
    const scale = nativeScale(times);
    for (const logical of [-3.7, -0.4, 0, 0.25, 1.5, times.length - 1.25, times.length + 3.4]) {
      const x = scale.logicalToCoordinate(logical);
      const time = drawingCoordinateToTime(scale, x);
      assert.ok(time != null);
      assert.ok(Math.abs(drawingTimeToCoordinate(scale, time) - x) < 0.001);
    }
  }
});

test('every saved catalogue tool keeps its time/price anchors across timeframe and zoom changes', () => {
  for (const spec of DRAW_TOOL_LIST) {
    if (spec.id === 'cursor' || spec.id === 'eraser') continue;
    const drawing = createDrawing(spec.id, Array.from({ length: typeof spec.points === 'number' ? Math.max(3, spec.points) : 12 }, (_, index) => ({
      time: start + (10.4 + index * 3.3) * 60, price: 21000 + index * 2.5,
    })), 'test');
    const original = JSON.stringify(drawing.points);
    for (const interval of [1, 3, 15, 1]) {
      for (const spacing of [3, 12, 35]) {
        const scale = nativeScale(minutes(interval), spacing, -200);
        for (const point of drawing.points) {
          const x = drawingTimeToCoordinate(scale, point.time);
          assert.ok(x != null, spec.id);
          assert.ok(Math.abs(drawingCoordinateToTime(scale, x) - point.time) < 0.001, spec.id);
        }
      }
    }
    assert.equal(JSON.stringify(normalizeDrawings([drawing])[0].points), original, spec.id);
  }
});

test('future anchors use native recent median, not a weekend gap or requested timeframe', () => {
  const times = [...minutes(1), start + 3 * 86400];
  const scale = nativeScale(times);
  assert.equal(drawingTimeToCoordinate(scale, times.at(-1) + 120), scale.logicalToCoordinate(times.length + 1));
});

test('missing/degenerate native timeline returns no fabricated coordinates', () => {
  for (const times of [[], [start]]) {
    const scale = nativeScale(times);
    assert.equal(drawingTimeToCoordinate(scale, start + 60), null);
    assert.equal(drawingCoordinateToTime(scale, 1000), null);
  }
});

test('actual viewport callback rejects old timeline transforms and coalesces one reproject', () => {
  const source = readFileSync(new URL('../src/components/ChartDrawLayer.tsx', import.meta.url), 'utf8');
  const callback = source.slice(source.indexOf('    const onViewport = () => {'), source.indexOf('    // The repaint notifier already'));
  let redraws = 0;
  const attributes = new Map();
  const sandbox = {
    projectionBasisRef: { current: { timeA: 1, timeB: 100, priceA: 100, priceB: 101, xA: 0, xB: 100, yA: 0, yB: 10 } },
    drawingsGroupRef: { current: { setAttribute: (k,v) => attributes.set(k,v), removeAttribute: k => attributes.delete(k) } },
    renderedTimelineRef: { current: 1 }, projectionRevisionRef: { current: () => 2 },
    timelineRedrawPendingRef: { current: false },
    viewportProjectionRef: { current: { toX: t => t * 100, toY: p => p * 100 } },
    forceRedraw: () => redraws++, settle() {},
  };
  vm.createContext(sandbox);
  vm.runInContext(callback + '\nglobalThis.paint = onViewport;', sandbox);
  sandbox.paint(); sandbox.paint();
  assert.equal(attributes.get('visibility'), 'hidden');
  assert.equal(attributes.has('transform'), false, 'no huge scale is applied to any tool');
  assert.equal(redraws, 1);
  assert.match(source, /renderedTimelineRef\.current = renderedTimeline/);
  assert.match(source, /removeAttribute\("visibility"\)/);
});

test('ordinary pan/zoom still uses synchronous affine compensation without React work', () => {
  const source = readFileSync(new URL('../src/components/ChartDrawLayer.tsx', import.meta.url), 'utf8');
  const callback = source.slice(source.indexOf('    const onViewport = () => {'), source.indexOf('    // The repaint notifier already'));
  const attributes = new Map();
  let redraws = 0;
  const sandbox = {
    projectionBasisRef: { current: { timeA: 1, timeB: 2, priceA: 100, priceB: 101, xA: 10, xB: 20, yA: 50, yB: 40 } },
    drawingsGroupRef: { current: { setAttribute: (k,v) => attributes.set(k,v), removeAttribute: k => attributes.delete(k) } },
    renderedTimelineRef: { current: 1 }, projectionRevisionRef: { current: () => 1 }, timelineRedrawPendingRef: { current: false },
    viewportProjectionRef: { current: { toX: t => t * 20 + 7, toY: p => (105 - p) * 20 + 3 } },
    forceRedraw: () => redraws++, settle() {},
  };
  vm.createContext(sandbox); vm.runInContext(callback + '\nglobalThis.paint = onViewport;', sandbox); sandbox.paint();
  assert.equal(attributes.get('transform'), 'translate(7 3) scale(2 2)');
  assert.equal(redraws, 0);
});
