import test from 'node:test';
import assert from 'node:assert/strict';
import { QuantDataToolLivePool } from '../src/quantdata-tool-live-pool.mjs';

function clock() {
  let now = 0, serial = 0; const jobs = new Map();
  const flush = async () => { for (let n = 0; n < 12; n++) await Promise.resolve(); };
  return { now: () => now, setTimeoutImpl: (fn, ms) => { const id = ++serial; jobs.set(id, { at: now + ms, fn }); return id; },
    clearTimeoutImpl: id => jobs.delete(id), flush,
    async advance(ms) {
      const end = now + ms; let count = 0;
      while (true) {
        const entry = [...jobs].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry) break;
        assert.ok(++count < 1000, 'timer loop must remain bounded');
        jobs.delete(entry[0]); now = entry[1].at; entry[1].fn(); await flush();
      }
      now = end; await flush();
    }, size: () => jobs.size };
}
const request = { path: '/v1/options/tool/net-drift', body: { filter: { ticker: 'SPY' } } };
const response = (value, at) => ({ text: JSON.stringify({ data: value }), retrievedAt: at });

test('identical selections share acquisition and changed frames across viewers', async () => {
  const c = clock(), starts = [], a = [], b = [];
  const pool = new QuantDataToolLivePool({ ...c, load: async () => { starts.push(c.now()); return response(starts.length, c.now()); } });
  const stopA = pool.subscribe(request, x => a.push(x));
  const stopB = pool.subscribe({ ...request, body: { filter: { ticker: 'SPY' } } }, x => b.push(x));
  await c.advance(4000);
  assert.deepEqual(starts, [0, 2000, 4000]);
  assert.equal(a.length, 3); assert.equal(b.length, 3);
  assert.equal(a[2], b[2]); assert.equal(a[2].sourceTimestamp, null);
  stopA(); stopB(); await c.advance(60000);
  assert.equal(starts.length, 3); assert.equal(pool.health().retainedBytes, 0); assert.equal(c.size(), 0);
});

test('canonical JSON keys coalesce but different filters never share a frame', async () => {
  const c = clock(), starts = [];
  const pool = new QuantDataToolLivePool({ ...c, load: async r => { starts.push(r.body); return response(r.body, c.now()); } });
  pool.subscribe({ ...request, body: { z: 1, filter: { ticker: 'SPY' } } }, () => {});
  pool.subscribe({ ...request, body: { filter: { ticker: 'SPY' }, z: 1 } }, () => {});
  pool.subscribe({ ...request, body: { filter: { ticker: 'QQQ' }, z: 1 } }, () => {});
  await c.advance(1000);
  assert.equal(starts.length, 2); assert.equal(pool.health().channels, 2);
  pool.dispose();
});

test('global start spacing bounds distinct channels and no channel starves', async () => {
  const c = clock(), starts = [];
  const pool = new QuantDataToolLivePool({ ...c, load: async r => { starts.push({ at: c.now(), body: r.body }); return response(1, c.now()); } });
  for (let n = 0; n < 6; n++) pool.subscribe({ ...request, body: { ticker: String(n) } }, () => {});
  await c.advance(11000);
  assert.equal(starts.length, 12);
  assert.equal(new Set(starts.slice(0, 6).map(x => x.body)).size, 6);
  assert.ok(starts.slice(1).every((x, n) => x.at - starts[n].at >= 1000));
  pool.dispose();
});

test('unchanged snapshots do not redraw and reconnect retains truthful retrieval time', async () => {
  const c = clock(), frames = [];
  const pool = new QuantDataToolLivePool({ ...c, load: async () => response(1, c.now()) });
  pool.subscribe(request, frame => frames.push(frame));
  await c.advance(6000);
  assert.equal(frames.length, 1); assert.equal(frames[0].retrievedAt, 0);
  const replayed = []; pool.subscribe(request, frame => replayed.push(frame));
  assert.equal(replayed[0], frames[0]); assert.equal(replayed[0].retrievedAt, 0);
  pool.dispose();
});

test('older replies cannot replace a newer published payload', async () => {
  const c = clock(), frames = []; let count = 0;
  const pool = new QuantDataToolLivePool({ ...c, load: async () => ++count === 1 ? response('new', 5000) : response('old', 4000) });
  pool.subscribe(request, x => frames.push(x)); await c.advance(2000);
  assert.equal(frames.length, 1); assert.equal(frames[0].payload.data, 'new'); pool.dispose();
});

test('unsubscribe aborts ownership and late completion cannot publish into a replacement selection', async () => {
  const c = clock(), frames = [], pending = [];
  const pool = new QuantDataToolLivePool({ ...c, load: r => new Promise(resolve => pending.push({ resolve, signal: r.signal })) });
  const stop = pool.subscribe(request, x => frames.push(x)); await c.advance(0); stop();
  assert.equal(pending[0].signal.aborted, true);
  pool.subscribe(request, x => frames.push(x)); await c.advance(1000);
  pending[0].resolve(response('old', 0)); pending[1].resolve(response('replacement', 1000)); await c.flush();
  assert.deepEqual(frames.map(x => x.payload.data), ['replacement']); pool.dispose();
});

test('failures preserve last verified frame and respect provider retry-after', async () => {
  const c = clock(), starts = [], frames = [], errors = [];
  const pool = new QuantDataToolLivePool({ ...c, load: async () => {
    starts.push(c.now()); if (starts.length === 2) throw Object.assign(Error('rate limited'), { retryAfterMs: 12000 });
    return response(starts.length, c.now());
  } });
  pool.subscribe(request, x => frames.push(x), e => errors.push(e)); await c.advance(13999);
  assert.deepEqual(starts, [0, 2000]); assert.equal(frames.length, 1); assert.equal(errors.length, 1);
  await c.advance(1); assert.deepEqual(starts, [0, 2000, 14000]); pool.dispose();
});

test('historical once demand never polls again and throwing viewer is isolated', async () => {
  const c = clock(); let starts = 0; const frames = [];
  const pool = new QuantDataToolLivePool({ ...c, load: async () => { starts++; return response(1, c.now()); } });
  pool.subscribe({ ...request, once: true }, () => { throw Error('closed viewer'); });
  pool.subscribe({ ...request, once: true }, x => frames.push(x)); await c.advance(600000);
  assert.equal(starts, 1); assert.equal(frames.length, 1); pool.dispose();
});

test('channel, subscriber and retained byte capacity fail explicitly', async () => {
  const c = clock(), errors = [];
  const pool = new QuantDataToolLivePool({ ...c, maxChannels: 1, maxSubscribers: 2, maxRetainedBytes: 10,
    load: async () => response('large enough to exceed retention', c.now()) });
  pool.subscribe(request, () => {}, e => errors.push(e));
  assert.throws(() => pool.subscribe({ ...request, body: { ticker: 'QQQ' } }, () => {}), /selection capacity/);
  pool.subscribe(request, () => {});
  assert.throws(() => pool.subscribe(request, () => {}), /subscriber capacity/);
  await c.advance(0); assert.equal(errors[0].code, 'memory_capacity'); assert.equal(pool.health().retainedBytes, 0);
  pool.dispose(); assert.throws(() => pool.subscribe(request, () => {}), /closed/);
});
