import test from 'node:test';
import assert from 'node:assert/strict';
import {acquireKwantyPrices, createKwantyPricePool, kwantyPriceSymbol} from '../src/lib/kwantyPriceBridge.ts';

// Explicit mocked transport; these tests never contact a market-data provider.
const time = Date.UTC(2026, 9, 20, 14);
const candle = {timestamp: time, open: 100, high: 105, low: 98, close: 101};
const response = () => new Response(JSON.stringify({candles: [candle]}), {status: 200});

test('historical converted futures use date-bounded CME history, coalesce and never substitute live cash',async()=>{
 const requests=[];let release;const host=createKwantyPricePool({fetch:async(url,options)=>{requests.push({url,options});await new Promise(resolve=>release=resolve);return response();},frontMonth:async()=>{throw Error('Must not resolve a live contract');},snapshot:async()=>{throw Error('Must not use live snapshots');}});
 try{const a=host.priceHistory('NQ_NDX','2026-10-20'),b=host.priceHistory('NQ','2026-10-20');assert.equal(requests.length,1);release();assert.equal((await a).length,1);assert.deepEqual(await b,await host.priceHistory('NQ','2026-10-20'));assert.equal(requests.length,1);
 const url=new URL(requests[0].url,'https://fixture.invalid');assert.equal(url.pathname,'/api/cme-history');assert.equal(url.searchParams.get('symbol'),'NQ.c.0');assert.equal(url.searchParams.get('exec'),'0');assert.equal(Number(url.searchParams.get('from')),Date.parse('2026-10-19T22:00:00Z'));assert.equal(Number(url.searchParams.get('to')),Date.parse('2026-10-20T21:00:00Z'));assert.ok(requests[0].options.signal);
 }finally{host.dispose();}
});

test('unavailable historical futures fail closed without a cash or latest-session fallback',async()=>{
 let calls=0;const host=createKwantyPricePool({fetch:async()=>{calls++;return new Response('{}',{status:503});},frontMonth:async()=>{throw Error('Must not request live');}});
 try{await assert.rejects(host.priceHistory('ES_SPX','2026-10-20'),/Historical futures price/);await assert.rejects(host.priceHistory('ES_SPX','2026-10-20'),/Historical futures price/);assert.equal(calls,2);}finally{host.dispose();}
});

test('underlying symbols remain distinct and converted profiles use explicit futures roots', () => {
  assert.equal(kwantyPriceSymbol('QQQ'), 'QQQ');
  assert.equal(kwantyPriceSymbol('NDX'), 'NDX');
  assert.equal(kwantyPriceSymbol('SPXW'), 'SPX');
  assert.equal(kwantyPriceSymbol('NQ_NDX'), 'NQ');
  assert.equal(kwantyPriceSymbol('ES_SPX'), 'ES');
  assert.equal(kwantyPriceSymbol('ES'), 'ES');
  assert.equal(kwantyPriceSymbol('NQ'), 'NQ');
  assert.throws(() => kwantyPriceSymbol('UNKNOWN'));
});

test('same-account history acquisition coalesces and caches without altering the request source', async t => {
  const original = globalThis.fetch; let calls = 0; let release;
  globalThis.fetch = async url => {
    calls++;
    assert.match(String(url), /^\/api\/market-indices\?/);
    assert.equal(new URL(String(url), 'https://fixture.invalid').searchParams.get('symbol'), 'QQQ');
    await new Promise(resolve => {release = resolve;}); return response();
  };
  const first = acquireKwantyPrices('bridge-test-coalesce'), second = acquireKwantyPrices('bridge-test-coalesce');
  t.after(() => {first.release(); second.release(); globalThis.fetch = original;});
  const a = first.priceHistory('QQQ'), b = second.priceHistory('QQQ');
  assert.equal(calls, 1); release();
  assert.deepEqual(await a, [{time, open: 100, high: 105, low: 98, close: 101}]);
  assert.deepEqual(await b, await second.priceHistory('QQQ'));
  assert.equal(calls, 1);
});

test('failed history never becomes a cached success and invalid bars remain unavailable', async t => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return new Response(JSON.stringify({error: 'fixture failure'}), {status: 503});
    if (calls === 2) return new Response(JSON.stringify({candles: [{...candle, high: 99}]}), {status: 200});
    return response();
  };
  const host = acquireKwantyPrices('bridge-test-errors');
  t.after(() => {host.release(); globalThis.fetch = original;});
  await assert.rejects(host.priceHistory('QQQ'), /unavailable/i);
  await assert.rejects(host.priceHistory('QQQ'), /unavailable/i);
  assert.equal((await host.priceHistory('QQQ')).length, 1);
  assert.equal(calls, 3);
});

test('accounts do not share private caches and released hosts cannot fetch', async t => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => {calls++; return response();};
  const first = acquireKwantyPrices('bridge-test-account-a'), second = acquireKwantyPrices('bridge-test-account-b');
  t.after(() => {first.release(); second.release(); globalThis.fetch = original;});
  await first.priceHistory('QQQ'); await second.priceHistory('QQQ');
  assert.equal(calls, 2);
  first.release(); first.release();
  await assert.rejects(first.priceHistory('QQQ'), /closed/i);
});

