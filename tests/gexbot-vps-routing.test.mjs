import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fetchGexBotGateway, fetchGexBotResearch } from '../src/lib/gexBotGateway.server.ts';

test('all website Gexbot helpers have no vendor key or direct vendor fetch', () => {
  for (const file of ['gexBot.server.ts','gexBotFlow.server.ts','gexBotVix.server.ts']) {
    const source = readFileSync(new URL('../src/lib/' + file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /process\.env\.GEXBOT_API_KEY|await fetch\(|= fetch\(/);
    assert.match(source, /gexBotGateway\.server/);
  }
});

test('actual adapter sends only the private gateway token and unwraps native frames exactly', async () => {
  const previous = globalThis.fetch;
  const env = { KWANTDESK_MARKET_DATA_GATEWAY_URL: 'https://gexbot-routing-fixture.example', KWANTDESK_MARKET_DATA_GATEWAY_TOKEN: 'gateway-fixture-only' };
  const before = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env); const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input)); calls.push(url);
    assert.equal(url.origin, env.KWANTDESK_MARKET_DATA_GATEWAY_URL);
    assert.equal(init.headers.Authorization, 'Bearer gateway-fixture-only');
    return Response.json(url.pathname === '/health' ? { connected: true, authenticated: true }
      : url.pathname.includes('native-positioning') ? { data: { spot: 712.45, agg_dex: -123.45 } } : { spot: 712.45 });
  };
  try {
    await fetchGexBotGateway('/SPX/classic/gex_full');
    assert.equal(calls.at(-1).searchParams.get('path'), '/SPX/classic/gex_full');
    await fetchGexBotGateway('/hist/SPX/classic/full/2026-10-20', true);
    assert.equal(calls.at(-1).pathname, '/v1/gexbot-legacy/history');
    assert.deepEqual(await (await fetchGexBotResearch({ ticker: 'QQQ', package: 'orderflow', category: 'orderflow' })).json(), { spot: 712.45, agg_dex: -123.45 });
    await assert.rejects(fetchGexBotGateway('https://api.gexbot.com/SPX/classic/gex_full'));
  } finally {
    globalThis.fetch = previous;
    for (const key of Object.keys(env)) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
  }
});
