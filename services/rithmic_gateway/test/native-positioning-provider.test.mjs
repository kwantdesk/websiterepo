import test from 'node:test';
import assert from 'node:assert/strict';
import { createProvider, validateSelection, parseKeyFile, resolveKey, ProviderError } from '../src/native-positioning-provider.mjs';

const selection = { ticker: 'SPX', package: 'classic', category: 'gex_full' };
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', ...headers } });

test('dotenv parsing rejects wrong variable, supports quotes/whitespace/comments without printing secret', async () => {
  assert.equal(parseKeyFile('# GEXBOT_API_KEY=no\nOTHER=yes'), null);
  assert.equal(parseKeyFile(' GEXBOT_API_KEY = "test-placeholder" # note'), 'test-placeholder');
  assert.equal(parseKeyFile("export GEXBOT_API_KEY='test-placeholder'"), 'test-placeholder');
  assert.equal(parseKeyFile('GEXBOT_API_KEY= test-placeholder # note'), 'test-placeholder');
  assert.equal(parseKeyFile('GEXBOT_API_KEY="unterminated'), null);
  assert.equal(await resolveKey({ GEXBOT_API_KEY: ' test-placeholder ' }), 'test-placeholder');
});
test('strict catalog membership, valid dates and no open paths', () => {
  for (const input of [{ticker:'../whoami'}, {package:'negotiate'}, {category:'../../whoami'}, {view:'negotiate'}]) assert.throws(() => validateSelection({...selection,...input}), ProviderError);
  for (const date of ['2026-02-30','2026-10-19','2025-10-18','http://evil']) assert.throws(() => validateSelection({...selection,date},undefined,true,Date.parse('2026-10-18T12:00Z')), ProviderError);
  assert.equal(validateSelection({...selection,date:'2026-10-16'},undefined,true,Date.parse('2026-10-18T12:00Z')).date,'2026-10-16');
});
test('missing key is not authenticated and does not request provider', async () => {
  const provider = createProvider({fetchImpl: () => assert.fail('no provider request')});
  const status = await provider.status();
  assert.equal(status.keyConfigured,false); assert.equal(status.authenticated,false);
  await assert.rejects(provider.snapshot(selection), { code:'API_KEY_REQUIRED' });
});
test('401 is truthful and upstream body including credentials is never exposed', async () => {
  let calls = 0;
  const provider = createProvider({key:'test-placeholder',fetchImpl:async()=>{calls++; return json({error:'sensitive-provider-body',api_key:'never-return'},401);}});
  const status = await provider.status();
  assert.equal(status.keyConfigured,true); assert.equal(status.authenticated,false); assert.equal(status.error,'UPSTREAM_AUTH_REJECTED');
  assert.ok(!JSON.stringify(status).includes('never-return'));
  await assert.rejects(provider.snapshot(selection),error=>error.code==='UPSTREAM_AUTH_REJECTED' && !error.message.includes('sensitive'));
  assert.equal(calls,2);
});
test('native null spot and unknown timestamps remain null/unknown', async () => {
  const provider = createProvider({key:'test-placeholder',fetchImpl:async()=>json({spot:null,strikes:[]})});
  const result = await provider.snapshot(selection);
  assert.equal(result.data.spot,null); assert.equal(result.providerAsOf,null); assert.equal(result.freshness.state,'unknown');
});
test('future timestamp is clock skew, never recent/live', async () => {
  const provider=createProvider({key:'test-placeholder',now:()=>100000,fetchImpl:async()=>json({timestamp:101})});
  const result=await provider.snapshot(selection);
  assert.equal(result.freshness.ageMs,-1000); assert.equal(result.freshness.state,'future-clock-skew');
});
test('Greek state routes cannot use GEX majors or maxchange suffix', () => {
  for(const view of ['majors','maxchange'])assert.throws(()=>validateSelection({ticker:'SPX',package:'state',category:'gamma_zero',view}),{code:'UNSUPPORTED_VIEW'});
});
test('current 2.10 whoami schema projects only bounded entitlements and permission booleans', async () => {
  const provider=createProvider({key:'test-placeholder',fetchImpl:async()=>json({_id:'private-identity',api_key:{id:'private-key-id'},level:['quant','private-field'],max_level:'quant',entitlements:{gexbot:{level:'quant'}},permissions:['api_rest_access','api_websocket_access','private-field']})});
  const status=await provider.status();
  assert.equal(status.authenticated,true);assert.deepEqual(status.entitlements.levels,['quant']);assert.equal(status.entitlements.restAllowed,true);assert.equal(status.entitlements.websocketAllowed,true);assert.ok(!JSON.stringify(status).includes('private'));
});
test('coalescing plus <=1 second TTL, no stale-as-live and midnight rollover', async () => {
  let clock = Date.parse('2026-10-16T23:59:59.900Z'), calls = 0;
  const provider = createProvider({key:'test-placeholder',now:()=>clock,fetchImpl:async()=>{calls++; return json({timestamp:1792177200,spot:7000,strikes:[]});}});
  const [a,b] = await Promise.all([provider.snapshot(selection),provider.snapshot(selection)]);
  assert.equal(calls,1); assert.equal(a.cache.hit,false); assert.equal(b.cache.hit,true);
  clock += 999;
  const cached = await provider.snapshot(selection);
  assert.equal(calls,1); assert.equal(cached.fetchedAt,a.fetchedAt); assert.equal(cached.freshness.state,'frozen-or-stale');
  clock += 1;
  await provider.snapshot(selection); assert.equal(calls,2);
});
test('failed snapshots are not cached, rate limits have cooldown and retry metadata', async () => {
  let clock = 100000, calls = 0;
  const provider = createProvider({key:'test-placeholder',now:()=>clock,fetchImpl:async()=>{calls++; return calls===1 ? json({},429,{'retry-after':'3'}) : json({timestamp:100});}});
  await assert.rejects(provider.snapshot(selection), {code:'UPSTREAM_RATE_LIMITED',retryAfterSeconds:3});
  await assert.rejects(provider.snapshot(selection), {code:'UPSTREAM_RATE_LIMITED'});
  assert.equal(calls,1); clock += 3000;
  await provider.snapshot(selection); assert.equal(calls,2);
});
test('network errors and timeout messages are redacted', async () => {
  const provider = createProvider({key:'test-placeholder',fetchImpl:async()=>{throw new Error('Bearer test-placeholder private-path');}});
  await assert.rejects(provider.snapshot(selection), error => error.code === 'UPSTREAM_UNAVAILABLE' && !error.message.includes('private-path'));
  const timeout = createProvider({key:'test-placeholder',fetchImpl:async()=>{throw new DOMException('secret','TimeoutError');}});
  await assert.rejects(timeout.snapshot(selection), {code:'UPSTREAM_TIMEOUT'});
});
test('public catalog uses authoritative successful public endpoints without authorization', async () => {
  const provider = createProvider({key:'test-placeholder',fetchImpl:async(url,init)=>{
    assert.equal(init.headers.Authorization,undefined);
    if(url.endsWith('/tickers'))return json({indexes:['SPX'],stocks:[],futures:[]});
    return json(url.includes('/orderflow/')?['orderflow']:['gex_full']);
  }});
  const catalog = await provider.catalog();
  assert.equal(catalog.catalogSource,'public-api'); assert.deepEqual(catalog.tickers,['SPX']);
  await assert.rejects(provider.snapshot({...selection,ticker:'QQQ'}),{code:'UNSUPPORTED_SELECTION'});
});
test('history never forwards bearer credentials to signed download host or returns signed URL', async () => {
  let calls = 0;
  const provider = createProvider({key:'test-placeholder',now:()=>Date.parse('2026-10-18T12:00Z'),fetchImpl:async(url,init)=>{
    calls++;
    if(calls===1) return json({url:'https://history.blob.core.windows.net/container/file.json?signature=private'});
    assert.equal(init.headers.Authorization,undefined); return json([{timestamp:1,spot:null}]);
  }});
  const result = await provider.history({...selection,date:'2026-10-16'});
  assert.equal(result.freshness.state,'historical'); assert.ok(Array.isArray(result.data));
  assert.ok(!JSON.stringify(result).includes('signature'));
});
test('history rejects private-network redirect before any download', async () => {
  let calls=0;
  const provider=createProvider({key:'test-placeholder',now:()=>Date.parse('2026-10-18T12:00Z'),fetchImpl:async()=>{calls++;return json({url:'https://127.0.0.1/internal'});}});
  await assert.rejects(provider.history({...selection,date:'2026-10-16'}),{code:'UNSUPPORTED_HISTORY_STORAGE'}); assert.equal(calls,1);
});
