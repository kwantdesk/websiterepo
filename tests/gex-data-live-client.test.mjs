import test from 'node:test';
import assert from 'node:assert/strict';
import { createGexDataLiveClient, GexDataStreamUnavailable } from '../public/gex-data-live-client.js';
function fixture() {
  const sources = [], changes = [];
  const client = createGexDataLiveClient({ createSource: url => {
    const source = new EventTarget(); source.url = url; source.closed = false; source.close = () => { source.closed = true; };
    source.frame = (revision, at, value) => source.dispatchEvent(new MessageEvent('snapshot', { data: JSON.stringify({ data: value,
      _gexData: { revision, gatewayFetchedAt: new Date(at).toISOString() } }) }));
    sources.push(source); return source;
  }, onFrame: change => changes.push(change) });
  return { client, sources, changes };
}
const url = '/api/gex-data/net-drift', options = body => ({ method: 'POST', body: JSON.stringify(body) });
test('shared browser selection fans out changed frames, canonicalises keys and rejects rewind', async () => {
  const { client, sources, changes } = fixture();
  const first = client.request(url, options({ ticker: 'SPY', a: 1 }), 'a');
  const second = client.request(url, options({ a: 1, ticker: 'SPY' }), 'b');
  assert.equal(sources.length, 1); sources[0].frame('1', 1000, 7);
  assert.equal((await (await first).json()).data, 7); assert.equal((await (await second).json()).data, 7);
  assert.equal(changes.length, 0);
  sources[0].frame('2', 2000, 9); assert.equal(changes.length, 2);
  sources[0].frame('3', 1000, 1); sources[0].frame('2', 2000, 9);
  assert.equal(changes.length, 2);
  assert.equal((await (await client.request(url, options({ a: 1, ticker: 'SPY' }), 'a')).json()).data, 9);
  client.release('a'); assert.equal(sources[0].closed, false); client.release('b');
  assert.equal(sources[0].closed, true); assert.deepEqual(client.status(), { selections: 0, owners: 0, bytes: 0 });
});
test('changing ticker cancels old demand and late frames cannot contaminate the new selection', async () => {
  const { client, sources } = fixture();
  const old = client.request(url, options({ ticker: 'SPY' }), 'a');
  const rejected = assert.rejects(old, /closed/);
  const next = client.request(url, options({ ticker: 'QQQ' }), 'a'); await rejected;
  assert(sources[0].closed); sources[0].frame('late', 9999, 'SPY'); sources[1].frame('new', 1000, 'QQQ');
  assert.equal((await (await next).json()).data, 'QQQ'); client.dispose();
});
test('cancelled request cleans its waiter; pause closes all subscriptions; unsupported requests retain REST', async () => {
  const { client, sources } = fixture(); const controller = new AbortController();
  const promise = client.request(url, { ...options({ ticker: 'SPY' }), signal: controller.signal }, 'a');
  controller.abort(); await assert.rejects(promise, { name: 'AbortError' });
  assert.equal(client.request('/api/gex-data/status', {}, 'a'), null);
  assert.equal(client.request(url, options({ searchAfter: [1] }), 'a'), null);
  client.pause(); assert(sources.every(source => source.closed)); assert.equal(client.status().owners, 0);
});
test('feed refusal does not silently relabel old data as live; verified unchanged acquisition recovers', async () => {
  const { client, sources } = fixture(); const p = client.request(url, options({}), 'a');
  sources[0].frame('1', 1000, 5); await p;
  sources[0].dispatchEvent(new Event('feed-error'));
  await assert.rejects(client.request(url, options({}), 'a'), /temporarily/);
  sources[0].dispatchEvent(new Event('verified'));
  assert.equal((await (await client.request(url, options({}), 'a')).json()).data, 5); client.dispose();
});

test('a failed initial lease releases shared demand and allows a finite read', async () => {
  const { client, sources } = fixture();
  const body = { filter: { ticker: 'SPY' }, lookBackPeriod: 365, maturity: 30 };
  const endpoint = '/api/gex-data/iv-rank';
  const a = client.request(endpoint, options(body), 'a');
  const b = client.request(endpoint, options(body), 'b');
  sources[0].dispatchEvent(new Event('error'));
  await Promise.all([assert.rejects(a, GexDataStreamUnavailable), assert.rejects(b, GexDataStreamUnavailable)]);
  assert.equal(sources[0].closed, true);
  assert.equal(client.request(endpoint, options(body), 'a'), null);
  assert.equal(sources.length, 1);
  client.dispose();
});

