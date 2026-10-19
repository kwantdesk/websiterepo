import test from 'node:test';
import assert from 'node:assert/strict';
import { createExecutionTapeEngine } from '../src/lib/executionTapeEngine.ts';
import { enrichCandlesWithInstitutionalTrades } from '../src/lib/institutionalMarketData.ts';
import { calculateIndicatorSeries } from '../src/lib/chartIndicatorEngine.ts';
import { tradeSeedLimit } from '../services/rithmic_gateway/src/trade-sse-continuity.mjs';

test('compact seed is opt-in, bounded and preserves legacy clients', () => {
  assert.equal(tradeSeedLimit(null), 25000);
  for (const value of ['', 'bad', '-1', '0', '1.5']) assert.equal(tradeSeedLimit(value), 25000);
  assert.equal(tradeSeedLimit('512'), 512);
  assert.equal(tradeSeedLimit('99999'), 25000);
});

test('transport ready and heartbeats cannot declare executions connected before the seed', async () => {
  const oldFetch = globalThis.fetch, oldSource = globalThis.EventSource;
  let source;
  class FakeSource {
    listeners = new Map();
    constructor(url) { this.url = url; source = this; }
    addEventListener(name, fn) { this.listeners.set(name, fn); }
    emit(name, payload) { this.listeners.get(name)?.({data: JSON.stringify(payload)}); }
    close() {}
  }
  globalThis.fetch = async () => ({ok: true});
  globalThis.EventSource = FakeSource;
  const received = [];
  const engine = createExecutionTapeEngine('NQ', 'NQZ6', {
    onStatus() {}, onContinuity() {}, onSeed: rows => received.push(rows), onTrades() {},
  });
  try {
    engine.start();
    await new Promise(resolve => setImmediate(resolve));
    assert.match(source.url, /seedLimit=128/);
    source.emit('ready', {continuity: 'seeding'});
    source.emit('heartbeat', {});
    assert.equal(engine.status(), 'checking');
    source.emit('seed', {streamId: 'test', batchSequence: 0, continuity: 'continuous', records: []});
    assert.equal(engine.status(), 'connected');
    assert.equal(received.length, 1);
  } finally {
    engine.stop(); globalThis.fetch = oldFetch; globalThis.EventSource = oldSource;
  }
});

const start = Date.UTC(2026, 9, 19, 13, 40);
const candle = (i, ask=800, bid=200) => ({timestamp: start+i*60000,
  open: 100, high: 101, low: 99, close: 100, volume: ask+bid,
  askVolume: ask, bidVolume: bid, delta: ask-bid});
const trade = (timestamp, size) => ({timestamp, open:100, high:100, low:100, close:100,
  volume:size, askVolume:size, bidVolume:0, delta:size, aggressor:'BUY', trades:1});

test('a compact seed cannot erase the first partially covered bar flow', () => {
  const bars = [candle(0), candle(1)];
  const result = enrichCandlesWithInstitutionalTrades(bars,
    [trade(NaN, 100), trade(start+59000, 5), trade(start+60001, 12)], 2, true);
  assert.equal(result[0].askVolume, 800);
  assert.equal(result[0].bidVolume, 200);
  assert.equal(result[1].askVolume, 12);
  assert.equal(result[1].bidVolume, 0);
});

test('session-offset delta OHLC is translated before cumulative rendering', () => {
  const theme = {primary:'#fff',secondary:'#aaa',positive:'#0f0',negative:'#f00',muted:'#888'};
  const rows = [
    {...candle(0,1741,1882), deltaOpen:358, deltaHigh:377, deltaLow:108, deltaClose:217},
    {...candle(1,1642,1662), deltaOpen:217, deltaHigh:318, deltaLow:108, deltaClose:197},
  ];
  const [series] = calculateIndicatorSeries({indicatorId:'cumulative-volume-delta',
    instanceId:'cvd',enabled:true,settings:{}}, rows, theme, {instrument:'NQ',tickSize:0.25});
  assert.deepEqual(series.data.map(p => [p.open,p.high,p.low,p.close]), [
    [0,19,-250,-141], [-141,-40,-250,-161],
  ]);
});