test('final account release aborts in-flight history instead of retaining a hanging request', async t => {
  const original = globalThis.fetch; let signal;
  globalThis.fetch = async (_url, init) => {
    signal = init.signal;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), {once: true}));
  };
  const host = acquireKwantyPrices('bridge-test-abort');
  t.after(() => {host.release(); globalThis.fetch = original;});
  const pending = host.priceHistory('QQQ');
  host.release();
  assert.equal(signal.aborted, true);
  await assert.rejects(pending, /aborted/);
});

test('returned history snapshots cannot mutate shared cached bars', async () => {
  const host = createKwantyPricePool({fetch: async () => response()});
  try {
    const first = await host.priceHistory('QQQ'); first[0].high = 999; first.length = 0;
    assert.equal((await host.priceHistory('QQQ'))[0].high, 105);
  } finally {host.dispose();}
});

test('rejected front-month lookup recovers instead of poisoning the shared contract cache', async () => {
  let calls = 0;
  const host = createKwantyPricePool({frontMonth: async () => {
    calls++; if (calls === 1) throw Error('fixture connection failure');
    return {contractSymbol: 'NQZ6'};
  }, snapshot: async () => ({candles: [candle]})});
  try {
    await assert.rejects(host.priceHistory('NQ'), /fixture/);
    assert.equal((await host.priceHistory('NQ')).length, 1);
    assert.equal(calls, 2);
  } finally {host.dispose();}
});

const trade = (timestamp, price) => ({timestamp, open: price, high: price, low: price, close: price, flowOnly: false});
test('retained futures seed and initial observed minute are quote-only; continuous next minute has real trade OHLC', async () => {
  let handlers; const frames = [];
  const host = createKwantyPricePool({frontMonth: async () => ({contractSymbol: 'NQZ6'}), subscribeTrades: args => {handlers = args; return () => {};}});
  const stop = host.subscribePrice('NQ_NDX', frame => frames.push(frame));
  await new Promise(resolve => setImmediate(resolve));
  handlers.onStatus('connected'); handlers.onContinuity('continuous');
  handlers.onSeed([trade(time + 1_000, 100), trade(time + 2_000, 101)]);
  assert.equal(frames.at(-1).candle, undefined);
  handlers.onTrades([trade(time + 10_000, 102)]);
  assert.equal(frames.at(-1).candle, undefined);
  handlers.onTrades([trade(time + 60_000, 103), trade(time + 61_000, 106), trade(time + 62_000, 104)]);
  assert.deepEqual(frames.at(-1).candle, {time: time + 60_000, open: 103, high: 106, low: 103, close: 104});
  handlers.onContinuity('broken'); handlers.onTrades([trade(time + 63_000, 107)]);
  assert.equal(frames.at(-1).candle, undefined);
  handlers.onContinuity('continuous'); handlers.onTrades([trade(time + 64_000, 108)]);
  assert.equal(frames.at(-1).candle, undefined);
  handlers.onTrades([trade(time + 120_000, 109)]);
  assert.deepEqual(frames.at(-1).candle, {time: time + 120_000, open: 109, high: 109, low: 109, close: 109});
  const count = frames.length; stop(); handlers.onTrades([trade(time + 121_000, 110)]);
  assert.equal(frames.length, count); host.dispose();
});

test('one delivery batch spanning a candle boundary publishes both final bar updates', async () => {
  let handlers; const frames = [];
  const host = createKwantyPricePool({frontMonth: async () => ({contractSymbol: 'ESZ6'}), subscribeTrades: args => {handlers = args; return () => {};}});
  host.subscribePrice('ES', frame => frames.push(frame));
  await new Promise(resolve => setImmediate(resolve));
  handlers.onContinuity('continuous'); handlers.onTrades([trade(time + 1_000, 100)]);
  handlers.onTrades([trade(time + 60_000, 101)]);
  frames.length = 0;
  handlers.onTrades([trade(time + 119_999, 105), trade(time + 120_000, 103)]);
  assert.equal(frames.length, 2);
  assert.equal(frames[0].candle.high, 105);
  assert.equal(frames[1].candle.open, 103);
  host.dispose();
});

test('history pending work is bounded and disposal aborts all outstanding private requests', async () => {
  let calls = 0;
  const host = createKwantyPricePool({fetch: async (_url, {signal}) => {
    calls++; return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Error('aborted')), {once: true}));
  }});
  const pending = [];
  for (let day = 1; day <= 24; day++) pending.push(host.priceHistory('QQQ', `2026-09-${String(day).padStart(2, '0')}`));
  await assert.rejects(host.priceHistory('QQQ', '2026-09-25'), /Too many/);
  assert.equal(calls, 24);
  host.dispose();
  assert.ok((await Promise.allSettled(pending)).every(result => result.status === 'rejected'));
});
