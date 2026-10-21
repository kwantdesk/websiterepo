import test from 'node:test';
import assert from 'node:assert/strict';
import { vendorMarketDataFetch } from '../src/lib/vendorMarketData.server.ts';

test('one oversized or queued tool cannot put the entire provider into cooldown', async () => {
  const beforeFetch = globalThis.fetch;
  const settings = { KWANTDESK_MARKET_DATA_GATEWAY_URL: 'https://request-isolation-fixture.example', KWANTDESK_MARKET_DATA_GATEWAY_TOKEN: 'private-fixture' };
  const before = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
  Object.assign(process.env, settings);
  let calls = 0;
  try {
    for (const code of ['response_too_large','request_too_large','queue_full','request_timeout','ABORT_ERR']) {
      globalThis.fetch = async () => { calls++; return Response.json({ error: 'real scoped failure' }, { status: 502, headers: { 'x-kwantdesk-vendor-error': code } }); };
      const rejected = await vendorMarketDataFetch('quantdata', '/v1/options/tool/interval-map');
      assert.equal(rejected.status, 502); assert.equal((await rejected.json()).error, 'real scoped failure');
      globalThis.fetch = async () => { calls++; return Response.json({ data: { actual: 42 } }); };
      const healthy = await vendorMarketDataFetch('quantdata', '/v1/options/tool/net-drift');
      assert.deepEqual(await healthy.json(), { data: { actual: 42 } });
    }
    assert.equal(calls, 10);
  } finally {
    globalThis.fetch = beforeFetch;
    for (const key of Object.keys(settings)) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
  }
});
