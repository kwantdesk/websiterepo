import assert from 'node:assert/strict';
import test from 'node:test';
import { DepthMarketFeed } from '../public/heatmap-app/src/live-market.js';
import { indexHistoryFrames, resolveTradeClusterAnchorIndex, planIncrementalTradeClusterRefresh } from '../public/heatmap-app/src/renderer.js';

const raw = (id, timestamp) => ({ id, timestamp, root: 'NQ', contractSymbol: 'NQZ6', tickSize: .25,
  bids: [[400, 10, 2]], asks: [[401, 12, 3]], lastTick: 400, bestBid: 400, bestAsk: 401,
  fullDepth: true, bookValid: true, source: 'rithmic-depth-by-order', readOnly: true, trades: [] });
const settle = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };

test('continuing price ticks cannot hide a dead depth stream, and a newer probe replaces the stranded socket', async () => {
  const originals = { fetch: globalThis.fetch, now: Date.now, interval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval, timeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  let now = 100000;
  let watchdog;
  const timers = [];
  const streams = [];
  const requests = [];
  const emitted = [];
  let probes = 0;
  Date.now = () => now;
  globalThis.setInterval = callback => { watchdog = callback; return { unref() {} }; };
  globalThis.clearInterval = () => {};
  globalThis.setTimeout = (callback, delay) => { const timer = { callback, delay, unref() {} }; timers.push(timer); return timer; };
  globalThis.clearTimeout = () => {};
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return ++probes === 1 ? { ok: false } : { ok: true, json: async () => ({
      status: { connected: true, fullDepth: true, depthMode: 'L3' }, snapshot: raw(2, now),
    }) };
  };
  const feed = new DepthMarketFeed({ symbol: 'NQ', onSnapshot: (frame, metadata) => emitted.push({ frame, metadata }),
    eventSourceFactory: url => {
      const handlers = new Map();
      const stream = { url, handlers, closed: false, close() { this.closed = true; }, addEventListener(name, handler) { handlers.set(name, handler); } };
      streams.push(stream); return stream;
    } });
  try {
    feed.start(); await settle();
    const first = streams[0];
    first.handlers.get('depth')({ data: JSON.stringify({ status: { connected: true, fullDepth: true, depthMode: 'L3' }, snapshot: raw(1, now) }) });
    const lastDepthAt = feed.lastMarketFrameAt;
    now += 9000;
    first.handlers.get('tick')({ data: JSON.stringify({ tick: 401, timestamp: now }) });
    first.handlers.get('heartbeat')({ data: '{}' });
    first.handlers.get('depth')({ data: JSON.stringify({ status: { connected: true, fullDepth: true, depthMode: 'L3' }, snapshot: { ...raw(2, now), fullDepth: false } }) });
    assert.equal(feed.lastMarketFrameAt, lastDepthAt, 'a price tick is not a full-book update');
    watchdog(); await settle();
    assert.equal(probes, 2);
    assert.ok(requests[1].options.signal instanceof AbortSignal, 'probe has a body-aware deadline');
    assert.equal(first.closed, true, 'newer real HTTP book must repair the stranded SSE connection');
    assert.equal(emitted.at(-1).metadata.recovered, true);
    assert.deepEqual(emitted.at(-1).frame.trades, [], 'repair must not duplicate execution bubbles');
    const reconnect = timers.find(timer => timer.delay === 180);
    assert.ok(reconnect); reconnect.callback(); await settle();
    assert.equal(streams.length, 2);
    assert.match(streams[1].url, /afterTimestamp=109000/);
  } finally {
    feed.stop(); Date.now = originals.now; globalThis.fetch = originals.fetch;
    globalThis.setInterval = originals.interval; globalThis.clearInterval = originals.clearInterval;
    globalThis.setTimeout = originals.timeout; globalThis.clearTimeout = originals.clearTimeout;
  }
});

test('indexed bubble positions exactly match scans after rolling, without per-bubble history walks', () => {
  const history = Array.from({ length: 1800 }, (_, id) => ({ id }));
  const clusters = Array.from({ length: 2500 }, (_, index) => ({ anchorFrame: history[index % 1800], minimumFrame: history[index % 1800], maximumFrame: history[index % 1800] }));
  const indices = indexHistoryFrames(history);
  for (const cluster of clusters) assert.equal(resolveTradeClusterAnchorIndex(history, cluster, indices), resolveTradeClusterAnchorIndex(history, cluster));
  history.shift(); history.push({ id: 1800 });
  const rolled = indexHistoryFrames(history);
  const expected = planIncrementalTradeClusterRefresh(history, clusters, 0, 1799, history[1797], 32);
  history.indexOf = () => { throw new Error('per-bubble linear scan'); };
  assert.equal(resolveTradeClusterAnchorIndex(history, clusters[0], rolled), -1);
  for (const cluster of clusters.slice(1)) assert.equal(resolveTradeClusterAnchorIndex(history, cluster, rolled), rolled.get(cluster.anchorFrame) ?? -1);
  assert.deepEqual(planIncrementalTradeClusterRefresh(history, clusters, 0, 1799, history[1797], 32, rolled), expected);
});

test('a probe deadline covers a hung response body and releases the single-flight guard', async () => {
  const originalFetch = globalThis.fetch;
  const originalTimeout = AbortSignal.timeout;
  const controller = new AbortController();
  const budgets = [];
  AbortSignal.timeout = ms => { budgets.push(ms); return controller.signal; };
  globalThis.fetch = async (_url, { signal }) => ({ ok: true, json: () => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }) });
  const feed = new DepthMarketFeed({ eventSourceFactory: () => ({ close() {}, addEventListener() {} }) });
  try {
    feed.start(); await settle();
    assert.equal(feed.snapshotProbeInFlight, true);
    assert.deepEqual(budgets, [4000]);
    controller.abort(new Error('deadline'));
    await settle();
    assert.equal(feed.snapshotProbeInFlight, false);
    assert.equal(feed.running, true, 'failed repair cannot stop the live stream');
  } finally { feed.stop(); globalThis.fetch = originalFetch; AbortSignal.timeout = originalTimeout; }
});

test('a late bootstrap response cannot rewind a newer live depth book', async () => {
  const originalFetch = globalThis.fetch;
  let resolveProbe;
  let handlers;
  const snapshots = [];
  globalThis.fetch = () => new Promise(resolve => { resolveProbe = resolve; });
  const feed = new DepthMarketFeed({ onSnapshot: frame => snapshots.push(frame), eventSourceFactory: () => {
    handlers = new Map(); return { close() {}, addEventListener(name, handler) { handlers.set(name, handler); } };
  } });
  try {
    feed.start();
    handlers.get('depth')({ data: JSON.stringify({ status: { connected: true, fullDepth: true }, snapshot: raw(2, 200000) }) });
    resolveProbe({ ok: true, json: async () => ({ snapshot: raw(1, 100000) }) });
    await settle();
    assert.equal(snapshots.length, 1);
    assert.equal(feed.presentationSnapshot.timestamp, 200000);
  } finally { feed.stop(); globalThis.fetch = originalFetch; }
});
