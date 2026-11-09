import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('only the exact presentation script bypasses auth routing; lease APIs remain protected', () => {
  const code=fs.readFileSync('middleware.ts','utf8');
  const matcher=JSON.parse(code.match(/matcher:\s*(\["[^\n]+"\])/)[1])[0];
  const routed=new RegExp('^'+matcher+'$');
  assert.equal(routed.test('/browser-market-stream.js'),false);
  for(const path of ['/browser-market-stream.js/other','/api/databento/live','/api/institutional-market-data/v1/heatmap/stream','/api/institutional-market-data/v1/market-data/index-stream']) assert.equal(routed.test(path),true,path);
});

function harness(overrides = {}) {
  const timers = new Map(), requests = [], sockets = []; let id = 0;
  class Socket extends EventTarget {
    readyState = 0; closed = false;
    constructor(url) { super(); this.url = url; sockets.push(this); }
    close() { this.closed = true; this.readyState = 2; }
    open() { this.readyState = 1; this.onopen?.(new Event('open')); }
    send(type, data) { this.dispatchEvent(new MessageEvent(type, { data })); }
    fail() { this.onerror?.(new Event('error')); }
  }
  const validLease = { transport: 'direct-vps', url: 'https://feed.kwantdesk.com/browser-stream?ticket=fixture', expiresAt: Date.now() + 300000 };
  const context = { URL, EventTarget, Event, MessageEvent, AbortController, Date,
    EventSource: Socket, setTimeout: (fn, ms) => { timers.set(++id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id),
    fetch: async (url, options) => { requests.push({url, options}); return { ok: true, json: async () => validLease }; },
    ...overrides };
  vm.runInNewContext(fs.readFileSync('public/browser-market-stream.js', 'utf8').replace('export function', 'function') + '\nthis.create=createLeasedMarketSource;', context);
  return { create: context.create, timers, requests, sockets, validLease,
    settle: () => new Promise(resolve => setImmediate(resolve)),
    run(ms) { const entry = [...timers].find(([, t]) => t.ms === ms); assert(entry, `timer ${ms}`); timers.delete(entry[0]); entry[1].fn(); } };
}

test('all three streams negotiate same-origin exact query and preserve named/raw events', async () => {
  for (const path of ['/api/databento/live', '/api/institutional-market-data/v1/market-data/index-stream', '/api/institutional-market-data/v1/heatmap/stream']) {
    const h = harness(), source = h.create(path + '?symbol=NQ&contractSymbol=NQZ6&since=123');
    const received = []; source.addEventListener('cvd-history', e => received.push(e.data)); source.onmessage = e => received.push(e.data);
    await h.settle(); assert.equal(h.requests.length, 1);
    const url = new URL(h.requests[0].url, 'https://www.kwantdesk.com');
    assert.equal(url.searchParams.get('streamLease'), '1'); assert.equal(url.searchParams.get('since'), '123');
    assert.equal(url.searchParams.get('contractSymbol'), 'NQZ6'); assert.equal(h.requests[0].options.credentials, 'same-origin');
    assert.equal(h.sockets[0].url, h.validLease.url); h.sockets[0].open();
    h.sockets[0].send('message', 'raw-quote'); h.sockets[0].send('cvd-history', 'raw-cvd');
    assert.deepEqual(received, ['raw-quote', 'raw-cvd']); source.close(); assert.equal(h.timers.size, 0);
  }
});

test('renewal keeps existing delivery until new connection opens, then rejects stale events', async () => {
  const h = harness(), source = h.create('/api/databento/live?symbols=NQ'); const seen = [];
  source.onmessage = e => seen.push(e.data); await h.settle(); h.sockets[0].open();
  const renewal = [...h.timers].find(([, t]) => t.ms > 280000); assert(renewal);
  h.timers.delete(renewal[0]); renewal[1].fn(); await h.settle();
  h.sockets[0].send('message', 'during-renewal'); assert.equal(h.sockets[0].closed, false);
  h.sockets[1].open(); assert.equal(h.sockets[0].closed, true);
  h.sockets[0].send('message', 'stale'); h.sockets[1].send('message', 'new');
  assert.deepEqual(seen, ['during-renewal', 'new']); source.close();
});

test('errors re-lease instead of reusing expired URL; closing cancels late lease completion', async () => {
  const h = harness(), source = h.create('/api/databento/live'); await h.settle();
  h.sockets[0].open(); h.sockets[0].fail(); assert(h.sockets[0].closed); h.run(1000); await h.settle();
  assert.equal(h.requests.length, 2); source.close();
  let resolve; const late = harness({fetch: () => new Promise(r => {resolve = r;})});
  const closed = late.create('/api/databento/live'); closed.close();
  resolve({ok: true, json: async () => late.validLease}); await late.settle(); assert.equal(late.sockets.length, 0);
});

test('denied and malicious leases fail closed without proxied streaming fallback', async () => {
  for (const bad of [{url:'https://attacker.example/browser-stream?ticket=x'}, {url:'https://feed.kwantdesk.com/browser-stream?ticket=x&symbol=ES'}, {expiresAt:Date.now()-1}, {transport:'proxy'}]) {
    const h = harness(); Object.assign(h.validLease, bad); const source = h.create('/api/databento/live');
    let errors = 0; source.onerror = () => errors++; await h.settle(); assert.equal(errors, 1); assert.equal(h.sockets.length, 0); source.close();
  }
  const h = harness({fetch: async () => ({ok:false})}), source = h.create('/api/databento/live'); await h.settle(); assert.equal(h.sockets.length, 0); source.close();
  assert.throws(() => h.create('https://attacker.example/api/databento/live'));
});
