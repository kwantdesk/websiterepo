import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createGexbotRelay, validateLegacyPath, validateDownload } from '../src/gexbot-relay.mjs';

async function fixture(t, options = {}) {
  const server = createGexbotRelay({ token: 'private-fixture', key: 'provider-fixture', ...options });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const root = 'http://127.0.0.1:' + server.address().port;
  return (path, init = {}) => fetch(root + path, { headers: { Authorization: 'Bearer private-fixture' }, ...init });
}
const read = '/v1/gexbot-legacy/read?path=' + encodeURIComponent('/SPX/classic/gex_full');
test('EOD sessions stay authenticated, exact-selection scoped, coalesced and out of live archiver',async t=>{
 let reads=0;const request=await fixture(t,{eod:{read:async(ticker,date)=>{reads++;assert.equal(ticker,'QQQ');assert.equal(date,'2026-10-21');return {source:'provider-eod-archive',data:[{ticker,timestamp:1792612800,cvroflow:-10.9}]};}},fetchImpl:()=>assert.fail('no live provider request'),archive:{archive:()=>assert.fail('no duplicate raw-session archive')}});
 const path='/v1/native-positioning/session?ticker=QQQ&date=2026-10-21';
 assert.equal((await request(path,{headers:{}})).status,401);
 assert.equal((await request(path+'&ticker=SPX')).status,400);
 const responses=await Promise.all([request(path),request(path)]);assert.deepEqual((await responses[0].json()).data[0].cvroflow,-10.9);assert.equal(reads,1);
});
test('EOD upstream refusal preserves failure status without forwarding secrets',async t=>{
 const request=await fixture(t,{eod:{read:async()=>{throw Object.assign(Error('secret'),{code:'EOD_UPSTREAM_FORBIDDEN',status:403});}}});
 const response=await request('/v1/native-positioning/session?ticker=QQQ&date=2026-10-21');assert.equal(response.status,403);assert.deepEqual(await response.json(),{error:'EOD_UPSTREAM_FORBIDDEN'});
});

test('legacy selection rejects arbitrary hosts, traversal, dates and write shapes', () => {
  for (const path of ['https://evil.test','//evil.test/x','/SPX/classic/../../x','/UNKNOWN/classic/gex_full','/SPX/orderflow/majors','/SPX/classic/gex_full?api_key=x']) assert.throws(() => validateLegacyPath(path));
  assert.equal(validateLegacyPath('/SPX/classic/gex_full'), '/SPX/classic/gex_full');
  assert.throws(() => validateLegacyPath('/hist/SPX/classic/full/2026-02-30', true));
  for (const url of ['http://x.blob.core.windows.net/a','https://127.0.0.1/a','https://x.blob.core.windows.net.evil.test/a','https://user@x.blob.core.windows.net/a','https://x.blob.core.windows.net:444/a']) assert.throws(() => validateDownload(url));
  assert.equal(validateDownload('https://archive.blob.core.windows.net/a?sig=fixture').hostname, 'archive.blob.core.windows.net');
});

test('authentication and operation validation happen before vendor access', async t => {
  let calls = 0;
  const request = await fixture(t, { fetchImpl: async () => { calls++; return Response.json({}); } });
  assert.equal((await request(read, { headers: {} })).status, 401);
  assert.equal((await request(read, { method: 'POST' })).status, 405);
  assert.equal((await request(read + '&path=other')).status, 400);
  assert.equal((await request('/v1/rithmic/connect')).status, 404);
  assert.equal(calls, 0);
});

test('concurrent identical reads coalesce, cache and archive one genuine response', async t => {
  const captures = []; let calls = 0;
  const request = await fixture(t, { archive: { archive: value => { captures.push(value); return true; }, status: () => ({ enabled: true }) },
    fetchImpl: async (url, init) => {
      calls++; assert.equal(String(url), 'https://api.gexbot.com/SPX/classic/gex_full');
      assert.equal(init.headers.Authorization, 'Bearer provider-fixture'); assert.equal(init.redirect, 'manual');
      await new Promise(resolve => setTimeout(resolve, 20)); return Response.json({ spot: 7000, timestamp: 123 });
    } });
  const responses = await Promise.all(Array.from({ length: 12 }, () => request(read)));
  assert.ok(responses.every(value => value.status === 200));
  assert.deepEqual(await responses[0].json(), { spot: 7000, timestamp: 123 });
  await request(read); assert.equal(calls, 1); assert.equal(captures.length, 1);
  assert.ok(!captures[0].payload.includes('provider-fixture'));
});

test('native requests reuse gateway cache and archive without changing values', async t => {
  const captures = [];
  const request = await fixture(t, { archive: { archive: value => { captures.push(value); return true; } },
    fetchImpl: async (url, init) => {
      assert.equal(url, 'http://gateway:8793/v1/native-positioning/snapshot?ticker=QQQ&package=state&category=gex_full');
      assert.equal(init.headers.Authorization, 'Bearer private-fixture');
      return Response.json({ data: { spot: 712, sum_gex_vol: -123.45 }, providerAsOf: '2026-10-20T19:59:59Z' });
    } });
  const response = await request('/v1/native-positioning/snapshot?ticker=QQQ&package=state&category=gex_full');
  assert.equal((await response.json()).data.sum_gex_vol, -123.45);
  assert.equal(captures.length, 1);
});

test('history download stays on VPS, rejects redirects and never forwards provider bearer to storage', async t => {
  let calls = 0;
  const request = await fixture(t, { fetchImpl: async (url, init) => {
    calls++;
    if (calls === 1) { assert.equal(init.headers.Authorization, 'Bearer provider-fixture'); return Response.json({ url: 'https://archive.blob.core.windows.net/a?sig=fixture' }); }
    assert.equal(init.headers.Authorization, undefined); assert.equal(init.redirect, 'manual');
    return Response.json([{ timestamp: 123, spot: 7000 }]);
  } });
  const path = '/v1/gexbot-legacy/history?path=' + encodeURIComponent('/hist/SPX/classic/full/2026-10-20');
  assert.equal((await request(path)).status, 200); assert.equal(calls, 2);
});

test('provider refusal remains refusal and is never cached as a valid frame', async t => {
  let calls = 0, captures = 0;
  const request = await fixture(t, { archive: { archive: () => captures++ }, fetchImpl: async () => { calls++; return Response.json({ secret: 'not-for-client' }, { status: 403 }); } });
  for (let i = 0; i < 2; i++) {
    const response = await request(read); assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'POSITIONING_UPSTREAM_403' });
  }
  assert.equal(calls, 2); assert.equal(captures, 0);
});
