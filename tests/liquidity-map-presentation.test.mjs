import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeCvdStyle, cvdTimeCoordinate, advanceCvdPresentation, tradeClusterReference, tradeBubbleZoom } from '../public/heatmap-app/src/liquidity-presentation.js';
import { RollingDepthEngine, tradeClusterWindowMs } from '../public/heatmap-app/src/depth-engine.js';
import { indexHistoryFrames, planIncrementalTradeClusterRefresh, resolveTradeClusterAnchorIndex, resolveTradeClusterTimeIndex } from '../public/heatmap-app/src/renderer.js';
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const renderer = read('public/heatmap-app/src/renderer.js');

test('CVD choices migrate old candles to line and remove only the named header controls', () => {
  assert.deepEqual(['candles', undefined, 'unknown', 'line', 'bars'].map(normalizeCvdStyle), ['line', 'line', 'line', 'line', 'bars']);
  const html = read('public/heatmap-app/index.html'), main = read('public/heatmap-app/src/main.js');
  assert.deepEqual([...html.matchAll(/data-cvd-style="([^"]+)"/g)].map(m => m[1]), ['line', 'bars']);
  for (const id of ['cvdGoLive', 'cvdSettingsButton', 'cvdLegend']) {
    assert.ok(!html.includes(`id="${id}"`)); assert.ok(!main.includes(`$('${id}')`));
  }
  assert.ok(html.includes('id="goLive"'), 'main-map live navigation remains available');
  assert.ok(main.includes('this.settings.cvdDisplayStyle = style'));
});

test('CVD live tip shares the exact price data edge and never flashes into the live gap', () => {
  const history = [1000, 1100, 1250].map(timestamp => ({ timestamp }));
  const layout = { start: 0, end: 2, xForIndex: index => index * 200 };
  assert.equal(cvdTimeCoordinate(history, layout, 1250), 400);
  assert.equal(cvdTimeCoordinate(history, layout, 1249), 200 + 200 * 149 / 150);
  assert.equal(cvdTimeCoordinate(history, layout, 1300), 400);
  assert.equal(cvdTimeCoordinate(history, layout, 900), 0);
  assert.equal(cvdTimeCoordinate(history, layout, 1175), 300);
  assert.ok(renderer.includes('cvdTimeCoordinate(history, this.layout, timestamp)'));
});

test('live CVD presentation eases, retargets without overshoot, settles and never edits source totals', () => {
  const initial = Object.freeze({ value: 0, buy: 0, sell: 0, minimum: -10, maximum: 10 });
  const target = Object.freeze({ value: 100, buy: 100, sell: 0, minimum: -10, maximum: 110 });
  let state = advanceCvdPresentation(null, initial, { key: 'NQ/session', live: true, now: 0 });
  for (let now = 16; now <= 256; now += 16) {
    const previous = state.value;
    state = advanceCvdPresentation(state, target, { key: 'NQ/session', live: true, now });
    assert.ok(state.value >= previous && state.value <= 100);
    if (now === 16) assert.ok(state.value > 0 && state.value < 100);
  }
  assert.equal(state.value, 100); assert.equal(state.active, false);
  const reverse = { ...target, value: -50, minimum: -60 };
  state = advanceCvdPresentation(state, reverse, { key: 'NQ/session', live: true, now: 272 });
  assert.ok(state.value > -50 && state.value < 100);
  assert.equal(advanceCvdPresentation(state, reverse, { key: 'NQ/session', live: false, now: 273 }).value, -50, 'paused/history must remain exact');
  assert.equal(advanceCvdPresentation(state, initial, { key: 'NQ/next-session', live: true, now: 274 }).value, 0);
  assert.equal(target.value, 100);
  assert.match(read('public/heatmap-app/src/main.js'), /this\.renderer\.cvdInMotion && canvasPaintDue && this\.lastCanvasPaintAt !== timestamp/);
});

test('actual CVD canvas draw aligns the tip in line/bars and finishes animation without repainting the map', () => {
  const boundsSource = renderer.slice(renderer.indexOf('function timestampLowerBound('), renderer.indexOf('function niceTickStep('));
  const bounds = new Function(boundsSource + '; return {timestampLowerBound,timestampUpperBound};')();
  const source = renderer.slice(renderer.indexOf('  #drawCvd('), renderer.indexOf('  hitTest(')).trim().replace('#drawCvd', 'function').replaceAll('this.#font', 'this.font');
  let now = 0, path = [], paths = [], fills = [];
  const ctx = { clearRect() {}, fillRect(...args) { fills.push(args); }, beginPath() { path = []; }, moveTo(...args) { path.push(args); }, lineTo(...args) { path.push(args); }, stroke() { paths.push(path); }, setLineDash() {}, fillText() {} };
  const draw = new Function('fitCanvas', 'timestampLowerBound', 'timestampUpperBound', 'normalizeCvdStyle', 'advanceCvdPresentation', 'cvdTimeCoordinate', 'colorCss', 'performance', 'return ' + source)(() => ({ context: ctx, width: 900, height: 120 }), bounds.timestampLowerBound, bounds.timestampUpperBound, normalizeCvdStyle, advanceCvdPresentation, cvdTimeCoordinate, () => '#fff', { now: () => now });
  const history = [1000, 1100, 1250].map(timestamp => ({ timestamp }));
  const points = history.map(({ timestamp }, i) => ({ timestamp, value: i * 10, open: i * 10, high: i * 10, low: i * 10, close: i * 10, buy: i * 10, sell: 0 }));
  const analysis = { sessionCvd: { points }, cvdSession: 'session-a', liveCvd: true };
  const state = { cvdCanvas: {}, chrome: { axis: '#000', grid: '1,1,1', muted: '#888' }, font: () => '8px monospace', layout: { config: { key: 'NQ' }, width: 1000, plotWidth: 900, start: 0, end: 2, columnPixels: 1.24, xForIndex: i => i * 400 } };
  const settings = { cvdDisplayStyle: 'line', cvdRange: 'loaded', cvdScale: 'compact' };
  const paint = () => { paths = []; fills = []; draw.call(state, history, 0, 2, settings, {}, analysis); return paths.at(-1); };
  assert.equal(paint().at(-1)[0], 800, 'price edge is 800, not the 900px-wide CVD pane');
  points[2] = { ...points[2], value: 100, high: 100, close: 100, buy: 100 };
  const exactSource = JSON.stringify(points); now = 16;
  assert.equal(paint().at(-1)[0], 800); assert.ok(state.cvdInMotion);
  assert.ok(state.cvdPresentation.value > 20 && state.cvdPresentation.value < 100);
  const animateSource = renderer.slice(renderer.indexOf('  renderCvdAnimation('), renderer.indexOf('  #drawCvd(')).trim().replace('renderCvdAnimation', 'function').replaceAll('this.#drawCvd', 'this.drawCvd');
  const animate = new Function('return ' + animateSource)();
  state.drawCvd = (...args) => draw.call(state, ...args);
  for (now = 32; now <= 256; now += 16) animate.call(state);
  assert.equal(state.cvdInMotion, false); assert.equal(state.cvdPresentation.value, 100);
  assert.equal(JSON.stringify(points), exactSource);
  settings.cvdDisplayStyle = 'bars'; now += 16; paint();
  const bar = fills.at(-1); assert.equal(bar[0] + bar[2] / 2, 800);
  settings.cvdDisplayStyle = 'line'; analysis.liveCvd = false;
  points.splice(0,points.length,...history.map(({timestamp},i)=>({timestamp,value:[1000,1010,990][i],open:0,high:100000,low:0,buy:0,sell:0})));
  const sourceSeed=JSON.stringify(points),peakPath=paint(),ys=peakPath.map(p=>p[1]);
  assert.ok(Math.max(...ys)-Math.min(...ys)>60,'compact line scaling must reveal peaks rather than scale to invisible bucket OHLC');
  assert.equal(JSON.stringify(points),sourceSeed,'scaling cannot rewrite the actual CVD history');
  settings.cvdScale='include-zero';const zeroPath=paint().map(p=>p[1]);
  assert.ok(Math.max(...zeroPath)-Math.min(...zeroPath)<5,'explicit include-zero scaling remains available');
  settings.cvdScale='compact';settings.cvdDisplayStyle='bars';settings.cvdSplit=true;
  points.forEach(p=>{p.buy=100000;p.sell=-100000;});paint();
  const barYs=fills.slice(-3).map(f=>f[1]);
  assert.ok(Math.max(...barYs)-Math.min(...barYs)>60,'bars must not scale to hidden split lines');
});

test('actual bubble renderer keeps identities, volumes, colours and market anchors through zoom and new prints', () => {
  const engine = new RollingDepthEngine(200);
  const frame = index => ({ id: index, timestamp: 1000 + index * 50, lastTick: 100, bestBid: 99, bestAsk: 101, bids: new Map([[99, 5]]), asks: new Map([[101, 5]]), trades: [{ id: `execution-${index}`, timestamp: 1000 + index * 50, tick: 90 + index % 21, size: 3 + index % 11, side: index % 3 ? 'buy' : 'sell' }] });
  for (let i = 0; i < 120; i++) engine.append(frame(i));
  const history = engine.frames, config = { key: 'NQ', contract: 'NQZ6', tickSize: .25, defaultVisibleRows: 112 };
  let now = 1000, builds = 0;
  const buildOptions = [];
  const original = engine.clusterTrades.bind(engine);
  engine.clusterTrades = options => { builds++; buildOptions.push(options); return original(options); };
  const source = renderer.slice(renderer.indexOf('  #drawTrades('), renderer.indexOf('  #sphereSprite(')).trim().replace('#drawTrades', 'function').replaceAll('this.#drawSphereDot', 'this.drawSphereDot');
  const draw = new Function('indexHistoryFrames', 'tradeClusterReference', 'tradeBubbleZoom', 'planIncrementalTradeClusterRefresh', 'resolveTradeClusterAnchorIndex', 'resolveTradeClusterTimeIndex', 'tradeClusterWindowMs', 'performance', 'TRADE_CLUSTER_REFRESH_MS', 'return ' + source)(indexHistoryFrames, tradeClusterReference, tradeBubbleZoom, planIncrementalTradeClusterRefresh, resolveTradeClusterAnchorIndex, resolveTradeClusterTimeIndex, tradeClusterWindowMs, { now: () => now }, 100);
  const settings = { circleSize: 40, circleTransparency: 41, smartClustering: 52, bubbleDifferential: false, minimumTradeSize: 1, minimumPixelVolume: 1 };
  const makeState = () => ({ layout: { config, start: 60, end: 119, rowTicks: 1, plotHeight: 560, visibleTickSpan: 112, columnPixels: 1.24, xForIndex: i => i * 2, yForTick: tick => tick * 2 }, depthEngine: engine, tradeClusterCache: { settingsKey: '', ready: false, value: [] }, dots: [], drawSphereDot(_ctx, x, y, cluster) { this.dots.push({ x, y, ...cluster }); } });
  const a = makeState(), b = makeState(), ctx = { save() {}, restore() {} };
  draw.call(a, ctx, history, settings, {}); draw.call(b, ctx, history, settings, {});
  assert.ok(buildOptions.every(options => options.start === 0));
  const originalClusters = a.tradeClusterCache.value;
  assert.equal(originalClusters.reduce((sum, c) => sum + c.total, 0), history.reduce((sum, f) => sum + f.trades[0].size, 0));
  a.layout = { ...a.layout, start: 0, rowTicks: 8, visibleTickSpan: 700, columnPixels: .25, xForIndex: i => i, yForTick: tick => tick };
  a.dots = []; now += 1000; draw.call(a, ctx, history, settings, {});
  assert.equal(builds, 2, 'zoom must not recluster or apply different filters');
  assert.equal(a.tradeClusterCache.value, originalClusters);
  for (const dot of a.dots) { const old = originalClusters.find(c => c.key === dot.key); assert.ok(old); assert.equal(dot.total, old.total); assert.equal(dot.buyRatio, old.buyRatio); assert.equal(dot.x, old.index); assert.equal(dot.y, old.tick); }
  engine.append(frame(120)); a.layout.end = b.layout.end = 120; now += 200;
  draw.call(a, ctx, history, settings, {}); draw.call(b, ctx, history, settings, {});
  assert.deepEqual(a.tradeClusterCache.value, b.tradeClusterCache.value, 'zoom must not change grouping when subsequent actual prints arrive');
  assert.equal(builds, 4);
  assert.deepEqual(buildOptions[2], buildOptions[3], 'subsequent clustering uses identical reference geometry and tail boundaries');
  engine.reset(); for (let i = 0; i <= 120; i++) engine.append(frame(i));
  now += 200; draw.call(a, ctx, history, settings, {});
  assert.equal(builds, 5, 'a replacement tape must not reuse another source history with the same revision/count');
  assert.equal(buildOptions.at(-1).start, 0);
  assert.ok(a.tradeClusterCache.value.every(cluster => engine.frames.includes(cluster.anchorFrame)));
});
