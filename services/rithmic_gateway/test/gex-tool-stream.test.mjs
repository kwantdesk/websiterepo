import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { gexToolStreamSelection, attachGexToolStream } from '../src/gex-tool-stream.mjs';
const selection = (body = {}, tool = 'net-drift') => '?' + new URLSearchParams({ tool, request: Buffer.from(JSON.stringify(body)).toString('base64url') });
test('live selection preserves exact filters, historical pins acquire once independent of viewer timezone', () => {
  const now = Date.parse('2026-11-09T16:00Z');
  const live = gexToolStreamSelection(selection({ sessionDate: '2026-11-09', ticker: 'SPY' }), now);
  assert.equal(live.once, false); assert.equal(live.pollMs, 2000); assert.equal(live.body.ticker, 'SPY');
  assert.equal(gexToolStreamSelection(selection({ sessionDate: '2026-11-08' }), now).once, true);
  assert.equal(gexToolStreamSelection(selection({ snapshotTime: '2026-11-09T15:00Z' }), now).once, true);
  for (const query of [selection({}, 'bogus'), selection() + '&tool=net-drift', '?tool=net-drift&request=***', selection({ a: 'x'.repeat(4000) })]) assert.throws(() => gexToolStreamSelection(query, now));
});
test('real HTTP stream survives request completion, emits exact frame, releases on viewer disconnect', async () => {
  let send, verify, stopped = 0, subscriptions = 0;
  const pool = { subscribe(scope, listener, error, verified) { assert.equal(scope.path, '/v1/options/tool/net-drift'); subscriptions++; send = listener; verify = verified; return () => stopped++; } };
  const server = http.createServer((req, res) => attachGexToolStream(req, res, new URL(req.url, 'http://localhost'), pool));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const request = http.get(`http://127.0.0.1:${server.address().port}/${selection({ ticker: 'SPY' })}`);
  try {
    const [response] = await once(request, 'response'); let text = ''; response.setEncoding('utf8'); response.on('data', value => { text += value; });
    await new Promise(resolve => setTimeout(resolve, 20)); assert.equal(subscriptions, 1); assert.equal(stopped, 0);
    verify(1000); send({ payload: { data: 7 }, retrievedAt: 1000, revision: 'a', sourceTimestamp: null });
    await new Promise(resolve => setTimeout(resolve, 20)); assert.match(text, /event: snapshot/); assert.match(text, /"data":7/); assert.match(text, /event: verified/);
    response.destroy(); await new Promise(resolve => setTimeout(resolve, 20)); assert.equal(stopped, 1);
  } finally { request.destroy(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
