import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Worker as ThreadWorker } from 'node:worker_threads';
import { once } from 'node:events';
import { AuctionGapWorkerClient } from '../src/lib/auctionGapWorkerClient.ts';
import { runAuctionGapWorkerJob } from '../src/lib/auctionGap.worker.ts';
class FakeWorker {
  onmessage = null; onerror = null; jobs = []; stopped = false;
  postMessage(job) { this.jobs.push(job); }
  terminate() { this.stopped = true; }
  complete(job = this.jobs.at(-1)) { this.onmessage?.({ data: { scope: job.scope, revision: job.revision,
    result: { status: 'ready', reason: null, zones: [] } } }); }
}
test('1000 pending requests retain only the newest snapshot after active completion', () => {
  const worker = new FakeWorker(), replies = [], client = new AuctionGapWorkerClient(r => replies.push(r), () => worker);
  for (let i = 0; i < 1000; i++) client.request('a', { i });
  assert.equal(worker.jobs.length, 1);
  worker.complete(); assert.equal(replies.length, 1); assert.equal(worker.jobs.length, 2);
  assert.equal(worker.jobs[1].input.i, 999); worker.complete(); assert.equal(replies.length, 2);
  client.dispose(); assert.equal(worker.stopped, true); assert.equal(client.request('a', {}), false);
});
test('scope changes terminate old workers and ignore captured late handlers', () => {
  const workers = [], replies = [], client = new AuctionGapWorkerClient(r => replies.push(r), () => { const w = new FakeWorker(); workers.push(w); return w; });
  client.request('old', {}); const late = workers[0].onmessage, oldJob = workers[0].jobs[0];
  client.request('new', {}); assert.equal(workers[0].stopped, true);
  late({ data: { ...oldJob, result: { status: 'ready', zones: [] } } }); assert.equal(replies.length, 0);
  workers[1].complete(); assert.equal(replies[0].scope, 'new'); client.dispose();
});
test('wrong revision does not retire active work; receiver disposal prevents queued dispatch', () => {
  const worker = new FakeWorker(); let client;
  client = new AuctionGapWorkerClient(() => client.dispose(), () => worker);
  client.request('a', {}); client.request('a', {});
  worker.onmessage({ data: { scope: 'a', revision: 999, result: {} } }); assert.equal(worker.jobs.length, 1);
  worker.complete(); assert.equal(worker.jobs.length, 1); assert.equal(worker.stopped, true);
});
test('worker errors and constructor failures are explicit, with no main-thread fallback', () => {
  const replies = [], worker = new FakeWorker(), client = new AuctionGapWorkerClient(r => replies.push(r), () => worker);
  client.request('a', {}); worker.onerror({ preventDefault() {} });
  assert.equal(replies[0].result.reason, 'worker-failed'); assert.equal(worker.stopped, true);
  const failed = new AuctionGapWorkerClient(r => replies.push(r), () => { throw Error('unavailable'); });
  failed.request('a', {}); assert.equal(replies[1].result.reason, 'worker-unavailable');
});
test('actual handler echoes generation and catches malformed calculation input', () => {
  const reply = runAuctionGapWorkerJob({ scope: 'chart', revision: 7, input: null });
  assert.equal(reply.scope, 'chart'); assert.equal(reply.revision, 7);
  assert.equal(reply.result.status, 'unavailable');
});

test('receiver can submit a newer request without resurrecting the older queued snapshot', () => {
  const worker = new FakeWorker(); let client, first = true;
  client = new AuctionGapWorkerClient(() => {
    if (first) { first = false; client.request('a', { value: 3 }); }
  }, () => worker);
  client.request('a', { value: 1 }); client.request('a', { value: 2 });
  worker.complete(); assert.deepEqual(worker.jobs.map(j => j.input.value), [1, 3]);
  worker.complete(); assert.equal(worker.jobs.length, 2); client.dispose();
});

test('message cloning failure terminates the worker and allows an explicit subsequent retry', () => {
  const broken = new FakeWorker(), replacement = new FakeWorker(), replies = [];
  broken.postMessage = () => { throw Error('clone failed'); };
  let attempts = 0;
  const client = new AuctionGapWorkerClient(r => replies.push(r), () => attempts++ ? replacement : broken);
  client.request('a', {}); assert.equal(broken.stopped, true);
  assert.equal(replies[0].result.reason, 'worker-unavailable');
  client.request('a', {}); replacement.complete();
  assert.equal(replies[1].result.status, 'ready'); client.dispose();
});

test('actual entry calculates cloned execution data on a separate thread', { timeout: 10000 }, async () => {
  // Tests the real worker entry and structured-clone boundary, not browser bundling.
  const url = new URL('../src/lib/auctionGap.worker.ts', import.meta.url).href;
  const worker = new ThreadWorker(`
    const { parentPort } = require('node:worker_threads');
    globalThis.self = { postMessage: value => parentPort.postMessage(value) };
    import(${JSON.stringify(url)}).then(() => {
      parentPort.on('message', data => self.onmessage({ data }));
    }).catch(error => { throw error; });
  `, { eval: true, execArgv: ['--import', new URL('../scripts/alias-hook.mjs', import.meta.url).href] });
  try {
    const start = Date.parse('2026-09-08T13:30:00Z');
    const input = {
      contractSymbol: 'NQU6', expectedContract: 'NQU6', tickSize: .25, asOfMs: start + 59999,
      coverage: 'complete', chart: { kind: 'time' },
      records: [100.25, 100.5, 100.75].map((price, i) => ({ recordIndex: i, timestamp: start + i,
        open: price, high: price, low: price, close: price, volume: 10, trades: 1,
        bidVolume: 0, askVolume: 10, aggressor: 'BUY' })),
      candles: [{ timestamp: start, open: 100.25, high: 100.75, low: 100.25, close: 100.75, volume: 30 }],
      geometry: [{ id: 'a', timestamp: start, endTime: start + 60000, lowTick: 401, highTick: 403,
        openTick: 401, closeTick: 403, isClosed: false }],
      calendar: { timeZone: 'America/Chicago', sessionOpenMinutes: 1020, rthStartMinutes: 510, rthEndMinutes: 900 },
      timeSettings: { resetMode: 'none', filterTime: 'none', customStartMinutes: 0, customEndMinutes: 0 },
      detectionSettings: { includeMode: 'all' },
      lifecycleSettings: { extendedBars: 200, retestMode: 'touch', showTriggered: true, onlyTriggered: false },
    };
    const replyPromise = once(worker, 'message');
    worker.postMessage({ scope: 'nq:1m', revision: 17, input });
    const [reply] = await replyPromise;
    assert.equal(reply.scope, 'nq:1m'); assert.equal(reply.revision, 17);
    assert.equal(reply.result.status, 'ready'); assert.equal(reply.result.zones.length, 1);
    assert.deepEqual([reply.result.zones[0].lowTick, reply.result.zones[0].highTick], [401, 403]);
  } finally { await worker.terminate(); }
});