test('a lease that opens without a snapshot has a bounded first-frame wait', async () => {
  let timeout;
  const source = new EventTarget();
  source.close = () => {};
  const client = createGexDataLiveClient({
    createSource: () => source,
    setTimer: (callback, delay) => { assert.equal(delay, 10_000); timeout = callback; return 1; },
    clearTimer: () => {},
  });
  const read = client.request(url, options({}), 'a');
  timeout();
  await assert.rejects(read, GexDataStreamUnavailable);
  assert.equal(client.request(url, options({}), 'a'), null);
  client.dispose();
});

test('latest-first Equity shares changed frames while older REST pages preserve its channel',async()=>{
 const {client,sources,changes}=fixture(),url='/api/gex-data/equity-prints';
 const body={sort:{field:'TRADE_TIME',direction:'DESCENDING'},size:100,filter:{tickers:['SPY']}};
 const initial=client.request(url,options(body),'equity');sources[0].frame('first',1000,[{id:'a'}]);await initial;
 assert.equal(client.request(url,options({...body,searchAfter:['a']}),'equity'),null);assert.equal(sources[0].closed,false);
 sources[0].frame('next',2000,[{id:'b'}]);assert.equal(changes.length,1);
 assert.equal((await (await client.request(url,options(body),'equity')).json()).data[0].id,'b');
 assert.equal(client.request(url,options({...body,sort:{field:'SIZE',direction:'DESCENDING'}}),'equity'),null);assert.equal(sources[0].closed,true);
 client.dispose();
});
test('chronological notifications share changed frames but ticker-ranked selections stay REST',async()=>{
 const {client,sources,changes}=fixture(),url='/api/gex-data/exchange-notifications',body={sessionDate:'2026-11-09',sort:{field:'CREATED_TIME',direction:'DESCENDING'},size:100};
 const first=client.request(url,options(body),'notifications');sources[0].frame('a',1000,[{id:'one'}]);await first;
 assert.equal(client.request(url,options({...body,searchAfter:['older']}),'notifications'),null);assert.equal(sources[0].closed,false);
 sources[0].frame('b',2000,[{id:'two'}]);assert.equal(changes.length,1);
 assert.equal(client.request(url,options({...body,sort:{field:'TICKER',direction:'DESCENDING'}}),'notifications'),null);assert.equal(sources[0].closed,true);client.dispose();
});

for(const tool of ['order-flow-consolidated','order-flow-unconsolidated'])test(`latest ${tool} shares acquisition and preserves its live channel during older-page reads`,async()=>{
 const {client,sources,changes}=fixture(),url='/api/gex-data/'+tool,body={sessionDate:'2026-11-09',size:100,includeStatistics:true,...(tool==='order-flow-consolidated'?{includeComprisingTrades:true}:{}),sort:{field:'TRADE_TIME',direction:'DESCENDING'}};
 const first=client.request(url,options(body),'flow');sources[0].frame('a',1000,[{id:'one',tradeTime:10}]);await first;
 assert.equal(client.request(url,options({...body,searchAfter:['older']}),'flow'),null);assert.equal(sources[0].closed,false);
 sources[0].frame('b',2000,[{id:'two',tradeTime:20}]);assert.equal(changes.length,1);
 assert.equal((await(await client.request(url,options(body),'flow')).json()).data[0].id,'two');
 assert.equal(client.request(url,options({...body,sort:{field:'PREMIUM',direction:'DESCENDING'}}),'flow'),null);assert.equal(sources[0].closed,true);client.dispose();
});

test('historical Market Map snapshots use finite reads and Latest can resume streaming', async () => {
  const {client,sources}=fixture(), url='/api/gex-data/market-map';
  const body={sessionDate:'2026-11-09'};
  const first=client.request(url,options(body),'map');
  sources[0].frame('latest',1000,{AAA:{size:5}});
  await first;
  assert.equal(client.request(url,options({snapshotTime:'2026-11-09T14:31:00Z'}),'map'),null);
  assert.equal(sources.length,1);
  assert.equal(sources[0].closed,true);
  assert.equal(client.request(url,options({snapshotTime:'2026-11-09T14:32:00Z'}),'map'),null);
  const resumed=client.request(url,options(body),'map');
  assert.equal(sources.length,2);
  sources[1].frame('resumed',2000,{AAA:{size:8}});
  assert.equal((await (await resumed).json()).data.AAA.size,8);
  client.dispose();
});
